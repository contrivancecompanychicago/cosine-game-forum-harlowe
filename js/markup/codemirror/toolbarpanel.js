	/*jshint strict:true*/
(function() {
	'use strict';
	const {stringify} = JSON;

	let lex, Patterns, Utils = {}, ToolbarPanel = {};

	// this.loaded implies TwineJS 2.3.
	if (this && this.loaded) {
		({Markup:{lex}, Patterns, Utils} = this.modules);
	}
	// This can't be loaded in HarloweDocs.
	else if (!this.window) {
		({Markup:{lex}, Patterns, Utils} = this);
	}
	else {
		return;
	}
	const {twine23, builtinColourNames, buttonClass, toHarloweColour, toCSSColour, el, fontIcon} = Utils;

	const $ = 'querySelector';
	const $$ = $ + 'All';
	const ON = "addEventListener";
	const OFF = "removeEventListener";

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

	const disabledButtonCSS = 'background:hsl(0,0%,50%,0.5);opacity:0.5;pointer-events:none';

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
		if (!panelRows.length) {
			return;
		}
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
		const panelElem = el(`<div class="harlowe-3-toolbarPanel${!twine23 ? ' card floating' : ''}" style="transition:max-height 0.8s;overflow-y:auto">`);

		const makeColourPicker = value => {
			const makeSwatchRow = (colours, index, visible) =>
				el(`<span class=harlowe-3-swatchRow data-index="${index}" ${!visible ? 'style="display:none"' : ''}>`
					+ colours.map(colour =>
						'<span class=harlowe-3-swatch style="background-color:' + colour + '"></span>').join('')
					+ "</span>");

			const ret = el('<div class=harlowe-3-singleColourPicker><input style="width:48px;margin-right:8px" type=color value="'
				+ value + '"></div>');
			const swatchSelectWrapper = el(`<span class="text-select-control"><select ${!twine23 ? `style="max-width: 9em;"` : ''}><option value="" selected>Harlowe built-ins</option></select></span>`);
			const swatchSelect = swatchSelectWrapper[$]('select');
			ret.append(makeSwatchRow(Object.keys(builtinColourNames), '', true));
			openColors.forEach((row,i) => {
				ret.append(makeSwatchRow(row, i));
				swatchSelect.append(el(`<option value=${i}>OpenColor ${i}</option>`));
			});
			swatchSelect[ON]('change', () => {
				ret[$$](`[data-index]`).forEach(ind => ind.style.display = 'none');
				ret[$](`[data-index="${swatchSelect.value}"]`).style.display = "inline-block";
			});
			ret.append(swatchSelectWrapper, el('<br>'), new Text(`Opacity: `), el(`<input type=range style="width:64px;top:8px;position:relative" value=1 min=0 max=1 step=0.05>`));

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
				Used only for the default panel and the Find panel.
			*/
			if (type === "buttons") {
				panelElem.append(...row.buttons.map(button => {
					if ('tagName' in button) {
						return button;
					}
					const elem = el(`<button title="${button.title}" class="${buttonClass()}${button.active ? ' active' : ''}">${button.html}</button>`);
					button.onClick && elem[ON]('click', button.onClick);
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
			if (type.endsWith("checkbox") || type.endsWith("checkboxrow")) {
				ret = el(`<label${inline ? '' : ' style="display:block"'} class="harlowe-3-checkboxRow"><input type="checkbox"></input>${row.text}</label>`);
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
				ret = el(`<div class="harlowe-3-toolbarCheckboxes"><div${row.bold ? ' style="font-weight:bold"' :''}>${row.name}</div></div>`);
				row.options.forEach(box => {
					const e = el(`<label${row.capitalise ? ' style="text-transform:capitalize;"' : ''} class="${buttonClass()}"><input type="checkbox"></input>${box}</label>`);
					e[ON]('change', update);
					ret.append(e);
				});
			}
			if (type === "radios") {
				ret = el(`<div class="harlowe-3-toolbarCheckboxes"><div${row.bold ? ' style="font-weight:bold"':''}>${row.name}</div></div>`);
				row.options.forEach((radio,i) => {
					const e = el(`<label${row.capitalise ? ' style="text-transform:capitalize;"' : ''} class="${buttonClass()}"><input type="radio" name="${row.name}" value="${radio}" ${!i ? 'checked' : ''}></input>${radio}</label>`);
					e[ON]('change', update);
					ret.append(e);
				});
			}
			/*
				Text areas, single lines in which text can be entered.
			*/
			if (type.endsWith("textarea")) {
				let inputType = 'text';
				const tagName = row.multiline ? 'textarea' : 'input';
				/*
					Full Harlowe expressions.
				*/
				if (type.endsWith("expression-textarea")) {
					/*
						These have special update and model routines.
					*/
					row.update = (m, elem) => {
						if (!m.expression && elem[$](tagName).value) {
							elem.setAttribute('invalid', `This doesn't seem to be valid code.`);
						}
						else {
							elem.removeAttribute('invalid');
						}
					};
					row.model = (m, elem) => {
						const v = (elem[$](tagName).value || '').trim();
						if (v) {
							/*
								Attempt to lex the data, and consider it invalid if it contains any text nodes.
							*/
							const lexed = lex(v, '', 'macro');
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
						row.modelCallback(m, JSON.stringify(elem[$](tagName).value || ''));
					});
				}
				if (type.endsWith("number-textarea")) {
					inputType = 'number';
					row.model || (row.model = (m, elem) => {
						row.modelCallback(m, +elem[$](tagName).value || 0);
					});
				}
				ret = el(`<${inline ? 'span' : 'div'} class="harlowe-3-labeledInput">${
						row.text
					}<${tagName} ${row.useSelection ? 'data-use-selection' : ''}${type.includes('passage') ? 'list="harlowe-3-passages"' : ''} style="width:${row.width};padding:var(--grid-size);margin${
						inline ? ':0 0.5rem' : '-left:1rem'
					};${row.multiline && inline ? 'display:inline-block;height:40px':''}" type=${inputType} placeholder="${row.placeholder || ''}"></${tagName}></${inline ? 'span' : 'div'}>`);
				ret[$](tagName)[ON]('input', update);
			}
			if (type.endsWith("number") || type.endsWith("range")) {
				ret = el('<' + (inline ? 'span' : 'div') + ' class="harlowe-3-labeledInput">'
					+ row.text
					+ '<input style="padding:var(--grid-size);' + (row.width ? `width:${row.width}` : '') + '" type=' + (type.endsWith("range") ? "range" : "number")
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
				ret = el(`<div style='position:relative'><span class=harlowe-3-gradientBar></span><button class="${buttonClass()}">${fontIcon('plus')} Colour</button></div>`);
				const gradientBar = ret[$]('.harlowe-3-gradientBar');
				const createColourStop = (percent, colour, selected) =>  {
					const ret = el(
						`<div ${selected ? 'selected' : ''} data-colour="${
							colour
						}" data-pos="${percent}" class=harlowe-3-colourStop style="left:calc(${
							percent * 100
						}% - 8px); top:-8px"><div class=harlowe-3-colourStopButtons style="left:${-(twine23 ? 464 : 384)*percent - (twine23 ? 0 : 40)}px">`
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
					const deleteButton = el(`<button class="${buttonClass()}" style='float:right'>${fontIcon('times')} Delete</button>`);
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
							target.firstChild.style.left = `${-(twine23 ? 464 : 384)*pos - (twine23 ? 0 : 40)}px`;
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
				const dropdownDiv = el('<' + (inline ? 'span' : 'div') + ' style="white-space:nowrap;' + (inline ? '' : 'width:50%;') + 'position:relative;">'
					+ row.text
					+ '<span class="text-select-control"><select style="' + (inline ? 'margin:0.5rem;' : 'margin-left:1rem;') + 'font-size:0.9rem;margin-top:4px"></select></span></' + (inline ? 'span' : 'div') + '>');
				row.options.forEach((option,i) => {
					dropdownDiv[$]('select').append(el('<option value="' + (!i ? '' : option) + '"' + (!option ? ' disabled' : !i ? ' selected' : '') + '>' + (option || '───────') + '</select>'));
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
				const categorySelectorWrapper = el(`<span class='text-select-control'><select></span>`);
				ret.firstChild.append(categorySelectorWrapper);
				const categorySelector = categorySelectorWrapper[$]('select');
				const scrollBox = el(`<div style="margin-top:8px;border-top:1px solid hsla(0,0%,50%,0.5);max-height:40vh;overflow-y:scroll">`);
				ret.append(scrollBox);
				categorySelector[ON]('change', () => {
					const el = scrollBox[$](`[name="${categorySelector.value}"]`);
					el && el.scrollIntoView();
				});
				Object.values(Utils.ShortDefs.Macro)
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
					}</span><span class="text-select-control"><select style="font-size:1rem;margin-top:4px;${
						row.width ? `width:${row.width};text-overflow:ellipsis` : ''
					}"></select></span><span class="harlowe-3-dropdownRows"></span></${inline ? 'span' : 'div'}>`);
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
					const line = el(`<div class="harlowe-3-dataRow"><input type=text style="width:80%;padding:var(--grid-size)" placeholder="${row.placeholder}"></input><button class="${buttonClass()} harlowe-3-rowMinus">${
							fontIcon('minus')
						}</button><button class="${buttonClass()} harlowe-3-rowPlus">${
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

				reducer(ret, dataValueRow((_,v) => rowValuesBuffer.push(v), modelRegistry, true));

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
				ret = el(`<div class="harlowe-3-datavalueRows">${row.text || ''}<div class="harlowe-3-dataEmptyRow"><i>No data</i></div><button class="${buttonClass()} harlowe-3-rowPlus">${
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
						).concat(dataValueRow((_,v) => rowValuesBuffer.push(v), modelRegistry, true)).reduce(reducer, line), plusButton);

					modelRegistry.forEach(m => childModelMethods.add(m));

					line.append(el(`<button class="${buttonClass()} harlowe-3-rowMinus">${
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
			if (type === "scroll-wrapper") {
				ret = el(`<div style="harlowe-3-scrollWrapper"></div>`);
				row.contents.reduce(reducer, ret);
			}
			/*
				The "Create" and "Cancel" buttons. This is always the last row of a panel.
			*/
			if (type === "confirm") {
				/*
					If this is Twine 2.4, wrap all preceding elements inside a scrollable container div.
					This is a special convenience hack that saves me having to use "scroll-wrapper" a lot.
				*/
				if (!twine23) {
					const wrapper = el(`<div class="harlowe-3-scrollWrapper"></div>`);
					wrapper.append(...panelElem.childNodes);
					panelElem.append(wrapper);
				}
				const buttons = el('<div class="harlowe-3-confirmButtons" style="padding-bottom:8px;"></div>');
				const cancel = el(`<button class="${buttonClass()}">${fontIcon('times')} Cancel</button>`);
				const confirm = el(`<button class="${buttonClass(true)} create">${fontIcon('check')} Add</button>`);
				confirm.setAttribute('style', disabledButtonCSS);
				updaterFns.push(m => {
					const setAttr = !m.valid ? 'setAttribute' : 'removeAttribute';
					confirm[setAttr]('style', disabledButtonCSS);
					if (m.valid) {
						if (typeof m.wrapStart === 'function') {
							m.wrapStart = m.wrapStart(m);
						}
						if (typeof m.wrapEnd === 'function') {
							m.wrapEnd = m.wrapEnd(m);
						}
					}
				});
				
				/*
					Because of a circular dependency, switchPanel and wrapSelection are injected into this module's exported object by Toolbar.
				*/
				cancel[ON]('click', ToolbarPanel.switchPanel);
				confirm[ON]('click', () => {
					const m = model();
					if (typeof m.wrapStart === 'function') {
						m.wrapStart = m.wrapStart(m);
					}
					if (typeof m.wrapEnd === 'function') {
						m.wrapEnd = m.wrapEnd(m);
					}
					ToolbarPanel.wrapSelection(m.output() + m.wrapStart, m.wrapEnd, '', m.innerText, m.wrapStringify);
					ToolbarPanel.switchPanel();
				});
				buttons.append(cancel,confirm);
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
	ToolbarPanel.Panel = folddownPanel;
	ToolbarPanel.dataValueRow = dataValueRow;

	if (this && this.loaded) {
		this.modules.ToolbarPanel = ToolbarPanel;
	}
	else if (!this.window) {
		this.ToolbarPanel = ToolbarPanel;
	}
}.call(eval('this')));
