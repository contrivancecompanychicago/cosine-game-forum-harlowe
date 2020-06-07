"use strict";
define(['utils/operationutils','datatypes/datatype', 'internaltypes/varref', 'internaltypes/twineerror'], ({objectName}, Datatype, VarRef, TwineError) => {
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
			*/
			if (!VarRef.isPrototypeOf(varRef) || varRef.propertyChain.length !== 1) {
				return TwineError.create("operation", "I can't set the datatype of anything other than a single variable or temp variable.");
			}
			if (!Datatype.isPrototypeOf(datatype)) {
				return TwineError.create("syntax", "The -type syntax should only have a datatype name on the left side of it, not " + objectName(datatype) + '.');
			}
			return Object.assign(Object.create(this), {
				datatype,
				varRef
			});
		},
	});
});
