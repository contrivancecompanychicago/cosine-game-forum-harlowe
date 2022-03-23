"use strict";
define(['utils', 'utils/operationutils', 'internaltypes/varscope', 'internaltypes/varref', 'internaltypes/twineerror'], ({nth}, {objectName}, VarScope, VarRef, TwineError) => {
	/*d:
		Lambda data

		Suppose you want to do a complicated task with an array, like, say, convert all of its strings to lowercase,
		or check if its datamaps have "health" data equal to 0, or join all of its strings together
		into a single string. You want to be able to tell Harlowe to search for "each string where the string's 1st
		letter is A". You want to write a "function" for how the search is to be conducted.

		Lambdas are user-created functions that let you tell certain macros, like (find:), (altered:) and (folded:),
		precisely how to search, alter, or combine the data provided to them. Try thinking of them as stored expressions that
		operate on a single value in the sequence of data, which are then run on every value in turn.

		There are several types of lambdas, as well as lambdas that comprise multiple types.

		* **"where"** lambdas, used by the (find:) macro, are used to search for and filter data. The lambda `_item where _item's 1st is "A"`
		tells the macro to searches for items whose `1st` is the string "A".
		
		* For certain macros, like (for:), you may want to use a "where" lambda that doesn't filter out any of the values -
		`_item where true`, for instance, will include every item. There is a special, more readable **"each"** shorthand for this type
		of "where" lambda: writing just `each _item` is equivalent.

		* **"when"** lambdas are a variant of "where" used exclusively by (event:) and (storylet:), and are used to specify when a hook or passage should
		be shown. The lambda `when $fuel > 8` tells (event:) to show the attached hook when `$fuel` is increased (due to an interaction macro
		like (link-repeat:), a (live:) macro, or anything else). This really shouln't be called a "lambda", but you can perhaps think of it in
		terms of it filtering moments in time that pass or fail the condition.

		* **"via"** lambdas, used by the (altered:) and (sorted:) macro, are used to translate or change data. The lambda `_item via _item + "s"`
		tells the macro to add the string "s" to the end of each item. Only the (altered:) macro uses this to change values: the (sorted:)
		macro uses this to sort the data value as if it was another value.
		
		* **"making"** lambdas, used by the (folded:) are used to build or "make" a single data value by adding something from
		each item to it. The lambda `_item making _total via _total + (max: _item, 0)` tells the macro to add each item to
		the total, but only if the item is greater than 0. (Incidentally, you can also use "where" inside a "making" lambda -
		you could rewrite that lambda as `_item making _total via _total + _item where _item > 0`.)

		Lambdas use temp variables to hold the actual values. For instance, in `(find: _num where _num > 2, 5,6,0)`,
		the temp variable `_num` is used to mean each individual value given to the macro, in turn. It will be 5, 6 and 0, respectively.
		Importantly, this will *not* alter any existing temp variable called `_num` - the inside of a lambda can be thought
		of as a hook, so just as the inner `_x` in `(set: _x to 1) |a>[ (set:_x to 2) ]` is different from the outer `_x`, the `_num` in the
		lambda will not affect any other `_num`.

		If you want to be extra watchful for errors and mistyped data (and if you're working on a big project, you should!), you can include a datatype
		with each variable, such as by writing `str-type _a where _a contains 'e'` instead of `_a where _a contains 'e'`, to make it a TypedVar.
		You may notice that `_a contains 'e'` would also be true if `_a` was `(a:'e')` rather than, as intended, a string. Adding `str-type`
		allows such an error to be found and reported early, and results in a less confusing error message.

		You can use the "it" shorthand to save on having to write the temporary variable's name multiple times.
		`_num where _num > 2` can be rewritten as`_num where it > 2`. Not only that, but you can even save on naming the temporary
		variable at all, by just using `where` (or `via` or `making`) without the name and only using `it` to refer to the variable: `where it > 2`.

		Additionally, the "pos" identifier can be used inside a lambda - it evaluates to the position of the data value (from those passed into
		the macro) that the lambda is currently processing. `(altered: via it + (str:pos), "A", "B", "C", "A")` produces `(a:"A1","B2","C3","A4")`.

		An important feature is that you can save lambdas into variables, and reuse them in your story easily. You
		could, for instance, `(set: $statsReadout to (_stat making _readout via _readout + "|" + _stat's name + ":" + _stat's value))`,
		and then use $printStats with the (folded:) macro in different places, such as `(folded: $statsReadout, ...(dataentries: $playerStats))`
		for displaying the player's stats, `(folded: $statsReadout, ...(dataentries: $monsterStats))` for a monster's stats, etc.

		Lambdas are named after the lambda calculus, and the ["lambda"](https://en.wikipedia.org/wiki/Anonymous_function) keyword used in many popular programming languages.
		They may seem complicated, but as long as you think of them as just a special way of writing a repeating instruction,
		and understand how their macros work, you may find that they are very convenient.
	*/

	/*
		The only user-produced value which is passed into this operation is the bool -
		the passVal and failVal are internally supplied.
	*/
	function where(bool, passVal, failVal) {
		let err;
		if ((err = TwineError.containsError(bool))) {
			return err;
		}
		if (typeof bool !== "boolean") {
			return TwineError.create("operation",
				"This lambda's 'where' clause must evaluate to true or false, not "
				+ objectName(bool)
				+ ".");
		}
		return bool ? passVal : failVal;
	}

	const Lambda = Object.freeze({
		TwineScript_TypeID: "lambda",
		TwineScript_TypeName:   "a lambda",

		get TwineScript_ObjectName() {
			return "a \""
				+ (("making" in this) ? "making ... " : "")
				+ (("each" in this) ? "each ... " : "")
				+ (("where" in this) ? "where ... " : "")
				+ (("when" in this) ? "when ... " : "")
				+ (("via" in this) ? "via ... " : "")
				+ "\" lambda";
		},

		TwineScript_Print() {
			// TODO: Make this string more detailed.
			return "`[A lambda]`";
		},

		TwineScript_is(other) {
			/*
				Lambdas are equal if their body is equivalent given parameter renaming
				(a.k.a. alpha equivalence)
				TODO: Implement the above.
			*/
			return other === this;
		},

		/*
			Lambdas store their entire source entirely for the purposes to ToSource,
			as decompiling the JS of their clauses is too difficult.
		*/
		TwineScript_ToSource() {
			return this.source;
		},

		/*
			This static method is used exclusively to produce type signature objects for use by
			macro definitions in macrolib. Specifically, it lets us specify which clauses a macro
			expects its lambda to have.
		*/
		TypeSignature(...clauses) {
			return {
				pattern: "lambda", innerType: Lambda, clauses,
				typeName: "a \""
					// This concat() causes a trailing ... to be added to the end of the clauses.
					+ clauses.concat('').join(" ...")
					+ "\" lambda",
			};
		},

		/*
			I assume this is sufficient... despite their being a lot of data structures
			attached to a lambda, including other lambdas, none of those should
			be user-accessible.
		*/
		TwineScript_Clone() {
			return Object.assign(Object.create(Lambda), this);
		},

		/*
			Lambdas consist of five clauses: the loop variable, the 'making' variable,
			the 'where' clause (and its special 'when' variant), and the 'via' clause.

			Lambdas are constructed by joining one of these clauses with a subject (which is either another
			lambda - thus adding their clauses - or a temp variable or typed variable).
			{subject} A VarRef or Lambda (hopefully)
			{clauseType} 'making', 'via', 'where', 'when' or 'each'
			{clause} An array of tokens ('making', 'each') OR a VarRef ('via', 'where', 'when')
			{source} Harlowe source code
		*/
		create(subject, clauseType, clause, source) {
			let ret;
			const tempVariableMsg = "temp variable, or typed temp variable";
			/*
				This function quickly checks that a variable object (either subject or 'making' clause) given to this lambda is valid.
			*/
			function validVariable(subject) {
				/*
					If the subject is a typed variable (which we can't actually strictly type-check due to a circular dependency)
					then pull out its variable. Otherwise, use the subject itself.
				*/
				const variable = (subject && subject.varRef ? subject.varRef : subject);
				return (variable === undefined ||
						(variable && VarRef.isPrototypeOf(variable)
						// It must be a temp variable...
						&& VarScope.isPrototypeOf(variable.object)
						// ...and not a property access on one.
						&& variable.propertyChain.length === 1));
			}
			if (TwineError.containsError(clause)) {
				return clause;
			}
			if (clauseType === "making" && !validVariable(clause)) {
				return TwineError.create('syntax','I need a ' + tempVariableMsg + ', to the right of \'' + clauseType + '\', not ' + objectName(clause) + '.');
			}
			/*
				Firstly, if the subject is an error, propagate it.
			*/
			if (TwineError.containsError(subject)) {
				return subject;
			}
			/*
				If the subject is another lambda (as consecutive clauses compile to nested
				Operations.createLambda() calls), add this clause to that lambda.
			*/
			else if (Lambda.isPrototypeOf(subject)) {
				/*
					"when" is a special variant of "where" that can't be joined with any other clauses.
				*/
				if (clauseType === "when" || "when" in subject) {
					return TwineError.create('syntax', "A 'when' lambda cannot have any other clauses, such as '" + clauseType + "'.");
				}
				/*
					An error only identifiable while adding clauses:
					two of one clause (such as "where _a > 2 where _b < 2") is a mistake.
				*/
				if (clauseType in subject) {
					return TwineError.create('syntax', "This lambda has two '" + clauseType + "' clauses.");
				}
				/*
					We shall mutate the passed-in lambda, providing it with this additional clause.
				*/
				ret = subject;
			}
			else {
				/*
					"when" is a special variant that, for readability, shouldn't have a subject.
				*/
				if (clauseType === "when" && subject !== undefined) {
					return TwineError.create('syntax',
						"A 'when' lambda shouldn't begin with a temp variable (just use 'when' followed by the condition).");
				}

				if (!validVariable(subject)) {
					return TwineError.create('syntax', "This lambda needs to start with a single " + tempVariableMsg + ", not " + objectName(subject) + '.');
				}
				/*
					If the subject is a temporary variable, typed variable, or undefined (and it's a mistake if it's not), create a fresh
					lambda object with only a "loop" property.
				*/
				ret = Object.create(this);
				ret.loop = (subject || "");
			}
			/*
				Add the source, or update the source to include this lambda's contents.
				Either way, it's just an assignment.
			*/
			ret.source = source.trim();
			/*
				We add the new clause, then do some further error-checking afterwards.
			*/
			ret[clauseType] = clause;
			/*
				The "making" or "loop" variables' names must always be unique.
				Note: like regular variables, temp variables are not case-insensitive.
			*/
			const nonunique = ret.making && (ret.making.getName() === (ret.loop && ret.loop.getName()));
			if (nonunique) {
				return TwineError.create('syntax', 'This lambda has two variables named \'' + ret.loop.getName() + '\'.',
					'Lambdas should have all-unique parameter names.');
			}
			return ret;
		},

		/*
			Macros call this method to apply the lambda to a series of provided values.
			This needs to have the macro's section passed in so that its JS code can be eval()'d in
			the correct scope.
		*/
		apply(section, {loop:loopArg, pos:lambdaPos /*This must be 1-indexed*/, making:makingArg, ignoreVia, tempVariables}) {
			/*
				We run the JS code of this lambda, inserting the arguments by adding them to a tempVariables
				object (if one wasn't provided). The temporary variable references in the code are compiled to
				VarRefs for tempVariables.
			*/
			tempVariables = tempVariables || Object.create(section.stack.length ? section.stackTop.tempVariables : VarScope);

			/*
				This function assigns the value for a variable for this iteration, and retrieves any
				type errors resulting from it (if the variable was typed).
			*/
			function setArgument(variable, arg) {
				if (variable) {
					/*
						If the variable is a typed variable (which we can't actually strictly type-check due to a circular dependency)
						then we perform a more formal defineType() and set() call to assign it to the scope.
					*/
					if ("datatype" in variable && "varRef" in variable) {
						/*
							Create new VarRefs that use this tempVariable scope as a base.
						*/
						const ref = variable.varRef.create(tempVariables, variable.varRef.propertyChain);
						if (TwineError.containsError(ref)) {
							return ref;
						}
						let error = ref.defineType(variable.datatype);
						if (TwineError.containsError(error)) {
							return error;
						}
						error = ref.set(arg);
						if (TwineError.containsError(error)) {
							return error;
						}
					}
					else {
						tempVariables[variable.getName()] = arg;
					}
				}
			}
			const error = setArgument(this.loop, loopArg) || setArgument(this.making, makingArg);
			if (TwineError.containsError(error)) {
				error.message = `While running ${lambdaPos ? `the ${nth(lambdaPos)} loop of ` : ''}this lambda, an error occurred:\n` + error.message;
				return error;
			}

			/*
				The stackTop, if it exists, may have a speculativePassage or something
				else that alters the semantics of identifiers inside the lambda (like 'visits'), and so
				instead, the lambda's stack inherits those values from it.
			*/
			section.stack.unshift(Object.assign(Object.create(section.stackTop || null), {
				tempVariables,
				/*
					"pos" is not used for "when" lambdas.
				*/
				lambdaPos: !this.when ? lambdaPos : undefined,
			}));			
			/*
				Cache the evalReplay of section, so that the eval() doesn't clobber it.
			*/
			const {evalReplay} = section;
			section.evalReplay = null;

			/*
				If this lambda has no "making" clauses (and isn't a "when" lambda), then the "it"
				keyword is set to the loop arg. Note that this doesn't require the presence of
				this.loop - if it is omitted, then you can only access the loop var in the "where"
				clause using "it".
			*/
			if (loopArg && !this.making && !this.when) {
				section.Identifiers.it = loopArg;
			}
			/*
				Otherwise, stuff the "it" value with a special error message that should propagate up
				if "it" is ever used inside this macro.
			*/
			else {
				section.Identifiers.it = TwineError.create("operation",
					"I can't use 'it', or an implied 'it', in " + this.TwineScript_ObjectName
				);
			}

			/*
				At the start of a "making via where" lambda, we must filter out the values that fail
				the "where" clause, without running the "via" clause at all. So, ignoreVia is used by filter()
				to signify that this must be done.
			*/
			const via = (!ignoreVia && this.via);

			let ret;
			/*
				If a lambda has a "where" (or "when") clause, then the "where" clause filters out
				values. Filtered-out values are replaced by null (which .apply() consumers should handle themselves).
				If a lambda has a "via" clause, then its result becomes the result of the
				call. Otherwise, true is returned.
			*/
			if ('where' in this || 'when' in this) {
				ret = where(section.eval(this.where || this.when), via ? section.eval(via) : true, null);
			}
			else {
				ret = via ? section.eval(via) : true;
			}
			section.stack.shift();
			section.evalReplay = evalReplay;
			/*
				Prepend a little extra context to the message if it's an error.
			*/
			if (TwineError.containsError(ret)) {
				ret.message = `While running the ${nth(lambdaPos)} loop of this lambda, an error occurred:\n` + ret.message;
			}
			return ret;
		},

		/*
			This convenience function is used to run reduce() on macro args using a lambda,
			which is an operation common to (find:), (all-pass:) and (some-pass:).

			tempVariables is only overridden by certain deferred rendering macros (as of Sep 2018, just (event:)).
		*/
		filter(section, args, tempVariables = null) {
			let error;
			const filtered = args.reduce((result, arg, pos) => {
				/*
					If an earlier iteration produced an error, don't run any more
					computations and just return.
				*/
				if ((error = TwineError.containsError(result))) {
					return error;
				}
				/*
					Run the lambda, to determine whether to filter out this element.
				*/
				const passedFilter = this.apply(section, {loop:arg, pos:pos+1, ignoreVia:true, tempVariables});
				if ((error = TwineError.containsError(passedFilter))) {
					return error;
				}
				return result.concat(passedFilter ? [arg] : []);
			}, []);
			/*
				If an error was returned by one of the reduce() iterations, we need to return only that error,
				not the array contanining it.
			*/
			if ((error = TwineError.containsError(filtered))) {
				return error;
			}
			return filtered;
		},
	});
	return Lambda;
});
