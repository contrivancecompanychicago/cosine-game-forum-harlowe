"use strict";
define(['utils/operationutils','datatypes/datatype', 'internaltypes/varref', 'internaltypes/twineerror'], ({objectName}, Datatype, VarRef, TwineError) => {
	/*d:
		TypedVar data

		Typed variables combine a datatype and the name of a variable, joined by adding the `-type` suffix to the datatype. `str-type _name` defines a typed variable, _name,
		which can only be set to a string. You can add the `-type` suffix to anything that contains a datatype - `$leonsKickassDatatype-type _option` is valid
		if $leonsKickassDatatype contains a datatype.

		Typed variables are used in several places – (set:), (put:) and (move:) can be given typed variables in place of normal variables to restrict that variable
		to the given type, and ensure all future uses of that variable maintain that restriction. Typed variables are also used by the (macro:) macro to specify
		the input data for your custom macros, and ensure users of that macro maintain those restrictions. Finally, typed temp variables can be used in lambdas, to
		guarantee that the lambda is being used with the correct type of data.

		The ability to restrict the type of data that your variables and custom macros receive is a great assistance in debugging your stories,
		as well as understanding what the variable or macro is and does - especially if they were written by someone else and imported into the project.

		When a TypedVar is preceded with the `...` spread operator, such as in `...str-type _a`, then it becomes a spread typed variable, which represents an arbitrary
		number of values. Giving multiple values of the given type at or after such a position will cause an array containing those values to be put into the named variable.
		
		Typed variables, when retrieved from a custom macro's "params" array, have two data names that you can examine.

		| Data name | Example | Meaning
		|---
		| `name` | `$customMac's params's 1st's name`, `name of 1st of params of $customMac` | The name of the typed variable. `(num-type _grains)'s name` is `"grains"`.
		| `datatype` | `$customMac's params's 1st's datatype`, `datatype of 1st of params of $customMac` | The datatype of the typed variable. `(num-type _grains)'s datatype` is `num`.

		For more details, consult the (set:) and (macro:) articles.
	*/
	return Object.freeze({
		TwineScript_TypeName: "a typed variable name",
		get TwineScript_ObjectName() {
			return this.TwineScript_ToSource();
		},

		TwineScript_Print() {
			return "`[A typed variable name]`";
		},
		TwineScript_Unstorable: true,

		/*
			Typed variables are immutable data.
		*/
		TwineScript_Clone() {
			return this;
		},

		TwineScript_ToSource() {
			return this.datatype.TwineScript_ToSource() + "-type " + this.varRef.TwineScript_ToSource();
		},
		TwineScript_GetProperty(prop) {
			return prop === "name" ? this.getName() : this[prop];
		},
		TwineScript_Properties: ['datatype', 'name'],

		/*
			The presence of this property allows TypedVars to be used in "matches" patterns.
		*/
		TwineScript_IsTypeOf(val) {
			return this.datatype.TwineScript_IsTypeOf(val);
		},

		/*
			The compiler requires that TypedVars, which can be used in place of an ordinary VarRef in a (set:) call, also have
			a get() method (for setting the It identifier).
		*/
		get() {
			return this.varRef.get(...arguments);
		},
		/*
			Sharing a getName() interface with varRef allows TypedVars to be interchangeable with VarRefs when used in lambdas
			and other places.
		*/
		getName() {
			return this.varRef.getName();
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
