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
], ({realWhitespace, anyRealLetter, anyCasedLetter, anyNewline}, {objectName}, Changer, Colour, Gradient, Lambda, CustomMacro, TwineError) => {
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
		| `whitespace` | Only matches a single character of whitespace (spaces, newlines, and other kinds of space).
		| `...whitespace` | This is the above type combined with the spread `...` operator. Matches empty strings, or strings containing only whitespace.
		| `lowercase` | Only matches a single lowercase character. Lowercase characters are characters that change when put through (uppercase:).
		| `...lowercase` | This is the above type combined with the spread `...` operator. Matches empty strings, or strings containing only lowercase characters.
		| `uppercase` | Only matches a single uppercase character. Uppercase characters are characters that change when put through (lowercase:).
		| `...uppercase` | This is the above type combined with the spread `...` operator. Matches empty strings, or strings containing only uppercase characters.
		| `anycase` | This matches any character which is case-sensitive - that is, where its (lowercase:) form doesn't match its (uppercase:) form.
		| `alphanumeric`, `alnum` | Only matches a single alphanumeric character (letters and numbers).
		| `...alnum`, `...alphanumeric` | This is the above type combined with the spread `...` operator. Matches empty strings, or strings containing only alphanumeric characters.
		| `digit` | Only matches a string consisting of exactly one of the characters '0', '1', '2', '3', '4', '5', '6', '7', '8', and '9'.
		| `...digit` | This is the above type combined with the spread `...` operator. Matches empty strings, or strings containing only digit characters.
		| `newline` | Only matches a newline character.
		| `const` | Matches nothing; Use this only with (set:) to make constants.
		| `any` | Matches anything; Use this with (macro:) to make variables that accept any storable type, or with (set:) inside data structure patterns.

		Finally, custom string datatypes can be created using a suite of macros, starting with (p:). If any of the string datatypes above aren't exactly suited to the task you
		need them to perform, consider using (p:) to create your own.

		If you want to check if a variable's data is a certain type, then you can use the `is a` operator to do the comparison. To check if the data in $money is a number, write `$money is a num`.

		Warning: you must write `is a` - don't write `$money is num`, because `is` by itself checks if the left side exactly equals the right side, and `num` represents all numbers,
		not the specific number contained in $money.

		Note that data that can't be stored in a variable, such as HookNames, doesn't have a corresponding datatype name, because you won't need to compare things to it.

		Additionally, along with the `is a` operator, there is a `matches` operator which is useful when you're dealing with data structures like arrays or datamaps. `$pos is a array` checks if $pos is an
		array, but that may not be precise enough for you. `$pos matches (a: number, number)` checks to see if $pos is an array containing only two numbers in a row. A data structure with datatype
		names in various positions inside it is called a **pattern**, and `matches` is used to compare data values and patterns.

		When used inside array patterns, a modified datatype called a **spread datatype** can be created using the `...` syntax. `...str` can match any number of string values inside another array.
		You can think of this as a counterpart to the spread `...` syntax used inside macro calls - just as one array is turned into many values, so too is `...str` considered equivalent to enough `str` datatypes
		to match the values on the other side.

		Some more examples.

		* `(datamap:'a',2,'b',4) matches (datamap:'b',num,'a',num))` is true.
		* `(a: 2, 3, 4) matches (a: 2, int, int)` is true. (Patterns can have exact values in them, which must be equal in the matching data).
		* `(a: ...num, ...str) matches (a: 2, 3, 4, 'five')`
		* `(a: (a: 2), (a: 4)) matches (a: (a: num), (a: even))` is true.
		* `(p: (p-many:"A"), "!")` matches "AAAAAAAA!"` is true.

		To summarise, the datatype operators are the following.

		| Operator | Purpose | Example
		|---
		| `matches` | Evaluates to boolean `true` if the data on the left matches the pattern on the right. | `(a:2,3) matches (a: num, num)`
		| `is a`, `is an` | Similar to `matches`, but requires the right side to be just a type name. | `(a:2,3) is an array`, `4.1 is a number`
		| `-type` | Produces a TypedVar, if a variable follows it. Note that there can't be any space between `-` and `type`. | `num-type $funds`
		| `...` | Produces a spread datatype, which, when used in arrays, matches zero or more values that match the type. | `(a: ...str) matches (a:'Elf','Drow','Kithkin')`
	*/
	let typeIndex, basicTypeIndex;

	const Datatype = {
		
		TwineScript_TypeID: "datatype",
		
		TwineScript_TypeName: "a datatype",

		TwineScript_Print() {
			return "`[" + this.TwineScript_ObjectName + "]`";
		},

		get TwineScript_ObjectName() {
			return "the " + (this.rest ? "..." : "") + this.name + " datatype";
		},

		TwineScript_is(other) {
			return Datatype.isPrototypeOf(other) && other.name === this.name;
		},

		TwineScript_Clone() {
			/*
				In normal operations, datatypes are only cloned (i.e. necessarily mutated) when converted to spread datatypes.
				As such, this needs only be "cloned" (which, for the purposes of complex types like (p:), is only "instanced")
				if it isn't a spread datatype yet.
			*/
			return this.rest ? this : Object.create(this);
		},

		TwineScript_ToSource() {
			return (this.rest ? "..." : "") + this.name;
		},

		TwineScript_IsTypeOf(obj) {
			const {name, rest} = this;
			return (typeIndex[name] ? typeIndex[name](obj, rest) : false);
		},

		/*
			Because Harlowe uses a different set of objects for type signatures of its
			internal functions, these user-facing type-checking objects need to be
			converted to that format when they're used for custom macros.
		*/
		toTypeSignatureObject() {
			const innerPattern = { pattern: "range", range: typeIndex[this.name] };
			/*
				Rest datatypes' semantics are "zero or more" rather than the 1-or-more semantics used for pattern:"rest" internally.
			*/
			return this.rest ? { pattern: "zero or more", innerType: innerPattern } : innerPattern;
		},

		create(name, rest = false) {
			/*
				Some type names have shorthands that should be expanded.
				Generally, the abbreviated datatype is considered the 'canonical' name.
			*/
			name = (
				name === "datamap"  ? "dm" :
				name === "dataset"  ? "ds" :
				name === "number"   ? "num" :
				name === "string"   ? "str" :
				name === "color"    ? "colour" :
				name === "boolean"  ? "bool" :
				name === "alphanumeric" ? "alnum" :
				name === "integer"  ? "int" :
				name
			);
			const ret = Object.create(this);
			ret.name = name;
			ret.rest = rest;
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
		dm:       obj => obj instanceof Map,
		ds:       obj => obj instanceof Set,
		datatype: obj => Datatype.isPrototypeOf(obj),
		changer:  obj => Changer.isPrototypeOf(obj),
		colour:   obj => Colour.isPrototypeOf(obj),
		gradient: obj => Gradient.isPrototypeOf(obj),
		lambda:   obj => Lambda.isPrototypeOf(obj),
		macro:    obj => CustomMacro.isPrototypeOf(obj),
		str:      obj => typeof obj === "string",
		num:      obj => typeof obj === "number",
		bool:     obj => typeof obj === "boolean",
	};
	/*
		These are kept separate from basicTypeIndex so that Datatype.from() doesn't have to deal with them.
	*/
	typeIndex = assign({}, basicTypeIndex, {
		even:     obj => !isNaN(obj) && (floor(abs(obj)) % 2 === 0),
		odd:      obj => !isNaN(obj) && (floor(abs(obj)) % 2 === 1),
		empty:    obj => (
			obj instanceof Map || obj instanceof Set ? !obj.size :
			Array.isArray(obj) || typeof obj === "string" ? !obj.length :
			false
		),
		int:          obj => typeof obj === "number" && obj === (obj|0),
		uppercase:    (obj, rest) => typeof obj === "string" && (rest ? obj.length !== 0 : [...obj].length === 1) && [...obj].every(char => char !== char.toLowerCase()),
		lowercase:    (obj, rest) => typeof obj === "string" && (rest ? obj.length !== 0 : [...obj].length === 1) && [...obj].every(char => char !== char.toUpperCase()),
		whitespace:   (obj, rest) => typeof obj === "string" && !!obj.match("^" + realWhitespace + (rest ? '*' : '') + "$"),
		digit:        (obj, rest) => typeof obj === "string" && !!obj.match("^\\d" + (rest ? '*' : '') + "$"),
		alnum:        (obj, rest) => typeof obj === "string" && !!obj.match("^" + anyRealLetter + (rest ? '*' : '') + "$"),
		anycase:      (obj, rest) => typeof obj === "string" && !!obj.match("^" + anyCasedLetter + (rest ? '*' : '') + "$"),
		newline:      (obj, rest) => typeof obj === "string" && !!obj.match("^" + anyNewline + (rest ? '*' : '') + "$"),
		any:      () => true,
		/*
			"const" is handled almost entirely as a special case inside VarRef. This
			function is used only for destructuring.
		*/
		const:    () => true,
	});
	return seal(Datatype);
});
