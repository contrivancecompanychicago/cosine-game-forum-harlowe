"use strict";
define([], () => {
	/*d:
		CodeHook data

		Only used by the (macro:) macro, CodeHooks are where the inner code of the custom macro is written. Unlike actual hooks, these are written inside
		the macro call, as data provided to it. The contents of this hook will not be displayed when the custom macro runs, so you can put any number
		of comments and remarks inside it, for your own benefit.

		Like other exotic data types in Harlowe, this cannot be stored in variables using (set:) or (put:).
	*/
	return Object.freeze({
		
		/*
			These should normally only appear during type signature error messages.
		*/
		TwineScript_TypeName: "a code hook",
		TwineScript_ObjectName: "a code hook",

		TwineScript_Unstorable: true,
		
		create(html) {
			return Object.assign(Object.create(this), { html });
		},
	});
});
