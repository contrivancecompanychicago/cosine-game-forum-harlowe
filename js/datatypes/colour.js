define(['jquery'], ($) => {
	/*d:
		Colour data

		Colours are special built-in data values which can be provided to certain styling macros, such as (background:)
		or (text-colour:). They consist of the following values:

		| Value | HTML colour equivalent
		|---
		| `red` | <span style='background:#e61919;color:black'>#e61919</span>
		| `orange` | <span style='background:#e68019;color:black'>#e68019</span>
		| `yellow` | <span style='background:#e5e619;color:black'>#e5e619</span>
		| `lime` | <span style='background:#80e619;color:black'>#80e619</span>
		| `green` | <span style='background:#19e619;color:black'>#19e619</span>
		| `aqua` or `cyan` | <span style='background:#19e5e6;color:black'>#19e5e6</span>
		| `blue` | <span style='background:#197fe6;color:white'>#197fe6</span>
		| `navy` | <span style='background:#1919e6;color:white'>#1919e6</span>
		| `purple` | <span style='background:#7f19e6;color:white'>#7f19e6</span>
		| `magenta` or `fuchsia` | <span style='background:#e619e5;color:white'>#e619e5</span>
		| `white` | <span style='background:#fff;color:black'>#fff</span>
		| `black` | <span style='background:#000;color:white'>#000</span>
		| `grey` or `gray` | <span style='background:#888;color:white'>#888</span>

		(These colours were chosen to be visually pleasing when used as both background colours and text colours, without
		the glaring intensity that certain HTML colours, like pure #f00 red, are known to exhibit.)

		Additionally, you can also use HTML hex #xxxxxx and #xxx notation to specify your own colours, such as
		`#691212` or `#a4e`. (Note that these are *not* strings, but bare values - `(background: #a4e)` is valid,
		as is `(background:navy)`.)

		Of course, HTML hex notation is notoriously hard to read and write. It's recommended that you create other
		colours by combining the built-in keyword values using the `+` operator: `red + orange + white`
		produces a blend of red and orange, tinted white. `#a4e + black` is a dim purple.
	*/
	"use strict";
	const
		/*
			These RegExps check for HTML #fff and #ffffff format colours.
		*/
		singleDigit   = /^([\da-fA-F])$/,
		tripleDigit   = /^([\da-fA-F])([\da-fA-F])([\da-fA-F])$/,
		sextupleDigit = /^([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])$/,
		/*
			This cache here is used by the function just below.
		*/
		cssNameCache = Object.create(null);

	/*
		This private function tries its best to convert a CSS3 colour name (like "rebeccapurple"
		or "papayawhip") to an RGB object. It uses jQuery to make the initial lookup, and
		caches the resulting object for future lookups.
	*/
	function css3ToRGB(colourName) {
		if (colourName in cssNameCache) {
			return cssNameCache[colourName];
		}
		let colour = $("<p>").css("background-color", colourName).css("background-color");
		if (!colour.startsWith('rgb')) {
			colour = { r:192, g:192, b:192 };
		}
		else {
			colour = colour.match(/\d+/g).reduce((colour, num, ind) => {
				colour["rgb"[ind]] = +num;
				return colour;
			}, {});
		}
		cssNameCache[colourName] = colour;
		return colour;
	}
	
	/*
		This private function converts a string comprising a CSS hex colour
		into an {r,g,b} object.
		This, of course, doesn't attempt to trim the string, or
		perform "flex hex" parsing to over-long strings.
		(http://scrappy-do.blogspot.com/2004/08/little-rant-about-microsoft-internet.html)
	*/
	function hexToRGB(str) {
		// Assume that any non-strings passed in here are already valid {r,g,b}s.
		if (typeof str !== "string") {
			return str;
		}
		// Trim off the "#".
		str = str.replace("#", '');
		/*
			If a 3-char hex colour was passed, convert it to a 6-char colour.
		*/
		str = str.replace(tripleDigit, "$1$1$2$2$3$3");
		
		return {
			r: parseInt(str.slice(0,2), 16),
			g: parseInt(str.slice(2,4), 16),
			b: parseInt(str.slice(4,6), 16),
		};
	}

	const Colour = Object.freeze({
		colour: true,
		TwineScript_TypeName:   "a colour",
		TwineScript_ObjectName: "a colour",
		
		/*
			Colours can be blended by addition.
		*/
		"TwineScript_+"(other) {
			/*
				These are just shorthands (for "lvalue" and "rvalue").
			*/
			const
				l = this,
				r = other;
			
			return Colour.create({
				/*
					You may notice this is a fairly glib blending
					algorithm. It's the same one from Game Maker,
					though, so I'm hard-pressed to think of a more
					intuitive one.
				*/
				r : Math.min(Math.round((l.r + r.r) * 0.6), 0xFF),
				g : Math.min(Math.round((l.g + r.g) * 0.6), 0xFF),
				b : Math.min(Math.round((l.b + r.b) * 0.6), 0xFF),
			});
		},
		
		TwineScript_Print() {
			return "<tw-colour style='background-color:rgb("
				+ [this.r, this.g, this.b].join(',') + ");'></span>";
		},
		
		TwineScript_is(other) {
			return Colour.isPrototypeOf(other) &&
				other.r === this.r &&
				other.g === this.g &&
				other.b === this.b;
		},
		
		TwineScript_Clone() {
			return Colour.create(this);
		},
		
		/*
			This converts the colour into a 6-char HTML hex string.
			(No, this doesn't create a 3-char colour if one was possible. Sorry.)
		*/
		toHexString() {
			return "#"
				/*
					Number.toString() won't have a leading 0 unless
					we manually insert it.
				*/
				+ (this.r).toString(16).replace(singleDigit, "0$1")
				+ (this.g).toString(16).replace(singleDigit, "0$1")
				+ (this.b).toString(16).replace(singleDigit, "0$1");
		},
		/*
			This constructor accepts an object containing r, g and b numeric properties,
			or a string comprising a CSS hex colour.
		*/
		create(rgbObj) {
			if (typeof rgbObj === "string") {
				if (Colour.isHexString(rgbObj)) {
					return this.create(hexToRGB(rgbObj));
				}
				return this.create(css3ToRGB(rgbObj));
			}
			return Object.assign(Object.create(this), rgbObj);
		},
		/*
			This static method determines if a given string matches a HTML hex colour format.
		*/
		isHexString(str) {
			return (typeof str === "string" && str[0] === "#"
				&& (str.slice(1).match(tripleDigit) || str.slice(1).match(sextupleDigit)));
		},
	});
	return Colour;
});
