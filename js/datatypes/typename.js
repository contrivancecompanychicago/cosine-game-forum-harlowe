"use strict";
define([], () => {
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

		TwineScript_Print() {
			return "`[" + this.TwineScript_ObjectName + "]`";
		},

		create(name) {
			return Object.assign(Object.create(this), { name, TwineScript_ObjectName: "the " + name + " data type", });
		},
	});
	return TypeName;
});
