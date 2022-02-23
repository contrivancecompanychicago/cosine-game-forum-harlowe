"use strict";
define(['jquery'], ($) => {
	/*d:
		Colour data

		Colours are special data values which can be provided to certain styling macros, such as (background:)
		or (text-colour:). You can use built-in named colour values, or create other colours using the
		(rgb:) or (hsl:) macros.

		The built-in values consist of the following:

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
		| `transparent` | <span>transparent</span>

		(These colours were chosen to be visually pleasing when used as both background colours and text colours, without
		the glaring intensity that certain HTML colours, like pure #f00 red, are known to exhibit.)

		In addition to these values, and the (rgb:) macro, you can also use HTML hex notation to specify
		colours, such as `#691212` or `#a4e`. (Note that these are *not* strings, but bare values - `(background: #a4e)`
		is valid, as is `(background:navy)`.) Of course, HTML hex notation is notoriously hard to read and write, so this
		isn't recommended.

		If you want to quickly obtain a colour which is the blending of two others, you can blend them
		using the `+` operator: `red + orange + white` produces a blend of red and orange, tinted
		white. `#a4e + black` is a dim purple. Note that the `transparent` built-in value allows you to make colours
		partly transparent by blending them with it.

		Like datamaps, colour values have a few read-only data names, which let you examine the **r**ed, **g**reen and **b**lue
		components that make up the colour, as well as its **h**ue, **s**aturation and **l**ightness, its **a**lpha transparency,
		and a datamap showing its **lch** form (in the same values given to the (lch:) macro).

		| Data name | Example | Meaning
		|---
		| `r` | `$colour's r` | The red component, a whole number from 0 to 255.
		| `g` | `$colour's g` | The green component, a whole number from 0 to 255.
		| `b` | `$colour's b` | The blue component, a whole number from 0 to 255.
		| `h` | `$colour's h` | The hue angle in degrees, a whole number from 0 to 359.
		| `s` | `$colour's s` | The saturation percentage, a fractional number from 0 to 1.
		| `l` | `$colour's l` | The lightness percentage, a fractional number from 0 to 1.
		| `a` | `$colour's a` | The alpha percentage, a fractional number from 0 to 1.
		| `lch` | `$colour's lch` | A datamap of LCH values for this colour.

		These values can be used in the (hsl:) and (rgb:) macros to produce further colours. Note that some of these values
		do not transfer one-to-one between representations! For instance, the hue of a gray is essentially irrelevant, so grays
		will usually have a `h` value equal to 0, even if you provided a different hue to (hsl:). Furthermore, colours with a
		lightness of 1 are always white, so their saturation and hue are irrelevant.

		The `lch` value produces a datamap containing these values.

		| Data name | Example | Meaning
		|---
		| `l` | `$colour's lch's l` | The lightness percentage, a fractional number from 0 to 1. (Not the same as `$colour's l`!)
		| `c` | `$colour's lch's c` | The chroma component, a whole number from 0 to 230 (but which is usually below 132).
		| `h` | `$colour's lch's h` | The hue angle in degrees, a whole number from 0 to 359.

		Colours, when used in passage prose or given to (print:), produce a square swatch containing the colour. This is a `<tw-colour>`
		element, but otherwise has no other features or capabilities and is intended solely for debugging purposes.
	*/
	const
		{max,min,sin,cos,pow,round,floor,atan2,cbrt,sqrt,PI} = Math,
		{assign, create} = Object,
		/*
			These RegExps check for HTML #fff and #ffffff format colours.
		*/
		tripleDigit   = /^([\da-fA-F])([\da-fA-F])([\da-fA-F])$/,
		sextupleDigit = /^([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])([\da-fA-F])$/,
		/*
			This cache here is used by the function just below.
		*/
		cssNameCache = create(null);

	// Matrix multiplication
	function matMul(m1, m2, ...rest) {
		if (rest.length > 0) {
			return matMul(matMul(m1, m2), ...rest);
		}
		else if (!m2) {
			return m1;
		}
		let result = [];
		for (let i = 0; i < m1.length; i++) {
			result[i] = [];
			for (let j = 0; j < m2[0].length; j++) {
				let sum = 0;
				for (let k = 0; k < m1[0].length; k++) {
					sum += m1[i][k] * m2[k][j];
				}
				result[i][j] = sum;
			}
		}
		return result;
	}

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
		/*
			"transparent" is the only built-in Harlowe colour which can't be represented by
			hex form (and which isn't converted to it during compilation).
		*/
		if (colour === "transparent") {
			colour = { r:0, g:0, b:0, a:0 };
		}
		else if (!colour.startsWith('rgb')) {
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

	/*
		These two private functions converts RGB 0..255 values into H 0..359
		and SL 0..1 values, and back.
	*/
	function RGBToHSL({r, g, b, a}) {
		// Convert the RGB values to decimals.
		r /= 255, g /= 255, b /= 255;

		const
			Max = max(r, g, b),
			Min = min(r, g, b),
			// Lightness is the average of the highest and lowest values.
			l = (Max + Min) / 2,
			delta = Max - Min;

		if (Max === Min) {
			// If all three RGB values are equal, it is a gray.
			return { h:0, s:0, l };
		}
		// Calculate hue and saturation as follows.
		let h;
		switch (Max) {
			case r: h = (g - b) / delta + (g < b ? 6 : 0); break;
			case g: h = (b - r) / delta + 2; break;
			case b: h = (r - g) / delta + 4; break;
		}
		h = round(h * 60);

		const s = l > 0.5
			? delta / (2 - Max - Min)
			: delta / (Max + Min);
		return { h, s, l, a };
	}

	function HSLToRGB({h, s, l, a}) {
		// If saturation is 0, it is a grey.
		if (s === 0) {
			const gray = floor(l * 255);
			return { r: gray, g: gray, b: gray };
		}
		// Convert the H value to decimal.
		h /= 360;

		const
			q = l < 0.5 ? l * (1 + s) : l + s - l * s,
			p = 2 * l - q;

		function hueToRGBComponent(t) {
			// Constrain temp to the range 0..1
			if (t < 0) t += 1;
			if (t > 1) t -= 1;
			// Convert to an RGB component along the graph's four slopes
			// (rising, max, falling, min).
			if (t < 1/6) return p + (q - p) * 6 * t;
			if (t < 1/2) return q;
			if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
			return p;
		}
		return {
			r: floor(hueToRGBComponent(h + 1/3) * 255),
			g: floor(hueToRGBComponent(h) * 255),
			b: floor(hueToRGBComponent(h - 1/3) * 255),
			a,
		};
	}

	/*
		These functions convert RGB 0..255 values (interpreted as sRGB, as per browser
		specs for CSS colours defined using RGB and HSL) into LCH values
		where L is 0..1+, C is 0..100+, and H is 0..360.
	*/
	const D50white = [0.96422, 1.00000, 0.82521],
		kappa = 24389/27, epsilon = 216/24389,
		down = a => a.map(v => [v]),
		across = a => a.map(v => v[0]);

	function sRGBToLCH({r,g,b,a}) {
		// Taken from https://drafts.csswg.org/css-color-4/conversions.js
		const sRGBtoXYZ = [
			[0.4124564,  0.3575761,  0.1804375],
			[0.2126729,  0.7151522,  0.0721750],
			[0.0193339,  0.1191920,  0.9503041]
		];
		const D65toD50 = [
			[ 1.0478112,  0.0228866, -0.0501270],
			[ 0.0295424,  0.9904844, -0.0170491],
			[-0.0092345,  0.0150436,  0.7521316]
		];
		let f =
			across(matMul(D65toD50, matMul(sRGBtoXYZ, down([r/255,g/255,b/255]))))
			.map((v, i) => v / D50white[i])
			.map(v => v > epsilon ? cbrt(v) : (kappa * v + 16)/116);
		const Lab = [(116 * f[1]) - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
		const hue = atan2(Lab[2], Lab[1]) * 180 / PI;
		return {
			l: Lab[0]/100,
			c: sqrt(pow(Lab[1], 2) + pow(Lab[2], 2)),
			h: hue >= 0 ? hue : hue + 360,
			a
		};
	}

	function LCHTosRGB({l,c,h,a}) {
		l*=100;
		// Taken from https://drafts.csswg.org/css-color-4/conversions.js
		const D50toD65 = [
			[ 0.9555766, -0.0230393,  0.0631636],
			[-0.0282895,  1.0099416,  0.0210077],
			[ 0.0122982, -0.0204830,  1.3299098]
		];
		const XYZtosRGB = [
			[ 3.2404542, -1.5371385, -0.4985314],
			[-0.9692660,  1.8760108,  0.0415560],
			[ 0.0556434, -0.2040259,  1.0572252]
		];
		const f = [];
		f[1] = (l + 16)/116;
		f[0] = (c * cos(h * PI / 180))/500 + f[1];
		f[2] = f[1] - (c * sin(h * PI / 180))/200;
		const XYZ = [
			pow(f[0],3) > epsilon ? pow(f[0],3) : (116*f[0]-16)/kappa,
			l > kappa * epsilon ? pow((l+16)/116,3) : l/kappa,
			pow(f[2],3) > epsilon ? pow(f[2],3) : (116*f[2]-16)/kappa
		].map((v, i) => v * D50white[i]);
		const [r,g,b] = across(matMul(D50toD65, matMul(XYZtosRGB, down(XYZ)))).map(v=>v*255);
		return {r,g,b,a};
	}

	function validsRGB(lcha) {
		var rgba = LCHTosRGB(lcha);
		return [rgba.r, rgba.g, rgba.b].every(v => v >= 0 && v <= 255);
	}

	/*
		In order to convert LCH to RGB, it is often necessary to constrain the
		colour's chroma. This function (from https://css.land/lch) binary-searches
		for the lowest chroma that can fit into RGB.
	*/
	function constrainLCH(lcha) {
		if (validsRGB(lcha)) {
			return lcha;
		}
		lcha = assign({},lcha);
		let high = lcha.c;
		let low = 0;
		lcha.c /= 2;
		while (high - low > 1e-5) {
			(validsRGB(lcha)) ? (low = lcha.c) : (high = lcha.c);
			lcha.c = (high + low)/2;
		}
		return lcha;
	}

	const Colour = Object.freeze({
		TwineScript_TypeID:     "colour",
		TwineScript_TypeName:   "a colour",
		TwineScript_ObjectName: "a colour",

		TwineScript_DebugName() {
			return "a colour " + this.TwineScript_Print();
		},
		
		/*
			Colours can be blended by addition.
		*/
		"TwineScript_+"(other) {
			/*
				These are just shorthands (for "lvalue" and "rvalue").
			*/
			const
				l = this.toRGBA(),
				r = other.toRGBA();
			
			return Colour.create({
				/*
					You may notice this is a fairly glib blending algorithm. It's the same one from Game Maker,
					though, so I'm hard-pressed to think of a more intuitive one.
				*/
				r : Math.min(Math.round((l.r + r.r) * 0.6), 0xFF),
				g : Math.min(Math.round((l.g + r.g) * 0.6), 0xFF),
				b : Math.min(Math.round((l.b + r.b) * 0.6), 0xFF),
				a : (l.a + r.a) / 2,
			});
		},
		
		TwineScript_Print() {
			const {r,g,b,a} = this.toRGBA();
			return "<tw-colour style='background-color:rgba("
				+ [r, g, b, a] + ");'></tw-colour>";
		},
		
		TwineScript_is(other) {
			if (!Colour.isPrototypeOf(other)) {
				return false;
			}
			if (other.lcha && this.lcha) {
				return other.lcha.l === this.lcha.l &&
					other.lcha.c === this.lcha.c &&
					other.lcha.h === this.lcha.h &&
					other.a === this.a;
			}
			const obj = this.toRGBA();
			other = other.toRGBA();
			return other.r === obj.r &&
				other.g === obj.g &&
				other.b === obj.b &&
				other.a === obj.a;
		},
		
		TwineScript_Clone() {
			return Colour.create(this);
		},
		
		/*
			This converts the colour into a CSS rgba() function.
		*/
		toRGBAString() {
			const {r,g,b,a} = this.toRGBA();
			return `rgba(${r}, ${g}, ${b}, ${a})`;
		},

		toHSLA() {
			return RGBToHSL(this.toRGBA());
		},

		/*
			For each of these methods, use the colour's canonical LCH if it's present.
		*/
		toRGBA() {
			return this.lch ? LCHTosRGB(constrainLCH(assign({}, this.lch, { a: this.a }))) : this;
		},

		toLCHA() {
			return this.lch ? assign({}, this.lch) : sRGBToLCH(this);
		},

		/*
			Used by (complement:), this rotates a colour's LCH hue.
		*/
		LCHRotate(r) {
			if (r < 0) {
				r = 360 + r;
			}
			const lch = this.toLCHA();
			lch.h = (lch.h+r) % 360;
			lch.a = this.a;
			return Colour.create(lch);
		},

		/*
			This, in addition to exposing r, g and b values, provides h, s and l values as alternatives.
		*/
		TwineScript_GetProperty(prop) {
			if (prop === "lch") {
				const lch = this.toLCHA();
				return new Map([['l', lch.l], ['c', lch.c], ['h', lch.h]]);
			}
			const obj = this.toRGBA();
			if (prop === "h" || prop === "s" || prop === "l") {
				return RGBToHSL(obj)[prop];
			}
			if (prop === "r" || prop === "g" || prop === "b" || prop === "a") {
				return obj[prop];
			}
		},
		TwineScript_Properties: ['h','s','l','r','g','b','a','lch'],

		TwineScript_ToSource() {
			if (this.a === 0) {
				return "transparent";
			}
			const hsl = !this.lch && RGBToHSL(this);
			if (hsl.l === 1 && !hsl.h && !hsl.s) {
				return "white";
			}
			if (hsl.l === 0 && !hsl.h && !hsl.s) {
				return "black";
			}
			if (hsl.l >= 0.5 && hsl.l < 0.5334 && hsl.s === 0) {
				return "gray";
			}
			if (hsl.l === 0.5 && (hsl.s >= 0.8 && hsl.s < 0.8040)) {
				/*
					This mapping MUST line up with that in Markup.js.
				*/
				const mapping = ({
					"0"   : "red",
					"30"  : "orange",
					"60"  : "yellow",
					"90"  : "lime",
					"120" : "green",
					"180" : "cyan",
					"210" : "blue",
					"240" : "navy",
					"270" : "purple",
					"300" : "magenta",
				})[hsl.h];
				if (mapping) {
					return mapping;
				}
			}
			/*
				Use (lch:) if it's available, otherwise (hsl:).
			*/
			return `(${(this.lch ? "lch" : "hsl") }:${this.lch ? [this.lch.l, this.lch.c, this.lch.h] : [hsl.h, hsl.s, hsl.l]}${this.a !== 1 ? "," + this.a : ""})`;
		},

		/*
			This constructor accepts an object containing r, g and b numeric properties,
			an object containing h, s and l numeric properties,
			or a string comprising a CSS hex colour.
		*/
		create(obj) {
			if (typeof obj === "string") {
				return this.create((Colour.isHexString(obj) ? hexToRGB : css3ToRGB)(obj));
			}

			// To save computation, don't do the HSL to RGB conversion
			// if the RGB values are already present.
			if ("h" in obj && "s" in obj && "l" in obj &&
					!("r" in obj) && !("g" in obj) && !("b" in obj)) {
				return this.create(HSLToRGB(obj));
			}
			// Assume alpha is 1 if it is not specified.
			if (!("a" in obj) || typeof obj.a !== "number") {
				obj.a = 1;
			}
			// LCH colours store their initial values rather than converting to
			// RGB immediately.
			if ('h' in obj && 'c' in obj && !('s' in obj) && 'l' in obj) {
				// Make sure to copy the object by value rather than by reference.
				return assign(create(this), { a: obj.a, lch: { l: obj.l, c: obj.c, h: obj.h, }});
			}
			return assign(create(this), obj);
		},
		/*
			This static method determines if a given string matches a HTML hex colour format.
		*/
		isHexString(str) {
			return (typeof str === "string" && str[0] === "#"
				&& (str.slice(1).match(tripleDigit) || str.slice(1).match(sextupleDigit)));
		},
		/*
			This static method determines if a given string resembles a CSS3 color function.
			This doesn't check if it's a valid or well-formed CSS function, though.
		*/
		isCSS3Function(str) {
			return (typeof str === "string" && /^(?:rgb|hsl)a?\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?(?:,\s*\d+(?:\.\d+)?\s*)?\)$/.test(str));
		},
	});
	return Colour;
});
