"use strict";
define(['macros', 'utils', 'utils/operationutils', 'datatypes/lambda', 'datatypes/datatype', 'datatypes/typedvar', 'internaltypes/twineerror', 'internaltypes/varscope'],
(Macros, {anyRealLetter, anyUppercase, anyLowercase, anyCasedLetter, realWhitespace, impossible}, {objectName, toSource}, Lambda, Datatype, TypedVar, TwineError, VarScope) => {

	const {rest, either, optional, nonNegativeInteger} = Macros.TypeSignature;
	const {assign, create} = Object;
	const PatternSignature = rest(either(String, Datatype, TypedVar));
	/*
		Patterns are datatypes which match strings based on an internal RegExp.
	*/
	/*
		The base function for constructing Pattern datatypes, using the Pattern constructor's args, and a function to make the
		internal RegExp using the args (which the function preprocesses to ensure they're all capable of being turned into RegExps).
	*/
	const createPattern = ({name, fullArgs, args, makeRegExpString = subargs => subargs.join(''), insensitive=false, canContainTypedVars = true, canBeUsedAlone = true, canContainTypedGlobals = true}) => {
		/*
			"fullArgs" includes non-pattern arguments like (p-many:)'s min and max. args, which is optionally provided, does not.
		*/
		const patternArgs = args || fullArgs;
		/*
			Convert the args into their regexp string representations, if that's possible.

			Notice that this map of typed var names is used across all recursive mapper() calls.
		*/
		const typedVarNames = create(null);
		const compiledArgs = patternArgs.map(function mapper(pattern) {
			/*
				If this pattern has a TypedVar in it (i.e. it's a destructuring/capture pattern) then
				convert it into a RegExp capture, so that RegExp.exec() can capture the matched substring.
			*/
			if (TypedVar.isPrototypeOf(pattern)) {
				const {varRef} = pattern;
				if (!canContainTypedVars) {
					return TwineError.create("operation",
						`Optional string patterns, like (${name}:)${name === "p-many" ? " with a minimum of 0 matches" : ''}, can't have typed variables inside them.`);
				}
				/*
					If typed globals aren't allowed, check that it's a temp variable without a property access.
				*/
				if (!canContainTypedGlobals && !VarScope.isPrototypeOf(varRef.object)) {
					return TwineError.create("operation", `Only typed temp variables can be used in patterns given to (${name}:)`);
				}
				/*
					Check that this TypedVar name isn't repeated.
				*/
				const varName = varRef.getName();
				if (varName in typedVarNames) {
					return TwineError.create("operation", `There's already a typed temp variable named _${varName} inside this (${name}:) call.`);
				}
				typedVarNames[varName] = true;

				const subPattern = mapper(pattern.datatype);
				return TwineError.containsError(subPattern) ? subPattern : "(" + subPattern + ")";
			}
			/*
				A datatype is a valid argument for a Pattern macro if it's either another Pattern,
				or a String-related datatype.
			*/
			if (Datatype.isPrototypeOf(pattern)) {
				/*
					The canContainTypedVars constraint must be obeyed for all sub-patterns of this pattern.
				*/
				if ((!canContainTypedVars || !canContainTypedGlobals) && typeof pattern.typedVars === "function") {
					const typedVars = pattern.typedVars();
					if (!canContainTypedVars && typedVars.length) {
						return TwineError.create("operation",
							`(${name}:) can't have typed variables inside its pattern.`);
					}
					/*
						If typed globals aren't allowed, check that it's a temp variable without a property access.
					*/
					if (!canContainTypedGlobals && typedVars.some(v => !VarScope.isPrototypeOf(v.varRef.object))) {
						return TwineError.create("operation", `Only typed temp variables can be used in patterns given to (${name}:)`);
					}
				}
				if (pattern.regExp) {
					return (pattern.rest ? "(?:" : "") + (
						/*
							If this is a recompilation of a sensitive pattern into an insensitive one, then convert this argument
							into an insensitive one, too. (Note that the insensitive() call won't recompile an already-insensitive pattern.)
						*/
						insensitive ? pattern.insensitive().regExp : pattern.regExp
					) + (pattern.rest ? ")*" : "");
				}
				const pName = pattern.name;
				/*
					Spread datatypes represent "zero or more" values, in keeping with how they behave when used for custom macro parameters.
				*/
				const rest = pattern.rest ? "*" : "";
				/*
					All of these need to be manually aligned with their implementation in datatype.js.
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
				if (pName === "anycase") {
					return anyCasedLetter + rest;
				}
				if (pName === "digit") {
					return "\\d" + rest;
				}
				if (pName === "linebreak") {
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
					return TwineError.create("datatype", `Please use string datatypes like 'digit' in (${name}:) instead of number datatypes.`);
				}
				/*
					If this datatype isn't one of the above, produce an error. This is left in the resulting mapped array, to be dredged out just afterward.
				*/
				return TwineError.create("datatype", `The (${name}:) macro must only be given string-related datatypes, not ${objectName(pattern)}.`);
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
					pattern = pattern.replace(RegExp(`(${anyUppercase}|${anyLowercase})`, 'g'), a => "[" + a.toUpperCase() + a.toLowerCase() + "]");
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
									insensitive: true
								}),
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
					return [TwineError.create("operation", `I can't put ${objectName(value)} into ${this.TwineScript_ToSource()} because it isn't a string.`)];
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
					return [TwineError.create("operation", `I can't put ${objectName(value)} because it doesn't match the pattern ${this.TwineScript_ToSource()}.`)];
				}
				/*
					Because every "optional match" pattern macro forbids TypedVars in it, we can safely assume every match lines up
					with a TypedVar, and simply convert them like so.

					Note that in the case of a 0-character match, like "(p-opt:'A')-type _a", we must default the value to the empty string
					ourselves rather than leaving it as undefined.
				*/
				return results.map((r,i) => {
					let dest = typedVars[i];
					if (dest) {
						/*
							As with spread datatypes inside destructuring array patterns (like (a: 1, ...num-type _a)) which need to be wrapped in (a:)
							(becoming (a:...num)-type _a), the datatype of the resulting variable inside a string pattern needs to be wrapped in (p:).
						*/
						if (dest.datatype.rest && !dest.datatype.regExp) {
							dest = dest.TwineScript_Clone();
							dest.datatype = createPattern({ name:"p", fullArgs: [dest.datatype], });
						}
						return ({ dest, value: r || '', src: undefined, });
					}
				}).filter(Boolean);
			},
			TwineScript_IsTypeOf(value) {
				if (!canBeUsedAlone) {
					return TwineError.create("operation", `A (${name}:) datatype must only be used with a (p:) macro.`);
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
			TwineScript_ToSource () {
				return (this.rest ? "..." : '') + "(" + name + ":" + fullArgs.map(toSource) + ")";
			},
		});
		/*
			Replacing the TwineScript_ObjectName getter on Datatype requires the following finesse.
			This could be avoided if string patterns were an actual subclass of Datatype, though...
		*/
		Object.defineProperty(ret, 'TwineScript_ObjectName', { get() {
			return `a (${name}:) datatype`;
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
			* `(unpack: $roadName into (p:str,(p-either:'St','Rd','Ln','Ave','Way')-type _roadTitle))` extracts either "St", "Rd", "ln", "Ave", or "Way"
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

			String patterns can be used with (unpack:) to unpack parts of a string into multiple variables at once. For instance,
			`(set: (p: (p-opt:"Dr. "), (p: alnum-type _firstName, whitespace, alnum-type _lastName)-type _fullName) to "Dr. Iris Cornea")`
			creates three variables, _firstName, _lastName and _fullName, from a single string, and sets them to "Iris", "Cornea", and "Iris Cornea", respectively.

			Details:

			When (p:), and some (but not all) macros like (p-many:), are given multiple values, it is treated as a **sequence**. Strings are matched to sequences as follows: first,
			Harlowe checks if the start of the string matches the first value in the pattern. If it matches, then Harlowe checks if the start of the remaining portion of the string
			matches the next value in the pattern. When every part of the string has been matched to every one of the values, then the whole string is considered a match for the whole sequence.

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
		(["p","pattern"], "Datatype",
			(_, ...fullArgs) => createPattern({
				name:"p", fullArgs,
			}),
		PatternSignature)
		/*d:
			(p-either: ...String or Datatype) -> Datatype
			Also known as: (pattern-either:)

			Creates a string pattern that matches either of the single strings or datatypes given.

			Example usage:
			* `"Lovegyre" matches (p: (p-either: ...$emotions), "gyre")` checks if the string is any of the strings in $emotions (which is assumed to be an array), followed by "gyre".
			* `(set: (p-either:"","Hugged","Charmed","Dazed")-type $statusEffect to "")` creates a variable that can only be set to either
			"Hugged", "Charmed", "Dazed" or the empty string.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			Like (p-not:), and unlike the other macros, each of this macro's arguments represents a different possible match, **not** parts of a single sequence. If
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
		(["p-either","pattern-either"], "Datatype",
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

			When you use this in (unpack:), such as `(unpack: "Connie" into (p:(p-opt:"Lord")-type _isLord, str-type _name))`, and the optional pattern doesn't match,
			the variable will be set to the empty string "".

			Note that while you can use this as the datatype of a TypedVar (as shown previously), you can't nest TypedVars inside this, because it is an optional match - `(set: (p:"A",(p-opt:digit-type _d)) to "A")`
			will cause an error, because it's ambiguous whether, whenever the enclosing (p-opt:) doesn't match, the variable _d should not be set at all (which
			is rather counterintuitive) or if it should be set to an empty string (which contradicts its stated `digit-type` restriction anyway).

			See also:
			(p:), (p-ins:), (p-either:), (p-many:)

			Added in: 3.2.0.
			#patterns 3
		*/
		(["p-opt","pattern-opt","p-optional","pattern-optional"], "Datatype",
			(_, ...fullArgs) => createPattern({
				name: "p-opt", fullArgs, canContainTypedVars: false,
				makeRegExpString: subargs => "(?:" + subargs.join('') + ")?"
			}),
		PatternSignature)

		/*d:
			(p-not: ...String or Datatype) -> Datatype
			Also known as: (pattern-not:)

			Given any number of single characters or non-spread datatypes, this creates a string pattern that matches any one character that doesn't
			match any of those values.

			Example usage:
			* `(p-not: digit, ".")` matches any one string character except digits (matched by the `digit` datatype) or a "." character.
			* `(p-not:..."aeiou")` matches any one string character except a lowercase vowel. Note that using the spread `...` syntax to spread strings into their individual characters
			is recommended when using this macro.
			* `(p:"[", (p-many:(p-not:"]")), "]")` matches "[" followed by any number of characters except "]", followed by a closing "]".

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			Unlike many pattern datatype macros, this will error if given any datatype that could match 0 or 2+ characters. So, passing `str`, `empty`, any spread datatype like `...digit`,
			or any string with more or less than 1 character, will produce an error.

			When you use this in (unpack:), such as `(unpack: "-" into (p-many:(p-not:'s'))-type _a)`, and the optional pattern doesn't match,
			the variable will be set to the empty string "".

			While you can use this as the datatype of a TypedVar, you can't nest TypedVars inside this.

			See also:
			(p:), (p-opt:), (p-not-before:)

			Added in: 3.2.0.
			#patterns 6
		*/
		(["p-not","pattern-not"], "Datatype",
			(_, ...fullArgs) => {
				const wrong = fullArgs.find(e =>
					/*
						This must exclude the following datatypes: patterns, strings of length != 1,
						and basic datatypes representing multiple or zero string characters.
					*/
					typeof e === "string" ? [...e].length !== 1 : e.rest || e.regExp || ['str','empty'].includes(e.name));

				if (wrong) {
					return TwineError.create("datatype", "(p-not:) should only be given single characters, or datatypes that match single characters");
				}
				return createPattern({
					name: "p-not", fullArgs, canContainTypedVars: false,
					makeRegExpString: subargs => "[^" + subargs.map(e => (e.startsWith("[") && e.endsWith("]")) ? e.slice(1,-1) : e).join('') + "]"
				});
			},
		PatternSignature)

		/*d:
			(p-not-before: ...String or Datatype) -> Datatype
			Also known as: (pattern-not-before:)

			Creates a string pattern that matches the empty string, *unless* it is followed by the given sequence of strings or datatypes. This is best used inside another
			pattern macro like (p:), alongside a pattern to match, where it serves as an extra restriction on that pattern (making it match only if it's "not before" something).

			Example usage:
			* `(str-replaced: (p: "$", (p-not-before: digit)), "", _text)` produces a copy of the string in the temp variable _text, but with all dollar signs removed, *except* where the dollar sign is before a digit.
			* `(p-many:(p-either:(p: "0", (p-not-before:"0")), (p:"1", (p-not-before:"1")), whitespace))` matches a string with sequences of *alternating* 0's and 1's, plus whitespace. It matches
			`"0 0 01 10101 101"` but not `"0 0 01 10101 110"`.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			While you can use this as the datatype of a TypedVar, this won't accomplish much, since, as explained, it only matches the empty string. Additionally, you can't nest TypedVars inside this.

			See also:
			(p:), (p-opt:), (p-not:)

			Added in: 3.3.0.
			#patterns 8
		*/
		(["p-not-before","pattern-not-before"], "Datatype",
			(_, ...fullArgs) => {
				return createPattern({
					name: "p-not-before", fullArgs, canContainTypedVars: false,
					makeRegExpString: subargs => "(?!" + subargs.join('') + ")"
				});
			},
		PatternSignature)

		/*d:
			(p-before: ...String or Datatype) -> Datatype
			Also known as: (pattern-before:)

			Creates a string pattern that matches the empty string, *only* it is followed by the given sequence of strings or datatypes. This is best used inside another
			pattern macro like (p:), alongside a pattern to match, where it serves as an extra restriction on that pattern (making it match only if it's "not before" something).

			Example usage:
			```
			(str-find: (p:(p-many:digit), (p-before:(p-either:"AM","PM"))), "I arrived home at 42nd Street at 11PM and was in bed by 2AM.")
			```
			This example produces `(a:"11","2")`. Without the (p-before:) call around the (p-either:) call, this would produce `(a:"11PM","2AM")`.

			Rationale:
			While you can already select a continuous span of text by simply providing multiple values to (p:) and the like, this can be inconvenient for macros such as (str-find:) and (str-replaced:) -
			if you only want to find a subset of the match (such as just the digits before "AM" or "PM" in the above example), you'll have to strip the unwanted portion off afterward using a dataname like `1stto2ndlast`.
			As an alternative, you can use (p-before:) in the pattern to specify a portion of the pattern that should be checked, but not included in the match substring itself.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			While you can use this as the datatype of a TypedVar, this won't accomplish much, since, as explained, it only matches the empty string. Additionally, you can't nest TypedVars inside this.

			See also:
			(p:), (p-opt:), (p-not:)

			Added in: 3.3.0.
			#patterns 7
		*/
		(["p-before","pattern-before"], "Datatype",
			(_, ...fullArgs) => {
				return createPattern({
					name: "p-before", fullArgs, canContainTypedVars: false,
					makeRegExpString: subargs => "(?=" + subargs.join('') + ")"
				});
			},
		PatternSignature)

		/*d:
			(p-start: ...String or Datatype) -> Datatype
			Also known as: (pattern-start:)

			Identical to (p:), except that when used with macros that search for substrings in strings, like (str-find:), (str-replaced:) and (trimmed:), this only matches if the given strings or datatypes
			appear at the very start of the string.

			Example usage:
			* `(str-replaced: (p-start:"Ben:"), "Former Ben:", _text)` produces a copy of the string in the temp variable _text, but if the string begins with "Ben:", it is changed to "Former Ben:".
			This does not affect any instances of "Ben:" elsewhere in the string.
			* `(str-find: (p-start: (p-many:(p-either: digit, "A"))), _text)` examines the string in _text, and, if it begins with either digits or the letter A, produces an array with a string of those digits.
			Otherwise, it produces an empty array.
			* `(trimmed: (p-start: whitespace), _text)` trims off whitespace from the start of _text, but not the end.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			When this datatype is used with the `matches` operator, it is essentially identical to (p:), in the sense that `matches` compares an entire string with an entire pattern, rather than just a portion.

			See also:
			(p-end:), (p-before:)

			Added in: 3.3.0.
			#patterns 9
		*/
		(["p-start","pattern-start"], "Datatype",
			(_, ...fullArgs) => {
				return createPattern({
					name: "p-start", fullArgs,
					makeRegExpString: subargs => "^(?:" + subargs.join('') + ")"
				});
			},
		PatternSignature)
		/*d:
			(p-end: ...String or Datatype) -> Datatype
			Also known as: (pattern-start:)

			Identical to (p:), except that when used with macros that search for substrings in strings, like (str-find:), (str-replaced:) and (trimmed:), this only matches if the given strings or datatypes
			appear at the very end of the string.

			Example usage:
			* `(str-replaced: (p-end: ...newline), "\n", _text)` produces a copy of the string in the temp variable _text, but if the string ends with many newlines, they are replaced with a single newline.
			This does not affect multiple newlines elsewhere in the string.
			* `(trimmed: (p-end: ...whitespace), _text)` trims off whitespace from the end of _text, but not the start.

			Details:
			This is part of a suite of string pattern macros. Consult the (p:) article to learn more about string patterns, special user-created datatypes
			that can match very precise kinds of strings.

			When this datatype is used with the `matches` operator, it is essentially identical to (p:), in the sense that `matches` compares an entire string with an entire pattern, rather than just a portion.

			See also:
			(p-start:), (p-before:)

			Added in: 3.3.0.
			#patterns 10
		*/
		(["p-end","pattern-end"], "Datatype",
			(_, ...fullArgs) => {
				return createPattern({
					name: "p-end", fullArgs,
					makeRegExpString: subargs => "(?:" + subargs.join('') + ")$"
				});
			},
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

			When you use this in (unpack:) with a minimum of 0, such as `(unpack: "No results." into (p-many: 0, newline)-type _newlines)`, and
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
		(["p-many","pattern-many"], "Datatype",
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
		/*d:
			(p-ins: ...String or Datatype) -> Datatype
			Also known as: (p-insensitive:), (pattern-ins:), (pattern-insensitive:)

			Creates a string pattern that matches the sequence of strings or datatypes given, case-insensitively.

			Example usage:
			* `"Hocus pocus" matches (p-ins:"hocus", (p-opt:" "), "pocus")` checks if the magic words match the pattern, regardless of any letter's capitalisation.
			* `(unpack: "Scp-991" into (p:(p-ins:"SCP-"), ...digit-type _codeNum))` uses (unpack:) to extract "991" from the right-side string, checking if it matched
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
			#patterns 10
		*/
		(["p-ins","pattern-ins","p-insensitive","pattern-insensitive"], "Datatype",
			(_, ...fullArgs) => createPattern({
				name:"p-ins", fullArgs, insensitive: true,
			}),
			PatternSignature)
		
		/*d:
			(split: String or Datatype, String) -> Array
			Also known as: (splitted:)

			This splits up the second value given to it into an array of substrings, after finding and removing each occurrence of the first string or pattern (which is used as a separator value).

			Example usage:
			* `(split: newline, (passage:"Kitchen")'s source)` produces an array of each line in the "Kitchen" passage's source.
			* `(split: (p:",", (p-opt:" ")), "Rhett, Brett, Brad,Red")` produces `(a:"Rhett","Brett","Brad","Red")`.

			Rationale:

			It's common to want to extract substrings from a string, but you often want to do so not based on any fixed number of characters in the string, but on the location of a separator
			value within the string. For instance, extracting the words from a string, such as with (words:), means you should consider whitespace to be the separator between words.
			This macro provides a general means of splitting strings based on any separator you wish, using either a substring, a string-related datatype, or a string pattern datatype created
			with (p:) or its family of macros.

			As with most of Harlowe's data-processing macros, the word "split" should be considered an adjective, not a verb - it produces a "split string", not a command to split a string.

			Details:
			If no occurrences of the separator are found in the string, then an array containing just the complete string (with no splits) is produced.

			If the separator (the first value) is the empty string, then the second string will be simply split into an array of its characters, as if by `(a: ...$secondValue)`.

			If the separator is a pattern that matches the entire string (such as `(split: "Hairs", "Hairs")` or `(split: string, "Gadfly")`,
			then an array containing just the empty string will be produced.

			The pattern given to this macro cannot contained TypedVars (such as `(split: (p: alnum-type _letter), "A")`). Doing so will cause an error.

			See also:
			(words:), (folded:), (joined:), (trimmed:), (str-replaced:)

			Added in: 3.2.0
			#string
		*/
		(["split", "splitted"], "Array",
			(_, pattern, str) => {
				pattern = createPattern({
					name: "split", fullArgs: [pattern],
					/*
						Typed variables don't make sense for this macro, which isn't concerned with capturing
						substring matches, let alone binding them.
					*/
					canContainTypedVars:false,
				});
				if (TwineError.containsError(pattern)) {
					return pattern;
				}
				/*
					To ensure that these base cases work correctly in spite of the implementation below,
					they are explicitly stated here.
					1. If there are no matches, the entire string is returned, even if it's the empty string.
					2. If the pattern is "", then spread each character.
				*/
				if (!str) {
					return [""];
				}
				if (!pattern.regExp) {
					return [...str];
				}
				/*
					The following loop algorithm doesn't compile a global RegExp, instead electing to just slice the
					string from the left manually. Note that because this slices down str, the 'g' flag isn't needed.
				*/
				const regExp = RegExp(pattern.regExp), ret = [];
				let match;
				/*
					The loop should continue running until the string is consumed, OR there are no more matches
					(whereupon the final portion of the string is concatenated to the return value, below).
				*/
				while (str && (match = regExp.exec(str))) {
					/*
						This additional check is necessary to see if there is no meaningful string consumption
						being performed by .exec(), in the case of optional patterns like (p-opt:).
					*/
					if ((match.index + match[0].length) === 0) {
						return ret;
					}
					ret.push(str.slice(0, match.index));
					str = str.slice(match.index + match[0].length);
				}
				return ret.concat(str || []);
			},
			[either(String, Datatype), String])

		/*d:
			(trimmed: [String or Datatype], String) -> String
			
			This macro takes one string (the last value), and produces a copy with every character matching the given pattern (the first value) removed from the start and end of it. If no pattern
			is given, it defaults to removing whitespace, as if `whitespace` was the first argument.

			Example usage:
			* `(trimmed:"   Contract Annulled ")` produces `"Contract Annulled"`.
			* `(trimmed: "$", $treasureValue)` produces the string stored in $treasureValue with leading or trailing "$" signs removed.
			* `(trimmed: digit, "john61112")` produces `"john"`.
			* `(trimmed: (p-start: whitespace), _text)` trims off whitespace from the start of the string in _text, but not the end.

			Rationale:
			Removing certain leading or trailing characters in a string is a common operation, and is essentially equivalent to extracting a single substring from within a string.
			Removing the punctuation or whitespace surrounding a word, or just certain specific characters, is important when you need to use the middle portion of a string
			for some other use, such as being displayed in a different context. It's especially useful when dealing with user-inputted strings, such as those produced by (input-box:).

			Details:
			If an empty string is given, then it will be returned as-is. If the pattern doesn't match anything (for instance, if just `(p:)` or "" was given as the pattern)
			then the string will be returned as-is.

			If the pattern matches the entire string, then an empty string will be returned.

			The pattern given to this macro cannot contained TypedVars (such as `(split: (p: alnum-type _letter), "A")`). Doing so will cause an error.

			See also:
			(words:), (split:), (str-replaced:)

			Added in: 3.2.0
			#string
		*/
		("trimmed", "String",
			(_, pattern, str) => {
				if (str === undefined || (Datatype.isPrototypeOf(pattern) && pattern.name === "whitespace")) {
					/*
						For the base case (trimming whitespace), it is safe to default to the native trim().
					*/
					return pattern.trim();
				}
				pattern = createPattern({
					name: "trimmed", fullArgs: [pattern],
					/*
						Typed variables don't make sense for this macro, which isn't concerned with capturing
						substring matches, let alone binding them.
					*/
					canContainTypedVars:false,
				});
				if (TwineError.containsError(pattern)) {
					return pattern;
				}
				/*
					If the pattern was (p:) or something equally vacuous, then it won't have a useful regExp string.
				*/
				if (!pattern.regExp) {
					return str;
				}
				return str.replace(RegExp("^(" + pattern.regExp + ")*|(" + pattern.regExp + ")*$",'g'),'');
			},
			[either(String, Datatype), optional(String)])

		/*d:
			(str-find: Datatype, String) -> Array

			Also known as: (string-find:)
			
			When given a string pattern and a string, this produces an array of each substring within the string that the pattern matched. If
			typed variables were in the pattern, this instead produces an array of datamaps, each of which has data names matching the variables,
			and data values matching the portions of the string matched by those typed variables, as well as a "match" data name for the full substring.

			Example usage:
			* `(str-find: digit, "PARSEC47")` produces `(a:"4","7")`.
			* `(str-find: (p:"S", ...alnum), "Mr. Smith, Mr. Schmitt, and Mr. Smithers")` produces `(a:"Smith","Schmitt","Smithers")`.
			* `(str-find:(p:"$", ...digit, ".", ...digit), "Apple pie - $5.50; Pumpkin pie - $14.50")` produces `(a:"$5.50","$14.50")`.
			* `(str-find:(p:...alnum-type _flavor, " pie - $", (p:...digit, ".", ...digit)-type _cost), "Apple pie - $5.50; Pumpkin pie - $14.50")` produces the following:<br>
			`(a:
				(dm:"cost","5.50","flavor","Apple","match","Apple pie - $5.50"),
				(dm:"cost","14.50","flavor","Pumpkin","match","Pumpkin pie - $14.50")
			)`

			Rationale:
			The `matches` operator allows you to check if a string contains a specific substring that matches a pattern. This macro goes further, leting you extract every instance
			of those matching substrings, and use them as data. This is very useful if you have a structured string that you'd like to "break down" by removing unimportant
			parts, but which isn't uniform enough to simply use (split:) for.

			Using typed variables to extract multiple components of the substring at once, such as in the above example, can let you directly translate a string
			into a sequence of data structures that provide easy access to that data. Rather than having to perform additional (str-find:) calls on the results of the first
			(str-find:), you can tag parts of the initial pattern with `-type` and a temp variable name, thus causing a datamap of those parts to be created. This array of
			datamaps can then be tweaked further with (altered:). If the last (str-find:) example above was stored in the variable `_pies`, then one could write
			`(altered: via its cost + " for " + (lowercase:its flavor), ..._pies)` to create `(a: "5.50 for apple", "14.50 for pumpkin")`.

			####Regarding (find:) and (str-find:):

			You might wonder how this compares to (find:), and why the latter only takes a lambda instead of a pattern (such as that given to (unpack:)).
			Here is how to think of the two macros. The (find:) macro operates on sequences of values, and treats all of them as discrete values whose order doesn't
			impact their individual meaning. Hence, it takes a `where` lambda that checks each value individually. Strings, however, consist of sequences of characters that
			*only* have meaning from their order, so (str-find:) takes a string pattern that can match a long substring, or various substring possibilities, by itself.

			Details:
			This macro only takes a string pattern as its first value. This is because, if a string was given, every result in the produced array would simply be a copy of that string,
			which isn't particularly useful.

			Here is a more detailed description of how (str-find:) works when the pattern contains typed variables. Whenever (str-find:) encounters a substring,
			it takes the substring, and "unpacks" it into the typed variables in the pattern (in a manner similar to (unpack:)). Then, it immediately
			converts these temp variables into datamap names and values, and produces a datamap corresponding to that particular substring. Finally, a "match" dataname is added
			holding the full substring.

			Thus, even though this macro can use typed temp variables in its pattern, this does *not* cause any temp variables to be created in the passage or containing hook. Other macro calls can't access
			the temp variables used here, and they essentially do not exist. This is similar to (str-replaced:)'s use of temp variables in its patterns, which also does not affect the temp variables in
			the passage or containing hook.

			If no matches of the pattern exist within the string, an empty array is returned.

			If two identical TypedVar names are used in the pattern (such as `(p: alnum-type _a, alnum-type _a)`) then an error will occur.

			If a TypedVar named `_match` is used, then an error will occur (because this collides with the "match" dataname containing the full substring).

			See also:
			(substring:), (count:), (split:), (str-replaced:)

			Added in: 3.3.0
			#string
		*/
		(["str-find", "string-find"], "String",
			(_, pattern, str) => {
				/*
					Create the pattern (and specifically its RegExp and TypedVars). Note that even plain strings should be given as fullArgs to createPattern().
				*/
				pattern = createPattern({ name: "str-find", fullArgs: [pattern], canContainTypedGlobals: false, });
				if (TwineError.containsError(pattern)) {
					return pattern;
				}
				const typedVars = pattern.typedVars();
				const regExp = RegExp(pattern.regExp,'g');
				let match, matches = [];
				let {lastIndex: oldLastIndex} = regExp;
				while ((match = regExp.exec(str))) {
					/*
						A basic infinite regress (caused by (p-opt:)) prevention check.
					*/
					if (oldLastIndex === regExp.lastIndex) {
						break;
					}
					oldLastIndex = regExp.lastIndex;
					/*
						For each subgroup in the RegExp match, assign to the matching typedVar. Note that typedVars() returns them
						in the same order as the RegExp has matches.
					*/
					if (typedVars.length) {
						const matchObj = new Map();
						for (let i = 0; i < typedVars.length; i += 1) {
							const name = typedVars[i].varRef.getName();
							if (name === "match") {
								return TwineError.create("macrocall", "There was a typed temp variable named _match in the pattern given to (str-find:)",
									"The variable _match is reserved, and can't be used inside (str-find:)'s pattern.");
							}
							matchObj.set(typedVars[i].varRef.getName(), match[i+1]);
							matchObj.set("match", match[0]);
						}
						matches.push(matchObj);
					}
					else {
						matches.push(match[0]);
					}
				}
				return matches;
			},
			[Datatype, String])

		/*d:
			(str-replaced: [Number], String or Datatype, String or Lambda, String) -> String

			Also known as: (string-replaced:), (replaced:)
			
			This macro produces a copy of the content string (the last string given), with all instances of a certain search string (or pattern) replaced using a given string (or a "via" lambda that constructs a replacement string).
			Giving an optional number N lets you only replace the first N instances. If a pattern is given, TypedVars may be used inside it, and they will be accessible in the "via" lambda.

			Example usage:
			* `(str-replaced: "http://", 'https://', $URL)` produces a copy of the string in $URL with all occurrences of "http://" replaced with "https://".
			* `(str-replaced: (p-many: whitespace), ' ', $playerName)` produces a copy of the string in $playerName with all runs of whitespace (including multiple spaces) replaced with a single space.
			* `(str-replaced: 1, '*', '☆', _nextLine)` produces a copy of _nextLine with the first occurrence of "*" replaced with "☆".
			* `(str-replaced: (p-many:alnum), via (str-reversed: it), "09-4128-3253")` produces `"90-8214-3523"`.
			* `(str-replaced: (p: (p-many:digit)-type _a, "%"), via _a + " percent", "5% 10%")` produces `"5 percent 10 percent"`.

			Rationale:
			This macro accompanies (str-find:) - in addition to finding matches of a given pattern, this also lets you replace them there and then, producing a new
			version of the string. This can serve a variety of uses. Player-inputted text, such as by (input-box:), will often
			need to have unwanted characters (such as newlines) removed. Strings used for procedurally describing certain objects or game states, like the player's
			physical status, may need to be subtly modified to fit in specific sentences. Or, you may want to do something more esoteric, like "corrupting" or "censoring" a string
			by replacing certain characters arbitrarily.

			While you can replace text that's already been rendered into the passage using (replace:) or (replace-with:), this macro is better suited for modifying strings that
			are stored in variables and used throughout the story.

			Details:
			While this macro does have the shorter alias as (replaced:), it is recommended that (str-replaced:) be used to avoid confusion with the (replace:) macro, which is a changer that
			performs immediate replacements (using the attached hook) on passage hooks and text, not strings.

			Matches and replacements are non-overlapping - if the search string or pattern would overlap certain locations in the string, only the leftmost location is replaced.
			So, `(str-replaced: "1010", 'X', "101010")` will produce `"X10"`, not `"10X"` or `"XX"`.

			You can supply a "via" lambda to specify a more complicated replacement than just a single string.	The `it` identifier in the lambda will be the matched portion of the string.
			In the case of `(str-replaced: alnum, via it + "-", "Fred...?")`, `it` will be "F", "r", "e", and "d", respectively.
			Of course, as always, you can provide a temp variable in front of the "via" keyword, which will be usable in the lambda as a more readable alternative  to the `it` identifier.
			In the case of `(str-replaced: (p:(p-many:digit), "-", (p-many:digit)), _phoneNum via "(131) " + _phoneNum, "Call me on 999-000!")`, both _phoneNum and `it` will be "999-000".

			Interestingly, any pattern (using the (p:) macro and its relatives) given to (str-replaced:) *can* have TypedVars inside it. These TypedVars will be accessible within the "via" lambda.
			In the case of `(str-replaced: (p: (p-many:digit)-type _a, "%"), via _a + " percent", "5% 10%")`, above, the "via" lambda will be run twice: the first time, `it` will be "5%", and _a will be "5"
			(because it contains only the `(p-many:digit)` portion of the matched string). The second time, `it` will be "10%", and _a will be "10". This feature allows you to
			capture "sub-groups" within the matched sub-string, and use them in the "via" lambda to make a custom replacement for every match in the content string.

			By the way, the `pos` identifier can also be used inside the "via" lambda. It equals the number of replacements before and including this one.

			Here's a short table summarising some of the above information.

			| Macro call | `it` | `pos` | `_a` | Replacement made by the lambda
			|---
			| `(str-replaced: (p: (p-many:digit)-type _a, "%"), via _a + " percent", "5% 10%")` | `"5%"` | `1` | `"5"` | `"5 percent"`
			| |`"10%"` | `2` | `"10"` | `"10 percent"`
			| `(str-replaced: alnum, via it + "-", "Fred...?")` | `"F"` | `1` | n/a | `"F-"`
			| |`"r"` | `2` | n/a | `"r-"`
			| |`"e"` | `3` | n/a | `"e-"`
			| |`"d"` | `4` | n/a | `"d-"`

			The TypedVars used in the pattern are *only* usable in the lambda. They essentially do not exist outside of the macro call, and will not be accessible to macros elsewhere in the passage.

			The optional number decides how many replacements, starting from the left of the content string, should be made. If no string is given, all possible replacements are made.
			If 0 is given, no replacements will be made, the content string will be returned as-is, and no error will occur. Giving negative numbers or non-whole numbers *will* produce an error, though.

			If an empty or meaningless pattern is given as a search value (for instance, `(p:)` or `""`) then no replacements will be made and the content string will be returned as-is.

			See also:
			(trimmed:), (split:), (unpack:)

			Added in: 3.3.0
			#string
		*/
		(["str-replaced", "string-replaced", "replaced"], "String",
			(section, num, pattern, replacement, str) => {
				/*
					If there's not an optional first number, shift every argument left by a slot.
				*/
				if (typeof num !== "number") {
					if (str !== undefined) {
						return TwineError.create("macrocall", `1 too many values were given to (str-replaced:).`,
							"If this is given 5 values, the first value must be a number of replacements.");
					}
					str = replacement;
					replacement = pattern;
					pattern = num;
					num = Infinity;
				} else if (str === undefined) {
					return TwineError.create("macrocall", `The (str-replaced:) macro needs 1 more value.`,
						"The final string seems to be missing.");
				}
				/*
					Due to the dubious type signature of this macro (needed to allow the optional first number), some more type-checking
					needs to be done.
				*/
				if (Datatype.isPrototypeOf(replacement)) {
					return TwineError.create("datatype", `The replacement value for (str-replaced:) must be a string or lambda, not ${objectName(replacement)}`);
				}
				if (Lambda.isPrototypeOf(str) || Lambda.isPrototypeOf(pattern)) {
					return TwineError.create("datatype", `The ${Lambda.isPrototypeOf(str) ? "final string" : 'search pattern'} given to (str-replaced:) can't be a lambda.`,
						"Only the replacement value (after the search pattern) can be a 'via' lambda.");
				}

				/*
					Create the pattern (and specifically its RegExp and TypedVars). Note that even plain strings should be given as fullArgs to createPattern().
				*/
				pattern = createPattern({ name: "str-replaced", fullArgs: [pattern], canContainTypedGlobals: false });
				if (TwineError.containsError(pattern)) {
					return pattern;
				}
				/*
					If the pattern was (p:) or something equally vacuous, then it won't have a useful regExp string.
				*/
				if (!pattern.regExp) {
					return str;
				}
				/*
					Note that because of the while-exec loop below, this will freeze the game without 'g'.
				*/
				const regExp = RegExp(pattern.regExp,'g');
				const typedVars = Lambda.isPrototypeOf(replacement) ? pattern.typedVars() : [];
				let match;
				/*
					Slowly build up the new string by performing every replacement manually, running the lambda (if any)
					with the specified typedVars visible.
				*/
				let pos = 1;
				let oldIndex = 0;
				let ret = '';
				let {lastIndex: oldLastIndex} = regExp;
				while (str && (match = regExp.exec(str)) && num > 0) {
					/*
						A basic infinite regress (caused by (p-many:0)) prevention check.
					*/
					if (oldLastIndex === regExp.lastIndex) {
						break;
					}
					oldLastIndex = regExp.lastIndex;
					/*
						This should be the same as the default produced internally by Lambda.apply() (if tempVariables isn't given).
					*/
					const tempVariables = Object.create(section.stack.length ? section.stackTop.tempVariables : VarScope);
					/*
						For each subgroup in the RegExp match, assign to the matching typedVar. Note that typedVars() returns them
						in the same order as the RegExp has matches.
					*/
					for (let i = 0; i < typedVars.length; i += 1) {
						const typedVar = typedVars[i];
						/*
							Again, as in Lambda.apply(), a more formal defineType() and set() call may be performed to assign the match
						*/
						const ref = typedVar.varRef.create(tempVariables, typedVar.varRef.propertyChain);
						if (TwineError.containsError(ref)) {
							return ref;
						}
						const error = ref.defineType(typedVar.datatype);
						if (TwineError.containsError(error)) {
							return error;
						}
						/*
							There really, really should not be an error here, so bothering to check isn't necessary.
						*/
						ref.set(match
							/*
								Remember that 0 is the full match, including subgroups. Hence, subgroups use 1-indexing.
							*/
							[i + 1]);
					}
					/*
						Now that the tempVariables are in place.
					*/
					const repl = Lambda.isPrototypeOf(replacement) ? replacement.apply(section, {loop: match[0], pos, tempVariables}) : replacement;
					if (TwineError.containsError(repl)) {
						return repl;
					}
					if (typeof repl !== "string") {
						return TwineError.create("datatype", `(str-replaced:)'s lambda must produce a string, but it produced ${objectName(repl)} when given "${match[0]}".`);
					}
					/*
						Now that the replacement has been computed, perform it here.
					*/
					ret += str.slice(oldIndex, match.index) + repl;
					pos += 1;
					num -= 1;
					oldIndex = match.index + match[0].length;
				}
				ret += str.slice(oldIndex);
				return ret;
			},
			[either(nonNegativeInteger, String, Datatype), either(Datatype, String, Lambda.TypeSignature('via')), either(String, Lambda.TypeSignature('via')), optional(String)]);
});
