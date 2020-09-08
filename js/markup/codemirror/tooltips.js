/*jshint strict:true*/
(function() {
	'use strict';
	let ShortDefs;
	const insensitiveName = e => (e + "").toLowerCase().replace(/-|_/g, "");
	const docsURL = (anchor, contents) => `<a href="https://twine2.neocities.org/#${anchor}" target="_blank" rel="noopener noreferrer">${contents}</a>`;

	const tooltipMessages = {
		hr:                  "horizontal rule",
		bulleted:            "bulleted list item",
		numbered:            "numbered list item",
		heading:             ({depth}) => `level ${depth} ${depth===1 ? "(largest) " : ""}heading`,
		align:               ({align}) => `aligner (${align})`,
		column:              ({width, marginRight, marginLeft}) => `column (width ${width}, left margin ${marginLeft}em, right margin ${marginRight}em)`,
		twine1Macro:         "erroneous SugarCube macro",
		em:                  "emphasis style",
		strong:              "strong emphasis style",
		bold:                "bold style",
		italic:              "italic style",
		strike:              "strikethrough style",
		sup:                 "superscript style",
		comment:             "HTML comment",
		scriptStyleTag:      "HTML tag",
		tag:                 "HTML tag",
		url:                 "URL",
		hook:                () => `hook`,
		unclosedHook:        () => `unclosed hook`,
		verbatim:            "verbatim markup",
		unclosedCollapsed:   `unclosed collapsed whitespace markup`,
		collapsed:           `collapsed whitespace markup`,
		escapedLine:         `escaped line break`,
		legacyLink:          ({passage}) => `passage link to "${passage}"`,
		passageLink:         ({passage}) => `passage link to "${passage}"`,
		simpleLink:          ({passage}) => `passage link to "${passage}"`,
		br:                  ``, // Display nothing,
		variable:            `story-wide variable`,
		tempVariable:        `temp variable`,
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
		string:              `string`,
		hookName:            `hook name`,
		cssTime:             () => `number (CSS time format)`,
		datatype:            `datatype data`,
		colour:              `colour data`,
		number:              `number data`,
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
				return `Erroneous macro name`;
			}
			return `<code style='display:block'>${
					docsURL(defs.anchor, `(${defs.name}: ${defs.sig}) -> ${defs.returnType}`)
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
