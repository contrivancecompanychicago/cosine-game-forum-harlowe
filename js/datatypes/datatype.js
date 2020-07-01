"use strict";
define([
	'datatypes/changercommand',
	'datatypes/colour',
	'datatypes/gradient',
	'datatypes/lambda',
	'datatypes/custommacro',
	'utils/operationutils',
], (Changer, Colour, Gradient, Lambda, CustomMacro, {is}) => {
	const {assign,create,freeze} = Object;
	const {floor,abs} = Math;
	/*
		A Pattern is the fundamental primitive in pattern-matching in Harlowe. A single Datatype
		is a pattern, and any data structure containing a Datatype is itself useful as a pattern.
		
		Most operators will error when given a Datatype - 'matches' is used for comparison,
		but other than that, they resist most others.
	*/
	/*d:
		Datatype data

		Datatypes are special keyword values used to confirm that a variable's data is a certain type - for instance, that a variable that should only hold a number does indeed
		do so. They can be used to perform one-off checks using the `is a` and `matches` operators, and can be combined with variables to make TypedVars, variables that
		are restricted to a certain type and that automatically perform these checks for you.

		All of the datatypes are as follows.

		| Value | Data type
		|---
		| `number`, `num` | Numbers
		| `string`, `str` | Strings
		| `boolean`, `bool` | Booleans
		| `array` | Arrays
		| `datamap`, `dm` | Datamaps
		| `dataset`, `ds` | Datasets
		| `command` | Commands
		| `changer` | Changers
		| `color`, `colour` | Colours
		| `gradient` | Gradients
		| `lambda` | Lambdas
		| `macro` | CustomMacros
		| `datatype` | Datatypes

		In addition to the above, there are a few variations of these that only match a certain subset of each type.

		| Value | Data type
		|---
		| `even` | Only matches even numbers
		| `odd` | Only matches odd numbers
		| `empty` | Only matches these empty structures: `""` (the empty string), `(a:)`, `(dm:)` and `(ds:)`.

		If you want to check if a variable's data is a certain type, then you can use the `is a` operator to do the comparison. To check if the data in $money is a number, write `$money is a num`.

		Warning: you must write `is a` - don't write `$money is num`, because `is` by itself checks if the left side exactly equals the right side, and `num` represents all numbers,
		not the specific number contained in $money.

		Note that data that can't be stored in a variable, such as HookNames, doesn't have a corresponding datatype name, because you won't need to compare things to it.

		Additionally, along with the `is a` operator, there is a `matches` operator which is useful when you're dealing with data structures like arrays or datamaps. `$pos is a array` checks if $pos is an
		array, but that may not be precise enough for you. `$pos matches (a: number, number)` checks to see if $pos is an array containing only two numbers in a row. A data structure with datatype
		names in various positions inside it is called a **pattern**, and `matches` is used to compare data values and patterns.

		Some more examples.

		* `(datamap:'a',2,'b',4) matches (datamap:'b',num,'a',num))` is true.
		* `(a: 2, 3, 4) matches (a: 2, num, num)` is true. (Patterns can have exact values in them, which must be equal in the matching data).
		* `(a: (a: 2), (a: 4)) matches (a: (a: num), (a: num))` is true.

		To summarise, the datatype operators are the following.

		| Operator | Purpose | Example
		|---
		| `matches` | Evaluates to boolean `true` if the data on the left matches the pattern on the right. | `(a:2,3) matches (a: num, num)`
		| `is a`, `is an` | Similar to `matches`, but requires the right side to be just a type name. | `(a:2,3) is an array`, `4.1 is a number`
		| `-type` | Produces a TypedVar, if a variable follows it. Note that there can't be any space between `-` and `type`. | `num-type $funds`
	*/
	let typeIndex;

	const Datatype = {
		
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
			converted to that format when they're used for custom macros.
		*/
		toTypeSignatureObject() {
			return typeIndex[this.name].sig ||
				/*
					TBW
				*/
				{ pattern: "range", range: typeIndex[this.name].typeOf };
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
				name === "bool" ? "boolean" :
				name
			);
			return assign(Object.create(this), { name, TwineScript_ObjectName: "the " + name + " datatype", });
		},
	};
	/*
		TBW
	*/
	typeIndex = {
		array:    { sig: Array,     typeOf: Array.isArray, },
		datamap:  { sig: Map,       typeOf: obj => obj instanceof Map },
		dataset:  { sig: Set,       typeOf: obj => obj instanceof Set },
		datatype: { sig: Datatype,  typeOf: obj => Datatype.isPrototypeOf(obj) },
		changer:  { sig: Changer,   typeOf: obj => Changer.isPrototypeOf(obj) },
		colour:   { sig: Colour,    typeOf: obj => Colour.isPrototypeOf(obj) },
		gradient: { sig: Gradient,  typeOf: obj => Gradient.isPrototypeOf(obj) },
		lambda:   { sig: Lambda,    typeOf: obj => Lambda.isPrototypeOf(obj) },
		macro:    { sig:CustomMacro,typeOf: obj => CustomMacro.isPrototypeOf(obj) },
		string:   { sig: String,    typeOf: obj => typeof obj === "string" },
		number:   { sig: Number,    typeOf: obj => typeof obj === "number" },
		boolean:  { sig: Boolean,   typeOf: obj => typeof obj === "boolean" },

		even:     { typeOf: obj => !isNaN(obj) && (floor(abs(obj)) % 2 === 0) },
		odd:      { typeOf: obj => !isNaN(obj) && (floor(abs(obj)) % 2 === 1) },
		empty:    { typeOf: obj => (
			obj instanceof Map || obj instanceof Set ? !obj.size :
			Array.isArray(obj) || typeof obj === "string" ? !obj.length :
			false
		)},
	};
	return freeze(Datatype);
});
