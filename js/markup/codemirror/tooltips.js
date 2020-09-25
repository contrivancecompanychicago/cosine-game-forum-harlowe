/*jshint strict:true*/
(function() {
	'use strict';
	let ShortDefs;
	const insensitiveName = e => (e + "").toLowerCase().replace(/-|_/g, "");
	const docsURL = (anchor, contents) => `<a href="https://twine2.neocities.org/#${anchor}" target="_blank" rel="noopener noreferrer">${contents}</a>`;

	const enclosedText = "This markup gives the enclosed text ";
	const producesBooleanTrueIf = c => `The <b>"${c}" operator</b> produces the boolean value \`true\` if `;
	const otherwiseFalse = ` Otherwise, it produces \`false\`.`;
	const lambdaClause = c => `The keyword <b>"${c}"</b> makes the code on the right into a <b>"${c}" lambda clause</b>. `;
	const tooltipMessages = {
		hr:                  "This is a <b>horizontal rule</b>.",
		bulleted:            "The `*` at the start of this line makes this a <b>bulleted list item</b>.",
		numbered:            "The `0.` at the start of this line makes this a <b>numbered list item</b>.",
		heading:             ({depth}) => `This is a <b>level ${depth} ${depth===1 ? "(largest) " : ""}heading</b> mark.`,
		align:               ({align}) => `This is an <b>aligner</b> mark. The text after this is ${align === "justify" ? "justified (spaced out to touch both edges)" : `aligned to the ${align}`}. `
								+ "Write `<==` for left alignment, `==>` for right alignment, `=><=` for centering, and `<==>` for justified alignment.",
		column:              ({text, width, marginRight, marginLeft}) =>
								text.trim().startsWith("|") && text.trim().endsWith("|") ? "This mark ends all of the preceding columns. The text after this is not in a column."
								: `The text after this mark is in a <b>column</b> with width multiplier ${width}x, a left margin of ${marginLeft}em, and a right margin of ${marginRight}em. `
								+ "Write more consecutive `|` marks to increase the width, and place `=` to the left and right to increase the margin on that side.",
		em:                  enclosedText + "<b>emphasis style</b>.",
		strong:              enclosedText + "<b>strong emphasis style</b>.",
		bold:                enclosedText + "<b>bold style</b>.",
		italic:              enclosedText + "<b>italic style</b>.",
		strike:              enclosedText + "<b>strikethrough style</b>.",
		sup:                 enclosedText + "<b>superscript style</b>.",
		comment:             "This is a <b>HTML comment</b>. Everything inside it will be ignored by Harlowe.",
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
		twineLink:           ({passage}) => `This is a link to the passage "${passage}". Links, like hooks and commands, can have changer values attached to the front.`,
		br:                  ``, // Display nothing,
		url:                 ``,
		variable:            `This is a <b>story-wide variable</b>. After this has been set to a data value, it can be used anywhere else in the story. Use these to store values related to your story's game state.`,
		tempVariable:        `This is a <b>temp variable</b>. It can be used in the same passage and hook in which it's first set to a data value. Use these to store values temporarily, or that won't be needed elsewhere.`,
		macroName:           (_,[,parent]) => tooltipMessages.macro(parent),
		grouping:            `Use these <b>grouping brackets</b> to ensure operations are performed in a certain order. Code in brackets will be computed before the code adjacent to it.`,
		property:            ({type, name}) => (name ? `This retrieves the data stored at <b>the \`${name}\` ${
										name.match(/^\d+(?:th|nd|st|rd)(?:last)?(?:to\d+(?:nth|nd|st|rd)(?:last)?)?$/g) ? `position${name.includes('to') ? 's' : ''}` : 'name'
									}</b> of the container value on the ${type.startsWith('belonging') ? "right" : "left"}.<br><br>` : '')
								+ "Some data values (arrays, datamaps, datasets, strings, colours, gradients, custom macros, and typed variables) are also storage containers for other values. "
								+ "You can access a specific value stored in them by using that value's <b>data name</b> (or a string or number value in brackets) by writing <i>value</i> `'s` <i>name</i>, or <i>name</i> `of` <i>value</i>.",
		possessiveOperator:  token => tooltipMessages.property(token),
		itsProperty:         token => tooltipMessages.property(token),
		itsOperator:         token => tooltipMessages.identifier(token),
		belongingItProperty: token => tooltipMessages.property(token),
		belongingItOperator: token => tooltipMessages.property(token),
		belongingProperty:   token => tooltipMessages.property(token),
		belongingOperator:   token => tooltipMessages.property(token),
		escapedStringChar:   ``,
		string:              `This is <b>string data</b>. Strings are sequences of text data enclosed in matching " or ' marks. Use a \`\\\` inside a string to "escape" the next character. Escaped " or ' marks don't count as the end of the string.`,
		hookName:            ({name}) => `This <b>hook name</b> refers to all hooks named "\`${name}\`" in this passage.`,
		cssTime:             ({value}) => `This is <b>number data</b> in CSS time format. Harlowe automatically converts this to a number of milliseconds, so this is identical to ${value}.`,
		datatype:            `This is the name of a <b>datatype</b>. Use these names to `,
		colour:              ({text}) => `This is a ` + (text.startsWith('#')
								? "<b>HTML colour value</b>. Harlowe can use this as colour data."
								: `built-in Harlowe <b>colour value</b>. The built-in colours are \`red\`, \`orange\`, \`yellow\`, \`lime\`, \`green\`, \`cyan\` (alias \`aqua\`), \`blue\`, \`navy\`, \`purple\`, \`fuchsia\` (alias \`magenta\`), \`white\`, \`gray\` (alias \`grey\`), \`black\`, and \`transparent\`.`),
		number:              `This is <b>number data</b>. Harlowe supports whole numbers (like \`2\`), negative numbers (like \`-2\`), and numbers with a decimal fraction component (like \`2.2\`).`,
		inequality:          ({operator, negate}) => {
			operator = (negate ? ({
					'>' :     '<=',
					'<' :     '>=',
					'>=':     '<',
					'<=':     '>',
				}[operator]) : operator);
			const operatorEng = (operator[0] === ">" ? "greater " : "less ") + "than" + (operator.endsWith('=') ? " or equal to" : "");
			return producesBooleanTrueIf(operatorEng) + ` the number value on the left is ${operatorEng} the number value on the right.` + otherwiseFalse;
		},
		augmentedAssign:     `This is an <b>augmented assignment operator</b>, similar to the ones in Javascript.`,
		identifier: ({text}) => {
			text = insensitiveName(text);
			if (text === "it" || text === "its") {
				return `The keyword <b>it</b> is a shorthand for the leftmost part of an operation. You can write \`(if: $candles < 2 and it > 5)\` instead of \`(if: $candles < 2 and $candles > 5)\` `
					+ `or \`(set: $candles to it + 3)\` instead of \`(set: $candles to $candles + 3)\`. When accessing a data value from it, you can write it as <b>its</b>, such as in \`its length > 0\`.`;
			}
			if (text === "time") {
				return `The keyword <b>time</b> equals the number of milliseconds passed since the passage was displayed.`;
			}
			if (text === "exits") {
				return `The keyword <b>exits</b> or <b>exit</b> equals the number of currently available "exits" in a passage - the number of`
					+ ` link, mouseover, and mouseout elements that are still active on the page, which could lead to new content and progress.`;
			}
			if (text === "visit") {
				return `The keyword <b>visits</b> or <b>visit</b> equals the number of times the current passage has been visited this game, including the current visit.`
					+ ` In \`(storylet:)\` macros, when Harlowe decides whether this passage is available to \`(open-storylets:)\`, this will often be 0, but when actually visiting the passage, it will be at least 1.`;
			}
			if (text === "pos") {
				return `The keyword <b>pos</b> should ONLY be used within a "where" or "via" lambda clause. It refers to the position of the current data value that this lambda is processing.`;
			}
			return '';
		},
		whitespace:          `<b>Whitespace</b> within macro calls is simply used to separate values. You can use as much or as little as you like to make your code more readable.`,
		error:               (_,[{message, explanation}]) => message + (explanation ? "<br>" + explanation : ''),
		boolean:             `The keywords <b>true</b> or <b>false</b> are the two <b>boolean values</b>. They are produced by inequality operators and other macros.`,
		is:                  `The <b>"is" operator</b> produces the boolean value \`true\` if the values on each sides of it are exactly the same.` + otherwiseFalse,
		to:                  `Use the <b>"to" operator</b> only inside a \`(set:)\` macro call. Place it to the left of the data, and right of the variable to set the data to.`,
		into:                `Use the <b>"into" operator</b> only inside a \`(put:)\`, \`(move:)\` or \`(unpack:)\` macro call. Place it to the right of the data, and left of the destination to put the data.`,
		where:               lambdaClause('where') + `This lambda will search for input values <i>where</i> the right side, once computed, produces \`true\`.`,
		when:                lambdaClause('when') + `This lambda will cause the macro to only do something <i>when</i> the right side, once computed, produces \`true\`.`,
		via:                 lambdaClause('via') + `This lambda will convert input values into new values <i>via</i> computing the expression to the right.`,
		making:              lambdaClause('making') + `This is used only by the \`(folded:)\` macro. The lambda <i>makes</i> the temp variable on the right, which becomes the final value of the \`(folded:)\` call.`,
		each:                lambdaClause('each') + `This causes the macro to, for <i>each</i> input value, place that value in the temp variable on the right, before running the other lambda clauses adjacent to this one (if any).`,
		and:                 producesBooleanTrueIf('and') + `the values on each side of it are both \`true\`.` + otherwiseFalse,
		or:                  producesBooleanTrueIf('or') + `the values on each side of it are both \`false\`.` + otherwiseFalse,
		not:                 `The <b>"not" operator</b> inverts the boolean value to its right, turning \`true\` to \`false\` and vice-versa.`,
		isNot:               producesBooleanTrueIf('is not') + `the values on each sides of it are NOT exactly the same.` + otherwiseFalse,
		contains:            producesBooleanTrueIf('contains') + `the array, string, datamap or dataset on the left contains the data on the right.` + otherwiseFalse,
		doesNotContain:      producesBooleanTrueIf('does not contain') + `the array, string, datamap or dataset on the left does NOT contain the data on the right.` + otherwiseFalse,
		isIn:                producesBooleanTrueIf('is in') + `the data on the left is in the array, string, datamap or dataset on the right.` + otherwiseFalse,
		isA:                 producesBooleanTrueIf('is a') + "the data on the left matches the datatype on the right." + otherwiseFalse,
		isNotA:              producesBooleanTrueIf('is not a') + "the data on the left does NOT match the datatype on the right." + otherwiseFalse,
		isNotIn:             producesBooleanTrueIf('is not in') + `the data on the left is NOT in the array, string, datamap or dataset on the right.` + otherwiseFalse,
		matches:             producesBooleanTrueIf('matches') + "one side describes the other - that is, if one side is a datatype that describes the other, "
								+ "or both sides are arrays, datamaps, or datasets, with data in positions that matches those in the other, or if both sides are equal." + otherwiseFalse,
		doesNotMatch:        producesBooleanTrueIf('does not match') + "one side does NOT describe the other." + otherwiseFalse,
		bind:                `The <b>bind</b> or <b>2bind</b> keyword specifies that the variable to the right should be "bound" to an interactable element. This is used only by certain command macros, like \`(dialog:)\` or \`(cycling-link:)\`.`,
		comma:               `Use <b>commas</b> to separate the values that you give to macro calls.`,
		spread:              `This is a <b>spreader</b> These spread out the values in the array, string or dataset to the right of it, as if each value was individually placed in the call and separated with commas.`
								+ `<br><br>Alternatively, if a datatype is to the right of it, that datatype becomes a <b>spread datatype</b> that matches zero or more of itself.`,
		typeSignature:       `The <b>-type</b> suffix is used to restrict the variable on the right to only holding data that matches the data pattern on the left. Variables restricted in this way are called <b>typed variables</b>.`,
		addition:            `Use the <b>addition operator</b> to add two numbers together, as well as join two strings or two arrays, and combine two datamaps, two datasets, two changers, or two colours.`
								+ `This operator can also combine two hook names, creating a hook name that applies to both names of hooks.`,
		subtraction:         `Use the <b>subtraction operator</b> to subtract two numbers, as well as create a copy of the array or dataset on the left that doesn't contain values of the array or dataset on the right.`,
		multiplication:      `Use the <b>multiplication operator</b> to multiply two numbers.`,
		division:            `Use the <b>division operator</b> to divide two numbers. Dividing a number by 0 produces an error.`,
		macro: ({name}) => {
			if (name === undefined) {
				return `This macro call is incomplete or erroneously written. Macro calls should consist of \`(\`, the name (which is case-insensitive and dash-insensitive), \`:\`, zero or more expressions separated by commas, then \`)\`, in that order.`;
			}
			const defs = ShortDefs.Macro[insensitiveName(name)];
			if (!defs) {
				return `This is a call to a nonexistent or misspelled macro. This will cause an error.`;
			}
			const rt = defs.returnType.toLowerCase();
			return `This is a <b>call to the \`(${defs.name}:)\` macro</b>. ${
					rt === "instant" || rt === "command" ? `It produces a <span class="cm-harlowe-3-macroName-command">command</span>, so it should appear in passage code without being connected to a hook.` :
					rt === "changer" ? `It produces a <span class="cm-harlowe-3-macroName-changer">changer</span>, which can be placed in front of a hook, or combined with other changers.` :
					rt === "any" || rt === "string" ? "" :
					`Since it produces a <span class="cm-harlowe-3-macroName-${rt}">${rt}</span>, it should be nested inside another macro call that can use ${rt} (or any) data.`
				}<code class='harlowe-3-tooltipMacroSignature'>${
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
			message = message.replace(/`([^`]+)`/g, (_, inner) => `<code>${inner}</code>`);

			tooltipElem.innerHTML = message + "<div class=harlowe-3-tooltipTail>";
			tooltipElem.removeAttribute('style');
			const {width} = tooltipElem.getBoundingClientRect();
			const {width:maxWidth} = cmElem.getBoundingClientRect();
			const coords = cm.charCoords(cursor, 'local');
			const gutterWidth = 30;
			const tipLeft = Math.min(maxWidth-width, Math.max(((coords.left|0) + gutterWidth) - width/2, gutterWidth));
			tooltipElem.setAttribute('style', `left:${tipLeft}px; top:${(coords.top|0) + 30 - cmElem.querySelector('.CodeMirror-scroll').scrollTop}px;`);
			// Place the tail at the correct location;
			tooltipElem.lastChild.setAttribute('style', `left:${coords.right - tipLeft + (coords.right - coords.left)/2 + 6}px; top:-24px`);
		}
	}
	// This can only be loaded in TwineJS, not any other place.
	if (this && this.loaded) {
		this.modules || (this.modules = {});
		({ShortDefs} = this.modules);
		this.modules.Tooltips = Tooltips;
	}
}.call(eval('this')));
