"use strict";
define([], () => {
	/*
		AssignmentRequests represent an assignment statement. Different
		macros may handle this request differently (for instance,
		a (remember:) macro may save the value to localStorage).
		
		They take a VarRef (a basic object with "object" and "propertyChain" properties)
		and do something to it with a value (which could be another VarRef, in case
		a macro wished to manipulate it somehow).

		They are unobservable - attempts to store them or use them in any other macros must fail.
	*/
	
	const assignmentRequest = Object.freeze({
		
		assignmentRequest: true,
		
		/*
			These should normally only appear during type signature error messages.
		*/
		TwineScript_TypeName: "a 'to' or 'into' expression",
		TwineScript_ObjectName: "a 'to' or 'into' expression",

		TwineScript_Unstorable: true,
		
		create(dest, src, operator) {
			/*
				AssignmentRequests currently cannot accept rest TypedVars. However, due to the compiler giving spread
				higher precedence than "to" or "into", it's currently not possible for AssignmentRequests to be generated
				that have spread TypedVars as their arguments anyway.
			*/
			return Object.assign(Object.create(this), {
				dest:              dest,
				src:               src,
				operator:          operator,
			});
		},
	});
	return assignmentRequest;
});
