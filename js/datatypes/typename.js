"use strict";
define([
	'datatypes/changercommand',
	'datatypes/colour',
	'datatypes/hookset',
	'datatypes/lambda',
], (Changer, Colour, HookSet, Lambda) => {
	/*
		A Pattern is the fundamental primitive in pattern-matching in Harlowe. A single TypeName
		is a pattern, and any data structure containing a TypeName is itself useful as a pattern.
		
		Most operators will error when given a TypeName - 'matches' is used for comparison,
		but other than that, they resist most others.
	*/
	/*d:
		TypeName data

		TBW

		| Operator | Purpose | Example
		|---
		| `matches` | produces boolean `true` if the data on the left matches the pattern on the right | `(a:2,3) matches (a: number, number)`
		| `is a`, `is an` | similar to `matches`, but requires the right side to be just a type name. | `(a:2,3) is an array`, `4.1 is a number`
	*/
	const TypeName = Object.freeze({
		
		typename: true,
		
		TwineScript_TypeName: "a data type",
		TwineScript_Unstorable: true,

		TwineScript_Print() {
			return "`[" + this.TwineScript_ObjectName + "]`";
		},

		TwineScript_is(other) {
			return TypeName.isPrototypeOf(other) && other.name === this.name;
		},

		TwineScript_IsTypeOf(obj) {
			const {name} = this;

			const expectedName = Array.isArray(obj) ? "array"
				: obj instanceof Map ? "datamap"
				: obj instanceof Set ? "dataset"
				: Colour.isPrototypeOf(obj) ? "colour"
				: HookSet.isPrototypeOf(obj) ? "hookset"
				: Lambda.isPrototypeOf(obj) ? "lambda"
				: TypeName.isPrototypeOf(obj) ? "typename"
				// AssignmentRequest is not included because it's not intended to be pattern-matched as data.
				: typeof obj === "string" ? "string"
				: typeof obj === "number" ? "number"
				: typeof obj === "boolean" ? "boolean"
				// If we get this far, some kind of foreign JS value has probably been passed in.
				: "unknown";

			/*
				If an aforementioned foreign value was passed in, don't match it with the "data" wildcard.
			*/
			return name === expectedName || (expectedName !== "unknown" && name === "data");
		},

		create(name) {
			/*
				Some type names have shorthands that should be expanded.
			*/
			name = (
				name === "dm" ? "datamap" :
				name === "ds" ? "dataset" :
				name === "num" ? "number" :
				name === "str" ? "string" :
				name === "color" ? "colour" :
				name
			);
			return Object.assign(Object.create(this), { name, TwineScript_ObjectName: "the " + name + " data type", });
		},
	});
	return TypeName;
});
