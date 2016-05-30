define(['utils', 'utils/operationutils', 'internaltypes/varscope', 'internaltypes/twineerror'], ({toJSLiteral, insensitiveName, plural}, {typeName, objectName, singleTypeCheck}, VarScope, TwineError) => {
	"use strict";
	/*
		Lambdas are user-created TwineScript functions. Their only purpose is to be passed to functional macros
		like (converted:), (filtered:) and (combined:), which serve as TwineScript's map/filter/reduce equivalents.
	*/
	const Lambda = Object.freeze({
		lambda: true,
		TwineScript_TypeName:   "a lambda",
		TwineScript_ObjectName: "a lambda",

		TwineScript_Print() {
			// TODO: Make this string more detailed.
			return "`[A lambda]`";
		},

		TwineScript_is(other) {
			/*
				Lambdas are equal if their body is equivalent given parameter renaming
				(a.k.a alpha equivalence)
				TODO: Implement the above.
			*/
			return other === this;
		},

		/*
			This static method is used exclusively to produce type signature objects for use by
			macro definitions in macrolib. Specifically, it lets us specify which clauses a macro
			expects its lambda to have.
		*/
		TypeSignature(clauses) {
			return { pattern: "lambda", innerType: Lambda, clauses };
		},

		/*
			Lambdas consist of five clauses: the loop variable's name, the 'making' variable's name,
			the 'with' variable's name, the 'where' clause, and the 'via' clause.

			Lambdas are constructed by joining one of these clauses with a subject (which is either another
			lambda - thus adding their clauses - or a ).
		*/
		create(subject, clauseType, clause) {
			let ret;
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
					If the subject is a temporary variable (and it's a mistake if it's not), create a fresh lambda object.
					It's a tad unfortunate that the preceding token before this lambda is already compiled into an incorrect
					object, but we must deal with syntactic ambiguity in this way.
				*/
				if (!subject.varref
						// It must be a temp variable...
						|| !VarScope.isPrototypeOf(subject.object)
						// ...and not a property access on one.
						|| subject.propertyChain.length > 1) {
					return TwineError.create('syntax', "This lambda needs to start with a single temporary variable.");
				}
				ret = Object.create(this);
				// Extract the variable name from the TempVar, and make that the 'loop' variable name.
				ret.loop = subject.propertyChain[0];
			}
			/*
				We add the new clause, then do some further error-checking afterwards.
			*/
			ret[clauseType] = clause;
			/*
				The "making", "with" or "loop" variables' names must always be unique.
			*/
			const nonunique = [ret.making, ret.with, ret.loop].filter((e,i,a)=>e && a.indexOf(insensitiveName(e)) !== i);
			if (nonunique.length) {
				return TwineError.create('syntax', 'This lambda has two variables named \'' + nonunique[0] + '\'.',
					'Lambdas should have all-unique parameter names.');
			}
			/*
				All checks have now succeeded.
			*/
			return ret;
		},

		/*
			Macros call this method to apply the lambda to a series of provided values.
			This needs to have the macro's section passed in so that its JS code can be eval()'d in
			the correct scope.
		*/
		apply(section, {loop:loopArg, 'with':withArg, making:makingArg, fail:failArg, pass:passArg}) {
			/*
				We run the JS code of this lambda, inserting the arguments by adding them to a "tempVariables"
				object. The tempVariable references in the code are compiled to VarRefs for tempVariables.
			*/
			section.stack.unshift(Object.assign(Object.create(null), {tempVariables: Object.create(VarScope)}));
			
			const makeTempVariable = (name, arg) =>
				(name ? "section.stack[0].tempVariables['" + name + "'] = " + toJSLiteral(arg) + ";" : '');

			const ret = section.eval(
				makeTempVariable(this.loop, loopArg)
				+ makeTempVariable(this.with, withArg)
				+ makeTempVariable(this.making, makingArg)
				/*
					If a lambda has a "where" clause, then the "where" clause filters out
					values. Filtered-out values are replaced by the failVal.
					If a lambda has a "via" clause, then its result becomes the result of the
					call. Otherwise, the passVal is used.
				*/
				+ ('where' in this
					? "Operations.where("
						+ this.where + ","
						+ (this.via || toJSLiteral(passArg)) + ","
						+ toJSLiteral(failArg) + ")"
					: (this.via || toJSLiteral(passArg))
				)
			);
			section.stack.shift();
			return ret;
		},
	});
	return Lambda;
});
