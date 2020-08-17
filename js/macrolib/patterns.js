"use strict";
define(['jquery', 'macros', 'utils', 'utils/operationutils', 'datatypes/datatype', 'datatypes/typedvar', 'internaltypes/twineerror'],
($, Macros, {anyRealLetter, anyUppercase, anyLowercase, anyCasedLetter, realWhitespace, impossible}, {objectName, toSource}, Datatype, TypedVar, TwineError) => {

	const {rest, either, nonNegativeInteger} = Macros.TypeSignature;
	const {assign, create} = Object;
	const PatternSignature = rest(either(String, Datatype, TypedVar));
	/*
		Patterns are datatypes which match strings based on an internal RegExp.
	*/
	/*
		The base function for constructing Pattern datatypes, using the Pattern constructor's args, and a function to make the
		internal RegExp using the args (which the function preprocesses to ensure they're all capable of being turned into RegExps).
	*/
	const createPattern = ({name, fullArgs, args, makeRegExpString, insensitive=false, canContainTypedVars = true, canBeUsedAlone = true}) => {
		/*
			"fullArgs" includes non-pattern arguments like (p-many:)'s min and max. args, which is optionally provided, does not.
		*/
		const patternArgs = args || fullArgs;
		/*
			Convert the args into their regexp string representations, if that's possible.
		*/
		const compiledArgs = patternArgs.map(function mapper(pattern) {
			/*
				If this pattern has a TypedVar in it (i.e. it's a destructuring/capture pattern) then
				convert it into a RegExp capture, so that RegExp.exec() can capture the matched substring.
			*/
			if (TypedVar.isPrototypeOf(pattern)) {
				if (!canContainTypedVars) {
					return TwineError.create("operation",
						"Optional string patterns, like (" + name + ":)" + (name === "p-many" ? " with min 0" : '') + ", can't have typed variables inside them.");
				}
				const subPattern = mapper(pattern.datatype);
				return TwineError.containsError(subPattern) ? subPattern : "(" + subPattern + ")";
			}
			if (Datatype.isPrototypeOf(pattern)) {
				/*
					A datatype is a valid argument for a Pattern macro if it's either another Pattern,
					or a String-related datatype.
				*/
				if (pattern.regExp) {
					/*
						If this is a recompilation of a sensitive pattern into an insensitive one, then convert this argument
						into an insensitive one, too. (Note that the insensitive() call won't recompile an already-insensitive pattern.)
					*/
					return insensitive ? pattern.insensitive().regExp : pattern.regExp;
				}
				const pName = pattern.name;
				/*
					Spread datatypes represent "zero or more" values, in keeping with how they behave when used for custom macro parameters.
				*/
				const rest = pattern.rest ? "*" : "";
				/*
					All of these, unfortunately, need to be manually aligned with their implementation in datatype.js.
					Fortunately, both implementations rely on the same RegExp strings in Utils.
				*/
				if (pName === "alnum") {
					return anyRealLetter + rest;
				}
				if (pName === "whitespace") {
					return realWhitespace + rest;
				}
				if (pName === "uppercase") {
					/*
						(p-ins:) forces both of these case-sensitive datatypes to degrade to just anycase!! Yeah!
					*/
					return (insensitive ? anyCasedLetter : anyUppercase) + rest;
				}
				if (pName === "lowercase") {
					return (insensitive ? anyCasedLetter : anyLowercase) + rest;
				}
				if (pName === "digit") {
					return "\\d" + rest;
				}
				if (pName === "newline") {
					return "(?:\\r|\\n|\\r\\n)" + rest;
				}
				if (pName === "str") {
					/*
						"string" is the only one of these datatypes which doesn't strictly refer to a single character, but instead to basically
						anything until a more specific pattern is encountered.
					*/
					return ".*?";
				}
				if (['even','odd','int','num'].includes(pName)) {
					return TwineError.create("datatype", "Please use string datatypes like 'digit' in (" + name + ":) instead of number datatypes.");
				}
				/*
					If this datatype isn't one of the above, produce an error. This is left in the resulting mapped array, to be dredged out just afterward.
				*/
				return TwineError.create("datatype", "The (" + name + ":) macro must only be given string-related datatypes, not " + objectName(pattern) + ".");
			}
			/*
				If it's a string, then it's user-authored, so it needs to have all RegExp-specific
				characters escaped in it.
			*/
			if (typeof pattern === "string") {
				pattern = pattern.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');
				/*
					This is where (p-ins:) is implemented - this line, which turns every uppercase or lowercase character intoa RegExp character class for both.
				*/
				if (insensitive) {
					pattern = pattern.replace(RegExp("(" + anyUppercase + "|" + anyLowercase + ")", 'g'), a => "[" + a.toUpperCase() + a.toLowerCase() + "]");
				}
				return pattern;
			}
			/*
				Each Pattern macro has a type signature of either(String,Datatype) in some configuration, so this really should be impossible.
			*/
			impossible('createPattern', 'mapper() was given a non-string non-datatype ' + pattern);
			return '';
		});
		/*
			Dredge out any Datatype type errors.
		*/
		let error;
		if ((error = TwineError.containsError(compiledArgs))) {
			return error;
		}
		const regExp = makeRegExpString(compiledArgs);

		const ret = assign(create(Datatype), {
			name, regExp,
			/*
				The (p-ins:) macro performs a somewhat drastic transformation on its inputs: all of them are converted to
				case-insensitive versions. This is done using the following brute-force method, whereby a pattern recompiles itself
				and all of its arguments (if necessary).
			*/
			insensitive: () => insensitive ? ret : createPattern({
				name, fullArgs,
				args: patternArgs.map(p => Datatype.isPrototypeOf(p) && typeof p.insensitive === "function" ? p.insensitive() : p),
				makeRegExpString, insensitive:true, canContainTypedVars, canBeUsedAlone
			}),
			/*
				Recursive method, used only by destructure(), which retrieves every TypedVar (and thus each RegExp capture)
				in this pattern, including inside sub-patterns.
			*/
			typedVars() {
				return patternArgs.reduce((a,pattern) => {
					/*
						It's important that captures (TypedVars) are found in the exact order that they're
						returned by RegExp#exec(). For something like /(?:(a)(b)|(c)|(?:(d(e))|(f)))/,
						the order is "ab","c","de","e","f" - which means that nested captures occur
						immediately after their containing captures.
					*/
					if (TypedVar.isPrototypeOf(pattern)) {
						a = a.concat(
							/*
								You may notice a conundrum inherent in (p-ins:) combining with typed vars -
								if a var is bound to, say, uppercase-type, but it's inside a (p-ins:), is it actually
								uppercase-type? The intuitive solution is simply to convert all of the TypedVars inside
								an insensitive pattern into versions whose type is wrapped in (p-ins:).
							*/
							insensitive ? TypedVar.create(
								createPattern({
									name:"p-ins", fullArgs:[pattern.datatype],
									insensitive: true, makeRegExpString: subargs => subargs.join('')}),
								pattern.varRef
							) :
							pattern
						);
						pattern = pattern.datatype;
					}
					if (Datatype.isPrototypeOf(pattern) && typeof pattern.typedVars === "function") {
						a = a.concat(pattern.typedVars());
					}
					return a;
				},[]);
			},
			/*
				AssignmentRequest.destructure() delegates the responsibility of destructuring string patterns to this
				method, which runs the internal RegExp and extracts matches, returning { dest, src, value }
				objects identical to that which AssignmentRequest.destructure() internally uses.
			*/
			destructure(value) {
				if (typeof value !== "string") {
					return [TwineError.create("operation", "I can't de-structure " + objectName(value) + " into "
					+ this.TwineScript_ToSource() + " because it isn't a string.")];
				}
				/*
					If this pattern doesn't have any typedVars at all (i.e. it isn't a destructuring pattern at all) then
					simply return [], and let AssignmentRequest.destructure() produce an error on its own.
				*/
				const typedVars = this.typedVars();
				if (!typedVars.length) {
					return [];
				}
				/*
					Unfortunately, this standard destructure match error has to be replicated here.
				*/
				const results = (RegExp("^" + (this.rest ? "(?:" : "") + regExp + (this.rest ? ")*" : "") + "$").exec(value) || []).slice(1);
				if (!results.length) {
					return [TwineError.create("operation", "I can't de-structure " + objectName(value) + " because it doesn't match the pattern "
						+ this.TwineScript_ToSource() + ".")];
				}
				/*
					Because every "optional match" pattern macro forbids TypedVars in it, we can safely assume every match lines up
					with a TypedVar, and simply convert them like so.

					Note that in the case of a 0-character match, like "(p-opt:'A')-type _a", we must default the value to the empty string
					ourselves rather than leaving it as undefined.
				*/
				return results.map((r,i) => typedVars[i] && ({ dest: typedVars[i], value: r || '', src: undefined, })).filter(Boolean);
			},
			TwineScript_IsTypeOf(value) {
				if (!canBeUsedAlone) {
					return TwineError.create("operation", "A (" + name + ":) datatype must only be used with a (p:) macro.");
				}
				return typeof value === "string" && !!value.match("^" + (this.rest ? "(?:" : "") + regExp + (this.rest ? ")*" : "") + "$");
			},
			/*
				String patterns used as custom macro arg types must, in the absence of anything more sophisticated,
				overload the 'range' type signature object to perform type checks.
			*/
			TwineScript_toTypeSignatureObject() {
				return { pattern: 'range', name, range: e => this.TwineScript_IsTypeOf(e) };
			},
			/*
				The fullArgs are given unto this function entirely to allow ToSource to access them.
			*/
			TwineScript_ToSource: () => "(" + name + ":" + fullArgs.map(toSource) + ")",
		});
		/*
			Replacing the TwineScript_ObjectName getter on Datatype requires the following finesse.
			This could be avoided if string patterns were an actual subclass of Datatype, though...
		*/
		Object.defineProperty(ret, 'TwineScript_ObjectName', { get() {
			return "a (" + name + ":)" + " datatype";
		}});
		return ret;
	};

	Macros.add
		/*d:
			(p: ...String or Datatype) -> Datatype
			Also known as: (pattern:)

			Creates a string pattern, a special kind of datatype that can match complex string structures. The pattern matches the entire sequence of strings or datatypes
			given, in order.

			Example usage:
			* `"Rentar Ihrno" matches (p:(p-many:1,6,alnum),whitespace,(p-many:1,6,alnum))` checks if the string contains 1-6 alphanumeric letters,
			followed by a space, followed by 1-6 alphanumeric letters.
			* `(set:$upperFirst to (p:uppercase,(p-many:lowercase)))(set:$upperFirst-type $name to "Edgar")` creates a custom datatype, $upperFirst, and
			creates a typed variable using it, called $name.
			* `(set: (p:str, (p-many:(p-either:'St','Rd','Ln','Ave','Way')-type _roadTitle)) to $roadName)` uses de-structuring to extract either "St", "Rd", "ln", "Ave", or "Way",
			from the end of the $roadName string, putting it in _roadTitle, while producing an error if such an ending isn't in $roadName.
			* `(p:"$", digit, ...digit) matches "$21000"` checks if the right side is a string consisting of "$" followed by one or more digits.

			Rationale:

			The `contains` operator is useful for searching strings for words, characters or substrings, but it's noticeably limited when you
			want to make more sophisticated queries about a string's contents. For instance, what if you want to check if a string begins with any uppercase
			letter, followed by only lowercase letters? Or, what if you want to check if a string contains any words inside quotation `"` marks? You could design
			and write a cumbersome (loop:) hook to compute these using many `contains` checks, but there's a much easier way to do so - rather than check if
			a string `contains` a substring, check if it `matches` a pattern that precisely describes what a valid substring should look like.

			A suite of macros, starting with the (p:) macro, are available to construct string patterns. Give the (p:) macro an ordered sequence of strings (like `"Mr."`)
			or datatypes (like `whitespace`, `alnum`, `newline`, `uppercase`, `lowercase`, or other string pattern macro calls), and it will produce a datatype that, when used with `matches` or `is a`,
			will match a string that exactly fits the given sequence. `(p: "The", (p-many:whitespace), "End")` will match the strings "The End", "The  End", "The   End", and so forth.
			`(p: uppercase, "1", (p-opt:"A"))` will match "A1", "B1", "A1A", "C1", and so forth. Spread datatypes can be used to represent zero or more of a given string
			datatype: `...uppercase` means "zero or more uppercase letters", `...whitespace` means "zero or more whitespace characters" and so forth - though datatypes
			that represent multiple characters, such as `...str`, is the same as `str`.
			
			You may notice a similarity between these patterns and array/datamap patterns. Arrays and datamaps can be inspected using the `matches` operator when
			combined with datatypes and the data structure macros (a:) and (dm:) - `(a:(a:num,num),(a:num,num)) matches $array`
			checks that the array in $array contains two arrays that each contain two numbers, all in one line of code. You can't do this with strings, though,
			because a string can only hold characters, not arbitrary data like datatypes. So, these macros provide that functionality for strings, too.

			Additionally, array/datamap patterns can be used with TypedVars inside (set:) or (put:) to de-structure values into multiple variables at once, such as in `(set: (a: _x, _y) to $coordinate)`.
			String patterns can be used to de-structure as well. For instance, `(set: (p: (p-opt:"Dr. "), (p: alnum-type _firstName, whitespace, alnum-type _lastName)-type _fullName) to "Dr. Iris Cornea")`
			creates three variables, _firstName, _lastName and _fullName, from a single string, and sets them to "Iris", "Cornea", and "Iris Cornea", respectively. (See the (set:) article for a greater
			explanation of de-structuring).

			Details:

			When (p:), and other macros like (p-many:), are given multiple values, it is treated as a **sequence**. Strings are matched to sequences as follows: first, Harlowe checks if the start of the string matches the
			first value in the pattern. If it matches, then the part of the start that matched the first value is excluded, and Harlowe then checks if the start of the remaining portion of
			the string matches the next value in the pattern. When every part of the string has been matched to every one of the values, then the whole string is considered a match for the whole
			sequence.

			For example, in the case of `"egg orb" matches (p:"egg",whitespace,"orb")`:
			0. Harlowe checks if the start of `"egg orb"` matches `"egg"`. It does, so the portion that matches `"egg"` is excluded, leaving `" orb"`.
			0. Harlowe checks if the start of `" orb"` matches `whitespace`. It does, so the portion that matches `whitespace` is excluded, leaving `"orb"`.
			0. Harlowe checks if the start of `"orb"` matches `"orb"`. It does. As this means every part of the string has been matched to every one of the values, the entire
			statement `"egg orb" matches (p:"egg",whitespace,"orb")` evaluates to boolean `true`.

			By default, datatypes produced with this macro (string patterns) will only match strings that entirely match the pattern. `(p: ":", (p-opt:"-"),")")` will match `":)"` and `":-)"`,
			but not match `" :-) "` or `"Sorry :)"`. You can use the `str` datatype inside (p:) to represent any amount of unimportant characters. Thus, by rewriting the preceding pattern as
			`(p:str, ":", (p-opt:"-"),")", str)`, you can produce a datatype that matches any string that contains ":)" or ":-)" anywhere inside it. Alternatively, `(p:":", (p-opt:"-"),")", str)`
			can match just strings that start with ":)" or ":-)", and `(p:str, ":", (p-opt:"-"),")")` for strings that end with ":)" or ":-)". If you'd rather only compare the start or end of strings in
			a case-by-case basis, you can instead take the pattern and see if it `matches` the `start` or `end` of those strings - `(p: ":", (p-opt:"-"),")") matches "Sorry :)"'s end`.

			Don't forget that you can save individual parts of a string pattern into variables, and use them to construct larger patterns afterward! For instance,
			`(set: $HTTP to (p: "http", (p-opt:"s"), "://"))` sets $HTTP to a string pattern that matches "http://" or "https://". With that, you can write
			checks like `(if: $userURL matches (p: $HTTP, "lightside.college/", str))` and `(if: $userURL matches (p:$HTTP, "sunglasses.darkweb/", str))` later in your story, without
			needing to rewrite the $HTTP pattern each time.

			See also:
			(p-either:), (p-opt:), (p-many:), (p-not-before:)

			Added in: 3.2.0.
			#patterns 1
		*/
		(["p","pattern"],
			(_, ...fullArgs) => createPattern({
				name:"p", fullArgs, makeRegExpString: subargs => subargs.join('')
			}),
		PatternSignature)
		/*d:
			(p-either: ...String or Datatype) -> Datatype
			Also known as: (pattern-either:)

			Creates a string pattern that matches either of the single strings or datatypes given.

			Example usage:
			* `"Lovegyre" matches (p: (p-either: ...$emotions), "gyre")` checks if the string is any of the strings in $emotions, followed by "gyre".
			* `(set: (p-either:"","Hugged","Charmed","Dazed")-type $statusEffect to "")` creates a variable that can only be set to either
			"Hugged", "Charmed", "Dazed" or the empty string.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			Unlike the other macros, each of this macro's arguments represents a different possible match, **not** parts of a single sequence. If
			you need a possibility to be a sequence of values, you can nest the (p:) macro inside this one, such as in `(p-either: (p:str," Crystal"), "N/A")`.

			You can use this macro, along with the spread `...` operator, to succinctly check if the string matches one in a set of characters. For example, to
			check if a string is a single bracket character, you can write `(p-either: ..."[](){}")`, where each bracket character is in a string that gets spread
			out into single characters.

			Note that while you can use this as the datatype of a TypedVar (as shown previously), you can't nest TypedVars inside this - `(set: (p:"A",(p-either:digit-type _d, "X")) to "AX")`
			will cause an error, because it's ambiguous whether, when the `digit-type _d` TypedVar doesn't match, the variable _d should not be set at all (which
			is rather counterintuitive) or if it should be set to an empty string (which contradicts its stated `digit-type` restriction anyway).

			See also:
			(p:), (p-ins:), (p-opt:), (p-many:)

			Added in: 3.2.0.
			#patterns 2
		*/
		(["p-either","pattern-either"],
			(_, ...fullArgs) => createPattern({
				name: "p-either", fullArgs, canContainTypedVars: false,
				makeRegExpString: subargs => "(?:" + subargs.join('|') + ")"
			}),
		PatternSignature)
		/*d:
			(p-opt: ...String or Datatype) -> Datatype
			Also known as: (pattern-opt:), (p-optional:), (pattern-optional:)

			Creates a string pattern that either matches the sequence of strings or datatypes given, or matches the empty string.

			Example usage:
			* `(p-opt:"Default Name")` matches either the empty string, or the string "Default Name".
			* `(p: $upperFirst, (p-opt:"?"))` matches strings that match the string pattern in $upperFirst, but which might also end in a question mark.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			When you use this in a de-structuring pattern in (set:) or (put:), such as `(p-opt:'Lord')-type _isLord`, and the optional pattern doesn't match,
			the variable will be set to the empty string "".

			Note that while you can use this as the datatype of a TypedVar (as shown previously), you can't nest TypedVars inside this, because it is an optional match - `(set: (p:"A",(p-opt:digit-type _d)) to "A")`
			will cause an error, because it's ambiguous whether, whenever the enclosing (p-opt:) doesn't match, the variable _d should not be set at all (which
			is rather counterintuitive) or if it should be set to an empty string (which contradicts its stated `digit-type` restriction anyway).

			See also:
			(p:), (p-ins:), (p-either:), (p-many:)

			Added in: 3.2.0.
			#patterns 3
		*/
		(["p-opt","pattern-opt","p-optional","pattern-optional"],
			(_, ...fullArgs) => createPattern({
				name: "p-opt", fullArgs, canContainTypedVars: false,
				makeRegExpString: subargs => "(?:" + subargs.join('') + ")?"
			}),
		PatternSignature)
		/*d:
			(p-many: [Number], [Number], ...String or Datatype) -> Datatype
			Also known as: (pattern-many:)

			Creates a string pattern that matches the given sequence of strings and datatypes, repeated a given minimum and maximum number of times - or,
			if these aren't provided, repeated any number of times.

			Example usage:
			* `(p: uppercase, (p-many:lowercase))` produces a datatype that matches strings only if they consist of an uppercase letter followed by one or more lowercase letters.
			* `(set: (p-many:3,12,alnum)-type $weakPassword to "ABC123")` creates a variable that is only able to hold strings that consist of between 3 and 12
			alphanumeric characters.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			When this macro's output is given to (p:), it will attempt to match (and thus exclude) the greatest permitted amount of repetitions in the string.
			So, `(p:'g',(p-many:whitespace,'r'),'b')` will match the string `'g r r r r r rb'` because the (p-many:) macro will match " r r r r r r", instead
			of potentially only matching " r".

			The first optional number represents the minimum number of times the sequence is permitted to repeat within the string. The second optional
			number represents the maximum number of times. If only the minimum number is present, then it will also serve as the maximum number,
			limiting the matched strings to only those that match the sequence exactly that many times.

			If no optional numbers are given, the default minimum number of matches is 1. If you want the possibility of matching zero occurrences
			(i.e. this pattern is optional) then either combine this with (p-opt:), or (preferably) simply give the number 0 as the first argument.

			If the maximum number is smaller than the minimum number, or if either of them are negative or fractional, an error will be
			produced.

			When you use this in a de-structuring pattern in (set:) or (put:) with a minimum of 0, such as `(p-many: 0, newline)-type _newlines`, and
			there are zero matches, the variable will be set to the empty string "".

			Note that while you can use this as the datatype of a TypedVar (as shown previously), you can't nest TypedVars inside this if the minimum is 0, because it then becomes an
			optional match - `(set: (p:"A",(p-many:0, 8, digit-type _d)) to "A")` will cause an error, because it's ambiguous whether, whenever the enclosing (p-many:)
			matches zero occurrecnes, the variable _d should not be set at all (which is rather counterintuitive) or if it should be set to an empty string
			(which contradicts its stated `digit-type` restriction anyway).

			See also:
			(p:), (p-ins:), (p-either:), (p-opt:), (p-many:)

			Added in: 3.2.0.
			#patterns 4
		*/
		(["p-many","pattern-many"],
			(_, ...args) => {
				const fullArgs = args.slice();
				let min, max;
				/*
					This macro accepts optional front numbers, which are used for min and max values of the RegExp string.
				*/
				if (typeof args[0] === 'number') {
					min = args.shift();
					max = (typeof args[0] === 'number') ? args.shift() : Infinity;
				}
				if (max !== undefined && max < min) {
					return TwineError.create('datatype', 'The (p-many:) macro needs to be given string patterns, not just min and max numbers.');
				}
				/*
					Due to this macro's type signature being a little complicated, these checks need to be made manually after
					finding the min and max values.
				*/
				if (!args.length) {
					return TwineError.create('datatype', 'The (p-many:) macro needs to be given string patterns, not just min and max numbers.');
				}
				const bad = args.find(arg => typeof arg !== 'string' && !(Datatype.isPrototypeOf(arg)) && !(TypedVar.isPrototypeOf(arg)));
				if (bad) {
					return TwineError.create('datatype', 'This (p-many:) macro can only be given a min and max number followed by datatypes or strings, but was also given ' + objectName(bad) + ".");
				}
				return createPattern({
					name: "p-many", args, fullArgs, canContainTypedVars: min > 0,
					makeRegExpString: subargs => "(?:" + subargs.join('') + ")"
						+ (min !== undefined ? "{" + min + (max === Infinity ? "," : max !== min ? "," + max : '') + "}" : '+')
				});
			},
		[rest(either(nonNegativeInteger, String, Datatype, TypedVar))])
		/*
			(p-ins:)
			Also known as: (p-insensitive:), (pattern-ins:), (pattern-insensitive:)

			Creates a string pattern that matches the sequence of strings or datatypes given, case-insensitively.

			Example usage:
			* `"Hocus pocus" matches (p-ins:"hocus", (p-opt:" "), "pocus")` checks if the magic words match the pattern, regardless of any letter's capitalisation.
			* `(set: (p:(p-ins:"SCP-"), ...digit-type _codeNum) to "Scp-991")` uses destructuring to extract "991" from the right-side string, checking if it matched
			the given prefix case-insensitively first.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			When other patterns are given to this, they are treated as if they are case-insensitive. This means that, if `(p:"Opus ", (p-either:digit,"Magnum"))` is stored in the variable
			$opus, then `(p-ins: $opus)` will create a datatype that can match "opus 1", "OPUS 2", "Opus Magnum" and so forth, even though $opus can't.

			When the two case-sensitive datatypes `uppercase` and `lowercase` are given to this, they are treated as if they are `anycase`.

			When typed variables are used in string patterns, such as in `(p-ins: "Side ", (p-either:"A","B")-type _letter)`, the variable's type may sometimes appear to contradict the
			case-insensitivity imposed by an enclosing (p-ins:) - if that pattern is matched with "side a", then can "a" be stored in a `(p-either:"A","B")-type` variable?.
			Harlowe resolves this as follows: when a typed variable is placed inside (p-ins:), its type is wrapped in a (p-ins:) itself. So, _letter in the preceding example
			is bound to `(p-ins: (p-either:"A","B"))-type` data, instead of just `(p-either:"A","B")-type` data.

			See also:
			(p:), (p-opt:), (p-many:), (p-either:)

			Added in: 3.2.0.
			#patterns 5
		*/
		(["p-ins","pattern-ins","p-insensitive","pattern-insensitive"],
			(_, ...fullArgs) => createPattern({
				name:"p-ins", fullArgs,
				insensitive: true, makeRegExpString: subargs => subargs.join(''),
			}),
			PatternSignature)
		;
});
