/*jshint strict:true*/
(function() {
	'use strict';
	/*
		Import the TwineMarkup lexer function, and store it locally.
	*/
	let lex, toolbar, tooltips, commands, ShortDefs, insensitiveName;
	if(typeof module === 'object') {
		({lex} = require('../lexer'));
	}
	else if(typeof define === 'function' && define.amd) {
		define('markup', [], (markup) => {
			lex = markup.lex;
		});
	}
	// Loaded in HarloweDocs's preview pane.
	else if (this.window) {
		lex = this.Markup.lex;
		({ShortDefs, insensitiveName} = this.Utils);
	}
	// Loaded as a story format in TwineJS (any ver)
	else {
		({Markup:{lex}, Toolbar:toolbar, ToolbarCommands:commands, Tooltips:tooltips, Utils:{ShortDefs, insensitiveName}} = (this.modules || this));
	}
	/*
		Produce an object holding macro names, using both their names and their aliases.
	*/
	const validMacros = Object.entries(ShortDefs.Macro).reduce((a,[name,macro])=> {
		[name, ...macro.aka].forEach(name => a[name] = macro);
		return a;
	}, {});
	/*
		The mode is defined herein.
	*/
	const mode = () => {
		let cm;

		/*
			Story data is obtained from localStorage every time the editor is opened.
		*/
		let passages;
		let passageTags;
		const storyData = () => {
			passages = new Set();
			passageTags = new Set();
			/*
				1: Find the list of all stories.
			*/
			let stories;
			try {
				stories = localStorage.getItem("twine-stories").split(',');
			} catch(e) {
				return;
			}
			/*
				2: Get the story with the most recent lastUpdate AND whose name is contained in the current window title
				(which is the only part of the 2.4 DOM that lists the current story).
				This isn't a perfect check by any means, but since this functionality provides optional extra highlighting,
				it's not too serious an issue...
			*/
			let currentStory, highestLastUpdate = 0;
			for (let story of stories) {
				try {
					story = JSON.parse(localStorage.getItem("twine-stories-" + story));
					const lastUpdate = Date.parse(story.lastUpdate);
					if (lastUpdate > highestLastUpdate && document.title.includes(story.name)) {
						currentStory = story;
						highestLastUpdate = lastUpdate;
					}
				} catch(e) {
					continue;
				}
			}
			if (!currentStory) {
				return;
			}
			/*
				3: Find the list of all passages, and add the ones that are in this story.
			*/
			try {
				for (let p of localStorage.getItem("twine-passages").split(',')) {
					p = JSON.parse(localStorage.getItem("twine-passages-" + p));
					if (p.story === currentStory.id) {
						passages.add(p.name);
						for (let t of p.tags) {
							passageTags.add(t);
						}
					}
				}
			} catch(e) {
				return;
			}
		};


		/*
			To handle 2.4's multi-editor mode, this WeakMap stores multiple parse trees (plus referenceTokens) tied to CodeMirror docs.
		*/
		const editors = new WeakMap();

		const docData = (doc) => {
			if (!editors.has(doc)) {
				/*
					Use refreshTree() to create all the relevant data structures for this doc, including the tree.
				*/
				refreshTree(doc);
			}
			return editors.get(doc);
		};

		/*
			Refresh (re-lex) an existing doc's tree.
		*/
		function refreshTree(doc) {
			let data;
			/*
				If the doc doesn't exist, quickly create it now.
			*/
			if (!editors.has(doc)) {
				data = {
					tooltipsEnabled: true,
				};
				editors.set(doc, data);
			}
			else {
				data = editors.get(doc);
			}
			data.tree = lex(doc.getValue());
			// These caches are used to implement special highlighting when the cursor
			// rests on variables or hookNames, such that all the other variable/hook
			// tokens are highlighted as well.
			data.referenceTokens = {
				variable: [],
				tempVariable: [],
				hook: [],
				hookName: [],
			};
			data.cursorMarks = [];
			data.tree.children.forEach(function lexTreePostProcess(token) {
				if (token.type === "variable" || token.type === "tempVariable"
						|| token.type === "hook" || token.type === "hookName") {
					data.referenceTokens[token.type].push(token);
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
			});
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
		function cursorMarking(doc) {
			const data = docData(doc);
			let {tree, cursorMarks, referenceTokens} = data;
			if (cursorMarks.length) {
				cursorMarks.forEach(mark => mark.clear());
				cursorMarks = data.cursorMarks = [];
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
			Find/Replace functionality.
			This is in here instead of toolbar.js because on('change') needs to re-run existing searches
			if the doc is edited while the find/replace panel is open.
			When a search is performed (using find()), currentQuery becomes a { query, regExp, onlyIn, matchCase } object,
			and a CodeMirror overlay (below) is added that highlights the matches.
		*/
		let matches = [];
		/*
			The matchIndex refers to the currently highlighted match, the target of "Replace One" operations.
		*/
		let matchIndex;
		let currentQuery;
		/*
			findFromIndex allows a search to begin from a given index, setting the matchIndex correctly.
		*/
		let findFromIndex = -1;
		const findOverlay = {
			token(stream) {
				/*
					To highlight, simply go through each match and apply the CSS class if the stream
					is inside it.
					Assumption: all matches entries are in ascending order.
				*/
				const { line } = stream.lineOracle;
				const ch = stream.pos;
				for (let i = 0; i < matches.length; i += 1) {
					const { start, end } = matches[i];

					if (start.line > line || end.line < line) {
						continue;
					}
					/*
						This checks that the stream is currently within this match's range.
						Because the end ch is noninclusive, "end.ch > ch" is used instead of "end.ch >= ch".
					*/
					if (start.line <= line && end.line >= line) {
						if ((start.line < line || start.ch <= ch) && (end.line > line || end.ch > ch)) {
							(end.line > line) ? stream.skipToEnd() : (stream.pos = end.ch);
							return (matchIndex === i) ? "harlowe-3-findResultCurrent" : "harlowe-3-findResult";
						}
						else if (start.line === line && start.ch > ch) {
							stream.pos = start.ch;
							return;
						}
					}
				}
				stream.skipToEnd();
			}
		};
		/*
			The main finding function.
			This can begin a search from a specific index (such as after using "Replace One").
		*/
		function harlowe3Find(q) {
			cm.removeOverlay(findOverlay);
			matches = [];
			matchIndex = -1;
			/*
				Don't initialise a search for "".
			*/
			if (!q.query) {
				currentQuery = undefined;
				return;
			}
			currentQuery = q;
			const {doc} = cm;
			/*
				The focused match is the one immediately after (or at) the cursor, or the first one if there is none after.
			*/
			const cursorIndex = findFromIndex > -1 ? findFromIndex : Math.max(0, doc.indexFromPos(doc.getCursor()) - 1);
			/*
				The actual work in finding the results is done using this RegExp. It is cached so that replace() can use it, too.
			*/
			q.regExp = new RegExp(q.query.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/mg, "\\$&"), q.matchCase ? "g" : "gi");
			const fullText = doc.getValue();
			const tree = docData(doc).tree;
			const {onlyIn} = q;
			let match;
			matchLoop: while ((match = q.regExp.exec(fullText))) {
				/*
					Process a result if it's at the front of the input stream.
				*/
				const matchLength = match[0].length || 1;
				const {index} = match;
				
				if (onlyIn === "Only in prose" || onlyIn === "Only in code") {
					/*
						Search for text and string tokens in the result's branch.
						If there are any, and "Only prose" is set, then break the loop (thus skipping the return at the end.)
						If there are any, and "Only code" is set, then it's invalid - end and go to the next token.
					*/
					let currentToken = tree.tokenAt(index);
					let currentBranch = tree.pathAt(index);
					for (let j = index; j < index + matchLength; j += 1) {
						if (j > currentToken.end) {
							currentToken = tree.tokenAt(j);
							currentBranch = tree.pathAt(j);
						}
						let i;
						for (i = 0; i < currentBranch.length; i+=1) {
							const {type} = currentBranch[i];
							if (type === "text" || type === "string") {
								/*
									If this is a text/string node and "Only code" is set, then it's invalid. Otherwise, it's valid.
								*/
								if (onlyIn === "Only in code") {
									continue matchLoop;
								}
								break;
							}
						}
						/*
							If no text or string tokens were found, and "Only prose" is set, then it's invalid - end and go to the next token.
						*/
						if (i === currentBranch.length && onlyIn === "Only in prose") {
							continue matchLoop;
						}
					}
				}
				/*
					Limit the search if "Only selection" is set. This requires looping through every CodeMirror selection
					(whose anchor-head order isn't obvious) and checking.
				*/
				else if (onlyIn === "Only in selection") {
					const selections = doc.listSelections();
					for (let i = 0; i < selections.length; i += 1) {
						const pos1 = doc.indexFromPos(selections[i].anchor),
							pos2 = doc.indexFromPos(selections[i].head);
						if (index >= Math.min(pos1, pos2) && index + matchLength < Math.max(pos1, pos2)) {
							break;
						}
					}
					continue matchLoop;
				}
				/*
					Add this match to the highlighter overlay's array.
				*/
				const start = doc.posFromIndex(index);
				const end = doc.posFromIndex(index + matchLength);
				matches.push({start, end});
				if (matchIndex === -1) {
					/*
						Update the matchIndex if this is the match immediately after the cursor.
					*/
					if (index > cursorIndex) {
						matchIndex = matches.length - 1;
					}
					/*
						Don't scroll into view if this is a continued search.
					*/
					if (!findFromIndex) {
						cm.scrollIntoView(start, cm.display.wrapper.offsetHeight / 2);
					}
				}
			}
			/*
				If no matchIndex was set above, set it now.
			*/
			if (matchIndex === -1) {
				matchIndex = 0;
			}
			cm.addOverlay(findOverlay);
			/*
				Reset this thing now.
			*/
			findFromIndex = -1;
		}
		function harlowe3FindNext(dir) {
			matchIndex = (matchIndex + dir) % matches.length;
			if (matchIndex < 0) {
				matchIndex += matches.length;
			}
			matches[matchIndex] && cm.scrollIntoView(matches[matchIndex].start, cm.display.wrapper.offsetHeight / 2);
			/*
				This crudely refreshes the overlay.
			*/
			cm.removeOverlay(findOverlay);
			cm.addOverlay(findOverlay);
		}
		function harlowe3Replace(newStr, all) {
			const {doc} = cm;
			const match = matches[matchIndex];
			if (!all && match) {
				findFromIndex = doc.indexFromPos(match.start) + newStr.length - 1;
				doc.replaceRange(newStr, match.start, match.end);
			}
			/*
				Due to the slow, buggy nature of bundling multiple replaceRange() calls into a CodeMirror operation(),
				this full replacement is done with a single replaceRange() that re-computes the matches using the original query RegExp.
			*/
			else if (matches.length) {
				const veryStart = matches[0].start;
				const veryEnd = matches[matches.length-1].end;
				doc.replaceRange(doc.getValue().slice(doc.indexFromPos(veryStart), doc.indexFromPos(veryEnd)).replace(currentQuery.regExp, newStr), veryStart, veryEnd);
			}
			// Since this triggers change(), nothing more needs to be done to refresh the overlay.
		}

		/*
			Because mode() can be called multiple times by TwineJS, special preparation must be done before attaching event handlers.
			Each event handler here is a named function with "harlowe3" in their name, so that their copies can be spotted in the _handlers array.
			Reminder that function name properties are well-specified since 2015.
		*/
		const on = (target, name, fn) => (!target._handlers || !(target._handlers[name] || []).some(e => e.name === fn.name)) && target.on(name, fn);
		
		let init = (doc) => {
			if (!cm) {
				cm = doc.cm;

				/*
					This (along with the arrow-function binding above) is used to provide line numbers
					for everything except TwineJS 2.4.
				*/
				if (this.window || this.modules) {
					cm.setOption('lineNumbers', true);
					cm.setOption('lineNumberFormatter', () => "\u2022");
				}
			}
			/*
				Install the toolbar, if it's been loaded. (This function will early-exit if the toolbar's already installed.)
			*/
			toolbar && toolbar(cm);

			/*
				Refresh the story data.
			*/
			storyData();

			/*
				Use the Harlowe lexer to compute a full parse tree.
			*/
			refreshTree(doc);
			/*
				Attach the all-important beforeChanged event, but make sure it's only attached once.
				Note that this event is removed by TwineJS when it uses swapDoc to dispose of old docs.
			*/
			on(doc, 'beforeChange', function harlowe3beforeChange(_, change) {
				/*
					Do nothing if this is detached from the DOM.
				*/
				if (!doc.cm.display.wrapper.parentNode) {
					return;
				}
				const oldText = doc.getValue();
				forceFullChange(change, oldText);
			});
			on(doc, 'change', function harlowe3Change() {
				/*
					Do nothing if this is detached from the DOM.
				*/
				if (!doc.cm.display.wrapper.parentNode) {
					return;
				}
				refreshTree(doc);
				/*
					Re-compute the current search query, if there is one.
				*/
				if (currentQuery && matches[matchIndex]) {
					/*
						Don't reset findFromIndex if harlowe3Replace() changed it.
					*/
					if (findFromIndex === -1) {
						findFromIndex = doc.indexFromPos(matches[matchIndex].start) - 1;
					}
					harlowe3Find(currentQuery);
				}
			});
			on(doc, 'cursorActivity', function harlowe3CursorActivity() {
				cursorMarking(doc);
				tooltips && tooltips(doc, docData(doc));
			});
			/*
				Perform specific style alterations based on certain specific token types.
			*/
			on(cm, 'renderLine', function harlowe3RenderLine(_, __, lineElem) {
				Array.from(lineElem.querySelectorAll('.cm-harlowe-3-colour')).forEach(elem => {
					/*
						It may be a bit regrettable that the fastest way to get the HTML colour of a Harlowe
						colour token is to re-lex it separately from the tree, but since it's a single token, it should nonetheless be quick enough.
						(Plus, colour tokens are relatively rare in most passage prose).
					*/
					const {colour} = lex(elem.textContent, '', "macro").tokenAt(0);
					/*
						The following CSS produces a colour stripe below colour literals, which doesn't interfere with the cursor border.
					*/
					elem.setAttribute('style', `background:linear-gradient(to bottom,transparent,transparent 80%,${colour} 80.1%,${colour})`);
				});
			});
			// Remove the tooltip, if it exists.
			// This can't actually be in the Tooltips module because it must only be installed once.
			on(cm, 'scroll', function harlowe3Scroll() {
				const tooltip = document.querySelector('.harlowe-3-tooltip');
				tooltip && tooltip.remove();
			});
			/*
				These are signalled only by the Find/Replace Toolbar panel.
			*/
			on(cm, 'harlowe-3-find', harlowe3Find);
			on(cm, 'harlowe-3-findNext', harlowe3FindNext);
			on(cm, 'harlowe-3-replace', harlowe3Replace);
			on(cm, 'harlowe-3-findDone', function harlowe3FindDone() { 
				cm.removeOverlay(findOverlay);
			});
			/*
				Unset this function, now that this is all done.
			*/
			init = null;
		};
		
		return {
			startState: () => ({
				pos: 0,
				disconnected: null,
			}),
			blankLine(state) {
				state.pos++;
			},
			token(stream, state) {
				const {doc} = stream.lineOracle;
				/*
					If the CM doc is disconnected from the DOM (somehow), don't bother doing anything.
				*/
				if (state.disconnected === null ? (state.disconnected = !doc.cm.display.wrapper.parentNode) : state.disconnected) {
					state.pos++;
					stream.next();
					return null;
				}
				/*
					Install the event handlers, if they haven't already been.
				*/
				init && init(doc);
				/*
					Fetch the tree for this doc.
				*/
				const {tree} = docData(doc);
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
					// If the type is "verbatim" or "comment", erase all of the class names before it.
					if (type === "verbatim" || type === "comment") {
						ret = '';
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
							Strings matching passage names or tag names get special highlighting.
						*/
						case "string": {
							const val = text.slice(1,-1);
							if (passages.has(val)) {
								name += " harlowe-3-passageString";
							}
							else if (passageTags.has(val)) {
								name += " harlowe-3-tagString";
							}
							break;
						}
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
							if (!hasOwnProperty.call(validMacros, macroName)) {
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
					}
					ret += name + " ";
				}
				return ret;
			},
		};
	};
	if (window.CodeMirror) {
		CodeMirror.defineMode('harlowe-3', mode);
	} else {
		this.editorExtensions = {
			twine: {
				"2.4 || 2.4.0-beta3": {
					codeMirror: {
						mode,
						toolbar,
						commands,
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
		The CODEMIRRORCSS string is replaced with the output of the script "codemirrorcss.js".
	*/
	harloweStyles.innerHTML = "CODEMIRRORCSS";

	/*
		Clean up the scope if this is Twine 2.4.
	*/
	if (!this.modules) {
		delete this.Markup;
		delete this.Toolbar;
		delete this.ToolbarCommands;
		delete this.Tooltips;
		delete this.ShortDefs;
	}
}.call(eval('this')));
