/*jshint strict:true*/
(function() {
	'use strict';
	const {stringify, parse} = JSON;
	let panels;
	let cm;
	/*
		These are a couple of convenience routines.
	*/
	const $ = 'querySelector';
	const $$ = $ + 'All';
	function el(html) {
		const elem = document.createElement('p');
		elem.innerHTML = html;
		return elem.firstChild;
	}
	/*
		The Harlowe Toolbar fits above the CodeMirror panel and provides a number of convenience buttons, in the style of forum post editors,
		to ease the new user into the format's language.
	*/
	const toolbarElem = el('<div class="harloweToolbar">');
	/*
		Populate the toolbar with a <datalist> of all the visible passages.
	*/
	(() => {
		const datalist = el("<datalist id='harlowe-3-passages'>");
		datalist.append(...Array.from(document[$$]('.passage')).map(e => {
			if (e.__vue__) {
				const o = el(`<option>`);
				o.setAttribute('value', e.__vue__.passage.name);
				return o;
			}
		}));
		toolbarElem.append(datalist);
	})();

	/*
		All output from the buttons and wizards is from this function, which places Harlowe code into the passage around the selection.
		"stringify" indicates whether to convert the wrapped text to a string.
	*/
	function wrapSelection(before,after,innerText,stringify=false) {
		if (!cm || (before + after).length === 0) {
			return;
		}
		/*
			Some syntax (such as links) directly replaces the current selection entirely. Others
			wrap the selection, or, if none exists, the "Your Text Here" prompt text.
		*/
		const wrapped = innerText !== undefined ? innerText : cm.doc.getSelection() || "Your Text Here";
		cm.doc.replaceSelection(before + (stringify ? stringify : String)(wrapped) + after, "around");
	}
	/*
		The mode-switcher function, which changes the displayed panel in the toolbar.
	*/
	const disabledButtonCSS = 'background:hsl(0,0%,50%,0.5);opacity:0.5;pointer-events:none';
	function switchPanel(name = 'default') {
		const {height} = getComputedStyle(toolbarElem);
		/*
			Uncheck all checkboxes, return all <select>s to default, and clear all textareas.
		*/
		Object.values(panels).forEach(panel => {
			panel[$$]('[type=radio],[type=checkbox]').forEach(node => node.checked = node.value === 'none');
			panel[$$]('[type=text],select').forEach(node => node.value = '');
			panel.onreset();
		});
		toolbarElem[$$]('.harlowe-3-toolbarPanel').forEach(node => node.remove());
		/*
			Touch the maxHeight of the incoming panel, using the computed height of the current panel, to
			animate its height as it enters.
		*/
		panels[name].style.maxHeight=height;
		toolbarElem.append(panels[name]);
		/*
			For prefilled "use selection" input elements, pre-fill with the selected text now.
		*/
		toolbarElem[$$]('[data-use-selection]').forEach(node => node.value = cm.doc.getSelection());
		// Sadly, I think using this setTimeout is necessary to get it to work.
		// "70vh" is the absolute maximum height for these panels.
		setTimeout(() => panels[name].style.maxHeight="70vh", 100);
	}

	/*
		A key between Harlowe transition names and their corresponding CSS animation names.
	*/
	const t8nPreviewAnims = {
		default:     rev => rev ? "appear step-end" : "appear",
		dissolve:    () => "appear",
		shudder:     () => "shudder-in",
		rumble:      () => "rumble-in",
		zoom:        () => "zoom-in",
		"slide-left":  rev => rev ? "slide-right" : "slide-left",
		"slide-right": rev => rev ? "slide-left" : "slide-right",
		"slide-up":    rev => rev ? "slide-down" : "slide-up",
		"slide-down":  rev => rev ? "slide-up" : "slide-down",
		flicker:     () => "flicker",
		pulse:       () => "pulse",
		instant:     rev => "appear step-" + (rev ? "end" : "start"),
	};

	const builtinColorNames = {
		"#e61919": "red",
		"#e68019": "orange",
		"#e5e619": "yellow",
		"#80e619": "lime",
		"#19e619": "green",
		"#19e5e6": "cyan",
		"#197fe6": "blue",
		"#1919e6": "navy",
		"#7f19e6": "purple",
		"#e619e5": "magenta",
		"#ffffff": "white",
		"#000000": "black",
		"#888888": "grey",
	};

	function reduceHTMLColour(colour) {
		colour = colour.toLowerCase();
		return colour in builtinColorNames
			? builtinColorNames[colour]
			: (colour[1] === colour[2] && colour[3] === colour[4] && colour[5] === colour[6]) ? "#" + colour[1] + colour[3] + colour[5] : colour;
	}

	/*
		The constructor for the folddownPanels. This accepts a number of panel rows (as an array of row-describing objects)
		and returns a <div> with the compiled UI elements.

		Each row object typically has the following:
		- update: A function taking the entire panel element, and performing actions whenever this element's value is altered.
		- name: User-facing display name of this element.
		- type: Which type of UI element to create for it.
	*/
	const folddownPanel = (...panelRows) => {
		/*
			The MVC-style flow of element states into data, and back, is crudely performed here.
			Elements can register "model" and "updater" functions. Model functions take a model object
			(seen in the reduce() call below) and permute it with the element's data. Update functions
			take the completed model object and permutes the element using it.
			Generally, each element has an addEventListener call in its implementation (below) which
			causes them to call update() whenever they're interacted with.
		*/
		const modelFns = [], updaterFns = [];
		function output() {
			return Object.entries(this.changers).map(([k,v]) => `(${k}:${v.join(',')})`).join('+');
		}
		function changerNamed(name) {
			return this.changers[name] || (this.changers[name] = []);
		}
		const model = (initiator) => modelFns.reduce((m, fn) => fn(m) || m, {
			changers: {},
			wrapStart: '[', wrapEnd: ']',
			wrapStringify: false,
			innerText: undefined,
			valid: false,
			output,
			changerNamed,
			initiator,
		});
		function update({target} = {}) {
			const m = model(target);
			updaterFns.forEach(fn => fn(m));
		}
		/*
			Since this is defined after update(), storing update() on it later should not cause a circular reference.
		*/
		const panelElem = el('<div class="harlowe-3-toolbarPanel" style="transition:max-height 0.8s;overflow-y:auto">');

		/*
			Turn each panel row description into a panel element. Notice that this reducer function
			can be recursively called, with a different element in accumulator position; this is
			used by radiorows to add its sub-elements.
		*/
		const ret = panelRows.reduce(function reducer(panelElem, row) {
			let ret, inline, type = '';
			const nested = (panelElem.tagName.toLowerCase() === "label");
			if (Object.getPrototypeOf(row) !== Object.prototype) {
				ret = row;
			}
			else {
				({type} = row);
				inline = type.startsWith('inline');
			}
			/*
				These are non-interactive messages.
			*/
			if (type.endsWith("text")) {
				ret = el('<' + (inline ? 'span' : 'div') + '>' + row.text + '</' + (inline ? 'span' : 'div') + '>');
			}
			if (type === "notice") {
				ret = el('<small style="display:block">' + row.text + '</small>');
			}
			/*
				Used only for the default panel.
			*/
			if (type === "buttons") {
				panelElem.append(...row.buttons.map(button => {
					if ('tagName' in button) {
						return button;
					}
					const elem = el('<button title="' + button.title + '" class="harlowe-3-toolbarButton">' + button.html + "</button>"
					);
					button.onClick && elem.addEventListener('click', button.onClick);
					return elem;
				}));
			}
			/*
				The (text-style:) preview panel.
			*/
			if (type.endsWith("preview")) {
				ret = el(`<div class="harlowe-3-stylePreview" style="${type.startsWith('t8n') ? 'cursor:pointer;height: 2.6rem;' : ''}" ${
					type.startsWith('t8n') ? `alt="Click to preview the transition"` : ""}><span>${row.text}</span>${type.startsWith('t8n') ? "<span>" + row.text2 + "</span>" : ''}</div>`);

				if (type.startsWith('t8n')) {
					ret.addEventListener('mouseup', update);
					const firstSpan = ret[$](':first-child');
					firstSpan.addEventListener('animationend', () => firstSpan.style.visibility = "hidden");
				}
			}
			/*
				Checkboxes and radio buttons.
			*/
			if (type === "checkbox") {
				ret = el('<label style="display:block;"><input type="checkbox"></input>' + row.text + '</label>');
				ret.addEventListener('change', update);
			}
			if (type === "checkboxes") {
				ret = el(`<div class="harlowe-3-toolbarCheckboxRow"><div><b>${row.name}</b></div></div>`);
				row.options.forEach(box => {
					const e = el('<label><input type="checkbox"></input>' + box + '</label>');
					e.addEventListener('change', update);
					ret.append(e);
				});
			}
			if (type === "radios") {
				ret = el(`<div class="harlowe-3-toolbarCheckboxRow"><div><b>${row.name}</b></div></div>`);
				row.options.forEach((radio,i) => {
					const e = el(`<label><input type="radio" name="${row.name}" value="${radio}" ${!i ? 'checked' : ''}></input>${radio}</label>`);
					e.addEventListener('change', update);
					ret.append(e);
				});
			}
			/*
				Text areas, single lines in which text can be entered.
			*/
			if (type.endsWith("textarea")) {
				ret = el('<' + (inline ? 'span' : 'div') + ' class="harlowe-3-labeledInput">'
					+ row.text
					+ '<input ' + (row.useSelection ? 'data-use-selection' : '') + (type.includes('passage') ? 'list="harlowe-3-passages"' : '') + ' style="width:'
						+ (row.width) + ';margin' + (inline ? ':0 0.5rem' : '-left:1rem') + ';" type=text placeholder="' + row.placeholder
					+ '"></input></' + (inline ? 'span' : 'div') + '>');
				ret[$]('input').addEventListener('input', update);
			}
			if (type.endsWith("number")) {
				ret = el('<' + (inline ? 'span' : 'div') + ' class="harlowe-3-labeledInput">'
					+ row.text
					+ '<input style="" type=number'
					+ ' min=' + row.min + ' max=' + row.max + ' value=' + row.value + (row.step ? ' step=' + row.step : '') + '></input></' + (inline ? 'span' : 'div') + '>');
				ret[$]('input').addEventListener('change', update);
			}
			if (type.endsWith("colour")) {
				ret = el('<' + (inline ? 'span' : 'div') + ' class="harlowe-3-labeledInput">'
					+ row.text
					+ '<input style="width:64px" type=color value="' + row.value
					+ '"></input><span class=harlowe-3-builtinSwatch>'
					+ Object.keys(builtinColorNames).map(builtIn =>
						'<span style="background-color:' + builtIn + '"></span>'
					).join('')
					+ '</span></' + (inline ? 'span' : 'div') + '>');
				ret[$]('.harlowe-3-builtinSwatch').addEventListener('click', ({target}) => {
					ret[$]('input').value = target.getAttribute('style').slice(-7);
					update();
				});
				ret[$]('input').addEventListener('change', update);
			}
			/*
				Dropdowns.
			*/
			if (type.endsWith("dropdown")) {
				const dropdownDiv = el('<' + (inline ? 'span' : 'div') + ' style="' + (inline ? '' : 'width:50%;') + 'position:relative;">'
					+ row.text
					+ '<select style="' + (inline ? 'margin:0.5rem;' : 'margin-left:1rem;') + 'font-size:1rem;margin-top:4px"></select></' + (inline ? 'span' : 'div') + '>');
				row.options.forEach((option,i) => {
					dropdownDiv.lastChild.append(el('<option value="' + (!i ? '' : option) + '"' + (!option ? ' disabled' : !i ? ' selected' : '') + '>' + (option || '───────') + '</select>'));
				});
				dropdownDiv[$]('select').addEventListener('change', update);
				ret = dropdownDiv;
			}
			/*
				Rows of options, selected using radio buttons.
			*/
			if (type === "radiorows") {
				ret = el(`<div>`);
				row.options.forEach((subrows,i) => {
					const subrowEl = el(`<label class='harlowe-3-radioRow'><input type="radio" name="${row.name}" value="${!i ? 'none' : i}" ${!i ? 'checked' : ''}></input></label>`);
					/*
						Wrap each of the subrows' model functions, so that they only fire whenever this row is actually selected.
					*/
					subrows.forEach(subrow => {
						const {model} = subrow;
						if (model) {
							subrow.model = (m, el) => {
								return subrowEl[$]('input:checked')
								/*
									Don't run the subrow's model unless the parent row's radio button is checked.
								*/
								&& (!nested || panelElem[$](':scope > input:checked')) ? model(m, el) : m;
							};
						}
					});
					/*
						Place each of these sub-options within the <label>.
					*/
					ret.append(subrows.reduce(reducer, subrowEl));
					subrowEl[$]('input').addEventListener('change', update);
				});
			}
			/*
				The "Create" and "Cancel" buttons.
			*/
			if (type === "confirm") {
				const buttons = el('<p class="buttons" style="padding-bottom:8px;"></p>');
				const resultingCode = el(`<span class="harlowe-3-resultCode">Resulting code: <code></code> <code></code></span>`);
				const cancel = el('<button><i class="fa fa-times"></i> Cancel</button>');
				const confirm = el('<button class="create"><i class="fa fa-check"></i>Add</button>');
				confirm.setAttribute('style', disabledButtonCSS);
				updaterFns.push(m => {
					const setAttr = !m.valid ? 'setAttribute' : 'removeAttribute';
					confirm[setAttr]('style', disabledButtonCSS);
					resultingCode[setAttr]('hidden','');
					if (m.valid) {
						resultingCode[$]('code:first-of-type').textContent = m.output() + m.wrapStart;
						resultingCode[$]('code:last-of-type').textContent = m.wrapEnd;
					}
				});
				
				cancel.addEventListener('click', () => switchPanel());
				confirm.addEventListener('click', () => {
					const m = model();
					wrapSelection(m.output() + m.wrapStart, m.wrapEnd, m.innerText, m.wrapStringify);
					switchPanel();
				});
				buttons.append(resultingCode,cancel,confirm);
				ret = buttons;
			}
			if (nested) {
				const u = row.update;
				row.update = (m, el) => {
					const checked = panelElem[$](':scope > input:checked');
					Array.from(panelElem[$$]('div,br ~ *')).forEach(e => e[(checked ? "remove" : "set") + "Attribute"]("hidden",''));
					Array.from(panelElem[$$]('input,select')).slice(1).forEach(e => e[(checked ? "remove" : "set") + "Attribute"]("disabled",''));
					u && u(m, el);
				};
			}

			/*
				The "model" and "update" functions are attached by default if they exist.
			*/
			row.model && modelFns.push(m => row.model(m, ret));
			row.update && updaterFns.push(m => row.update(m, ret));
			/*
				Append and return the panel element.
			*/
			ret && panelElem.append(ret);
			/*
				This is something of a hack... by stashing the update() function on the element in this otherwise unused handler spot,
				it can be called whenever panels are switched.
			*/
			panelElem.onreset = update;
			return panelElem;
		},
		panelElem);

		panelRows = null;
		return ret;
	};

	/*
		The Toolbar element consists of a single <div> in which a one of a set of precomputed panel <div>s are inserted. There's a "default"
		panel, plus other panels for specific markup wizards.
	*/
	panels = {
		/*
			The (text-style:) button's panel. This simply consists of several radio buttons and checkboxes that configure a (text-style:) changer.
		*/
		textstyle: (()=>{

				/*
					This big block of styles needs to be kept in sync with (text-style:)'s implementation.
				*/
				const previewStyles = {
					bold:                  "font-weight:bold",
					italic:                "font-style:italic",
					underline:             "text-decoration: underline",
					"double-underline":    "text-decoration: underline;text-decoration-style:double",
					"wavy-underline":      "text-decoration: underline;text-decoration-style:wavy",
					strike:                "text-decoration: line-through",
					"double-strike":       "text-decoration: line-through;text-decoration-style:double",
					"wavy-strike":         "text-decoration: line-through;text-decoration-style:wavy",
					superscript:           "vertical-align:super;font-size:.83em",
					subscript:             "vertical-align:sub;font-size:.83em",
					mark:                  "background-color: hsla(60, 100%, 50%, 0.6)",
					outline:               "color:black; text-shadow: -1px -1px 0 white, 1px -1px 0 white, -1px  1px 0 white, 1px  1px 0 white",
					shadow:                "text-shadow: 0.08em 0.08em 0.08em white",
					emboss:                "text-shadow: 0.08em 0.08em 0em white",
					condense:              "letter-spacing:-0.08em",
					expand:                "letter-spacing:0.1em",
					blur:                  "text-shadow: 0em 0em 0.08em white; color:transparent",
					blurrier:              "text-shadow: 0em 0em 0.2em white; color:transparent",
					smear:                 "text-shadow: 0em 0em 0.02em white, -0.2em 0em 0.5em white, 0.2em 0em 0.5em white; color:transparent",
					mirror:                "display:inline-block;transform:scaleX(-1)",
					"upside-down":         "display:inline-block;transform:scaleY(-1)",
					blink:                 "animation:fade-in-out 1s steps(1,end) infinite alternate",
					"fade-in-out":         "animation:fade-in-out 2s ease-in-out infinite alternate",
					rumble:                "display:inline-block;animation:rumble linear 0.1s 0s infinite",
					shudder:               "display:inline-block;animation:shudder linear 0.1s 0s infinite",
					sway:                  "display:inline-block;animation:sway 5s linear 0s infinite",
					buoy:                  "display:inline-block;animation:buoy 5s linear 0s infinite",
					fidget:                "display:inline-block;animation:fidget 60s linear 0s infinite",
				};

				function model(m, elem) {
					const styles = Array.from(elem[$$]('[type=radio]:checked')).map(node => node.value).filter(e => e !== "none")
						.concat(Array.from(elem[$$]('[type=checkbox]:checked')).map(node => node.parentNode.textContent));
					m.changerNamed('text-style').push(...styles.map(stringify));
					m.valid = m.valid || styles.length > 0;
				}

				return folddownPanel({
					type: 'text',
					text: 'You may select any number of styles.',
				},{
					type: 'preview',
					text: 'Example text preview',
					update(model, panel) {
						panel.firstChild.setAttribute('style', model.changers['text-style'].map(name => previewStyles[parse(name)]).join(';') + ";position:relative;");
					},
				},{
					type: 'small',
					text: "This preview doesn't account for other modifications to this passage's text colour, font, or background, and is meant only for you to examine each of these styles.",
				},{
					type: 'checkboxes',
					name: 'Font variants',
					options: ["bold","italic","mark"],
					model,
				},{
					type: 'radios',
					name: 'Underlines and strikes',
					options: ["none", "underline","double-underline","wavy-underline","strike","double-strike","wavy-strike"],
					model,
				},{
					type: 'radios',
					name: 'Superscript and subscript',
					options: ["none", "superscript", "subscript"],
					model,
				},{
					type: 'radios',
					name: 'Outlines',
					options: ["none", "outline","shadow","emboss","blur","blurrier","smear"],
					model,
				},{
					type: 'radios',
					name: 'Letter spacing',
					options: ["none", "condense","expand"],
					model,
				},{
					type: 'radios',
					name: 'Flips',
					options: ["none", "mirror","upside-down"],
					model,
				},{
					type: 'radios',
					name: 'Animations',
					options: ["none", "blink", "fade-in-out","rumble","shudder","sway","buoy","fidget"],
					model,
				},{
					type: 'checkbox',
					text: 'Affect the entire remainder of the passage',
					model(m, elem) {
						if (elem[$](':checked')) {
							m.wrapStart = "[==\n";
							m.wrapEnd = "";
						}
					},
				},{
					type: 'confirm',
				});
			})(),
		borders: (() => {
				function dropdownControls(orientation) {
					return [
						el(`<div><b>${orientation}</b></div>`),
						{
							type: 'inline-dropdown',
							text: 'Style:',
							options: ['none', '', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'],
							model(m, el) {
								m.changerNamed('b4r').push(stringify(el[$]('select').value || "none"));
							},
						},{
							type: 'inline-number',
							text: 'Size:',
							value: 1,
							min: 0.1,
							max: 20,
							step: 0.1,
							model(m, el) {
								m.changerNamed('b4r-size').push(el[$]('input').value);
							},
						},{
							type: 'inline-colour',
							text: 'Colour:',
							value: "#ffffff",
							model(m, el) {
								m.changerNamed('b4r-colour').push(el[$]('input').value);
							}
						}
					];
				}

				/*
					Reduces a 4-value array of CSS properties as far as possible.
				*/
				function reduce4ValueProp(arr) {
					if (arr.length === 4 && arr[3] === arr[1]) {
						arr.pop();
					}
					if (arr.length === 3 && arr[2] === arr[0]) {
						arr.pop();
					}
					if (arr.length === 2 && arr[1] === arr[0]) {
						arr.pop();
					}
					return arr;
				}

				return folddownPanel({
						type: 'preview',
						text: 'Example border preview',
						update(m, panel) {
							panel.firstChild.setAttribute('style', `border-style:${
								m.changers.b4r ? m.changers.b4r.map(parse).join(' ') + ";" : ''
							}${
								/*
									Border-size is a multiplier on the default Harlowe border (2px).
								*/
								m.changers['b4r-size'] ? 'border-width:' + m.changers['b4r-size'].reduce((a,e) => `${a} ${e*2}px`,'') + ";" : ''
							}${
								m.changers['b4r-colour'] ? 'border-color:' + m.changers['b4r-colour'].join(' ') + ";" : ''
							}`);
						},
					},
					...dropdownControls("Top"), ...dropdownControls("Right"), ...dropdownControls("Bottom"), ...dropdownControls("Left"),
					{
						type: 'confirm',
						model(m) {
							m.valid = true;
							/*
								Quickly check that each of the to-be-constructed changers' values differ from the default,
								and don't create them if not.
							*/
							[['b4r', e => parse(e) === "none"], ['b4r-size', e => +e === 1], ['b4r-colour', e => e.toLowerCase() === "#ffffff"]].forEach(([name, test]) => {
								m.changers[name] = reduce4ValueProp(m.changers[name]);
								if (name === 'b4r-colour') {
									m.changers[name] = m.changers[name].map(reduceHTMLColour);
								}
								if (m.changers[name].every(test)) {
									delete m.changers[name];
									if (name === 'b4r') {
										m.valid = false;
									}
								}
							});
						},
					}
				);
			})(),
		textcolor: folddownPanel({
				type: 'text',
				text: 'Select colours for this text.',
			},{
				type: 'preview',
				text: 'Example text preview',
			},{
				type: 'small',
				text: "This preview doesn't account for other modifications to this passage's text colour, font, or background, and is meant only for you to examine each of these styles.",
			},{
				type:'confirm',
			}),
		/*
			The [[Link]] button's panel. This configures the link syntax, plus a (t8n-depart:) and/or (t8n-arrive:) macro to attach to it.
		*/
		passagelink: (() => {
				const passageT8nPreviews = () => [el('<br>'),{
					type: 'inline-dropdown',
					text: 'Departing passage transition: ',
					options: ["default", "", "instant", "dissolve", "rumble", "shudder", "pulse", "zoom", "flicker", "slide-left", "slide-right", "slide-up", "slide-down"],
					model(m, el) {
						const {value} = el[$]('select');
						if (value !== "") {
							m.changerNamed('t8n-depart').push(stringify(value));
						}
					},
				},{
					type: 'inline-dropdown',
					text: 'Arriving passage transition: ',
					options: ["default", "", "instant", "dissolve", "rumble", "shudder", "pulse", "zoom", "flicker", "slide-left", "slide-right", "slide-up", "slide-down"],
					model(m, el) {
						const {value} = el[$]('select');
						if (value !== "") {
							m.changerNamed('t8n-arrive').push(stringify(value));
						}
					},
				},{
					type: "inline-number",
					text: "Transition time (sec): ",
					value: 0.8,
					min: 0,
					max: 999,
					step: 0.1,
					model(m, elem) {
						const value = elem[$]('input').value;
						/*
							This uses the hardcoded default time value.
						*/
						if (+value !== 0.8) {
							m.changerNamed('t8n-time').push(value + 's');
						}
					},
				},{
					type: 't8n-preview',
					text: "Departing Text",
					text2: "Arriving Text",
					update(m, el) {
						if (m.initiator && !["select","div","span"].some(e => e === m.initiator.tagName.toLowerCase())) {
							return;
						}
						const t8nName1 = t8nPreviewAnims[m.changers['t8n-depart'] ? parse(m.changers['t8n-depart'][0]) : "default"](true);
						const t8nName2 = t8nPreviewAnims[m.changers['t8n-arrive'] ? parse(m.changers['t8n-arrive'][0]) : "default"](false);
						const t8nTime = m.changers['t8n-time'] ? m.changers['t8n-time'][0] : "0.8s";
						
						const span1 = el.firstChild;
						const span2 = el.lastChild;
						span1.setAttribute('style', `animation:${t8nName1} reverse ${t8nTime} 1;`);
						span2.setAttribute('style', `animation:${t8nName2} ${t8nTime} 1;`);
						/*
							Flicker the <span>s to trigger a restart of the animation.
						*/
						span1.remove();
						span2.remove();
						setTimeout(() => el.append(span1, span2));
					},
				}];

				return folddownPanel({
					type: 'textarea',
					text: "Create a hyperlink, with this text:",
					placeholder: "Link text",
					useSelection: true,
					width: "60%",
					model(m, elem) {
						const text = elem[$]('input').value;
						if (text.length > 0) {
							m.linkText = text;
							m.valid = true;
						}
					},
				},{
					type: "text",
					text: "When it is clicked, perform this action:",
				},{
					type: 'radiorows',
					name: 'passagelink',
					options: [
						[{
							type: 'inline-passage-textarea',
							text: 'Go to this passage:',
							width: "70%",
							placeholder: "Passage name",
							model(m, elem) {
								const name = elem[$]('input').value;
								if (!name.length) {
									m.valid = false;
								}
								else if (!["]]", "->", "<-"].some(str => name.includes(str) || (m.linkText && m.linkText.includes(str)))) {
									m.wrapStart = "[[" + m.linkText;
									m.wrapEnd = "->" + name + "]]";
								}
								else {
									m.wrapStart = "(link-goto:" + stringify(m.linkText) + ",";
									m.wrapEnd = stringify(name) + ")";
								}
								m.innerText = '';
							}
						}, ...passageT8nPreviews()],
						[{
							type: 'inline-text',
							text: "Undo the current turn, returning to the previous passage.",
							model(m) {
								m.changerNamed('link-undo').push(stringify(m.linkText));
								m.wrapStart = "";
								m.wrapEnd = "";
							},
						}, ...passageT8nPreviews()],
						[{
							type: 'inline-dropdown',
							text: 'Reveal ',
							options: ["an attached hook", "the remainder of the passage"],
							model(m, elem) {
								if (elem[$]('select').value) {
									m.wrapStart = "[==\n";
									m.wrapEnd = "";
								}
							}
						},{
							type: "text",
							text: '(A hook is a section of passage code enclosed in <code>[</code> or <code>]</code>, or preceded with <code>[==</code>, which can have macros attached to the front.)',
						},{
							type: 'radiorows',
							name: 'linkReveal',
							options: [
								[{
									type: "inline-text",
									text: "Then remove the link's own text.",
									model(m){ m.changerNamed('link').push(stringify(m.linkText)); },
								}],
								[{
									type: "inline-text",
									text: "Then unlink the link's own text.",
									model(m){ m.changerNamed('link-reveal').push(stringify(m.linkText)); },
								}],
								[{
									type: "inline-text",
									text: "Re-run the hook each time the link is clicked.",
									model(m){ m.changerNamed('link-rerun').push(stringify(m.linkText)); },
								}],
								[{
									type: "inline-text",
									text: "Repeat the hook each time the link is clicked.",
									model(m){ m.changerNamed('link-repeat').push(stringify(m.linkText)); },
								}],
							],
						}],
					],
				},{
					type: 'confirm',
				});
			})(),
		if: folddownPanel({
				type: 'text',
				text: 'Only show a section of the passage if this condition is met:',
			},{
				type: 'radiorows',
				name: 'if',
				options: [
					[
						/*
							The player visited this passage [exactly] [1] times.
						*/
						{
							type: 'inline-dropdown',
							text: 'The player visited this passage',
							options: ["exactly", "at most", "at least", "anything but", "a multiple of"],
							model(m, elem) {
								m.changerNamed('if').push("visits" + {
									"": " is ",
									"at most": " <= ",
									"at least": " >= ",
									"anything but": " is not ",
									"a multiple of": " % ",
								}[elem[$]('select').value]);
							},
						},{
							type: "inline-number",
							text: "",
							value: 0,
							min: 0,
							max: 999,
							model(m, elem) {
								const ifArgs = m.changerNamed('if');
								ifArgs[0] += elem[$]('input').value;
								if (ifArgs[0].includes(' % ')) {
									ifArgs[0] += " is 0";
								}
								m.valid = true;
							},
						},
						new Text(" times."),
					],[
						/*
							It's an [even] numbered visit.
						*/
						{
							type: 'inline-dropdown',
							text: 'The player has now visited this passage an',
							options: ["even", "odd"],
							model(m, elem) {
								m.changerNamed('if').push({
									"": "visits is an even",
									odd: "visits is an odd",
								}[elem[$]('select').value]);
								m.valid = true;
							},
						},
						new Text(" number of times."),
					],[
						/*
							[1] seconds have passed since this passage was entered.
						*/
						{
							type: "inline-number",
							text: "",
							value: 2,
							min: 1,
							max: 999,
							model(m, elem) {
								m.changerNamed('event').push(`when time >= ${elem[$]('input').value}s`);
								m.valid = true;
							},
						},
						new Text(" seconds have passed since this passage was entered."),
					],[
						/*
							This passage [___] was visited [exactly] [2] times.
						*/
						{
							type: "inline-textarea",
							width:"30%",
							text: "The passage ",
							placeholder: "Passage name",
							model(m, elem) {
								const v = elem[$]('input').value;
								if (v) {
									m.changerNamed('if').push("(history: where it is " + stringify(v) + ")'s length");
									m.valid = true;
								}
							},
						},{
							type: 'inline-dropdown',
							text: 'was visited ',
							options: ["exactly", "at most", "at least", "anything but", "a multiple of"],
							model(m, elem) {
								m.changerNamed('if')[0] += {
									"": " is ",
									"at most": " <= ",
									"at least": " >= ",
									"anything but": " is not ",
									"a multiple of": " % ",
								}[elem[$]('select').value];
							},
						},{
							type: "inline-number",
							text: "",
							value: 1,
							min: 1,
							max: 999,
							model(m, elem) {
								const ifArgs = m.changerNamed('if');
								ifArgs[0] += elem[$]('input').value;
								if (ifArgs[0].includes(' % ')) {
									ifArgs[0] += " is 0";
								}
							},
						},
						new Text(" times."),
					],[
						/*
							Passages with the tag [___] were visited [exactly] [2] times.
						*/
						{
							type: "inline-textarea",
							width:"20%",
							text: "Passages with the tag ",
							placeholder: "Tag name",
							model(m, elem) {
								const v = elem[$]('input').value;
								if (v) {
									m.changerNamed('if').push("(history: where (passage:it)'s tags contains " + stringify(v) + ")'s length");
									m.valid = true;
								}
							},
						},{
							type: 'inline-dropdown',
							text: 'were visited ',
							options: ["exactly", "at most", "at least", "anything but", "a multiple of"],
							model(m, elem) {
								const v = elem[$]('select').value;
								m.changerNamed('if')[0] += {
									"": " is ",
									"at most": " <= ",
									"at least": " >= ",
									"anything but": " is not ",
									"a multiple of": " % ",
								}[v];
							},
						},{
							type: "inline-number",
							text: "",
							value: 1,
							min: 1,
							max: 999,
							model(m, elem) {
								const ifArgs = m.changerNamed('if');
								ifArgs[0] += elem[$]('input').value;
								if (ifArgs[0].includes(' % ')) {
									ifArgs[0] += " is 0";
								}
							},
						},
						new Text(" times."),
					],[
						/*
							There are no more interactable elements in the passage.
						*/
						{
							type: "inline-text",
							text: "There are no more interactable elements in the passage.",
							model(m) {
								m.changerNamed('more');
								m.valid = true;
							},
						},
						{
							type: "text",
							text: "Interactable elements are link, mouseover, or mouseout areas. If you're using links that reveal "
							+ "additional lines of prose and then remove or unlink themselves, this will reveal the attached text when all of those are gone.",
						},
					]
				],
			},{
				type: 'checkbox',
				text: `Also, only if the previous (if:) or (unless:) hook's condition wasn't fulfilled.`,
				model(m, elem) {
					if (elem[$](':checked')) {
						if ("if" in m.changers) {
							m.changerNamed('else-if').push(...m.changerNamed('if'));
							delete m.changers.if;
						} else {
							m.changerNamed('else');
						}
					}
				},
			},{
				type: 'checkbox',
				text: 'Affect the entire remainder of the passage',
				model(m, elem) {
					if (elem[$](':checked')) {
						m.wrapStart = "[==\n";
						m.wrapEnd = "";
					}
				},
			},{
				type: 'confirm',
			}),
		default: folddownPanel({
				type: 'notice',
				text: 'The current story format is <b>Harlowe 3.2.0</b>. Consult its <a href="https://twine2.neocities.org/" target="_blank" rel="noopener noreferrer">documentation</a>.'
			},{
				type: 'buttons',
				buttons: [
					{ title:'Bold',                    html:'<i class="fa fa-bold">',         onClick: () => wrapSelection("''","''")},
					{ title:'Italic',                  html:'<i class="fa fa-italic">',       onClick: () => wrapSelection("//","//")},
					{ title:'Strikethrough',           html:'<i class="fa fa-strikethrough">',onClick: () => wrapSelection("~~","~~")},
					{ title:'Superscript',             html:'<i class="fa fa-superscript">',  onClick: () => wrapSelection("^^","^^")},
					{ title:'Text and background colour', html:`<i class='fa fa-adjust fa-palette'>`, onClick: () => switchPanel('textcolor')},
					{
						title:'Borders',
						html:'<span style="display:inline-block; height:16px; width:16px; border-style: dotted solid solid dotted; border-size:3px;"></span>',
						onClick: () => switchPanel('borders'),
					},
					{ title:'Special text style',      html:'Styles…',                            onClick: () => switchPanel('textstyle')},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Heading',                 html:'<i class="fa fa-header">',           onClick: () => wrapSelection("\n#","")},
					{ title:'Bulleted list item',      html:'<i class="fa fa-list-ul">',          onClick: () => wrapSelection("\n* ","")},
					{ title:'Numbered list item',      html:'<i class="fa fa-list-ol">',          onClick: () => wrapSelection("\n0. ","")},
					{ title:'Horizontal rule',         html:'<b>—</b>',                           onClick: () => wrapSelection("\n---\n","")},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Collapse whitespace',     html:'<b>{}</b>',                          onClick: () => wrapSelection("{","}")},
					{
						title:'Verbatim (ignore all markup)',
						html:'Vb',
						onClick() {
							const selection = cm.doc.getSelection();
							const consecutiveGraves = (selection.match(/`+/g) || []).reduce((a,e) => Math.max(e.length, a), 0);
							wrapSelection("`".repeat(consecutiveGraves+1), "`".repeat(consecutiveGraves+1));
						},
					},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Passage link',            html:'Link…',                          onClick: () => switchPanel('passagelink')},
					{
						title: 'Only show a portion of text if a condition is met',
						html:'If…',
						onClick: () => switchPanel('if')
					},
				],
			}
		),
	};
	/*
		Switch to the default panel at startup.
	*/
	switchPanel();

	function Toolbar(cmObj) {
		const passageTagsElem = document[$]('.editor .passageTags');
		if (passageTagsElem) {
			passageTagsElem.after(toolbarElem);
		}
		cm = cmObj;
	}

	// This can only be loaded in TwineJS, not any other place.
	if (this && this.loaded) {
		this.modules || (this.modules = {});
		this.modules.Toolbar = Toolbar;
	}
}.call(eval('this')));
