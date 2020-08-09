/*jshint strict:true*/
(function() {
	'use strict';
	/*
		The Harlowe Toolbar fits above the CodeMirror panel and provides a number of convenience buttons, in the style of forum post editors,
		to ease the new user into the format's language.
	*/
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
	function wrapSelection(before,after) {
		if (!cm) {
			return;
		}
		cm.doc.replaceSelection(before + cm.doc.getSelection() + after, "around");
	}
	function wrapWithChangerMacros(...macros) {
		const before = macros.reduce((a, [name, args]) => a + (a ? '+' : '') + `(${name}:${args})`, '');
		macros.length && wrapSelection(before + "[", "]");
	}

	/*
		The Toolbar element consists of a single <div> in which a one of a set of precomputed panel <div>s are inserted. There's a "default"
		panel, plus other panels for specific markup wizards.
	*/
	const toolbarElem = el('<div class="harloweToolbar">');
	const panels = {
		default: folddownPanel({
			type: 'small',
			text: 'The current story format is <b>Harlowe 3.2.0</b>. Consult its <a href="https://twine2.neocities.org/" target="_blank" rel="noopener noreferrer">documentation</a>.'
		}),
		/*
			The (text-style:) button's panel. This simply consists of several radio buttons and checkboxes that configure a (text-style:) changer.
		*/
		textstyle: (()=>{

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

				const checkedStyles = panel => Array.from(panel[$](':checked')).filter(node => node.value !== "none");

				function setPreviewStyle(panel, styleStr) {
					panel.querySelector('.harlowePreview').firstChild.setAttribute('style', styleStr);
				}

				function update(panel) {
					const previewCSS = checkedStyles(panel).map(node => previewStyles[node.parentNode.textContent]);
					setPreviewStyle(panel, previewCSS.join(';'));
					return previewCSS.length > 0;
				}

				return folddownPanel({
					type: 'text',
					text: 'You may select any number of styles.<br>This will wrap the selection in a hook [], and place a <code>(text-style:)</code> macro in front to modify it.',
				},{
					type: 'preview',
					text: 'Example text sample',
				},{
					type: 'small',
					text: "This sample doesn't account for other modifications to this passage's text colour, font, or background, and is meant only for you to examine each of these styles.",
				},{
					type: 'checkboxes',
					name: 'Font variants',
					options: ["bold","italic","mark"],
					update,
				},{
					type: 'radios',
					name: 'Underlines and strikes',
					options: ["none", "underline","double-underline","wavy-underline","strike","double-strike","wavy-strike"],
					update,
				},{
					type: 'radios',
					name: 'Superscript and subscript',
					options: ["none", "superscript", "subscript"],
					update,
				},{
					type: 'radios',
					name: 'Outlines',
					options: ["none", "outline","shadow","emboss","blur","blurrier","smear"],
					update,
				},{
					type: 'radios',
					name: 'Letter spacing',
					options: ["none", "condense","expand"],
					update,
				},{
					type: 'radios',
					name: 'Flips',
					options: ["none", "mirror","upside-down"],
					update,
				},{
					type: 'radios',
					name: 'Animations',
					options: ["none", "blink", "fade-in-out","rumble","sway","buoy","fidget"],
					update,
				},{
					type: 'confirm',
					confirm(panel) {
						const styles = checkedStyles(panel);
						wrapWithChangerMacros([
							"text-style", styles.map(node => JSON.stringify(node.parentNode.textContent))
						]);
						setPreviewStyle(panel, '');
					},
				});
			})(),
		/*
			The [[Link]] button's panel. This configures the link syntax, plus a (t8n-depart:) and/or (t8n-arrive:) macro to attach to it.
		*/
		passagelink: folddownPanel({
				type: 'textarea',
				text: 'Arriving passage name',
				placeholder: "Passage name",
				update(panel) {
					const name = panel.querySelector('[type=text]').value;
					return name.length > 0 && !name.includes("]]");
				},
			},{
				type: 'dropdown',
				text: 'Departing passage transition',
				options: ["default", "", "instant", "dissolve", "rumble", "shudder", "pulse", "zoom", "flicker", "slide-left", "slide-right", "slide-up", "slide-down"],
			},{
				type: 'dropdown',
				text: 'Arriving passage transition',
				options: ["default", "", "instant", "dissolve", "rumble", "shudder", "pulse", "zoom", "flicker", "slide-left", "slide-right", "slide-up", "slide-down"],
			},{
				type: 'confirm',
				confirm(panel) {
					const passageName = panel.querySelector('[type=text]').value;
					let [t8nDepart,t8nArrive] = Array.from(panel[$]('select')).map(node => node.value);
					t8nDepart = t8nDepart ? "(t8n-depart:" + JSON.stringify(t8nDepart) + ")" : "";
					t8nArrive = t8nArrive ? "(t8n-arrive:" + JSON.stringify(t8nArrive) + ")" : "";
					wrapSelection(
						t8nDepart + (t8nDepart && t8nArrive ? "+" : "") + t8nArrive + "[[",
						"->" + passageName + "]]"
					);
				},
			})
	};

	const disabledButtonCSS = 'background:hsl(0,0%,50%,0.5);opacity:0.5;pointer-events:none';
	/*
		The mode-switcher function, which changes the displayed panel in the toolbar.
	*/
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
		The constructor for the folddownPanels. This accepts a number of panel rows (as an array of row-describing objects)
		and returns a <div> with the compiled UI elements.

		Each row object typically has the following:
		- update: A function taking the entire panel element, and performing actions whenever this element's value is altered.
		- name: User-facing display name of this element.
		- type: Which type of UI element to create for it.
	*/
	function folddownPanel(...panelRows) {
		const panelElem = el('<div class="harloweToolbarPanel" style="transition:max-height 0.8s;overflow-y:auto"></div>');
		/*
			toggleConfirm is a function that enables or disables the Confirm button in the "confirm" row.
			It is created below only if the "confirm" row exists.
		*/
		let toggleConfirm = Object;

		panelRows.forEach((row) => {
			/*
				These are non-interactive messages.
			*/
			if (row.type === "text") {
				panelElem.append(el('<p>' + row.text + '</p>'));
			}
			if (row.type === "small") {
				panelElem.append(el('<small style="display:block">' + row.text + '</small>'));
			}
			/*
				The text-style preview panel.
			*/
			if (row.type === "preview") {
				panelElem.append(el('<div class="harlowePreview" style="margin:8px auto;width:50%;text-align:center;user-select:none;background:black;color:white;font-family:\'Georgia\',serif;padding:8px;font-size:1.5rem"><span>' + row.text + '</span></div>'));
			}
			/*
				Checkboxes and radio buttons.
			*/
			if (row.type === "checkboxes") {
				const boxesDiv = el(`<div style="border-bottom:1px solid hsl(0,0%,50%,0.5);position:relative;padding-bottom:8px;margin-bottom:8px"><div><b>${row.name}</b></div></div>`);
				const onClick = row.update && (() => toggleConfirm(row.update(panelElem)));
				row.options.forEach(box => {
					const e = el('<label style="min-width:20%;text-transform:capitalize;display:inline-block;"><input type="checkbox"></input>' + box + '</label>');
					onClick && e.addEventListener('click', onClick);
					boxesDiv.append(e);
				});
				panelElem.append(boxesDiv);
			}
			if (row.type === "radios") {
				const radiosDiv = el(`<div style="border-bottom:1px solid hsl(0,0%,50%,0.5);position:relative;padding-bottom:8px;margin-bottom:8px"><div><b>${row.name}</b></div></div>`);
				const onClick = row.update && (() => toggleConfirm(row.update(panelElem)));
				row.options.forEach((radio,i) => {
					const e = el(`<label style="min-width:20%;text-transform:capitalize;display:inline-block;"><input type="radio" name="${row.name}" value="${radio}" ${!i ? 'checked' : ''}></input>${radio}</label>`);
					onClick && e.addEventListener('click', onClick);
					radiosDiv.append(e);
				});
				panelElem.append(radiosDiv);
			}
			/*
				Text areas, single lines in which text can be entered.
			*/
			if (row.type === "textarea") {
				const rowDiv = el('<div style="position:relative;padding-bottom:8px;">'
					+ row.text
					+ ':<input style="width:50%;margin-left:1rem;display:inline-block;font-size:1rem" type=text placeholder="' + row.placeholder + '"></input></div>');
				row.update && rowDiv.querySelector('input').addEventListener('input', () => toggleConfirm(row.update(panelElem)));
				panelElem.append(rowDiv);
			}
			/*
				Dropdowns.
			*/
			if (row.type === "dropdown") {
				const dropdownDiv = el('<div style="width:50%;display:inline-block;position:relative;">'
					+ row.text
					+ ':<select style="text-transform:capitalize;margin-left:1rem"></select></div>');
				row.options.forEach((option,i) => {
					dropdownDiv.lastChild.append(el('<option value="' + (!i ? '' : option) + '"' + (!option ? ' disabled' : !i ? ' selected' : '') + '>' + (option || '───────') + '</select>'));
				});
				panelElem.append(dropdownDiv);
			}
			/*
				The "Create" and "Cancel" buttons.
			*/
			if (row.type === "confirm") {
				const buttons = el('<p class="buttons" style="padding:8px;"></p>');
				const cancel = el('<button><i class="fa fa-times"></i> Cancel</button>');
				const confirm = el('<button class="create"><i class="fa fa-check"></i>Add</button>');
				confirm.setAttribute('style',disabledButtonCSS);
				toggleConfirm = val => confirm[!val ? 'setAttribute' : 'removeAttribute']('style',disabledButtonCSS);
				toggleConfirm(false);
				
				cancel.addEventListener('click', () => switchPanel());
				confirm.addEventListener('click', () => {
					row.confirm(panelElem);
					switchPanel();
				});
				buttons.append(cancel,confirm);
				panelElem.append(buttons);
			}
		});
		return panelElem;
	}

	/*
		Finally, the default word processing buttons are created here.
	*/
	function defaultPanelButton(title,html,onClick) {
		const button = el('<button title="' + title + '" style="'
			+ "border-radius:0.5rem;"
			+ "border:1px solid hsl(0,0%,50%,0.5);"
			+ "margin:8px 4px;"
			+ "padding:0px 4px;"
			+ "height:40px;"
			+ (html.startsWith('<su') ? '' : 'font-size:1.2rem;')
			+ 'min-width:32px;'
			+ '">' + html + "</button>"
		);
		onClick && button.addEventListener('click',onClick);
		return button;
	}

	panels.default.append(
		defaultPanelButton('Bold', '<b>B</B>',                         () => wrapSelection("''","''")),
		defaultPanelButton('Italic', '<i>I</i>',                       () => wrapSelection("//","//")),
		defaultPanelButton('Strikethrough', '<s>S</s>',                () => wrapSelection("~~","~~")),
		defaultPanelButton('Superscript', '<sup>Sup</sup>',            () => wrapSelection("^^","^^")),
		//defaultPanelButton('Verbatim (ignore markup)', 'Vb',           () => wrapSelection("``","``")),
		defaultPanelButton('Collapse whitespace', '{}',                () => wrapSelection("{","}")),
		// Separate the basic markup buttons from those of the wizards
		el('<span style="padding:0px 2px;color:hsla(0,0%,50%,0.5)">•</span>'),
		defaultPanelButton('Special text style', 'Styles…',            () => switchPanel('textstyle')),
		defaultPanelButton('Passage link', 'Link…',                    () => switchPanel('passagelink'))
	);
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
