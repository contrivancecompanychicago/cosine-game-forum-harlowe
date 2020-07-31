"use strict";
define(['utils/operationutils','datatypes/typedvar','internaltypes/varref','internaltypes/twineerror'], ({objectName, matches}, TypedVar, VarRef, TwineError) => {
	/*
		AssignmentRequests represent an assignment statement. Different
		macros may handle this request differently (for instance,
		a (remember:) macro may save the value to localStorage).
		
		They take a VarRef, TypedVar, or pattern (a data structure containing TypedVars), and do something to it with
		a value (which could be another VarRef, in case a macro wished to manipulate it somehow).

		They are unobservable - attempts to store them or use them in any other macros must fail.
	*/

	/*
		This function destructures a source data structure using a given pattern - TypedVars inside the pattern are interpreted as variable
		bindings, mapping directly to that location in the source data structure.

		This is used in two contexts: destructured assignment, and pattern-guarded lambdas. In the latter, a failed destructure
		should not result in an error, while in the former, it should. The former's strictness is signaled with required:true.

		This returns an array of { typedVar, value, src } triplets. If match failures were had, either the error message (if
		required is true) or boolean false (if required is false) is inserted into the array.
	*/
	function destructure(pattern, src, required = true) {
		let error, ret = [];
		/*
			If src is a VarRef, obtain its current value.
			Note that this could differ from its value at compilation time -
			in (set: $a to 1, $b to $a), the second $a has a different value to the first.
		*/
		let value;
		if (src && VarRef.isPrototypeOf(src)) {
			value = src.get();
		} else {
			value = src;
		}
		/*
			If the get() produced an error (though a bad property access on the source)
			then return it. This should be the only error that a non-required destructuring returns.
		*/
		if ((error = TwineError.containsError(value))) {
			return error;
		}
		/*
			Array destructuring involves destructuring each value in the pattern using each value in a corresponding position
			in the source. If no position exists in the source, and the destructuring is not optional, error.
		*/
		if (Array.isArray(value) && Array.isArray(pattern)) {
			/*
				While each value inside the array is type-checked separately by the recursive call, we still need to
				make sure beforehand that the source is long enough to fulfill the pattern.
			*/
			const discrepancy = (pattern.length - value.length);
			if (discrepancy > 0) {
				return required && TwineError.create("operation", "I can't de-structure this array because it needs " + (discrepancy) +
					" more value" + (discrepancy > 0 ? "s" : "") + ".");
			}
			/*
				Note that any errors produced by this recursive destructure will simply be put in the returned array, for
				destructure()'s consumer to deal with.
			*/
			pattern.forEach((p,i) => ret = ret.concat(destructure(p,
				/*
					For the sake of the (move:) macro, each recursive call should be given a VarRef of one level deeper than
					the previous VarRef.
				*/
				VarRef.isPrototypeOf(src) ? VarRef.create(src, i+1) : value[i])));
			return ret;
		}
		/*
			Map destructuring involves destructuring each source value whose name is present in the pattern.
		*/
		if (pattern instanceof Map && value instanceof Map) {
			for (let [k,p] of pattern.entries()) {
				if (!value.has(k)) {
					return required && TwineError.create("operation", "I can't de-structure this datamap because it needs a '" + k + "' data name.");
				}
				ret = ret.concat(destructure(p,
					VarRef.isPrototypeOf(src) ? VarRef.create(src, k) : value.get(k)));
			}
			return ret;
		}
		/*
			When encountering a TypedVar, perform type-checking using its datatype. This isn't strictly necessary for variable (set:)s,
			but is necessary for guarded lambdas and such.
		*/
		if (TypedVar.isPrototypeOf(pattern)) {
			/*
				Pattern datatypes can, themselves, be the subject of a TypedVar, such as in "(p:str,'!')-type _a".
			*/
			if (typeof pattern.datatype.destructure === "function") {
				return [{ dest:pattern, value, src }].concat(pattern.datatype.destructure(value));
			}
			/*
				Currently, the 'const' datatype silently passes this test, while failing later in set(). This should
				probably be changed to checking the const restriction here and now, as it is in varref.js.
			*/
			if (!matches(value, pattern.datatype)) {
				return [required && TwineError.create("operation", "I can't de-structure " + objectName(value) + " into "
					+ pattern.varRef.TwineScript_ToSource() + " because it doesn't match " + objectName(pattern.datatype) + ".")];
			}
			//TODO: implement support for spread TypedVars.
		}
		/*
			Whenever a VarRef is encountered (including the VarRef from the TypedVar just above), a new binding is added to the array.
		*/
		if (VarRef.isPrototypeOf(pattern) || TypedVar.isPrototypeOf(pattern)) {
			return ret.concat({ dest: pattern, value,
				/*
					Both the source's value (which was just analysed to perform this destructuring in the first place)
					and the src itself are included with the binding, in case src.delete() needs to be called after
					the set() has occurred (in the case of (move:)).
				*/
				src, });
		}
		/*
			Pattern datatypes appear to be opaque data, but have their own destructure() method in which they use their
			internal RegExp to obtain matches from the value.
		*/
		if (typeof pattern.destructure === "function") {
			return ret.concat(pattern.destructure(value));
		}
		/*
			Finally, plain values in the destructuring pattern should be matched using matches(), to check if the entire pattern should be
			invalidated or not.
		*/
		if (!matches(value, pattern)) {
			return required && TwineError.create("operation", "I tried to de-structure, but " + objectName(pattern) +
				" value in the pattern didn't match " + objectName(value) + ".");
		}
		return ret;
	}

	const assignmentRequest = Object.freeze({
		
		assignmentRequest: true,
		
		/*
			These should normally only appear during type signature error messages.
		*/
		TwineScript_TypeName: "a 'to' or 'into' expression",
		TwineScript_ObjectName: "a 'to' or 'into' expression",

		TwineScript_Unstorable: true,

		/*
			The (set:), (put:) and (move:) macros simply shell out most of their logic to this method of their AssignmentRequests.
			If this doesn't error, it returns a "debug message" string, which becomes a TwineNotifier message if Debug Mode is on.
		*/
		set(andDelete = false) {
			let error, debugMessage = [];
			const bindings = destructure(this.dest, this.src);
			if ((error = TwineError.containsError(bindings))) {
				return error;
			}
			/*
				If the binding had no VarRefs in it, then it was just a loose value being incorrectly assigned to.
			*/
			if (!bindings.length)  {
				return TwineError.create("operation",
					"I can't store a new value inside " + objectName(this.dest) + " that isn't in a variable.",
					"You need a variable, or a data structure containing variables at certain positions, to store the value.");
			}
			for (let {dest, value, src} of bindings
					/*
						A funny thing here: the bindings produced by destructure() are in left-to-right order.
						If these are array bindings, they consist of indices into the source array.
						However, if this is a (move:) macro call, then the successive delete()s below will misalign the
						source array, as each value is successively deleted. Reversing the array prevents this issue.
					*/
					.reverse()) {
				/*
					If this binding is a TypedVar, then this is also a type declaration.
				*/
				if(TypedVar.isPrototypeOf(dest)) {
					if ((error = TwineError.containsError(dest.defineType()))) {
						return error;
					}
					// Unwrap the varRef from the TypedVar.
					dest = dest.varRef;
				}
				error = dest.set(value);
				/*
					If the setting caused an error to occur, abruptly return the error.
				*/
				if (TwineError.isPrototypeOf(error)) {
					return error;
				}
				/*
					Using the specially-stashed src, delete the source value if this was called by a (move:) macro.
					Note that this is only performed if no error occurred.
				*/
				else if (andDelete && src) {
					src.delete();
				}
				/*
					As the bindings array was reversed, the debug messages' order needs to be unreversed
					(by using shift() instead of push() to stack them).
				*/
				debugMessage.shift(objectName(dest) + " is now " + objectName(value));
			}
			return debugMessage.join('; ');
		},
		
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
