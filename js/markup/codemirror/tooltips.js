/*jshint strict:true*/
(function() {
	'use strict';
	let ShortDefs;
	const insensitiveName = e => (e + "").toLowerCase().replace(/-|_/g, "");
	const docsURL = (anchor, contents) => `<a href="https://twine2.neocities.org/#${anchor}" target="_blank" rel="noopener noreferrer">${contents}</a>`;

	const enclosedText = "This makes the enclosed text use ";
	const tooltipMessages = {
		hr:                  "This is a <b>horizontal rule</b>.",
		bulleted:            "The <code>*</code> at the start of this line makes this a <b>bulleted list item</b>.",
		numbered:            "The <code>0.</code> at the start of this line makes this a <b>numbered list item</b>.",
		heading:             ({depth}) => `This is a <b>level ${depth} ${depth===1 ? "(largest) " : ""}heading</b> mark.`,
		align:               ({align}) => `This is an <b>aligner</b> (${align}).`,
		column:              ({width, marginRight, marginLeft}) => `column (width ${width}, left margin ${marginLeft}em, right margin ${marginRight}em)`,
		twine1Macro:         "This is an erroneous SugarCube/Yarn-style macro call that Harlowe doesn't support.",
		em:                  enclosedText + "<b>emphasis style</b>.",
		strong:              enclosedText + "<b>strong emphasis style</b>.",
		bold:                enclosedText + "<b>bold style</b>.",
		italic:              enclosedText + "<b>italic style</b>.",
		strike:              enclosedText + "<b>strikethrough style</b>.",
		sup:                 enclosedText + "<b>superscript style</b>.",
		comment:             "This is a <b>HTML comment</b>.",
		scriptStyleTag:      () => tooltipMessages.tag,
		tag:                 "This is a <b>HTML tag</b>. Harlowe supports raw HTML in passage code.",
		hook: ({type, name, tagPosition}) => (type === "hook" ? `These square brackets are a <b>hook</b>, enclosing this section of passage code.` : '')
			+ ` Changer values can be attached to the front of hooks.`
			+ (name ? `<br>This hook has a <b>nametag</b> on the ${
				tagPosition === "prepended" ? "front" : "back"
			}. This allows the hook to be referred to in macro calls using the hook name <code>?${
				name
			}</code>.` : ''),
		unclosedHook:        token => `This marks all of the remaining code in the passage as being inside a <b>hook</b>.` + tooltipMessages.hook(token),
		verbatim:            "This is <b>verbatim markup</b>. Place text between matching pairs and amounts of <code>`</code> marks, and Harlowe will ignore the markup within, instead displaying it as-is.",
		unclosedCollapsed:   token => tooltipMessages.collapsed(token),
		collapsed:           ({type}) => `This is <b>${
									type === "unclosedCollapsed" ? "unclosed " : ''
								}collapsed whitespace</b> markup. All sequences of consecutive whitespace within ${
									type === "unclosedCollapsed" ? "the remainder of the passage " : 'the <code>{</code> and <code>}</code> marks'
								} will be replaced with a single space. You can use this to space out your code and keep your passage readable.<br>To include a line break within this markup that will be preserved, use a HTML <code>&lt;br&gt;</code> tag.`,
		escapedLine:         `This is an <b>escaped line break</b> mark. This removes the line break before or after it from the displayed passage.`,
		twineLink:           ({passage}) => `This is a link to the passage "${passage}".`,
		br:                  ``, // Display nothing,
		url:                 ``,
		variable:            `This is a <b>story-wide variable</b>. After this has been set to a data value, it can be used anywhere else in the story. Use these to store values related to your story's game state.`,
		tempVariable:        `This is a <b>temp variable</b>. It can be used in the same passage and hook in which it's first set to a data value. Use these to store values temporarily, or that won't be needed elsewhere.`,
		macroName:           (_,[,parent]) => tooltipMessages.macro(parent),
		grouping:            `grouping`,
		property:            `data name`,
		possessiveOperator:  `possessive operator`,
		itsProperty:         `data name`,
		itsOperator:         `"its"`,
		belongingItProperty: `data name`,
		belongingItOperator: `"of it"`,
		belongingProperty:   `data name`,
		belongingOperator:   `"of"`,
		escapedStringChar:   `escaped string character`,
		string:              `This is <b>string data</b>. Strings are sequences of text data enclosed in matching " or ' marks.`,
		hookName:            ({name}) => `This <b>hook name</b> refers to all hooks named "<code>${name}</code>" in this passage.`,
		cssTime:             ({value}) => `This is <b>number data</b> in CSS time format. Harlowe automatically converts this to a number of milliseconds, so this is identical to ${value}.`,
		datatype:            `datatype data`,
		colour:              `colour data`,
		number:              `This is <b>number data</b>. Harlowe supports whole numbers, negative numbers, and numbers with a decimal fraction component.`,
		inequality:          `inequality operator`,
		augmentedAssign:     `augmented assignment operator`,
		identifier:          `identifier`,
		whitespace:          `whitespace`,
		incorrectOperator:   `erroneous operator`,
		boolean:             `boolean data`,
		is:                  `"is" operator`,
		to:                  `"to" operator`,
		into:                `"into" operator`,
		where:               `"where" lambda clause`,
		when:                `"when" lambda clause`,
		via:                 `"via" lambda clause`,
		making:              `"making" lambda clause`,
		each:                `"each" lambda clause`,
		and:                 `"and" operator`,
		or:                  `"or" operator`,
		not:                 `"not" operator`,
		isNot:               `"is not" operator`,
		contains:            `"contains" operator`,
		doesNotContain:      `"does not contain" operator`,
		isIn:                `"is in" operator`,
		isA:                 `"is a" operator`,
		isNotA:              `"is not a" operator`,
		isNotIn:             `"is not in" operator`,
		matches:             `"matches" operator`,
		doesNotMatch:        `"does not match" operator`,
		bind:                `bound variable operator`,
		comma:               `macro argument separator`,
		spread:              `spreader`,
		typeSignature:       `type restrictor`,
		addition:            `addition operator`,
		subtraction:         `subtraction operator`,
		multiplication:      `multiplication operator`,
		division:            `division operator`,
		macro: ({name}) => {
			const defs = ShortDefs.Macro[insensitiveName(name)];
			if (!defs) {
				return `This is a call to a nonexistent or misspelled macro.`;
			}
			const rt = defs.returnType;
			return `This is a <b>call to the (${defs.name}:) macro</b>. ${
					rt === "Instant" || rt === "Command" ? `It's a <span class="cm-harlowe-3-macroName-command">Command</span>, so it should appear in passage code without being connected to a hook.` :
					rt === "Changer" ? `It produces a <span class="cm-harlowe-3-macroName-changer">Changer</span>, which can be placed in front of a hook, or combined with other Changers.` :
					rt === "Any" || rt === "String" ? "" :
					`Since it produces a <span class="cm-harlowe-3-macroName-${rt.toLowerCase()}">${rt}</span>, it should be nested inside another macro call that can use ${rt} (or Any) data.`
				}<code class='harlowe-3-tooltipMacroSignature'>${
					docsURL(defs.anchor, `(${defs.name}: ${defs.sig}) -> ${rt}`)
				}</code>${defs.aka.length ? `<div><i>Also known as: ${
					defs.aka.map(alias => `<code>(${alias}:)</code>`).join(', ')
				}</i>` : ''}</div><div>${
					defs.abstract
				}</div>`;
		},
	};

	const tooltipElem = document.createElement("div");
	tooltipElem.className = "harlowe-3-tooltip";

	function Tooltips(cm, doc, tree) {
		tooltipElem.setAttribute('style', 'display:none');
		if (doc.somethingSelected()) {
			return;
		}
		const cmElem = document.querySelector('.CodeMirror');
		if (tooltipElem.compareDocumentPosition(document) & 1) {
			cmElem.append(tooltipElem);
		}
		const cursor = doc.getCursor();
		const path = tree.pathAt(doc.indexFromPos(cursor));
		if (!path.length) {
			return;
		}
		const [token] = path;
		let message = tooltipMessages[token.type];
		if (typeof message === 'function') {
			message = message(token, path);
		}
		if (message) {
			tooltipElem.innerHTML = message;
			tooltipElem.removeAttribute('style');
			const {width} = tooltipElem.getBoundingClientRect();
			const {width:maxWidth} = cmElem.getBoundingClientRect();
			const coords = cm.charCoords(cursor, 'local');
			const gutterWidth = 30;
			tooltipElem.setAttribute('style', `left:${Math.min(maxWidth-width, Math.max(((coords.left|0) + gutterWidth) - width/2, gutterWidth))}px; top:${(coords.top|0) + 24}px;`);
		}
	}
	// This can only be loaded in TwineJS, not any other place.
	if (this && this.loaded) {
		this.modules || (this.modules = {});
		({ShortDefs} = this.modules);
		this.modules.Tooltips = Tooltips;
	}
}.call(eval('this')));
