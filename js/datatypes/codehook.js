"use strict";
define('datatypes/codehook', [], () => {
	/*d:
		CodeHook data

		Several macros, such as (dialog:) or (append-with:), are used to render some markup code stored in a string.
		However, markup code stored in strings can be difficult to write or read in the editor, because there's no syntax
		highlighting for the interior of string. It is also sometimes desirable to have markup code in strings appear
		different to other strings in Debug Mode, so that you can more easily tell what the string is used for in the game.

		CodeHooks can be used as alternatives to strings in these cases. You may think of them as "hooks" that
		are written inside macro calls, as data provided to them. Place markup code between `[` and `]` symbols, in the
		same way that strings are between pairs of `"` or `'` symbols.

		Note that unlike strings, you can nest hooks inside CodeHooks without needing to escape the `]` symbol.
		`(print:[Good afternoon.(if:visits > 1)[ I'm glad to see you again]])` is a valid CodeHook.

		The (macro:) macro only accepts CodeHooks for the inner code of the custom macro. The contents of this hook will not be displayed when the
		custom macro runs, so you can put any number of comments and remarks inside it, for your own benefit.
	*/
	const CodeHook = Object.freeze({
		
		/*
			These should normally only appear during type signature error messages.
		*/
		TwineScript_TypeName: "a code hook",
		TwineScript_ObjectName: "a code hook",
		
		TwineScript_ToSource() {
			return this.source;
		},

		/*
			Because printed values are pumped directly to renderInto, it's OK to return the code tree.
		*/
		TwineScript_Print() {
			return this.code;
		},

		TwineScript_toString() {
			return this.source;
		},

		TwineScript_is(other) {
			return CodeHook.isPrototypeOf(other) && this.source === other.source;
		},

		TwineScript_Clone() {
			/*
				Cloning is permitted to pass the code tree by reference, since there shouldn't be anything
				that can permute it.
			*/
			return CodeHook.create(this.code, this.source);
		},

		/*
			Note that revived values from (loadgame:) don't have HTML, so they need to be
			compiled anyway...
		*/
		create(code, source) {
			return Object.assign(Object.create(this), { code, source });
		},
	});
	return CodeHook;
});
