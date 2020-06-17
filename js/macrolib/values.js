"use strict";
define(['macros', 'utils', 'utils/operationutils', 'datatypes/colour', 'datatypes/gradient', 'internaltypes/twineerror'],
(Macros, {realWhitespace, nth, anyRealLetter}, {subset, objectName, clone, toSource}, Colour, Gradient, TwineError) => {
	/*
		Built-in value macros.
		These macros manipulate the primitive values - boolean, string, number.
	*/
	
	const
		{rest, zeroOrMore, either, optional, insensitiveSet, numberRange, positiveInteger, percent, Any } = Macros.TypeSignature,
		{max,min,round} = Math;
	
	Macros.add
		/*d:
			String data
			
			A string is just a run of text - a sequence of text characters strung together.
			
			When making a story, you'll mostly work with strings that you intend to insert into
			the passage source. If a string contains markup, then the markup will be processed when it's
			inserted. For instance, `"The ''biiiiig'' bellyblob"` will print as "The <b>biiiiig</b> bellyblob".
			Even macro calls inside strings will be processed: printing `"The (print:2*3) bears"` will print "The 6 bears".
			If you wish to avoid this, simply include the verbatim markup inside the string:``"`It's (exactly: as planned)`"`` will
			print "It's (exactly: as planned)".
			
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

			Also, you can use the `contains` and `is in` operators to see if a certain string is contained within another: `"mother"
			contains "moth"` is true, as is `"a" is in "a"`. Again, like arrays, strings have special `any` and `all` data names which
			can be used with `contains` and `is in` to check all their characters - `all of $string is not "w"` is true if the string doesn't
			contain "w", and `$string contains any of "aeiou"` is true if the string contains those five letters.
			The opposite of the `is in` operator is `is not in` - `"w" is not in $string` is another way to phrase the above.

			Here is a table listing the aforementioned operations you can perform on strings, as well as a few others.

			| Operator | Function | Example
			|---
			| `+` | Joining. | `"A" + "Z"` (is "AZ")
			| `is` | Evaluates to boolean `true` if both sides are equal, otherwise `false`. | `$name is "Frederika"`<br>`any of "Buxom" is "x"`
			| `is not` | Evaluates to boolean `true` if both sides are not equal, otherwise `false`. | `$friends is not $enemies`<br>`all of "Gadsby" is not "e"`
			| `contains` | Evaluates to boolean `true` if the left side contains the right side, otherwise `false`. | `"Fear" contains "ear"`
			| `is in` | Checking if the right string contains the left string, otherwise `false`. | `"ugh" is in "Through"`
			| `is not in` | Evaluates to `true` if the right string does not contain the left string. | `"Blood" is not in "Stone`
			| `'s` | Obtaining the character or substring at the right numeric position. | `"YO"'s 1st` (is "Y")<br>`"PS"'s (2)` (is "S")<br>`"ear"'s (a: 2,3)` (is "ar")
			| `of` | Obtaining the character at the left numeric position. | `1st of "YO"` (is "Y")<br>`(2) of "PS"` (is "S")<br>`(a: 2,3) of "ear"` (is "ar")
			| `matches` | Evaluates to boolean `true` if one side is a string and the other is an identical string or `str` or `string` | `"Contract" matches str`
			| `is a`, `is an` | Evaluates to boolean `true` if the right side is `string` or `str` and the left side is a string. | `"Contract" is a str`
			
			And, here are the data names that can be used with strings.

			| Data name | Example | Meaning
			|---
			| `1st`,`2nd`,`last`, etc. | `$str's last`, `1st of $str` | A single character at the given position in the string. This causes an error if it passes the bounds of the string, such as `"elder"'s 8th`.
			| `1stto3rd`, `4thlastto2ndlast` etc. | `"aeiou"'s 2ndto5th` | A substring containing only the characters between the given positions (such as the first, second and third for `1stto3rd`). This does NOT cause an error if it passes the bounds of the string - so `"Power"'s 3rdto9th` is `"wer"`.
			| `length` | `"Penny"'s length` | The length (number of characters) in the string.
			| `any`, `all` | `all of "aeiou" is not "y"` | Usable only with comparison operators, these allow all or any of the characters to be quickly compared.
			| Arrays of numbers, such as `(a:3,5)` | `$str's (a:1,-1)` | A substring containing just the characters at the given positions in the string.

		*/
		/*d:
			(str: ...[Number or String or Boolean or Array]) -> String
			Also known as: (string:), (text:)
			
			(str:) accepts any amount of expressions and tries to convert them all
			to a single String.
			
			Example usages:
			* `(str: $cash + 200)`
			* `(if: (str: $cash)'s length > 3)[Phew! Over four digits!]`
			* `(str: ...$arr)`
			
			Rationale:
			Unlike in Twine 1 and SugarCube, Twine 2 will only convert numbers into strings, or strings
			into numbers, if you explictly ask it to. This extra carefulness decreases
			the likelihood of unusual bugs creeping into stories (such as adding 1 and "22"
			and getting "122"). The (str:) macro (along with (num:)) is how you can convert
			non-string values to a string.
			
			Details:
			This macro can also be used much like the (print:) macro - as it evaluates to a
			string, and strings can be placed in the story source freely,
			
			If you give an array to (str:), it will attempt to convert every element
			contained in the array to a String, and then join them up with commas. So,
			`(str: (a: 2, "Hot", 4, "U"))` will result in the string "2,Hot,4,U".
			If you'd rather this not occur, you can also pass the array's individual
			elements using the `...` operator - this will join them with nothing in between.
			So, `(str: ...(a: 2, "Hot", 4, "U"))` will result in the string "2Hot4U".
			
			See also:
			(num:)

			Added in: 1.0.0
			#string
		*/
		(["text", "string", "str"],
			/*
				Since only primitives (and arrays) are passed into this, and we use
				JS's default toString() for primitives, we don't need
				to do anything more than join() the array.
			*/
			(_, ...args) => args.join(''),
		// (str: accepts a lot of any primitive)
		[zeroOrMore(Macros.TypeSignature.either(String, Number, Boolean, Array))])

		/*d:
			(source: Any) -> String

			TBW

			Added in: 3.2.0
			#string
		*/
		("source", (_, val) => toSource(val), [Any])

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
		("substring", (_, string, a, b) => subset(string, a, b),
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
		("lowercase", (_, string) => string.toLowerCase(),
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
		("uppercase", (_, string) => string.toUpperCase(),
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
		("lowerfirst", (_, string) =>
			// This has to be an entire word, to handle surrogate pairs and single characters alike.
			string.replace(new RegExp(anyRealLetter + "+"), word => {
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
		("upperfirst", (_, string) =>
			// This has to be an entire word, to handle surrogate pairs and single characters alike.
			string.replace(new RegExp(anyRealLetter + "+"), word => {
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

			The whitespace characters recognised by this macro include line breaks, non-breaking spaces, and other uncommon
			space characters.
			
			See also:
			(startcase:)

			Added in: 2.0.0
			#string
		*/
		("words", (_, string) => string.split(new RegExp(realWhitespace + "+")).filter(Boolean),
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
			An error will, of course, be produced if the number given is 0 or less, or contains a fraction.
			
			See also:
			(repeated:)

			Added in: 3.0.0
			#string
		*/
		(["str-repeated", "string-repeated"], (_, number, string) => {
			if (string.length === 0) {
				return TwineError.create("macrocall", "I can't repeat an empty string.");
			}
			return string.repeat(number);
		},
		[positiveInteger, String])
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
		(["str-reversed", "string-reversed"], (_, string) => [...string].reverse().join(''), [String])

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
			| `matches` | Evaluates to boolean `true` if one side is a number and the other is an identical number or `num` or `number` | `$bytes matches $dataUsage`
			| `is a`, `is an` | Evaluates to boolean `true` if the right side is `num` or `number` and the left side is a number. | `$credits is a num`

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
		(["num", "number"], (_, expr) => {
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
		(["rgb","rgba"], (_, ...values) => Colour.create({r: values[0], g: values[1], b: values[2], a: values[3]}),
		[numberRange(255), numberRange(255), numberRange(255), optional(percent)])

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
		(["hsl","hsla"], (_, h, s, l, a) => {
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
			* `(lch: 0.6, 80, 10)` produces <tw-colour style="background:rgb(255,11,54);"></tw-colour>.
			* `(lch: 0.6, 80, 10)'s lch's c` produces the number 80.
			* `(lch: 0.9, 15, 142, 0.6)` produces <tw-colour style="background:rgba(188,201,151,0.6);"></tw-colour>
			(a 40% transparent green).

			Rationale:

			The CIELAB colour model is considered to be more universally useful than the RGB model and its HSL representation,
			whose treatment of "lightness" doesn't properly reflect the actual perceived *luminosity* of the colours
			in question. For instance, this colour <tw-colour style="background:hsl(120,100%,50%);"></tw-colour>
			(produced by `(hsl:120,1,0.5)`) and this colour <tw-colour style="background:hsl(220,100%,50%);"></tw-colour>
			(produced by `(hsl:220,1,0.5)`) have the same HSL lightness (0.5), but one appears to the human eye to be less
			bright than the other, due to one hue being less luminous than the other.

			The lightness in LCH more closely corresponds to how the human eye perceives luminosity - `(lch:0.9,80,120)`
			produces <tw-colour style="background:hsl(86, 92.5%, 46.2%)"></tw-colour>, and `(lch:0.9,80,220)`
			produces <tw-colour style="background:hsl(196.4, 100%, 74.2%)"></tw-colour>, which, as you can see, is a pair closer in luminosity
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
			(hsl:), (rgb:), (gradient:), (complement:)

			Added in: 3.2.0
			#colour 3
		*/
		(["lch","lcha"], (_, l, c, h, a) => {
			/*
				As with (hsl:), H is silently rounded and truncated to the 0..359 range.
			*/
			h = round(h) % 360;
			if (h < 0) {
				h += 360;
			}
			return Colour.create({l, c, h, a});
		},
		[percent, numberRange(132), Number, optional(percent)])

		/*d:
			(complement: Colour) -> Colour

			When given a colour, this provides a complement to that colour.

			Example usage:
			`(complement:orange)` produces <tw-colour style="background:hsl(221, 100%, 71.1%);"></tw-colour>.

			Details:
			This is a very simple macro - the returned colour is the same as the input colour, except that its LCH hue
			(as given to the (lch:) macro) has been rotated by 180 degrees, producing a colour with equivalent chroma
			and luminosity, but an opposite hue.

			Note that, unlike (text-colour:), this will not take a string containing a CSS colour. This is because
			it operates purely on Harlowe colour data, and doesn't have a means of converting CSS colours into
			colour data.

			See also:
			(lch:)

			#colour 4
		*/
		("complement", (_, colour) => colour.LCHRotate(180),
		[Colour])

		/*d:
			(palette: String, Colour) -> Array

			When given a string specifying a palette type, and a colour, this macro produces an array containing the given colour
			followed by three additional colours that together form a palette, for use with (text-colour:), (background:), and other macros.

			Example usage:
			```
			{(set: _p to (palette: "mono", orange+black))
			(enchant: ?page, (background: _p's 1st)+(text-colour: _p's 2nd))
			(enchant: ?link, (colour: _p's 3rd)+(hover-style:(colour:_p's 4th)))}
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

			#colour 5
		*/
		("palette", (_, type, bg) => {
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
			</div>
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

			Added in: 3.1.0
			#colour 6
		*/
		(["gradient"], (_, degree, ...args) => {
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
			(cond: Boolean, Any, ...Any) -> Any

			When given a sequence of booleans (the "conditions") paired with values, this provides the first value that was
			paired with a `true` condition. This can give you one value or another based on a quick check.

			Examples:
			* `(set: $status to (cond: $cash >= 300, "stable", $cash >= 200, "lean", $cash >= 100, "skint", "broke"))`
			* `Your (cond: $wonTheRace, "gasps of triumph", "wheezes of defeat") drown out all other noise.`

			Rationale:
			While the (if:), (else:) and (else-if:) macros allow blocks of passage prose to be conditionally displayed and code to be
			conditionally run, there are plenty of situations where you'd prefer to succinctly select values inside macro
			calls, or select from multiple values, without needing to write multiple (else-if:)s or (set:)s for each possibility.
			The (cond:) macro (short for "condition") offers such utility.

			In situations where you would write something like this,
			
			`{(if: not $lostTheSword)[
			(set: $weapon to "a holy sword")
			](else: )[
			(set:$weapon to "an unholy swear-word")
			]}`

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
		("cond", (_, ...args) => {
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
			
			Computers can perform more than just mathematical tasks - they are also virtuosos in classical logic. Much as how
			arithmetic involves manipulating numbers with addition, multiplication and such, logic involves manipulating the
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
			| `is in` | Evaluates to `true` if the right side contains the left side. | `"ugh" is in "Through"`
			| `>` | Evaluates to `true` if the left side is greater than the right side. | `$money > 3.75`
			| `>=` | Evaluates to `true` if the left side is greater than or equal to the right side. | `$apples >= $carrots + 5`
			| `<` | Evaluates to `true` if the left side is less than the right side. | `$shoes < $people * 2`
			| `<=` | Evaluates to `true` if the left side is less than or equal to the right side. | `65 <= $age`
			| `and` | Evaluates to `true` if both sides evaluates to `true`. | `$hasFriends and $hasFamily`
			| `or` | Evaluates to `true` if either side is `true`. | `$fruit or $vegetable`
			| `not` | Flips a `true` value to a `false` value, and vice versa. | `not $stabbed`
			| `matches` | Evaluates to boolean `true` if one side is a boolean and the other is an identical boolean or `boolean` | `boolean matches true`
			| `is a`, `is an` | Evaluates to boolean `true` if the right side is `boolean` and the left side is a boolean. | `$wiretapped is a boolean`
			
			Conditions can quickly become complicated. The best way to keep things straight is to use parentheses to
			group things.
		*/

	/*
		JS library wrapper macros
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
		floor:  [Math.floor, Number],
		/*d:
			(round: Number) -> Number

			This macro rounds the given number to the nearest whole number - downward if
			its decimals are smaller than 0.5, and upward otherwise. If a whole number is provided,
			it returns the number as-is.

			Example usage:
			`(round: 1.5)` produces 2.

			#number
		*/
		round:  [round, Number],
		/*d:
			(ceil: Number) -> Number

			This macro rounds the given number upward to a whole number. If a whole number is provided,
			it returns the number as-is.

			Example usage:
			`(ceil: 1.1)` produces 2.

			Added in: 1.0.0
			#number
		*/
		ceil:   [Math.ceil, Number],
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

			See also:
			(either:), (shuffled:)

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
			return ~~((Math.random() * (to - from))) + from;
		}, [parseInt, Macros.TypeSignature.optional(parseInt)]],
		
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
		either: [(...args) => args[~~(Math.random() * args.length)], rest(Any)],

		/*d:
			(nth: Number, ...Any) -> Any

			Given a positive whole number and a sequence of values, this selects the nth value in the sequence, where n is the number. If n is
			larger than the number of items in the sequence, the selection loops around to the start.

			Example usage:
			`(nth: visit, "Hi!", "Hello again!", "Oh, it's you!", "Hey!")` will display a different salutation, in sequence,
			on the first, second, third and fourth visits, then return to "Hi!" on the fifth visit, and so on.

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
		nth: [(index, ...args) => {
			if (index <= 0) {
				return TwineError.create(
					"datatype",
					"(nth:)'s first value should be a positive whole number, not " + index
				);
			}
			return args[(index-1) % args.length];
		},
		[parseInt, rest(Any)]],
		
		/*
			This method takes all of the above and registers them
			as Twine macros.
			
			By giving this JS's only falsy object key,
			this method is prohibited from affecting itself.
		*/
		""() {
			Object.keys(this).forEach((key) => {
				if (key) {
					let fn = this[key][0];
					let typeSignature = this[key][1];
					/*
						Of course, the mandatory first argument of all macro
						functions is section, so we have to convert the above
						to use a contract that's amenable to this requirement.
					*/
					Macros.add(key, (_, ...rest) => fn(...rest), typeSignature);
				}
			});
		}
	}[""]());
	
});
