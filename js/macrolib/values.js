"use strict";
define(['macros', 'state', 'utils', 'utils/operationutils', 'datatypes/colour', 'datatypes/gradient', 'datatypes/datatype', 'datatypes/hookset', 'datatypes/codehook', 'internaltypes/twineerror'],
(Macros, State, {realWhitespace, nth, anyRealLetter, plural}, {subset, objectName, clone, toSource}, Colour, Gradient, Datatype, HookSet, CodeHook, TwineError) => {
	/*
		Built-in value macros.
		These macros manipulate the primitive values - boolean, string, number.
	*/
	
	const
		{rest, zeroOrMore, either, optional, insensitiveSet, numberRange, percent, nonNegativeInteger, positiveInteger, Any } = Macros.TypeSignature,
		{max,min,round,floor,ceil} = Math;
	
	Macros.add
		/*d:
			String data
			
			A string is just a run of text - a sequence of text characters strung together. To indicate that a
			sequence of characters is a string, place a matching pair of either `"` or `'` characters around them. If you want
			to include a `"` or `'` inside a string that is enclosed with a pair of that character, you can use the `\` symbol to
			escape that character. `\"` and `\"` will become a `"` and `'`, respectively.
			If you want to include a `\` character by itself, write `\\`.

			When the `\` character precedes the letters `n`, `t`, `b`, `f`, `v`, `r`, they will both be replaced with a certain whitespace character. Except for `\n`, these are
			**not** intended to be used by authors for any reason, are included purely for compatibility with Javascript, and are listed here for reference.

			| Combination | Result | Example
			|---
			| `\n` | A newline (also known as a line break) |
			| `\t` | A tab character (normally only the same size as a single space) |
			| `\b`, `\f`, `\v`, `\r` | A zero-width character that takes up a position in the string but isn't visible in the passage (included for compatibility with Javascript) |
			| `\x` | If the next two characters are hexadecimal digits (0-9, A-F, or a-f), all four of these are replaced with a character whose Unicode code point is the value of the digits. | `"\xFE"` (is `"þ"`)
			| `\u` | If the next four characters are hexadecimal digits (0-9, A-F, or a-f), OR if the next characters are `{`, one to five hexadecimal digits, and `}`, then all of these are replaced with a character whose Unicode code point is the value of the digits. | `"\u00FE"` (is `"þ"`), `"\u{1F494}"` (is `"💔"`)

			Note that you don't have to use `\n` to encode line breaks inside strings. You can simply insert them directly, thus causing the strings to span multiple lines.
			However, you may wish to use `\n` sometimes to save vertical space in your passage code.
			
			When making a story, you'll mostly work with strings that you intend to insert into
			the passage source. If a string contains markup, then the markup will be processed when it's
			inserted. For instance, `"The ''biiiiig'' bellyblob"` will print as "The <b>biiiiig</b> bellyblob".
			Even macro calls inside strings will be processed: printing `"The (print:2*3) bears"` will print "The 6 bears".
			If you wish to avoid this, you can include the verbatim markup inside the string:``"`It's (exactly: as planned)`"`` will
			print "It's (exactly: as planned)". Alternatively, you can use (verbatim-print:) to prevent the markup from being processed.
			
			You can add strings together to join them: `"The" + ' former ' + "Prime Minister's"`
			pushes the strings together, and evaluates to "The former Prime Minister's". Notice
			that spaces had to be added between the words in order to produce a properly spaced final string.
			Also, notice that you can only add strings together. You can't subtract them, much less multiply or divide them.
			
			Strings are similar to arrays, in that their individual characters can be accessed: `"ABC"'s 1st` evaluates to "A",
			`"Gosh"'s 2ndlast` evaluates to "s", and `"Exeunt"'s last` evaluates to "t". They, too, have a "length":
			`"Marathon"'s length` is 8. If you can't determine the exact position of a character, you can use an expression,
			in brackets, after it: `$string's ($pos - 3)`. You can create a substring by providing an array of positions
			in place of a single position: `"Dogs"'s (a: 2,4)` is "os". And, you can create a substring of consecutive positions by
			specifying just the start and end position as a data name: `"Ducks"'s 1stto3rd` is "Duc", and `"Rags"'s 2ndlasttolast` is "gs".

			If you want to check if a string contains any of another string's characters (without needing to be in the
			same order), or all of them, special `some` (also known as `any` - no relation to the `any` datatype) and `all` data names are available for use with the `is`, `is not`, `matches` and `is a`
			operators - `all of $name is "A"` checks if the variable consists only of capital "A"'s, and `some of $name is a whitespace` checks
			if any of the variable's characters is a whitespace character (using the special "whitespace" datatype).

			You can use the `contains` and `is in` operators to see if a certain string is contained within another: `"mother"
			contains "moth"` is true, as is `"a" is in "a"`. Again, `some` and `all` can be used with `contains` and `is in` to check all their
			characters - `all of $string is not "w"` is true if the string doesn't contain "w", and `$string contains some of "aeiou"` is true
			if the string contains those five letters. The opposite of the `is in` operator is `is not in` - `"w" is not in $string` is another way to phrase the above.

			If you want to check if a string specifically starts or ends with with a certain substring, `start` and `end` data names can be used in a
			similar way to `some` and `all` - `start of $addr is "http://"` is the same as `$addr's 1stto7th is "http://"` (but somewhat easier to write), and
			`end of $angelName is "iel"` is the same as `$angelName's 3rdlasttolast is "iel"`.

			Here is a table listing the aforementioned operations you can perform on strings, as well as a few others.

			| Operator | Function | Example
			|---
			| `+` | Joining. | `"A" + "Z"` (is "AZ")
			| `-` | Produces a copy of the left string with all occurrences of the right string removed. | `"abcdcba" - "bcd"` (is "acba")
			| `is` | Evaluates to boolean `true` if both sides are equal, otherwise `false`. | `$name is "Frederika"`<br>`some of "Buxom" is "x"`
			| `is not` | Evaluates to boolean `true` if both sides are not equal, otherwise `false`. | `$friends is not $enemies`<br>`all of "Gadsby" is not "e"`
			| `contains` | Evaluates to boolean `true` if the left side contains the right side, otherwise `false`. | `"Fear" contains "ear"`
			| `does not contain` | Evaluates to boolean `true` if the left side does not contain the right side, otherwise `false`. | `"Fear" does not contain "Bee"`
			| `is in` | Checking if the right string contains the left string, otherwise `false`. | `"ugh" is in "Through"`
			| `is not in` | Evaluates to `true` if the right string does not contain the left string. | `"Blood" is not in "Stone`
			| `'s` | Obtains the character or substring at the right numeric position. `'s` cannot have any spaces to its left. | `"YO"'s 1st` (is "Y")<br>`"PS"'s (2)` (is "S")<br>`"ear"'s (a: 2,3)` (is "ar")
			| `of` | Obtains the character at the left numeric position. | `1st of "YO"` (is "Y")<br>`(2) of "PS"` (is "S")<br>`(a: 2,3) of "ear"` (is "ar")
			| `matches` | Evaluates to boolean `true` if the left side describes the right side. | `str matches "Contract"`, `some of "RED" matches "E"`
			| `does not match` | Evaluates to boolean `true` if the left side does not describe the right side. | `str does not match "Minotaur"`, `"3" does not match "Three"`
			| `is a`, `is an` | Evaluates to boolean `true` if the right side is a datatype describing the left side. | `"Boo" is a string`, `"   " is a whitespace`, `"" is an empty`
			| `is not a`, `is not an` | Evaluates to boolean `true` if the right side does not describe the left side. | `"Boo" is not an empty`, `"" is not a whitespace`
			
			And, here are the data names that can be used with strings.

			| Data name | Example | Meaning
			|---
			| `1st`,`2nd`,`last`, etc. | `$str's last`, `1st of $str` | A single character at the given position in the string. This causes an error if it passes the bounds of the string, such as `"elder"'s 8th`.
			| `1stto3rd`, `4thlastto2ndlast` etc. | `"aeiou"'s 2ndto5th` | A substring containing only the characters between the given positions (such as the first, second and third for `1stto3rd`). This does NOT cause an error if it passes the bounds of the string - so `"Power"'s 3rdto9th` is `"wer"`.
			| `length` | `"Penny"'s length` | The length (number of characters) in the string.
			| `some`, `any`, `all` | `all of "aeiou" is not "y"`, `some of "aaaba" is not "a"` | Usable only with comparison operators, these allow all of the characters to be quickly compared. `any` is an old alias for `some` that functions identically, but which may be removed in a future version of Harlowe.
			| `start`, `end` | `start of $addr is "http://"`, `end of $angelName is "iel"` | Usable only with the `is`, `is not`, `matches` and `does not match` operators, these allow you to compare the start or end of strings without having to specify an exact range of characters to compare.
			| `random` | A random character in the string. | `"aeiou"'s random` (is `"a"`, `"e"`, `"i"`, `"o"` or `"u"`).
			| Arrays of numbers, such as `(a:3,5)` | `$str's (a:1,-1)` | A substring containing just the characters at the given positions in the string.

			A note about `random`: this is one of the features that uses Harlowe's pseudo-random number generator. If you use (seed:) at the start of the story,
			the selected values will be predetermined based on the seed string, and how many other random macros and features have been used before it.
		*/
		/*d:
			(str: ...[Number or String or Boolean or Array]) -> String
			Also known as: (string:), (text:)
			
			(str:) accepts any amount of values and tries to convert them all to a single String.
			
			Example usage:
			* `(print: "YOU NEED: $" + (str: $cash + 200))` converts the number `$cash + 200` into a string, so `"YOU NEED: $"` can be added to it.
			
			Rationale:
			Unlike in Twine 1 and SugarCube, Twine 2 will only convert numbers into strings, or strings
			into numbers, if you explictly ask it to. This extra carefulness decreases
			the likelihood of unusual bugs creeping into stories (such as adding 1 and "22"
			and getting "122"). The (str:) macro offers a quick way to convert
			non-string values to a string (and its counterpart, (num:), offers the reverse).
			
			Details:			
			If you give an array to (str:), it will attempt to convert every element
			contained in the array to a string, and then join them up with commas. So,
			`(str: (a: 2, "Hot", 4, "U"))` will result in the string "2,Hot,4,U".
			If you'd rather this not occur, you can also pass the array's individual
			elements using the `...` operator - this will join them with nothing in between,
			as if they were given individually. So, `(str: ...(a: 2, "Hot", 4, "U"))` will result in the string "2Hot4U".

			If you want to convert numbers into strings in a more sophisticated way, such as by
			including thousands separators or leading zeros, consider using (digit-format:).
			
			See also:
			(num:), (print:)

			Added in: 1.0.0
			#string 1
		*/
		(["str", "string", "text"], "String",
			(_, ...args) => args.map(e => CodeHook.isPrototypeOf(e) ? e.source : e).join(''),
		[zeroOrMore(Macros.TypeSignature.either(String, Number, Boolean, Array, CodeHook))])

		/*d:
			(source: Any) -> String

			When given almost any data value, this will produce a string of Harlowe source code that can, when run, create
			that value exactly.

			Example usage:
			* `(source: $voltage)` will, if $voltage contains the number 9, produce the string `"9"`.
			* `(source: (str-repeated: 6, "HA"))` produces the string `'"HAHAHAHAHAHA"'` (which, you'll notice, is a string in a string).
			* `(source: (click: ?hat))` produces the string `"(click:?hat)"`.
			* `(source: (enchant: ?passage's hooks, $style))` will, if $style contained `(text-size:1.4)`, produce the
			string `"(enchant:?passage's hooks,(text-size:1.4))"`.

			Rationale:
			Throughout development, you'll often find yourself toying and tinkering with the exact values of data your story uses,
			such as to test a particular state of events, or to extract a particular procedurally-generated value. This macro, along
			with Harlowe's normal code parsing actions, provides a basic two-way conversion between code and data that you can use as you please.

			Details:
			For most complex values, like changers and commands, this will produce a macro call. The whitespace between the values will
			generally be absent, so `(source: (a:2,    3,   4))` produces `"(a:2,3,4)"`. Also, if you call a macro using one if its aliases,
			such as (array:) for (a:), then the source will still use its "default" name. So, `(source: (array:1))` produces `"(a:1)"`.

			Commands created by custom macros (via the (output:) macro) cannot be given to this macro - attempting to do so will produce an error.

			Note that you can't easily print the string returned by (source:), because, funnily enough, Harlowe will immediately
			re-render it. You can use (verbatim-source:) to accomplish this instead.

			See also:
			(datatype:), (verbatim-source:)

			Added in: 3.2.0
			#string
		*/
		("source", "String", (_, val) => {
			/*
				Note that since custom macro commands cannot be serialised, they can't have a TwineScript_ToSource() method that would return this error
				by itself. Also note that every built-in command has a TwineScript_ToSource() installed by Macros.
			*/
			if (val && val.TwineScript_TypeID === "command" && !val.TwineScript_ToSource) {
				return TwineError.create("datatype", "I can't construct the source code of a command created by a custom macro.");
			}
			return toSource(val);
		}, [Any])

		/*d:
			(substring: String, Number, Number) -> String
			
			This macro produces a substring of the given string, cut from two inclusive number positions.
			
			Example usage:
			`(substring: "growl", 3, 5)` is the same as `"growl"'s 3rdto5th` or `"growl"'s (a:3,4,5)`

			Rationale:
			You can obtain substrings of strings without this macro, by using the `'s` or `of` syntax along
			with either a specified range of consecutive positions, or an array of arbitrary position numbers.
			For instance, `$str's 4thto12th` obtains a substring of $str containing
			its 4th through 12th characters, `$a's (a:1,3,5)` obtains a substring of just the 1st, 3rd and 5th characters of $a,
			and `$a's (range:1, $b)` obtains a substring of each position up to $b.

			However, in the specific situation where you want to use a variable negative position, counting from the end of the string,
			there isn't a succinct option using that syntax. When gathering the characters in string $a
			between position 1 and $b, where $b is a negative position counting from the end, `(range:1, $b)` doesn't work, and
			the best you can do without this macro is something like `$a's (range: 1, $b + $a's length)`. So, this
			macro can be used as a slightly shorter alternative, by writing `(subarray: $a, 1, -$b)`.
			
			Details:
			As mentioned above, if you provide negative numbers, they will be treated as being offset from the end
			of the string - `-2` will specify the `2ndlast` character, just as 2 will specify
			the `2nd` character.
			
			If the last number given is smaller than the first (for instance, in `(substring: "hewed", 4, 2)`)
			then the macro will still work - in that case returning "ewe" as if the numbers were in
			the correct order.
			
			See also:
			(subarray:)

			Added in: 1.0.0
			#string
		*/
		("substring", "String", (_, string, a, b) => subset(string, a, b),
		[String, parseInt, parseInt])

		/*d:
			(lowercase: String) -> String
			
			This macro produces a lowercase version of the given string.
			
			Example usage:
			`(lowercase: "GrImAcE")` is the same as `"grimace"`
			
			Details:
			The results of this macro for non-ASCII characters currently depends on the player's browser's Unicode
			support. For instance, 'İ' in lowercase should be 'i̇', but some browsers don't support this.
			
			See also:
			(uppercase:), (lowerfirst:), (upperfirst:)

			Added in: 2.0.0
			#string
		*/
		("lowercase", "String", (_, string) => string.toLowerCase(),
		[String])
		
		/*d:
			(uppercase: String) -> String
			
			This macro produces an uppercase version of the given string.
			
			Example usage:
			`(uppercase: "GrImAcE")` is the same as `"GRIMACE"`
			
			Details:
			The results of this macro for non-ASCII characters currently depends on the player's browser's Unicode
			support. For instance, 'ß' in uppercase should be 'SS', but some browsers don't support this.
			
			See also:
			(lowercase:), (upperfirst:), (lowerfirst:)

			Added in: 2.0.0
			#string
		*/
		("uppercase", "String", (_, string) => string.toUpperCase(),
		[String])
		
		/*d:
			(lowerfirst: String) -> String
			
			This macro produces a version of the given string, where the first alphanumeric character is lowercase, and
			other characters are left as-is.
			
			Example usage:
			`(lowerfirst: "  College B")` is the same as `"  college B"`
			
			Details:
			If the first alphanumeric character cannot change case (for instance, if it's a number) then nothing
			will change in the string. So, "8DX" won't become "8dX".

			The results of this macro for non-ASCII characters currently depends on the player's browser's Unicode
			support. For instance, 'İ' in lowercase should be 'i̇', but some browsers don't support this.
			
			See also:
			(uppercase:), (lowercase:), (upperfirst:)

			Added in: 2.0.0
			#string
		*/
		("lowerfirst", "String", (_, string) =>
			// This has to be an entire word, to handle surrogate pairs and single characters alike.
			string.replace(RegExp(anyRealLetter + "+"), word => {
				// Split the word into code points first.
				word = Array.from(word);
				return word[0].toLowerCase() + (word.slice(1).join('')).toLowerCase();
			}
		),
		[String])
		
		/*d:
			(upperfirst: String) -> String
			
			This macro produces a version of the given string, where the first alphanumeric character is uppercase, and
			other characters are left as-is.
			
			Example usage:
			`(upperfirst: "  college B")` is the same as `"  College B"`
			
			Details:
			If the first alphanumeric character cannot change case (for instance, if it's a number) then nothing
			will change in the string. So, "4ever" won't become "4Ever".

			The results of this macro for non-ASCII characters currently depends on the player's browser's Unicode
			support. For instance, 'ß' in uppercase should be 'SS', but some browsers don't support this.
			
			See also:
			(uppercase:), (lowercase:), (lowerfirst:)

			Added in: 2.0.0
			#string
		*/
		("upperfirst", "String", (_, string) =>
			// This has to be an entire word, to handle surrogate pairs and single characters alike.
			string.replace(RegExp(anyRealLetter + "+"), word => {
				// Split the word into code points first.
				word = Array.from(word);
				return word[0].toUpperCase() + (word.slice(1).join('')).toLowerCase();
			}
		),
		[String])

		/*d:
			(words: String) -> Array
			
			This macro takes a string and creates an array of each word ("word" meaning a sequence of non-whitespace
			characters) in the string.
			
			Example usage:
			`(words: "god-king Torment's peril")` is the same as `(a: "god-king", "Torment's", "peril")`
			
			Rationale:
			It can be useful to explicitly distinguish individual words within a string, in a manner not possible
			with just the `contains` operator - for instance, seeing if a string contains the bare word "to" - not "torn"
			or any other larger word. This macro allows a string's words to be split up and examined individually -
			you can safely check if `(words: $a) contains "to"`, or check on a particular word in the sequence by
			asking if, say, `(words: $a)'s 2nd is 'goose'`.

			Details:
			If the string was empty or contained only whitespace, then this will create an empty array. Moreover,
			if the string contained no whitespace, then the array will contain just the entire original string.

			If you wish to split up a string into an array based on a more specific separator than just whitespace
			(for instance, by just newlines) then you may use the (split:) macro.
			
			See also:
			(split:), (startcase:), (trimmed:)

			Added in: 2.0.0
			#string
		*/
		("words", "Array", (_, string) => string.split(RegExp(realWhitespace + "+")).filter(Boolean),
		[String])
		/*d:
			(str-repeated: Number, String) -> String
			Also known as: (string-repeated:)
			
			A special shorthand combination of the (str:) and (repeated:) macros, this accepts a single string
			and duplicates it the given number of times.
			
			Example usage:
			* `(str-repeated: 5, "Fool! ")` produces `"Fool! Fool! Fool! Fool! Fool! "`
			
			Rationale:
			This macro is a shorthand form of nesting (repeated:) inside (str:). This example:
			`(str: ...(repeated: 14, "-+*+"))` is the same as `(str-repeated: 14, "-+*+")`.
			
			Details:
			An error will, of course, be produced if the number given is negative, or contains a fraction.
			As of 3.2.0, however, it will no longer error if the number is 0.
			
			See also:
			(repeated:)

			Added in: 3.0.0
			#string
		*/
		(["str-repeated", "string-repeated"], "String", (_, number, string) => {
			if (string.length === 0) {
				return TwineError.create("macrocall", "I can't repeat an empty string.");
			}
			return string.repeat(number);
		},
		[nonNegativeInteger, String])
		/*d:
			(str-reversed: String) -> String
			Also known as: (string-reversed:)
			
			A special shorthand combination of the (str:) and (reversed:) macros, this accepts a single string
			and reverses it.
			
			Example usage:
			* `(str-reversed: "sknahT")` produces `"Thanks"`
			
			Rationale:
			This macro is a shorthand form of nesting (reversed:) inside (str:). This example:
			`(str: ...(reversed: "ABRAXAS"))` is the same as `(str-reversed: "ABRAXAS")`.
			
			Details:
			This accepts strings of 0 or 1 character, as well as symmetrical strings, even though their
			"reversal" is the same as their current form.

			If you wish to reverse just the words in a string, you can use the ordinary (reversed:) and (words:) macros
			like so: `(reversed: ...(words: "Gilly Golly Milly Molly"))`.
			
			See also:
			(reversed:)

			Added in: 3.0.0
			#string
		*/
		(["str-reversed", "string-reversed"], "String", (_, string) => [...string].reverse().join(''), [String])
		/*d:
			(joined: ...String) -> String
			
			Using the first string as a separator value, this macro takes all of the other strings given to it, and joins them into a single string.

			Example usage:
			* `(joined:" ", "Philias", "Silus", "Sebastus", "Brotch")` produces the string "Philias Silus Sebastus Brotch".
			* `(joined:" or ", ...(dm-values: (dm: "Breakfast", "Toast", "Dinner", "Pasta", "Lunch", "Soup")))` produces the string `"Toast or Pasta or Soup"`.

			Rationale:
			If you have a list of strings stored in an array, which may be the names of related concepts, such as inventory objects or suspect names,
			you'll often want to display all of them, or a certain number of them, to the player. This will involve adding some kind of separator between them,
			such as a single space, a line break and bullet point, or something more complicated.

			Details:
			The separator value will only be used to separate each string value, and won't be appended or prepended to the end of the string.

			If only one string is provided (that is, just the separator value) then the empty string will be returned.

			Added in: 3.2.0
			#string
		*/
		("joined", "String", (_, joiner, ...strings) => strings.join(joiner), [rest(String)])
		/*d:
			(plural: Number, String, [String]) -> String
			
			This macro takes a whole number and a string, then converts the number to a string, joins them up with a space character, and pluralises the string if the
			number wasn't 1 or -1. By default, this pluralisation is done by adding "s", as in some English plurals. An optional extra string
			can specify a different plural word to use instead.
			
			Example usage:
			* `(plural: 1, "bandage")` produces `"1 bandage"`.
			* `(plural: -7, "bandage")` produces `"-7 bandages"`.
			* `(plural: 2, "elf", "elves")` produces `"2 elves"`.
			
			Rationale:
			If you have variables in your story holding number data, you'll often want to display that data to the player textually. If that
			number refers to a quantity of some object or substance, and your game is in English, you'll want to pluralise the noun form of that
			object or substance, which requires checking if the number is or is not 1 or -1. This macro is a shortcut for that small bit of busywork,
			letting you simply supply the number and the noun to produce the plural.

			Details:
			If the number isn't a whole number (such as 2.3), then an error will result. Furthermore, if any of the given strings are empty, an error
			will result.
			
			See also:
			(joined:)

			Added in: 3.2.0
			#string
		*/
		("plural", "String", (_, num, noun, pluralWord) => {
			if (!noun || pluralWord === "") {
				return TwineError.create("macrocall", "The (plural:) macro can't be given empty strings.");
			}
			return plural(num, noun, pluralWord);
		},
		[parseInt, String, optional(String)])
		/*d:
			(str-nth: Number) -> String
			Also known as: (string-nth:)
			
			This macro takes a whole number, and converts it to a string comprising an English ordinal abbreviation (of the form "nth", such as "1st", "22nd", etc.).
			
			Example usage:
			* `(str-nth: 3)` produces `"3rd"`.
			* `(str-nth: 0)` produces `"0th"`.
			* `(str-nth: -7)` produces `"-7th"`.
			
			Rationale:
			English ordinals are useful to express that a number refers to a position or ordering of some object or item, but constructing an
			ordinal word from a number can be tricky, given that English ordinals have special cases for numbers ending in 1 or 2. This macro, then,
			serves to smooth over those cases, and provide a succinct means to construct these words.

			Details:
			Do not confuse this with the (nth:) macro, which is primarily used to display values in a sequence in passage prose.

			If the number isn't a whole number (such as 2.3), then an error will result.

			Note that you do NOT need to use this to access array data positions, even though their positions are written in the form
			`1st`, `2ndlast` and so forth. You can simply use numbers in brackets (such as `$inventoryArray's (2)`) to access a particular data value.
			
			See also:
			(str:), (digit-format:)

			Added in: 3.2.0
			#string
		*/
		(["str-nth","string-nth"], "String", (_, num) => nth(num), [parseInt])
		/*d:
			(digit-format: String, Number) -> String
			
			When given a special formatting string, followed by a number, this macro converts the number into a string using
			the formatter as a guide. "#" characters in the formatting string represent optional digits; "0" characters
			represent required digits. Other characters are considered either thousands separators or as the decimal point.

			Examples:
			* `(digitformat: "###.###", -1234.5678)` produces the string `"-234.567"`.
			* `(digitformat: "###.###", -1/2)` produces the string `"-.5"`.
			* `(print: "$" + (digitformat: "##0.00", 0.96)` prints `$0.96`.
			* `(digitformat: "###,###", 155500)` produces the string `"155,500"`. Unlike every other character, commas are assumed to be thousands
			separators unless a different separator character is used before them.
			* `(digitformat: "### ###.", 500000)` produces the string `"500 000"`.
			* `(altered: via (digitformat: "000", it), ...(range:1,5))` produces `(a:"001","002","003","004","005")`.
			* `(digitformat: "###.###,", 1255.5)` produces the string `"1.255,"`. Note that the German decimal point `,` at the end
			of the string cannot appear in the final string, but serves only to distinguish the `.` as being the thousands separator.
			* `(digitformat: ".##,###", 1255.5)` produces the string `"55,3"`. Note that the German thousands separator at the front
			of the string cannot appear in the final string (because no `0` or `#` characters are before it),
			but serves only to distinguish the `,` as being the decimal point.
			* `(digitformat: "##,##,###", 2576881)` produces the string `"25,76,881"`. This uses Indian numeral separators.

			Rationale:
			The (str:) macro is a general-purpose conversion macro for creating strings out of other Harlowe datatypes. However,
			numbers have a number of different writing conventions depending on their context - in English, thousands separators
			are common for larger numbers, and some contexts, like prices, need trailing or leading zeros. Other languages
			have different separators than thousands separators, or use different decimal point characters. This macro lets you provide
			a specific format in which a number is to be converted to a string, allowing the separators, zeros
			and decimal point to be customised.

			Details:
			The decimal point in the format string is decided as follows: the rightmost character that isn't `#` or `0` is the decimal
			point, *unless* it is `,` and the leftmost character that isn't `#` or `0` is also `,`. This is under the assumption that
			most Harlowe users will be writing in English (the same assumption used for (str-nth:)) and thus formats like "###,###,###"
			intend to use `,` in its English sense as a thousands separator.

			If the decimal point has no digits (`#` or `0` characters) to its right, or the leftmost separator has no digits to its left,
			then they are left off altogether. This can be used to precisely specify the decimal point and separator characters without
			requiring them to appear in the final string: `"##.###,"` uses a trailing `,` to indicate that `,` is the decimal point, and
			`.` is the thousands separator.

			As a result of these two rules, it is *not* recommended that you include more formatting or context characters than what is required.
			For instance, a format string like `"$00.00"` will *not* cause the final string to have "$", because the `$` will be interpreted as
			a thousands separator, and thus removed.

			If a number bigger than 99999999999999999999 is given, this macro will produce an error.

			Errors in decimal representation caused by the underlying browser Javascript platform's floating-point number format,
			such as `(digitformat: "##.##", 35.3)` producing "35.29", are currently not compensated for by Harlowe.

			See also:
			(str-nth:)

			Added in: 3.3.0
			#string
		*/
		("digit-format", "String", (_, format, num) => {
			if (Math.abs(num) >= 1e+21) {
				return TwineError.create("macrocall", "The number given to (digit-format:) is too big.");
			}
			/*
				To figure out what exactly is the decimal point in the format string, these RegExps are called for.
				These RegExps need 'g' so that .exec() will update their lastIndex, which is used below.
			*/
			const rightSepRE = /([^#0])(?=[#0]*$)/g;
			const leftSepRE = /^[#0]*([^#0])/g;
			const rightSeparator = (rightSepRE.exec(format) || [])[1];
			const leftSeparator = (leftSepRE.exec(format) || [])[1];
			/*
				As usual, convert the format string to support astral plane characters.
				Since the format string should be short, there's no need to worry about perf.
			*/
			format = [...format];
			let formatDecimalPointIndex = format.length;
			/*
				The rule is: the rightmost digit separator character is the decimal point, UNLESS
				it is ',' and the leftmost digit separator is also ','.
			*/
			if (rightSeparator && (rightSeparator !== "," || (leftSeparator && leftSeparator !== ","))) {
				formatDecimalPointIndex = rightSepRE.lastIndex - 1;
			}
			/*
				Use .toFixed() as the string conversion method, to avoid having to deal with '1e1' number notation.
				The 16 is designed to circumvent toFixed()'s built-in rounding by getting as many decimal places
				as needed.

				Also note that the - is stripped off (to be reinserted later).
			*/
			let numStr = Math.abs(num).toFixed(16)
				// Trim off leading and trailing zeros
				.replace(/(\.\d*?)0+$/,(_, p1) => p1)
				.replace(/^0+/,'');
			let numberDecimalPointIndex = numStr.includes('.') ? numStr.indexOf('.') : numStr.length;
			/*
				Because aligning the format string with the number string is difficult due to separators,
				the following is performed: the format string is iterated in reverse, and when a separator
				is encountered, an offset is added to the number string offset to skip over it. Because
				there are no separators after the decimal place, we can be certain that aligning the decimal
				points of the format and number strings will produce the correct decimal place for the number string.
			*/
			let skip = 0;
			let ret = '';
			for (let i = format.length - 1; i >= 0; i-=1) {
				const char = format[i];
				if (char === "0" || char === "#") {
					const numeral = numStr[numberDecimalPointIndex - formatDecimalPointIndex + i + skip];
					ret = (numeral ? numeral : (char === "0" ? "0" : '')) + ret;
				}
				/*
					If the decimal place is the final char or the first char in the format, skip it.
				*/
				else if (i < format.length-1 && i > 0) {
					ret = char + ret;
					/*
						Since both the number string and the format string have a decimal point
						character, don't skip over it.
					*/
					skip += (i === formatDecimalPointIndex ? 0 : 1);
				}
			}
			return (num < 0 ? '-' : '') + ret;
		}, [String, Number])

		/*d:
			Number data
			
			Number data is just numbers, which you can perform basic mathematical calculations with.
			You'll generally use numbers to keep track of statistics for characters, count how many times
			an event has occurred, and numerous other uses.
			
			You can do all the basic mathematical operations you'd expect to numbers:
			`(1 + 2) / 0.25 + (3 + 2) * 0.2` evaluates to the number 13. The computer follows the normal order of
			operations in mathematics: first multiplying and dividing, then adding and subtracting. You can group
			subexpressions together and force them to be evaluated first with parentheses.
			
			If you're not familiar with some of those symbols, here's a review, along with various other operations you can perform.
			
			| Operator | Function | Example
			|---
			| `+` | Addition. | `5 + 5` (is 10)
			| `-` | Subtraction.  Can also be used to negate a number. | `5 - -5` (is 10)
			| `*` | Multiplication. | `5 * 5` (is 25)
			| `/` | Division. | `5 / 5` (is 1)
			| `%` | Modulo (remainder of a division). | `5 % 26` (is 1)
			| `>` | Evaluates to boolean `true` if the left side is greater than the right side, otherwise `false`. | `$money > 3.75`
			| `>=` | Evaluates to boolean `true` if the left side is greater than or equal to the right side, otherwise `false`. | `$apples >= $carrots + 5`
			| `<` | Evaluates to boolean `true` if the left side is less than the right side, otherwise `false`. | `$shoes < $people * 2`
			| `<=`~ | Evaluates to boolean `true` if the left side is less than or equal to the right side, otherwise `false`. | `65 <= $age`
			| `is` | Evaluates to boolean `true` if both sides are equal, otherwise `false`. | `$agendaPoints is 2`
			| `is not` | Evaluates to boolean `true` if both sides are not equal, otherwise `false`. | `$agendaPoints is not 0`
			| `matches` | Evaluates to boolean `true` if one side describes the other. | `$bytes matches 165`, `odd matches 3`
			| `does not match` | Evaluates to boolean `true` if one side does not describe the other. | `$coins does not match odd`
			| `is a`, `is an` | Evaluates to boolean  `true` if the right side is a datatype describing the left side | `$credits is a num`, `2 is an even`
			| `is not a`, `is not an` | Evaluates to boolean `true` if the right side does not describe the left side. | `0 is not an odd`, `13 is not an even`

			`+` can also be used by itself to check if a variable is a number: `+$result` produces an error if $result is not a number.

			You can only perform these operations (apart from `is`) on two pieces of data if they're both numbers. Adding the
			string "5" to the number 2 would produce an error, and not the number 7 nor the string "52". You must
			convert one side or the other using the (num:) or (str:) macros.

			Finally, certain macros that accept numbers, such as `(live:)`, use those numbers as time durations. There is a special form of
			number data you can use for this – put "s" or "ms" at the end of the number to specify if the number indicates milliseconds or
			seconds. For instance, `50ms` means 50 milliseconds, and `5s` means 5 seconds (which is 5000 milliseconds). A number suffixed with `s` is
			the same as a number suffixed with `ms` and multiplied by 1000.
		*/
		/*d:
			(num: String) -> Number
			Also known as: (number:)
			
			This macro converts strings to numbers by reading the digits in the entire
			string. It can handle decimal fractions and negative numbers.
			If any letters or other unusual characters appear in the number, it will
			result in an error.
			
			Example usage:
			`(num: "25")` results in the number `25`.
			
			Rationale:
			Unlike in Twine 1 and SugarCube, Twine 2 will only convert numbers into strings, or strings
			into numbers, if you explictly ask it to using macros such as this. This extra
			carefulness decreases the likelihood of unusual bugs creeping into stories
			(such as performing `"Eggs: " + 2 + 1` and getting `"Eggs: 21"`).
			
			Usually, you will only work with numbers and strings of your own creation, but
			if you're receiving user input and need to perform arithmetic on it,
			this macro will be necessary.
			
			See also:
			(str:)

			Added in: 1.0.0
			#number
		*/
		(["num", "number"], "Number", (_, expr) => {
			/*
				This simply uses JS's toNumber conversion, meaning that
				decimals and leading spaces are handled, but leading letters etc. are not.
			*/
			if (Number.isNaN(+expr)) {
				return TwineError.create("macrocall", "I couldn't convert " + objectName(expr)
					+ " to a number.");
			}
			return +expr;
		},
		[String])

		/*d:
			(datatype: Any) -> Datatype

			This macro takes any storeable value, and produces a datatype that matches it.

			Example usage:
			* `(if: _theirName is a (datatype:_myName))` checks whether or not $theirName is the same type as
			$myName.
			* `(altered: (datatype:_input)-type _n via _n + _input, ..._values)` creates a lambda that only accepts data with the same type
			as that of the _input variable, and runs (altered:) with it.

			Rationale:
			This isn't a macro you're likely to commonly use, because most of the time, you have exact knowledge of the
			types of data you use throughout your story. But, this can be helpful in custom macros created with (macro:), if they
			have any `any-type` parameters. Being able to identify the exact type that such a value is allows you to give types to other
			data based on that type.

			Details:
			The only types that this will return are "general" types, like `string`, `number`, `boolean` and such. More specific types
			like `even`, or descriptive types like `empty`, will not be returned, even if it's given a value that matches those types. Nor will
			spread datatypes be returned - even if a given string consists only of, say, digits, then `...digits` won't be returned instead of `str`.

			if there isn't a known datatype value for the given data (for instance, if you give it a HookName) then an error will be produced.

			See also:
			(source:), (datapattern:)

			Added in: 3.2.0
			#custom macros 5
		*/
		("datatype", "Datatype", (_, value) => Datatype.from(value), [Any])

		/*d:
			(datapattern: Any) -> Any

			This takes any storeable value, and produces a datatype that matches it, in a manner similar to (datatype:). However, when given an array or datamap,
			it creates an array or datamap with its values replaced with their datatypes, which can be used as a more accurate pattern with `matches` or (set:) elsewhere.

			Example usage:
			* `(datapattern: (a:15,45))` produces `(a:num,num)`.
			* `(datapattern: (passage: ))` produces `(dm:"name",str,"source",str,"tags",(a:str))` (as long as the passage has no metadata macros in it).
			* `$coordinate matches (datapattern: (a:15,45))` checks if $coordinate is an array of exactly two numbers. 
			* `(datapattern: $value) matches $value2` checks if $value2 exactly matches the structure of $value.

			Details:
			The (datatype:) macro is useful for examining and comparing the datatypes of values, but when dealing with arrays and datamaps, each of which can have radically
			different purposes and meanings throughout your story, that macro only produces `array` or `dm` when given them, which isn't too helpful when checking
			if one array is similar to another. This macro produces a more precise result - an array or datamap with datatypes replacing its values - which is compatible with
			the `matches` operator, the (set:) macro, parameters of the (macro:) macro, and other places where datatypes are useful.

			Details:
			This won't return structures containing spread datatypes, even if those could plausibly describe the passed-in data structure - an array with 26 numbers in it will,
			when given to this macro, produce an array containing `num` 26 times, no more or less.

			Note that this does not produce any string patterns, like those produced by (p:) - any string given to this will still result in `str` being returned.

			See also:
			(source:), (datatype:)

			Added in: 3.2.0
			#custom macros 6
		*/
		("datapattern", "Any", (_, data) => {
			return (function recur(data) {
				let ret, error;
				if (Array.isArray(data)) {
					ret = data.map(recur);
				}
				else if (data instanceof Map) {
					ret = new Map();
					[...data].forEach(([k,v]) => ret.set(k, recur(v)));
				}
				else {
					ret = Datatype.from(data);
				}
				if ((error = TwineError.containsError(ret))) {
					return error;
				}
				return ret;
			}(data));
		},
		[Any])

		/*d:
			(rgb: Number, Number, Number, [Number]) -> Colour
			Also known as: (rgba:)

			This macro creates a colour using the three red (r), green (g) and blue (b) values
			provided, whose values are numbers between 0 and 255, and, optionally,
			the transparency (alpha, or a) percentage, which is a fractional value between 0
			(fully transparent) and 1 (fully visible).

			Anything drawn with a partially transparent colour will itself be partially transparent. You
			can then layer such elements to produce a few interesting visual effects.

			Example usage:
			* `(rgb: 255, 0, 47)` produces <tw-colour style="background-color:rgb(255,0,47);"></tw-colour>.
			* `(rgb: 90, 0, 0)'s r` produces the number 90.
			* `(rgb: 178, 229, 178, 0.6)` produces <tw-colour style="background-color:rgba(178,229,178,0.6);"></tw-colour>
			(a 40% transparent green).

			Rationale:

			The RGB additive colour model is commonly used for defining colours: the HTML
			hexadecimal notation for colours (such as #9263AA) simply consists of three hexadecimal
			values placed together. This macro allows you to create such colours computationally,
			by providing variables for certain components.

			Details:

			This macro takes the same range of numbers as the CSS `rgb()` function.

			Giving values higher than 255 or lower than 0 will cause an error. Former versions of Harlowe
			did not allow fractional values to be given, but that restriction is no longer present.

			Giving alpha percentages higher than 1 or lower than 0 will cause an error.

			See also:
			(hsl:), (lch:), (gradient:)

			Added in: 2.0.0
			#colour 2
		*/
		(["rgb","rgba"], "Colour", (_, ...values) => Colour.create({r: values[0], g: values[1], b: values[2], a: values[3]}),
		[numberRange(0,255), numberRange(0,255), numberRange(0,255), optional(percent)])

		/*d:
			(hsl: Number, Number, Number, [Number]) -> Colour
			Also known as: (hsla:)

			This macro creates a colour using the given hue (h) angle in degrees, as well as the given
			saturation (s) and lightness (l) percentages, and, optionally, the transparency
			(alpha, or a) percentage, which is a fractional value between 0 (fully transparent)
			and 1 (fully visible).

			Anything drawn with a partially transparent colour will itself be partially transparent. You
			can then layer such elements to produce a few interesting visual effects.

			Example usage:
			* `(hsl: 120, 0.8, 0.5)` produces <tw-colour style="background:rgb(25,229,25);"></tw-colour>.
			* `(hsl: 28, 1, 0.4)'s h` produces the number 28.
			* `(hsl: 120, 0.5, 0.8, 0.6)` produces <tw-colour style="background:rgba(178,229,178,0.6);"></tw-colour>
			(a 40% transparent green).

			Rationale:

			The HSL colour model is regarded as easier to work with than the RGB model used for HTML hexadecimal
			notation and the (rgb:) macro. Being able to set the hue with one number instead of three, for
			instance, lets you control the hue using a single variable, and alter it at will.

			Details:

			This macro takes the same range of numbers as the CSS `hsla()` function.

			Giving saturation or lightness values higher than 1 or lower than 0 will cause an error. However,
			you can give any kind of hue number to (hsl:), and it will automatically round it to fit the 0-359
			degree range - so, a value of 380 will become 20. This allows you to cycle through hues easily by
			providing a steadily increasing variable or a counter, such as `(hsl: time / 100, 1, 0.5)`.

			Giving alpha percentages higher than 1 or lower than 0 will cause an error.

			See also:
			(rgb:), (lch:), (gradient:)

			Added in: 2.0.0
			#colour 1
		*/
		(["hsl","hsla"], "Colour", (_, h, s, l, a) => {
			/*
				Unlike S and L, H is silently rounded and truncated to the 0..359 range. This allows increasing counters
				to be given directly to the (hsl:) macro, to cycle through the hues continuously.
				Round is used because, as the user's hue range is effectively continuous, nothing is lost by using it.
			*/
			h = round(h) % 360;
			if (h < 0) {
				h += 360;
			}
			return Colour.create({h, s, l, a});
		},
		[Number, percent, percent, optional(percent)])

		/*d:
			(lch: Number, Number, Number, [Number]) -> Colour
			Also known as: (lcha:)

			This macro creates a colour using three values in the CIELAB colour model - a lightness (l) percentage,
			a chroma (c) value, and a hue (h) angle in degrees, and, optionally, the transparency
			(alpha, or a) percentage, which is a fractional value between 0 (fully transparent)
			and 1 (fully visible).

			Anything drawn with a partially transparent colour will itself be partially transparent. You
			can then layer such elements to produce a few interesting visual effects.

			Example usage:
			* `(lch: 0.6, 80, 10)` produces <tw-colour style="background:rgb(255, 54.6559266533235, 125.2194303105326)"></tw-colour>.
			* `(lch: 0.6, 80, 10)'s lch's c` produces the number 80.
			* `(lch: 0.9, 15, 142, 0.6)` produces <tw-colour style="rgba(208.35035299107486,232.9513865246509,208.11824116140272,0.6)"></tw-colour>
			(a 40% transparent green).

			Rationale:

			The CIELAB colour model is considered to be more universally useful than the RGB model and its HSL representation,
			whose treatment of "lightness" doesn't properly reflect the actual perceived *luminosity* of the colours
			in question. For instance, this colour <tw-colour style="background:hsl(120,100%,50%);"></tw-colour>
			(produced by `(hsl:120,1,0.5)`) and this colour <tw-colour style="background:hsl(220,100%,50%);"></tw-colour>
			(produced by `(hsl:220,1,0.5)`) have the same HSL lightness (0.5), but one appears to the human eye to be less
			bright than the other, due to one hue being less luminous than the other.

			The lightness in LCH more closely corresponds to how the human eye perceives luminosity - `(lch:0.9,80,120)`
			produces <tw-colour style="background:rgb(177.74927536801104, 245.82494825009778, 78.56222683552888)"></tw-colour>, and `(lch:0.9,80,220)`
			produces <tw-colour style="background:rgb(171.75413233436592,237.65421375200268,254.99998540183145)"></tw-colour>, which, as you can see, is a pair closer in luminosity
			than the previous pair. Note that this means the lightness and hue values of LCH are **not** directly transferable between (hsl:)
			and this macro - they have different meanings in each. A hue angle in LCH is usually between 10 and 20 degrees less than its
			angle in HSL, varying by the LCH lightness.

			Additionally, CIELAB's colour model replaces the "saturation" value of HSL with "chroma". Rather than being a single percentage
			from 0 to 1, LCH's chroma is a value whose upper bound varies with the colour's hue, reflecting how the human eye distinguishes
			some hues more accurately than others.

			Details:
			Despite all of the above, any colour produced by this macro will have to be internally converted back to HSL in order to
			be used, due to HTML and CSS not fully supporting LCH as of 2020. As such, colours produced by this macro are constrained
			by HSL's limits - as LCH accepts a greater variety of chroma and lightness combinations than what HSL can represent, the output
			colour will be automatically converted to the nearest valid HSL values, if necessary.

			Giving lightness or alpha values less than 0 and greater than 1 will cause an error. Giving chroma values less than 0
			and greater than 132 will cause an error. However, you can give any kind of hue number to (lch:), and it will automatically
			round it to fit the 0-359 degree range - so, a value of 380 will become 20. This allows you to cycle through hues easily by
			providing a steadily increasing variable or a counter, such as `(lch: 0.9, 80, time / 100)`.

			See also:
			(hsl:), (rgb:), (gradient:), (complement:), (mix:)

			Added in: 3.2.0
			#colour 3
		*/
		(["lch","lcha"], "Colour", (_, l, c, h, a) => {
			/*
				As with (hsl:), H is silently rounded and truncated to the 0..359 range.
			*/
			h = round(h) % 360;
			if (h < 0) {
				h += 360;
			}
			return Colour.create({l, c, h, a});
		},
		[percent, numberRange(0,132), Number, optional(percent)])

		/*d:
			(complement: Colour) -> Colour

			When given a colour, this provides a complement to that colour.

			Example usage:
			`(complement:orange)` produces <tw-colour style="background-color:rgba(0,176.93497486213232,255,1);"></tw-colour>.

			Details:
			This is a very simple macro - the returned colour is the same as the input colour, except that its LCH hue
			(as given to the (lch:) macro) has been rotated by 180 degrees, producing a colour with equivalent chroma
			and luminosity, but an opposite hue.

			Note that, unlike (text-colour:), this will not take a string containing a CSS colour. This is because
			it operates purely on Harlowe colour data, and doesn't have a means of converting CSS colours into
			colour data.

			See also:
			(lch:), (mix:)

			Added in: 3.2.0
			#colour 4
		*/
		("complement", "Colour", (_, colour) => colour.LCHRotate(180),
		[Colour])

		/*d:
			(mix: Number, Colour, Number, Colour) -> Colour

			When given two pairs of values - each a number from 0 to 1 and a colour - this macro produces a mix of the two colours, using the numbers
			as ratios of each colour. The colours are mixed using the LCH colourspace, used by the (lch:) macro.

			Example usage:
			* `(mix: 0.5, red, 0.5, blue)` produces <tw-colour style="background-color:rgba(208.84581206247847,51.16115242304117,178.9123116270067,1);"></tw-colour>. This is a rosy fuchsia,
			whereas `red + blue` produces <tw-colour style="background-color:rgba(153,91,153,1);" data-raw=""></tw-colour>, a grayer fuchsia.
			* `(mix: 0.5, white, 0.5, #00f)` produces <tw-colour style="background-color:rgba(174.65024704481542,137.99348220075095,254,1);"></tw-colour>. The slight
			shift towards purple is a known weakness of the LCH colourspace.
			* `(mix: 0.4, red, 0.1, white)` produces <tw-colour style="background-color:rgba(243.25474741442827,92.29028459127169,68.073065830466,0.5);"></tw-colour>, a 50% transparent light red.
			Because the numbers only added up to 0.5, the result was 50% transparent (see below).

			Rationale:

			While you can mix colours in Harlowe using the + operator, such as by `red + yellow`, this operation doesn't easily
			allow for different mix ratios, such as a one-quarter/three-quarters mix, instead mixing both colours equally.
			In addition, in Harlowe 3, this uses the sRGB mixing method, which doesn't produce the most perceptually ideal colours, often making them
			darker or grayer than expected. This macro provides a more sophisticated alternative, allowing ratios for each colour to be specified, and using the LCH colour
			space to mix the colours, which tends to preserve chromaticity (colourfulness) better.

			Details:

			The colours are mixed in the LCH colourspace. What this means is: the colours are converted to their LCH datamaps (accessible as `$colour's lch`), and then
			(omitting a few minor details) their hue, lightness and chroma values are averaged. Then, the averaged values are used to construct a new colour, as if by the
			(lch:) macro.

			The two numbers (the ratios) are decimal values from 0 to 1. Numbers above or below will produce an error when given.

			If the two ratios do not add up to 1, then they will be scaled to compensate. For instance, for `(lch: 0.1, green, 0.3, blue)`, the 0.1 and 0.3 add up to 0.4,
			but they *should* add up to 1, so they are scaled up to 0.25 and 0.75, respectively.

			Additionally, if the two ratios add up to *less* than 1, then the difference will be converted into **additional transparency**, which is used to multiply
			the mixed colour's alpha. For instance, for `(lch: 0.15, red, 0.45, blue)`, the ratios 0.15 and 0.45 add up to only 0.6, which is 0.4 less than 1.
			So, the mixed colour's alpha (of 1) is multiplied by 0.6 (and thus made 40% more transparent than it would've been otherwise).

			See also:
			(lch:), (complement:)

			Added in: 3.3.0
			#colour
		*/
		("mix", "Colour", (_, p1, c1, p2, c2) => {
			c1 = c1.toLCHA();
			c2 = c2.toLCHA();
			/*
				If the percents don't equal 1, the difference is converted
				to an alpha multiplier, which is applied at the very end. This is in keeping with
				CSS's color-mix().
			*/
			let alphaMultiplier = 1;
			/*
				Scale (normalise) the percents so that they total 1.
			*/
			if (p1 + p2 !== 1) {
				if (p1 + p2 < 1) {
					alphaMultiplier = p1 + p2;
				}
				[p1, p2] = [p1/(p1+p2), p2/(p1+p2)];
			}
			/*
				The "powerless hue" step: since white or black don't have a hue, don't interpolate it
				(instead, replace it with the other hue).
			*/
			if (c1.c < 2 || c1.l < 0.01 || c1.l > 0.99) {
				c1.h = c2.h;
			}
			else if (c2.c < 2 || c2.l < 0.01 || c2.l > 0.99) {
				c2.h = c1.h;
			}
			/*
				Premultiply step: since transparent colours aren't perceptually as powerful
				as solid colours, multiply (as in, reduce) the lightness and chroma by the alpha.
			*/
			c1.l *= c1.a; c1.c *= c1.a;
			c2.l *= c2.a; c2.c *= c2.a;
			/*
				The default hue interpolation algorithm for CSS color-mix() is "shorten", seen below.
			*/
			if (c2.h - c1.h > 180) {
				c1.h += 360;
			}
			else if (c2.h - c1.h < -180) {
				c2.h += 360;
			}
			/*
				Now, linearly interpolate all the values, and reverse the premultiply step by
				dividing (as in, increasing) them by the new alpha.
			*/
			let newA = (c1.a*p1+c2.a*p2),
				newL = (c1.l*p1+c2.l*p2)/newA,
				newC = (c1.c*p1+c2.c*p2)/newA,
				newH = (c1.h*p1+c2.h*p2)/newA;
			/*
				Finally, apply the aforementioned multiplier.
			*/
			return Colour.create({l: newL, c: newC, h: newH, a: newA * alphaMultiplier});
		}, [percent, Colour, percent, Colour])

		/*d:
			(palette: String, Colour) -> Array

			When given a string specifying a palette type, and a colour, this macro produces an array containing the given colour
			followed by three additional colours that together form a palette, for use with (text-colour:), (bg:), and other macros.

			Example usage:
			```
			{(unpack: (palette: "mono", orange + black) into (a:_bg, _c, _lc, _hc))
			(enchant: ?page, (background: _bg) + (text-colour:_c))
			(enchant: ?link, (text-colour:_lc) + (hover-style: (text-colour:_hc)))}
			This passage uses (link:"(more)")[a brown palette.]
			```

			Rationale:
			Intended for game jams and rapid prototyping, (palette:) provides a quick and simple palette for stories and passages. When you aren't
			too fussed with making your story look significantly different from the Harlowe default, but just want a certain colour scheme to provide a certain
			mood, or colour a specific passage differently to offset it from the rest of the story, you can defer the task of choosing text or background
			colours to this macro. It will choose colours which contrast with the given colour to attempt to maximise readability, while still having an
			interesting relationship with the given colour's hue.

			Details:
			The following type strings are accepted.
			
			| String | Explanation
			|---
			| "mono" | The returned colours are tints and shades of the given colour.
			| "adjacent" | The returned colours' hues are 30° to the left, 30° to the right, and 60° to the right of the given colour's hue.
			| "triad" | The returned colours' hues are 140° to the left, 140° to the right, and 180° to the right of the given colour's hue.

			This macro interprets the passed-in colour as a background colour, and the three colours it provides are intended as text colours -
			but you can easily use them for other purposes. The given colour could be used as a text colour, and any of the received colours
			could be used as different backgrounds.

			The three returned colours all have a luminosity chosen to provide sufficient contrast with the given colour's luminosity. If
			the given colour's luminosity is very low or very high (near 0 or 1) then the returned colours will have a luminosity near
			the other extremity.

			Added in: 3.2.0
			#colour 5
		*/
		("palette", "Array", (_, type, bg) => {
			const {l,h} = bg.toLCHA();
			const lcha = {
				// This formula was devised entirely through trial and error.
				l: l <= 0.75 ? 0.75 + (l/3) : 0.75 - ((1-l)*3),
				c: 80,
				h,
				a:1
			};
			let text, link, hover;
			/*
				The "mono" palette is the base, and each other palette type is
				a modification of it.
			*/
			text  = Colour.create(lcha);
			lcha.l += (l <= 0.75 ? -0.1 : 0.1);
			/*
				To push the link text further away from black if the plain text is already
				relatively black, this important nudge is applied.
			*/
			if (lcha.l < 0.5) {
				lcha.l *= 0.5/lcha.l;
			}
			link  = Colour.create(lcha);
			lcha.l += (l <= 0.85 ? 0.15 : -0.15);
			hover = Colour.create(lcha);

			if (type === "adjacent") {
				text    = text.LCHRotate(-30);
				link    = text.LCHRotate(30);
				hover   = text.LCHRotate(60);
			}
			else if (type === "triad") {
				hover   = text.LCHRotate(180);
				link    = text.LCHRotate(140);
				text    = text.LCHRotate(-140);
			}
			return [bg,text,link,hover];
		},
		[insensitiveSet("mono","adjacent","triad"), Colour])

		/*d:
			(gradient: Number, ...Number, Colour) -> Gradient

			When given a degree angle, followed by any number of number-colour pairs called "colour stops", this macro produces
			a gradient that fades between those colours in the direction of the angle.

			Example usage:
			```
			(set: $desertChrome to (gradient: 0, 0, #e6a860, 0.49, black, 0.5, white, 1, blue))
			(background: $desertChrome)+(text-color:white)[Sunshine Desert]
			```
			The above example produces <span style="color:#fff;background-image: linear-gradient(0deg, rgb(230, 168, 96) 0%,
				rgb(0, 0, 0) 49%, rgb(255, 255, 255) 50%, rgb(25, 127, 230) 100%); display: initial;">Sunshine Desert</span>

			Rationale:
			An easy way to add a subtle sense of depth, texture, direction or variety to elements in Harlowe, without having
			to create and import background images from outside of Twine, is to use this macro to generate a gradient, a
			dynamically-generated background which can be used with (background:).

			A gradient consists of a series of flat colours. One of those colours will be used on one side of the element,
			one on the other, and the space in between will smoothly fade between them. You can supply additional colours
			that the gradient will smoothly fade to in between the start and end colours, too.

			To specify where exactly these intermediate colour fades will occur on the element, the colours are paired with
			a percentage number - 0 being one side of the element, 1 being the other, 0.5 being exactly in-between. This pairing
			is called a "colour stop".
			
			Consider this (gradient:) call, with six colour stops.
			`(gradient:90,  0,#bf3f3f,  0.2,#a5bf3f,  0.4,#3fbf72,  0.6,#3f72bf, 0.8,#a53fbf, 1,#bf3f3f)`

			The six colour stops are `0,#bf3f3f` <span style="width:1em;height:1em;display:inline-block;background:#bf3f3f"></span>,
			`0.2,#a5bf3f` <span style="width:1em;height:1em;display:inline-block;background:#a5bf3f"></span>,
			`0.4,#3fbf72` <span style="width:1em;height:1em;display:inline-block;background:#3fbf72"></span>,
			`0.6,#3f72bf` <span style="width:1em;height:1em;display:inline-block;background:#3f72bf"></span>,
			`0.8,#a53fbf` <span style="width:1em;height:1em;display:inline-block;background:#a53fbf"></span>,
			and `1,#bf3f3f` <span style="width:1em;height:1em;display:inline-block;background:#bf3f3f"></span>.
			This corresponds to the following gradient, which for documentation purposes has its colour stops marked.
			<div style="position:relative">
			<div style="position:absolute;left:0%;width:1px;background-color:black;color:white;height:64px;">0,<br>#bf3f3f</div>
			<div style="position:absolute;left:20%;width:1px;background-color:black;color:white;height:64px;">0.2,<br>#a5bf3f</div>
			<div style="position:absolute;left:40%;width:1px;background-color:black;color:white;height:64px;">0.4,<br>#3fbf72</div>
			<div style="position:absolute;left:60%;width:1px;background-color:black;color:white;height:64px;">0.6,<br>#3f72bf</div>
			<div style="position:absolute;left:80%;width:1px;background-color:black;color:white;height:64px;">0.8,<br>#a53fbf</div>
			<div style="position:absolute;left:100%;width:1px;background-color:black;height:64px;">1,<br>#bf3f3f</div>
			<div style="background:linear-gradient(90deg, rgba(191, 63, 63, 1) 0%, rgba(165, 191, 63, 1) 20%,
				rgba(63, 191, 114, 1) 40%, rgba(63, 114, 191, 1) 60%, rgba(165, 63, 191, 1) 80%,
				rgba(191, 63, 63, 1) 100%); height:64px;z-index:-1;"></div>
			</div>
			(gradient:)'s first argument is a degree angle, which can be used to rotate the gradient's direction, changing
			where the first and last colours are placed in the element. Changing the degree angle in the above example from 90 degrees
			to 0 changes it from a horizontal gradient to a vertical gradient, using the same colours and stops:
			<div style="background:linear-gradient(0deg, rgba(191, 63, 63, 1) 0%, rgba(165, 191, 63, 1) 20%,
				rgba(63, 191, 114, 1) 40%, rgba(63, 114, 191, 1) 60%, rgba(165, 63, 191, 1) 80%,
				rgba(191, 63, 63, 1) 100%); height:64px;"></div>
			
			Any angle can be given to (gradient:), including diagonal values like 40 or 66.

			Details:
			An error will be produced if you give colour-stop percentages that aren't between 0 and 1, or give less than 2 colour-stops. However,
			any number of degrees given to (gradient:), even below 0 or above 359, will automatically be rounded to fit the 0-359
			degree range - so, a value of 380 will become 20.

			You do not necessarily need to supply colour-stops at positions 0 and 1 - instead, the nearest colour-stop to those positions will be extended
			to the edge of the gradient. Furthermore, you don't need to supply colour-stops in ascending order - they will be reordered by Harlowe if they are not.

			Gradients in Harlowe are implemented using CSS `linear-gradient`s, and have the same limitations in output and browser support.
			Note, however, that the order of values for a colour stop is reversed from that of the CSS syntax (numbers go first, then colours).
			This is to help ensure that the initial degree number is not confused for a colour-stop percentage. Additionally, CSS
			linear-gradient "colour hints", which are used to adjust the midpoints between colour stops, are currently not supported by this macro.

			See also:
			(stripes:)

			Added in: 3.1.0
			#colour 6
		*/
		("gradient", "Gradient", (_, degree, ...args) => {
			/*
				Just like with (hsl:), we silently rounded and truncate degrees to the 0..359 range.
			*/
			degree = round(degree) % 360;
			if (degree < 0) {
				degree += 360;
			}
			/*
				Next, check that there are enough colour-stops.
			*/
			if (args.length < 4) {
				return TwineError.create(
					"datatype",
					"(gradient:) must be given at least 2 colour-stop pairs of numbers and colours."
				);
			}
			/*
				This takes the flat arguments "array" and assembles the pairs array with every two values,
				type-checking and propagating errors throughout.
				During each odd iteration, the stop is the value. Then, the colour is the value.
			*/
			let stop;
			const pairs = [];
			const status = args.reduce((status, colour) => {
				/*
					Propagate earlier iterations' errors.
				*/
				if (TwineError.containsError(status)) {
					return status;
				}
				if (stop === undefined) {
					stop = colour;
				}
				/*
					Colour-stop type-checking must be done here.
				*/
				else if (typeof stop !== "number" || !Colour.isPrototypeOf(colour)) {
					return TwineError.create(
						"datatype",
						"(gradient:) colour-stops should be pairs of numbers and colours, not colours and numbers."
					);
				}
				else {
					pairs.push({stop, colour:clone(colour)});
					stop = undefined;
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
				If there's an odd number of arguments, that means a stop has not been given a colour.
			*/
			if (stop !== undefined) {
				return TwineError.create("macrocall", "This gradient has a colour-stop percent without a colour.");
			}
			return Gradient.create(degree, pairs);
		},
		[Number, rest(either(percent, Colour))])

		/*d:
			(stripes: Number, Number, Colour, Colour) -> Gradient

			When given a degree angle, a pixel distance, and two or more colours, this macro produces
			a gradient that draws a striped background, with each stripe as wide as the distance, and alternating through the given colours.

			Example usage:
			* `(enchant: ?page, (background: (stripes: 45, 20, fuchsia+white, white)))` causes the page to have a pink-and-white striped background.

			Rationale:
			The (gradient:) macro can be used to dynamically create gradient backgrounds, which smoothly transition between multiple colours. By using
			certain pairs of colour stops that are very close together, however, you can create gradients where the colours transition sharply, producing stripes.
			Rather than use that macro, you can instead use this one to generate striped backgrounds succinctly, that repeat uniformly, and with easily-adjusted
			stripe width.

			Details:
			The degree angle matches that given to (gradient:). A number of 0 causes the stripes to be drawn horizontally, and increasing that number rotates
			the stripes counter-clockwise. Any number below 0 or above 359 will automatically be rounded to fit the 0-359
			degree range - so, a value of 380 will become 20.

			The distance value given is in pixels, and determines the width of a single stripe.

			Gradients (including those produced by (stripes:)) in Harlowe are implemented using CSS `repeating-linear-gradient`s, and have the same limitations
			in output and browser support.

			(stripes:) gradients still have a "stops" array, accessible via `$stripeGradient's stops`, as with other gradients. Even though (stripes:) doesn't accept
			"colour stops", this array still contains colour stop datamaps, as if this gradient had been generated by (gradient:).
			There are two "stops" for each colour, and instead of a "percent" value, they have a "pixels" value. So, `$stripeGradient's stops's 1st's colour` will
			produce the colour of the first stripe, `$stripeGradient's stops's 3rd's colour` will produce the colour of the second stripe, and so forth.
			`$stripeGradient's stops's 2nd's pixels` will produce the pixel width of each stripe.

			See also:
			(gradient:)

			Added in: 3.2.0
			#colour 7
		*/
		("stripes", "Gradient", (_, degree, width, ...colours) => {
			/*
				Just like with (hsl:), we silently rounded and truncate degrees to the 0..359 range.
			*/
			degree = round(degree) % 360;
			if (degree < 0) {
				degree += 360;
			}
			/*
				Stripes are produced in a much simpler fashion from (gradient:).
			*/
			let stop = 0;
			const pairs = [];
			colours.forEach(c => {
				pairs.push({ stop, colour:clone(c) });
				stop += width;
				pairs.push({ stop, colour:clone(c) });
			});
			return Gradient.create(degree, pairs, true);
		},
		[Number, positiveInteger, Colour, rest(Colour)])

		/*d:
			(hooks-named: String) -> HookName

			When given a string, this creates a HookName from it. This can be used to dynamically create HookNames.

			Example usage:
			```
			|oracle)["I scry with sticks, not bones."]|mage)["No teeth in the jawbones?"]|bodyguard)["Don't sift through rot."]

			(set: $companionType to "bodyguard")
			(link:"Investigate the bones")[(show:(hooks-named:$companionType))]
			```

			Rationale:
			The standard syntax for referring to hooks, in macros such as (replace:), (change:) or (show:), is to write a HookName, such as `?door`. That syntax,
			though, requires that you hard-code the name of the hook. This macro lets you construct a HookName from one or more existing strings or other variables,
			so that the exact hook referenced depends on the game state.

			This macro is called (hooks-named:) to avoid confusion with (hook:), and also to convey that a HookName will refer to any number of hooks as long as they
			have the same name.

			Details:
			Note that the HookNames produced by this macro have the same functionality as other HookNames. In particular, you can specify the `1st` hook, `2ndlast` and so forth
			by writing, for instance, `(hooks-named: "A")'s 2ndlast`. Also note that the built-in HookNames can be constructed with this macro - `(hooks-named:"passage")` is
			the same as `?passage`.

			If an empty string is given, then this will cause an error.

			See also:
			(hook:)

			Added in: 3.2.0
			#basics
		*/
		("hooks-named", "HookName", (_, data) => {
			if (!data) {
				return TwineError.create("datatype", "(hooks-named:) can't be given an empty string.");
			}
			return HookSet.create({type:"name", data});
		}, [String])

		/*d:
			(cond: Boolean, Any, ...Any) -> Any

			When given a sequence of booleans (the "conditions") paired with values, this provides the first value that was
			paired with a `true` condition. This can give you one value or another based on a quick check.

			Example usage:
			* `(set: $status to (cond: $cash >= 300, "stable", $cash >= 200, "lean", $cash >= 100, "skint", "broke"))`
			* `Your (cond: $wonTheRace, "gasps of triumph", "wheezes of defeat") drown out all other noise.`

			Rationale:
			While the (if:), (else:) and (else-if:) macros allow blocks of passage prose to be conditionally displayed and code to be
			conditionally run, there are plenty of situations where you'd prefer to succinctly select values inside macro
			calls, or select from multiple values, without needing to write multiple (else-if:)s or (set:)s for each possibility.
			The (cond:) macro (short for "condition") offers such utility.

			In situations where you would write something like this,
			
			```
			{(if: not $lostTheSword)[
			(set: $weapon to "a holy sword")
			](else: )[
			(set:$weapon to "an unholy swear-word")
			]}
			```

			you could instead simply write this.

			`(set: $weapon to (cond: not $lostTheSword, "a holy sword", "an unholy swear-word"))`

			Details:
			This macro is intended to resemble the "cond" function in Lisp, as well as the "ternary" operator in numerous other
			programming languages. It also might remind you of the values given to (dm:) - a piece of metadata, followed by its matching
			data - except that (dm:) ties names to data, whereas this ties conditions to data.

			If only one value was given to (cond:), then that value will be returned as-is.

			Except for the last, every odd value given to (cond:) must be a boolean, or an error will occur.

			See also:
			(if:), (dm:), (nth:)

			Added in: 3.1.0
			#basics 12
		*/
		("cond", "Any", (_, ...args) => {
			for(let i = 0; i < args.length; i += 2) {
				const boolean = args[i];
				/*
					If this is the final value, use it.
					Additionally, if there is an error here, propagate it.
				*/
				if (i === args.length-1 || TwineError.containsError(boolean)) {
					return boolean;
				}
				/*
					If this isn't a Boolean, then produce an error.
				*/
				if (typeof boolean !== "boolean") {
					return TwineError.create("datatype",
						"(cond:)'s " + nth(i + 1) + " value is " + objectName(boolean) +
							", but should be a boolean."
					);
				}
				/*
					The actual logic of this macro: return the value if its matching boolean is true.
				*/
				if (boolean) {
					return args[i + 1];
				}
			}
			/*
				If control flow reaches here, then there weren't enough values to match with booleans.
			*/
			return TwineError.create("macrocall",
				"An odd number of values must be given to (cond:), not " + (args.length),
				"(cond:) must be given one or more pairs of booleans and values, as well as one final value."
			);
		}, [Boolean, Any, rest(Any)])
		;
		/*d:
			Boolean data
			
			Branching stories involve the player making choices, and the game using its own programmed logic to react to those choices.
			Much as how arithmetic involves manipulating numbers with addition, multiplication and such, logic involves manipulating the
			values `true` and `false` using its own operators. Those are not text strings - they are values as fundamental as
			the natural numbers. In computer science, they are both called *Booleans*, after the 19th century mathematician
			George Boole.
			
			`is` is a logical operator. Just as + adds the two numbers on each side of it, `is` compares two values on each
			side and evaluates to `true` or `false` depending on whether they're identical. It works equally well with strings,
			numbers, arrays, and anything else, but beware - the string `"2"` is not equal to the number 2.
			
			There are several other logical operators available.
			
			| Operator | Purpose | Example
			|---
			| `is` | Evaluates to `true` if both sides are equal, otherwise `false`. | `$bullets is 5`
			| `is not` | Evaluates to `true` if both sides are not equal. | `$friends is not $enemies`
			| `contains` | Evaluates to `true` if the left side contains the right side. | `"Fear" contains "ear"`
			| `does not contain` | Evaluates to `true` if the left side does not contain the right side. | `"Fear" does not contain "eet"`
			| `is in` | Evaluates to `true` if the right side contains the left side. | `"ugh" is in "Through"`
			| `>` | Evaluates to `true` if the left side is greater than the right side. | `$money > 3.75`
			| `>=` | Evaluates to `true` if the left side is greater than or equal to the right side. | `$apples >= $carrots + 5`
			| `<` | Evaluates to `true` if the left side is less than the right side. | `$shoes < $people * 2`
			| `<=` | Evaluates to `true` if the left side is less than or equal to the right side. | `65 <= $age`
			| `and` | Evaluates to `true` if both sides evaluates to `true`. | `$hasFriends and $hasFamily`
			| `or` | Evaluates to `true` if either side is `true`. | `$fruit or $vegetable`
			| `not` | Flips a `true` value to a `false` value, and vice versa. | `not $stabbed`
			| `matches` | Evaluates to `true` if one side is a pattern or datatype describing the other. | `boolean matches true`
			| `does not match` | Evaluates to `true` if one side does not describe the other. | `boolean does not match "true"`
			| `is a`, `is an` | Evaluates to boolean `true` if the right side is `boolean` and the left side is a boolean. | `$wiretapped is a boolean`
			| `is not a`, `is not an` | Evaluates to boolean `true` if the right side does not describe the left side. | `"Boo" is not an empty`, `2 is not an odd`
			
			Conditions can quickly become complicated. The best way to keep things straight is to use parentheses to
			group sub-statements and express order of operations.
		*/

	/*
		Filter out NaN and Infinities, throwing an error instead.
		This is only applied to functions that can create non-numerics,
		namely log, sqrt, etc.
	*/
	function mathFilter (fn) {
		return (...args) => {
			const result = fn(...args);
			if (typeof result !== "number" || isNaN(result)) {
				return TwineError.create("macrocall", "This mathematical expression doesn't compute!");
			}
			return result;
		};
	}

	/*
		The mandatory first argument of all macro
		functions is section, so we have to use this to convert the below
		to use a contract that's amenable to this requirement.
	*/
	const ignoreArgumentOne = fn => (_, ...rest) => fn(...rest);
	
	({
		/*d:
			(weekday:) -> String

			This date/time macro produces one of the strings "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"
			or "Saturday", based on the weekday on the current player's system clock.

			Example usage:
			`Today is a (weekday:).`

			Added in: 1.0.0
			#date and time
		*/
		weekday: [() => ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'][new Date().getDay()] + "day",
		// 0 args
		null],

		/*d:
			(monthday:) -> Number

			This date/time macro produces a number corresponding to the day of the month on the current player's system clock.
			This should be between 1 (on the 1st of the month) and 31, inclusive.

			Example usage:
			`Today is day (monthday:).`

			Added in: 1.0.0
			#date and time
		*/
		monthday: [() => new Date().getDate(),
		null],

		/*d:
			(current-time:) -> String

			This date/time macro produces a string of the current 12-hour time on the current player's system clock,
			in the format "12:00 AM".

			Example usage:
			`The time is (current-time:).`

			Added in: 1.0.0
			#date and time
		*/
		currenttime: [() => {
			const d = new Date(),
				am = d.getHours() < 12,
				hr = ((d.getHours() % 12) || 12),
				mins = (d.getMinutes() < 10 ? "0" : "") + d.getMinutes();

			return hr + ":" + mins + " " + (am ? "A" : "P") + "M";
		},
		null],

		/*d:
			(current-date:) -> String

			This date/time macro produces a string of the current date the current player's system clock,
			in the format "Thu Jan 01 1970".

			Example usage:
			`Right now, it's (current-date:).`

			Added in: 1.0.0
			#date and time
		*/
		currentdate: [() => {
			return new Date().toDateString();
		},
		null],

		/*d:
			(min: ...Number) -> Number

			This maths macro accepts numbers, and evaluates to the lowest valued number.

			Example usage:
			`(min: 2, -5, 2, 7, 0.1)` produces -5.

			Added in: 1.0.0
			#maths
		*/
		min: [min, rest(Number)],
		/*d:
			(max: ...Number) -> Number

			This maths macro accepts numbers, and evaluates to the highest valued number.

			Example usage:
			`(max: 2, -5, 2, 7, 0.1)` produces 7.

			Added in: 1.0.0
			#maths
		*/
		max: [max, rest(Number)],
		/*d:
			(abs: Number) -> Number

			This maths macro finds the absolute value of a number (without the sign).

			Example usage:
			`(abs: -4)` produces 4.

			Added in: 1.0.0
			#maths
		*/
		abs: [Math.abs, Number],
		/*d:
			(sign: Number) -> Number

			This maths macro produces -1 when given a negative number, 0 when given 0, and 1
			when given a positive number.

			Example usage:
			`(sign: -4)` produces -1.

			Added in: 1.0.0
			#maths
		*/
		sign: [Math.sign, Number],
		/*d:
			(sin: Number) -> Number

			This maths macro computes the sine of the given number of radians.

			Example usage:
			`(sin: 3.14159265 / 2)` produces 1.

			Added in: 1.0.0
			#maths
		*/
		sin:    [Math.sin, Number],
		/*d:
			(cos: Number) -> Number

			This maths macro computes the cosine of the given number of radians.

			Example usage:
			`(cos: 3.14159265)` produces -1.

			#maths
		*/
		cos:    [Math.cos, Number],
		/*d:
			(tan: Number) -> Number

			This maths macro computes the tangent of the given number of radians.

			Example usage:
			`(tan: 3.14159265 / 4)` produces approximately 1.

			Added in: 1.0.0
			#maths
		*/
		tan:    [Math.tan, Number],
		/*d:
			(floor: Number) -> Number

			This macro rounds the given number downward to a whole number. If a whole number is provided,
			it returns the number as-is.

			Example usage:
			`(floor: 1.99)` produces 1.

			Added in: 1.0.0
			#number
		*/
		floor:  [floor, Number],
		/*d:
			(round: Number) -> Number

			This macro rounds the given number to the nearest whole number - downward if
			its decimals are smaller than 0.5, and upward otherwise. If a whole number is provided,
			it returns the number as-is.

			Example usage:
			`(round: 1.5)` produces 2.

			Added in: 1.0.0
			#number
		*/
		round:  [round, Number],
		/*d:
			(trunc: Number) -> Number

			This macro rounds the given number towards zero. This "truncates" the fractional portion of the number, removing it and leaving
			just the whole portion.

			Example usage:
			`(trunc: 1.5)` produces 1. `(trunc: -3.9)` produces 3.

			Added in: 3.2.0
			#number
		*/
		trunc:  [n => n > 0 ? floor(n) : ceil(n), Number],
		/*d:
			(ceil: Number) -> Number

			This macro rounds the given number upward to a whole number. If a whole number is provided,
			it returns the number as-is.

			Example usage:
			`(ceil: 1.1)` produces 2.

			Added in: 1.0.0
			#number
		*/
		ceil:   [ceil, Number],
		/*d:
			(pow: Number, Number) -> Number

			This maths macro raises the first number to the power of the second number, and
			provides the result.

			Example usage:
			`(pow: 2, 8)` produces 256.

			#maths
		*/
		pow:    [mathFilter(Math.pow), [Number, Number]],
		/*d:
			(exp: Number) -> Number

			This maths macro raises Euler's number to the power of the given number, and
			provides the result.

			Example usage:
			`(exp: 6)` produces approximately 403.

			Added in: 1.0.0
			#maths
		*/
		exp:    [Math.exp, Number],
		/*d:
			(sqrt: Number) -> Number

			This maths macro produces the square root of the given number.

			Example usage:
			`(sqrt: 25)` produces 5.

			Added in: 1.0.0
			#maths
		*/
		sqrt:   [mathFilter(Math.sqrt), Number],
		/*d:
			(log: Number) -> Number

			This maths macro produces the natural logarithm (the base-e logarithm) of the given number.

			Example usage:
			`(log: (exp:5))` produces 5.

			Added in: 1.0.0
			#maths
		*/
		log:    [mathFilter(Math.log), Number],
		/*d:
			(log10: Number) -> Number

			This maths macro produces the base-10 logarithm of the given number.

			Example usage:
			`(log10: 100)` produces 2.

			Added in: 1.0.0
			#maths
		*/
		log10:  [mathFilter(Math.log10), Number],
		/*d:
			(log2: Number) -> Number

			This maths macro produces the base-2 logarithm of the given number.

			Example usage:
			`(log2: 256)` produces 8.

			Added in: 1.0.0
			#maths
		*/
		log2:   [mathFilter(Math.log2), Number],

		/*d:
			(random: Number, [Number]) -> Number

			This macro produces a whole number randomly selected between the two whole numbers, inclusive
			(or, if the second number is absent, then between 0 and the first number, inclusive).

			Example usage:
			`(random: 1,6)` simulates a six-sided die roll.

			Details:
			This is one of the features that uses Harlowe's pseudo-random number generator. If you use (seed:) at the start of the story,
			the number will be predetermined based on the seed string, and how many other random macros and features have been used before it.

			See also:
			(either:), (shuffled:), (seed:)

			Added in: 1.0.0
			#number
		*/
		random: [(a, b) => {
			let from, to;
			if (!b) {
				from = 0;
				to = a;
			} else {
				from = min(a, b);
				to = max(a, b);
			}
			to += 1;
			return ~~((State.random() * (to - from))) + from;
		}, [parseInt, Macros.TypeSignature.optional(parseInt)]],
		/*
			This method takes all of the above and registers them
			as Twine macros.
			
			By giving this JS's only falsy object key,
			this method is prohibited from affecting itself.
		*/
		""() {
			for (let key in this) {
				key && hasOwnProperty.call(this,key) && Macros.add(key, "Number", ignoreArgumentOne(this[key][0]), this[key][1]);
			}
		}
	}[""]());

	Macros.add
		/*d:
			(either: ...Any) -> Any
			
			Give this macro several values, separated by commas, and it will pick and return
			one of them randomly.
			
			Example usage:
			* `A (either: "slimy", "goopy", "slippery") puddle` will randomly be "A slimy puddle", "A goopy puddle"
			or "A slippery puddle".
			* `(go-to: (either: "Void 2", "Void 3", "Void 4"))` will send the player to one of three random passages.
			* `(text-colour:(either: red, yellow, green))` will create a (text-colour:) changer using one of the three colours.
			
			Rationale:
			There are plenty of occasions where you might want random elements in your story: a few random adjectives
			or flavour text lines to give repeated play-throughs variety, for instance, or a few random links for a "maze"
			area. For these cases, you'll probably want to simply select from a few possibilities. The (either:)
			macro provides this functionality.

			Details:
			This is one of the features that uses Harlowe's pseudo-random number generator. If you use (seed:) at the start of the story,
			the chosen value will be predetermined based on the seed string, and how many other random macros and features have been used before it.

			As with many macros, you can use the spread `...` operator to place all of the values in an array or dataset
			into (either:), and pick them randomly. `(either: ...$array)`, for instance, will choose one possibility from
			all of the array contents.

			If you want to pick two or more values randomly, you may want to use the (shuffled:) macro, and extract a subarray
			from its result.

			If you want to pick a value more reliably - for instance, to pick a value randomly, but keep using that same value
			in subsequent visits to the passage - you may want to store an (either:) result in a variable using (set:) in an earlier passage,
			and use that whenever you want to use the result.
			
			See also:
			(nth:), (random:), (shuffled:), (cond:)

			Added in: 1.0.0
			#basics 11
		*/
		("either", "Any", (_, ...args) => args[~~(State.random() * args.length)], rest(Any))

		/*d:
			(nth: Number, ...Any) -> Any

			Given a positive whole number and a sequence of values, this selects the nth value in the sequence, where n is the number. If n is
			larger than the number of items in the sequence, the selection loops around to the start.

			Example usage:
			* `(nth: visit, "Hi!", "Hello again!", "Oh, it's you!", "Hey!")` will display a different salutation, in sequence,
			on the first, second, third and fourth visits, then return to "Hi!" on the fifth visit, and so on. This uses the "visits" identifier (also known as "visit").
			* `(nth: turn, "Full Moon", "Waning", "Halfmoon", "Crescent", "New Moon", "Crescent", "Halfmoon", "Waxing")` displays a different moon phase
			based on the current turn. This uses the "turns" identifier (also known as "turn"). This could be used in a "header" or "footer" tagged passage to display a moon phase in every passage.

			Rationale:
			This macro is designed to be used in passage prose, letting you quickly display one of a varying range of phrases or sentences based
			on a certain value. In addition to being useful with story variables, it's useful with the `visit` identifier, allowing you to
			vary the text shown on each subsequent visit to a passage, with more consistent variation than if you were using (either:).

			However, you can use (nth:) with any kind of value, not just strings. For instance, `(text-colour: (nth: $wounds, white, yellow, red))`
			will produce a (text-colour:) changer that differs in colour based on the number in $wounds (up to 3).

			Details:
			You can, of course, access a specific value in a sequence using the (a:) macro and the `'s` or `of` syntax - `(a: 1,2,3)'s ($n)`
			is functionally very similar to `(nth: $n, 1, 2, 3)`, and other uses of the (nth:) macro. (nth:), however, allows the given value to
			exceed the bounds of the sequence - `(nth: 4, 1, 2, 3)` would produce 1, whereas `(a: 1,2,3)'s 4th` would produce an error.

			If you wish to use (nth:) to display very large blocks of prose, you may wish to simply put that prose in hooks, and use (if:) to selectively display
			one, such as by writing `(if: visits is 3)`.

			If you don't want the "looping" to occur - if you want to only return the final value if the number exceeds the sequence - you can combine
			this macro with (min:). `(nth: (min: 3, visit), "", "", "")`

			You may be tempted to combine this macro with (shuffled:), as in `(nth: visit, ...(shuffled: "A", "B", "C"))` - however, this will NOT
			behave any differently from just using (either:) - each visit, the (shuffled:) macro will shuffle the sequence in a different way, so you
			can't guarantee that different values will be shown.

			See also:
			(cond:), (if:), (either:)

			Added in: 3.1.0
			#basics 13
		*/
		("nth", "Any", (_, index, ...args) => {
			if (index <= 0) {
				return TwineError.create(
					"datatype",
					"(nth:)'s first value should be a positive whole number, not " + index
				);
			}
			return args[(index-1) % args.length];
		}, [parseInt, rest(Any)])
		;
});
