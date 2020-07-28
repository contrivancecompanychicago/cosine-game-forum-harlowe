"use strict";
define([
	'utils',
	'utils/operationutils',
	'datatypes/changercommand',
	'datatypes/colour',
	'datatypes/gradient',
	'datatypes/lambda',
	'datatypes/custommacro',
	'internaltypes/twineerror',
], ({realWhitespace, anyRealLetter}, {objectName, toSource}, Changer, Colour, Gradient, Lambda, CustomMacro, TwineError) => {
	const {assign,seal,keys} = Object;
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

		The built-in datatypes are as follows.

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
		| `even` | Only matches even numbers.
		| `odd` | Only matches odd numbers.
		| `integer`, `int` | Only matches whole numbers (numbers with no fractional component, and which are positive or negative).
		| `empty` | Only matches these empty structures: `""` (the empty string), `(a:)`, `(dm:)` and `(ds:)`.
		| `whitespace` | Only matches strings containing only whitespace (spaces, newlines, and other kinds of space).
		| `lowercase` | Only matches strings containing only lowercase characters. Lowercase characters are characters that change when put through (uppercase:).
		| `uppercase` | Only matches strings containing only uppercase characters. Uppercase characters are characters that change when put through (lowercase:).
		| `alphanumeric`, `alnum` | Only matches strings containing only alphanumeric characters (letters and numbers).
		| `newline` | Only matches newline characters.
		| `const` | Matches nothing; Use this only with (set:) to make constants.
		| `any` | Matches anything; Use this with (macro:) to make variables that accept any storable type, or with (set:) inside data structure patterns.

		Finally, custom string datatypes can be created using a suite of macros, starting with (p:).

		If you want to check if a variable's data is a certain type, then you can use the `is a` operator to do the comparison. To check if the data in $money is a number, write `$money is a num`.

		Warning: you must write `is a` - don't write `$money is num`, because `is` by itself checks if the left side exactly equals the right side, and `num` represents all numbers,
		not the specific number contained in $money.

		Note that data that can't be stored in a variable, such as HookNames, doesn't have a corresponding datatype name, because you won't need to compare things to it.

		Additionally, along with the `is a` operator, there is a `matches` operator which is useful when you're dealing with data structures like arrays or datamaps. `$pos is a array` checks if $pos is an
		array, but that may not be precise enough for you. `$pos matches (a: number, number)` checks to see if $pos is an array containing only two numbers in a row. A data structure with datatype
		names in various positions inside it is called a **pattern**, and `matches` is used to compare data values and patterns.

		Some more examples.

		* `(datamap:'a',2,'b',4) matches (datamap:'b',num,'a',num))` is true.
		* `(a: 2, 3, 4) matches (a: 2, int, int)` is true. (Patterns can have exact values in them, which must be equal in the matching data).
		* `(a: (a: 2), (a: 4)) matches (a: (a: num), (a: even))` is true.
		* `(p: (p-many:"A"), "!")` matches "AAAAAAAA!"` is true.

		To summarise, the datatype operators are the following.

		| Operator | Purpose | Example
		|---
		| `matches` | Evaluates to boolean `true` if the data on the left matches the pattern on the right. | `(a:2,3) matches (a: num, num)`
		| `is a`, `is an` | Similar to `matches`, but requires the right side to be just a type name. | `(a:2,3) is an array`, `4.1 is a number`
		| `-type` | Produces a TypedVar, if a variable follows it. Note that there can't be any space between `-` and `type`. | `num-type $funds`
	*/
	let typeIndex, basicTypeIndex;

	const Datatype = {
		
		TwineScript_TypeID: "datatype",
		
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

		TwineScript_ToSource() {
			return this.name;
		},

		TwineScript_IsTypeOf(obj) {
			const {name} = this;
			return (typeIndex[name] ? typeIndex[name](obj) : false);
		},

		/*
			Because Harlowe uses a different set of objects for type signatures of its
			internal functions, these user-facing type-checking objects need to be
			converted to that format when they're used for custom macros.
		*/
		toTypeSignatureObject() {
			return { pattern: "range", range: typeIndex[this.name] };
		},

		create(name) {
			/*
				Some type names have shorthands that should be expanded.
			*/
			name = (
				name === "dm"    ? "datamap" :
				name === "ds"    ? "dataset" :
				name === "num"   ? "number" :
				name === "str"   ? "string" :
				name === "color" ? "colour" :
				name === "bool"  ? "boolean" :
				name === "alnum" ? "alphanumeric" :
				name === "int"   ? "integer" :
				name
			);
			const ret = Object.create(this);
			ret.name = name;
			ret.TwineScript_ObjectName = "the " + ret.name + " datatype";
			return ret;
		},

		/*
			Used exclusively for the (datatype:) macro, this maps values to basic (i.e. not "even" or "odd" or the like) datatypes.
		*/
		from(value) {
			const typeName = keys(basicTypeIndex).find(name => basicTypeIndex[name](value));
			/*
				In the unlikely event that this was given a value that doesn't have a corresponding type, just drop an error message.
				This should never actually be displayed, but just in case some JS value is given to it somehow...
			*/
			return typeName ? Datatype.create(typeName) : TwineError.create("datatype", objectName(value) + " doesn't correspond to a datatype value.");
		},
	};
	/*
		The typeOf functions for each datatype name, stored in two objects for the benefit of .from().
		This needs to be defined after Datatype so that the "datatype" datatype can access it.
	*/
	basicTypeIndex = {
		array:    Array.isArray,
		datamap:  obj => obj instanceof Map,
		dataset:  obj => obj instanceof Set,
		datatype: obj => Datatype.isPrototypeOf(obj),
		changer:  obj => Changer.isPrototypeOf(obj),
		colour:   obj => Colour.isPrototypeOf(obj),
		gradient: obj => Gradient.isPrototypeOf(obj),
		lambda:   obj => Lambda.isPrototypeOf(obj),
		macro:    obj => CustomMacro.isPrototypeOf(obj),
		string:   obj => typeof obj === "string",
		number:   obj => typeof obj === "number",
		boolean:  obj => typeof obj === "boolean",
	};

	typeIndex = assign({}, basicTypeIndex, {
		even:     obj => !isNaN(obj) && (floor(abs(obj)) % 2 === 0),
		odd:      obj => !isNaN(obj) && (floor(abs(obj)) % 2 === 1),
		empty:    obj => (
			obj instanceof Map || obj instanceof Set ? !obj.size :
			Array.isArray(obj) || typeof obj === "string" ? !obj.length :
			false
		),
		uppercase:    obj => typeof obj === "string" && obj.length !== 0 && [...obj].every(char => char !== char.toLowerCase()),
		lowercase:    obj => typeof obj === "string" && obj.length !== 0 && [...obj].every(char => char !== char.toUpperCase()),
		integer:      obj => typeof obj === "number" && obj === (obj|0),
		whitespace:   obj => typeof obj === "string" && !!obj.match("^" + realWhitespace + "+$"),
		alphanumeric: obj => typeof obj === "string" && !!obj.match("^" + anyRealLetter + "+$"),
		newline:      obj => obj === "\n" || obj === "\r" || obj === "\r\n",
		any:      () => true,
		/*
			"const" is handled almost entirely as a special case inside VarRef. This
			function is used only for destructuring.
		*/
		const:    () => true,
	});
	return seal(Datatype);
});
