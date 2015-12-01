/**
	The Patterns are the raw strings used by the lexer to match tokens.
	These are used primarily by the Markup module, where they are attached to
	lexer rules.
	
	@module Patterns
*/
(function(){
	"use strict";
	let Patterns;
	
	/*
		Escapes characters in a string so that RegExp(str) produces a valid regex.
	*/
	function escape(str) {
		// This function may also accept objects, whereupon it applies itself
		// to every enumerable in the object.
		if (str && typeof str === "object") {
			Object.keys(str).forEach(function(e) {
				str[e] = escape(str[e]);
			});
			return str;
		}
		return (str+"").replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	}
	
	/*
		A sugar REstring function for negative character sets.
		This escapes its input.
	*/
	function notChars(/* variadic */) {
		return "[^" + Array.apply(0, arguments).map(escape).join("") + "]*";
	}
	
	/*
		Creates sugar functions which put multiple REstrings into parentheses, separated with |,
		thus producing a capturer or a lookahead.
		This does NOT escape its input.
	*/
	function makeWrapper(starter) {
		return function(/* variadic */) {
			return "(" + starter+Array.apply(0, arguments).join("|") + ")";
		};
	}
	
	const
		either = makeWrapper("?:"),
		notBefore = makeWrapper("?!"),
		before = makeWrapper("?=");
	
	const
		/*d:
			Whitespace markup

			"Whitespace" is a term that refers to "space" characters that you use to separate programming code tokens,
			such as the spacebar space, and the tab character. They are considered interchangeable in type and quantity -
			using two spaces usually has the same effect as using one space, one tab, and so forth.

			Harlowe tries to also recognise most forms of Unicode-defined whitespace,
			including the quads, the per-em and per-en spaces, but not the zero-width space characters (as they may
			cause confusion and syntax errors if unnoticed in your code).
		*/
		// This includes all forms of Unicode 6 whitespace except \n, \r, and Ogham space mark.
		ws                   = "[ \\f\\t\\v\u00a0\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*",
		
		// Mandatory whitespace
		mws                  = ws.replace("*","+"),
		
		// Word break
		wb                   = "\\b",
		
		//Escaped line
		escapedLine          =  "\\\\\\n\\\\?|\\n\\\\",
		
		// Line break without postfix escape
		br                   = "\\n(?!\\\\)",
		
		// Handles Unicode ranges not covered by \w. Copied from TiddlyWiki5 source - may need updating.
		anyLetter            = "[\\w\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
		// Identical to the above, but excludes hyphens.
		anyLetterStrict      =    "[\\w\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
		
		eol                  = either("\\n", "$"),
		
		noUnescapedLineBreak = "(" + either(escapedLine,"[^\\n]") + "+)",
		
		/*d:
			Bulleted list markup

			You can create bullet-point lists in your text by beginning lines with an asterisk `*`, followed by whitespace,
			followed by the list item text. The asterisk will be replaced with an indented bullet-point. Consecutive lines
			of bullet-point items will be joined into a single list, with appropriate vertical spacing.

			Remember that there must be whitespace between the asterisk and the list item text! Otherwise, this markup
			will conflict with the emphasis markup.

			If you use multiple asterisks (`**`, `***` etc.) for the bullet, you will make a nested list, which is indented deeper than
			a normal list. Use nested lists for "children" of normal list items.
			
			Example usage:
			```
			 * Bulleted item
			    *    Bulleted item 2
			  ** Indented bulleted item
			```
		*/
		
		bullet      = "\\*",
		
		bulleted    = ws + "(" + bullet + "+)" + mws + noUnescapedLineBreak + eol,
		
		/*d:
			Numbered list markup

			You can create numbered lists in your text, which are similar to bulleted lists, but feature numbers in place of bullets.
			Simply begin single lines with `0.`, followed by whitespace, followed by the list item text. Consecutive items will be
			joined into a single list, with appropriate vertical spacing. Each of the `0.`s will be replaced
			with a number corresponding to the item's position in the list.

			Remember that there must be whitespace between the `0.` and the list item text! Otherwise, it will be regarded as a plain
			number.

			If you use multiple `0.` tokens (`0.0.`, `0.0.0.` etc.) for the bullet, you will make a nested list, which uses different
			numbering from outer lists, and are indented deeper. Use nested lists for "children" of normal list items.

			Example usage:
			```
			0. Numbered item
			   0. Numbered item 2
			 0.0. Indented numbered item
			```
		*/
		numberPoint = "(?:0\\.)",
		
		numbered    = ws + "(" + numberPoint + "+)" + mws + noUnescapedLineBreak + eol,
		
		/*d:
			Horizontal rule markup

			A hr (horizontal rule) is a thin horizontal line across the entire passage. In HTML, it is a `<hr>` element.
			In Harlowe, it is an entire line consisting of 3 or more consecutive hyphens `-`.

			Example usage:
			```
			        ---
			  ----
			     -----
			```
			Again, opening whitespace is permitted prior to the first `-` and after the final `-`.
		*/
		hr          = ws + "-{3,}" + ws + eol,
		
		/*d:
			Heading markup

			Heading markup is used to create large headings, such as in structured prose or title splash passages.
			It is almost the same as the Markdown heading syntax: it starts on a fresh line,
			has one to six consecutive #s, and ends at the line break.

			Example usage:
			```
			#Level 1 heading renders as an enclosing <h1>
			   ###Level 3 heading renders as an enclosing <h3>
			 ######Level 6 heading renders as an enclosing <h6>
			```

			As you can see, unlike in Markdown, opening whitespace is permitted before the first #.
		*/
		heading = ws + "(#{1,6})" + ws + noUnescapedLineBreak + eol,
		
		/*d:
			Aligner markup

			An aligner is a special single-line token which specifies the alignment of the subsequent text. It is essentially
			'modal' - all text from the token onward (until another aligner is encountered) is wrapped in a `<tw-align>` element
			(or unwrapped in the case of left-alignment, as that is the default).

			 * Right-alignment, resembling `==>` is produced with 2 or more `=`s followed by a `>`.
			 * Left-alignment, resembling `<==` is restored with a `<` followed by 2 or more `=`.
			 * Justified alignment, resembling `<==>` is produced with `<`, 2 or more `=`, and a closing `>`.
			 * Mixed alignment is 1 or more `=`, then `><`, then 1 or more `=`. The ratio of quantity of left `=`s and right `=`s determines
			the alignment: for instance, one `=` to the left and three `=`s to the right produces 25% left alignment.
			
			Example usage:
			```
			==>
			This is right-aligned
			=><=
			This is centered
			<==>
			This is justified
			<==
			This is left-aligned (undoes the above)
			===><=
			This has margins 3/4 left, 1/4 right
			=><=====
			This has margins 1/6 left, 5/6 right.
			```
		*/
		align = ws + "(==+>|<=+|=+><=+|<==+>)" + ws + eol,
		
		/*d:
			Link markup

			Hyperlinks are the player's means of moving between passages and affecting the story. They consist of
			*link text*, which the player clicks on, and a *passage expression* that equals the name of the passage
			to send the player to.

			Inside matching non-nesting pairs of `[[` and `]]`, place the link text and the passage expression,
			separated by either `->` or `<-`, with the arrow pointing to the passage expression.

			You can also write a shorthand form, where there is no `<-` or `->` separator.
			The entire content is treated as a passage name, and its evaluation is treated as the link text.

			```
			[[Up to the attic]]
			[["Draw your" + $weapon]]
			```

			Example usage:
			```
			[[Go to the cellar->Cellar]] is a link that goes to a passage named "Cellar".
			[[Parachuting<-Jump]] is a link that goes to a passage named "Parachuting".
			[[Down the hatch]] is a link that goes to a passage named "Down the hatch".
			```

			Details:

			The interior of a link (the text between `[[` and `]]`) may contain any character except `]`. If additional
			`->`s or `<-`s appear, the rightmost right arrow or leftmost left arrow is regarded as the canonical separator.

			```
			[[A->B->C->D->E]] has a link text of
			A->B->C->D
			and a passage name of
			E

			[[A<-B<-C<-D<-E]] has a link text of
			B<-C<-D<-E
			and a passage name of
			A
			```

			This syntax is not the only way to create links – there are many link macros, such as (link:), which can
			be used to make more versatile hyperlinks in your story.
		*/
		passageLink = {
			opener:            "\\[\\[(?!\\[)",
			text:              "(" + notChars("]") + ")",
			rightSeparator:    either("\\->", "\\|"),
			leftSeparator:     "<\\-",
			closer:            "\\]\\]",
			legacySeparator:   "\\|",
			legacyText:        "(" + either("[^\\|\\]]", "\\]" + notBefore("\\]")) + "+)",
		},
		
		/*
			This determines the valid characters for a property name. Sadly, "-" is not allowed.
			As of 1.1, this must include at least 1 non-numeral.
		*/
		validPropertyName =
			anyLetter.replace("\\-", "") + "*"
			+ anyLetter.replace("\\-", "").replace("\\w","a-zA-Z")
			+ anyLetter.replace("\\-", "") + "*",
		
		/*d:
			Variable markup
			
			As described in the documentation for the (set:) macro, variables are used to remember data values
			in your game, keep track of the player's status, and so forth. You can print variables, arrays' items,
			using the (print:) macro.

			Or, if you only want to print a single variable, you can just enter the variable's name directly in
			your passage's prose.

			```
			Your beloved plushie, $plushieName, awaits you after a long work day.
			```

			Furthermore, if the variable contains a changer command, such as that created by (text-style:) and such,
			then the variable can be attached to a hook to apply the changer to the hook:

			```
			$robotText[Good golly! Your flesh... it's so soft!]
			```
		*/
		variable          = "\\$(" + validPropertyName + ")",
		
		property          = "'s" + mws + "(" + validPropertyName + ")",
		
		belongingProperty = "(" + validPropertyName + ")" + mws + "of" + wb + notBefore("it" + wb),
		
		/*
			Computed properties are of the form:
			$a's (expression)
			or
			(expression) of $a
		*/
		possessiveOperator = "'s" + mws,
		
		/*
			Computed properties are of the form:
			$a's (expression)
		*/
		belongingOperator = "of" + wb,
		
		/*
			Identifiers: either "it" or "time".
			"it" is a bit of a problem because its possessive is "its", not "it's",
			so we can't use a derivation similar to property.
		*/
		identifier          = either("it","time") + wb,
		
		itsProperty         = "its" + mws + "(" + validPropertyName + ")",
		
		itsOperator         = "its" + mws,
		
		belongingItProperty = "(" + validPropertyName + ")" + mws + "of" + mws + "it" + wb,
		
		belongingItOperator = "of" + wb + mws + "it" + wb,
		
		macro = {
			opener:            "\\(",
			name:              "(" + either(anyLetter.replace("]","\\/]") + anyLetter + "*", variable) + "):",
			closer:            "\\)",
		},
		
		twine1Macro = "<<[^>\\s]+\\s*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"|[^'\"\\\\>]|>(?!>))*>>",
		
		tag = {
			name:              "[a-zA-Z][\\w\\-]*",
			attrs:             "(?:\"[^\"]*\"|'[^']*'|[^'\">])*?",
		},
		
		hookTagFront =  "\\|(" + anyLetter.replace("]", "_]") + "*)>",
		hookTagBack  =  "<("   + anyLetter.replace("]", "_]") + "*)\\|",
		
		lambda       = "each" + ws + "(_" + validPropertyName + "(?:" + ws + "," + ws + "_" + validPropertyName + ")*)" + ws + ",?" + ws + "(to|where)" + wb,

		tempVariable = "_(" + validPropertyName + ")" + wb,
		
		/*
			This includes NaN, but I wonder if it should.
			This doesn't include the - sign because arithmetic's pattern will trump it.
			Negative numerals are handled in TwineScript as unary uses of arithmetic.
		*/
		number = '\\b(\\d+(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?|NaN)' + notBefore("m?s") + wb
		;
	
	passageLink.main =
		passageLink.opener
		+ either(
			passageLink.text + passageLink.rightSeparator,
			/*
				The rightmost right arrow or leftmost left arrow
				is regarded as the canonical separator.
			
				[[A->B->C->D->E]] has a link text of
					A->B->C->D
					and a passage name of
					E
			
				[[A<-B<-C<-D<-E]] has a link text of
					B<-C<-D<-E
					and a passage name of
					A
			
				Thus, the left separator's preceding text must be non-greedy.
			*/
			passageLink.text.replace("*","*?") + passageLink.leftSeparator
		)
		+ passageLink.text;
	
	/*
		Return the Patterns object.
		
		Note that some of these properties are "opener" objects, which are used by the
		lexer. It's a bit #awkward having them alongside the string properties like this,
		keyed to a similar but otherwise disconnected property name...
	*/
	Patterns = {
		
		upperLetter: "[A-Z\u00c0-\u00de\u0150\u0170]",
		lowerLetter: "[a-z0-9_\\-\u00df-\u00ff\u0151\u0171]",
		anyLetter,
		anyLetterStrict,
		
		whitespace:  mws,
		
		escapedLine,
		
		br,
		
		/*
			Twine currently just uses HTML comment syntax for comments.
		*/
		commentFront:         "<!--",
		commentBack:          "-->",
		
		/*d:
			HTML markup

			If you are familiar with them, HTML tags (like `<img>`) and HTML elements (like `&sect;`) can be inserted
			straight into your passage text. They are treated very naively - they essentially pass through Harlowe's
			markup-to-HTML conversion process untouched.

			Example usage:
			```
			<mark>This is marked text.

			&para; So is this.

			And this.</mark>
			```

			Details:

			HTML elements included in this manner are given a `data-raw` attribute by Harlowe, to distinguish them
			from elements created via markup.

			You can include a `<script>` tag in your passage to run Javascript code. The code will run as soon as the
			containing passage code is rendered.

			You can also include a `<style>` tag containing CSS code. The CSS should affect the entire page
			until the element is removed from the DOM.
		*/
		tag:         "<\\/?" + tag.name + tag.attrs + ">",
		tagPeek:                                      "<",
		
		scriptStyleTag: "<(" + either("script","style")
			+ ")" + tag.attrs + ">"
			+ "[^]*?" + "<\\/\\1>",
		scriptStyleTagOpener:  "<",
		
		url:         "(" + either("https?","mailto","javascript","ftp","data") + ":\\/\\/[^\\s<]+[^<.,:;\"')\\]\\s])",
		
		bullet,
		
		hr,
		heading,
		align,
		bulleted,
		numbered,
		
		/*
			The text style syntaxes.
		*/
		delOpener:        escape("~~"),
		italicOpener:     escape("//"),
		boldOpener:       escape("''"),
		supOpener:        escape("^^"),
		/*
			To avoid ambiguities between adjacent strong and em openers,
			these must be specified as separate front and back tokens
			with different precedence.
		*/
		strongFront:      escape("**"),
		strongBack:       escape("**"),
		emFront:          escape("*"),
		emBack:           escape("*"),
		
		/*d:
			Verbatim markup

			As plenty of symbols have special uses in Harlowe, you may wonder how you can use them normally, as mere symbols,
			without invoking their special functionality. You can do this by placing them between a pair of `` ` `` marks.

			If you want to escape a section of text which already contains single `` ` `` marks, simply increase the number
			of `` ` `` marks used to enclose them.

			Example usage:
			```I want to include `[[double square brackets]]` in my story, so I use tilde ` marks.```

			```I want to include ``single tildes ` in my story``, so I place them between two tilde marks.```
		*/
		/*
			The verbatim syntax does not "nest", but terminals can be
			differentiated by adding more ` marks to each pair.
		*/
		verbatimOpener:    "`+",
		
		collapsedFront:    "{",
		collapsedBack:     "}",
		
		/*
			Hook tags can be either prepended, pointing to the right,
				|tag>[The hook's text]
			or appended, pointing to the left.
				[The hook's text]<tag|
		*/
		hookAppendedFront:  "\\[",
		hookPrependedFront:
			hookTagFront + "\\[",
		/*
			The anonymous hook is a contextual production: it may only occur
			after macros and variables. Similarly, the hookAppendedFront
			may NOT occur after macros and variables. The reason these rules are
			not united is because their names are used to identify them in Lexer.
		*/
		hookAnonymousFront: "\\[",
		hookBack:  "\\]" + notBefore(hookTagBack),
		
		hookAppendedBack:
			"\\]" + hookTagBack,
		
		passageLink:
			passageLink.main
			+ passageLink.closer,
		passageLinkPeek:    "[[",
		
		legacyLink:
			/*
				[[A|B]] has a link text of
					A
					and a passage name of
					B
				
				This isn't preferred because it's the reverse of MediaWiki's links.
			*/
			passageLink.opener
			+ passageLink.legacyText + passageLink.legacySeparator
			+ passageLink.legacyText + passageLink.closer,
		legacyLinkPeek:    "[[",
		
		simpleLink:
			/*
				As long as legacyLink remains in the grammar,
				use legacyText here to disambiguate.
			*/
			passageLink.opener + passageLink.legacyText + passageLink.closer,
		simpleLinkPeek:    "[[",
		
		macroFront: macro.opener + before(macro.name),
		macroFrontPeek: "(",
		macroName: macro.name,
		
		/*
			Lambdas
		*/
		lambda,
		
		/*
			This must be differentiated from macroFront
		*/
		groupingFront: "\\(" + notBefore(macro.name),
		groupingFrontPeek: "(",
		
		groupingBack:  "\\)",
		
		twine1Macro,
		twine1MacroPeek: "<<",
		
		/*
			Property accesses
		*/
		
		property,
		propertyPeek: "'s",
		
		belongingProperty,
		
		possessiveOperator,
		
		belongingOperator,
		belongingOperatorPeek:
			"of",
		
		itsOperator,
		itsOperatorPeek: "its",
		
		belongingItOperator,
		belongingItOperatorPeek: "of",
		
		variable,
		variablePeek: "$",

		tempVariable,
		tempVariablePeek: "_",
		
		hookRef:
			"\\?(" + anyLetter + "+)\\b",
		hookRefPeek: "?",
		
		/*
			Artificial types (non-JS primitives, semantic sugar)
		*/
		
		cssTime: "(\\d+\\.?\\d*|\\d*\\.?\\d+)(m?s)" + wb,
		
		colour: either(
			// Hue name
			either(
				"Red", "Orange", "Yellow", "Lime", "Green",
				"Cyan", "Aqua", "Blue", "Navy", "Purple",
				"Fuchsia", "Magenta","White", "Gray", "Grey", "Black"
			),
			// Hexadecimal
			"#[\\dA-Fa-f]{3}(?:[\\dA-Fa-f]{3})?"
		),
		
		/*
			Natural types
		*/
		number,
		
		boolean: either("true","false") + wb,
		
		// Special identifiers
		identifier,
		itsProperty,
		itsPropertyPeek: "its",
		belongingItProperty,
		
		// This sad-looking property is designed to disambiguate escaped quotes inside string literals.
		escapedStringChar:     "\\\\[^\\n]",
		
		singleStringOpener:    "'",
		doubleStringOpener:    '"',
		
		/*
			Macro operators
		*/
		
		is:        "is" + notBefore(" not", " in") + wb,
		isNot:     "is not" + wb,
		
		and:       "and" + wb,
		or:        "or"  + wb,
		not:       "not" + wb,
		
		inequality: either("<(?!=)", "<=", ">(?!=)", ">="),
		
		isIn:       "is in" + wb,
		contains:   "contains" + wb,
		
		addition:          escape("+")      + notBefore("="),
		subtraction:       escape("-")      + notBefore("="),
		multiplication:    escape("*")      + notBefore("="),
		division:          either("/", "%") + notBefore("="),
		
		comma:      ",",
		spread:     "\\.\\.\\." + notBefore("\\."),
		
		to:         either("to" + wb, "="),
		into:       "into" + wb,
		augmentedAssign: either("\\+", "\\-", "\\*", "\\\/", "%") + "=",
	};
	
	if (typeof module === 'object') {
		module.exports = Patterns;
	}
	else if (typeof define === 'function' && define.amd) {
		define('patterns', [], function () {
			return Patterns;
		});
	}
	// Evaluated by a TwineJS StoryFormat
	else if (typeof StoryFormat === 'function' && this instanceof StoryFormat) {
		this.modules || (this.modules = {});
		this.modules.Patterns = Patterns;
	}
	else {
		this.Patterns = Patterns;
	}
}).call(eval('this') || (typeof global !== 'undefined' ? global : window));
