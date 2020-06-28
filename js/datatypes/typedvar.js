"use strict";
define(['utils/operationutils','datatypes/datatype', 'internaltypes/varref', 'internaltypes/twineerror'], ({objectName}, Datatype, VarRef, TwineError) => {
	/*d:
		TypedVar data

		Typed variables combine a datatype and a variable, joined by adding the `-type` suffix to the datatype. `str-type _name` defines a typed variable, _name,
		which can only be set to a string. You can add the `-type` suffix to anything that contains a datatype - `$leonsKickassDatatype-type _option` is valid
		if $leonsKickassDatatype contains a datatype.

		Typed variables are used in two places – (set:), (put:) and (move:) can be given typed variables in place of normal variables to restrict that variable
		to the given type, and ensure all future uses of that variable maintain that restriction. Typed variables are also used by the (macro:) macro to specify
		the input data for your custom macros, and ensure users of that macro maintain those restrictions.

		The ability to restrict the type of data that your variables and custom macros receive is a great assistance in debugging your stories,
		as well as understanding what the variable or macro is and does - especially if they were written by someone else and imported into the project.

		When a TypedVar is preceded with the `...` spread operator, such as in `...str-type _a`, then it becomes a spread typed variable, which represents an arbitrary
		number of values. Giving multiple values of the given type at or after such a position will cause an array containing those values to be put into the named variable.

		For more details, consult the (macro:) macro's article.
	*/
	return Object.freeze({
		TwineScript_TypeName: "a typed variable",
		get TwineScript_ObjectName() {
			return this.TwineScript_ToSource();
		},

		TwineScript_Unstorable: true,

		TwineScript_ToSource() {
			return this.datatype.TwineScript_ToSource() + "-type " + this.varRef.TwineScript_ToSource();
		},

		/*
			The compiler requires that TypedVars, which can be used in place of an ordinary VarRef in a (set:) call,
			also have a get() method.
		*/
		get() {
			return this.varRef.get(...arguments);
		},

		/*
			A convenience method that allows a TypedVar to directly define the type for its variable.
		*/
		defineType() {
			return this.varRef.defineType(this.datatype);
		},
		
		create(datatype, varRef) {
			/*
				Errors caught during compiling (and converted to TwineError instantiations) should be returned
				here.
			*/
			let error;
			if ((error = TwineError.containsError(varRef) || TwineError.containsError(datatype))) {
				return error;
			}
			/*
				Additionally, here we must perform type-checking for the "-type" operator.
				These checks are for: non-varrefs, error varrefs, and property accesses.
			*/
			if (!VarRef.isPrototypeOf(varRef) || varRef.error || varRef.propertyChain.length !== 1) {
				return TwineError.create("operation", "I can't set the datatype of anything other than a single variable or temp variable.");
			}
			if (!Datatype.isPrototypeOf(datatype)) {
				return TwineError.create("syntax", "The -type syntax should only have a datatype name on the left side of it, not " + objectName(datatype) + '.');
			}
			return Object.assign(Object.create(this), {
				datatype,
				varRef,
				rest: false,
			});
		},
	});
});
