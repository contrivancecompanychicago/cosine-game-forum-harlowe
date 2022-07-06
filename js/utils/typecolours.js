"use strict";
(function(){
	/*
		These CSS colours and syntax highlighting CSS is used both by Debug Mode, the CodeMirror syntax highlighter, and the documentation
		compiler.
	*/
	// TODO: Compute and add the dark mode colours to this thing directly
	const Colours = {
		boolean:     "color:hsla(0,0%,30%,1.0)",
		array:       "color:hsla(0,100%,30%,1.0)",
		dataset:     "color:hsla(30,100%,40%,1.0)",
		number:      "color:hsla(30,100%,30%,1.0)",
		datamap:     "color:hsla(60,100%,30%,1.0)",
		changer:     "color:hsla(90,100%,30%,1.0)",
		lambda:      "color:hsla(120,100%,40%,1.0)",
		hookName:    "color:hsla(160,100%,30%,1.0)",
		string:      "color:hsla(180,100%,30%,1.0)",
		identifier:  "color:hsla(200,80%,40%,1.0)",
		variable:    "color:hsla(200,100%,30%,1.0)",
		tempVariable:"color:hsla(200,70%,20%,1.0)",
		datatype:    "color:hsla(220,100%,30%,1.0)",
		colour:      "color:hsla(280,100%,30%,1.0)",
		macro:       "color:hsla(320,80%,30%,1.0)",
		twineLink:   "color:hsla(240,100%,20%,1.0)"
	};
	Colours.gradient = Colours.colour;
	Colours.command = Colours.twineLink;
	Colours.instant = Colours.metadata = Colours.any = Colours.customMacro = Colours.macro;

	const {min} = Math,
		nestedBG     = (h,s,l) => e => `background-color: hsla(${h},${s}%,${l}%,${e});`,
		warmHookBG   = nestedBG(40, 100, 50),
		coolHookBG   = nestedBG(220, 100, 50),
		invalid      = "background-color: hsla(17,100%,50%,0.5) !important;",
		intangible   = "font-weight:100; color: hsla(0,0%,0%,0.5)",
		colorRegExp  = /hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*(\d+\.\d+)\)/g,
		/*
			This only changes in every major version of Harlowe.
		*/
		versionClass = 'cm-harlowe-3-';

	/*
		This dynamically constructs a CSS string containing all of the styles used by
		the syntax highlighter. Each property in the returned object indirectly maps to
		a CSS selector, and the value maps directly to CSS attributes assigned by the selector.

		If a property includes commas, then it's a multiple-name selector.
		It will be converted to "[selector], [selector]" etc.
	*/
	const CSS = {
		root: 'box-sizing:border-box;',

		// "Warm" hooks
		hook:        warmHookBG(0.05),
		"hook-2":    warmHookBG(0.1),
		"hook-3":    warmHookBG(0.15),
		"hook-4":    warmHookBG(0.2),
		"hook-5":    warmHookBG(0.25),
		"hook-6":    warmHookBG(0.3),
		"hook-7":    warmHookBG(0.35),
		"hook-8":    warmHookBG(0.4),
		
		// This space prevents the selector from matching hookRef as well.
		"^=hook , ^=hook-":
			"font-weight:bold;",

		unclosedHook: warmHookBG(0.05) + "font-weight:bold;",
		
		//TODO: whitespace within collapsed
		["error:not([class*='" + versionClass + "string'])"]:
			invalid,

		"^=macroName":
			"font-style:italic;",

		"macroName-boolean":      Colours.boolean,
		"macroName-array":        Colours.array,
		"macroName-dataset":      Colours.dataset,
		"macroName-datatype":     Colours.datatype,
		"macroName-number":       Colours.number,
		"macroName-datamap":      Colours.datamap,
		"macroName-changer":      Colours.changer,
		"macroName-string":       Colours.string,
		"macroName-colour, macroName-gradient":
			Colours.colour,
		"macroName-command, macroName-instant, macroName-metadata":
			Colours.command,
		"macroName-custommacro, macroName-macro, macroName-any":
			Colours.macro,

		// The bottommost element is a macro open/close bracket
		"^=macro ":
			"font-weight:bold;" + Colours.macro,

		"comma, spread": Colours.macro,

		addition:
			Colours.any,

		"subtraction, multiplication, division":
			Colours.number,

		"is, and, or, not, isNot, contains, doesNotContain, isIn, isA, isNotA, isNotIn, matches, doesNotMatch":
			Colours.boolean,

		"bold, strong":
			"font-weight:bold;",

		"italic, em":
			"font-style:italic;",

		"sup":
			"vertical-align: super;font-size:0.8em;",

		"strike":
			"text-decoration: line-through;",

		"verbatim":
			"background-color: hsla(0,0%,50%,0.1);font:var(--font-monospaced)",

		"^=bold, ^=strong, ^=italic, ^=em, ^=sup, ^=verbatim, ^=strike":
			intangible,

		"^=collapsed":
			"font-weight:bold; color: hsla(201,100%,30%,1.0);",

		unclosedCollapsed:    coolHookBG(0.025) + "font-weight:bold; color: hsla(201,100%,30%,1.0);",
		
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

		"twineLink:not(.text)": Colours.twineLink,

		"tag, scriptStyleTag, comment":
			"color: hsla(240,34%,25%,1.0);",
		
		boolean:      Colours.boolean,
		string:       Colours.string,
		number:       Colours.number,
		variable:     Colours.variable,
		tempVariable: Colours.tempVariable,
		hookName:     Colours.hookName,
		datatype:     Colours.datatype,
		colour:       Colours.colour,
		cssTime:      Colours.number,

		/*
			Strings with the same name as passages are coloured the same as global variables
			(in the sense that both are author-created identifiers) and have an additional thin underline.
		*/
		passageString:
			Colours.variable + ';text-decoration:underline 1px;',
		tagString:
			Colours.variable + ';text-decoration:underline 1px dotted;',

		"variableOccurrence, hookOccurrence":
			"background: hsla(159,50%,75%,1.0) !important;",

		"^=where, ^=via, ^=with, ^=making, ^=each, ^=when":
			Colours.lambda + "; font-style:italic;",
		
		heading:
			"font-weight:bold;",
		hr:
			"background-image: linear-gradient(0deg, transparent, transparent 45%, hsla(0,0%,75%,1.0) 45%, transparent 55%, transparent);",
		align:
			"color: hsla(14,99%,37%,1.0); background-color: hsla(14,99%,87%,0.1);",
		column:
			"color: hsla(204,99%,37%,1.0); background-color: hsla(204,99%,87%,0.1);",
		
		escapedLine:
			"font-weight:bold; color: hsla(51,100%,30%,1.0);",
		
		"identifier, property, belongingProperty, itsProperty, belongingItProperty, belongingItOperator, possessiveOperator, belongingOperator":
			Colours.identifier,
		
		toString() {
			return Object.keys(this).reduce((a,e) => {
				if (e === 'toString') {
					return a;
				}
				/*
					Comma-containing names are handled by splitting them here,
					and then re-joining them. If the property lacks a comma,
					then this merely creates an array of 1 element and runs .map()
					on that.
				*/
				const selector = e.split(", ")
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
						// There's no need for $= because that will always be cm-harlowe-root or cm-harlowe-cursor.
						if (e.indexOf("^=") === 0) {
							return "[class^='" + versionClass + e.slice(2) + "']";
						}
						return "." + versionClass + e;
					});
				a += selector.join(', ') + "{" + this[e] + "}";
				/*
					Now create the dark versions of anything that has a colour.
				*/
				if (this[e].match(colorRegExp)) {
					['.theme-dark','[data-app-theme=dark]'].forEach(darkSelector => {
						a += selector.map(e => darkSelector + " " + e).join(', ') + "{"
								+ this[e].replace(colorRegExp, (_, h,s,l,a) => "hsla(" + h + "," + min(100,(+s)*1.5) + "%," + (100-l) + "%," + a + ")")
								+ "}";
					});
				}
				return a;
			}, '');
		},
	} + '';

	if(typeof module === 'object') {
		module.exports = { Colours, CSS, versionClass };
	}
	else if(typeof define === 'function' && define.amd) {
		define([], () => ({ Colours, CSS, versionClass }));
	}
}.call(this));
