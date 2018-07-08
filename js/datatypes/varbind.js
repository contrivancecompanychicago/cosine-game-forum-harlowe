"use strict";
define(['utils', 'utils/operationutils', 'internaltypes/varref', 'internaltypes/twineerror'], (Utils, {objectName}, VarRef, TwineError) => {
	/*
		VarBinds provide a means for certain UI input macros like (textarea:) to bind changes to their contents
		to a variable.

		They are unobservable - attempts to store them or use them in any other macros must fail.
	*/
	
	/*d:
		Bound Variable data

		A few macros that produce interactive elements, like (cycling-link:), have the ability to automatically update a variable whenever the
		player interacts with them. There needs to be a way to specify which variable these will update: simply giving the macro the variable
		itself, such as in `(cycling-link: $hat, "Poker visor", "Beret")`, won't work - the value that's currently inside `$hat` will be given
		instead, as one would expect for every other kind of macro. So, the `bind` keyword is needed to make your intent unambiguous:
		`bind $hat` produces a "bound variable".

		One can bind any kind of variable: story-wide variables like `$morality`, temp variables like `_glance`, and data values and positions
		inside them, like `$diary's 1st's event`. Once bound, the macro's element will set data to it automatically, as if by a series of
		unseen (set:)s or (move:)s.

		Note that bound variables can't be (set:) into variables themselves, because there's no real point to doing so (and it could lead to
		a lot of undue confusion).

		| Operator | Purpose | Example
		|---
		| `bind` | Binds the named variable on the right. | `bind $weapon`, `bind _hat`, `bind $profile's age`
	*/
	const VarBind = Object.freeze({
		/*
			These should normally only appear during type signature error messages.
		*/
		TwineScript_TypeName: "a bound variable",
		TwineScript_ObjectName: "a bound variable",

		TwineScript_Unstorable: true,

		/*
			Setting a value in a VarBind is fairly straightforward - simply set the varRef, and then pass up any errors.
		*/
		set(value) {
			const result = this.varRef.set(value);
			let error;
			if ((error = TwineError.containsError(result))) {
				return error;
			}
		},
		
		/*
			bind is either "one way" (the DOM element's first provided value is automatically selected and
			written to the variable) or the NOT implemented "two way" (the macro's contained value determines which option in
			the DOM element is initially selected, and continues to affect the DOM element if the variable is remotely
			changed).
		*/
		create(varRef, bind = "one way") {
			/*
				Produce a user-facing error if a non-varRef was given.
				Since "bind" is just another operator, this can't be picked up in compilation until now.
			*/
			if (!VarRef.isPrototypeOf(varRef)
					/*
						There's another kind of varRef-like object though: wrapped TwineErrors that have been given get() and set()
						methods. These don't have the VarRef prototype (because it's frozen and thus non-overridable) but
					*/
					&& !varRef.varref) {
				return TwineError.create("operation", "I can only 'bind' a variable, not " + objectName(varRef) + ".");
			}
			
			return Object.assign(Object.create(this), { varRef, bind });
		},
	});
	return VarBind;
});
