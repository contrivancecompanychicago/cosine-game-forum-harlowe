"use strict";
define([
	'datatypes/changercommand',
	'datatypes/colour',
], (Changer, Colour) => {
	/*
		A Pattern is the fundamental primitive in pattern-matching in Harlowe. A single Datatype
		is a pattern, and any data structure containing a Datatype is itself useful as a pattern.
		
		Most operators will error when given a Datatype - 'matches' is used for comparison,
		but other than that, they resist most others.
	*/
	/*d:
		Datatype data

		TBW

		| Operator | Purpose | Example
		|---
		| `matches` | Produces boolean `true` if the data on the left matches the pattern on the right. | `(a:2,3) matches (a: number, number)`
		| `is a`, `is an` | Similar to `matches`, but requires the right side to be just a type name. | `(a:2,3) is an array`, `4.1 is a number`
	*/
	const Datatype = Object.freeze({
		
		datatype: true,
		
		TwineScript_TypeName: "a datatype",

		TwineScript_Print() {
			return "`[" + this.TwineScript_ObjectName + "]`";
		},

		TwineScript_is(other) {
			return Datatype.isPrototypeOf(other) && other.name === this.name;
		},

		TwineScript_Clone() {
			return Datatype.create(this.name);
		},

		TwineScript_IsTypeOf(obj) {
			const {name} = this;

			const expectedName = Array.isArray(obj) ? "array"
				: obj instanceof Map ? "datamap"
				: obj instanceof Set ? "dataset"
				: Colour.isPrototypeOf(obj) ? "colour"
				// Lambdas, AssignmentRequests and DataType are not included because they're not meant to be pattern-matched.
				: typeof obj === "string" ? "string"
				: typeof obj === "number" ? "number"
				: typeof obj === "boolean" ? "boolean"
				// If we get this far, some kind of foreign JS value has probably been passed in.
				: "unknown";

			return name === expectedName;
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
			return Object.assign(Object.create(this), { name, TwineScript_ObjectName: "the " + name + " datatype", });
		},
	});
	return Datatype;
});
