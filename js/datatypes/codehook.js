"use strict";
define(['internaltypes/twineerror', 'renderer'], (TwineError, {exec}) => {
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
		
		TwineScript_ToSource() {
			return "[" + this.source + "]";
		},

		/*
			To save on processing when running custom macros, CodeHooks store their pre-compiled HTML.
			Passages could do this, too, but there isn't currently much call for it, since they're usually
			visited only a few times.
			Note that revived values from (loadgame:) don't have HTML, so they need to be
			compiled anyway...
		*/
		create(source, html) {
			if (!html) {
				html = exec(source);
			}
			const error = TwineError.containsError(html);
			if (error) {
				return error;
			}
			return Object.assign(Object.create(this), { source, html });
		},
	});
});
