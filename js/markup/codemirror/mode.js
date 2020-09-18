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
	// Loaded as a story format in TwineJS
	else if (this && this.loaded && this.modules) {
		// Only load the toolbar/tips if this is loaded in TwineJS
		({Markup:{lex}, Toolbar:toolbar, Tooltips:tooltips, ShortDefs:shortDefs} = this.modules);
	}
	// Loaded in HarloweDocs's preview pane.
	else if (this.TwineMarkup) {
		lex = this.TwineMarkup.lex;
		shortDefs = this.ShortDefs;
	}
	/*
		Produce an object holding macro names, using both their names and their aliases.
	*/
	const validMacros = Object.entries(shortDefs.Macro).reduce((a,[name,macro])=> {
		[name, ...macro.aka].forEach(name => a[name] = macro);
		return a;
	}, {});
	
	/*
		The mode is defined herein.
	*/
	window.CodeMirror && CodeMirror.defineMode('harlowe-3', () => {
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
					cm = CodeMirror.modes['harlowe-3'].cm;
					cm.setOption('placeholder', [
						"Enter the body text of your passage here.",
						"''Bold'', //italics//, ^^superscript^^, ~~strikethrough~~, and <p>HTML tags</p> are available.",
						"To display special symbols without them being transformed, put them between `backticks`.",
						"To link to another passage, write the link text and the passage name like this: [[link text->passage name]]\nor this: [[passage name<-link text]]\nor this: [[link text]].",
						"Macros like (set:) and (display:) are the programming of your passage. If you've (set:) a $variable, you can just enter its name to print it out.",
						"To make a 'hook', put [single square brackets] around text - or leave it empty [] - then put a macro like (if:), a $variable, or a |nametag> outside the front, |like>[so].",
						"Hooks can be used for many things: showing text (if:) something happened, applying a (text-style:), making a place to (append:) text later on, and much more!",
						"Consult the Harlowe documentation for more information.",
						].join('\n\n'));
					/*
						Line numbers aren't important for a primarily prose-based form as passage text,
						but it's good to have some UI element that distinguishes new lines from
						wrapped lines. So, we use the CM lineNumbers gutter with only bullets in it.
					*/
					cm.setOption('lineNumbers', true);
					cm.setOption('lineNumberFormatter', () => "\u2022");
				}
				/*
					Install the toolbar, if it's been loaded. (This function will early-exit if the toolbar's already installed.)
				*/
				toolbar && toolbar(cm);

				return {
					pos: 0,
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
					const type = currentBranch[i].type;
					let name = "harlowe-3-" + type;
					counts[name] = (counts[name] || 0) + 1;
					// If this name has been used earlier in the chain, suffix
					// this name with an additional number.
					if (counts[name] > 1) {
						name += "-" + (counts[name]);
					}
					switch(type) {
						/*
							Use the error style if the macro's name doesn't match the list of
							existant Harlowe macros.
						*/
						case "macroName":
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
					ret += name + " ";
				}
				return ret;
			},
		};
	});
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
