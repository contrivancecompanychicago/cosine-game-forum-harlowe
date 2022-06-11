/*jshint strict:true*/
(function() {
	'use strict';
	const {stringify, parse} = JSON;
	const {round} = Math;
	let panels;

	let cm, Patterns, ToolbarPanel, Utils;

	// This can only be loaded in TwineJS, not any other place.
	if (this && this.loaded) {
		({Patterns, Utils, ToolbarPanel} = this.modules);
	}
	else if (!this.window) {
		({Patterns, Utils, ToolbarPanel} = this);
	}
	// This can't be loaded in the Harlowe docs.
	else {
		return;
	}
	const {Panel, dataValueRow} = ToolbarPanel;
	const {twine23, toHarloweColour, toCSSColour, el, fontIcon, GCD, fourDecimals} = Utils;
	/*
		These are a couple of convenience routines.
	*/
	const $ = 'querySelector';
	const $$ = $ + 'All';
	const ON = "addEventListener";

	/*
		The Harlowe Toolbar fits above the CodeMirror panel and provides a number of convenience buttons, in the style of forum post editors,
		to ease the new user into the format's language.
	*/
	const toolbarElem = el('<div class="harloweToolbar">');

	/*
		All output from the buttons and wizards is from this function, which places Harlowe code into the passage around the selection.
		"stringify" indicates whether to convert the wrapped text to a string.
	*/
	function wrapSelection(before,after,sample,innerText,stringify=false) {
		if ((before + after).length === 0) {
			return;
		}
		/*
			Some syntax (such as links) directly replaces the current selection entirely. Others
			wrap the selection, or, if none exists, the "Your Text Here" prompt text.
		*/
		const wrapped = innerText !== undefined ? innerText : cm.doc.getSelection() || sample || "Your Text Here";
		cm.doc.replaceSelection(before + (stringify ? stringify : String)(wrapped) + after, "around");
	}
	/*
		The mode-switcher function, which changes the displayed panel in the toolbar.
	*/
	function switchPanel(name) {
		if (typeof name !== 'string') {
			name = 'default';
		}

		/*
			Twine 2.4+ doesn't have a default panel.
		*/
		if (!twine23 && name === "default") {
			toolbarElem[$$]('.harlowe-3-toolbarPanel').forEach(node => node.remove());
			return;
		}
		
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
			panel.onreset && panel.onreset();
		});
		
		const {height} = getComputedStyle(toolbarElem);
		toolbarElem[$$]('.harlowe-3-toolbarPanel').forEach(node => node.remove());
		if (twine23) {
			/*
				Touch the maxHeight of the incoming panel, using the computed height of the current panel, to
				animate its height as it enters.
			*/
			panels[name].style.maxHeight=height;
			/*
				For prefilled "use selection" input elements, pre-fill with the selected text now.
			*/
			toolbarElem[$$]('[data-use-selection]').forEach(node => node.value = cm.doc.getSelection());
			// Sadly, I think using this setTimeout is necessary to get it to work.
			// "70vh" is the absolute maximum height for these panels.
			setTimeout(() => panels[name].style.maxHeight="70vh", 100);
		} else {
			panels[name].classList.add('card-button-card', 'card', 'floating');
		}
		toolbarElem.append(panels[name]);
	}
	/*
		To work around a circular dependency (involving the Confirm button implementation), ToolbarPanel has wrapSelection and switchPanel injected into it.
	*/
	ToolbarPanel.wrapSelection = wrapSelection;
	ToolbarPanel.switchPanel = switchPanel;

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

	const t8nNames = ["default", "", "instant", "dissolve", "blur", "rumble", "shudder", "pulse", "zoom", "flicker", "slide-left", "slide-right", "slide-up", "slide-down",
		"fade-left", "fade-right", "fade-up", "fade-down"];


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
					tall:                  "display:inline-block;transform:scaleY(1.5) translateY(-0.25ex)",
					flat:                  "display:inline-block;transform:scaleY(0.5) translateY(0.25ex)",
					blink:                 "animation:harlowe-3-fade-in-out 1s steps(1,end) infinite alternate",
					"fade-in-out":         "animation:harlowe-3-fade-in-out 2s ease-in-out infinite alternate",
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

				return Panel({
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
					name: 'Flips and stretches',
					capitalise:true,
					bold:true,
					options: ["none", "mirror","upside-down", "tall", "flat"],
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

				return Panel({
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
		textcolor: Panel({
				type: 'preview',
				text: 'Example text preview',
				update(model, panel) {
					const changers = model.suppressedChangers || model.changers;
					panel.firstChild.setAttribute('style', `${
						(changers['text-colour'] ? `color:${model.textColour};` : '')
					}${
						model.stops ? `background:linear-gradient(${model.angle}deg, ${
							model.stops.map(stop => stop.getAttribute('data-colour') + " " + (stop.getAttribute('data-pos')*100) + "%")
						})` : changers.bg ? `background:${model.backgroundColour}` : ''
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
								m.changerNamed('bg').push(toHarloweColour(c, a));
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
									m.changerNamed('bg').push(`(gradient: $deg, ${
										stops.map(
											stop => fourDecimals(stop.getAttribute('data-pos')) + "," + (stop.getAttribute('data-harlowe-colour') || stop.getAttribute('data-colour'))
										)
									})`);
									m.stops = stops;
									m.angle = 0;
								}
							},
						},
						el(`<br style="height:${twine23 ? 1 : 4}rem">`),
						{
							type: "inline-range",
							text: "Angle (deg):",
							value: 0,
							min: 0,
							max: 359,
							step: 1,
							model(m, elem) {
								if (m.valid) {
									const bg = m.changerNamed('bg');
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
					text: 'Departing transition: ',
					options: t8nNames,
					model(m, el) {
						const {value} = el[$]('select');
						if (value !== "") {
							m.changerNamed('t8n-depart').push(stringify(value));
						}
					},
				},{
					type: 'inline-dropdown',
					text: 'Arriving transition: ',
					options: t8nNames,
					model(m, el) {
						const {value} = el[$]('select');
						if (value !== "") {
							m.changerNamed('t8n-arrive').push(stringify(value));
						}
					},
				},
				el('<br>'),
				{
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

				return Panel({
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
		if: Panel({
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
							width:"20%",
							text: "The passage ",
							placeholder: "Passage name",
							model(m, elem) {
								const v = elem[$]('input').value;
								if (v) {
									m.changerNamed('if').push("(history: where its name contains " + stringify(v) + ")'s length");
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
							width:"15%",
							text: "Passages tagged ",
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
						new Text("a value."), el('<br>'),
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
		hook: Panel({
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
		align: Panel({
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

		rotate: Panel({
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

		columns: Panel({
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

		collapse: Panel({
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

		basicValue:  Panel({
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
		input: Panel({
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
							width: "25%",
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
							width: "25%",
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

		macro: Panel({
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

		find: Panel({
				type: "scroll-wrapper",
				contents: [{
						type: "inline-textarea",
						multiline: true,
						width:"30%",
						text: "Find:",
						placeholder: "",
						model(m, elem) {
							m.query = elem[$]('textarea').value;
						},
					},{
						type: 'buttons',
						buttons: [
							{ title:'Previous Result', html:`<b style="font-size:150%">↑</b>`, onClick: () => cm.constructor.signal(cm, 'harlowe-3-findNext',-1) },
							{ title:'Next Result', html:`<b style="font-size:150%">↓</b>`, onClick: () => cm.constructor.signal(cm, 'harlowe-3-findNext', 1)  },
						],
					},{
						type: 'inline-dropdown',
						text: '',
						options: ["Everywhere", "Only in prose", "Only in code", "Only in selection"],
						model(m, el) {
							m.onlyIn = el[$]('select').value;
						},
					},{
						type: "inline-checkbox",
						text: "Match Case",
						model(m, elem) {
							m.matchCase = elem && elem[$]('input').checked;
							cm.constructor.signal(cm, 'harlowe-3-find', m);
						},
					},
					el('<br>'),
					{
						type: "inline-textarea",
						multiline: true,
						width:"30%",
						text: "Replace:",
						placeholder: "",
						model(m, elem) {
							m.replaceQuery = elem[$]('textarea').value;
						},
					},{
						type: 'buttons',
						buttons: [
							{ title:'Replace', html:`Replace`, onClick: ({target}) => cm.constructor.signal(cm, 'harlowe-3-replace', target.previousSibling.lastChild.value, false) },
							{ title:'Replace All', html:`Replace All`, onClick: ({target}) => cm.constructor.signal(cm, 'harlowe-3-replace', target.previousSibling.previousSibling.lastChild.value, true)  },
						],
					},
				],
			},
			(() => {
				// This <span> wrapper ensures that it isn't considered a main panel button by the CSS.
				const done = el(`<span style="${!twine23 ? 'position:absolute;bottom:var(--grid-size);right:var(--grid-size);' : 'float:right;'}"><button class="variant-primary primary icon-button">Done</button></span>`);
				done.firstChild[ON]('click', () => {
					switchPanel();
					cm.constructor.signal(cm, 'harlowe-3-findDone');
				});
				return done;
			})()),

		default:
			/*
				The default panel is present only if this is 2.3. In 2.4, an identical panel is created using the TwineJS extension API.
			*/
			!twine23 ? Panel() : Panel(
			{
				type: 'buttons',
				buttons: [
					{ title:'Bold',                    html:`<div style='font-family:serif;font-weight:bold'>B</div>`,              onClick: () => wrapSelection("''","''", "Bold Text")},
					{ title:'Italic',                  html:`<div style='font-family:serif;font-style:italic'>I</div>`,             onClick: () => wrapSelection("//","//", "Italic Text")},
					{ title:'Strikethrough',           html:`<div style='font-family:serif;text-decoration:line-through'>S</div>`,  onClick: () => wrapSelection("~~","~~", "Strikethrough Text")},
					{ title:'Superscript',             html:`<div style='font-family:serif'>X<sup>2</sup></div>`,                   onClick: () => wrapSelection("^^","^^", "Superscript Text")},
					{ title:'Text and background colour', html:`<div class='harlowe-3-bgColourButton'>`,                            onClick: () => switchPanel('textcolor')},
					{ title:'Borders',                 html:fontIcon('border-style'),                                               onClick: () => switchPanel('borders'),},
					{ title:'Rotated text',            html: '<div style="transform:rotate(-30deg);font-family:serif;font-weight:bold">R</div>', onClick: () => switchPanel('rotate')},
					{ title:'Special text style',      html:'Styles…',                    onClick: () => switchPanel('textstyle')},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Heading',                 html:`<div style='font-family:serif;font-weight:bold'>H</div>`,              onClick: () => wrapSelection("\n#","","Heading Text")},
					{ title:'Bulleted list item',      html:fontIcon('list-ul'),          onClick: () => wrapSelection("\n* ","")},
					{ title:'Numbered list item',      html:fontIcon('list-ol'),          onClick: () => wrapSelection("\n0. ","")},
					{ title:'Horizontal rule',         html:'<b>—</b>',                   onClick: () => wrapSelection("\n---\n","")},
					{ title:'Alignment',               html:fontIcon('align-right'),      onClick: () => switchPanel('align')},
					{ title:'Columns',                 html:fontIcon('columns'),          onClick: () => switchPanel('columns')},
					el('<span class="harlowe-3-toolbarBullet">'),
					{ title:'Collapse whitespace (in-game)', html:'<b>{}</b>',         onClick: () => switchPanel('collapse')},
					{
						title:'Verbatim (ignore all markup)',
						html:'Vb',
						onClick() {
							const selection = cm.doc.getSelection();
							const consecutiveGraves = (selection.match(/`+/g) || []).reduce((a,e) => Math.max(e.length, a), 0);
							wrapSelection("`".repeat(consecutiveGraves+1), "`".repeat(consecutiveGraves+1), "Verbatim Text");
						},
					},
					{ title:'Comments',                html:'<b>&lt;!--</b>',                 onClick: () => wrapSelection("<!--","-->", "HTML Comments (Not Visible In-Game)")},
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
							cm.display.wrapper.classList.toggle('harlowe-3-hideCode');
							if (target.tagName.toLowerCase() === "svg") {
								target = target.parentNode;
							}
							target.classList.toggle('active');
						},
					},
					{ title:'Coding tooltips (show a tooltip when the cursor rests on code structures)',
						html: fontIcon('comment'),
						active: true,
						onClick: ({target}) => {
							cm.display.wrapper.classList.toggle('harlowe-3-hideTooltip');
							if (target.tagName.toLowerCase() === "svg") {
								target = target.parentNode;
							}
							target.classList.toggle('active');
						},
					},
					el('<span class="harlowe-3-toolbarBullet">'),
					
					{ title:'Find and replace',     html:fontIcon('search'),        onClick: () => switchPanel('find')},

					{ title:'Open the Harlowe documentation',
						html: `<div style='font-weight:bold'>?</div>`,
						onClick: () => window.open(`https://twine2.neocities.org/`, "Harlowe Documentation", 'noopener,noreferrer')
					},
					(() => {
						const button = el('<button style="position:absolute;right:0em;margin-top:-2em">' + fontIcon('chevron-up') + "</button>");
						button[ON]('click', () => {
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

	/*
		Twine 2.4+ toolbar.
	*/
	const svgURIPrefix = `data:image/svg+xml,`;

	const svgURI = contents =>
		`${svgURIPrefix}${window.escape(`<svg viewBox='0 0 14 14' width='80' height='80' xmlns='http://www.w3.org/2000/svg'>${contents}</svg>`)}`;

	const t24Icon = (x,y,style,text) =>
		svgURI(`<text y='${y}' x='${x}' fill='currentColor' style='/*harlowe-3*/${style}'>${text}</text>`);

	const fontIconURI = name => `${svgURIPrefix}${window.escape(fontIcon(name))}`;

	const t24commands = {};
	const t24keymap = {
		name: 'harlowe-3-keymap',
	};
	let hideCodeButton, hideTooltipButton;
	const t24toolbar = twine23 ? [] : [
		{ type: 'menu', label: 'Styles',
				icon: svgURI(
						`<text y='11' x='-7' fill='currentColor' style='/*harlowe-3*/font-weight:bold;font-size:80%'>B</text>`
						+ `<text y='8' x='1' fill='currentColor' style='/*harlowe-3*/font-style:italic;font-size:80%'>I</text>`
						+ `<text y='13' x='5' fill='currentColor' style='/*harlowe-3*/text-decoration:line-through;font-size:80%'>S</text>`
					).replace("%2780%27","%27144%27"),
				items: [
			{ type: 'button', key: 'Ctrl-B', command() { wrapSelection("''","''", "Bold Text"); },            label:'Bold',          },
			{ type: 'button', key: 'Ctrl-I', command() { wrapSelection("//","//"), "Italic Text"; },          label:'Italic',        },
			{ type: 'button', key: 'Ctrl--', command() { wrapSelection("~~","~~", "Superscript Text"); },     label:'Superscript',   },
			{ type: 'button', key: 'Ctrl-Shift-6', command() { wrapSelection("^^","^^", "Strikethrough Text"); },   label:'Strikethrough', },
			{ type: 'separator', },
			{ type: 'button', command() { switchPanel('textstyle'); },                         label:'More Styles…',  },
		]},
		{ type: 'button', command() { switchPanel('textcolor'); },                         label:'Colours',     iconOnly: true, icon: svgURI(`<defs><linearGradient id="X"><stop offset="0%" stop-color="hsla(0,100%,50%,0.5)"/><stop offset="16%" stop-color="hsla(30,100%,50%,0.5)"/><stop offset="33%" stop-color="hsla(60,100%,50%,0.5)"/><stop offset="50%" stop-color="hsla(120,100%,50%,0.5)"/><stop offset="66%" stop-color="hsla(180,100%,50%,0.5)"/><stop offset="83%" stop-color="hsla(240,100%,50%,0.5)"/><stop offset="100%" stop-color="hsla(320,100%,50%,0.5)"/></linearGradient></defs><circle cx="8" cy="8" r="6" fill="url('#X')"/>`), },
		{ type: 'button', command() { switchPanel('borders'); },                           label:'Borders',     iconOnly: true, icon: fontIconURI('border-style'), },
		{ type: 'button', command() { switchPanel('rotate'); },                            label:'Rotated text',iconOnly: true, icon: t24Icon(-3, 14, 'transform:rotate(-30deg);font-family:serif;', 'R'), },
		{ type: 'button', command() { wrapSelection("\n#","","Heading Text"); },           label:'Heading',     iconOnly: true, icon: t24Icon(0, 14, 'font-weight:bold;font-size:18px;','H'), },
		{ type: 'menu', icon: fontIconURI('list-ul'), label: 'List item', iconOnly: true, items: [
			{ type: 'button', command() { wrapSelection("\n* ",""); },                         label:'Bulleted list item', },
			{ type: 'button', command() { wrapSelection("\n0. ",""); },                        label:'Numbered list item', },
		]},
		{ type: 'button', command() { wrapSelection("\n---\n",""); },                      label:'Horizontal Rule', iconOnly: true, icon: fontIconURI('minus'), },
		{ type: 'button', command() { switchPanel('align'); },                             label:'Alignment',   iconOnly: true, icon: fontIconURI('align-right'), },
		{ type: 'button', command() { switchPanel('columns'); },                           label:'Columns',     iconOnly: true, icon: fontIconURI('columns'), },
		{ type: 'button', command() { switchPanel('collapse'); },                          label:'Collapse whitespace (in-game)', iconOnly: true, icon: t24Icon(0,10,'font-weight:bold;font-size:12px','{ }'), },
		{ type: 'button',
			command() {
				const selection = cm.doc.getSelection();
				const consecutiveGraves = (selection.match(/`+/g) || []).reduce((a,e) => Math.max(e.length, a), 0);
				wrapSelection("`".repeat(consecutiveGraves+1), "`".repeat(consecutiveGraves+1), "Verbatim Text");
			},
			label:'Verbatim (ignore all markup inside)', iconOnly: true, icon: t24Icon(1,12,'font-size:11px','Vb'),
		},
		{ type: 'button', command() { wrapSelection("<!--","-->", "Comment Text"); },  label:'HTML Comments (Not Visible In-Game)', iconOnly: true, icon: t24Icon(-1,10,'font-weight:bold','&#10216;!-'), },

		{ type: 'button', command() { switchPanel('passagelink'); },                       label:'Link…',   icon:'', },
		{ type: 'button', command() { switchPanel('if'); },                                label:'If…',     icon:'', },
		{ type: 'button', command() { switchPanel('input'); },                             label:'Input…',  icon:'', },
		{ type: 'button', command() { switchPanel('hook'); },                              label:'Hook…',   icon:'', },
		{ type: 'button', command() { switchPanel('basicValue'); },                        label:'Value…',  icon:'', },
		{ type: 'button', command() { switchPanel('macro'); },                             label:'Macro…',  icon:'', },
		/*
			As a convenient hack to support multi-editor in 2.4, the hideCode, etc. classes are placed on the .CodeMirror element
			rather than the (global) harloweToolbar element.
		*/
		hideCodeButton    = { type: 'button', command() { cm.display.wrapper.classList.toggle('harlowe-3-hideCode'); cm.constructor.signal(cm,'cursorActivity'); },    label:'Proofreading View (dim all code except strings)',   iconOnly: true, icon:fontIconURI('eye'), },
		hideTooltipButton = { type: 'button', command() { cm.display.wrapper.classList.toggle('harlowe-3-hideTooltip'); cm.constructor.signal(cm,'cursorActivity'); }, label:'Coding Tooltips (show a tooltip when the cursor rests on code structures)',  iconOnly: true, icon:fontIconURI('comment'), },
		{ type: 'button', key: 'Ctrl-F', command() { switchPanel('find'); },        label:'Find and Replace', iconOnly: true, icon: fontIconURI('search'), },
		{ type: 'button', command() { window.open(`https://twine2.neocities.org/`, "Harlowe Documentation", 'noopener,noreferrer'); }, label:'Show Manual (opens a new tab)', iconOnly: true, icon:t24Icon(3, 14, 'font-weight:bold;font-size:19px;','?'), },
	].map(function recur(b,i) {
		/*
			The above definition is split into separate command and toolbar objects, as per the TwineJS 2.4 spec.
		*/
		if (b.type === 'button') {
			const {command} = b;
			/*
				Before each command is run, reassign the cm object.
			*/
			t24commands[i] = (cmObj) => { cm = cmObj; command(); };
			if (b.key) {
				t24keymap[b.key] = command;
			}
			b.command = i + '';
		}
		if (b.type === 'menu') {
			b.items = b.items.map((b,j) => recur(b, i + '.' + j));
		}
		return b;
	});

	function Toolbar(cmObj, {foregroundColor} = {}) {
		/*
			Look for the TwineJS toolbar element in either 2.4 or 2.3.
		*/
		const passageTagsElem = document[$]('.story-format-toolbar') || document[$]('.editor .passageTags');
		if (passageTagsElem && passageTagsElem.nextElementSibling !== toolbarElem) {
			passageTagsElem.after(toolbarElem);
		}
		cm = cmObj;
		!twine23 && cm.addKeyMap(t24keymap);
		/*
			Colourise the icons for each toolbar button based on the current appTheme (light mode or dark mode).
		*/
		t24toolbar.forEach(item => {
			let replaceColor = foregroundColor;
			if ((item === hideCodeButton && cm.display.wrapper.classList.contains('harlowe-3-hideCode'))
					|| (item === hideTooltipButton && !cm.display.wrapper.classList.contains('harlowe-3-hideTooltip'))) {
				replaceColor = '#0a60c2';
			}
			item.icon && (item.icon = item.icon.replace(/fill%3D%27[^']+?%27/g, `fill%3D%27${window.escape(replaceColor)}%27`));
		});
		return t24toolbar;
	}

	if (this && this.loaded) {
		this.modules.Toolbar = Toolbar;
	}
	else if (!this.window) {
		this.Toolbar = Toolbar;
		this.ToolbarCommands = t24commands;
	}
}.call(eval('this')));
