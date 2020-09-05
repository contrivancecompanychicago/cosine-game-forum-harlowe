/*jshint strict:true*/
(function() {
	'use strict';

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
		br:                  `line break`,
		macro:               ({name}) => `(${name}:) macro call`,
		variable:            `story-wide variable`,
		tempVariable:        `temp variable`,
		macroName:           `macro name`,
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
	};

	const tooltipElem = document.createElement("div");
	tooltipElem.className = "harlowe-3-tooltip";

	function Tooltips(cm, doc, tree) {
		tooltipElem.setAttribute('style', 'display:none');
		if (doc.somethingSelected()) {
			return;
		}
		if (tooltipElem.compareDocumentPosition(document) & 1) {
			document.querySelector('.CodeMirror').append(tooltipElem);
		}
		const cursor = doc.getCursor();
		const token = tree.tokenAt(doc.indexFromPos(cursor));
		if (!token) {
			return;
		}
		let message = tooltipMessages[token.type];
		if (typeof message === 'function') {
			message = message(token);
		}
		if (message) {
			tooltipElem.textContent = message;
			tooltipElem.removeAttribute('hidden');
			const {width} = tooltipElem.getBoundingClientRect();
			const coords = cm.charCoords(cursor, 'local');
			const gutterWidth = 29;
			tooltipElem.setAttribute('style', `left:${(coords.left|0) + gutterWidth - width/2}px; top:${(coords.top|0) + 24}px;`);
		}
	}

	// This can only be loaded in TwineJS, not any other place.
	if (this && this.loaded) {
		this.modules || (this.modules = {});
		this.modules.Tooltips = Tooltips;
	}
}.call(eval('this')));
