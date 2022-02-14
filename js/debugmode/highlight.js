"use strict";
define(['jquery','utils','utils/typecolours','macros','lexer'], ($,{insensitiveName}, {versionClass}, Macros, {lex}) => {
	/*
		This module holds a very simple syntax highlighter for use exclusively in Debug Mode.
	*/

	/*
		This is mostly the same as the algorithm used in codemirror/mode, but with changer attachment not tracked.
	*/
	function highlightClasses(currentBranch) {
		let counts = {};
		let ret = '';
		for (let i = 0; i < currentBranch.length; i+=1) {
			const {type,text} = currentBranch[i];
			// If the type is "verbatim", erase all of the class names before it.
			if (type === "verbatim") {
				ret = '';
			}
			let name = versionClass + type;
			counts[name] = (counts[name] || 0) + 1;
			// If this name has been used earlier in the chain, suffix
			// this name with an additional number.
			if (counts[name] > 1) {
				name += "-" + (counts[name]);
			}
			switch(type) {
				/*
					It's an error if a text node appears inside a macro, but not inside a code hook.
				*/
				case "text": {
					if (text.trim()) {
						const insideMacro = currentBranch.slice(i + 1).reduce((a,t) =>
								a === undefined ? t.type === "macro" ? true : t.type === "hook" ? false : a : a,
								undefined
							);
						if (insideMacro) {
							name += ` ${versionClass}error`;
						}
					}
					break;
				}
				/*
					Use the error style if the macro's name doesn't match the list of
					existant Harlowe macros.
				*/
				case "macroName": {
					const firstGlyph = currentBranch[i].text[0];
					if (firstGlyph === "_" || firstGlyph === "$") {
						name += ` ${versionClass}customMacro ${versionClass + (firstGlyph === "_" ? "tempV" : "v")}ariable`;
						break;
					}
					const macroName = insensitiveName(currentBranch[i].text.slice(0,-1));
					if (!Macros.has(macroName)) {
						name += ` ${versionClass}error`;
					}
					else {
						/*
							Colourise macro names based on the macro's return type.
							This is done by concatenating the cm-harlowe-3-macroName class
							with an additional modifier containing the return type.
						*/
						name += "-" + Macros.get(macroName).returnType.toLowerCase();
					}
					break;
				}
			}
			ret += name + " ";
		}
		return ret;
	}
	/*
		This module returns a single syntax highlighting function, with optional marking of a subsection.
		This returns a plain array of <span> (or <mark>) elements containing the syntax-highlighted code.
		Note that this assumes the markStart and markEnd positions are exactly at token boundaries.
	*/
	return function Highlight(code, markStart, markEnd) {
		/*
			First, lex the full code to get a tree.
		*/
		const root = lex(code,'','macro');
		const spans = [];
		let currentSpanText = '';
		let currentBranch = root;
		for (let pos = root.start; pos < root.end; pos += 1) {
			const branch = root.pathAt(pos);
			/*
				For each position, if the bottommost token changed, create a new <span> and give it the CSS classes for this branch. 
				Remember that pathAt() returns a bottom-first array, with the bottom token at 0.
			*/
			if (branch[0] !== currentBranch[0]) {
				/*
					Finalise the text of this <span> before creating the next.
				*/
				spans.length && (spans[spans.length-1].textContent = currentSpanText);
				currentSpanText = '';
				currentBranch = branch;
				/*
					Marked <span>s simply become <mark> elements.
				*/
				spans.push($(`<${markEnd && pos >= markStart && pos <= markEnd ? 'mark' : 'span'} class="${highlightClasses(currentBranch)}">`)[0]);
			}
			/*
				Otherwise, simply progressively add to the text of this <span>.
			*/
			currentSpanText += root.text[pos - root.start];
		}
		/*
			Finish the final <span>.
		*/
		spans.length && (spans[spans.length-1].textContent = currentSpanText);
		return spans;
	};
});