"use strict";
define(['utils/operationutils','datatypes/datatype', 'internaltypes/varref', 'internaltypes/twineerror'], ({typeName, matches, toSource, unstorableValue}, Datatype, VarRef, TwineError) => {
	const {freeze,assign,create} = Object;
	/*d:
		TypedVar data

		Typed variable names combine a datatype or a pattern of data, and the name of a variable, joined by adding the `-type` suffix to the datatype. `str-type _name` defines
		a typed variable, _name, which can only be set to a string. `(a: num)-type $a` defines a typed variable, $a, which can only be set to an array with 1 number value inside.

		Typed variable names are used in several places – (set:), (put:) and (move:) can be given typed variables in place of normal variables to restrict that variable
		to the given type, and ensure all future uses of that variable maintain that restriction. Typed variables are also used by the (macro:) macro to specify
		the input data for your custom macros, and ensure users of that macro maintain those restrictions. Finally, typed temp variables can be used in lambdas, to
		guarantee that the lambda is being used with the correct type of data.

		The ability to restrict the type of data that your variables and custom macros receive is a great assistance in debugging your stories,
		as well as understanding what the variable or macro is and does - especially if they were written by someone else and imported into the project.

		TypedVars used with the (macro:) macro support an additional feature. When a TypedVar is a plain datatype name preceded with the `...` spread operator, such as in `...str-type _a`,
		then it becomes a spread typed variable, which represents an arbitrary number of values. Giving multiple values of the given type at or after such a position will cause an array
		containing those values to be put into the named variable.
		
		Typed variables, when retrieved from a custom macro's "params" array, have two data names that you can examine.

		| Data name | Example | Meaning
		|---
		| `name` | `$customMac's params's 1st's name`, `name of 1st of params of $customMac` | The name of the typed variable. `(num-type _grains)'s name` is `"grains"`.
		| `datatype` | `$customMac's params's 1st's datatype`, `datatype of 1st of params of $customMac` | The datatype of the typed variable. `(num-type _grains)'s datatype` is `num`.

		For more details, consult the (set:) and (macro:) articles.
	*/
	const TypedVar = freeze({
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
			return assign(create(TypedVar), {
				datatype: this.datatype.TwineScript_Clone(),
				varRef: this.varRef,
			});
		},

		TwineScript_ToSource() {
			/*
				This must use toSource(), as the datatype could be a data pattern, such as an array.
			*/
			return toSource(this.datatype) + "-type " + this.varRef.TwineScript_ToSource();
		},
		TwineScript_GetProperty(prop) {
			return prop === "name" ? this.getName() : this[prop];
		},
		TwineScript_Properties: ['datatype', 'name'],

		/*
			The presence of this property allows TypedVars to be used in "matches" patterns.
		*/
		TwineScript_IsTypeOf(val) {
			return matches(this.datatype, val);
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
			if (this.datatype.name !== "any") {
				return this.varRef.defineType(this.datatype);
			}
		},

		create(datatype, varRef) {
			/*
				Errors caught during compiling (and converted to TwineError instantiations) should be returned
				here.
			*/
			let error;
			if ((error = TwineError.containsError(varRef) || TwineError.containsError(datatype) ||
					/*
						This handles wrapped VarRef errors (those created by VarRef.create()).
					*/
					varRef.error)) {
				return error;
			}
			/*
				TODO: Should this check even be here, or in runtime?
			*/
			if (!VarRef.isPrototypeOf(varRef)) {
				return TwineError.create('syntax', "The -type syntax must have a variable to its right.");
			}
			/*
				TypedVars can only have storable data as datatypes, like "(a:num,num)-type $a". The exception is, of course, structures containing TypedVars
				themselves, such as (p: "Red", alnum-type _a), which should still be permitted.
			*/
			const unstorable = unstorableValue(datatype);
			if (unstorable && !TypedVar.isPrototypeOf(unstorable)) {
				return TwineError.create("syntax", "The -type syntax can't have " + typeName(unstorable) + ' to its left.');
			}
			return assign(create(this), {
				datatype,
				varRef,
			});
		},
	});
	return TypedVar;
});
