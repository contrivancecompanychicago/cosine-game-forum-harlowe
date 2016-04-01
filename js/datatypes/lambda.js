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
			macro definitions in macrolib. Specifically, it lets us specify which arity a macro
			expects its lambda to have, and what type of lambda it is.
		*/
		TypeSignature(arity, lambdaKind) {
			return { pattern: "lambda", innerType: Lambda, arity, lambdaKind };
		},

		checkResult(given, result, type) {
			if (!singleTypeCheck(result, type)) {
				return TwineError.create("macrocall",
					"This lambda must always produce " + typeName(type) + ", but it produced '"
					+ objectName(result)
					+ "' when given '"
					+ objectName(given)
					+ "'.");
			}
		},

		/*
			Lambdas consist of a parameters list (an array of names) and compiled JS code comprising its body.
		*/
		create(params, kind, jscode) {
			/*
				For the following comparisons, the params' insensitive names are used.
			*/
			const insensitiveParams = params.map(insensitiveName);
			/*
				Check if all of the params are unique or not.
			*/
			const nonunique = params.filter((e,i)=>insensitiveParams.indexOf(insensitiveName(e)) !== i);
			if (nonunique.length) {
				return TwineError.create('syntax', 'This lambda has two parameters named \'' + nonunique[0] + '\'.',
					'Lambdas should have all-unique parameter names.');
			}
			/*
				All checks have now succeeded.
			*/
			return Object.assign(Object.create(this), { params, kind, jscode });
		},

		/*
			Macros call this method to apply the lambda to a series of provided values.
			This needs to have the macro's section passed in so that its JS code can be eval()'d in
			the correct scope.
		*/
		apply(section, ...args) {
			/*
				We run the JS code of this lambda, inserting the arguments by adding them to a "tempVariables"
				object. The tempVariable references in the code are compiled to VarRefs for tempVariables.
			*/
			section.stack.unshift(Object.assign(Object.create(null), {tempVariables: Object.create(VarScope)}));
			return section.eval(this.params.map((name, i) => "section.stack[0].tempVariables['" + name + "'] = " + toJSLiteral(args[i])).join(";")
				+ ";" + this.jscode || '');
		},
	});
	return Lambda;
});
