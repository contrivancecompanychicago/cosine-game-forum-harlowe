"use strict";
define([
	'datatypes/changercommand',
	'datatypes/colour',
	'datatypes/gradient',
], (Changer, Colour, Gradient) => {
	/*
		A Pattern is the fundamental primitive in pattern-matching in Harlowe. A single Datatype
		is a pattern, and any data structure containing a Datatype is itself useful as a pattern.
		
		Most operators will error when given a Datatype - 'matches' is used for comparison,
		but other than that, they resist most others.
	*/
	/*d:
		Datatype data

		If you want to check if a variable's data is a certain type - for instance, that a variable that should only hold a number does indeed
		do so - then you can use these special values to do the comparison. To check if the data in $money is a number, write `$money is a num`.

		Warning: you must write `is a` - don't write `$money is num`, because `is` by itself checks if the left side exactly equals the right side, and `num` represents all numbers, not the specific number contained in $money.

		All of the datatypes are as follows.

		| Value | Data type
		|---
		| `number`, `num` | Numbers
		| `string`, `str` | Strings
		| `boolean` | Booleans
		| `array` | Arrays
		| `datamap`, `dm` | Datamaps
		| `dataset`, `ds` | Datasets
		| `command` | Commands
		| `changer` | Changers
		| `color`, `colour` | Colours
		| `gradient` | Gradients

		Note that data that can't be stored in a variable doesn't have a corresponding datatype name, because you won't need to compare things to it.

		Additionally, along with the `is a` operator, there is a `matches` operator which is useful when you're dealing with data structures like arrays or datamaps. `$pos is a array` checks if $pos is an array, but that may not be precise enough for you. `$pos matches (a: number, number)` checks to see if $pos is an array containing only two numbers in a row. A data structure with datatype names in various positions inside it is called a **pattern**, and `matches` is used to compare data values and patterns.

		Some more pattern-matching examples:

		* `(datamap:'a',2,'b',4) matches (datamap:'b',num,'a',num))` is true.
		* `(a: 2, 3, 4) matches (a: 2, num, num)` is true. (Patterns can have exact values in them, which must be equal in the matching data).
		* `(a: (a: 2), (a: 4)) matches (a: (a: num), (a: num))` is true.

		To summarise, the two datatype-checking operators are:

		| Operator | Purpose | Example
		|---
		| `matches` | Evaluates to boolean `true` if the data on the left matches the pattern on the right. | `(a:2,3) matches (a: num, num)`
		| `is a`, `is an` | Similar to `matches`, but requires the right side to be just a type name. | `(a:2,3) is an array`, `4.1 is a number`
	*/

	const typeIndex = {
		array:    { class: Array,     typeOf: Array.isArray, },
		datamap:  { class: Map,       typeOf: obj => obj instanceof Map },
		dataset:  { class: Set,       typeOf: obj => obj instanceof Set },
		changer:  { class: Changer,   typeOf: obj => Changer.isPrototypeOf(obj) },
		colour:   { class: Colour,    typeOf: obj => Colour.isPrototypeOf(obj) },
		gradient: { class: Gradient,  typeOf: obj => Gradient.isPrototypeOf(obj) },
		string:   { class: String,    typeOf: obj => typeof obj === "string" },
		number:   { class: Number,    typeOf: obj => typeof obj === "number" },
		boolean:  { class: Boolean,   typeOf: obj => typeof obj === "boolean" },
		// Lambdas, AssignmentRequests and DataType are not included because they're not meant to be pattern-matched.
	};

	const Datatype = Object.freeze({
		
		TwineScript_TypeID: "datatype",
		
		TwineScript_TypeName: "a datatype",
		// TwineScript_ObjectName is assigned in create().

		TwineScript_Print() {
			return "`[" + this.TwineScript_ObjectName + "]`";
		},

		TwineScript_is(other) {
			return Datatype.isPrototypeOf(other) && other.name === this.name;
		},

		TwineScript_Clone() {
			return Datatype.create(this.name);
		},

		TwineScript_ToSource() {
			return this.name;
		},

		TwineScript_IsTypeOf(obj) {
			const {name} = this;

			return (typeIndex[name] ? typeIndex[name].typeOf(obj) : false);
		},

		/*
			Because Harlowe uses a different set of objects for type signatures of its
			internal functions, these user-facing type-checking objects need to be
		*/
		toTypeSignatureObject() {
			return typeIndex[this.name].class;
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
