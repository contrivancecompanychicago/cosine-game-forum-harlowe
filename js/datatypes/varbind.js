"use strict";
define(['utils'], ({assertMustHave}) => {
	/*
		VarBinds provide a means for certain UI input macros like (textarea:) to bind changes to their contents
		to a variable.

		They are unobservable - attempts to store them or use them in any other macros must fail.
	*/
	
	const VarBind = Object.freeze({
		/*
			These should normally only appear during type signature error messages.
		*/
		TwineScript_TypeName: "a bound variable",
		TwineScript_ObjectName: "a bound variable",

		TwineScript_Unstorable: true,
		
		/*
			bind is either "one way" (the DOM element's first provided value is automatically selected and
			written to the variable) or the NOT implemented "two way" (the macro's contained value determines which option in
			the DOM element is initially selected, and continues to affect the DOM element if the variable is remotely
			changed).
		*/
		create(varRef, bind = "one way") {
			// Assert: dest is a varRef
			assertMustHave(varRef, ["varref"]);
			
			return Object.assign(Object.create(this), { varRef, bind });
		},
	});
	return VarBind;
});
