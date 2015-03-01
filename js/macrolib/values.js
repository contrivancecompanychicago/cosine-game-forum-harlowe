define(['utils', 'macros', 'utils/operationutils', 'internaltypes/twineerror'], function(Utils, Macros, OperationUtils, TwineError) {
	"use strict";
	/*
		Built-in value macros.
		These macros manipulate the primitive values - boolean, string, number.
	*/
	
	var
		rest = Macros.TypeSignature.rest,
		zeroOrMore = Macros.TypeSignature.zeroOrMore,
		Any = Macros.TypeSignature.Any;
	
	Macros.add
		/*d:
			(text: [Number or String or Boolean or Array]...) -> String
			Also known as: (string:)
			
			(text:) accepts any amount of expressions and tries to convert them all
			to a single String.
			
			Example usages:
			* `(text: $cash + 200)`
			* `(if: (text: $cash)'s length > 3)[Phew! Over four digits!]`
			
			Rationale:
			Unlike in Twine 1, Twine 2 will only convert numbers into strings, or strings
			into numbers, if you explictly ask it to. This extra carefulness decreases
			the likelihood of unusual bugs creeping into stories (such as adding `1` and `"22"`
			and getting `"122"`). The (text:) macro (along with (num:)) is how you can convert
			non-string values to a string.
			
			Details:
			This macro can also be used much like the (print:) macro - as it evaluates to a
			string, and strings can be placed in the story prose freely,
			
			If you give an array to (text:), it will attempt to convert every element
			contained in the array to a String, and then join them up with commas. So,
			`(text: (a: 2, "Hot", 4, "U"))` will result in the string `"2,Hot,4,U"`.
			
			See also:
			(num:)
		*/
		(["text", "string"], function print(/*variadic */) {
			/*
				Since only primitives (and arrays) are passed into this, and we use
				JS's default toString() for primitives, we don't need
				to do anything more than join() the array.
			*/
			return Array.prototype.slice.call(arguments, 1).join('');
		},
		// (text: accepts a lot of any primitive)
		[zeroOrMore(Macros.TypeSignature.either(String, Number, Boolean, Array))])

		/*d:
			(substring: String, Number, Number) -> String
			
			This macro produces a substring of the given string, cut from two *inclusive* number positions.
			
			Example usage:
			`(substring: "growl", 3, 5)` (results in the string `"owl"`).
			
			Rationale:
			If you need to examine a portion of a string between certain character positions, or
			wanted to strip off a known number of characters from either end of a string,
			this macro can be used. Simply provide it with the string itself, then the number position
			of the leftmost character of the substring, then the position of the rightmost character.
			
			Details:
			If you provide negative numbers, they will be treated as being offset from the end
			of the string - `-2` will specify the `2ndlast` character, just as 2 will specify
			the `2nd` character.
			
			If the last number given is larger than the first (for instance, in `(substring: "hewed", 4, 2)`)
			then the macro will still work - in that case returning `"ewe"` as if the numbers were in
			the correct order.
			
			See also:
			(subarray:)
		*/
		("substring", function substring(_, string, a, b) {
			return OperationUtils.subset(string, a, b);
		},
		[String, Number, Number])
		
		/*d:
			(number: String) -> Number
			Also known as: (num:)
			
			This macro converts strings to numbers by reading the digits in the entire
			string. It can handle decimal fractions and negative numbers.
			If any letters or other unusual characters appear in the number, it will
			result in an error.
			
			Example usage:
			`(num: "25")` results in the number `25`.
			
			Rationale:
			Unlike in Twine 1, Twine 2 will only convert numbers into strings, or strings
			into numbers, if you explictly ask it to using macros such as this. This extra
			carefulness decreases the likelihood of unusual bugs creeping into stories
			(such as performing `"Eggs: " + 2 + 1` and getting `"Eggs: 21"`).
			
			Usually, you will only work with numbers and strings of your own creation, but
			if you're receiving user input and need to perform arithmetic on it,
			this macro will be necessary.
			
			See also:
			(text:)
		*/
		(["num", "number"], function number(_, expr) {
			/*
				This simply uses JS's toNumber conversion, meaning that
				decimals and leading spaces are handled, but leading letters etc. are not.
			*/
			if (Number.isNaN(+expr)) {
				return TwineError.create("macrocall", "I couldn't convert " + OperationUtils.objectName(expr)
					+ " to a number.");
			}
			return +expr;
		},
		[String])
		
		/*d:
			(if: Boolean) -> Boolean
			
			This macro accepts only booleans, and returns the value as-is: true if it was true,
			and false if it was false. It's not useful at all in expressions, but its main purpose
			in Twine 2 is to be attached to hooks, as it will hide them if the value is false.
			
			Example usage:
			`(if: $legs is 8)[You're a spider!]` will show the `You're a spider!` hook if `$legs` is `8`.
			Otherwise, it is not run.
			
			Rationale:
			In any story with multiple paths or threads, where certain events could occur or not occur,
			it's common to want to run a slightly modified version of a passage reflecting the current
			state of the world. The (if:), (unless:), (else-if:) and (else:) macros let these modifications be
			switched on or off depending on variables, comparisons or calculations of your choosing.
			
			Alternatives:
			The (if:) macro is not the only attachment that can hide or show hooks! In fact,
			any variable that contains a boolean can be used in its place. For example:
			
			```
			(set: $isAWizard to $foundWand and $foundHat and $foundBeard)
			
			$isAWizard[You wring out your beard with a quick twisting spell.]
			You step into the ruined library.
			$isAWizard[The familiar scent of stale parchment comforts you.]
			```
			By storing a boolean inside `$isAWizard`, it can be used repeatedly throughout the story to
			hide or show hooks as you please.
			
			See also:
			(unless:), (else-if:), (else:)
		*/
		/*
			TODO: Should this actually be a Changer?? For instance:
			(set: $robotAdvice to (font:Consolas) + (if: $choseTheRobot))
		*/
		("if", function _if(section, expr) {
			return !!expr;
		},
		[Boolean])
		
		/*d:
			(unless: Boolean) -> Boolean
			
			This macro is the negated form of (if:): it accepts only booleans, and becomes
			the opposite boolean of the value: false if it was true, and true if it was false.
			It's not useful at all in expressions, but its main purpose in Twine 2 is to be
			attached to hooks, as it will hide them if the value is true.
			
			For more information, see the documentation of (if:).
		*/
		("unless", function unless(section, expr) {
			return !expr;
		},
		[Any])
		
		/*d:
			(else-if: Boolean) -> Boolean
			
			This macro's result changes depending on whether the previous hook in the passage
			was shown or hidden. If the previous hook was shown, then this always becomes false.
			Otherwise, it takes the passed-in boolean value and returns it. If there was no
			preceding hook before this, then an error message will be printed.
			
			It's not useful at all in expressions, but its main purpose in Twine 2 is to be
			attached to hooks, as it will hide them if the value is true.
			
			Example usage:
			```
			Your stomach makes {
			(if: $size is 'giant')[
			    an intimidating rumble!
			](else-if: $size is 'big')[
			    a loud growl
			](else:)[
			    a faint gurgle
			]}.
			```
			
			Rationale:
			If you use the (if:) macro, you may find you commonly use it in forked branches of
			prose: places where only one of a set of hooks should be displayed. In order to
			make this so, you would have to phrase your (if:) expressions as "if A happened",
			"if A didn't happen and B happened", "if A and B didn't happen and C happened", and so forth,
			in that order.
			
			The (else-if:) and (else:) macros are convenient variants of (if:) designed to make this easier: you
			can merely say "if A happened", "else, if B happened", "else, if C happened" in your code.
			
			Note:
			You may be familiar with the `if` keyword in other programming languages. Do heed this, then:
			the (else-if:) and (else:) macros need *not* be paired with (if:)! You can use (else-if:) and (else:)
			in conjunction with variable attachments, like so:
			```
			$married[You hope this warrior will someday find the sort of love you know.]
			(else-if: not $date)[You hope this warrior isn't doing anything this Sunday (because
			you've got overtime on Saturday.)]
			```
			
			See also:
			(if:), (unless:), (else:)
		*/
		("elseif", function elseif(section, expr) {
			/*
				This and (else:) check the lastHookShown expando
				property, if present.
			*/
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's nothing before this to do (else-if:) with.");
			}
			return (section.stack[0].lastHookShown === false && !!expr);
		},
		[Any])
		
		/*d:
			(else:) -> Boolean
			
			This is a convenient limited variant of the (else-if:) macro. It will simply become
			true if the preceding hook was hidden, and false if it was shown.
			If there was no preceding hook before this, then an error message will be printed.
			
			Rationale:
			After you've written a series of hooks guarded by (if:) and (else-if:), you'll often have one final
			branch to show, when none of the above have been shown. (else:) is the "none of the above" variant
			of (else-if:), which needs no boolean expression to be provided. It's essentially the same as
			`(else-if: true)`, but shorter and more readable.
			
			For more information, see the documentation of (else-if:).
			
			Note:
			Due to a mysterious quirk, it's possible to use multiple (else:) macro calls in succession:
			```
			$isUtterlyEvil[You suddenly grip their ankles and spread your warm smile int​o a searing smirk.]
			(else:​)[In silence, you gently, reverently rub their soles.]
			(else:​)[Before they can react, you unleash a typhoon of tickles!]
			(else:​)[They sigh contentedly, filling your pious heart with joy.]
			```
			This usage can result in a somewhat puzzling passage prose structure, where each (else:) hook
			alternates between visible and hidden depending on the first such hook. So, it is best avoided.
		*/
		("else", function _else(section) {
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's nothing before this to do (else:) with.");
			}
			return section.stack[0].lastHookShown === false;
		},
		null)
		
		/*
			(first-nonzero:) returns the leftmost non-zero number of the numbers given to it.
			It's designed to serve the same purpose as JS's defaulting OR "||" operator.
		*/
		(["nonzero", "first-nonzero"], function first_nonzero(/*variadic*/) {
			return Array.from(arguments).slice(1).filter(Boolean)[0] || false;
		},
		[rest(Number)])
		
		/*
			(first-nonempty:), conversely, returns the leftmost value given to it which is not an empty collection.
		*/
		(["nonempty", "first-nonempty"], function first_nonempty(/*variadic*/) {
			/*
				This and (else:) check the lastHookShown expando
				property, if present.
			*/
			return Array.from(arguments).slice(1).filter(function(e) {
				if (OperationUtils.isSequential(e)) {
					return e.length > 0;
				}
				return e.size > 0;
			})[0] || false;
		},
		[rest(Macros.TypeSignature.either(String, Array, Map, Set))]);

	/*
		JS library wrapper macros
	*/
	
	/*
		Filter out NaN and Infinities, throwing an error instead.
		This is only applied to functions that can create non-numerics,
		namely log, sqrt, etc.
	*/
	function mathFilter (fn) {
		return function (/*variadic*/) {
			var result = fn.apply(this, arguments);
			if (typeof result !== "number" || isNaN(result)) {
				return TwineError.create("macrocall", "This mathematical expression doesn't compute!");
			}
			return result;
		};
	}
	
	/*
		Choose one argument. Can be used as such: (either: "pantry", "larder", "cupboard" )
	*/
	function either(/*variadic*/) {
		return arguments[~~(Math.random() * arguments.length)];
	}
	
	({
		/*
			Wrappers for Date
		*/

		// The current weekday, in full
		weekday: [function () {
			return ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'][new Date().getDay()] + "day";
		},
		// 0 args
		null],

		// The current day number
		monthday: [function () {
			return new Date().getDate();
		},
		null],

		// The current time in 12-hour hours:minutes format.
		currenttime: [function () {
			var d = new Date(),
				am = d.getHours() < 12;

			return d.getHours() % 12 + ":" + d.getMinutes() + " " + (am ? "A" : "P") + "M";
		},
		null],

		// The current date in DateString format (eg. "Thu Jan 01 1970").
		currentdate: [function () {
			return new Date().toDateString();
		},
		null],

		/*
			Wrappers for basic Math
			(includes ES6 polyfills)
		*/

		min: [Math.min, rest(Number)],
		max: [Math.max, rest(Number)],
		abs: [Math.abs, Number],
		sign: [Math.sign, Number],
		sin:    [Math.sin, Number],
		cos:    [Math.cos, Number],
		tan:    [Math.tan, Number],
		floor:  [Math.floor, Number],
		round:  [Math.round, Number],
		ceil:   [Math.ceil, Number],
		pow:    [Math.pow, Number],
		exp:    [Math.exp, Number],
		sqrt:   [mathFilter(Math.sqrt), Number],
		log:    [mathFilter(Math.log), Number],
		log10:  [mathFilter(Math.log10), Number],
		log2:   [mathFilter(Math.log2), Number],
		
		/*
			Basic randomness
		*/

		/*
			This function returns a random integer from a to b inclusive.
		*/
		random: [function random(a, b) {
			var from, to;
			if (!b) {
				from = 0;
				to = a;
			} else {
				from = Math.min(a, b);
				to = Math.max(a, b);
			}
			to += 1;
			return ~~((Math.random() * (to - from))) + from;
		}, [Number, Number]],
		
		either: [either, rest(Any)],

		/*
			Wrappers for Window
		*/

		// Keep "undefined" from being the default text.
		alert: [function (text) {
			return window.alert(text || "");
		},
		String],
		prompt: [function (text, value) {
			return window.prompt(text || "", value || "") || "";
		},
		String, String],
		confirm: [function (text) {
			return window.confirm(text || "");
		},
		String],
		openURL: [window.open, String],
		reload: [window.location.reload.bind(window.location), null],
		gotoURL: [window.location.assign.bind(window.location), String],
		pageURL: [function () {
			return window.location.href;
		}, null],
		
		/*
			This method takes all of the above and registers them
			as Twine macros.
			
			By giving this JS's only falsy object key,
			this method is prohibited from affecting itself.
		*/
		"": function() {
			Object.keys(this).forEach(function(key) {
				var fn, typeSignature;
				
				if (key) {
					fn = this[key][0],
					typeSignature = this[key][1];
					
					/*
						Of course, the mandatory first argument of all macro
						functions is section, so we have to convert the above
						to use a contract that's amenable to this requirement.
					*/
					Macros.add(key, function(/* variadic */) {
						/*
							As none of the above actually need or use section,
							we can safely discard it.
							
							Aside: in ES6 this function would be:
							(section, ...rest) => this[key](...rest)
						*/
						return fn.apply(0, Array.from(arguments).slice(1));
					}.bind(this), typeSignature);
				}
			}.bind(this));
		}
	}[""]());
	
});
