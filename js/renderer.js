"use strict";
define(['jquery', 'utils', 'markup', 'internaltypes/twineerror'],
($, {escape, impossible, insensitiveName}, Markup, TwineError) => {
	/*
		The Renderer takes the syntax tree from Markup and returns a HTML string.
		
		Among other responsibilities, it's the intermediary between Markup and TwineScript -
		macros, hooks and expressions become <tw-expression>, <tw-hook> and <tw-macro> elements alongside other
		markup syntax (with their lexed ASTs attached) and the consumer of
		the HTML (usually Section) can run that code.
	*/
	let Renderer;

	/*
		A simple function to wrap text in a given HTML tag, with no attributes.
	*/
	function wrapHTMLTag(text, tagName) {
		return '<' + tagName + '>' + text + '</' + tagName + '>';
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
	const macroRegExp = RegExp(Markup.Patterns.macroFront + Markup.Patterns.macroName, 'ig');

	/*
		The internal recursive rendering method.
	*/
	function render(tokens,
			/*
				trees.code, trees.source and trees.blockers are a way to preserve the token trees of macros, hooks and variables
				after rendering to HTML. The internal structure of the macro calls and variable calls
				is stashed in these arrays, then reused later by Renderer's consumers.

				Note that to save on processing with huge parse trees,
				and due to the fact that this is entirely internal to Renderer,
				I have taken the risky step of making these in-place mutable arrays on an object.
			*/
			trees) {
		/*
			This makes a basic enclosing HTML tag with no attributes, given the tag name,
			and renders the contained text.
		*/
		function renderTag(token, tagName) {
			const contents = render(token.children, trees);
			return contents && wrapHTMLTag(contents, tagName);
		}

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
					// This will be used to identify the depth of the initial list compared to the default (1).
					let depth = 1;
					/*
						March through the subsequent tokens of the list item, rendering them until a line break is encountered,
						whereupon the list item is terminated.
					*/
					while(i < len && tokens[i]) {
						if (tokens[i].type === "br") {
							out += "</li>";
							/*
								If the very next item after the line break is not a similar list item,
								terminate the whole list.
							*/
							if (!tokens[i+1] || tokens[i+1].type !== token.type) {
								break;
							}
						}
						else if (tokens[i].type === token.type) {
							/*
								For differences in depth, raise and lower the <ul> depth
								in accordance with it.
							*/
							out += ("<"  + tagName + ">").repeat(Math.max(0, tokens[i].depth - depth));
							out += ("</" + tagName + ">").repeat(Math.max(0, depth - tokens[i].depth));
							out += "<li>";
							depth = tokens[i].depth;
						}
						else {
							out += render([tokens[i]], trees);
						}
						i += 1;
					}
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
						
						const body = render(tokens.slice(j, i), trees);
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
							body: render(tokens.slice(j, i), trees),
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
								} style="width:${e.width/totalWidth*100}%; margin-left: ${e.marginLeft}em; margin-right: ${e.marginRight}em;">${e.body}</tw-column>\n`
							).join('')
							+ "</tw-columns>";
					}
					break;
				}
				case "heading": {
					out += '<h' + token.depth + ">";
					/*
						March through the subsequent tokens of the heading, rendering them until a line break is encountered,
						whereupon the heading is terminated.
					*/
					while (++i < len && tokens[i]) {
						if (tokens[i].type === "br") {
							out += '</h' + token.depth + '>';
							break;
						}
						out += render([tokens[i]], trees);
					}
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
					const [linkGotoMacroToken] = Markup.lex("(link-goto:"
						+ JSON.stringify(token.innerText) + ","
						+ JSON.stringify(token.passage) + ")").children;

					out += '<tw-expression type="macro" name="link-goto"'
						// Debug mode: show the link syntax as a title.
						+ (Renderer.options.debug ? ' title="' + escape(token.text) + '"' : '')
						+ ' code="' + trees.code.length + '">'
						+ '</tw-expression>';
					trees.code.push(linkGotoMacroToken);
					break;
				}
				case "hook": {
					out += '<tw-hook '
						+ (token.hidden ? 'hidden ' : '')
						+ (token.name ? 'name="' + insensitiveName(token.name) + '"' : '')
						// Debug mode: show the hook destination as a title.
						+ ((Renderer.options.debug && token.name) ? ' title="Hook: ?' + token.name + '"' : '')
						+ ' source="' + trees.source.length + '">'
						+'</tw-hook>';
					trees.source.push(token.children);
					break;
				}
				case "unclosedHook": {
					out += '<tw-hook '
						+ (token.hidden ? 'hidden ' : '')
						+ (token.name ? 'name="' + insensitiveName(token.name) + '"' : '')
						+ 'source="' + trees.source.length + '"></tw-hook>';
					trees.source.push(tokens.slice(i + 1, len));
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
				case "unclosedCollapsed": {
					out += '<tw-collapsed>' + render(tokens.slice(i + 1, len), trees) + '</tw-collapsed>';
					return out;
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
						Also, this same loop is used to extract and precompile code hooks.
					*/
					const blockers = [], innerMarkupErrors = [];
					if (token.type === "macro") {
						/*
							To extract control flow blockers and precompile code hooks in an expression, this performs a depth-first search
							(much as how statement execution is a depth-first walk over the parse tree).
						*/
						(function recur(token) {
							/*
								- String tokens have residual children, so their contained "blockers" should be ignored.
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
								/*
									Before compiling the interior into HTML, check for an error token (from a markup error) first.
									If so, don't bother.
								*/
								if (!token.everyLeaf(token => {
									if (token.type === "error") {
										innerMarkupErrors.push(token);
										return false;
									}
									return true;
								})) {
									return false;
								}
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

					/*
						Blocker tokens have their blocker IDs recorded here. The full array of blocker IDs is then stapled to
						the <tw-expression>.
					*/
					const blockerTreeIDs = blockers.map(b => {
						b.blockerTree = trees.blockers.length;
						trees.blockers.push(b);
						return b.blockerTree;
					});

					out += '<tw-expression type="' + token.type + '" name="' + escape(token.name || token.text) + '"'
						// Debug mode: show the macro name as a title.
						+ (Renderer.options.debug ? ' title="' + escape(token.text) + '"' : '')
						+ (blockerTreeIDs.length ? ' blockers="' + blockerTreeIDs + '"' : '')
						+ ' code="' + trees.code.length + '">'
						+ '</tw-expression>';

					trees.code.push(token);
				}
				break;
				/*
					Base case
				*/
				default: {
					out += token.children && token.children.length ? render(token.children, trees) : token.text;
					break;
				}
			}
		}
		return out;
	}

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
				if it's a metadata macro outside macro scope, get its call
				if it's a metadata macro inside macro scope, error
				if it's a non-metadata macro after a metadata macro outside macro scope, error
			*/
			let afterNonMetadataMacro = false;
			const metadata = {};
			Markup.lex(src).children.forEach(function outsideMacroFn(token) {
				if (token.type === "macro") {
					if (metadataMacros.some(f => token.name === f)) {
						/*
							If an error was already reported for this metadata name, don't replace it.
						*/
						if (TwineError.isPrototypeOf(metadata[token.name])) {
							return;
						}
						/*
							Metadata macros can't appear after non-metadata macros.
						*/
						if (afterNonMetadataMacro) {
							metadata[token.name] = TwineError.create("syntax", 'The (' + token.name + ":) macro can't appear after non-metadata macros.");
							return;
						}
						/*
							Having two metadata macros of the same kind is an error. If there was already a match, produce a TwineError about it
							and store it in that slot.
							Technically we don't need this, because Passage.loadMetadata() raises a separate error if two metadata macros
							override each other's data. But, this one is more incisively descriptive.
						*/
						if (metadata[token.name]) {
							metadata[token.name] = TwineError.create("syntax", 'There is more than one (' + token.name + ":) macro.");
							return;
						}
						metadata[token.name] = {
							code:  token,
							/*
								For debug mode and error message display, the original source code of the macros needs to be returned and stored with them.
								Of course, we could simply re-read the source from the passage itself, but that would be a bit of a waste of cognition
								when we've got it available right here.
							*/
							source: token.text,
						};
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
			The public rendering function, which returns a jQuery of newly rendered elements.
			This function can accept both Harlowe markup strings and existing syntax trees.
		*/
		exec(src) {
			const trees = { code: [], blockers: [], source: [] };
			/*
				Harlowe markup strings are lexed here.
			*/
			const html = render((typeof src === "string" ? Markup.lex(src).children : src), trees);

			/*
				Parse the HTML into elements.
			*/
			const elements = $($.parseHTML(html, document, true));

			/*
				Blocker macros must be evaluated prior to the main macros' execution. To do this without
				disturbing the trees of the macros, "copies" are made of the blockers using
				Object.create(). The blockers' positions in the tree are marked
				with 'blockedValue', so that when the main macros are executed,
				The cached values from the blockers are used rather than running the macro again.
			*/
			trees.blockers = trees.blockers.map(e => {
				e.blockedValue = true;
				const copy = Object.create(e);
				copy.blockedValue = false;
				return copy;
			});

			/*
				Now that the elements are created, we can assign .data() to them.
				The IDs assigned above (to <tw-expression> elements) are now replaced
				with data holding the tree with the matching ID.
			*/
			elements.findAndFilter('tw-expression[code]:not([data-raw]), tw-expression[blockers]:not([data-raw]), tw-hook[source]:not([data-raw])').each((_,e) => {
				e = $(e);
				if (e.attr('blockers')) {
					const blockers = e.popAttr('blockers').split(',').map(e => e = trees.blockers[e]);
					e.data('blockers', blockers);
				}
				if (e.attr('source')) {
					e.data('source', trees.source[e.popAttr('source')]);
				}
				if (e.attr('code')) {
					e.data('code', trees.code[e.popAttr('code')]);
				}
			});
			return elements;
		},
	};
	return Object.freeze(Renderer);
});
