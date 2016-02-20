(function() {
	'use strict';
	/*
		First, a preamble of helpers.
		
		This is a copy of Utils.insensitiveName(), used to check macro names.
	*/
	const insensitiveName = (e) => (e + "").toLowerCase().replace(/-|_/g, "");
	
	/*
		This MACROS token is actually replaced with an object literal listing
		of the currently defined Harlowe macros at compile-time, from the metadata script.
	*/
	const macros = "MACROS";

	/*
		Produce an array of the macro names, using both their names and their aliases.
	*/
	const validMacros = Object.keys(macros).reduce((a,e)=>a.concat(macros[e].name, ...macros[e].aka),[]).map(insensitiveName);

	/*
		Import the TwineMarkup lexer function, and store it locally.
	*/
	let lex;
	if(typeof define === 'function' && define.amd) {
		define('markup', [], (markup) => {
			lex = markup.lex;
		});
	}
	else if (typeof StoryFormat === 'function' && this instanceof StoryFormat) {
		lex = this.modules.Markup.lex;
	}
	
	/*
		This function, used as an event handler, applies a hack to CodeMirror to force it
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
		changeObj.update({line:0,ch:0}, changeObj.to, newText);
		
		return newText.join('\n');
	}
	
	/*
		The mode is defined herein.
	*/
	let cm;
	window.CodeMirror && CodeMirror.defineMode('harlowe', () => {
		let tree;
		
		let init = () => {
			const doc = cm.doc;
			/*
				CodeMirror doesn't allow modes to have full access to the text of
				the document. This hack overcomes this respectable limitation:
				TwineJS's PassageEditor stashes a reference to the doc in
				the CodeMirror modes object - and here, we retrieve it,
				and use it to compute a full parse tree.
			*/
			tree = lex(doc.getValue());
			
			/*
				Attach the all-important beforeChanged event, but make sure it's only attached once.
				Note that this event is removed by TwineJS when it uses swapDoc to dispose of old docs.
			*/
			doc.on('beforeChange', (_, change) => {
				const oldText = doc.getValue();
				forceFullChange(change, oldText);
			});
			doc.off('change');
			doc.on('change', () => {
				const text = doc.getValue();
				tree = lex(text);
			});
			doc.on('swapDoc', init);
			init = null;
		};
		
		return {
			/*
				The startState is vacant because all of the computation is done
				inside token().
			*/
			startState() {
				/*
					We can't reliably obtain the CodeMirror instance reference until now.
				*/
				if (!cm) {
					cm = CodeMirror.modes.harlowe.cm;
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
				}
				
				return {
					pos: 0,
				};
			},
			blankLine(state) {
				state.pos++;
			},
			token: function token(stream, state) {
				var
					// Some hoisted vars from the for-loop.
					ret = '';
				
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
				for (let i = 0; i < currentBranch.length; i+=1) {
					const type = currentBranch[i].type;
					let name = "harlowe-" + type;
					// If this name has been used earlier in the chain, suffix
					// this name with an additional number.
					if (counts[name] > 1) {
						name += "-" + (counts[name]);
					}
					counts[name] = (counts[name] || 0) + 1;
					switch(type) {
						/*
							Use the error style if the macro's name doesn't match the list of
							existant Harlowe macros.
						*/
						case "macroName":
							if (validMacros.indexOf(insensitiveName(currentBranch[i].text.slice(0,-1))) === -1) {
								name += " harlowe-error";
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
		(Let's use pure DOM calls in the absence of a jQuery require() call.)
	*/
	let harloweStyles = document.querySelector('style#cm-harlowe');
	if (!harloweStyles) {
		harloweStyles = document.createElement('style');
		harloweStyles.setAttribute('id','cm-harlowe');
		document.head.appendChild(harloweStyles);
	}
	/*
		This large function dynamically constructs a CSS string containing all of
		the styles used by the editor. Each property in the returned object indirectly maps to
		a CSS selector, and the value maps directly to CSS attributes assigned by the selector.
	*/
	harloweStyles.innerHTML = (() => {
		function nestedBG(h,s,l) {
			return (e) => "background-color: hsla(" + h + "," + s + "%," + l + "%," + e +");";
		}
		const
			warmHookBG   = nestedBG(40, 100, 50),
			coolHookBG   = nestedBG(220, 100, 50),
			macro        = "color: #a84186;",
			macroName    = macro + "font-style:italic;",
			twineLink    = "color: #3333cc;",
			invalid      = "color: firebrick; background-color: hsla(17, 100%, 74%, 0.74);"
			;
		
		/*
			If a property includes commas, then it's a multiple-name selector.
			It will be converted to "[selector], [selector]" etc.
		*/
		return {
			// "Warm" hooks
			hook:        warmHookBG(0.05),
			"hook-2":    warmHookBG(0.1),
			"hook-3":    warmHookBG(0.15),
			"hook-4":    warmHookBG(0.2),
			"hook-5":    warmHookBG(0.25),
			"hook-6":    warmHookBG(0.3),
			"hook-7":    warmHookBG(0.35),
			"hook-8":    warmHookBG(0.4),
			
			// The bottommost element is a hook
			"^=hook, ^=hook-":    "font-weight:bold;",
			
			//TODO: whitespace within collapsed
			error:
				invalid,
			
			macro,
			macroName,
			
			// The bottommost element is a macro open/close bracket
			"^=macro ":  "font-weight:bold;",
			
			"bold, strong":
				"font-weight:bold;",
			"italic, em":
				"font-style:italic;",
			verbatim:
				"background-color: hsla(0,0%,50%,0.1)",
			"^=collapsed":
				"font-weight:bold; color: hsl(201, 100%, 30%);",
			
			// "Cool" hooks
			// These are a combination of hooks and collapsed
			"collapsed":           coolHookBG(0.025),
			"collapsed.hook":      coolHookBG(0.05),
			"collapsed.hook-2":    coolHookBG(0.1),
			"collapsed.hook-3":    coolHookBG(0.15),
			"collapsed.hook-4":    coolHookBG(0.2),
			"collapsed.hook-5":    coolHookBG(0.25),
			"collapsed.hook-6":    coolHookBG(0.3),
			"collapsed.hook-7":    coolHookBG(0.35),
			"collapsed.hook-8":    coolHookBG(0.4),
			
			twineLink,
			tag:
				"color: #4d4d9d;",
			
			boolean:
				"color: #626262;",
			string:
				"color: #008282;",
			number:
				"color: #A15000;",
			variable:
				"color: #005682;",
			hookRef:
				"color: #007f54;",
			
			heading:
				"font-weight:bold;",
			hr:
				"display:block; background-image: linear-gradient(0deg, transparent, transparent 45%, silver 45%, transparent 55%, transparent);",
			align:
				"display:block; color: hsl(14, 99%, 27%); background-color: hsla(14, 99%, 87%, 0.2);",
			column:
				"display:block; color: hsl(204, 99%, 27%); background-color: hsla(204, 99%, 87%, 0.2);",
			
			escapedLine:
				"font-weight:bold; color: hsl(51, 100%, 30%);",
			
			"identifier, property, belongingProperty, itsProperty, belongingItProperty, belongingItOperator":
				"color: #0076b2;",
			
			toString() {
				return Object.keys(this).reduce((a,e) => {
					var selector;
					if (e === 'toString') {
						return a;
					}
					/*
						Comma-containing names are handled by splitting them here,
						and then re-joining them. If the property lacks a comma,
						then this merely creates an array of 1 element and runs .map()
						on that.
					*/
					selector = e.split(", ")
						/*
							This does a few things:
							- It converts sequential selectors (separated by a dot).
							- It adds the cm- CodeMirror prefix to the CSS classes.
							- It adds the harlowe- storyformat prefix as well.
							- It converts the keys to a selector (by consequence of the above)
							and the values to a CSS body.
						*/
						.map(function map(e) {
							if (e.indexOf('.') > -1) {
								return e.split(/\./g).map(map).join('');
							}
							if (e.indexOf("^=") === 0) {
								return "[class^='cm-harlowe-" + e.slice(2) + "']";
							}
							return ".cm-harlowe-" + e;
						});
					return a + selector.join(', ') + "{" + this[e] + "}";
				}, '');
			},
		} + "";
	})();
}.call(eval('this')));
