/*jshint strict:true*/
(function() {
	'use strict';
	/*
		The Harlowe Toolbar fits above the CodeMirror panel and provides a number of convenience buttons, in the style of forum post editors,
		to ease the new user into the format's language.
	*/
	const toolbarElem = el('<div class="harloweToolbar">');
	let panels;
	let cm;
	/*
		These are a couple of convenience routines.
	*/
	const $ = 'querySelectorAll';
	function el(html) {
		const elem = document.createElement('p');
		elem.innerHTML = html;
		return elem.firstChild;
	}
	/*
		All output from the buttons and wizards is from this function, which places Harlowe code into the passage around the selection.
	*/
	function wrapSelection(before,after,defaultText='Your Text Here') {
		if (!cm) {
			return;
		}
		const selectedText = cm.doc.getSelection();
		cm.doc.replaceSelection(before + (selectedText || defaultText) + after, "around");
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
			panel[$]('[type=radio],[type=checkbox]').forEach(node => node.checked = node.value === 'none');
			panel[$]('[type=text],select').forEach(node => node.value = '');
			panel[$]('button.create').forEach(node => node.setAttribute('style', disabledButtonCSS));
		});
		toolbarElem[$]('.harloweToolbarPanel').forEach(node => node.remove());
		/*
			Touch the maxHeight of the incoming panel, using the computed height of the current panel, to
			animate its height as it enters.
		*/
		panels[name].style.maxHeight=height;
		toolbarElem.append(panels[name]);
		// Sadly, I think using this setTimeout is necessary to get it to work.
		// "70vh" is the absolute maximum height for these panels.
		setTimeout(() => panels[name].style.maxHeight="70vh", 100);
	}

	/*
		A key between Harlowe transition names and their corresponding CSS animation names.
	*/
	const t8nPreviewAnims = {
		default:     rev => rev ? "none" : "appear",
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
	};

	/*
		The constructor for the folddownPanels. This accepts a number of panel rows (as an array of row-describing objects)
		and returns a <div> with the compiled UI elements.

		Each row object typically has the following:
		- update: A function taking the entire panel element, and performing actions whenever this element's value is altered.
		- name: User-facing display name of this element.
		- type: Which type of UI element to create for it.
	*/
	const folddownPanel = (...panelRows) => {
		const panelElem = el('<div class="harloweToolbarPanel" style="transition:max-height 0.8s;overflow-y:auto"></div>');
		/*
			The MVC-style flow of element states into data, and back, is crudely performed here.
			Elements can register "model" and "updater" functions. Model functions take a model object
			(seen in the reduce() call below) and permute it with the element's data. Update functions
			take the completed model object and permutes the element using it.
			Generally, each element has an addEventListener call in its implementation (below) which
			causes them to call update() whenever they're interacted with.
		*/
		const modelFns = [], updaterFns = [];
		const model = () => modelFns.reduce((m, fn) => fn(m), {
			changers: {},
			wrapStart: '[', wrapEnd: ']',
			valid: false,
			changerNamed(name) {
				return this.changers[name] || (this.changers[name] = []);
			},
		});
		function update() {
			const m = model();
			updaterFns.forEach(fn => fn(m));
		}

		const previewCSS = "text-align:center;user-select:none;overflow:hidden;background:black;color:white;font-family:\'Georgia\',serif;padding:8px;font-size:1.5rem";

		/*
			Turn each panel row description into a panel element. Notice that this reducer function
			can be recursively called, with a different element in accumulator position; this is
			used by radiorows to add its sub-elements.
		*/
		return panelRows.reduce(function reducer(panelElem, row) {
			const {type} = row;
			/*
				These are non-interactive messages.
			*/
			let ret;
			if (type === "text") {
				ret = el('<p>' + row.text + '</p>');
			}
			if (type === "small") {
				ret = el('<small style="display:block">' + row.text + '</small>');
			}
			if (type === "inline-text") {
				ret = new Text(row.text);
			}
			/*
				Used only for the default panel.
			*/
			if (type === "buttons") {
				panelElem.append(...row.buttons.map(button => {
					if ('tagName' in button) {
						return button;
					}
					const elem = el('<button title="' + button.title + '" style="'
						+ "border-radius:0.5rem;"
						+ "border:1px solid hsl(0,0%,50%,0.5);"
						+ "margin:8px 4px;"
						+ "padding:0px 4px;"
						+ "height:40px;"
						+ (button.html.startsWith('<su') ? '' : 'font-size:120%;')
						+ 'min-width:32px;'
						+ '">' + button.html + "</button>"
					);
					button.onClick && elem.addEventListener('click', button.onClick);
					return elem;
				}));
			}
			/*
				The (text-style:) preview panel.
			*/
			if (type === "preview") {
				ret = el('<div class="harlowePreview" style="margin:8px auto;width:50%;' + previewCSS + '"><span>' + row.text + '</span></div>');
			}
			/*
				Checkboxes and radio buttons.
			*/
			if (type === "checkboxes") {
				ret = el(`<div style="border-bottom:1px solid hsl(0,0%,50%,0.5);position:relative;padding-bottom:8px;margin-bottom:8px"><div><b>${row.name}</b></div></div>`);
				row.options.forEach(box => {
					const e = el('<label style="min-width:20%;text-transform:capitalize;display:inline-block;"><input type="checkbox"></input>' + box + '</label>');
					e.addEventListener('change', update);
					ret.append(e);
				});
			}
			if (type === "radios") {
				ret = el(`<div style="border-bottom:1px solid hsl(0,0%,50%,0.5);position:relative;padding-bottom:8px;margin-bottom:8px"><div><b>${row.name}</b></div></div>`);
				row.options.forEach((radio,i) => {
					const e = el(`<label style="min-width:20%;text-transform:capitalize;display:inline-block;"><input type="radio" name="${row.name}" value="${radio}" ${!i ? 'checked' : ''}></input>${radio}</label>`);
					e.addEventListener('change', update);
					ret.append(e);
				});
			}
			/*
				Text areas, single lines in which text can be entered.
			*/
			if (type === "textarea") {
				ret = el('<div style="position:relative;padding-bottom:8px;">'
					+ row.text
					+ '<input style="width:50%;margin-left:1rem;display:inline-block;font-size:1rem" type=text placeholder="' + row.placeholder + '"></input></div>');
				ret.querySelector('input').addEventListener('input', update);
			}
			if (type === "inline-number") {
				ret = el('<span style="position:relative;padding-bottom:8px;">'
					+ row.text
					+ '<input style="box-shadow:0 1px 0 hsla(0,0%,50%,0.5);background:transparent;color:inherit;border:none;font-family:\'Source Code Pro\',monospace;width:4rem;margin-left:1rem;display:inline-block;font-size:1rem" type=number'
					+ ' min=' + row.min + ' max=' + row.max + ' value=' + row.value + '></input></span>');
				ret.querySelector('input').addEventListener('change', update);
			}
			/*
				Dropdowns.
			*/
			if (type.endsWith("dropdown")) {
				const inline = type.startsWith('inline');
				const dropdownDiv = el('<div style="display:inline-block;' + (inline ? '' : 'width:50%;') + 'position:relative;">'
					+ row.text
					+ '<select style="' + (inline ? 'margin:0 0.5rem' : 'margin-left:1rem;text-transform:capitalize;') + '"></select></div>');
				row.options.forEach((option,i) => {
					dropdownDiv.lastChild.append(el('<option value="' + (!i ? '' : option) + '"' + (!option ? ' disabled' : !i ? ' selected' : '') + '>' + (option || '───────') + '</select>'));
				});
				/*
					The special "transition" dropdowns come with a special previewer widget for the transitions.
				*/
				if (type.startsWith("t8n")) {
					const select = dropdownDiv.querySelector('select');
					const preview = el(`<div style="width:75%;margin:0 auto;cursor:pointer;${previewCSS}"><span>Sample</span></div>`);
					dropdownDiv.append(preview);
					const reversed = type.startsWith("t8n-out");

					modelFns.push(m => {
						if (select.value) {
							m.changerNamed('t8n-' + (reversed ? 'depart' : 'arrive')).push(select.value);
						}
						return m;
					});
					/*
						The transition preview is updated whenever the element is clicked, or the dropdown is changed. 
					*/
					updaterFns.push(() => {
						const t8n = select.value || "default";
						const span = preview.firstChild;
						if (t8n in t8nPreviewAnims) {
							/*
								Flicker the <span> to trigger a restart of the animation.
							*/
							span.setAttribute('style', `display:inline-block;animation:${t8nPreviewAnims[t8n](reversed)} ${reversed ? " reverse":''} 0.8s 1;`);
							span.remove();
							setTimeout(() => preview.appendChild(span));
						}
					});
					select.addEventListener('change', update);
					preview.addEventListener('mouseup', update);
				}
				ret = dropdownDiv;
			}
			/*
				Rows of options, selected using radio buttons.
			*/
			if (type === "radiorows") {
				ret = el(`<div>`);
				row.options.forEach((subrows,i) => {
					const e = el(`<label style="border-bottom:1px solid hsl(0,0%,50%,0.5);display:block;padding-bottom:8px;margin-bottom:8px;font-size:120%;">`
						+ `<input type="radio" name="${row.name}" value="${!i ? 'none' : i}" ${!i ? 'checked' : ''}></input></label>`);
					/*
						Place each of these sub-options within the <label>.
					*/
					ret.append(subrows.reduce(reducer, e));
				});
			}
			/*
				The "Create" and "Cancel" buttons.
			*/
			if (type === "confirm") {
				const buttons = el('<p class="buttons" style="padding:8px;"></p>');
				const cancel = el('<button><i class="fa fa-times"></i> Cancel</button>');
				const confirm = el('<button class="create"><i class="fa fa-check"></i>Add</button>');
				confirm.setAttribute('style', disabledButtonCSS);
				updaterFns.push(a => {
					confirm[!a.valid ? 'setAttribute' : 'removeAttribute']('style', disabledButtonCSS);
				});
				
				cancel.addEventListener('click', () => switchPanel());
				confirm.addEventListener('click', () => {
					const m = model();
					wrapSelection(Object.entries(m.changers).map(([k,v]) => `(${k}:${v.map(JSON.stringify).join(',')})`).join('+') + m.wrapStart, m.wrapEnd);
					switchPanel();
				});
				buttons.append(cancel,confirm);
				ret = buttons;
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
			return panelElem;
		},
		panelElem);
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
					const styles = Array.from(elem[$]('[type=radio]:checked')).map(node => node.value).filter(e => e !== "none")
						.concat(Array.from(elem[$]('[type=checkbox]:checked')).map(node => node.parentNode.textContent));
					m.changerNamed('text-style').push(...styles);
					m.valid = m.valid || styles.length > 0;
					return m;
				}

				return folddownPanel({
					type: 'text',
					text: 'You may select any number of styles.',
				},{
					type: 'preview',
					text: 'Example text sample',
					update(model, panel) {
						panel.firstChild.setAttribute('style', model.changers['text-style'].map(name => previewStyles[name]).join(';') + ";position:relative;");
					},
				},{
					type: 'small',
					text: "This sample doesn't account for other modifications to this passage's text colour, font, or background, and is meant only for you to examine each of these styles.",
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
				/*},{
					type: 'checkbox'
					text: 'Affect the entire remainder of the passage'*/
				},{
					type: 'confirm',
				});
			})(),
		/*
			The [[Link]] button's panel. This configures the link syntax, plus a (t8n-depart:) and/or (t8n-arrive:) macro to attach to it.
		*/
		passagelink: folddownPanel({
				type: 'textarea',
				text: 'Arriving passage name:',
				placeholder: "Passage name",
				model(m, elem) {
					const name = elem.querySelector('input').value;
					if (name.length > 0 && !name.includes("]]")) {
						m.valid = true;
						m.wrapStart = "[[" + name + "->";
						m.wrapEnd = "]]";
					}
					return m;
				},
			},{
				type: 't8n-out-dropdown',
				text: 'Departing passage transition:',
				options: ["default", "", "instant", "dissolve", "rumble", "shudder", "pulse", "zoom", "flicker", "slide-left", "slide-right", "slide-up", "slide-down"],
			},{
				type: 't8n-in-dropdown',
				text: 'Arriving passage transition:',
				options: ["default", "", "instant", "dissolve", "rumble", "shudder", "pulse", "zoom", "flicker", "slide-left", "slide-right", "slide-up", "slide-down"],
			},{
				type: 'confirm',
			}),
		if: folddownPanel({
				type: 'text',
				text: 'Only show a section of the passage if this condition is met:',
			},{
				type: 'radiorows',
				name: 'if',
				options: [
					[
						{
							type: 'inline-dropdown',
							text: 'It\'s ',
							options: ["at", "not at", "before", "after"],
						},{
							type: "inline-number",
							text: " visit number ",
							value: 1,
							min: 1,
							max: 999,
						},
					],[
						{
							type: 'inline-dropdown',
							text: 'It\'s an',
							options: ["even", "odd"],
						},{
							type: "inline-text",
							text: " numbered visit.",
						},
					],[
						{
							type: "inline-number",
							text: "",
							value: 2,
							min: 1,
							max: 999,
						},{
							type: "inline-text",
							text: " seconds have passed since this passage was entered.",
						},
					]
				],
			},{
				type: 'confirm',
				confirm() {
				},
			}),
		default: folddownPanel({
				type: 'small',
				text: 'The current story format is <b>Harlowe 3.2.0</b>. Consult its <a href="https://twine2.neocities.org/" target="_blank" rel="noopener noreferrer">documentation</a>.'
			},{
				type: 'buttons',
				buttons: [
					{ title:'Bold',                    html:'<b>B</B>',                       onClick: () => wrapSelection("''","''")},
					{ title:'Italic',                  html:'<i>I</i>',                       onClick: () => wrapSelection("//","//")},
					{ title:'Strikethrough',           html:'<s>S</s>',                       onClick: () => wrapSelection("~~","~~")},
					{ title:'Superscript',             html:'<sup>Sup</sup>',                 onClick: () => wrapSelection("^^","^^")},
					{ title:'Collapse whitespace',     html:'{}',                             onClick: () => wrapSelection("{","}")},
					// Separate the basic markup buttons from those of the wizards
					el('<span style="padding:0px 2px;color:hsla(0,0%,50%,0.5)">•</span>'),
					{ title:'Special text style',      html:'Styles…',                        onClick: () => switchPanel('textstyle')},
					{ title:'Passage link',            html:'Link…',                          onClick: () => switchPanel('passagelink')},
					{
						title: 'Only show a portion of text if a condition is met',
						html:'If…',
						onClick: () => switchPanel('if')
					},
				],
			}),
	};
	/*
		Switch to the default panel at startup.
	*/
	switchPanel();

	function Toolbar(cmObj) {
		const passageTagsElem = document.querySelector('.editor .passageTags');
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
