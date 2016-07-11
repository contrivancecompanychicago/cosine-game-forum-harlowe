define(['utils'], ({assertMustHave}) => {
	/*
		AssignmentRequests represent an assignment statement. Different
		macros may handle this request differently (for instance,
		a (remember:) macro may save the value to localStorage).
		
		They take a VarRef (a basic object with "object" and "propertyChain" properties)
		and do something to it with a value (which could be another VarRef, in case
		a macro wished to manipulate it somehow).

		They are unobservable - attempts to store them or use them in any other macros must fail.
	*/
	"use strict";
	
	const assignmentRequest = Object.freeze({
		
		assignmentRequest: true,
		
		/*
			These should normally only appear during type signature error messages.
		*/
		TwineScript_TypeName: "an assignment operation",
		TwineScript_ObjectName: "an assignment operation",

		TwineScript_Unstorable: true,
		
		create(dest, src, operator) {
			// Assert: dest is a varRef
			assertMustHave(dest, ["propertyChain", "object"]);
			
			return Object.assign(Object.create(this), {
				dest:              dest,
				src:               src,
				operator:          operator,
			});
		},
	});
	return assignmentRequest;
});
