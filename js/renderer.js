"use strict";
define(['utils', 'markup', 'twinescript/compiler', 'internaltypes/twineerror'],
({escape, impossible, toJSLiteral, insensitiveName}, TwineMarkup, Compiler, TwineError) => {
	/*
		The Renderer takes the syntax tree from TwineMarkup and returns a HTML string.
		
		Among other responsibilities, it's the intermediary between TwineMarkup and TwineScript -
		macros and expressions become <tw-expression> and <tw-macro> elements alongside other
		markup syntax (with their compiled JS code attached as attributes), and the consumer of
		the HTML (usually Section) can run that code in the Environ.
	*/
	let Renderer;

	/*
		A simple function to wrap text in a given HTML tag, with no attributes.
	*/
	function wrapHTMLTag(text, tagName) {
		return '<' + tagName + '>' + text + '</' + tagName + '>';
	}
	/*
		This makes a basic enclosing HTML tag with no attributes, given the tag name,
		and renders the contained text.
	*/
	function renderTag(token, tagName) {
		const contents = Renderer.render(token.children);
		return contents && wrapHTMLTag(contents, tagName);
	}

	/*
		Text constant used by align.
		The string "text-align: " is selected by the debugmode CSS, so the one space
		must be present.
	*/
	const center = "text-align: center; max-width:50%; ";
	/*
		For a tiny bit of efficiency, the quick regexp used in preprocess() is stored here.
		This uses Patterns rather than Lexer's rules because those compiled RegExps for macroFront
		and macroName can't be combined into a single RegExp.
	*/
	const macroRegExp = RegExp(TwineMarkup.Patterns.macroFront + TwineMarkup.Patterns.macroName, 'ig');

	/*
		The public Renderer object.
	*/
	Renderer = {
		
		/*
			Renderer accepts the same story options that Harlowe does, as well as one more.
			Currently it uses { debug, blockerMacros, metadataMacros }.
		*/
		options: {
			debug: false,
			/*
				Flow control blockers are macro tokens which have specific names, stored here.
				This is currently permuted by Macrolib, which registers two such names.
			*/
			blockerMacros: [],
			/*
				Metadata macros contain lambdas and other data, which is extracted from the passage
				code and attached to the passage map itself during startup.
			*/
			metadataMacros: [],
		},

		/*
			When the game starts, each passage is scanned for metadata macros using this method. An object
			holding one macro call for each metadata macro name is returned.
		*/
		preprocess(src) {
			const {metadataMacros} = Renderer.options;
			/*
				Since lexing all the passages at bootup is potentially rather expensive, these quick and hacky RegExp tests are
				used to check whether preprocessing is necessary.
			*/
			if (!(
				/*
					This does a quick RegExp query for metadata macros, instead of lexing the entire source.
				*/
				(src.match(macroRegExp) || []).some(e => metadataMacros.some(f => insensitiveName(e.slice(1,-1)) === f ))
			)) {
				return {};
			}
			/*
				For each macro:
				if it's a metadata macro outside macro scope, get its lambda
				if it's a metadata macro inside macro scope, error
				if it's a non-metadata macro after a metadata macro outside macro scope, error
			*/
			let afterNonMetadataMacro = false;
			const metadata = {};
			TwineMarkup.lex(src).children.forEach(function outsideMacroFn(token) {
				if (token.type === "macro") {
					if (metadataMacros.some(f => token.name === f)) {
						/*
							If an error was already reported for this metadata name, don't replace it.
						*/
						if (TwineError.isPrototypeOf(metadata[token.name])) {
							return metadata;
						}
						/*
							Metadata macros can't appear after non-metadata macros.
						*/
						if (afterNonMetadataMacro) {
							metadata[token.name] = TwineError.create("syntax", 'The (' + token.name + ":) macro can't appear after non-metadata macros.");
							return metadata;
						}
						/*
							Having two metadata macros of the same kind is an error. If there was already a match, produce a TwineError about it
							and store it in that slot.
						*/
						if (metadata[token.name]) {
							metadata[token.name] = TwineError.create("syntax", 'There is more than one (' + token.name + ":) macro.");
							return metadata;
						}
						/*
							The matching macros are compiled into JS, which is later executed using
							section.eval(), where the section has a stack.speculativePassage.
						*/
						metadata[token.name] = Compiler(token);
						/*
							For debug mode and error message display, the original source code of the macros needs to be returned and stored with them.
							Of course, we could simply re-read the source from the passage itself, but that would be a bit of a waste of cognition
							when we've got it available right here.
						*/
						metadata[token.name + "Source"] = token.text;
					}
					else {
						afterNonMetadataMacro = true;
					}
					token.children.forEach(function nestedMacroFn(token) {
						if (token.type === "macro" && metadataMacros.some(f => token.name === f)) {
							metadata[token.name] = TwineError.create("syntax", 'The (' + token.name + ":) macro can't be inside another macro.");
						}
						else token.children.forEach(nestedMacroFn);
					});
				}
				else token.children.forEach(outsideMacroFn);
			});
			return metadata;
		},
		
		/*
			A composition of TwineMarkup.lex and Renderer.render,
			but with a (currently rudimentary) memoizer.
		*/
		exec: (() => {
			/*
				These two vars cache the previously rendered source text, and
				the syntax tree returned by TwineMarkup.lex from that.
			*/
			let cachedInput,
				cachedOutput;

			return (src) => {
				// If a non-string is passed into here, there's really nothing to do.
				if (typeof src !== "string") {
					impossible("Renderer.exec", "source was not a string, but " + typeof src);
					return "";
				}
				
				if (src === cachedInput) {
					return cachedOutput;
				}
				cachedInput = src;
				cachedOutput = Renderer.render(TwineMarkup.lex(src).children);
				return cachedOutput;
			};
		})(),
		
		/*
			The recursive rendering method.
			
			@param {Array} A TwineMarkup token array.
			@return {String} The rendered HTML string.
		*/
		render: function render(tokens) {
			// The output string.
			let out = '';
			// Stack of tag tokens whose names match HTML table elements.
			let HTMLTableStack = [];

			if (!tokens) {
				return out;
			}
			const len = tokens.length;
			for(let i = 0; i < len; i += 1) {
				let token = tokens[i];
				switch(token.type) {
					case "error": {
						out += TwineError.create("syntax", token.message, token.explanation)
							.render(escape(token.text))[0].outerHTML;
						break;
					}
					case "numbered":
					case "bulleted": {
						// Run through the tokens, consuming all consecutive list items
						let tagName = (token.type === "numbered" ? "ol" : "ul");
						out += "<" + tagName + ">";
						let depth = 1;
						while(i < len && tokens[i] && tokens[i].type === token.type) {
							/*
								For differences in depth, raise and lower the <ul> depth
								in accordance with it.
							*/
							out += ("<"  + tagName + ">").repeat(Math.max(0, tokens[i].depth - depth));
							out += ("</" + tagName + ">").repeat(Math.max(0, depth - tokens[i].depth));
							depth = tokens[i].depth;
							
							out += renderTag(tokens[i], "li");
							i += 1;
						}
						/*
							Since the while loop broke at a point where tokens[i] wasn't a list item,
							we must reset i to just prior to that position (so that the for-loop head can increment it).
						*/
						i -= 1;
						out += ("</" + tagName + ">").repeat(depth + 1);
						break;
					}
					case "align": {
						while(token && token.type === "align") {
							const {align} = token;
							const j = (i += 1);
							
							/*
								Base case.
							*/
							if (align === "left") {
								i -= 1;
								break;
							}
							/*
								Crankforward until the end tag is found.
							*/
							while(i < len && tokens[i] && tokens[i].type !== "align") {
								i += 1;
							}
							
							const body = render(tokens.slice(j, i));
							let style = '';
							
							switch(align) {
								case "center":
									style += center + "margin-left: auto; margin-right: auto;";
									break;
								case "justify":
								case "right":
									style += "text-align: " + align + ";";
									break;
								default:
									if (+align) {
										style += center + "margin-left: " + align + "%;";
									}
							}
							
							out += '<tw-align ' + (style ? ('style="' + style + '"') : '')
								+ (Renderer.options.debug ? ' title="' + token.text + '"' : "")
								+ '>' + body + '</tw-align>\n';
							token = tokens[i];
						}
						break;
					}
					case "column": {
						/*
							We need information about all of the columns before we can produce HTML
							of them. So, let's collect the information in this array.
						*/
						const columns = [];
						while(token && token.type === "column") {
							const {column:columnType} = token;
							const j = (i += 1);
							
							/*
								Base case.
							*/
							if (columnType === "none") {
								i -= 1;
								break;
							}

							/*
								Crankforward until the end tag is found.
							*/
							while(i < len && tokens[i] && tokens[i].type !== "column") {
								i += 1;
							}
							/*
								Store the information about this column.
							*/
							columns.push({
								text: token.text,
								type: columnType,
								body: render(tokens.slice(j, i)),
								width: token.width,
								marginLeft: token.marginLeft,
								marginRight: token.marginRight,
							});
							token = tokens[i];
						}
						if (columns.length) {
							/*jshint -W083 */
							const
								totalWidth = columns.reduce((a,e)=> a + e.width, 0);

							out += "<tw-columns>"
								+ columns.map(e =>
									`<tw-column type=${e.type} ${''
									} style="width:${e.width/totalWidth*100}%; margin-left: ${e.marginLeft}em; margin-right: ${e.marginRight}em;" ${
										(Renderer.options.debug ? ` title="${e.text}"` : "")
									}>${e.body}</tw-column>\n`
								).join('')
								+ "</tw-columns>";
						}
						break;
					}
					case "heading": {
						out += renderTag(token, 'h' + token.depth);
						break;
					}
					case "br": {
						/*
							The HTMLTableStack is a small hack to suppress implicit <br>s inside <table> elements.
							Normally, browser DOM parsers will move <br>s inside <table>, <tbody>,
							<thead>, <tfoot> or <tr> elements outside, which is usually quite undesirable
							when laying out table HTML in passage text.
							However, <td> and <th> are, of course, fine.
						*/
						if (!HTMLTableStack.length || /td|th/.test(HTMLTableStack[0])) {
							out += '<br>';
							/*
								This causes consecutive line breaks to consume less height than they normally would.
								The CSS code for [data-cons] is in main.scss
							*/
							let lookahead = tokens[i + 1];
							while (lookahead && (lookahead.type === "br" || (lookahead.type === "tag" && /^<br\b/i.test(lookahead.text)))) {
								out += "<tw-consecutive-br"
									/*
										Preserving the [data-raw] attribute is necessary for the collapsing syntax's collapse code.
										Non-raw <br>s are collapsed by it.
									*/
									+ (lookahead.type === "tag" ? " data-raw" : "")
									+ "></tw-consecutive-br>";
								i += 1;
								lookahead = tokens[i + 1];
							}
						}
						break;
					}
					case "hr": {
						out += '<hr>';
						break;
					}
					case "escapedLine":
					case "comment": {
						break;
					}
					case "inlineUrl": {
						out += '<a class="link" href="' + escape(token.text) + '">' + token.text + '</a>';
						break;
					}
					case "scriptStyleTag":
					case "tag": {
						/*
							Populate the HTMLTableStack, as described above. Note that explicit <br> tags
							are not filtered out by this: these are left to the discretion of the author.
						*/
						const insensitiveText = token.text.toLowerCase();
						if (/^<\/?(?:table|thead|tbody|tr|tfoot|td|th)\b/.test(insensitiveText)) {
							HTMLTableStack[token.text.startsWith('</') ? "shift" : "unshift"](insensitiveText);
						}
						out += token.text.startsWith('</')
							? token.text
							: token.text.replace(/>$/, " data-raw>");
						break;
					}
					case "sub": // Note: there's no sub syntax yet.
					case "sup":
					case "strong":
					case "em": {
						out += renderTag(token, token.type);
						break;
					}
					case "strike": {
						out += renderTag(token, "s");
						break;
					}
					case "bold": {
						out += renderTag(token, "b");
						break;
					}
					case "italic": {
						out += renderTag(token, "i");
						break;
					}
					case "twineLink": {
						/*
							This crudely desugars the twineLink token into a
							(link-goto:) token. However, the original link syntax is preserved
							for debug mode display.
						*/
						const [linkGotoMacroToken] = TwineMarkup.lex("(link-goto:"
							+ toJSLiteral(token.innerText) + ","
							+ toJSLiteral(token.passage) + ")").children;

						out += '<tw-expression type="macro" name="link-goto"'
							// Debug mode: show the link syntax as a title.
							+ (Renderer.options.debug ? ' title="' + escape(token.text) + '"' : '')
							+ ' js="' + escape(Compiler(linkGotoMacroToken)) + '">'
							+ '</tw-expression>';
						break;
					}
					case "hook": {
						out += '<tw-hook '
							+ (token.hidden ? 'hidden ' : '')
							+ (token.name ? 'name="' + insensitiveName(token.name) + '"' : '')
							// Debug mode: show the hook destination as a title.
							+ ((Renderer.options.debug && token.name) ? ' title="Hook: ?' + token.name + '"' : '')
							+ ' source="' + escape(token.innerText) + '">'
							+'</tw-hook>';
						break;
					}
					case "unclosedHook": {
						out += '<tw-hook '
							+ (token.hidden ? 'hidden ' : '')
							+ (token.name ? 'name="' + insensitiveName(token.name) + '"' : '')
							+ 'source="' + escape(
								/*
									Crank forward to the end of this run of text, un-parsing all of the hard-parsed tokens.
									Sadly, this is the easiest way to implement the unclosed hook, despite how
									#awkward it is performance-wise.
								*/
								tokens.slice(i + 1, len).map(t => t.text).join('')
							) + '"></tw-hook>';
						return out;
					}
					case "verbatim": {
						out += wrapHTMLTag(escape(token.innerText)
							/*
								The only replacement that should be done is \n -> <br>. In
								browsers, even if the CSS is set to preserve whitespace, copying text
								still ignores line breaks that aren't explicitly set with <br>s.
							*/
							.replace(/\n/g,'<br>'), "tw-verbatim");
						break;
					}
					case "collapsed": {
						out += renderTag(token, "tw-collapsed");
						break;
					}
					/*
						Expressions
					*/
					case "variable":
					case "tempVariable":
					case "macro": {
						/*
							Only macro expressions may contain control flow blockers; these are extracted
							and compiled separately from the parent expression.
							Also, this same loop is used to extract and precompile code hooks, which
							saves Compiler needing to re-call Renderer.
						*/
						const blockers = [], innerMarkupErrors = [];
						if (token.type === "macro") {
							/*
								To extract control flow blockers and precompile code hooks in an expression, this performs a depth-first search
								(much as how statement execution is a depth-first walk over the parse tree).
							*/
							(function recur(token) {
								/*
									- String tokens have children so that the syntax highlighting can see into them somewhat, but
									their contained "blockers" should be ignored.
									- Hooks, of course, shouldn't be entered either.
								*/
								if (token.type !== "string" && token.type !== "hook") {
									token.children.every(recur);
								}
								const firstChild = token.firstChild();
								/*
									Control flow blockers are macros whose name matches one of the aforelisted
									blocker macros.
								*/
								if (token.type === "macro" && firstChild && firstChild.type === "macroName"
										&& Renderer.options.blockerMacros.includes(insensitiveName(
											// Slice off the trailing :, which is included in macroName tokens.
											firstChild.text.slice(0,-1)
										))) {
									blockers.push(token);
								}
								else if (token.type === "hook") {
									//Before compiling the interior into HTML, check for an error token first.
									//If so, don't bother.
									if (!token.everyLeaf(token => {
										if (token.type === "error") {
											innerMarkupErrors.push(token);
											return false;
										}
										return true;
									})) {
										return false;
									}
									//Inner hooks' child tokens are converted to HTML early, so that the code hooks'
									//consumers can execute it slightly faster than just lexing the markup aLL over again.
									token.html = render(token.children);
								}
								return true;
							}(token));
						}
						if (innerMarkupErrors.length) {
							return TwineError.create('syntax',"This code hook\'s markup contained " + innerMarkupErrors.length + " error"
								+ (innerMarkupErrors.length ? 's' : '') + ":<br>—"
								+ innerMarkupErrors.map(error => error.message).join("<br>—")
							).render(escape(token.text))[0].outerHTML;
						}

						const compiledBlockers = blockers.length && blockers.map(b => {
							const ret = Compiler(b);
							/*
								When the blockers' execution completes, the values produced by them are stored by the passage.
								The original blockers' positions in the expression are (temporarily!) permuted in-place to become "blockedValue"
								tokens, which retrieve the stored values.
							*/
							b.type = 'blockedValue';
							return ret;
						});

						out += '<tw-expression type="' + token.type + '" name="' + escape(token.name || token.text) + '"'
							// Debug mode: show the macro name as a title.
							//TODO: enable this for all modes, and have Section remove it
							+ (Renderer.options.debug ? ' title="' + escape(token.text) + '"' : '')
							+ (blockers.length ? ' blockers="' + escape(JSON.stringify(compiledBlockers)) + '"' : '')
							+ ' js="' + escape(Compiler(token)) + '"'
							+ '>'
							+ '</tw-expression>';
						/*
							"Purely temporary local mutation, externally invisible, is synonymous with no mutation." - an inspiring proverb.
							Since all the blockers were "macro" tokens, changing them back from "blockedValue" tokens is trivial.
						*/
						blockers.forEach(b => b.type = 'macro');
					}
					break;
					/*
						Base case
					*/
					default: {
						out += token.children && token.children.length ? render(token.children) : token.text;
						break;
					}
				}
			}
			return out;
		}
	};
	return Object.freeze(Renderer);
});
