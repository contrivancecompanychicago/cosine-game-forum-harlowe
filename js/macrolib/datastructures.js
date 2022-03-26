"use strict";
define([
	'utils',
	'utils/naturalsort',
	'macros',
	'utils/operationutils',
	'state',
	'engine',
	'passages',
	'datatypes/lambda',
	'datatypes/typedvar',
	'internaltypes/twineerror'],
({permutations, options}, NaturalSort, Macros, {objectName, subset, collectionType, isValidDatamapName, is, unique, clone, range}, State, Engine, Passages, Lambda, TypedVar, TwineError) => {
	
	const {optional, rest, either, zeroOrMore, Any, nonNegativeInteger}   = Macros.TypeSignature;
	const EnSort = NaturalSort("en");

	Macros.add
		/*
			ARRAY MACROS
		*/
		
		/*d:
			Array data
			
			There are occasions when you may need to work with a whole sequence of values at once.
			For example, a sequence of adjectives (describing the player) that should be printed depending
			on what a numeric variable (such as a health point variable) currently is.
			You could create many, many variables to hold each value, but it is preferable to
			use an array containing these values.
			
			Arrays are one of the two major "data structures" you can use in Harlowe. The other, datamaps,
			are created with (dm:). Generally, you want to use arrays when you're dealing with values whose *order*
			and *position* relative to each other matter. If you instead need to refer to values by a name, and
			don't care about their order, a datamap is best used.
			
			You can refer to and extract data at certain positions inside arrays using `1st`, `2nd`, `3rd`, and so forth:
			`$array's 1st`, also written as `1st of $array`, refers to the value in the first position. Additionally, you can
			use `last` to refer to the last position, `2ndlast` to refer to the second-last, and so forth. Arrays also have
			a `length` number: `$array's length` tells you how many values are in it. If you can't determine the exact position
			to remove an item from (because it's dependent on a variable), you can use an expression, in brackers,
			after it: `$array's ($pos - 3)`. This syntax can be chained: if an array is inside another data structure (for instance, by
			`(set: $array to (a:(a:1,2),(a:2,3)))`) then you can write `$array's 1st's 1st` to access the 1 stored in the inner array.

			**Note:** While you can normally display the contents of variables by simply placing their names directly in passage prose,
			such as `$votes`, you have to use another macro, such as (print:), to display the contents of arrays, such as `(print: $votes's 1st)`.

			To see if arrays contain certain values, you can use the `contains` and `is in` operators like so: `$array contains 1`
			is true if it contains the number 1 anywhere, and false if it does not. `1 is in $array` is another way to write that.
			The `is not in` operator is the opposite of `is in`, and is used to check that values aren't in arrays.
			If you want to check if an array contains some, or all of the values, in another array (without needing to be in the
			same order), you can compare with a special `some` (also known as `any` - no relation to the `any` datatype) or `all` name on the other array: `$array contains any of (a:2,4,6)`,
			and `$array contains all of (a:2,4,6)` will check if `$array` contains some, or all, of the numbers 2, 4 and 6.
			If you want to check if an array starts or ends with with a certain sequence of values, `start` and `end` data names
			can be used with `is` and `is not` - `$array's start is (a:2,4)` is the same as `$array's 1stto2nd is (a:2,4)`, and
			`$array's end is (a:3,6,9)` is the same as `$array's 3rdlasttolast is (a:3,6,9)`.

			(Incidentally, `some` and `all` can also be used with other operators, like `is`, `is not`, `>`, `<`, `>=`, and `<=`,
			to compare every value in the array with a number or other value. For instance, `all of (a:2,4) >= 2` is true, as is
			`some of (a:2,4) >= 4`.)

			For a more thorough check of the contents of an array, you can use `matches` and a datatype pattern. For instance,
			`$array matches (a: num, num)` lets you check that $array contains exactly two numbers, and `$array's start matches (a: 2,
			num)` lets you check that $array starts with 2 followed by another number. See the datatype article for more details.
			
			Arrays may be joined by adding them together: `(a: 1, 2) + (a: 3, 4)` is the same as `(a: 1, 2, 3, 4)`.
			You can only join arrays to other arrays. To add a bare value to the front or back of an array, you must
			put it into an otherwise empty array using the (a:) macro: `$myArray + (a:5)` will make an array that's just
			$myArray with 5 added on the end, and `(a:0) + $myArray` is $myArray with 0 at the start.

			You can make a subarray (another array containing only certain positioned values from the first array) by
			providing an array of numbers as a data name, to indicate which positions to include - `$arr's (a:1,3)`
			produces an array with only the first and third values of $arr. Negative values indicate positions counted from the array's
			end - `$arr's (a:-4,-2)` is the same as `(a: $arr's 4thlast, $arr's 2ndlast)`.  If you want to make a subarray consisting
			of a large number of consecutive fixed positions, special data names can be used - `$array's 1stto3rd` indicates the
			"1st to 3rd" positions, and is the same as `$array's (a:1,2,3)`. `$array's 3rdlasttolast` is the same as `$array's (a:-3,-2,-1)`.
			
			You can subtract items from arrays (that is, create a copy of an array with certain values removed) using
			the `-` operator: `(a:"B","C") - (a:"B")` produces `(a:"C")`. Note that multiple copies of a value in an array will all
			be removed by doing this: `(a:"B","B","B","C") - (a:"B")` also produces `(a:"C")`.
			
			You may note that certain macros, like (either:), accept sequences of values. A special operator, `...`, exists which
			can "spread out" the values inside an array, as if they were individually placed inside the macro call.
			`(either: ...$array)` is a shorthand for `(either: $array's 1st, $array's 2nd, $array's 3rd)`, and so forth for as many
			values as there are inside the $array. Note that you can still include values after the spread: `(either: 1, ...$array, 5)`
			is valid and works as expected.

			To summarise, the following operators work on arrays.
			
			| Operator | Purpose | Example
			|---
			| `is` | Evaluates to boolean `true` if both sides contain equal items in an equal order, otherwise `false`. | `(a:1,2) is (a:1,2)` (is true)
			| `is not` | Evaluates to `true` if both sides differ in items or ordering. | `(a:4,5) is not (a:5,4)` (is true)
			| `contains` | Evaluates to `true` if the left side contains the right side. | `(a:"Ape") contains "Ape"`<br>`(a:(a:99)) contains (a:99)`<br>`(a:1,2) contains some of (a:2,3)`<br>`(a:1,2) contains all of (a:2,1)`
			| `does not contain` | Evaluates to `true` if the left side does not contain the right side. | `(a:"Ape") does not contain "Egg"`
			| `is in` | Evaluates to `true` if the right side contains the left side. | `"Ape" is in (a:"Ape")`<br>`(a:99) is in (a:(a:99))`<br>`some of (a:2,3) is in (a:1,2)`<br>`all of (a:2,1) is in (a:1,2)`
			| `is not in` | Evaluates to `true` if the right side does not contain the left side. | `"Blood" is not in (a:"Sweat","Tears")`<br>`(a:98) is not in (a:(a:99))`<br>`some of (a:3,2) is not in (a:1,2)`
			| `+` | Joins arrays. | `(a:1,2) + (a:1,2)` (is `(a:1,2,1,2)`)
			| `-` | Subtracts arrays, producing an array containing every value in the left side but not the right. | `(a:1,1,2,3,4,5) - (a:1,2)` (is `(a:3,4,5)`)
			| `...` | When used in a macro call, it separates each value in the right side. | `(a: 0, ...(a:1,2,3,4), 5)` (is `(a:0,1,2,3,4,5)`)
			| `'s` | Obtains the item at the right numeric position, or the `length`, `some` or `all` values.  `'s` cannot have any spaces to its left. | `(a:"Y","Z")'s 1st` (is "Y")<br>`(a:4,5)'s (2)` (is 5)<br>`(a:5,5,5)'s length` (is 3)
			| `of` | Obtains the item at the left numeric position, or the `length`, `some` or `all` values. | `1st of (a:"Y","O")` (is "Y")<br>`(2) of (a:"P","S")` (is "S")<br>`length of (a:5,5,5)` (is 3)
			| `matches` | Evaluates to boolean `true` if the array on one side matches the pattern on the other. | `(a:2,3) matches (a: num, num)`, `(a: array) matches (a:(a: ))`
			| `does not match` | Evaluates to boolean `true` if the array on one side does not match the pattern on the other. | `(a:2,3) does not match (a: num)`, `(a: str) does not match (a:(a:'Egg'))`
			| `is a`, `is an` | Evaluates to boolean `true` if the right side is a datatype describing the left side. | `(a:2,3) is an array`, `(a: ) is an empty`
			| `is not a`, `is not an` | Evaluates to boolean `true` if the right side is a datatype that does not describe the left side. | `(a:2,3) is not an empty`

			And, here are the data names that can be used with arrays.

			| Data name | Example | Meaning
			|---
			| `1st`,`2nd`,`last`, etc. | `(a:1,2)'s last`, `1st of (a:1,2)` | A single value at the given position in the array. This causes an error if it's past the bounds of the array,
			| `1stto3rd`, `4thlastto2ndlast` etc. | `(a:1,2,3,4,5)'s 2ndto5th` | A subarray containing only the values between the given positions (such as the first, second and third for `1stto3rd`). This does NOT cause an error if it passes the bounds of the array - so `(a:1,2,3)'s 2ndto5th` is `(a:2,3)`.
			| `length` | `(a:'G','H')'s length` | The length (number of data values) in the array.
			| `random` | `(a:"a","e","i","o","u")'s random` (is `"a"`, `"e"`, `"i"`, `"o"` or `"u"`). | A random value in the array.
			| `some`, `any`, `all` | `some of (a:1,2) < 3`, `all of (a:1,2) is not 3` | Usable only with comparison operators, these allow all of the values to be quickly compared.  `any` is an old alias for `some` that functions identically, but which may be removed in a future version of Harlowe.
			| `start`, `end` | `start of (a:1,2,3,4) is (a:1,2)`, `(a:1,2,3,4)'s end is not (a:2,4)` | Usable only with the `is`, `is not`, `matches` and `does not match` operators, these allow you to compare the start or end of arrays without having to specify an exact range of values to compare.
			| Arrays of numbers, such as `(a:3,5)` | `$array's (a:1,-1)` | A subarray containing just the data values at the given positions in the array.

			A note about `random`: this is one of the features that uses Harlowe's pseudo-random number generator. If you use (seed:) at the start of the story,
			the selected values will be predetermined based on the seed string, and how many other random macros and features have been used before it.
		*/
		/*d:
			(a: [...Any]) -> Array
			Also known as: (array:)
			
			Creates an array, which is an ordered collection of values.
			
			Example usage:
			`(a:)` creates an empty array, which could be filled with other values later.
			`(a: "gold", "frankincense", "myrrh")` creates an array with three strings.
			This is also a valid array, but with its elements spaced in a way that makes them more readable.
			```
			(a:
				"You didn't sleep in the tiniest bed",
				"You never ate the just-right porridge",
				"You never sat in the smallest chair",
			)
			```
			
			Rationale:
			For an explanation of what arrays are, see the Array article. This macro is the primary
			means of creating arrays - simply supply the values to it, in order.
			
			Details:
			Note that due to the way the spread `...` operator works, spreading an array into
			the (a:) macro will re-create the original array unchanged: `(a: ...$array)` is the same as just `$array`.
			
			See also:
			(dm:), (ds:)
			
			Added in: 1.0.0
			#data structure 1
		*/
		(["a", "array"], "Array", (_, ...args) => args, zeroOrMore(
			/*
				In order for destructuring patterns to be syntactically permitted, (a:) needs to allow TypedVars
				in addition to "Any", even though TypedVars have TwineScript_Unstorable and can't be (set:) as data.
			*/
			either(TypedVar, Any)
		))
		
		/*d:
			(range: Number, Number) -> Array
			
			Produces an array containing an inclusive range of whole numbers from a to b,
			in ascending order.
			
			Example usage:
			* `(range:1,14)` is equivalent to `(a:1,2,3,4,5,6,7,8,9,10,11,12,13,14)`
			* `(range:2,-2)` is equivalent to `(a:-2,-1,0,1,2)`
			
			Rationale:
			This macro is a shorthand for defining an array that contains a sequence of
			integer values. Rather than writing out all of the numbers, you can simply provide
			the first and last numbers.
			
			Details:
			If the second number given is smaller than the first number, then (range:) will act as if their positions
			were reversed - that is, `(range:50,0)` is the same as `(range:0,50)`.

			Certain kinds of macros, like (either:) or (dataset:), accept sequences of values. You can
			use (range:) with these in conjunction with the `...` spreading operator:
			`(dataset: ...(range:2,6))` is equivalent to `(dataset: 2,3,4,5,6,7)`, and
			`(either: ...(range:1,5))` is equivalent to `(random: 1,5)`.
			
			See also:
			(a:)

			Added in: 1.0.0
			#data structure
		*/
		("range", "Array", (_, a, b) => range(a,b),
		[parseInt, parseInt])
		
		/*d:
			(subarray: Array, Number, Number) -> Array
			
			When given an array, this returns a new array containing only the elements
			whose positions are between the two numbers, inclusively.
			
			Example usage:
			* `(subarray: $a, 3, 7)` is the same as `$a's (a:3,4,5,6,7)` or `$a's 3rdto7th`
			* `(subarray: $a, 3, $b)` is the same as `$a's (range: 3, $b)` if $b is positive.
			
			Rationale:
			
			This macro may seem redundant, as you can obtain subarrays of arrays without this macro, by using the
			`'s` or `of` syntax along with either a specified range of consecutive positions, or an array of
			arbitrary position numbers. For instance, `$a's 4thto12th` obtains a subarray of $a containing
			its 4th through 12th values, `$a's (a:1,3,5)` obtains a subarray of $a
			containing just its 1st, 3rd and 5th positions, and `$a's (range:1, $b)` obtains a subarray of each
			position up to $b.

			However, in the specific situation where you want to use a variable negative position, counting from the end of the array,
			there isn't a succinct option using that syntax. When gathering each value in array $a
			between position 1 and $b, where $b is a negative position counting from the end, `(range:1, $b)` doesn't work, and
			the best you can do without this macro is something like `$a's (range: 1, $b + $a's length)`. So, this
			macro can be used as a slightly shorter alternative, by writing `(subarray: $a, 1, -$b)`.
			
			Details:

			As mentioned above, if you provide negative numbers, they will be treated as being offset from the end
			of the array - `-2` will specify the `2ndlast` item, just as 2 will specify the `2nd` item.
			
			If the last number given is larger than the first (for instance, in `(subarray: (a:1,2,3,4), 4, 2)`)
			then the macro will still work - in that case returning (a:2,3,4) as if the numbers were in
			the correct order.

			See also:
			(substring:), (rotated:)
			
			Added in: 1.0.0
			#data structure
		*/
		("subarray", "Array", (_, array, a, b) => subset(array, a, b),
		[Array, parseInt, parseInt])
		
		/*d:
			(reversed: [...Any]) -> Array
			
			Similar to (a:), except that it creates an array containing the elements in reverse order.
			
			Example usage:
			`(set: $a to (reversed: ...$a, 2))` sets $a to its reverse, with `2` at the start.

			Rationale:
			Having stored items in an array, or obtained a built-in array like (history:), you may
			want to perform some action using it - maybe assemble them into a single string using (folded:) -
			in the opposite order to which they are stored. (reversed:) allows this reversal to be easily created.

			Details:
			Unlike (shuffled:), which produces an error if one or no elements are given, this does not error if
			a non-reversible sequence of one or zero is given. This is meant to permit its wider use with data
			whose length you may not always have control over, such as the (history:) array.

			If you wish to specifically reverse the characters in a string, please use (str-reversed:).
			
			See also:
			(a:), (shuffled:), (rotated:), (str-reversed:)
			
			Added in: 3.0.0
			#data structure
		*/
		("reversed", "Array", (_, ...args) => args.reverse().map(clone), zeroOrMore(Any))

		/*d:
			(shuffled: ...Any) -> Array
			
			Similar to (a:), this produces an array of the given values, except that it randomly rearranges the elements instead
			of placing them in the given order.
			
			Example usage:
			```
			(if: $condiments is not an array)[(set: $condiments to (shuffled: "mustard", "mayo", "chili sauce", "salsa"))]
			You reach into the fridge and grab... (nth: visits, ...$condiments)? OK.
			```
			
			Rationale:
			If you're making a particularly random story, you'll often want to create a 'deck'
			of random descriptions, elements, etc. that you can use repeatedly. That is to say, you'll want
			to put them in a random order in an array, preserving that random order for the duration of a game.
			
			The (either:) macro is useful for selecting an element from an array randomly
			(if you use the spread `...` syntax), but isn't very helpful for this particular problem. Additionally,
			the `random` data name of arrays can be used to retrieve a random value, and can remove that value using
			(move:), but it isn't as effective if you want that value to remain in the deck after being used.

			The (shuffled:) macro is another solution: it takes elements and returns a randomly-ordered array that
			can be used as you please.
			
			Details:
			This is one of the features that uses Harlowe's pseudo-random number generator. If you use (seed:) at the start of the story,
			the order will be predetermined based on the seed string, and how many other random macros and features have been used before it.

			As of 3.3.0, giving zero or more values to (shuffled:) will cause an empty array (such as by `(a:)`) to be returned,
			rather than causing an error to occur.

			See also:
			(a:), (either:), (rotated:)
			
			Added in: 1.1.0
			#data structure
		*/
		("shuffled", "Array", (_, ...args) => State.shuffled(...args).map(clone),
		[zeroOrMore(Any)])
		
		/*d:
			(sorted: [Lambda], ...Any) -> Array
			
			This macro produces an array in which the values are sorted in English alphanumeric sort order. If any of the values are not
			numbers or strings, a "via" lambda must be given first, which is used to translate the value into a number or string that
			it should be sorted by.
			
			Example usage:
			* `(set: $a to (a: 'A','C','E','G', 2, 1))(sorted: ...$a)` produces `(a:1,2,"A","C","E","G")`.
			* `(sorted: via its name, ...$creatures)` sorts the datamaps in the array stored in $creatures by their "name" values. Datamaps with an alphanumerically earlier "name" appear first.
			* `(sorted: via its length * -1, "Gus", "Arthur", "William")` produces `(a: "William", "Arthur", "Gus"))`. This lambda produces negative numbers for each string.
			* `(sorted: via its tags's length, ...(passages: ))` produces a version of the (passages:) array, sorted by ascending number of tags each passage datamap has.
			* `(sorted: via (passage:it)'s exclusivity, ...(history: ))` produces a version of the (history:) array (which is an array of passage name strings), sorted
			by the (exclusivity:) metadata the passage with that name has.
			* `(sorted: via its h, orange, red, blue, yellow)` produces `(a: red, orange, yellow, blue)`.
			* `(sorted: via (random:1,100), ...$arr)` is mostly the same as `(shuffled:...$arr)`.
			* `(sorted: via its urgency, ...(sorted: via its exclusivity, ...(passages: )))` sorts the (passages:) array by urgency, and sorts ties by exclusivity.
			
			Rationale:
			The main purpose of arrays is to store data values in a specific order - feats the player has performed,
			names of open storylets from (open-storylets:), visited passage names from (history:), names of file slots as produced
			by `(dataentries:(saved-games: ))`, to name just a few examples. However, there are times when you want to work with
			the same array in a different order, either because the default ordering isn't to your needs - for instance, you wish to list open
			storylets by one of their metadata values - or you need to include special exceptions to the normal ordering - for instance, you want to sort
			(history:) passages with a certain tag higher than others. This macro can be used to create a sorted array,
			organising the given values in either alphanumeric order, or by a particular alphanumeric key.
			
			Details:
			The optional "via" lambda must translate each value into either a number or string - otherwise, it will produce an error. It can be provided even if
			any of the values are already numbers or strings.

			The values are sorted *as if* they were the value that the "via" lambda produced. In the example of `(sorted: via its length * -1, "Gus", "Arthur", "William")`. the string
			"Gus" is sorted *as if* it was `"Gus"'s length * -1` (which is -3), "Arthur" is sorted *as if* it was `"Arthur"'s length * -1` (which is -6),
			and "William" is sorted *as if* it was `"William"'s length * -1` (which is -7). This allows a variety of sorting options.
			Datamaps may be sorted by any one of their string or number values, and strings may be sorted in different ways than just their alphanumeric order.

			Values sorted by a "via" lambda, but which have the same value to that lambda, are kept in the same order. This is known as a "stable" sort.
			`(sorted:via its 1st, 'Bob', 'Alice', 'Blake', 'Bella', 'Bertrude')`, which only sorts the strings by their first letter,
			will always produce `(a:"Alice","Bob","Blake","Bella","Bertrude")`, even though "Blake" is alphabetically sooner than "Bob". This means that, if one needs
			to sort an array of datamaps by multiple values (such as sorting a set of characters by name, then by age), 

			Unlike other programming languages, strings (either produced by the "via" lambda, or sorted by themselves when no lambda was given)
			aren't sorted using ASCII sort order, but *alphanumeric* sorting:
			the string "A2" will be sorted after "A1" and before "A11". Moreover, if the player's web browser
			supports internationalisation (that is, every current browser except IE 10), then
			the strings will be sorted using English language rules (for instance, "é" comes after "e" and before
			"f", and regardless of the player's computer's language settings. Otherwise, it will sort
			using ASCII comparison (whereby "é" comes after "z").

			If there is no "via" lambda, and a non-string, non-number is given to this macro, an error will be produced.
			
			Currently there is no way to specify an alternative language locale to sort by, but this is likely to
			be made available in a future version of Harlowe.
			
			As of 3.3.0, giving zero or more values (after the optional lambda) to (sorted:) will cause an empty array (such as by `(a:)`) to be returned,
			rather than causing an error to occur.

			See also:
			(a:), (shuffled:), (rotated:)
			
			Added in: 1.1.0
			#data structure
		*/
		("sorted", "Array", (section, ...args) => {
			/*
				If there's no lambda, NaturalSort can handle everything.
			*/
			if (!Lambda.isPrototypeOf(args[0])) {
				/*
					(sorted:)'s type restrictions are complex enough that we must check the major restriction ourselves here.
				*/
				const invalid = args.find(e => typeof e !== "string" && typeof e !== "number");
				if (invalid && invalid.length) {
					return TwineError.create('datatype', `If (sorted:) isn't given a 'via' lambda, it must be given only numbers and strings, not ${objectName(invalid[0])}.`);
				}
				return args.sort(EnSort);
			}
			let lambda = args.shift();
			if ("making" in lambda || "where" in lambda || "when" in lambda || !("via" in lambda)) {
				return TwineError.create('datatype', `The optional lambda given to (sorted:) must be a 'via' lambda, not ${objectName(lambda)}.`);
			}
			/*
				Convert the values into key-value pairs using the lambda.
			*/
			for (let i = 0; i < args.length; i += 1) {
				const key = lambda.apply(section, {loop:args[i], pos:i+1});
				/*
					Check for the usual errors.
				*/
				if (TwineError.containsError(key)) {
					return key;
				}
				if (typeof key !== "string" && typeof key !== "number") {
					return TwineError.create('datatype', `The "via" lambda given to (sorted:) couldn't convert ${objectName(args[i])} into a string or number.`);
				}
				/*
					For simplicity, key-value pairs are simply an array pair.
				*/
				args[i] = [args[i], key];
			}
			return args.sort((a,b) => EnSort(a[1],b[1])).map(e => e[0]);
		},
		[zeroOrMore(Any)])
		
		/*d:
			(rotated: Number, ...Any) -> Array
			
			Similar to the (a:) macro, but it also takes a number at the start, and moves
			each item forward by that number, wrapping back to the start
			if they pass the end of the array.
			
			Example usage:
			* `(rotated: 1, 'A','B','C','D')` is equal to `(a: 'D','A','B','C')`.
			* `(rotated: -2, 'A','B','C','D')` is equal to `(a: 'C','D','A','B')`.
			
			Rationale:
			Sometimes, you may want to cycle through a sequence of values, without
			repeating any until you reach the end. For instance, you may have a rotating set
			of flavour-text descriptions for a thing in your story, which you'd like displayed
			in their entirety without the whim of a random picker. The (rotated:) macro
			allows you to apply this "rotation" to a sequence of data, changing their positions
			by a certain number without discarding any values.
			
			Remember that, as with all macros, you can insert all the values in an existing
			array using the `...` syntax: `(set: $a to (rotated: 1, ...$a))` is a common means of
			replacing an array with a rotation of itself.
			
			Think of the number as being an addition to each position in the original sequence -
			if it's 1, then the value in position 1 moves to 2, the value in position 2 moves to 3,
			and so forth.

			Incidentally... you can also use this macro to rotate a string's characters, by doing
			something like this: `(str: ...(rotated: 1, ...$str))`
			
			Details:
			As of 3.3.0, providing fewer than two items to this macro will not result in an error (even though that isn't enough
			values to meaningfully rotate).

			As of 3.3.0, rotating by a number of positions greater (or, if negative, less) than the number of values
			will still result in that many rotations occurring, without an error being produced.

			If you can't reliably know how many positions you wish to rotate, but know that you need a certain
			value to be at the front, simply use the (rotated-to:) variant of this macro instead.
			
			See also:
			(sorted:), (rotated-to:)
			
			Added in: 1.1.0
			#data structure
		*/
		("rotated", "Array", (_, number, ...array) => {
			/*
				This macro's range bounds are maybe a bit strict, but ensure that this behaviour
				could (maybe) be freed up in later versions.
			*/
			if (number === 0) {
				return TwineError.create("macrocall", "I can't rotate these values by 0 positions.");
			}
			/*
				If the numer of rotations is greater than the array length, loop them around.
			*/
			number = Math.abs(number) % array.length * Math.sign(number);
			/*
				The number is thought of as an offset that's added to every index.
				So, to produce this behaviour, it must be negated.
			*/
			const index = number * -1;
			return array.slice(index).concat(array.slice(0, index)).map(clone);
		},
		[parseInt, zeroOrMore(Any)])

		/*d:
			(rotated-to: Lambda, [...Any]) -> Array
			
			Similar to the (a:) macro, but it also takes a "where" lambda at the start, and
			cycles the order of the subsequent values so that the first value to match the lambda is
			placed at the start.

			Example usage:
			* `(rotated-to: where it is 'D', 'A','B','C','D')` is equal to `(a: 'D','A','B','C')`.
			* `(rotated-to: where it > 3, 1, 2, 3, 4, 5)` is equal to `(a: 4, 5, 1, 2, 3)`.

			Rationale:
			This is a variation of the (rotated:) macro. Both of these macros allow you to cycle through a sequence of values,
			wrapping back to the start, until a certain value is at the front, then provide an array of the values in that order.
			The former macro lets you specify an exact number of rotations to do; this one lets you specify what kind of value
			should be at the front, if you don't know the exact order of the passed-in strings (which may be the case if they come
			from an array).

			Note that while the lambda argument provides a lot of flexibility, if you simply want to compare each value to a known
			value, `where it is` (such as in an example above) is a simple enough lambda formulation to do so.

			Details:
			If the lambda doesn't match any of the values (that is, there's no value to rotate to) then an error will result.

			As of 3.3.0, you may give only one item after the lambda without causing an error (although an error will still occur
			if the given lambda doesn't match it).

			See also:
			(sorted:), (rotated:), (find:)

			Added in: 3.2.0
			#data structure
		*/
		("rotated-to", "Array", (section, lambda, ...array) => {
			const elems = lambda.filter(section, array);
			if (TwineError.containsError(elems)) {
				return elems;
			}
			if (!elems.length) {
				return TwineError.create("macrocall", "None of these " + array.length + " values matched the lambda, so I can't rotate them.");
			}
			const index = array.indexOf(elems[0]);
			return array.slice(index).concat(array.slice(0, index)).map(clone);
		},
		[Lambda.TypeSignature('where'), rest(Any)])

		/*d:
			(repeated: Number, ...Any) -> Array
			
			When given a number and a sequence of values, this macro produces an array containing
			those values repeated, in order, by the given number of times.
			
			Example usage:
			* `(repeated: 5, false)` produces `(a: false, false, false, false, false)`
			* `(repeated: 3, 1,2,3)` produces `(a: 1,2,3,1,2,3,1,2,3)`
			
			Rationale:
			This macro, as well as (range:), are the means by which you can create a large array of
			similar or regular data, quickly. Just as an example: you want, say, an array of several
			identical, complex datamaps, each of which are likely to be modified in the game,
			you can use (repeated:) to make those copies easily. Or, if you want, for instance, a
			lot of identical strings accompanied by a lone different string, you can use (repeated:)
			and add a `(a: "string")`to the end.

			When you already have an array variable, this is similar to simply adding that variable
			to itself several times. However, if the number of times is over 5, this can be much
			simpler to write.
			
			Details:
			An error will, of course, be produced if the number given is negative, or contains a fraction.
			As of 3.2.0, however, it will no longer error if the number is 0.

			If you wish to repeat a string multiple times, please use (str-repeated:).
			
			See also:
			(a:), (range:), (str-repeated:)
			
			Added in: 2.0.0
			#data structure
		*/
		("repeated", "Array", (_, number, ...array) => {
			const ret = [];
			if (!array.length) {
				return ret;
			}
			while(number-- > 0) {
				ret.push(...array);
			}
			return ret.map(clone);
		},
		[nonNegativeInteger, rest(Any)])

		/*d:
			(interlaced: Array, ...Array) -> Array
			
			Takes multiple arrays, and pairs up each value in those arrays: it
			creates an array containing each array's first value followed by each
			array's second value, and so forth. If some values have no matching pair (i.e. one array
			is longer than the other) then those values are ignored.
			
			Example usage:
			`(interlaced: (a: 'A', 'B', 'C', 'D'), (a: 1, 2, 3))` is the same as `(a: 'A',1,'B',2,'C',3)`
			
			Rationale:
			There are a couple of other macros which accept data in pairs - the most notable being
			(dm:), which takes data names and data values paired. This macro can help
			with using such macros. For instance, you can supply an array of (datanames:) and
			(datavalues:) to (interlaced:), and supply that to (dm:), to produce the original
			datamap again. Or, you can supply just the names, and use a macro like (repeated:) to
			fill the other values.
			
			However, (interlaced:) can also be of use alongside macros which accept a sequence: you
			can use it to cleanly insert values between each item. For instance, one can pair
			an array with another array of spaces, and then convert them to a string with (str:).
			`(str: ...(interlaced: $arr, (repeated: $arr's length, ' ')))` will create a string containing
			each element of $arr, followed by a space.
			
			Details:
			If one of the arrays provided is empty, the resulting array will be empty, as well.
			
			See also:
			(a:), (rotated:), (repeated:)
			
			Added in: 2.0.0
			#data structure
		*/
		("interlaced", "Array", (_, ...arrays) => {
			/*
				Determine the length of the longest array.
			*/
			let len = Math.min(...arrays.map(arr => arr.length));
			const ret = [];
			/*
				For each array, add its element to the returning array.
			*/
			for(let i = 0; i < len; i += 1) {
				for(let j = 0; j < arrays.length; j+=1) {
					ret.push(clone(arrays[j][i]));
				}
			}
			return ret;
		},
		[Array, rest(Array)])
		/*d:
			(permutations: ...Any) -> Array

			When given a sequence of values, this produces an array containing each permutation of the order of those values, as
			arrays.

			Example usage:
			* `(permutations: "☆", "♡", "∪")` produces `(a:(a:"☆","♡","∪"),(a:"♡","☆","∪"),(a:"∪","☆","♡"),(a:"☆","∪","♡"),(a:"♡","∪","☆"),(a:"∪","♡","☆"))`.

			Rationale:
			If you're writing an algorithm that cares about combinations of data, such as a procedurally generated puzzle or password, you may find that this macro has
			a number of subtle uses. This macro by itself provides an easy way to check if a sequence of values contains exactly the same values as
			another sequence, regardless of order. For instance, you can check if another array stored in `$array` contains exactly two 3s, two 2s and one 1 by
			writing `(permutations:3,1,3,2,2) contains $array`, because if it was so, the array would be included among those permutations. You can't perform
			this check by writing `(dataset:3,1,3,2,2) is (dataset:...$array)` because datasets, by design, don't hold multiples of a single value (such as 3).

			Additionally, this macro can be combined with (filtered:) and (shuffled:) to help you find a permutation that matches certain criteria. For instance,
			to find a random permutation of the numbers 0 to 5 that doesn't begin with 0, you can write
			`1st of (shuffled: ...(filtered: where its 1st is not 0, ...(permutations:0,1,2,3,4)))`. While this could be performed by simply re-running
			`(shuffled:0,1,2,3,4)` until it produced an array that didn't begin with 0, the code to check and re-run this would be much more complicated.

			Details:
			When given no values, this simply returns the empty array `(a:)`.

			See also:
			(shuffled:)

			Added in: 3.2.0
			#data structure
		*/
		("permutations", "Array", (_, ...values) =>  !values.length ? [] : permutations(...values), [zeroOrMore(Any)])
		/*d:
			(unique: ...Any) -> Array

			When given a sequence of values, this produces an array containing each unique value once, in the order that they appeared.

			Example usage:
			* `(unique: 1,2,1,2,3,5,5,6,3)` produces `(a: 1,2,3,5,6)`
			* `(unique: ...(history: ))` produces an array listing the name of every passage currently visited, in the order they were first visited.
			* `(reversed: ...(unique: ...(reversed: ...(history: ))))` produces an array listing the name of every passage currently visited,
			in the order they were **last** visited. This does so by reversing the array before spreading it into (unique:), then un-reversing it.
			* `(unique: ...(altered: via its address, ...$emails))` produces an array of every unique address from among the datamaps in $emails,
			in the same order.

			Rationale:
			Arrays are used to hold values whose ordering matters, such as the sequentially visited passages in the array that (history:) produces.
			Sometimes, though, you want to eliminate duplicate data from the array in order to use it for some purpose. For instance, you may
			want to show a list (using (for:)) of every passage the player has visited, in the order they've visited, but without duplicate entries in the
			list. While (dataset:) and the spread `...` syntax can be used to eliminate duplicate entries from an array, such as by `(a:...(ds: ...(history: )))`,
			this has a small problem: datasets only hold unordered data, and when the dataset is spread using `...`, the values are sorted instead of
			in their original order. (unique:) provides an easier method of removing duplicates from an a sequence of values.

			Details:
			Two values are considered unique if the `is` operator, when placed between them, would produce `false`. This is the same method of uniqueness
			used by datasets.

			When given no values, this simply returns the empty array `(a:)`. When given values that are all unique, this returns an array of all the
			values, with no error occurring.

			See also:
			(dataset:), (sorted:)

			Added in: 3.3.0
			#data structure
		*/
		("unique", "Array", (_, ...values) => values.filter(unique), [zeroOrMore(Any)])
		/*d:
			(altered: Lambda, [...Any]) -> Array

			This takes a "via" lambda and a sequence of values, and creates a new array with the same values in the same order,
			but altered via the operation in the lambda's "via" clause.

			Example usage:
			* `(altered: _monster via "Dark " + _monster, "Wolf", "Ape", "Triffid")` produces `(a: "Dark Wolf", "Dark Ape", "Dark Triffid")`
			* `(altered: _player via _player + (dm: "HP", _player's HP - 1), ...$players)` produces an array of $players datamaps whose "HP" datavalue is decreased by 1.

			Rationale:
			Transforming entire arrays or datasets, performing an operation on every item at once, allows arrays to be modified with the same ease
			that single values can - just as you can add some extra text to a string with a single +, so too can you add extra text to an entire
			array of strings using a single call to (altered:).

			This macro uses a lambda (which is just the "temp variable `via` an expression" expression) to take each item in the sequence and produce a new
			value to populate the resulting array. For `(altered: _a via _a + 1, 10,20,30)` it will produce 10 + 1, 20 + 1 and 30 + 1, and put those
			into a new array.

			Details:
			Of course, if any operation applied to any of the values should cause an error, such as trying to add a string to a number,
			an error will result.

			An error will NOT appear if you provide no values after the lambda - an empty array will be returned instead.
			This allows you to write `(altered: $lambda, ...$array)` without checking whether $array contains any values (which
			you may not be certain of, if it contains the result of a previous (find:)).

			The temp variable, which you can name anything you want, is controlled entirely by the lambda - it doesn't exist
			outside of it, it won't alter identically-named temp variables outside of it, and you can't manually (set:)
			it within the lambda.

			You can refer to other variables, including other temp variables, in the `via` expression. For instance, you can write
			`(altered: _object via _playerName + "'s " + _object, "Glove", "Hat", "Purse")`. However, for obvious reasons,
			if the outer temp variable is named the same as the lambda's temp variable, it can't be referred to in the expression.

			If no values are given to (altered:) except for the lambda, an empty array will be produced.

			See also:
			(for:), (folded:)

			Added in: 2.0.0
			#data structure
		*/
		("altered", "Array", (section, lambda, ...args) => args.map((loop, pos) => lambda.apply(section, {loop, pos:pos+1})),
		[Lambda.TypeSignature('via'), zeroOrMore(Any)])
		/*d:
			(find: Lambda, [...Any]) -> Array

			This searches through the given values, and produces an array of those which match the given search
			test (which is expressed using a temp variable, the `where` keyword, and a boolean condition).
			If none match, an empty array is produced.

			Example usage:
			* `(find: _person where _person is not "Alice", ...$people)` produces a subset of $people not containing the string `"Alice"`.
			* `(find: _item where _item's 1st is "A", "Thorn", "Apple", "Cryptid", "Anchor")` produces `(a: "Apple", "Anchor")`.
			* `(find: _num where (_num >= 12) and (it % 2 is 0), 9, 10, 11, 12, 13, 14, 15, 16)` produces `(a: 12, 14, 16)`.
			* `(find: _val where _val + 2, 9, 10, 11)` produces an error, because `_val + 2` isn't a boolean.
			* `1st of (find: _room where _room's objs contains "Egg", ...$rooms)` finds the first datamap in $rooms whose "objs" contains the string `"Egg"`.

			Rationale:
			Selecting specific data from arrays or sequences based on a user-provided boolean condition is one of the more common and powerful
			operations in programming. This macro allows you to immediately work with a subset of the array's data, without
			caring what kind of subset it is. The subset can be based on each string's characters, each datamap's values, each number's
			evenness or oddness, whether a variable matches it... anything you can write.

			This macro uses a lambda (which is just the "temp variable `where` a condition" expression) to check every one of
			the values given after it. For `(find: _item where _item > 40, 30, 60, 90)`, it will first check if `30 > 40` (which
			is `false`), if `60 > 40` (which is `true`), and if `90 > 40` (which is `true`), and include in the returned array
			those values which resulted in `true`.

			Details:
			Of course, if any condition should cause an error, such as checking if a number contains a number, then the error will appear.

			However, an error will NOT appear if you provide no values after the lambda - searching an empty sequence will simply
			result in an empty array being returned. This allows you to write `(find: $lambda, ...$array)` without checking whether $array contains
			any values (which you may not be certain of, if it contains the result of a previous (find:)).

			The temp variable, which you can name anything you want, is controlled entirely by the lambda - it doesn't exist
			outside of it, it won't alter identically-named temp variables outside of it, and you can't manually (set:)
			it within the lambda.

			You can refer to other variables, including other temp variables, in the `where` condition. For instance, you can
			write `(set: _name to "Eva")(find: _item where _item is _name, "Evan", "Eve", "Eva")`. However, for obvious reasons,
			if the outer temp variable is named the same as the lambda's temp variable, it can't be referred to in the condition.

			There isn't a way to examine the position of a value in the condition - you can't write, say, `(find: _item where
			_pos % 2 is 0, "A", "B", "C", "D")` to select just "B" and "D".

			You shouldn't use this macro to try and alter the given values! Consider the (altered:) or (folded:) macro instead.

			See also:
			(sorted:), (all-pass:), (some-pass:), (none-pass:)

			Added in: 2.0.0
			#data structure
		*/
		("find", "Array", (section, lambda, ...args) => lambda.filter(section, args),
		[Lambda.TypeSignature('where'), zeroOrMore(Any)])
		/*d:
			(all-pass: Lambda, [...Any]) -> Boolean
			Also known as: (pass:)

			This takes a "where" lambda and a series of values, and evaluates to true if the lambda, when run using each value, never evaluated to false.

			Example usage:
			* `(all-pass: _num where _num > 1 and < 14, 6, 8, 12, 10, 9)` is the same as `all of (a:6, 8, 12, 10, 9) > 1 and < 14`.
			* `(all-pass: _room where "Egg" is not in _room's objs, ...$rooms)` is true if each datamap in $rooms doesn't have the string `"Egg"` in its "objs".

			Rationale:
			The `contains` and `is in` operators can be used to quickly check if a sequence of values contains an exact value or values, and, combined with the
			`all` and `some` data names, can check that the values in a sequence merely resemble a kind of value - for instance, that they're positive
			numbers, or strings beginning with "E". But, they are times when you're writing the same check over and over, like `is an empty or is a whitespace`,
			or something more complicated, and would like the ability to store the check in a lambda and reuse it.

			The (all-pass:) macro lets you perform these checks easily using a lambda, identical to that used with (find:) - simply write a "temp variable
			`where` a condition" expression, and every value will be put into the temp variable one by one, and the condition checked for each.

			Additionally, you can use (all-pass:) just to run a single "where" lambda against a single value - for instance, as a variation of
			(if:). This is permitted, too - simply write the lambda and the single value. For those cases, you may wish to write it as (pass:),
			a shorthand form that visually indicates that you're only checking one value rather than "all".

			Details:
			Of course, if any condition should cause an error, such as checking if a number contains a number, then the error will appear.

			If zero values are given to (all-pass:), then it will return true by default.

			The temp variable, which you can name anything you want, is controlled entirely by the lambda - it doesn't exist
			outside of it, it won't alter identically-named temp variables outside of it, and you can't manually (set:)
			it within the lambda.

			You can refer to other variables, including other temp variables, in the `where` condition. For instance, you can
			write `(set: _name to "Eva")(all-pass: _item where _item is _name, "Evan", "Eve", "Eva")`. However, for obvious reasons,
			if the outer temp variable is named the same as the lambda's temp variable, it can't be referred to in the condition.

			See also:
			(sorted:), (count:), (find:), (some-pass:), (none-pass:)

			Added in: 2.0.0
			#data structure
		*/
		(["all-pass", "pass"], "Boolean", (section, lambda, ...args) => {
			const ret = lambda.filter(section, args);
			return TwineError.containsError(ret) || ret.length === args.length;
		},
		[Lambda.TypeSignature('where'), zeroOrMore(Any)])
		/*d:
			(some-pass: Lambda, ...Any) -> Boolean

			This is similar to (all-pass:), but produces true if one or more value, when given to the lambda, evaluated to true.
			It can be thought of as shorthand for putting `not` in front of (none-pass:).
			If zero values are given to (all-pass:), then it will return false by default.
			For more information, consult the description of (all-pass:).

			Example usage:
			```
			(set: $partyMembers to (a: (dm: "name", "Alan", "curseLevel", 0), (dm: "name", "Jess", "curseLevel", 0)))))
			(set: $taintedParty to (some-pass: where its curseLevel > 0, ...$partyMembers))
			```

			Added in: 2.0.0
			#data structure
		*/
		("some-pass", "Boolean", (section, lambda, ...args) => {
			const ret = lambda.filter(section, args);
			return TwineError.containsError(ret) || ret.length > 0;
		},
		[Lambda.TypeSignature('where'), zeroOrMore(Any)])
		/*d:
			(none-pass: Lambda, ...Any) -> Boolean

			This can be thought of as the opposite of (all-pass:): it produces true if every value, when given to the lambda, never evaluated to true.
			If zero values are given to (none-pass:), then it will return true by default, just like (all-pass:).
			For more information, consult the description of (all-pass:).

			Example usage:
			```
			(set: $partyMembers to (a: (dm: "name", "Alan", "curseLevel", 0), (dm: "name", "Jess", "curseLevel", 0)))))
			(set: $noMelvins to (none-pass: where its name is "Melvin", ...$partyMembers))
			```

			Added in: 2.0.0
			#data structure
		*/
		("none-pass", "Boolean", (section, lambda, ...args) => {
			const ret = lambda.filter(section, args);
			return TwineError.containsError(ret) || ret.length === 0;
		},
		[Lambda.TypeSignature('where'), zeroOrMore(Any)])
		/*d:
			(folded: Lambda, ...Any) -> Any

			This takes a "making" lambda and a sequence of values, and creates a new value (the "total") by feeding every value in the
			sequence to the lambda, akin to folding a long strip of paper into a single square. The first value after the lambda is put into the total
			(which is the variable inside the lambda's "making" clause) before running the lambda on the remaining values.

			Example usage:
			* `(folded: _enemy making _allHP via _allHP + _enemy's HP, 0, ...$enemies)` will first set _allHP to 0, then add $enemies's 1st's HP to it,
			then add the remaining HP values to it. Then it will return the number in _allHP.
			* `(folded: _name making _allNames via _allNames + "/" + _name, ...(history: ))` is the same as `(joined: "/", ...(history: ))`.

			Rationale:
			The (for:) macro, while intended to display multiple copies of a hook, can also be used to run a single macro call multiple times. You may
			wish to use this to repeatedly (set:) a variable to itself plus one of the looped values (or some other operation). (folded:) is meant
			to let you perform this in a shorter, more fluid fashion.

			Consider, first of all, a typical (for:) and (set:) loop such as the following:
			```
			(set:$enemies to (a:(dm:"Name","Mossling", "HP",7), (dm:"Name","Moldling","HP",2)))
			{(set:_allHP to 0)
			(for: each _enemy, ...$enemies)[
			    (set:_allHP to it + _enemy's HP)
			]}
			TOTAL HEART POINTS: _allHP
			```
			This can be rewritten using (folded:) as follows. While this version may seem a little harder to read if you're not used to it, it
			allows you to accomplish the same thing in a single line, by immediately using the macro's provided value without a variable:
			```
			(set:$enemies to (a:(dm:"Name","Mossling", "HP",7), (dm:"Name","Moldling","HP",2)))
			TOTAL HEART POINTS: (folded: _enemy making _allHP via _allHP + _enemy's HP, 0, ...$enemies)
			```

			If you need to perform this operation at various different times in your story, you may wish to (set:) the lambda into a variable,
			so that you, for instance, might need only write:
			```
			(set:$enemies to (a:(dm:"Name","Mossling", "HP",7), (dm:"Name","Moldling","HP",2)))
			(set: $totalEnemyHP to (_enemy making _allHP via _allHP + _enemy's HP))
			TOTAL HEART POINTS: (folded: $totalEnemyHP, 0, ...$enemies)
			```

			Details:
			Let's look at this example usage again.
			```
			(set:$enemies to (a:(dm:"Name","Mossling", "HP",7), (dm:"Name","Moldling","HP",2)))
			(folded: _enemy making _allHP via _allHP + _enemy's HP, 0, ...$enemies)
			```
			This macro call uses a "making" lambda (which is the "temp variable `making` another temp variable `via` expression" expression) to run the
			expression using every provided value, much like those repeated (set:) calls. The temp variable in the "making" clause, `_allHP`, is the **total**,
			and at the start, it is set to the first provided value (in this case, 0). The temp variable at the start, `_enemy`, is then set to the next value
			after that (which in this case would be the "Mossling" datamap), and the "via" clause is used to set `_allHP` to a new value.
			This repeats until all of the values have been handled. Then, the final result of `_allHP` is returned.

			Of course, if at any time the expression should cause an error, such as adding a number to a string, then an error will result.

			Both of the temp variables can be named anything you want. As with other lambda macros, they don't exist
			outside of it, won't alter identically-named temp variables outside of it, and can't be manually (set:) within the lambda.

			You can refer to other variables, including other temp variables, in the `via` expression. For instance, you can write
			`(folded: _score making _totalScore via _totalScore + _score * _bonusMultiplier)`. However, for obvious reasons,
			if the outer temp variable is named the same as the lambda's temp variables, it can't be referred to in the expression.

			You can also use a "where" clause inside the "making" lambda to prevent an operation from occurring if a value isn't suitable -
			`(folded: _item making _total via _total + _item where _item > 0, ...$arr)` will only sum up the values in $arr which are greater than 0.

			See also:
			(for:), (altered:), (joined:)

			Added in: 2.0.0
			#data structure
		*/
		("folded", "Any", (section, lambda, ...args) => {
			// Run the optional "where" clause to filter out values, if it's present.
			if ("where" in lambda) {
				args = lambda.filter(section, args);
			}
			return TwineError.containsError(args) || args
				.reduce((making,loop,pos) => lambda.apply(section,{making,loop,pos:pos+1}));
		},
		[either(Lambda.TypeSignature('where','via','making'), Lambda.TypeSignature('via','making')), rest(Any)])
		/*d:
			(datanames: Datamap) -> Array
			
			This takes a datamap, and returns a sorted array of its data names, sorted
			alphabetically.
			
			Example usage:
			`(datanames: (dm:'B','Y', 'A','X'))` produces the array `(a: 'A','B')`
			
			Rationale:
			Sometimes, you may wish to obtain some information about a datamap. You may want
			to list all of its data names, or determine how many entries it has. You can use
			the (datanames:) macro to do these things: if you give it a datamap, it produces
			a sorted array of all of its names. You can then (print:) them, check the length
			of the array, obtain a subarray, and other things you can do to arrays.
			
			See also:
			(datavalues:), (dataentries:)

			Added in: 1.1.0
			#data structure
		*/
		("datanames", "Array", (_, map) =>  Array.from(map.keys()).sort(NaturalSort("en")),
		[Map])
		/*d:
			(datavalues: Datamap) -> Array
			
			This takes a datamap, and returns an array of its values, sorted
			alphabetically by their name.
			
			Example usage:
			`(datavalues: (dm:'B',24, 'A',25))` produces the array `(a: 25,24)`
			
			Rationale:
			Sometimes, you may wish to examine the values stored in a datamap without
			referencing every name - for instance, determining if 0 is one of the values.
			(This can't be determined using the `contains` keyword, because that only checks
			the map's data names.) You can extract all of the datamap's values into an array
			to compare and analyse them using (datavalues:). The values will be sorted by
			their associated names.
			
			See also:
			(datanames:), (dataentries:)

			Added in: 1.1.0
			#data structure
		*/
		("datavalues", "Array", (_, map) =>
			/*
				We first need to sort values by their keys (thus necessitating using .entries())
				then extracting just the values.
			*/
			Array.from(map.entries()).sort(NaturalSort("en", e => String(e[0]))).map(
				e => clone(e[1])
			),
		[Map])
		/*d:
			(dataentries: Datamap) -> Array
			
			This takes a datamap, and returns an array of its name/value pairs. Each pair
			is a datamap that only has "name" and "value" data. The pairs are ordered by their name.
			
			Example usage:
			* `(dataentries: (dm:'B',24, 'A',25))` produces the following array:
			`(a: (dm: "name", "A", "value", 25), (dm: "name", "B", "value", 24))`
			* `(altered: _entry via _entry's name + ":" + _entry's value, ...(dataentries: $m))` creates
			an array of strings from the $m datamap's names and values.
			
			Rationale:
			There are occasions where operating on just the names, or the values, of
			a datamap isn't good enough - you'll want both. Rather than the verbose process
			of taking the (datanames:) and (datavalues:) arrays and using them (interlaced:)
			with each other, you can use this macro instead, which allows the name and value of
			each entry to be referenced using "name" and "value" properties.
			
			See also:
			(datanames:), (datavalues:)
			
			Added in: 2.0.0
			#data structure
		*/
		("dataentries", "Array", (_, map) =>
			/*
				As with (datavalues:), we need to sort values by their keys.
			*/
			Array.from(map.entries()).sort(
				(a,b) => ([a[0],b[0]].sort(NaturalSort("en"))[0] === a[0] ? -1 : 1)
			).map(
				e => new Map([["name", e[0]], ["value", clone(e[1])]])
			),
		[Map])
		
		/*d:
			(history: [Lambda]) -> Array

			This returns an array containing the string names of all of the passages
			the player has visited up to now, in the order that the player visited them. An optional lambda
			can filter the passages, by checking the (passage:) datamap of each. The (mock-visits:) macro
			can, during debugging, artifically add values to this array to simulate having visited various passages.

			Example usage:
			* `(history: where "Intermission" is not in its name)` is an array of visited passage names,
			but not including passages whose name contains "Intermission" anywhere in it.
			* `(history: where its tags contains "Forest")'s length` is the number of times a passage tagged with "Forest" was
			visited during this game.
			* `(unique:(history: where its tags contains "Forest"))'s length` is the same as the above, but excludes duplicate
			visits to the same passages.
			* `(if: (history:)'s 3rdlasttolast is (a:"Cliff", "Leap", "Fly"))` checks if the previous 3 passages visited
			were "Cliff", "Leap" and "Fly".

			Rationale:
			This macro provides easy access to the names of passages visited on past turns. Non-linear stories
			may result in a lot of possible paths for the player to take, and so, it is often desirable
			to look back and see which passages the player visited, and when.
			Often, you may find yourself using "flag" variables to keep track of whether
			the player has visited a certain passage in the past. In some cases, you can use (history:), along with
			data structure operators, such as the `contains` operator, to obviate this necessity.

			Details:
			If you simply wish to check that a particular passage, or set of passages, has been visited
			even once, you may find the (visited:) macro more suited to your needs.

			The array includes duplicate names if the player has visited a passage more than once, or visited
			the same passage two or more turns in a row.

			Passages visited via (redirect:) will be included in this array. Each passage redirected to will appear
			immediately after the passage that the (redirect:) macro was called in.

			This does *not* include the name of the current passage the player is visiting.

			This macro can optionally be given a `where` lambda, which is used to only include passage names in the
			returned array if they match the lambda. Note that even though this produces an array of strings,
			the variable in the lambda  (referred to by the `it` keyword or by a temp variable
			placed before the word `where`) is always a **datamap** -
			the same datamap as would be returned by (passage:) for that passage name. That datamap contains
			these values:

			| Name | Value |
			|---
			| source | The source markup of the passage, exactly as you entered it in the Twine editor |
			| name | The string name of this passage. |
			| tags | An array of strings, which are the tags you gave to this passage. |
			| storylet | If a (storylet:) call is in the passage, this holds the lambda for that call. Otherwise, it's absent. |
			| exclusivity | The storylet exclusivity number. Usually only present if an (exclusivity:) call is in the passage.
			| urgency | The storylet urgency number. Usually only present if an (urgency:) call is in the passage.

			So, you can think of `(history: where its tags contains "Forest")` as a shorthand for
			`(find: where (passage: it)'s tags contains "Forest", ...(history:))`,
			which takes the normal (history:) array, and finds only those names for passages whose tags contain "Forest".

			If you're testing your story in debug mode using (mock-visits:), then each of the "mock" visits you simulate
			using that macro will be added to the front of the returned array (if they match the passed-in lambda).
			`(mock-visits:"A","B")` will cause `(history:)` to produce an array starting with `"A","B"`, followed by
			passages the tester has actually visited on this playthrough. It will also cause `(history: where its name contains "A")`
			to produce an array starting with `"A"`.

			See also:
			(visited:), (passage:), (mock-visits:)

			Added in: 1.0.0
			#game state
		*/
		("history", "Array", (section, lambda) => {
			const history = State.history();
			if (!lambda) {
				return history;
			}
			const passages = lambda.filter(section, history.map(p => Passages.get(p)));
			if (TwineError.containsError(passages)) {
				return passages;
			}
			return passages.map(dm => dm.get('name'));
		},
		[optional(Lambda.TypeSignature('where'))])

		/*d:
			(visited: String or Lambda) -> Boolean

			When given a string, this macro produces true if the passage has ever been visited during this game, and false otherwise.
			When given a "where" lambda, this returns true if any passage matching the lambda has ever been visited during this game.
			The (mock-visits:) macro can, during debugging, make this macro return true in cases where it would otherwise be false.

			Example usage:
			* `(visited:"Cellar")` is true if the player has visited a passage called
			"Cellar" at some point.
			* `(visited: where its tags contains "Forest")` is false if the player visited no passages
			with the "Forest" tag.

			Rationale:
			Often, you may find yourself using "flag" variables simply to keep track of whether
			the player has visited a certain passage in the past. In most such cases, you can use (visited:)
			instead of having to use these variables. 

			Details:
			If a string name is given, and no passages of that name are in the story, an error will be produced.

			Passages visited via (redirect:) will be considered "visited" by this macro, just as they are considered
			"visited" by the `visits` keyword.

			When given a `where` lambda, the variable in the lambda (referred to by the `it` keyword or by a temp variable
			placed before the word `where`) is always a **datamap** - the same datamap as would be returned by (passage:) for that passage name. That datamap contains
			these values:

			| Name | Value |
			|---
			| source | The source markup of the passage, exactly as you entered it in the Twine editor |
			| name | The string name of this passage. |
			| tags | An array of strings, which are the tags you gave to this passage. |
			| storylet | If a (storylet:) call is in the passage, this holds the lambda for that call. Otherwise, it's absent. |
			| exclusivity | The storylet exclusivity number. Usually only present if an (exclusivity:) call is in the passage.
			| urgency | The storylet urgency number. Usually only present if an (urgency:) call is in the passage.

			So, you can think of `(visited: where its tags contains "Forest")` as a shorthand for
			`(some-pass:where (passage: it)'s tags contains "Forest", ...(history: ))`.

			If you're testing your story in debug mode using (mock-visits:), then any "mock" visit you simulate
			will be counted as a visit.

			See also:
			(history:), (passage:), (mock-visits:)

			Added in: 1.0.0
			#game state
		*/
		("visited", "Boolean", (section, condition) => {
			let history = State.history();
			if (typeof condition === "string") {
				if (!Passages.has(condition)) {
					return TwineError.create('macrocall', "There's no passage named '" + condition + "' in this story.");
				}
				return State.passage === condition || history.includes(condition);
			}
			/*
				From here, the condition is a lambda.
			*/
			history = condition.filter(section, history.concat(State.passage).map(p => Passages.get(p)));
			if (TwineError.containsError(history)) {
				return history;
			}
			return history.length > 0;
		},
		[either(String, Lambda.TypeSignature('where'))])
		
		/*d:
			(passage: [String]) -> Datamap
			
			When given a passage string name, this provides a datamap containing information about that passage. If no
			name was provided, then it provides information about the current passage.
			
			Example usage:
			`(passage:"Cellar")`

			Rationale:
			There are times when you wish to examine the data of the story as it is running - for instance, checking what
			tag a certain passage has, and performing some special behaviour as a result. In particular, checking what data the
			current passage has can be very useful in a `header` tagged passage, or in a (display:)ed passage. This macro, as
			well as its counterpart (passages:), provides that functionality.

			Details:
			The datamap contains the following names and values.

			| Name | Value |
			|---
			| source | The source markup of the passage, exactly as you entered it in the Twine editor |
			| name | The string name of this passage. |
			| tags | An array of strings, which are the tags you gave to this passage. |
			| storylet | If a (storylet:) call is in the passage, this holds the lambda for that call. Otherwise, it's absent. |
			| exclusivity | The storylet exclusivity number. Usually only present if an (exclusivity:) call is in the passage.
			| urgency | The storylet urgency number. Usually only present if an (urgency:) call is in the passage.

			However, if the passage contained a (metadata:) macro call, then the data provided to that macro call will be added to that
			passage's datamap. So, you can have any amount of author-defined data in it as well.

			The "source" value, like all strings, can be printed using (print:). Be warned that printing the source of
			the current passage, while inside of it, may lead to an infinite regress.

			Interestingly, the construction `(print: (passage: "Cellar")'s source)` is essentially identical in function (albeit longer to write)
			to `(display: "Cellar")`.

			See also:
			(history:), (passages:), (metadata:)

			Added in: 1.1.0
			#game state
		*/
		("passage", "Datamap", (_, passageName) => clone(Passages.get(passageName || State.passage))
			|| TwineError.create('macrocall', "There's no passage named '" + passageName + "' in this story."),
		[optional(String)])

		/*d:
			(passages: [Lambda]) -> Array

			This returns an array containing datamaps of information for the passages in the story, sorted by
			passage name, and using the optional search test to only include certain types of passages.

			Example usage:
			`(passages: where its name contains "Fight")` produces an array of datamaps for passages in the story that
			contain "Fight" in their name.

			Rationale:
			There are times when you wish to examine the data of the story as it is running - for instance, checking which
			of the story's passages has a certain tag, or a certain word in its source. While you could manually write an array of
			such passages' data yourself and include them as an array, it is usually easier to use this macro (or the (passage:) macro)
			to produce such an array automatically.

			Details:
			The datamaps for each passage resemble those returned by (passage:). They initially contain the following names and values.

			| Name | Value |
			|---
			| name | The string name of the passage. |
			| source | The source markup of the passage, exactly as you entered it in the Twine editor |
			| tags | An array of strings, which are the tags you gave to the passage. |
			| storylet | If a (storylet:) call is in the passage, this holds the lambda for that call. Otherwise, it's absent. |
			| exclusivity | The storylet exclusivity number. Usually only present if an (exclusivity:) call is in the passage.
			| urgency | The storylet urgency number. Usually only present if an (urgency:) call is in the passage.

			However, if the passage contained a (metadata:) macro call, then the data provided to that macro call will be added to that
			passage's datamap. So, you can have any amount of author-defined data in it as well.

			If no passage matches the lambda, then the array will be empty.

			If you wish to take the array of passages and reduce them to just their names, the (altered:) macro can be
			used. For instance, `(altered: via its name, ...(passages:))` produces an array of every passage's name.

			See also:
			(history:), (passage:), (metadata:)

			Added in: 3.1.0
			#game state
		*/
		("passages", "Array", (section, lambda) => {
			const sort = NaturalSort("en"),
				values = [...Passages.values()].map(e => clone(e));
			const result = (lambda ? lambda.filter(section, values) : values);
			const err = TwineError.containsError(result);
			if (err) {
				return err;
			}
			return result.sort((a,b) => sort(a.get('name'), b.get('name')));
		},
		[optional(Lambda.TypeSignature('where'))])

		/*d:
			(open-storylets: [Lambda]) -> Array
			
			Checks all of the (storylet:) macros in every passage, and provides an array of datamaps for every passage whose (storylet:) lambda produced true, sorted by their "urgency"
			metadata value, then by passage name. If a lambda was provided, the storylets are filtered using it as a search test.
			
			Example usage:
			* `(for: each _p, ...(open-storylets:)'s 1stTo5th)[(link-goto: _p's name) - ]` creates passage links for the first five open storylets.
			* `(link-goto: "Off to the next job!", (either: ...(open-storylets: where 'night' is not in its tags))'s name)` creates a single link that goes to a random open storylet.
			* `You have (plural: (open-storylets: where its tags contains 'quest')'s length, "quest") available.` displays "You have 3 quests available." if 3 storylets with the "quest"
			tag are currently open.

			Rationale:
			For a greater explanation of what storylets are (essentially, disconnected sets of passages that can be procedurally visited when author-specified requirements are met),
			see the (storylet:) macro's description. This macro is used to create links or listings of storylets which are currently "open" to the player, in combination with other
			macros such as (for:), (link-goto:) and such.

			Details:

			The exact algorithm determining the contents and order of the resulting array is as follows.
			1. First, every passage's "storylet" lambda is run. If it produced true, that passage is added to the array.
			2. Then, the highest "exclusivity" metadata number among the added passages is found. Each passage with an "exclusivity" lower than that is removed.
			3. The array is then sorted by each passage's "urgency" metadata number. Ties are then sorted by passage name.
			4. If the optional "where" lambda was provided, then the results are filtered with it, as if by (filtered:).

			The (urgency:) macro can thus be used in passages to affect their order in this array, and (exclusivity:) can be used to situationally exclude certain passages from it.

			The passages returned are datamaps identical to those returned by (passage:). They contain the following names and values.

			| Name | Value |
			|---
			| name | The string name of the passage. |
			| source | The source markup of the passage, exactly as you entered it in the Twine editor |
			| tags | An array of strings, which are the tags you gave to the passage. |
			| storylet | The storylet condition lambda for this passage. |
			| exclusivity | The exclusivity number, which is used in the algorithm above. Usually added by (exclusivity:).
			| urgency | The urgency number, which is used in the algorithm above. Usually added by (urgency:).

			If no passages' storylet requirements are currently met, the array will be empty.

			If no passage matches the search lambda given to (open-storylets:), the array will be empty.

			If any passage's (storylet:) macro produces an error (such as by dividing a number by 0), it will be displayed when the (open-storylets:) macro is run.

			See also:
			(storylet:), (link-storylet:), (passages:)

			Added in: 3.2.0
			#storylet 2
		*/
		("open-storylets", "Array", (section, lambda) => {
			/*
				To avoid (open-storylets:) entering into an infinite loop, it can't be used inside metadata lambdas.
			*/
			if (section.stackTop.evaluateOnly) {
				return TwineError.create("macrocall", "(open-storylets:) can't be used in " + section.stackTop.evaluateOnly + ".");
			}
			const result = Passages.getStorylets(section, lambda),
				err = TwineError.containsError(result);
			if (err) {
				return err;
			}
			return result.map(clone);
		},
		[optional(Lambda.TypeSignature('where'))])

		/*d:
			(saved-games:) -> Datamap
			
			This returns a datamap containing the names of currently occupied save game slots.

			Example usage:
			`(print: (saved-games:)'s "File A")` prints the name of the save file in the slot "File A".
			`(if: (saved-games:) contains "File A")` checks if the slot "File A" is occupied.

			Rationale:
			For a more thorough description of the save file system, see the (save-game:) article.
			This macro provides a means to examine the current save files in the user's browser storage, so
			you can decide to print "Load game" links if a slot is occupied, or display a list of
			all of the occupied slots.

			Details:
			Each name in the datamap corresponds to an occupied slot name. The values are the file names of
			the files occupying the slot.

			The following is an **example**. If a game was saved using `(save-game:"File A", "The Mortuary")`, and there were no other
			saved games, the datamap produced by (saved-games:) would look like this.

			| Name | Value |
			|---
			| File A | The string "The Mortuary" |

			Changing the datamap does not affect the save files - after this macro has created the datamap, it is simply inert data.

			See also:
			(save-game:), (load-game:)

			Added in: 1.0.0
			#saving
		*/
		("savedgames", "Datamap", () => {
			/*
				This should be identical to the internal function in macrolib/commands.js.
				TODO: Add this to Engine itself, maybe.
			*/
			function storagePrefix(text) {
				return "(" + text + " " + options.ifid + ") ";
			}
			/*
				This reads all of the localStorage keys with save slot-related names.
			*/
			let
				i = 0, key;
			const
				savesMap = new Map();
			/*
				Iterate over all the localStorage keys using this somewhat clunky do-loop.
			*/
			do {
				// I don't believe any browsers with storage disabled will throw on .key(), but...
				if (!State.hasStorage) {
					break;
				}
				key = localStorage.key(i);
				i += 1;
				const prefix = storagePrefix("Saved Game");
				if (key && key.startsWith(prefix)) {
					// Trim off the prefix
					key = key.slice(prefix.length);
					// Populate the saves map with the save slot name.
					savesMap.set(key, localStorage.getItem(storagePrefix("Saved Game Filename") + key));
				}
			}
			while(key);
			return savesMap;
		},
		[])
		
		/*
			DATAMAP MACROS
		*/
		/*d:
			Datamap data
			
			There are occasions when you may need to work with collections of values that "belong" to a
			specific object or entity in your story - for example, a table of numeric "statistics" for
			a monster - or that associate a certain kind of value with another kind, such as a combination of
			adjectives ("slash", "thump") that change depending on the player's weapon name ("claw", "mallet") etc.
			You can create datamaps to keep these values together, move them around en masse, and organise them.
			
			Datamaps are one of the two major "data structures" you can use in Harlowe. The other, arrays,
			are created with (a:). You'll want to use datamaps if you want to store values that directly correspond to *strings*,
			and whose *order* and *position* do not matter. If you need to preserve the order of the values, then an array
			may be better suited.
			
			Datamaps consist of several string *name*s, each of which maps to a specific *value*. `$animals's frog` and `frog of $animals`
			refers to the value associated with the name 'frog'. You can add new names or change existing values by using (set:) -
			`(set: $animals's wolf to "howl")`. You can express the name as a bare word if it doesn't have a space or other punctuation in it - `$animals's frog` is OK, but
			`$animals's komodo dragon` is not. In that case, you'll need to always supply it as a string - `$animals's "komodo dragon"`.
			This syntax can be chained: if a datamap is inside another data structure (for instance, by
			`(set: $arr to (a:(dm:'name', 'silver ring', 'resaleValue', 250),(dm:'name', 'a button', 'resaleValue', 0)))`)
			then you can write `$arr's 1st's resaleValue` to access the 250 in the first datamap.

			**Note:** While you can normally display the contents of variables by simply placing their names directly in passage prose,
			such as `$sandwich`, you have to use another macro, such as (print:), to display the contents of datamaps, such as `(print: $sandwich's bread)`.
			
			Datamaps may be joined by adding them together: `(dm: "goose", "honk") + (dm: "robot", "whirr")` is the same as
			`(dm: "goose", "honk", "robot", "whirr")`. In the event that the second datamap has the same name as the first one,
			it will override the first one's value - `(dm: "dog", "woof") + (dm: "dog", "bark")` will act as
			`(dm: "dog", "bark")`.
			
			You may notice that you usually need to know the names a datamap contains in order to access its values. There are certain
			macros which provide other ways of examining a datamap's contents: (datanames:) provides a sorted array of its names,
			(datavalues:) provides a sorted array of its values, and (dataentries:) provides an array of names and values.

			To summarise, the following operators work on datamaps.
			
			| Operator | Purpose | Example
			|---
			| `is` | Evaluates to boolean `true` if both sides contain equal names and values, otherwise `false`. | `(dm:"HP",5) is (dm:"HP",5)` (is true)
			| `is not` | Evaluates to `true` if both sides differ in items or ordering. | `(dm:"HP",5) is not (dm:"HP",4)` (is true)<br>`(dm:"HP",5) is not (dm:"MP",5)` (is true)
			| `contains` | Evaluates to `true` if the left side contains the name on the right.<br>(To check that a datamap contains a value, try using `contains` with (datavalues:)) | `(dm:"HP",5) contains "HP"` (is true)<br>`(dm:"HP",5) contains 5` (is false)
			| `does not contain` | Evaluates to `true` if the left side does not contain the name on the right. | `(dm:"HP",5) does not contain "MP"` (is true)
			| `is in` | Evaluates to `true` if the right side contains the name on the left. | `"HP" is in (dm:"HP",5)` (is true)
			| `is not in` | Evaluates to `true` if the right side does not contain the name on the left. | `"XP" is not in (dm:"HP",5)` (is true)
			| `+` | Joins datamaps, using the right side's value whenever both sides contain the same name. | `(dm:"HP",5) + (dm:"MP",5)`
			| `'s` | Obtains the value using the name on the right. `'s` cannot have any spaces to its left. | `(dm:"love",155)'s love` (is 155).
			| `of` | Obtains the value using the name on the left. | `love of (dm:"love",155)` (is 155).
			| `matches` | Evaluates to boolean `true` if the datamap on one side matches the pattern on the other. | `(dm:"Love",2,"Fear",4) matches (dm: "Love", num, "Fear", num)`
			| `does not match` | Evaluates to boolean `true` if the datamap on one side does not match the pattern on the other. | `(dm:"Love",2,"Fear",4) matches (dm: "Joy", num, "Sorrow", num)`
			| `is a`, `is an` | Evaluates to boolean `true` if the right side is a datatype that describes the left side. | `(dm:'a',1) is a datamap`
			| `is not a`, `is not an` | Evaluates to boolean `true` if the right side is a datatype that does not describe the left side. | `(dm:'a',1) is not an empty`
		*/
		/*d:
			(dm: [...Any]) -> Datamap
			Also known as: (datamap:)

			Creates a datamap, which is a data structure that pairs string names with data values.
			You should provide a string name, followed by the value paired with it, and then another
			string name, another value, and so on, for as many as you'd like.

			Example usage:
			`(dm:)` creates an empty datamap.
			`(dm: "Cute", 4, "Wit", 7)` creates a datamap with two names and values.
			The following code also creates a datamap, with the names and values laid out in a readable fashion.
			```
			(dm:
				"Susan", "A petite human in a yellow dress",
				"Tina", "A ten-foot lizardoid in a three-piece suit",
				"Gertie", "A griffin draped in a flowing cape",
			)
			```
			
			Rationale:
			For an explanation of what datamaps are, see the Datamap article.
			This macro is the primary means of creating datamaps - simply supply a name,
			followed by a value, and so on.

			In addition to creating datamaps for long-term use, this is also used to
			create "momentary" datamaps which are used only in some operation. For instance,
			to add several values to a datamap at once, you can do something like this:
			```
			(set: $map to (dm:))
			(set: $map to it + (dm: "Name 1", "Value 1", "Name 2", "Value 2"))
			```

			You can also use (dm:) as a kind of "multiple choice" structure, if you combine it with
			the `'s` or `of` syntax. For instance...
			```
			(set: $monsterName to "Slime")
			(set: $element to $monsterName of (dm:
				"Chilltoad", "Ice",
				"Rimeswan", "Ice",
				"Brisketoid", "Fire",
				"Slime", "Water"
			))
			```
			...will set $element to one of those elements if $monsterName matches the correct name. But, be warned: if
			none of those names matches $monsterName, an error will result.

			See also:
			(a:), (ds:)

			Added in: 1.0.0
			#data structure 2
		*/
		(["datamap","dm"], "Datamap", (_, ...args) => {
			let key;
			const map = new Map();
			/*
				This takes the flat arguments "array" and runs map.set() with every two values.
				During each odd iteration, the element is the key. Then, the element is the value.
			*/
			const status = args.reduce((status, element) => {
				let error;
				/*
					Propagate earlier iterations' errors.
				*/
				if (TwineError.containsError(status)) {
					return status;
				}
				if (key === undefined) {
					key = element;
				}
				/*
					Key type-checking must be done here.
				*/
				else if ((error = TwineError.containsError(isValidDatamapName(map, key)))) {
					return error;
				}
				/*
					This syntax has a special restriction: you can't use the same key twice.
				*/
				else if (map.has(key)) {
					return TwineError.create("macrocall",
						"You used the same data name ("
						+ objectName(key)
						+ ") twice in the same (datamap:) call."
					);
				}
				else {
					map.set(key, clone(element));
					key = undefined;
				}
				return status;
			}, true);
			/*
				Return an error if one was raised during iteration.
			*/
			if (TwineError.containsError(status)) {
				return status;
			}
			/*
				One error can result: if there's an odd number of arguments, that
				means a key has not been given a value.
			*/
			if (key !== undefined) {
				return TwineError.create("macrocall", "This datamap has a data name without a value.");
			}
			return map;
		},
		zeroOrMore(
			/*
				In order for destructuring patterns to be syntactically permitted, (dm:) needs to allow TypedVars
				in addition to "Any", even though TypedVars have TwineScript_Unstorable and can't be (set:) as data.
			*/
			either(TypedVar, Any)
		))
		
		/*
			DATASET MACROS
		*/
		/*d:
			Dataset data

			Arrays are useful for dealing with a sequence of related data values, especially if
			they have a particular order. There are occasions, however, where you don't really
			care about the order, and instead would simply use the array as a storage place for
			values - using `contains` and `is in` to check which values are inside.

			Think of datasets as being like arrays, but with specific restrictions.

			* You can't access any positions within the dataset (so, for instance, the `1st`, `2ndlast`
			and `last` aren't available, although the `length` still is) and can only use `contains`
			and `is in` to see whether a value is inside (or, by using `some` and `all`, many values).

			* Datasets only contain unique values: adding the string "Go" to a dataset already
			containing "Go" will do nothing. Values are considered unique if the `is` operator, when placed
			between them, would produce `false`.

			* Datasets are considered equal (by the `is` operator) if they have the same items, regardless
			of order (as they have no order).

			These restrictions can be helpful in that they can stop programming mistakes from
			occurring - you might accidentally try to modify a position in an array, but type the name of
			a different array that should not be modified as such. Using a dataset for the second
			array, if that is what best suits it, will cause an error to occur instead of allowing
			this unintended operation to continue.

			| Operator | Purpose | Example
			|---
			| `is` | Evaluates to boolean `true` if both sides contain equal items, otherwise `false`. | `(ds:1,2) is (ds 2,1)` (is true)
			| `is not` | Evaluates to `true` if both sides differ in items. | `(ds:5,4) is not (ds:5)` (is true)
			| `contains` | Evaluates to `true` if the left side contains the right side. | `(ds:"Ape") contains "Ape"`<br>`(ds:(ds:99)) contains (ds:99)`<br>`(ds: 1,2,3) contains all of (a:2,3)`<br>`(ds: 1,2,3) contains some of (a:3,4)`
			| `does not contain` | Evaluates to `true` if the left side does not contain the right side. | `(ds:"Ape") does not contain "Egg"`
			| `is in` | Evaluates to `true` if the right side contains the left side. | `"Ape" is in (ds:"Ape")`<br>`(a:3,4) is in (ds:1,2,3)`
			| `is not in` | Evaluates to `true` if the right side does not contain the left side. | `"Hope" is not in (ds:"Famine","Plague","Pollution")`
			| `+` | Joins datasets. | `(ds:1,2,3) + (ds:1,2,4)` (is `(ds:1,2,3,4)`)
			| `-` | Subtracts datasets. | `(ds:1,2,3) - (ds:1,3)` (is `(ds:2)`)
			| `...` | When used in a macro call, it separates each value in the right side.<br>The dataset's values are sorted before they are spread out.| `(a: 0, ...(ds:1,2,3,4), 5)` (is `(a:0,1,2,3,4,5)`)
			| `matches` | Evaluates to boolean `true` if the dataset on one side matches the pattern on the other. | `(ds:2,3) matches (ds: 3, num)`, `(ds: array) matches (ds:(a: ))`
			| `does not match` | Evaluates to boolean `true` if the dataset on one side does not match the pattern on the other. | `(ds:2,3) does not match (a: 3, str)`, `(ds: array) does not match (ds:2)`
			| `is a`, `is an` | Evaluates to boolean `true` if the right side is a datatype that describes the left side. | `(ds:2,3) is a dataset`
			| `is not a`, `is not an` | Evaluates to boolean `true` if the right side is a datatype that does not describe the left side. | `(ds:2,3) is an empty`
		*/
		/*d:
			(ds: [...Any]) -> Dataset
			Also known as: (dataset:)

			Creates a dataset, which is an unordered collection of unique values.
			
			Example usage:
			`(ds:)` creates an empty dataset, which could be filled with other values later.
			`(ds: "gold", "frankincense", "myrrh")` creates a dataset with three strings.
			
			Rationale:
			For an explanation of what datasets are, see the Dataset article. This macro is the primary
			means of creating datasets - simply supply the values to it, in any order you like.
			
			Details:
			You can also use this macro to remove duplicate values from an array (though also eliminating the array's
			order) by using the spread `...` operator like so: `(a: ...(ds: ...$array))`.
			
			See also:
			(dm:), (a:)
			
			Added in: 1.0.0
			#data structure 3
		*/
		(["dataset","ds"], "Dataset", (_, ...args) => new Set(args.filter(unique).map(clone)), zeroOrMore(Any))
		
		/*
			COLLECTION OPERATIONS
		*/
		/*d:
			(count: Array or String, ...Any) -> Number

			Accepts a string or array, followed by a value, and produces the number of times any of the values
			are inside the string or array.

			Example usage:
			`(count: (a:1,2,3,2,1), 1, 2)` produces 4.
			`(count: "Though", "ugh","u","h")` produces 4.

			Rationale:
			This can be thought of as an accompaniment to the `contains` operator. Usually, you just want to check if one or more occurrences
			of the substring or value are in the given container. To check if an array or string contains any or all of the values,
			you can use `contains` with the `all` or `some` data names, like so: `$arr contains all of (a:1,2)`
			and `$arr contains some of (a:1,2)`. But, if you need an *exact* figure for the number of occurrences,
			this macro will be of use.

			A note about newer macros:
			(count:) is a fairly old Harlowe macro. Two other macros, (find:) and (str-find:),
			exist for checking values and substrings using more powerful constructs, like string patterns (produced by (p:) and its relatives)
			or "where" lanbdas. In many cases, you can replicate the functionality of (count:) by using these macros, and checking the `length` of the returned array.
			For instance, `(count: "Abracadabra", "a","b")` is the same as `length of (str-find:(p-either:"a","b"),"Abracadabra")`.
			But, you may notice that the (count:) call is somewhat shorter and more readable. Thus, if you only need
			to perform a simple check of substrings or values, (count:) can be preferable to those other macros.

			Details:
			If you use this with a number, boolean, datamap, dataset (which can't have duplicates),
			or anything else which can't have a value, then an error will result.

			If you use this with a string, and the values aren't also strings, then an error will result.

			Substrings are counted separately from each other - that is, the string "Though" contains "ugh" once and "h"
			once, and `(count: "Though","ugh","h")` results in 3. To check for "h" occurrences that are not contained in "ugh",
			you can try subtracting two (count:)s - `(count: "Though","ugh") - (count: "Though","h")` produces 1.

			See also:
			(find:), (str-find:), (datanames:), (datavalues:)

			Added in: 1.0.0
			#data structure
		*/
		("count", "Number", function count(_, collection, ...values) {
			/*
				As with many other macros, this handles multiple data values by recursively calling itself.
			*/
			if (values.length > 1) {
				let error;
				const recur = values.map(value => count(_, collection, value));
				if ((error = TwineError.containsError(recur))) {
					return error;
				}
				return recur.reduce((a,e) => a + e, 0);
			}
			const [value] = values;
			/*
				With a single value in hand, we now perform the count.
			*/
			switch(collectionType(collection)) {
				case "dataset":
				case "datamap": {
					return TwineError.create("macrocall",
						"(count:) shouldn't be given a datamap or dataset.",
						"You should use the 'contains' operator instead. For instance, write: $variable contains 'value'."
					);
				}
				case "string": {
					if (typeof value !== "string") {
						return TwineError.create("macrocall",
							objectName(collection)
							+ " can't contain  "
							+ objectName(value)
							+ " because it isn't also a string."
						);
					}
					/*
						Since String#split() always produces an array of length 1 or more,
						this will always produce 0 or higher.

						Incidentally, if the value is the empty string, then 0 occurrences
						should be reported.
					*/
					return !value ? 0 : collection.split(value).length-1;
				}
				case "array": {
					return collection.reduce((count, e) => count + is(e,value), 0);
				}
				default: {
					return TwineError.create("macrocall",
						objectName(collection)
						+ " can't contain values, let alone "
						+ objectName(value)
						+ "."
					);
				}
			}
		},
		/*
			This currently has "Any" instead of "either(Array,String)" as its signature's first argument, so
			that the above special error messages can appear for certain wrong argument types.
		*/
		[Any, rest(Any)])
		
		// End of macros
		;
});
