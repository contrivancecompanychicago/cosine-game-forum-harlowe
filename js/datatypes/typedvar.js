"use strict";
define([], () => {
	/*d:
		TypedVar data

		TBW
	*/
	/*
		TODO: bring in a lot of stuff from TypeSignature in Macros for this.
	*/
	return Object.freeze({
		TwineScript_TypeName: "a typed variable",
		TwineScript_ObjectName: "a typed variable",

		TwineScript_Unstorable: true,
		
		create(datatype, temp, name) {
			return Object.assign(Object.create(this), {
				datatype,
				temp, name
			});
		},
	});
});
