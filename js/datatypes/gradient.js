"use strict";
define(['utils/operationutils'], ({toSource}) => {
	/*d:
		Gradient data

		Gradients are special composite data values which can be provided to (background:). Much as colour data
		represents a single colour that can be used with (text-colour:) or (background:), gradients represent
		special computer-generated backgrounds that smoothly transition from one colour on one side, to another colour
		on its other side, with any number of other colours in between.

		For an in-depth description of how to create gradients, see the article for (gradient:).

		Gradients, like colours, have a few data values you can examine, but cannot (set:).

		| Data name | Example | Meaning
		|---
		| `angle` | `$grad's angle` | The angle, a number from 0 to 359. If a value outside this range was given to `(gradient:)`, this will return that value wrapped to this range.
		| `stops` | `$grad's stops` | An array of the gradient's colour-stops. Each stop is a datamap containing "percent" and "colour" data names. <br>`(gradient: 90, 0.2, blue, 0.8, white)'s stops` is `(a:(dm: "percent", 0.2, "colour", blue), (dm: "percent", 0.8, "colour", white))`.

		Gradients, when used in passage prose or given to (print:), produce a square swatch containing the gradient. This is a `<tw-colour>`
		element, but otherwise has no other features or capabilities and is intended solely for debugging purposes.
	*/
	const Gradient = Object.freeze({
		TwineScript_TypeID:     "gradient",
		TwineScript_TypeName:   "a gradient",
		TwineScript_ObjectName: "a gradient",

		TwineScript_DebugName() {
			return "a gradient " + this.TwineScript_Print();
		},

		/*
			TODO: Permit gradients to be added together.
		"TwineScript_+"(other) {
		},
		*/

		TwineScript_GetProperty(prop) {
			if (prop === 'angle') {
				return this.angle;
			}
			if (prop === 'stops') {
				/*
					Possible concern: no error is reported when trying to (set:)
					a deep property of a gradient, such as (set: $grad's stops's (0.1) to blue),
					even though this does nothing.
				*/
				return this.stops.map(stop => new Map([["percent",stop.stop], ["colour", stop.colour.TwineScript_Clone()]]));
			}
		},
		TwineScript_Properties: ["angle","stops"],

		TwineScript_ToSource() {
			return "(gradient:" + this.angle + "," + this.stops.map(stop => toSource(stop.stop) + "," + toSource(stop.colour)) + ")";
		},

		TwineScript_is(other) {
			return other.angle === this.angle
				&& other.stops.length === this.stops.length
				&& other.stops.every(({colour, stop}, i) =>
					this.stops[i].stop === stop && this.stops[i].colour.TwineScript_is(colour)
				);
		},

		TwineScript_Clone() {
			// We don't really have to clone the gradient's stops objects, because colours
			// should be immutable in user-facing Harlowe code.
			return Gradient.create(this.angle, [...this.stops]);
		},

		TwineScript_Print() {
			return "<tw-colour style='background:" + this.toLinearGradientString() + "'></tw-colour>";
		},

		// This accepts an integer degree, plus any number of [percent, colour] pairs.
		create(angle, stops) {
			return Object.assign(Object.create(this), { angle, stops: stops.sort((a,b) => a.stop - b.stop) });
		},

		/*
			This creates a copy of the gradient, but multiplies the colour stops by the given number.
		*/
		multiply(mul) {
			return Gradient.create(this.angle, this.stops.map(({colour, stop}) => ({ colour, stop: stop*mul })));
		},

		/*
			This converts the colour into a CSS linear-gradient() function.
		*/
		toLinearGradientString() {
			return `linear-gradient(${this.angle}deg, ${
				this.stops.reduce((str, {colour,stop}) =>
					str + colour.toRGBAString() + " " + (stop*100) + "%,",
				'').slice(0,-1)
			})`;
		},
	});
	return Gradient;
});
