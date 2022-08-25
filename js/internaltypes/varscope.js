"use strict";
define('internaltypes/varscope', [], () => {
	/*
		VarScope.
		This is a root prototype object which houses temporary variables, inside a Section's stack.
		This isn't frozen so that its values can be overridden.
	*/
	return Object.seal({
		/*
			Note that it's not possible for userland TwineScript to directly access or
			modify this base object.
		*/
		TwineScript_ObjectName: "the temporary variables",
		/*
			This is used to distinguish to (set:) that this is a variable store,
			and assigning to its properties does affect game state.
			This should be overridden by instances created in Section.js.
		*/
		TwineScript_VariableStore: { type: 'temp', name: "an unknown scope" },

		/*
			Also like story state, this has a TypeDefs object holding types for its variables, and is used
			as the prototype for inheriting scopes' TypeDefs.
		*/
		TwineScript_TypeDefs: Object.create(null),

	});
});
