/*
	This dynamically constructs a CSS string containing all of the styles used by
	the editor. Each property in the returned object indirectly maps to
	a CSS selector, and the value maps directly to CSS attributes assigned by the selector.
*/
const {min} = Math,
	nestedBG     = (h,s,l) => e => "background-color: hsla(" + h + "," + s + "%," + l + "%," + e +");",
	warmHookBG   = nestedBG(40, 100, 50),
	coolHookBG   = nestedBG(220, 100, 50),
	macroBG        = percent => nestedBG(320, 44, 50)(percent),
	invalid      = "background-color: hsla(17,100%,50%,0.5) !important;",
	intangible   = "font-weight:100; color: hsla(0,0,0,0.5)",
	colorRegExp  = /hsla\((\d+),\s*(\d+)%,\s*(\d+)%,\s*(\d+\.\d+)\)/g,
	typeColours  = require('../js/utils/typecolours');

/*
	The following is a copied compilation from animations.scss, with compatibility shims removed.
*/
const animations = `@keyframes appear{0%{opacity:0}to{opacity:1}}
@keyframes fade-in-out{0%,to{opacity:0}50%{opacity:1}}
@keyframes rumble{25%{top:-.1em}75%{top:.1em}0%,to{top:0}}
@keyframes shudder{25%{left:.1em}75%{left:-.1em}0%,to{left:0}}
@keyframes buoy{25%{top:.25em}75%{top:-.25em}0%,to{top:0}}
@keyframes sway{25%{left:.25em}75%{left:-.25em}0%,to{left:0}}
@keyframes pulse{0%{transform:scale(0,0)}20%{transform:scale(1.2,1.2)}40%{transform:scale(0.9,0.9)}60%{transform:scale(1.05,1.05)}
80%{transform:scale(0.925,0.925)}to{transform:scale(1,1)}}
@keyframes zoom-in{0%{transform:scale(0,0)}to{transform:scale(1,1)}}
@keyframes shudder-in{0%,to{transform:translateX(0em)}5%,25%,45%{transform:translateX(-1em)}15%,35%,55%{transform:translateX(1em)}
65%{transform:translateX(-0.6em)}75%{transform:translateX(0.6em)}85%{transform:translateX(-0.2em)}95%{transform:translateX(0.2em)}}
@keyframes rumble-in{0%,to{transform:translateY(0em)}5%,25%,45%{transform:translateY(-1em)}
15%,35%,55%{transform:translateY(1em)}65%{transform:translateY(-0.6em)}75%{transform:translateY(0.6em)}85%{transform:translateY(-0.2em)}95%{transform:translateY(0.2em)}}
@keyframes fidget{0%,8.1%,82.1%,31.1%,38.1%,44.1%,40.1%,47.1%,74.1%,16.1%,27.1%,72.1%,24.1%,95.1%,6.1%,36.1%,20.1%,4.1%,91.1%,14.1%,87.1%,to{left:0;top:0}
8%,82%,31%,38%,44%{left:-1px}40%,47%,74%,16%,27%{left:1px}72%,24%,95%,6%,36%{top:-1px}20%,4%,91%,14%,87%{top:1px}}
@keyframes slide-right{0%{transform:translateX(-100vw)}}
@keyframes slide-left{0%{transform:translateX(100vw)}}
@keyframes slide-up{0%{transform:translateY(100vh)}}
@keyframes slide-down{0%{transform:translateY(-100vh)}}
@keyframes flicker{0%,29%,31%,63%,65%,77%,79%,86%,88%,91%,93%{opacity:0}30%{opacity:.2}
64%{opacity:.4}78%{opacity:.6}87%{opacity:.8}92%,to{opacity:1}}`;

const versionClass = 'cm-harlowe-3-';
/*
	If a property includes commas, then it's a multiple-name selector.
	It will be converted to "[selector], [selector]" etc.
*/
const outputFile = {
	root: 'box-sizing:border-box;',

	// The cursor token highlight should ignore the most common tokens, unwrapped text tokens.
	["cursor:not([class^='" + versionClass + "text " + versionClass + "root'])"]:
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
	["error:not([class*='" + versionClass + "string'])"]:
		invalid,

	"^=macroName":
		"font-style:italic;",

	"macroName-boolean":      typeColours.boolean,
	"macroName-array":        typeColours.array,
	"macroName-dataset":      typeColours.dataset,
	"macroName-datatype":     typeColours.datatype,
	"macroName-number":       typeColours.number,
	"macroName-datamap":      typeColours.datamap,
	"macroName-changer":      typeColours.changer,
	"macroName-string":       typeColours.string,
	"macroName-colour, macroName-gradient":
		typeColours.colour,
	"macroName-command, macroName-instant, macroName-metadata":
		typeColours.command,
	"macroName-custommacro, macroName-any":
		typeColours.macro,

	// The bottommost element is a macro open/close bracket
	"^=macro ":
		"font-weight:bold;" + typeColours.macro,

	comma: typeColours.macro,

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

	"twineLink:not(.text)": typeColours.twineLink,

	tag:
		"color: hsla(240,34%,46%,1.0);",
	
	boolean:      typeColours.boolean,
	string:       typeColours.string,
	number:       typeColours.number,
	variable:     typeColours.variable,
	tempVariable: typeColours.tempVariable,
	hookName:     typeColours.hookName,
	datatype:     typeColours.datatype,
	colour:       typeColours.colour,

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
		typeColours.identifier,
	
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
						return "[class^='" + versionClass + e.slice(2) + "']";
					}
					return "." + versionClass + e;
				});
			a += selector.join(', ') + "{" + this[e] + "}";
			/*
				Now create the dark versions of anything that has a colour.
			*/
			if (this[e].match(colorRegExp)) {
				a += selector.map(e => ".theme-dark " + e).join(', ') + "{"
					+ this[e].replace(colorRegExp, (_, h,s,l,a) => "hsla(" + h + "," + min(100,(+s)*1.5) + "%," + (100-l) + "%," + a + ")")
					+ "}";
			}
			return a;
		}, '');
	},
} + animations;

module.exports = outputFile;
