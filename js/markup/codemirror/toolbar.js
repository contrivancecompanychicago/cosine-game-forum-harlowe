/*jshint strict:true*/
(function() {
	'use strict';
	const {stringify, parse} = JSON;
	const {round} = Math;
	let panels;
	let cm, lex, Patterns, ShortDefs;
	/*
		These are a couple of convenience routines.
	*/
	const $ = 'querySelector';
	const $$ = $ + 'All';
	const ON = "addEventListener";
	const OFF = "removeEventListener";
	const P = document.createElement('p');
	function el(html) {
		P.innerHTML = html;
		return P.firstChild;
	}
	const GCD = (a,b) => !a? b: !b? a: a>b? GCD(a-b,b) : GCD(a,b-a);
	const fourDecimals = n => round(n*10000)/10000;
	const fontIcon = name => `<i class="fa fa-${name}"></i>`;
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
			return '';
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
	function switchPanel(name) {
		if (typeof name !== 'string') {
			name = 'default';
		}
		const {height} = getComputedStyle(toolbarElem);
		/*
			Uncheck all checkboxes, return all <select>s to default, and clear all textareas.
		*/
		Object.entries(panels).forEach(([name2,panel]) => {
			/*
				Lazy-create the panel if it's the one we're switching to and it hasn't been created yet.
			*/
			if (typeof panel === 'function') {
				if (name2 === name) {
					panel = panels[name2] = panel();
				}
				else return;
			}
			panel[$$]('[type=radio]').forEach(node => node.checked = (node.parentNode.parentNode[$]('label:first-of-type') === node.parentNode));
			panel[$$]('[type=checkbox]').forEach(node => node.checked = false);
			panel[$$]('[type=text]').forEach(node => node.value = '');
			panel[$$]('select').forEach(node => {
				node.value = node.firstChild.getAttribute('value');
				// For dropdowns that involve dropdown rows, hide the rows themselves.
				const { nextElementSibling:next } = node;
				if (next && next.className.includes('harlowe-3-dropdownRows')) {
					Array.from(next.children).forEach(el => {
						el[(el.getAttribute('data-value') === node.value ? "remove" : "set") + "Attribute"]('hidden','');
					});
				}
			});
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
		"fade-right": rev => rev ? "fade-left" : "fade-right",
		"fade-left":  rev => rev ? "fade-right" : "fade-left",
		"fade-up":    rev => rev ? "fade-down" : "fade-up",
		"fade-down":  rev => rev ? "fade-up" : "fade-down",
		blur:        () => "blur",
	};

	const builtinColourNames = {
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

	const openColors = [
		["#f8f9fa","#fff5f5","#fff0f6","#f8f0fc","#f3f0ff","#edf2ff","#e7f5ff","#e3fafc","#e6fcf5","#ebfbee","#f4fce3","#fff9db","#fff4e6"],
		["#f1f3f5","#ffe3e3","#ffdeeb","#f3d9fa","#e5dbff","#dbe4ff","#d0ebff","#c5f6fa","#c3fae8","#d3f9d8","#e9fac8","#fff3bf","#ffe8cc"],
		["#e9ecef","#ffc9c9","#fcc2d7","#eebefa","#d0bfff","#bac8ff","#a5d8ff","#99e9f2","#96f2d7","#b2f2bb","#d8f5a2","#ffec99","#ffd8a8"],
		["#dee2e6","#ffa8a8","#faa2c1","#e599f7","#b197fc","#91a7ff","#74c0fc","#66d9e8","#63e6be","#8ce99a","#c0eb75","#ffe066","#ffc078"],
		["#ced4da","#ff8787","#f783ac","#da77f2","#9775fa","#748ffc","#4dabf7","#3bc9db","#38d9a9","#69db7c","#a9e34b","#ffd43b","#ffa94d"],
		["#adb5bd","#ff6b6b","#f06595","#cc5de8","#845ef7","#5c7cfa","#339af0","#22b8cf","#20c997","#51cf66","#94d82d","#fcc419","#ff922b"],
		["#868e96","#fa5252","#e64980","#be4bdb","#7950f2","#4c6ef5","#228be6","#15aabf","#12b886","#40c057","#82c91e","#fab005","#fd7e14"],
		["#495057","#f03e3e","#d6336c","#ae3ec9","#7048e8","#4263eb","#1c7ed6","#1098ad","#0ca678","#37b24d","#74b816","#f59f00","#f76707"],
		["#343a40","#e03131","#c2255c","#9c36b5","#6741d9","#3b5bdb","#1971c2","#0c8599","#099268","#2f9e44","#66a80f","#f08c00","#e8590c"],
		["#212529","#c92a2a","#a61e4d","#862e9c","#5f3dc4","#364fc7","#1864ab","#0b7285","#087f5b","#2b8a3e","#5c940d","#e67700","#d9480f"]
	];

	const t8nNames = ["default", "", "instant", "dissolve", "blur", "rumble", "shudder", "pulse", "zoom", "flicker", "slide-left", "slide-right", "slide-up", "slide-down",
		"fade-left", "fade-right", "fade-up", "fade-down"];

	function toCSSColour(colour, alpha) {
		if (+alpha === 0) {
			return "transparent";
		}
		if (+alpha < 1) {
			colour = colour.slice(1);
			const
				r = parseInt(colour.slice(0,2), 16),
				g = parseInt(colour.slice(2,4), 16),
				b = parseInt(colour.slice(4,6), 16);
			return `rgba(${r},${g},${b},${alpha})`;
		}
		return colour;
	}

	function toHarloweColour(colour, alpha) {
		function hexToHSL(str) {
			str = str.slice(1);
			const
				r = parseInt(str.slice(0,2), 16) / 255,
				g = parseInt(str.slice(2,4), 16) / 255,
				b = parseInt(str.slice(4,6), 16) / 255,
				Max = Math.max(r, g, b),
				Min = Math.min(r, g, b),
				// Lightness is the average of the highest and lowest values.
				l = (Max + Min) / 2,
				delta = Max - Min;

			if (Max === Min) {
				// If all three RGB values are equal, it is a gray.
				return { h:0, s:0, l };
			}
			// Calculate hue and saturation as follows.
			let h;
			switch (Max) {
				case r: h = (g - b) / delta + (g < b ? 6 : 0); break;
				case g: h = (b - r) / delta + 2; break;
				case b: h = (r - g) / delta + 4; break;
			}
			h = Math.round(h * 60);

			const s = l > 0.5
				? delta / (2 - Max - Min)
				: delta / (Max + Min);
			return { h, s, l };
		}

		colour = colour.toLowerCase();
		if (+alpha === 0) {
			return "transparent";
		}
		if (+alpha < 1) {
			colour = hexToHSL(colour);
			return `(hsl:${fourDecimals(colour.h)},${fourDecimals(colour.s)},${fourDecimals(colour.l)},${fourDecimals(alpha)})`;
		}
		return colour in builtinColourNames
			? builtinColourNames[colour]
			: (colour[1] === colour[2] && colour[3] === colour[4] && colour[5] === colour[6]) ? "#" + colour[1] + colour[3] + colour[5] : colour;
	}

	/*
		This creates a dropdown selector that can be used to input most native Harlowe values.

		modelCallback is a callback to use instead of setting a value on the model in their model() methods.
		modelRegistry is an alternative array to register the model() methods to, instead of the one for the parent panel.
		Both of these are used entirely by datavalue-rows and datavalue-map, in order to suppress the usual behaviour of panel rows,
		and to be able to dynamically add and remove rows during use.

		noComplexValues prevents the UI from becoming too complicated by removing "+ value" entries when this is a nested row.
	*/
	const dataValueRow = (modelCallback = (m,v) => m.expression = v, modelRegistry = undefined, noComplexValues = undefined) => ({
		type: 'inline-dropdown-rows',
		text: 'Value: ',
		name: 'variable-datatype',
		width: "16%",
		options: [
			["text string", {
				type: "inline-string-textarea",
				width:"55%",
				text: "",
				placeholder: "Text",
				modelCallback,
				modelRegistry,
			}],
			["number", {
				type: "inline-number-textarea",
				width:"20%",
				text: "",
				modelCallback,
				modelRegistry,
			}],
			["Boolean value", {
				type: 'inline-dropdown',
				text: '',
				options: ['false','true'],
				model(m, el) {
					modelCallback(m, ""+!!el[$]('select').value);
				},
				modelRegistry,
			}],
			["colour", {
				type: 'inline-colour',
				text: '',
				value: "#ffffff",
				model(m, el) {
					const c = el[$]('[type=color]').value,
						a = el[$]('[type=range]').value;
					modelCallback(m, toHarloweColour(c, a));
				},
				modelRegistry,
			}],
			["array", {
				type: "datavalue-rows",
				text: "<div class='harlowe-3-datavalueRowHint'>An <b>array</b> is a sequence of ordered datavalues that can be used without having to create separate variables for each. "
					+ "Use it to store similar values whose order and position matter, or to store an ever-changing quantity of similar values.</div>",
				/*
					As a slightly unfortunate kludge, "datavalue-rows" and "datavalue-map" models do not have an el as their
					second argument, but instead an array of precomputed values created by the model() methods
					of each datavalue row.
				*/
				model(m, rowValues) {
					modelCallback(m, '(a:' + rowValues + ")");
				},
				/*
					This is a special method for datavalue-rows that displays numbers (usually array indices) for each subvalue's line.
				*/
				renumber(label,num) {
					num += 1;
					const lastDigit = (num + '').slice(-1);
					
					label.textContent = num +
						(lastDigit === "1" ? "st" :
						lastDigit === "2" ? "nd" :
						lastDigit === "3" ? "rd" : "th") + ": ";
				},
				modelRegistry,
			}],
			["datamap", {
				type: "datavalue-map",
				text: "<div class='harlowe-3-datavalueRowHint'>A <b>datamap</b> is a value that holds any number of other values, each of which is \"mapped\" to a unique name. "
					+ "Use it to store data values that represent parts of a larger game entity, or rows of a table.</div>",
				model(m, rowValues) {
					/*
						Unlike arrays, datamaps have a constraint on their data names: they must not be empty.
					*/
					if (!rowValues.every((e,i) => i % 2 !== 0 || (e !== '""' && e !== "''"))) {
						// Any panel that consumes dataValueRow() should invalidate the model if this is true.
						m.invalidSubrow = true;
					}
					modelCallback(m, '(dm:' + rowValues + ")");
				},
				/*
					Datamaps don't have sequential name labels, instead having just a colon.
				*/
				renumber(label) {
					label.textContent = ":";
				},
				modelRegistry,
			}],
			[],
			["randomly chosen value", {
				type: "datavalue-rows",
				text: "<div class='harlowe-3-datavalueRowHint'>One of the following values is randomly chosen <b>each time the macro is run</b>.</div>",
				model(m, rowValues) {
					if (!rowValues.length) {
						m.invalidSubrow = true;
					}
					modelCallback(m, '(either:' + rowValues + ")");
				},
				renumber(label) {
					label.textContent = "•";
					label.style.marginRight="0.5em";
				},
				modelRegistry,
			}],
			["random number", el(`<div class='harlowe-3-datavalueRowHint'>A number between these two values is randomly chosen <b>each time the macro is run</b>.</div>`), {
				type: "inline-number-textarea",
				width:"20%",
				text: "From",
				model() {},
				modelRegistry,
			},{
				type: "inline-number-textarea",
				width:"20%",
				text: "to",
				model(m, elem) {
					modelCallback(m, '(random:' + (+elem.previousElementSibling[$]('input').value || 0) + ',' + (+elem[$]('input').value || 0) + ")");
				},
				modelRegistry,
			}],
		].concat(noComplexValues ? [] : [
			[],
			["itself + value", {
				type: "datavalue-inner",
				text: "<div class='harlowe-3-datavalueRowHint'>The following value is added to the existing value in the variable. NOTE: if the values aren't the same type of data, an error will result.</div>",
				model(m, rowValues) {
					if (rowValues.length !== 1) {
						m.invalidSubrow = true;
					}
					modelCallback(m, 'it + ' + rowValues);
				},
				renumber(label) {
					(label || {}).textContent = "it + ";
				},
				modelRegistry,
			}],
			["variable + value",
				{
					type: "inline-dropdown",
					text: ' Other variable: ',
					options: ["$", "_"],
					model(m, elem) {
						/*
							Because variable + value rows cannot be nested or included in datavalue-rows, 
						*/
						m.innerVariable = elem[$]('select').value ? "_" : "$";
					},
				},{
					type: "inline-textarea",
					width:"25%",
					text: "",
					placeholder: "Variable name",
					model(m, elem) {
						const v = elem[$]('input').value;
						if (v) {
							if (RegExp("^" + Patterns.validPropertyName + "$").exec(v) && !RegExp(/^\d/).exec(v)) {
								m.innerVariable += v;
							}
						}
					},
				},{
					type: "datavalue-inner",
					text: "<div class='harlowe-3-datavalueRowHint'>The above variable's value and the value below are added together. NOTE: if the values aren't the same type of data, an error will result.</div>",
					model(m, rowValues) {
						if (rowValues.length !== 1) {
							m.invalidSubrow = true;
						}
						modelCallback(m, m.innerVariable + ' + ' + rowValues);
					},
					renumber(label) {
						(label || {}).textContent = "";
					},
					modelRegistry,
				}
			],
		]).concat([
			[],
			['coded expression', {
				type: "expression-textarea",
				width:"90%",
				text: '<div>Write a Harlowe code expression that should be computed to produce the desired value.</div>',
				placeholder: "Code",
				modelCallback,
				modelRegistry,
			}],
		]),
	});

	/*
		The constructor for the folddownPanels. This accepts a number of panel rows (as an array of row-describing objects)
		and returns a <div> with the compiled UI elements.

		Each row object typically has the following:
		- update: A function taking the entire panel element, and performing actions whenever this element's value is altered.
		- name: User-facing display name of this element.
		- type: Which type of UI element to create for it.

		Note: panel creation is deferred until first access - hence, this returns a zero-arity function.
	*/
	const folddownPanel = (...panelRows) => () => {
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
			// If the model is declared valid, then code can be produced using the panel as it currently is.
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

		const makeColourPicker = value => {
			const makeSwatchRow = (colours, index, visible) =>
				el(`<span class=harlowe-3-swatchRow data-index="${index}" ${!visible ? 'style="display:none"' : ''}>`
					+ colours.map(colour =>
						'<span class=harlowe-3-swatch style="background-color:' + colour + '"></span>').join('')
					+ "</span>");

			const ret = el('<div class=harlowe-3-singleColourPicker><input style="width:48px;margin-right:8px" type=color value="'
				+ value + '"></div>');
			const swatchSelect = el(`<select><option value="" selected>Harlowe built-ins</option></select>`);
			ret.append(makeSwatchRow(Object.keys(builtinColourNames), '', true));
			openColors.forEach((row,i) => {
				ret.append(makeSwatchRow(row, i));
				swatchSelect.append(el(`<option value=${i}>OpenColor ${i}</option>`));
			});
			swatchSelect[ON]('change', () => {
				ret[$$](`[data-index]`).forEach(ind => ind.style.display = 'none');
				ret[$](`[data-index="${swatchSelect.value}"]`).style.display = "inline-block";
			});
			ret.append(swatchSelect, el('<br>'), new Text(`Opacity: `), el(`<input type=range style="width:64px;top:8px;position:relative" value=1 min=0 max=1 step=0.05>`));

			ret[ON]('click', ({target}) => {
				if (target.classList.contains('harlowe-3-swatch')) {
					const input = ret[$]('input');
					input.value = target.getAttribute('style').slice(-7);
					input.dispatchEvent(new Event('change'));
				}
			});
			return ret;
		};

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
					const elem = el(`<button title="${button.title}" class="harlowe-3-toolbarButton${button.active ? ' active' : ''}">${button.html}</button>`);
					button.onClick && elem.addEventListener('click', button.onClick);
					return elem;
				}));
			}
			/*
				The (text-style:) preview panel.
			*/
			if (type.endsWith("preview")) {
				const tagName = row.tagName || 'span';
				ret = el(`<div class="harlowe-3-stylePreview" style="${type.startsWith('t8n') ? 'cursor:pointer;height: 2.6rem;' : ''}" ${
					type.startsWith('t8n') ? `alt="Click to preview the transition"` : ""}><${tagName}>${row.text || ''}</${tagName}>${type.startsWith('t8n') ? `<${tagName}>` + row.text2 + `</${tagName}>` : ''}</div>`);

				if (type.startsWith('t8n')) {
					ret[ON]('mouseup', update);
					ret[ON]('touchend', update);
					const firstSpan = ret[$](':first-child');
					firstSpan[ON]('animationend', () => firstSpan.style.visibility = "hidden");
				}
			}
			/*
				Checkboxes and radio buttons.
			*/
			if (type === "checkbox" || type === "checkboxrow") {
				ret = el('<label style="display:block;"><input type="checkbox"></input>' + row.text + '</label>');
				if (type.endsWith('w')) {
					row.subrow.reduce(reducer, ret);
					row.subrow.forEach(r => {
						const {model} = r;
						r.model = (m, el) => {
							return ret[$](':scope > input:checked')
								/*
									Don't run the subrow's model unless the parent row's radio button is checked.
								*/
								&& (!nested || panelElem[$](':scope > input:checked')) ? model(m, el) : m;
						};
					});
				}
				ret[ON]('change', update);
			}
			if (type === "checkboxes") {
				ret = el(`<div class="harlowe-3-toolbarCheckboxRow"><div${row.bold ? ' style="font-weight:bold"' :''}>${row.name}</div></div>`);
				row.options.forEach(box => {
					const e = el(`<label${row.capitalise ? ' style="text-transform:capitalize;"' : ''}><input type="checkbox"></input>${box}</label>`);
					e[ON]('change', update);
					ret.append(e);
				});
			}
			if (type === "radios") {
				ret = el(`<div class="harlowe-3-toolbarCheckboxRow"><div${row.bold ? ' style="font-weight:bold"':''}>${row.name}</div></div>`);
				row.options.forEach((radio,i) => {
					const e = el(`<label${row.capitalise ? ' style="text-transform:capitalize;"' : ''}><input type="radio" name="${row.name}" value="${radio}" ${!i ? 'checked' : ''}></input>${radio}</label>`);
					e[ON]('change', update);
					ret.append(e);
				});
			}
			/*
				Text areas, single lines in which text can be entered.
			*/
			if (type.endsWith("textarea")) {
				let inputType = 'text';
				/*
					Full Harlowe expressions.
				*/
				if (type.endsWith("expression-textarea")) {
					/*
						These have special update and model routines.
					*/
					row.update = (m, elem) => {
						if (!m.expression && elem[$]('input').value) {
							elem.setAttribute('invalid', `This doesn't seem to be valid code.`);
						}
						else {
							elem.removeAttribute('invalid');
						}
					};
					row.model = (m, elem) => {
						const v = (elem[$]('input').value || '').trim();
						if (v) {
							/*
								Attempt to lex the data, and consider it invalid if it contains any text nodes.
							*/
							const lexed = lex(v, 0, 'macro');
							if (lexed.children.every(function recur(token) {
								return token.type !== "text" && token.type !== "error" &&
									(token.type === "string" || token.type === "hook" || token.children.every(recur));
							})) {
								row.modelCallback(m,v);
								return;
							}
							m.valid = true;
						}
					};
				}
				/*
					String-type textarea
				*/
				if (type.endsWith("string-textarea")) {
					row.model || (row.model = (m, elem) => {
						row.modelCallback(m, JSON.stringify(elem[$]('input').value || ''));
					});
				}
				if (type.endsWith("number-textarea")) {
					inputType = 'number';
					row.model || (row.model = (m, elem) => {
						row.modelCallback(m, +elem[$]('input').value || 0);
					});
				}
				ret = el('<' + (inline ? 'span' : 'div') + ' class="harlowe-3-labeledInput">'
					+ row.text
					+ '<input ' + (row.useSelection ? 'data-use-selection' : '') + (type.includes('passage') ? 'list="harlowe-3-passages"' : '') + ' style="width:'
						+ (row.width) + ';margin' + (inline ? ':0 0.5rem' : '-left:1rem') + ';" type=' + inputType + ' placeholder="' + (row.placeholder || '')
					+ '"></input></' + (inline ? 'span' : 'div') + '>');
				ret[$]('input')[ON]('input', update);
			}
			if (type.endsWith("number") || type.endsWith("range")) {
				ret = el('<' + (inline ? 'span' : 'div') + ' class="harlowe-3-labeledInput">'
					+ row.text
					+ '<input style="" type=' + (type.endsWith("range") ? "range" : "number")
					+ ' min=' + row.min + ' max=' + row.max + ' value=' + row.value + (row.step ? ' step=' + row.step : '') + '></input></' + (inline ? 'span' : 'div') + '>');
				ret[$]('input')[ON]('change', update);
			}
			if (type.endsWith("colour")) {
				ret = el('<' + (inline ? 'span' : 'div') + ' class="harlowe-3-labeledInput">'
					+ row.text
					+ '</' + (inline ? 'span' : 'div') + '>');
				const picker = makeColourPicker(row.value);
				ret.append(picker);
				ret[$$]('input').forEach(input => input[ON]('change', update));
			}
			if (type.endsWith("gradient")) {
				ret = el(`<div style='position:relative'><span class=harlowe-3-gradientBar></span><button>${fontIcon('plus')} Colour</button></div>`);
				const gradientBar = ret[$]('.harlowe-3-gradientBar');
				const createColourStop = (percent, colour, selected) =>  {
					const ret = el(
						`<div ${selected ? 'selected' : ''} data-colour="${
							colour
						}" data-pos="${percent}" class=harlowe-3-colourStop style="left:calc(${
							percent * 100
						}% - 8px); top:-8px"><div class=harlowe-3-colourStopButtons style="left:${-464*percent}px">`
						+ `</div></div>`
					);
					const picker = makeColourPicker(colour);
					picker[$$]('input').forEach(input => input[ON]('change', () => {
						const alpha = picker[$]('[type=range]').value;
						const colour = picker[$]('[type=color]').value;
						ret.setAttribute('data-colour', toCSSColour(colour, alpha));
						if (alpha < 1) {
							ret.setAttribute('data-harlowe-colour', toHarloweColour(colour, alpha));
						}
						update();
					}));
					const deleteButton = el(`<button style='float:right'>${fontIcon('times')} Delete</button>`);
					deleteButton[ON]('click', () => { ret.remove(); update(); });
					picker.append(deleteButton);
					ret.firstChild.prepend(picker);
					gradientBar.append(ret);
					update();
				};
				setTimeout(() => {
					createColourStop(0, '#ffffff');
					createColourStop(0.5, '#000000', true);
					createColourStop(1, '#ffffff');
				});

				ret[$]('button')[ON]('click', () => createColourStop(0.5, '#888888'));
				const listener = ({target}) => {
					if (target.classList.contains("harlowe-3-colourStop")) {
						const html = document.documentElement;
						const {left, right} = gradientBar.getBoundingClientRect();
						const width = right - left;
						const onMouseMove = ({pageX, touches}) => {
							pageX = pageX || (touches && touches[0].pageX);
							if (pageX === undefined) {
								return;
							}
							const pos = Math.min(1,Math.max(0,(pageX - window.scrollX - left) / width));
							target.style.left = `calc(${pos * 100}% - 8px)`;
							/*
								Reposition the colour stop's button bar so that it's always entirely visible.
							*/
							target.firstChild.style.left = `${-464*pos}px`;
							target.setAttribute('data-pos', pos);
							update();
						};
						const onMouseUp = () => {
							html[OFF]('mousemove', onMouseMove);
							html[OFF]('mouseup', onMouseUp);
							html[OFF]('touchmove', onMouseMove);
							html[OFF]('touchend', onMouseUp);
						};
						html[ON]('mousemove', onMouseMove);
						html[ON]('mouseup', onMouseUp);
						html[ON]('touchmove', onMouseMove);
						html[ON]('touchend', onMouseUp);

						/*
							Additionally, when a stop is clicked, deselect all other stops and select this one,
							causing its menu to appear.
						*/
						Array.from(gradientBar[$$]('[selected]')).forEach(s => s.removeAttribute('selected'));
						target.setAttribute('selected', true);
					}
				};
				ret[ON]('mousedown', listener);
				ret[ON]('touchstart', listener);

				updaterFns.push(() => {
					gradientBar.style.background = `linear-gradient(to right, ${
						Array.from(gradientBar[$$]('.harlowe-3-colourStop'))
							.sort((a,b) => a.getAttribute('data-pos') - b.getAttribute('data-pos'))
							.map(stop => stop.getAttribute('data-colour') + ' ' + (stop.getAttribute('data-pos')*100) + '%')
					})`;
				});
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
				dropdownDiv[$]('select')[ON]('change', update);
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
						Place each of these sub-options within the <label>.
					*/
					ret.append(subrows.reduce(reducer, subrowEl));
					/*
						Wrap each of the subrows' model functions, so that they only fire whenever this row is actually selected.
					*/
					subrows.forEach(subrow => {
						const {model} = subrow;
						if (model) {
							subrow.model = (m, el) => {
								return subrowEl[$](':scope > input:checked')
								/*
									Don't run the subrow's model unless the parent row's radio button is checked.
								*/
								&& (!nested || panelElem[$](':scope > input:checked')) ? model(m, el) : m;
							};
						}
					});
					subrowEl[$]('input')[ON]('change', update);
				});
			}
			if (type === "macro-list") {
				ret = el(`<div><div style="text-align:center">Category: </div></div>`);
				const categorySelector = el(`<select>`);
				ret.firstChild.append(categorySelector);
				const scrollBox = el(`<div style="margin-top:8px;border-top:1px solid hsla(0,0%,50%,0.5);max-height:40vh;overflow-y:scroll">`);
				ret.append(scrollBox);
				categorySelector[ON]('change', () => {
					const el = scrollBox[$](`[name="${categorySelector.value}"]`);
					el && el.scrollIntoView();
				});
				Object.values(ShortDefs.Macro)
					.sort(({name:leftName, category:leftCategory, categoryOrder:leftCategoryOrder}, {name:rightName, category:rightCategory, categoryOrder:rightCategoryOrder}) => {
						/*
							Sort alphabetically, then by explicit order number.
						*/
						if (leftCategory !== rightCategory) {
							return (leftCategory || "").localeCompare(rightCategory || "");
						}
						if (leftCategoryOrder !== rightCategoryOrder) {
							if (isNaN(+leftCategoryOrder)) {
								return 1;
							}
							if (isNaN(+rightCategoryOrder)) {
								return -1;
							}
							return Math.sign(leftCategoryOrder - rightCategoryOrder);
						}
						return leftName.localeCompare(rightName);
					})
					.forEach((defs, i, a) => {
						// Add category titles whenever the category changes.
						if (i === 0 || defs.category !== a[i-1].category) {
							scrollBox.append(el(`<h3 style="text-transform:capitalize" name="${defs.category}">${defs.category}</h3>`));
							categorySelector.append(el(`<option value="${defs.category}">${defs.category}</option>`));
						}
						// Filter out doubles (created by macro aliases).
						if (i > 0 && defs.name === a[i-1].name) {
							return;
						}

						const subrowEl = el(`<label class='harlowe-3-radioRow'><input type="radio" name="macro-list" value="${defs.name}"></input>`
							+ `<code><a href="https://twine2.neocities.org/#${defs.anchor}" target="_blank" rel="noopener noreferrer">(${defs.name}: ${defs.sig}) → ${defs.returnType}</a></code>`
							+ `${defs.aka.length ? `<div><i>Also known as: ${
								defs.aka.map(alias => `<code>(${alias}:)</code>`).join(', ')
							}</i>` : ''}</div><div>${
								defs.abstract.replace(/`([^`]+)`/g, (_, inner) => `<code>${inner}</code>`)
							}</div></label>`
						);
						scrollBox.append(subrowEl);
						subrowEl[$]('input')[ON]('change', update);
					});
			}
			/*
				Rows of options, selected using a single dropdown.
			*/
			if (type.endsWith("dropdown-rows")) {
				ret = el(`<${inline ? 'span' : 'div'}><span class="harlowe-3-dropdownRowLabel">${
						row.text
					}</span><select style="font-size:1rem;margin-top:4px;${
						row.width ? `width:${row.width};text-overflow:ellipsis` : ''
					}"></select><span class="harlowe-3-dropdownRows"></span></${inline ? 'span' : 'div'}>`);
				const selectEl = ret[$]('select');
				row.options.forEach(([name, ...subrows], i) => {
					if (!name) {
						selectEl.append(el(`<option disabled>───────</option>`));
						return;
					}
					selectEl.append(el(`<option value="${name}" ${!i ? 'selected' : ''}>${name}<option>`));
					const subrowEl = el(`<span data-value="${name}" ${i ? 'hidden' : ''}>`);
					/*
						Place each of these sub-options within the .harlowe-3-dropdownRows.
					*/
					ret[$]('.harlowe-3-dropdownRows').append(subrows.reduce(reducer, subrowEl));

					subrows.forEach(subrow => {
						const {model} = subrow;
						if (model) {
							subrow.model = (m, el) => {
								return selectEl.value === name
								/*
									Don't run the subrow's model unless the parent row's radio button is checked.
								*/
								&& (!nested || panelElem[$](':scope > input:checked')) ? model(m, el) : m;
							};
						}
					});
				});
				selectEl[ON]('change', () => {
					const value = selectEl.value;
					ret[$$](':scope > .harlowe-3-dropdownRows > span').forEach(el => {
						el[(el.getAttribute('data-value') === value ? "remove" : "set") + "Attribute"]('hidden','');
					});
					update();
				});
			}
			/*
				A column of textareas, but with buttons to add and subtract additional ones.
			*/
			if (type === "textarea-rows") {
				ret = el(`<div class="harlowe-3-textareaRows ${row.nonZeroRows ? 'harlowe-3-nonZeroRows' : ''}">`);
				const makeRow = () => {
					if (ret.childNodes.length > 100) {
						return;
					}
					const line = el(`<div class="harlowe-3-dataRow"><input type=text style="width:85%;" placeholder="${row.placeholder}"></input><button class="harlowe-3-rowMinus">${
							fontIcon('minus')
						}</button><button class="harlowe-3-rowPlus">${
							fontIcon('plus')
						}</button></div>`);
					line[$]('input')[ON]('input', update);
					line[$]('.harlowe-3-rowPlus')[ON]('click', () => { makeRow(); update(); });
					line[$]('.harlowe-3-rowMinus')[ON]('click', () => { line.remove(); update(); });
					ret.append(line);
				};
				makeRow();
			}
			if (type === "datavalue-inner") {
				ret = el(`<div class="harlowe-3-dataRow" style='margin:0.2em 0px'>${row.text}</div>`);
				const modelRegistry = [];
				let rowValuesBuffer = [];

				reducer(ret, dataValueRow((m,v) => rowValuesBuffer.push(v), modelRegistry, true));

				const innerModel = row.model;
				row.model = (m) => {
					/*
						The process for actually obtaining a value from the child rows is:
						clear the rowValues buffer, then populate it by firing all of the model() methods
						that were captured in the modelRegistry.
					*/
					rowValuesBuffer = [];
					modelRegistry.reduce((m, fn) => fn(m) || m, m);
					innerModel && innerModel(m, rowValuesBuffer);
				};
				row.renumber(ret[$](':scope > * > .harlowe-3-dropdownRowLabel'));
			}
			/*
				Datavalue rows are rows of inputs for Harlowe data values, which can be added and subtracted.
				Each Harlowe input is a special row created by dataValueRow(), above.
				Datavalue-map is a special case where the position name is an inline-textarea input, meaning
				each line has two inputs each.
			*/
			if (type === "datavalue-rows" || type === "datavalue-map") {
				ret = el(`<div class="harlowe-3-datavalueRows">${row.text || ''}<div class="harlowe-3-dataEmptyRow"><i>No data</i></div><button class="harlowe-3-rowPlus">${
						fontIcon('plus')
					} Value</button></div>`);
				const plusButton = ret[$]('.harlowe-3-rowPlus');

				/*
					Unlike every other panel row implemented, this dynamically creates and destroys other panel rows.
					As such, some special measures have to be taken to allow this row to still act like a normal row,
					and for its subrows to be entirely subordinate to it.
					In order to capture and suppress the model() methods of each subrow, two closure variables are needed:
					a modelRegistry, which vaccuums up the model() methods of subrows as they are created (by being passed to
					dataValueRow() in position 2) and a rowValuesBuffer, which is pushed to in place of assigning to the model
					in each row's model() methods (see above), using the callback argument to dataValueRow() in position 1.
				*/
				const childModelMethods = new Set();
				let rowValuesBuffer = [];
				/*
					A utility to ensure that each datavalue-row's "Value:" label is replaced with "1st", "2nd" and so forth.
				*/
				const renumber = () => {
					Array.from(ret[$$](':scope > .harlowe-3-dataRow > * > .harlowe-3-dropdownRowLabel')).forEach(row.renumber);
				};
				const makeRow = () => {
					if (ret.childNodes.length > 50) {
						return;
					}
					const line = el(`<div class="harlowe-3-dataRow">`);
					/*
						The model() methods of this line's subrows are captured in this array, as well as the childModelMethods set.
						This is to allow them to be deleted from the set once the line is removed.
					*/
					const modelRegistry = [];
					ret.insertBefore((
							type.endsWith("map") ? [{
								type: "inline-textarea",
								text: "",
								placeholder: "Data name",
								width:"15%",
								model(_, elem) {
									rowValuesBuffer.push(stringify(elem[$]('input').value));
								},
								modelRegistry,
							}] : []
						).concat(dataValueRow((m,v) => rowValuesBuffer.push(v), modelRegistry, true)).reduce(reducer, line), plusButton);

					modelRegistry.forEach(m => childModelMethods.add(m));

					line.append(el(`<button class="harlowe-3-rowMinus">${
							fontIcon('minus')
						}</button>`));
					line[$](':scope > .harlowe-3-rowMinus')[ON]('click', () => {
						line.remove();
						/*
							When the line is removed, all of its model() methods must be freed, too.
						*/
						modelRegistry.forEach(m => childModelMethods.delete(m));
						if (ret.childNodes.length === 0) {
							makeRow();
						}
						update();
						renumber();
					});
				};
				const innerModel = row.model;
				row.model = (m) => {
					/*
						The process for actually obtaining a value from the child rows is:
						clear the rowValues buffer, then populate it by firing all of the model() methods
						that were captured in the modelRegistry.
					*/
					rowValuesBuffer = [];
					[...childModelMethods].reduce((m, fn) => fn(m) || m, m);
					innerModel && innerModel(m, rowValuesBuffer);
				};
				plusButton[ON]('click', () => { makeRow(); update(); renumber(); });
			}
			/*
				The "Create" and "Cancel" buttons.
			*/
			if (type === "confirm") {
				const buttons = el('<p class="buttons" style="padding-bottom:8px;"></p>');
				const resultingCode = el(`<span>Resulting code: <span class="harlowe-3-resultCode"><code></code> <code></code></span></span>`);
				const cancel = el(`<button>${fontIcon('times')} Cancel</button>`);
				const confirm = el(`<button class="create">${fontIcon('check')} Add</button>`);
				confirm.setAttribute('style', disabledButtonCSS);
				updaterFns.push(m => {
					const setAttr = !m.valid ? 'setAttribute' : 'removeAttribute';
					confirm[setAttr]('style', disabledButtonCSS);
					resultingCode[setAttr]('hidden','');
					if (m.valid) {
						if (typeof m.wrapStart === 'function') {
							m.wrapStart = m.wrapStart(m);
						}
						if (typeof m.wrapEnd === 'function') {
							m.wrapEnd = m.wrapEnd(m);
						}
						resultingCode[$]('code:first-of-type').textContent = m.output() + m.wrapStart;
						resultingCode[$]('code:last-of-type').textContent = m.wrapEnd;
					}
				});
				
				cancel[ON]('click', switchPanel);
				confirm[ON]('click', () => {
					const m = model();
					if (typeof m.wrapStart === 'function') {
						m.wrapStart = m.wrapStart(m);
					}
					if (typeof m.wrapEnd === 'function') {
						m.wrapEnd = m.wrapEnd(m);
					}
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
				If an alternative modelRegistry array was passed in (i.e. by datavalue-rows), then use that instead.
			*/
			row.model && (row.modelRegistry || modelFns).push(m => row.model(m, ret));
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
		Some frequently used panel elements.
	*/
	const remainderOfPassageCheckbox = {
		type: 'checkbox',
		text: 'Affect the entire remainder of the passage or hook',
		model(m, elem) {
			if (elem[$](':checked')) {
				m.wrapStart = "[=\n";
				m.wrapEnd = "";
			}
		},
	};
	const hookDescription = `A <b>hook</b> is a section of passage prose enclosed in <code>[</code> or <code>]</code>, or preceded with <code>[=</code>.`;
	const confirmRow = { type: 'confirm', };

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
					emboss:                "text-shadow: 0.04em 0.04em 0em white",
					condense:              "letter-spacing:-0.08em",
					expand:                "letter-spacing:0.1em",
					blur:                  "text-shadow: 0em 0em 0.08em white; color:transparent",
					blurrier:              "text-shadow: 0em 0em 0.2em white; color:transparent",
					smear:                 "text-shadow: 0em 0em 0.02em white, -0.2em 0em 0.5em white, 0.2em 0em 0.5em white; color:transparent",
					mirror:                "display:inline-block;transform:scaleX(-1)",
					"upside-down":         "display:inline-block;transform:scaleY(-1)",
					blink:                 "animation:fade-in-out 1s steps(1,end) infinite alternate",
					"fade-in-out":         "animation:fade-in-out 2s ease-in-out infinite alternate",
					rumble:                "display:inline-block;animation:harlowe-3-rumble linear 0.1s 0s infinite",
					shudder:               "display:inline-block;animation:harlowe-3-shudder linear 0.1s 0s infinite",
					sway:                  "display:inline-block;animation:harlowe-3-sway 5s linear 0s infinite",
					buoy:                  "display:inline-block;animation:harlowe-3-buoy 5s linear 0s infinite",
					fidget:                "display:inline-block;animation:harlowe-3-fidget 60s linear 0s infinite",
				};

				function model(m, elem) {
					const styles = Array.from(elem[$$]('[type=radio]:checked')).map(node => node.value).filter(e => e !== "none")
						.concat(Array.from(elem[$$]('[type=checkbox]:checked')).map(node => node.parentNode.textContent));
					m.changerNamed('text-style').push(...styles.map(stringify));
					m.valid = m.valid || styles.length > 0;
				}

				return folddownPanel({
					type: 'preview',
					text: 'Example text preview',
					update(model, panel) {
						panel.firstChild.setAttribute('style', "position:relative;" + model.changers['text-style'].map(name => previewStyles[parse(name)]).join(';'));
					},
				},{
					type: 'small',
					text: "This preview doesn't account for other modifications to this passage's text colour, font, or background, and is meant only for you to examine each of these styles.",
				},{
					type: 'checkboxes',
					name: 'Font variants',
					capitalise:true,
					bold:true,
					options: ["bold","italic","mark"],
					model,
				},{
					type: 'radios',
					name: 'Underlines and strikes',
					capitalise:true,
					bold:true,
					options: ["none", "underline","double-underline","wavy-underline","strike","double-strike","wavy-strike"],
					model,
				},{
					type: 'radios',
					name: 'Superscript and subscript',
					capitalise:true,
					bold:true,
					options: ["none", "superscript", "subscript"],
					model,
				},{
					type: 'radios',
					name: 'Outlines',
					capitalise:true,
					bold:true,
					options: ["none", "outline","shadow","emboss","blur","blurrier","smear"],
					model,
				},{
					type: 'radios',
					name: 'Letter spacing',
					capitalise:true,
					bold:true,
					options: ["none", "condense","expand"],
					model,
				},{
					type: 'radios',
					name: 'Flips',
					capitalise:true,
					bold:true,
					options: ["none", "mirror","upside-down"],
					model,
				},{
					type: 'radios',
					name: 'Animations',
					capitalise:true,
					bold:true,
					options: ["none", "blink", "fade-in-out","rumble","shudder","sway","buoy","fidget"],
					model,
				},
				remainderOfPassageCheckbox,
				confirmRow);
			})(),
		borders: (() => {
				function dropdownControls(orientation, index) {
					return [
						el(`<div><b>${orientation}</b></div>`),
						{
							type: 'inline-dropdown',
							text: 'Style:',
							options: ['none', '', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'],
							model(m, el) {
								const enabled = el[$]('select').value;
								m.changerNamed('b4r').push(stringify(enabled || "none"));
								/*
									This expando determines if the border is enabled.
								*/
								(m.borderEnabled = m.borderEnabled || [])[index] = !!enabled;
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
							/*
								Only show the border colour panel if this border is enabled.
							*/
							update(m, el) {
								el.setAttribute('style', !m.borderEnabled[index] ? "display:none" : '');
							},
							model(m, el) {
								const c = el[$]('[type=color]').value,
									a = el[$]('[type=range]').value;
								m.changerNamed('b4r-colour').push(toHarloweColour(c, a));
								m.borderColours = (m.borderColours || []).concat(toCSSColour(c, a));
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
							const changersObj = m.suppressedChangers || m.changers;
							panel.firstChild.setAttribute('style', `border-style:${
								changersObj.b4r ? changersObj.b4r.map(parse).join(' ') + ";" : ''
							}${
								/*
									Border-size is a multiplier on the default Harlowe border (2px).
								*/
								changersObj['b4r-size'] ? 'border-width:' + changersObj['b4r-size'].reduce((a,e) => `${a} ${e*2}px`,'') + ";" : ''
							}${
								changersObj['b4r-colour'] ? 'border-color:' + m.borderColours.join(' ') + ";" : ''
							}`);
						},
					},
					...dropdownControls("Top", 0), ...dropdownControls("Right", 1), ...dropdownControls("Bottom", 2), ...dropdownControls("Left", 3),
					{
						type: 'radios',
						name: 'Affect:',
						options: ["The attached hook", "The remainder of the passage or hook.", "The entire passage."],
						model(m, el) {
							const v = el[$]('input:checked');
							const index = Array.from(el[$$]('label')).indexOf(v.parentNode);

							if (index >= 2 && Object.keys(m.changers).length) {
								m.suppressedChangers = m.changers;
								m.changers = {};
							} else if (index === 1) {
								m.wrapStart = "[=\n";
								m.wrapEnd = "";
							}
						},
					},
					{
						type: 'confirm',
						model(m) {
							m.valid = true;
							/*
								Quickly check that each of the to-be-constructed changers' values differ from the default,
								and don't create them if not.
							*/
							const changersObj = m.suppressedChangers || m.changers;
							[['b4r', e => parse(e) === "none"], ['b4r-size', e => +e === 1], ['b4r-colour', e => e === "transparent"]].forEach(([name, test]) => {
								changersObj[name] = reduce4ValueProp(changersObj[name]);
								if (changersObj[name].every(test)) {
									delete changersObj[name];
									if (name === 'b4r') {
										m.valid = false;
									}
								}
							});
							if (m.valid && m.suppressedChangers) {
								m.wrapStart = "(enchant:?passage," + Object.entries(changersObj).map(([k,v]) => `(${k}:${v.join(',')})`).join('+') + ")";
								m.wrapEnd = "";
							}
						},
					}
				);
			})(),
		textcolor: folddownPanel({
				type: 'preview',
				text: 'Example text preview',
				update(model, panel) {
					const changers = model.suppressedChangers || model.changers;
					panel.firstChild.setAttribute('style', `${
						(changers['text-colour'] ? `color:${model.textColour};` : '')
					}${
						model.stops ? `background:linear-gradient(${model.angle}deg, ${
							model.stops.map(stop => stop.getAttribute('data-colour') + " " + (stop.getAttribute('data-pos')*100) + "%")
						})` : changers.background ? `background:${model.backgroundColour}` : ''
					}`);
				},
			},{
				type: 'small',
				text: "This preview doesn't account for other modifications to this passage's text colour or background, and is meant only for you to examine the selected colours.",
			},
			el(`<div><b>Text colour</b></div>`),
			{
				type: 'radiorows',
				name: 'txtcolor',
				options: [
					[{
						type:'inline-text',
						text:'Default text colour',
					}],
					[
						new Text(`Flat colour`),
						{
							type: 'colour',
							text: '',
							value: "#ffffff",
							model(m,el) {
								const c = el[$]('[type=color]').value,
									a = el[$]('[type=range]').value;
								m.changerNamed('text-colour').push(toHarloweColour(c, a));
								m.textColour = toCSSColour(c,a);
							},
						}
					],
				],
			},
			el(`<div><b>Background</b></div>`),
			{
				type: 'radiorows',
				name: 'bgcolor',
				options: [
					[{
						type:'inline-text',
						text:'Default background',
						model(m) {
							m.valid = true;
						},
					}],
					[
						new Text(`Flat colour`),
						{
							type: 'colour',
							text: '',
							value: '#000000',
							model(m, el) {
								const c = el[$]('[type=color]').value,
									a = el[$]('[type=range]').value;
								m.changerNamed('background').push(toHarloweColour(c, a));
								m.backgroundColour = toCSSColour(c, a);
								m.valid = true;
							},
						}
					],
					[
						new Text(`Linear gradient`),
						{
							type: 'gradient',
							model(m, el) {
								const stops = Array.from(el[$$]('.harlowe-3-colourStop')).sort((a,b) => a.getAttribute('data-pos') - b.getAttribute('data-pos'));
								if (stops.length > 1) {
									m.valid = true;
									m.changerNamed('background').push(`(gradient: $deg, ${
										stops.map(
											stop => fourDecimals(stop.getAttribute('data-pos')) + "," + (stop.getAttribute('data-harlowe-colour') || stop.getAttribute('data-colour'))
										)
									})`);
									m.stops = stops;
									m.angle = 0;
								}
							},
						},
						el('<br>'),
						{
							type: "inline-range",
							text: "Angle (deg):",
							value: 0,
							min: 0,
							max: 359,
							step: 1,
							model(m, elem) {
								if (m.valid) {
									const bg = m.changerNamed('background');
									m.angle = +elem[$]('input').value;
									bg[0] = bg[0].replace("$deg", m.angle);
								}
							},
						},
					]
				],
			},
			{
				type: 'radios',
				name: 'Affect:',
				options: ["The attached hook", "The remainder of the passage or hook.", "The entire passage.", "The entire page."],
				model(m, el) {
					const v = el[$]('input:checked');
					const index = Array.from(el[$$]('label')).indexOf(v.parentNode);

					const changers = Object.entries(m.changers);
					if (index >= 2 && changers.length) {
						m.wrapStart = "(enchant:?pa" + (index === 2 ? "ssa" : "") + "ge," + changers.map(([k,v]) => `(${k}:${v.join(',')})`).join('+') + ")";
						m.wrapEnd = "";
						m.suppressedChangers = m.changers;
						m.changers = {};
					} else if (index === 1) {
						m.wrapStart = "[=\n";
						m.wrapEnd = "";
					}
				},
			},
			confirmRow),
		/*
			The [[Link]] button's panel. This configures the link syntax, plus a (t8n-depart:) and/or (t8n-arrive:) macro to attach to it.
		*/
		passagelink: (() => {
				const passageT8nPreviews = () => [el('<br>'),{
					type: 'inline-dropdown',
					text: 'Departing passage transition: ',
					options: t8nNames,
					model(m, el) {
						const {value} = el[$]('select');
						if (value !== "") {
							m.changerNamed('t8n-depart').push(stringify(value));
						}
					},
				},{
					type: 'inline-dropdown',
					text: 'Arriving passage transition: ',
					options: t8nNames,
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
						const t8nName1 = "harlowe-3-" + t8nPreviewAnims[m.changers['t8n-depart'] ? parse(m.changers['t8n-depart'][0]) : "default"](true);
						const t8nName2 = "harlowe-3-" + t8nPreviewAnims[m.changers['t8n-arrive'] ? parse(m.changers['t8n-arrive'][0]) : "default"](false);
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
					type: 'radiorows',
					name: 'whichclick',
					options: [
						[{
							type: 'inline-textarea',
							text: "Create a hyperlink, with this text:",
							placeholder: "Link text (can\'t be empty)",
							useSelection: true,
							width: "50%",
							model(m, elem) {
								const text = elem[$]('input').value;
								if (text.length > 0) {
									m.linkText = text;
									m.valid = true;
								}
							},
						}],
						[{
							type: "inline-text",
							text: "Allow the entire page to be clicked.",
							model(m) {
								m.changerNamed('click').push('?page');
								m.clickPage = true;
								m.valid = true;
							},
						},
						{
							type: "text",
							text: "This will place a faint blue border around the edges of the page, and change the mouse cursor to the hand pointer, until it is clicked.",
						}]
					],
				},{
					type: "text",
					text: "<b>When it is clicked, perform this action:</b>",
				},{
					type: 'radiorows',
					name: 'passagelink',
					update(m, el) {
						// Disable the "cycling link" option if "click page" is selected...
						el.lastChild.firstChild[(m.clickPage ? "set" : "remove") + "Attribute"]('disabled','');
						// ...And deselect it if it's selected.
						if (m.clickPage && el.lastChild.firstChild.checked) {
							el.firstChild.firstChild.click();
						}
					},
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
								if ('click' in m.changers) {
									delete m.changers.click;
									m.wrapStart = "(click-goto:?page," + stringify(name) + ")";
									m.wrapEnd = "";
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
								if ('click' in m.changers) {
									m.wrapStart = "(click-undo:" + m.changers.click + ")";
									m.wrapEnd = "";
									delete m.changers.click;
								} else {
									m.changerNamed('link-undo').push(stringify(m.linkText));
									m.wrapStart = "";
									m.wrapEnd = "";
								}
							},
						}, ...passageT8nPreviews()],
						[{
							type: 'inline-dropdown',
							text: 'Reveal ',
							options: ["an attached hook.", "the remainder of the passage."],
							model(m, elem) {
								if (elem[$]('select').value) {
									m.wrapStart = "[=\n";
									m.wrapEnd = "";
								}
							}
						},
						el('<br>'),
						{
							type: "text",
							text: '(' + hookDescription + ')',
						},{
							type: 'inline-dropdown',
							text: 'Revealed text transition: ',
							options: t8nNames,
							model(m, el) {
								const {value} = el[$]('select');
								if (value !== "") {
									m.changerNamed('t8n').push(stringify(value));
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
							text2: "Revealed Text",
							update(m, el) {
								if (m.initiator && !["select","div","span"].some(e => e === m.initiator.tagName.toLowerCase())) {
									return;
								}
								const t8nName = "harlowe-3-" + t8nPreviewAnims[m.changers.t8n ? parse(m.changers.t8n[0]) : "default"](false);
								const t8nTime = m.changers['t8n-time'] ? m.changers['t8n-time'][0] : "0.8s";

								const span = el.lastChild;
								span.setAttribute('style', `animation:${t8nName} ${t8nTime} 1;`);
								/*
									Flicker the <span> to trigger a restart of the animation.
								*/
								span.remove();
								setTimeout(() => el.append(span));
							},
						},{
							type: 'radiorows',
							name: 'linkReveal',
							update(m, el) {
								el[$$]('input').forEach(e=> e[(m.clickPage ? "set" : "remove") + "Attribute"]("disabled",''));
							},
							options: [
								[{
									type: "inline-text",
									text: "Then remove the link's own text.",
									model(m) {
										if (!m.clickPage) {
											m.changerNamed('link').push(stringify(m.linkText));
										}
									},
								}],
								[{
									type: "inline-text",
									text: "Then unlink the link's own text.",
									model(m){
										if (!m.clickPage) {
											m.changerNamed('link-reveal').push(stringify(m.linkText));
										}
									},
								}],
								[{
									type: "inline-text",
									text: "Re-run the hook each time the link is clicked.",
									model(m){
										if (!m.clickPage) {
											m.changerNamed('link-rerun').push(stringify(m.linkText));
										}
									},
								}],
								[{
									type: "inline-text",
									text: "Repeat the hook each time the link is clicked.",
									model(m){
										if (!m.clickPage) {
											m.changerNamed('link-repeat').push(stringify(m.linkText));
										}
									},
								}],
							],
						}],
						[{
							type: 'inline-text',
							text: "Cycle the link's text to the next alternative in a list.",
						},
						el('<br>'),
						{
							type: 'textarea-rows',
							nonZeroRows: true,
							placeholder: 'Link text (can\'t be empty)',
							model(m, el) {
								const els = [m.linkText].concat(Array.from(el[$$]('input')).map(el => el.value));
								if (!m.clickPage && els.every(Boolean)) {
									m.wrapStart = `(cycling-link:${
										els.map(e => JSON.stringify(e))
									})`;
									m.wrapEnd = '';
									m.innerText = '';
								}
								else if (el.parentNode.firstChild.checked) {
									m.valid = false;
								}
							},
						},{
							type: 'radios',
							name: 'Upon reaching the end:',
							options: ["Loop to the start.", "Remove the link.", "Unlink the link."],
							model(m, el) {
								if (!m.valid) {
									return;
								}
								const {value} = el[$]('[type=radio]:checked');
								if (value[0] === "U") {
									m.wrapStart = m.wrapStart.replace(/^\(cycling/, '(seq');
								}
								else if (value[0] === "R") {
									m.wrapStart = m.wrapStart.replace(/\)$/,',"")');
								}
							},
						}],
					],
				},
				confirmRow);
			})(),
		if: folddownPanel({
				type: 'text',
				text: '<b>Only show a section of the passage if this condition is met:</b>',
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
									// Replace "% 2 is 0" with "is an even"
									ifArgs[0] = ifArgs[0].replace(" % 2 is 0", " is an even");
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
								m.changerNamed('after').push(`${elem[$]('input').value}s`);
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
									// Replace "% 2 is 0" with "is even"
									ifArgs[0] = ifArgs[0].replace(" % 2 is 0", " is even");
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
									// Replace "% 2 is 0" with "is even"
									ifArgs[0] = ifArgs[0].replace(" % 2 is 0", " is even");
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
					],[
						/*
							The variable [___] [equals] this expression [______]
						*/
						{
							type: "inline-dropdown",
							text: 'The variable ',
							options: ["$", "_"],
							model(m, elem) {
								m.variable = elem[$]('select').value ? "_" : "$";
							},
						},{
							type: "inline-textarea",
							width:"25%",
							text: "",
							placeholder: "Variable name",
							model(m, elem) {
								const v = elem[$]('input').value;
								if (v) {
									if (RegExp("^" + Patterns.validPropertyName + "$").exec(v) && !RegExp(/^\d/).exec(v)) {
										m.variable += v;
									}
								}
							},
						},{
							type: 'inline-dropdown',
							text: '',
							options: ["is", "is not", "is greater than", "is less than", "contains", "is in"],
							model(m, elem) {
								const v = elem[$]('select').value;
								m.operator = {
									"is greater than": ">",
									"is less than": "<",
									"": "is",
								}[v] || v;
							},
						},
						new Text("a certain data value."), el('<br>'),
						dataValueRow(),
						{
							type: 'text',
							text: '',
							model(m) {
								if (m.expression !== undefined && m.expression !== '' && m.operator && m.variable && !m.invalidSubrow) {
									m.changerNamed('if').push(`${m.variable} ${m.operator} ${m.expression}`);
									m.valid = true;
								}
							}
						}
					],
				],
			},{
				type: 'checkbox',
				text: `Also, only if the previous (if:), (else-if:) or (unless:) hook's condition wasn't fulfilled.`,
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
			},
			remainderOfPassageCheckbox,
			confirmRow),
		hook: folddownPanel({
				type: 'text',
				text: hookDescription + ` The main purpose of hooks is that they can be visually or textually altered by special data values called <b>changers</b>. Changers are usually placed in front of hooks to change them.`,
				model(m) {
					m.wrapStart = "[";
					m.wrapEnd = "]";
					m.valid = true;
				},
			},{
				type: "textarea",
				width:"25%",
				text: "Hook name (letters, numbers and underscores only):",
				placeholder: "Hook name",
				model(m, elem) {
					const v = elem[$]('input').value;
					if (v) {
						if (RegExp("^" + Patterns.validPropertyName + "$").exec(v)) {
							m.wrapStart = "|" + v + ">[";
							m.hookName = v;
						}
						else {
							m.valid = false;
						}
					}
				},
			},{
				type: 'text',
				text: "",
				update(m, elem) {
					const name = (m.hookName || '').toLowerCase();
					if (name) {
						if (['link','page','passage','sidebar'].includes(name)) {
							elem.innerHTML = `The hook name <b><code>?${name}</code></b> is <b>reserved</b> by Harlowe. It refers to <b>${
								name === 'link' ? "all of the links in the passage" :
								name === 'page' ? "the entire HTML page" :
								name === "passage" ? "the element that contains the current passage's text" :
								name === "sidebar" ? "the passage's sidebar, containing the undo/redo icons" :
								"unknown"
							}</b>.`;
						}
						else {
							elem.innerHTML = `You can refer to this hook (and every other one with this name) using the code <b><code>?${name}</code></b>.`;
						}
					}
					else {
						elem.innerHTML = `Hook names are optional, but giving a hook a nametag allows it to be remotely altered using macros like <code>(click:)</code>, <code>(replace:)</code>, or <code>(enchant:)</code>. `
							+ `You can use these macros elsewhere in the passage, keeping your prose uncluttered.`;
					}
				},
			},
			confirmRow),
		align: folddownPanel({
				type: 'preview',
				text: 'You can apply left, center and right alignment to your passage text, as well as adjust the margins and width.',
				update(m, elem) {
					elem.setAttribute("style", "width:100%;height:6em;overflow-y:hidden;");
					let style = `width:${m.width*100}%;margin-left:${m.left*100}%;margin-right:${m.right*100}%;`;
					if (m.align !== "center") {
						style += "text-align:" + m.align + ';';
					}
					elem.firstChild.setAttribute('style', "display:block;" + style);
				},
			},{
				type: "inline-range",
				text: "Placement: ",
				value: 0,
				min: 0,
				max: 10,
				step: 1,
				model(m, elem) {
					m.placement = elem[$]('input').value/10;
				},
			},{
				type: "inline-range",
				text: "Width: ",
				value: 5,
				min: 1,
				max: 10,
				step: 1,
				model(m, elem) {
					m.width = elem[$]('input').value/10;
					const area = 1 - m.width;
					m.left = area * m.placement;
					m.right = area * (1-m.placement);
				},
			},{
				type: 'radios',
				name: 'Alignment',
				capitalise: true,
				options: ["left", "center", "justify", "right"],
				model(m, el) {
					m.align = el[$]('input:checked').value;
				},
			},{
				type: 'checkbox',
				text: 'Affect the entire remainder of the passage',
				model(m, el) {
					const remainder = !!el[$](':checked');

					/*
						If it's possible to reduce this specific alignment configuration to just the basic aligner markup, do so.
					*/
					if (m.width === (m.align === "center" ? 0.5 : 1) && (!m.left || !m.right) === (m.align !== "center" && m.align !== "justify")) {
						const left = round(m.left*10),
							right = round(m.right*10),
							gcd = GCD(left, right),
							aligner =
								(m.align === "left") ? "<==" :
								(m.align === "right") ? "==>" :
								"=".repeat(left/gcd) + (left ? ">" : "") + (right ? "<" : "") + "=".repeat(right/gcd);

						if (remainder) {
							m.wrapStart = aligner + "\n";
							m.wrapEnd = '';
						} else {
							m.changerNamed('align').push(stringify(aligner));
						}
					} else {
						const left = round(m.left*100),
							width = round(m.width*100),
							right = round(m.right*100),
							gcd = GCD(width, GCD(left, right));

						m.changerNamed('align').push(stringify(m.align === "left" ? "<==" : m.align === "right" ? "==>" : m.align === "justify" ? "<==>" : "=><="));
						m.changerNamed('box').push(stringify("=".repeat(left/gcd) + "X".repeat(width/gcd) + "=".repeat(right/gcd)));

						if (remainder) {
							m.wrapStart = "[=\n";
							m.wrapEnd = "";
						}
					}
					m.valid = true;
				},
			},
			confirmRow),

		rotate: folddownPanel({
				type: 'preview',
				text: 'Rotated text preview',
				update(model, panel) {
					panel.setAttribute('style', "height:6em;");
					const span = panel[$]('span');
					const { changers:c } = model, rx = c['text-rotate-x'], ry = c['text-rotate-y'], rz = c['text-rotate-z'];
					let style = 'margin-top:2em;transform:';
					if (rx || ry) {
						style += 'perspective(50vw) ';
					}
					if (rx) {
						style += `rotateX(${rx}deg) `;
					}
					if (ry) {
						style += `rotateY(${ry}deg) `;
					}
					if (rz) {
						style += `rotateZ(${rz}deg)`;
					}
					span.setAttribute('style', style);
				},
			},{
				type: "range",
				text: "Rotation (X axis):",
				value: 0,
				min: 0,
				max: 359,
				step: 1,
				model(m, elem) {
					const {value} = elem[$]('input');
					if (+value) {
						m.changerNamed('text-rotate-x').push(value);
						m.valid = true;
					}
				},
			},{
				type: "range",
				text: "Rotation (Y axis):",
				value: 0,
				min: 0,
				max: 359,
				step: 1,
				model(m, elem) {
					const {value} = elem[$]('input');
					if (+value) {
						m.changerNamed('text-rotate-y').push(value);
						m.valid = true;
					}
				},
			},{
				type: "range",
				text: "Rotation (Z axis):",
				value: 0,
				min: 0,
				max: 359,
				step: 1,
				model(m, elem) {
					const {value} = elem[$]('input');
					if (+value) {
						m.changerNamed('text-rotate-z').push(value);
						m.valid = true;
					}
				},
			},
			remainderOfPassageCheckbox,
			confirmRow),

		columns: folddownPanel({
				type: 'preview',
				text: 'Use columns to lay out two or more spans of prose alongside each other. Each column has its own margins and can occupy a different amount of horizontal space.',
				update(model, panel) {
					panel.setAttribute('style', "width:90%;display:flex;justify-content:space-between;height:5em;overflow-y:hidden;");
					const columns = (model.columns || []);
					const spans = Array.from(panel[$$]('span'));

					for (let i = 0; i < Math.max(columns.length, spans.length); i += 1) {
						/*
							Remove excess columns and add missing columns.
						*/
						if (i >= columns.length) {
							spans[i].remove();
						}
						else if (i >= spans.length) {
							panel.append(el('<span>' + spans[0].textContent + '</span>'));
						}
					}
					const totalWidth = columns.reduce((a,e) => a + e.width, 0);
					Array.from(panel[$$]('span')).forEach((span,i) =>
						span.setAttribute('style',`position:relative; font-size:50%; width:${columns[i].width/totalWidth*100}%;margin-left:${columns[i].left}em;margin-right:${columns[i].right}em`)
					);
				},
			},{
				type: "inline-dropdown",
				text: 'Columns:',
				options: ["1", "2", "3", "4", "5", "6"],
				model(m, elem) {
					m.columns = [...Array(+elem[$]('select').value || 1)].map(() => ({ left: 1, width:1, right: 1 }));
					m.wrapStart = '';
					m.innerText = '';
					m.wrapEnd = m.columns.length > 1 ? "\n|==|" : '';
					m.valid = true;
				},
				update(m, elem) {
					/*
						This crude function hides all of the unavailable columns' margin and width inputs.
					*/
					Array.from(elem.parentNode[$$](`.harlowe-3-labeledInput`)).forEach(el => el.removeAttribute('style'));
					Array.from(elem.parentNode[$$](`p:nth-of-type(${m.columns.length}) ~ .harlowe-3-labeledInput`)).forEach(el => el.setAttribute('style','display:none'));
				},
			},
			el('<br>'),
			...[0,1,2,3,4,5].reduce((a,n) => a.concat({
					type: 'inline-number',
					text: `Column ${n + 1} left margin:`,
					value: 1,
					min: 0,
					max: 9,
					step: 1,
					model(m, el) {
						if (m.columns[n]) {
							m.columns[n].left = +el[$]('input').value;
						}
					},
				},{
					type: 'inline-number',
					text: `Width:`,
					value: 1,
					min: 1,
					max: 9,
					step: 1,
					model(m, el) {
						if (m.columns[n]) {
							m.columns[n].width = +el[$]('input').value;
						}
					},
				},{
					type: 'inline-number',
					text: `Right margin:`,
					value: 1,
					min: 0,
					max: 9,
					step: 1,
					model(m, el) {
						const col = m.columns[n];
						if (col) {
							col.right = +el[$]('input').value;
							m.wrapStart += `\n${'='.repeat(col.left)}${'|'.repeat(col.width)}${'='.repeat(col.right)}\nColumn ${n+1}`;
						}
					},
				},
				el('<p>')
			),[]),
			confirmRow),

		collapse: folddownPanel({
				type: 'inline-dropdown',
				text: 'Collapse the whitespace within ',
				options: ["a section of the passage.", "the remainder of the passage."],
				model(m, elem) {
					if (elem[$]('select').value) {
						m.wrapStart = "{=\n";
						m.wrapEnd = "";
					} else {
						m.wrapStart = "{";
						m.wrapEnd = "}";
					}
					m.valid = true;
				}
			},
			{
				type:'text',
				text: "The <b>collapsing markup</b> hides line breaks and reduces sequences of consecutive spaces to just a single space.",
			},
			{
				type:'text',
				text: "If you wish to include whitespace that's exempt from this, you may include <b>HTML &lt;br&gt; tags</b>, or use the verbatim (Vb) markup.",
			},
			confirmRow),

		basicValue:  folddownPanel({
				type: 'text',
				text: 'Use <b>variables</b> to store <b>data values</b>, either across your story or within a passage.<br>'
					+ "That data can then be used in the passage, or in other macro calls, by using the variable's name in place of that value."
			},{
				type: "textarea",
				width:"25%",
				text: "Variable name (letters, numbers and underscores only):",
				placeholder: "Variable name",
				model(m, elem) {
					const v = elem[$]('input').value;
					if (v) {
						if (RegExp("^" + Patterns.validPropertyName + "$").exec(v) && !RegExp(/^\d/).exec(v)) {
							m.variableName = v;
						}
					}
				},
			}, dataValueRow(), {
				type: "checkbox",
				text: "Temp variable (the variable only exists in this passage and hook).",
				model(m, elem) {
					m.sigil = elem[$]('input').checked ? "_" : "$";

					/*
						Perform the main (set:) construction here.
					*/
					if (m.variableName && m.expression && !m.invalidSubrow) {
						m.wrapStart = `(set: ${m.sigil}${m.variableName} to ${m.expression})`;
						m.wrapEnd = m.innerText = '';
						m.valid = true;
					} else {
						m.valid = false;
					}
				},
			},{
				type: 'text',
				text: '',
				update(m, elem) {
					const code = m.valid ? `${m.sigil}${m.variableName}` : '';
					elem.innerHTML = m.valid
						? `<p>You can refer to this variable using the code <b><code>${code}</code></b>.</p>`
						+ "<p>Some types of data values (arrays, datamaps, datasets, strings, colours, gradients, custom macros, and typedvars) are storage containers for other values.<br>"
						+ `You can access a specific value stored in them using that value's <b>data name</b> (or a string or number value in brackets) by writing <b><code>${code}'s</code></b> <i>name</i>, or <i>name</i> <b><code>of ${code}</code></b>.</p>`
						+ `<p>(If you want to display that stored value in the passage, you'll need to give it to a macro, such as <code>(print: ${code}'s </code> <i>name</i><code>)</code>.)</p>`
						: '';
				},
			},
			confirmRow),

		/*
			When bound to a variable, most all of these use 2bind, because that binding more closely fits intuitions about how bindings "should" work.
		*/
		input: folddownPanel({
				type: 'radiorows',
				name: 'inputelement',
				options: [
					[
						new Text("Create a text input box."),
						el('<br>'),
						{
							type: 'preview',
							tagName: 'textarea',
							text: 'You can type sample text into this preview box.',
							update(m, elem) {
								elem.setAttribute("style", "width:100%;height:6em;");
								elem.firstChild.setAttribute('style',
									"display:block;resize:none;font-family:Georgia,serif;border-style:solid;border-color:#fff;color:#fff;"
									+ `width:${m.width*100}%;margin-left:${m.left*100}%;margin-right:${m.right*100}%;`
								);
								elem.firstChild.setAttribute('rows', m.rows || 3);
							},
							model(m) {
								m.wrapStart = m => {
									const left = round(m.left*100),
										width = round(m.width*100),
										right = round(m.right*100),
										gcd = GCD(width, GCD(left, right));

									return `(${'forcedText' in m ? 'force-' : ''}input-box:${
										m.variable ? `2bind ${m.variable},` : ''
									}${
										stringify("=".repeat(left/gcd) + "X".repeat(width/gcd) + "=".repeat(right/gcd))
									}${
										m.rows !== 3 ? "," + m.rows : ''
									}${
										'forcedText' in m ? "," + stringify(m.forcedText) :
										m.initialText ? "," + stringify(m.initialText) : ''
									})`;
								};
								m.wrapEnd = m.innerText = '';
								m.valid = true;
							},
						},{
							type: "inline-range",
							text: "Placement: ",
							value: 5,
							min: 0,
							max: 10,
							step: 1,
							model(m, elem) {
								m.placement = elem[$]('input').value/10;
							},
						},{
							type: "inline-range",
							text: "Width: ",
							value: 5,
							min: 1,
							max: 10,
							step: 1,
							model(m, elem) {
								m.width = elem[$]('input').value/10;
								const area = 1 - m.width;
								m.left = area * m.placement;
								m.right = area * (1-m.placement);
							},
						},{
							type: 'inline-number',
							text: 'Rows:',
							value: 3,
							min: 1,
							max: 9,
							step: 1,
							model(m, el) {
								m.rows = +el[$]('input').value;
							},
						},{
							type: 'radiorows',
							name: 'inputboxtype',
							options: [
								[{
									type: "inline-textarea",
									width:"50%",
									text: "The box initially contains this text:",
									placeholder: "Initial text",
									model(m, elem) {
										m.initialText = elem[$]('input').value || '';
									},
								}],
								[{
									type: "inline-textarea",
									width:"50%",
									text: "Force the player to type this text:",
									placeholder: "Text to display",
									model(m, elem) {
										m.forcedText = elem[$]('input').value || '';
									},
								},
								el('<div>Instead of being a normal input box, this will instead slowly write the above text into the box as the player presses keys.</div>')],
							],
						},
					],[
						new Text("Create a dropdown menu."),
						el('<br>'),
						{
							type: 'inline-text',
							text: "Dropdown options (leave blank to make a separator):",
						},{
							type: 'textarea-rows',
							nonZeroRows: true,
							placeholder: "Option text (leave blank to make a separator)",
							model(m, el) {
								const els = Array.from(el[$$]('input')).map(el => el.value);
								if (els.some(Boolean)) {
									m.wrapStart = m => `(dropdown: ${m.variable ? `2bind ${m.variable},` : ''}${els.map(e => stringify(e))})`;
									m.wrapEnd = m.innerText = '';
									m.valid = true;
								}
							},
						},
					],[
						new Text("Create a checkbox."),
						el('<br>'),
						{
							type: "inline-textarea",
							width:"50%",
							text: "Checkbox label:",
							placeholder: "Label text",
							model(m, elem) {
								const labelText = elem[$]('input').value || '';
								if (labelText) {
									m.wrapStart = m => `(checkbox: ${m.variable ? `2bind ${m.variable},` : ''}${stringify(labelText)})`;
									m.wrapEnd = m.innerText = '';
									m.valid = true;
								}
								m.needsVariable = true;
							},
						},
					],[
						new Text("Show a dialog box."),
						el('<br>'),
						el("<div>This dialog box will appear as soon as the macro is displayed. This is best used inside a hook that's only shown if a condition is met.</div>"),
						{
							type: "textarea",
							width:"80%",
							text: "Text:",
							placeholder: "Your text here",
							model(m, elem) {
								const text = elem[$]('input').value || '';
								m.wrapStart = m => `(dialog: ${m.variable ? `bind ${m.variable},` : ''}${stringify(text)}, ${m.links.map(e => stringify(e))})`;
								m.wrapEnd = m.innerText = '';
							},
						},{
							type: 'inline-text',
							text: "Link options:",
						},{
							type: 'textarea-rows',
							nonZeroRows: true,
							placeholder: "Link text (can't be blank)",
							model(m, el) {
								const els = Array.from(el[$$]('input')).map(el => el.value);
								if (els.every(Boolean)) {
									m.links = els;
									m.valid = true;
								}
							},
						},
					],
				],
			},{
				type:'checkboxrow',
				text:'',
				update(m, elem) {
					const input = elem[$]('input');
					if (m.needsVariable) {
						input.setAttribute('disabled', true);
						input.checked = true;
					} else {
						input.removeAttribute('disabled', true);
					}
				},
				model(m, elem) {
					if (m.needsVariable && !elem[$]('input:checked')) {
						m.valid = false;
					}
				},
				subrow: [{
					type: "inline-dropdown",
					text: 'Bind this input element to the variable',
					options: ["$", "_"],
					model(m, elem) {
						m.variable = elem[$]('select').value ? "_" : "$";
					},
				},{
					type: "inline-textarea",
					width:"25%",
					text: "",
					placeholder: "Variable name",
					model(m, elem) {
						const v = elem[$]('input').value;
						if (v) {
							if (RegExp("^" + Patterns.validPropertyName + "$").exec(v) && !RegExp(/^\d/).exec(v)) {
								m.variable += v;
								return;
							}
						}
						m.valid = false;
					},
				}],
			},
			confirmRow),

		macro: folddownPanel({
				type: 'text',
				text: '<b>Macros</b> are code used for programming and styling your story. The vast majority of Harlowe\'s features are available through macros.'
					+ '<br>All of the built-in Harlowe macros are listed here. For more details, click their signatures to open the documentation.',
			},{
				type: 'macro-list',
				model(m, el) {
					const selected = el[$]('input:checked');
					if (selected) {
						m.wrapStart = "(" + selected.value + ":";
						m.wrapEnd = ")";
						m.innerText = "Your Code Here";
						m.valid = true;
					}
				},
			},
			confirmRow),

		default: folddownPanel(
			{
				type: 'buttons',
				buttons: [
					{ title:'Bold',                    html:fontIcon('bold'),         onClick: () => wrapSelection("''","''")},
					{ title:'Italic',                  html:fontIcon('italic'),       onClick: () => wrapSelection("//","//")},
					{ title:'Strikethrough',           html:fontIcon('strikethrough'),onClick: () => wrapSelection("~~","~~")},
					{ title:'Superscript',             html:fontIcon('superscript'),  onClick: () => wrapSelection("^^","^^")},
					{ title:'Text and background colour', html:`<div class='harlowe-3-bgColourButton'>`, onClick: () => switchPanel('textcolor')},
					{
						title:'Borders',
						html:'<span style="display:inline-block; height:16px; width:16px; border-style: dotted solid solid dotted; border-size:3px;"></span>',
						onClick: () => switchPanel('borders'),
					},
					{ title:'Rotated text',            html: '<div style="transform:rotate(-30deg);font-family:serif;font-weight:bold">R</div>', onClick: () => switchPanel('rotate')},
					{ title:'Special text style',      html:'Styles…',                    onClick: () => switchPanel('textstyle')},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Heading',                 html:fontIcon('header'),           onClick: () => wrapSelection("\n#","")},
					{ title:'Bulleted list item',      html:fontIcon('list-ul'),          onClick: () => wrapSelection("\n* ","")},
					{ title:'Numbered list item',      html:fontIcon('list-ol'),          onClick: () => wrapSelection("\n0. ","")},
					{ title:'Horizontal rule',         html:'<b>—</b>',                   onClick: () => wrapSelection("\n---\n","")},
					{ title:'Alignment',               html:fontIcon('align-right'),      onClick: () => switchPanel('align')},
					{ title:'Columns',                 html:fontIcon('columns'),          onClick: () => switchPanel('columns')},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Collapse whitespace (at runtime)', html:'<b>{}</b>',         onClick: () => switchPanel('collapse')},
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
					{ title:'Link element',            html:'Link…',                          onClick: () => switchPanel('passagelink')},
					{ title:'Only show a portion of text if a condition is met', html:'If…',  onClick: () => switchPanel('if')},
					{ title:'Input element',           html:'Input…',                         onClick: () => switchPanel('input')},
					{ title:'Hook (named section of the passage)',      html:'Hook…',         onClick: () => switchPanel('hook')},
					{ title:'Set a variable with a data value',         html:'Var…',          onClick: () => switchPanel('basicValue')},
					{ title:'Peruse a list of all built-in macros',     html:'Macro…',        onClick: () => switchPanel('macro')},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Proofreading view (dim all code except strings)',
						html:fontIcon('eye'),
						onClick: ({target}) => {
							toolbarElem.classList.toggle('harlowe-3-hideCode');
							if (target.tagName.toLowerCase() === "i") {
								target = target.parentNode;
							}
							target.classList.toggle('active');
						},
					},
					{ title:'Coding tooltips (show a tooltip when the cursor rests on code structures)',
						html: fontIcon('comment'),
						active: true,
						onClick: ({target}) => {
							toolbarElem.classList.toggle('harlowe-3-hideTooltip');
							if (target.tagName.toLowerCase() === "i") {
								target = target.parentNode;
							}
							target.classList.toggle('active');
						},
					},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Open the Harlowe documentation',
						html: fontIcon('question'),
						onClick: () => window.open(`https://twine2.neocities.org/`, "Harlowe Documentation", 'noopener,noreferrer')
					},
					(() => {
						const button = el('<button style="position:absolute;right:1em;margin-top:-2em">' + fontIcon('chevron-up') + "</button>");
						button.addEventListener('click', () => {
							toolbarElem.classList.toggle('harlowe-3-minimised');
							const list = button.firstChild.classList;
							list.toggle('fa-chevron-down');
							list.toggle('fa-chevron-up');
						});
						return button;
					})(),
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
		({Markup:{lex}, Patterns, ShortDefs} = this.modules);
		this.modules.Toolbar = Toolbar;
	}
}.call(eval('this')));
