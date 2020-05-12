/*
	This dynamically constructs a CSS string containing all of the styles used by
	the editor. Each property in the returned object indirectly maps to
	a CSS selector, and the value maps directly to CSS attributes assigned by the selector.
*/
const {min} = Math,
	nestedBG     = (h,s,l) => e => "background-color: hsla(" + h + "," + s + "%," + l + "%," + e +");",
	warmHookBG   = nestedBG(40, 100, 50),
	coolHookBG   = nestedBG(220, 100, 50),
	macro        = percent => nestedBG(320, 44, 50)(percent) + "color: hsla(320,44%,46%,1.0);",
	invalid      = "color: hsla(0,67%,42%,1.0) !important; background-color: hsla(17,100%,50%,0.5) !important;",
	intangible   = "font-weight:100; color: hsla(0,0,0,0.5)",
	colorRegExp  = /hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*(\d+\.\d+)\)/g;

/*
	If a property includes commas, then it's a multiple-name selector.
	It will be converted to "[selector], [selector]" etc.
*/
const outputFile = {
	root: 'box-sizing:border-box;',

	// The cursor token highlight should ignore the most common tokens, unwrapped text tokens.
	"cursor:not([class^='cm-harlowe-3-text cm-harlowe-3-root'])":
		"border-bottom: 2px solid darkgray;",

	CodeMirror: "padding: 0 !important",

	// The line number bullets (see the lineNumbers option, above), are a bit too dark by default.
	"CodeMirror-linenumber": "color: hsla(0,0%,80%,1.0);",
	// Also, the gutters sometimes encroach on the text area for some reason.
	"CodeMirror-gutters": "left: 0px !important;",

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
	"error:not([class*='cm-harlowe-3-string'])":
		invalid,
	
	macro:        macro(0.05),
	"macro-2":    macro(0.1),
	"macro-3":    macro(0.15),
	"macro-4":    macro(0.2),
	"macro-5":    macro(0.25),
	"macro-6":    macro(0.3),
	"macro-7":    macro(0.35),
	"macro-8":    macro(0.4),

	macroName:
		"font-style:italic;",

	// The bottommost element is a macro open/close bracket
	"^=macro ":
		"font-weight:bold;",

	"bold, strong":
		"font-weight:bold;",

	"italic, em":
		"font-style:italic;",

	"sup":
		"vertical-align: super;font-size:0.8em;",

	"strike":
		"text-decoration: line-through;",

	"verbatim":
		"background-color: hsla(0,0%,50%,0.1);",

	"^=bold, ^=strong, ^=italic, ^=em, ^=sup, ^=verbatim, ^=strike":
		intangible,

	"^=collapsed":
		"font-weight:bold; color: hsla(201,100%,30%,1.0);",
	
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
	
	"twineLink:not(.text)":
		"color: hsla(240,60%,50%,1.0);",
	tag:
		"color: hsla(240,34%,46%,1.0);",
	
	boolean:
		"color: hsla(0,0%,38%,1.0);",
	string:
		"color: hsla(180,72%,30%,1.0);",
	number:
		"color: hsla(30,99%,32%,1.0);",
	variable:
		"color: hsla(200,100%,35%,1.0);",
	tempVariable:
		"color: hsla(200,70%,44%,1.0);",
	hookRef:
		"color: hsla(160,100%,25%,1.0);",
	"variableOccurrence, hookOccurrence":
		"background: hsla(159,50%,75%,1.0) !important;",

	"^=where, ^=via, ^=with, ^=making, ^=each, ^=when":
		"color: #007f00; font-style:italic;",
	
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
	
	"identifier, property, belongingProperty, itsProperty, belongingItProperty, belongingItOperator":
		"color: #0076b2;",
	
	toString() {
		return Object.keys(this).reduce((a,e) => {
			if (e === 'toString') {
				return a;
			}
			if (e.slice(0,10) === "CodeMirror") {
				return a + "." + e + "{" + this[e] + "}";
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
					- It leaves the .theme-dark prefix alone.
					- It converts sequential selectors (separated by a dot).
					- It adds the cm- CodeMirror prefix to the CSS classes.
					- It adds the harlowe- storyformat prefix as well.
					- It converts the keys to a selector (by consequence of the above)
					and the values to a CSS body.
				*/
				.map(function map(e) {
					if (e.indexOf(".theme-dark") === 0) {
						return e.slice(0,11) + " " + map(e.slice(11).trim());
					}
					if (e.indexOf('.') > -1) {
						return e.split(/\./g).map(map).join('');
					}
					// There's no need for $= because that will always be cm-harlowe-root or cm-harlowe-cursor.
					if (e.indexOf("^=") === 0) {
						return "[class^='cm-harlowe-3-" + e.slice(2) + "']";
					}
					return ".cm-harlowe-3-" + e;
				});
			let rule = selector.join(', ') + "{" + this[e] + "}";
			/*
				Now create the dark versions of anything that has a colour.
			*/
			if (rule.match(colorRegExp)) {
				rule += ".theme-dark " + rule.replace(colorRegExp, (_, h,s,l,a) => "hsla(" + h + "," + min(100,(+s)*1.5) + "%," + min(100,(+l)*1.5) + "%," + a + ")");
			}
			return a + rule;
		}, '');
	},
} + "";

module.exports = outputFile;