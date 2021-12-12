/*jshint strict:true*/
(function() {
	'use strict';
	/*
		First, a preamble of helpers.
		
		This is a copy of Utils.insensitiveName(), used to check macro names.
	*/
	const insensitiveName = (e) => (e + "").toLowerCase().replace(/-|_/g, "");

	/*
		Import the TwineMarkup lexer function, and store it locally.
	*/
	let lex, toolbar, tooltips, shortDefs;
	if(typeof module === 'object') {
		({lex} = require('../lexer'));
	}
	else if(typeof define === 'function' && define.amd) {
		define('markup', [], (markup) => {
			lex = markup.lex;
		});
	}
	// Loaded as a story format in TwineJS (any ver) or in HarloweDocs's preview pane.
	else {
		({Markup:{lex}, Toolbar:toolbar, Tooltips:tooltips, ShortDefs:shortDefs} = (this.modules || this));
	}
	/*
		Produce an object holding macro names, using both their names and their aliases.
	*/
	const validMacros = Object.entries(shortDefs.Macro).reduce((a,[name,macro])=> {
		[name, ...macro.aka].forEach(name => a[name] = macro);
		return a;
	}, {});
	/*
		Produce an array holding just Changer or Any macro names, used to determine if the Changer attachment line should be drawn.
	*/
	const changerMacros = Object.entries(validMacros).filter(([name,macro]) => ["Changer","Any"].includes(macro.returnType)).map(e => e[0]);

	/*
		The mode is defined herein.
	*/
	const mode = () => {
		let cm, tree,
			// These caches are used to implement special highlighting when the cursor
			// rests on variables or hookNames, such that all the other variable/hook
			// tokens are highlighted as well.
			referenceTokens = {
				variable: [],
				tempVariable: [],
				hook: [],
				hookName: [],
				clear() {
					this.variable = [];
					this.tempVariable = [];
					this.hook = [];
					this.hookName = [];
				}
			};

		function lexTreePostProcess(token) {
			if (token.type === "variable" || token.type === "tempVariable"
					|| token.type === "hook" || token.type === "hookName") {
				referenceTokens[token.type].push(token);
			}
			/*
				Don't syntax-highlight the interiors of strings.
			*/
			if (token.type === "string") {
				/*
					Invalidate both the childAt cache and the children array.
				*/
				token.childAt = undefined;
				token.children = [];
			}
			token.children.forEach(lexTreePostProcess);
		}
		function lexTree(str) {
			const tree = lex(str);
			referenceTokens.clear();
			tree.children.forEach(lexTreePostProcess);
			return tree;
		}
		
		/*
			This 'beforeChange' event handler applies a hack to CodeMirror to force it
			to rerender the entire text area whenever a change is made, not just the change.
			This allows 'backtrack' styling, such as unclosed brackets, to be possible
			under CodeMirror.
		*/
		function forceFullChange(changeObj, oldText) {
			if (!changeObj.update) {
				return;
			}
			/*
				First, obtain the text area's full text line array, truncated
				to just the line featuring the change.
			*/
			const line = changeObj.from.line;
			
			let newText = oldText
				.split('\n')
				.slice(0, changeObj.from.line + 1);
			
			/*
				Join it with the change's text.
			*/
			newText[line] =
				newText[line].slice(0, changeObj.from.ch)
				+ changeObj.text[0];
			
			/*
				If the change is multi-line, the additional lines should be added.
			*/
			newText = newText.concat(changeObj.text.slice(1));
			
			/*
				Now, register this change.
			*/
			changeObj.update({line:0, ch:0}, changeObj.to, newText);
			
			return newText.join('\n');
		}

		/*
			This 'cursorActivity' event handler applies CodeMirror marks based on
			the token that the cursor is resting on.
		*/
		let cursorMarks = [];
		function cursorMarking(doc, tree) {
			if (cursorMarks.length) {
				cursorMarks.forEach(mark => mark.clear());
				cursorMarks = [];
			}
			const token = tree.tokenAt(doc.indexFromPos(doc.getCursor()));
			// If the cursor is at the end of the passage, or there is no text, then
			// the returned token will be null.
			if (!token) {
				return;
			}
			/*
				First, mark the containing token for the cursor's current position.
				This illuminates the boundaries between tokens, and provides makeshift
				bracket/closer matching.
			*/
			cursorMarks.push(doc.markText(
				doc.posFromIndex(token.start),
				doc.posFromIndex(token.end),
				{className: 'cm-harlowe-3-cursor'}
			));
			/*
				If the token is a variable or hookName, then
				highlight certain other instances in the text.
				For variables, hooks and hookNames, highlight all other occurrences of
				the variable in the passage text.
			*/
			if (token.type === "variable" || token.type === "tempVariable"
					|| token.type === "hookName" || token.type === "hook") {
				// <hooks| should highlight matching ?hookNames.
				const type = token.type === "hook" ? "hookName" : token.type;
				referenceTokens[type].forEach(e => {
					if (e !== token && e.name === token.name) {
						cursorMarks.push(doc.markText(
							doc.posFromIndex(e.start),
							doc.posFromIndex(e.end),
							{className: 'cm-harlowe-3-variableOccurrence'}
						));
					}
				});
			}
			/*
				Also for hookNames and hooks, highlight the nametags of the
				named hook(s) that match this one's name.
			*/
			if (token.type === "hookName" || token.type === "hook") {
				referenceTokens.hook.forEach(e => {
					if (e !== token && e.name && e.name === token.name) {
						const tagStart =
							// This assumes that the end of the hook's text consists of its <tag|,
							// and nothing else.
							e.tagPosition === "appended" ? (e.end - e.name.length) - 1
							// This assumes that the start of the hook's text is its |tag>.
							: e.start + 1;

						cursorMarks.push(doc.markText(
							doc.posFromIndex(tagStart),
							doc.posFromIndex(tagStart + e.name.length),
							{className: 'cm-harlowe-3-hookOccurrence'}
						));
					}
				});
			}
		}

		/*
			Perform specific style alterations based on certain specific token types.
		*/
		function renderLine(_, __, lineElem) {
			Array.from(lineElem.querySelectorAll('.cm-harlowe-3-colour')).forEach(elem => {
				/*
					It may be a bit regrettable that the fastest way to get the HTML colour of a Harlowe
					colour token is to re-lex it separately from the tree, but since it's a single token, it should nonetheless be quick enough.
					(Plus, colour tokens are relatively rare in most passage prose).
				*/
				const {colour} = lex(elem.textContent, 0, "macro").tokenAt(0);
				/*
					The following CSS produces a colour stripe below colour literals, which doesn't interfere with the cursor border.
				*/
				elem.setAttribute('style', `background:linear-gradient(to bottom,transparent,transparent 80%,${colour} 80.1%,${colour})`);
			});
		}
		
		let init = () => {
			const doc = cm.doc;
			/*
				Use the Harlowe lexer to compute a full parse tree.
			*/
			tree = lexTree(doc.getValue());

			/*
				Attach the all-important beforeChanged event, but make sure it's only attached once.
				Note that this event is removed by TwineJS when it uses swapDoc to dispose of old docs.
			*/
			doc.on('beforeChange', (_, change) => {
				const oldText = doc.getValue();
				forceFullChange(change, oldText);
			});
			doc.on('change', () => {
				const text = doc.getValue();
				tree = lexTree(text);
			});
			doc.on('cursorActivity', () => {
				cursorMarking(doc, tree);
				tooltips && tooltips(cm, doc, tree);
			});
			cm.on('renderLine', renderLine);
			// Remove the toolbar, if it exists.
			// This can't actually be in the Tooltips module because it must only be installed once.
			cm.on('scroll', () => {
				const tooltip = document.querySelector('.harlowe-3-tooltip');
				tooltip && tooltip.remove();
			});
			// Remove the Insert key mode.
			cm.addKeyMap({ Insert(){} });
			cm.toggleOverwrite(false);
			init = null;
		};
		
		return {
			/*
				The startState is vacant because all of the computation is done
				inside token().
			*/
			startState() {
				if (!cm) {
					/*
						CodeMirror doesn't allow modes to have full access to the text of
						the document. This hack overcomes this respectable limitation:
						TwineJS's PassageEditor stashes a reference to the CodeMirror instance in
						the Harlowe modes object - and here, we retrieve it.
					*/
					cm = document.querySelector('.CodeMirror').CodeMirror;
				}
				/*
					Install the toolbar, if it's been loaded. (This function will early-exit if the toolbar's already installed.)
				*/
				toolbar && toolbar(cm);

				return {
					pos: 0,
					/*
						This is used to (somewhat crudely) keep track of possible changer attachment.
					*/
					attachment: false,
				};
			},
			blankLine(state) {
				state.pos++;
			},
			token: function token(stream, state) {
				if (init) {
					init();
				}
				/*
					We must render each token using the cumulative styles of all parent tokens
					above it. So, we obtain the full path.
				*/
				const currentBranch = tree.pathAt(state.pos);
				// The path is deepest-first - the bottom token is at 0.
				const currentToken = currentBranch[0];
				
				/*
					If, say, the doc had no text in it, the currentToken would be null.
					In which case, quit early.
				*/
				if (!currentToken) {
					state.pos++;
					stream.next();
					return null;
				}
				/*
					Advance pos until the end of this token. This is determined by either:
					- the pos reaching the current token's end,
					- the currentToken's children suddenly appearing as the deepest
					token at the pos.
					- the pos reaching the line's end,
					currentToken.tokenAt() handles the first and second cases.
				*/
				while(currentToken === currentToken.tokenAt(state.pos)
						&& !stream.eol()) {
					state.pos++;
					stream.next();
				}
				if (stream.eol()) {
					state.pos++;
				}
				/*
					For performance paranoia, this is a plain for-loop.
				*/
				let counts = {};
				let ret = '';
				for (let i = 0; i < currentBranch.length; i+=1) {
					const {type,text} = currentBranch[i];
					// If the type is "verbatim", erase all of the class names before it.
					if (type === "verbatim") {
						ret = '';
					}
					// If the type is not "escapedLine" or "br", or if it's text that trims to "+", assume the end of changer attachment.
					if (i === 0 && state.attachment && (type !== "escapedLine" && type !== "br" && type !== "root" && (type !== "text" || !text.match(/^\s*\+?\s*$/)))) {
						state.attachment = false;
					}
					let name = "harlowe-3-" + type;
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
									name += " harlowe-3-error";
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
								name += " harlowe-3-customMacro harlowe-3-" + (firstGlyph === "_" ? "tempV" : "v") + "ariable";
								break;
							}
							const macroName = insensitiveName(currentBranch[i].text.slice(0,-1));
							if (!validMacros.hasOwnProperty(macroName)) {
								name += " harlowe-3-error";
							}
							else {
								/*
									Colourise macro names based on the macro's return type.
									This is done by concatenating the cm-harlowe-3-macroName class
									with an additional modifier containing the return type.
								*/
								name += "-" + validMacros[macroName].returnType.toLowerCase();
							}
							break;
						}
						case "macro": {
							/*
								If this macro is a Changer or an Any macro, then shakily assume that from here
								on begins changer attachment whitespace.
							*/
							const macroName = insensitiveName(currentBranch[i].children[0].text.slice(0,-1));
							if (!changerMacros.includes(macroName)) {
								break;
							}
						}
						/* falls through */
						case "variable":
						case "tempVariable":
							/*
								For variables, it can only be a shaky presumption that they contain changers. Nevertheless,
								it's often vital to show it anyway.
							*/
							if (i === 0 && state.pos === currentBranch[i].end) {
								state.attachment = true;
							}
							break;
					}
					ret += name + " ";
				}
				/*
					Finally, put on the changerAttachment class if there's currently changer attachment being speculated.
				*/
				if (state.attachment === true) {
					ret += " harlowe-3-changerAttachment";
					/*
						In order to enable the tooltips to produce a unique text tooltip for changer attachment lines,
						the tree needs to be crudely modified here. All this would be avoided if changer attachment was
						part of the lexer, but, alas...
					*/
					currentToken.changerAttachment = true;
				}
				return ret;
			},
		};
	};
	if (window && window.CodeMirror) {
		window.CodeMirror.defineMode('harlowe-3', mode);
	} else {
		this.editorExtensions = {
			twine: {
				"2.4.0-beta1": {
					codeMirror: {
						mode,
					},
				},
			},
		};
	}
	/*
		In order to provide styling to the Harlowe mode, CSS must be dynamically injected
		when the mode is defined. This is done now, by creating a <style> element with ID
		"cm-harlowe" and placing our CSS in it.
	*/
	/*
		If the style element already exists, it is reused. Otherwise, it's created.
	*/
	let harloweStyles = document.querySelector('style#cm-harlowe-3');
	if (!harloweStyles) {
		harloweStyles = document.createElement('style');
		harloweStyles.setAttribute('id','cm-harlowe-3');
		document.head.appendChild(harloweStyles);
	}
	/*
		The "CODEMIRRORCSS" string is replaced with the output of the script "codemirrorcss.js".
	*/
	harloweStyles.innerHTML = "CODEMIRRORCSS";
}.call(eval('this')));
