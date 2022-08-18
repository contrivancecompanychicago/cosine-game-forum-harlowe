"use strict";
define('twinescript/operations', [
	'utils',
	'utils/operationutils',
	'datatypes/typedvar',
	'datatypes/datatype',
	'internaltypes/twineerror',
],
({plural}, {isObject, collectionType, is, isA, clone, unique, contains, matches, objectName, toSource}, TypedVar, Datatype, TwineError) => {
	/*
		Operation objects are a table of operations which TwineScript proxies
		for/sugars over JavaScript. These include basic fixes like the elimination
		of implicit type coercion and the addition of certain early errors, but also
		includes support for new TwineScript operators, overloading of old operators,
		and other things.
	*/
	let Operations;
	
	/*
		Here are some wrapping functions which will be applied to
		the Operations methods, providing type-checking and such to their arguments.
	*/
	
	/*
		Wraps a function to refuse its arguments if one
		of them is not a certain type of primitive.
		@param {String} type Either "number" or "boolean"
		@param {Function} fn The function to wrap.
		@param {String} [operationVerb] A verb describing the function's action.
		@param {String} [message] An optional extra error message hint.
		@return {Function}
	*/
	function onlyPrimitives(type, fn, operationVerb, message) {
		operationVerb = operationVerb || "do this to";
		return (left, right) => {
			/*
				If the passed function has an arity of 1, ignore the
				right value.
			*/
			if (fn.length === 1) {
				right = left;
			}
			/*
				This part allows errors to propagate up the TwineScript stack.
			*/
			let error;
			if ((error = TwineError.containsError(left, right))) {
				return error;
			}
			if (typeof left !== type || typeof right !== type) {
				return TwineError.create(
					"operation",
					`I can only ${operationVerb} ${type}s, not ${objectName(typeof left !== type ? left : right)}.`,
					message
				);
			}
			return fn(left, right);
		};
	}
	
	/*
		Converts a function to type-check its two arguments before
		execution, and thus suppress JS type coercion.
	*/
	function doNotCoerce(fn) {
		return (left, right) => {
			/*
				This part allows errors to propagate up the TwineScript stack.
			*/
			let error;
			if ((error = TwineError.containsError(left, right))) {
				return error;
			}
			/*
				This checks that left and right are generally different types
				(both different typeof or, if both are object, different collection types)
			*/
			if (typeof left !== typeof right ||
				(
					isObject(left) && "TwineScript_TypeName" in left &&
					isObject(right) && "TwineScript_TypeName" in right &&
					left.TwineScript_TypeName !== right.TwineScript_TypeName
				) || collectionType(left) !== collectionType(right)) {
					/*
						TwineScript errors are handled by TwineScript, not JS,
						so don't throw this error, please.
					*/
				const msg = `${objectName(left)} isn't the same type of data as ${objectName(right)}`;
				/*
					Special hints for type conversion.
				*/
				let hint;
				if (typeof left + typeof right === "stringnumber" || typeof left + typeof right === "numberstring") {
					hint = "You might want to convert one side to a number using (num:), or to a string using (str:).";
				}
				return TwineError.create("operation",
					msg[0].toUpperCase() + msg.slice(1),
					hint
				);
			}
			return fn(left, right);
		};
	}
	
	/*
		Converts a function to handle "any", "all", "start" or "end" determiners and to set It after it is done.
		disallowStartEnd: if present, "start" or "end" can't be used with this operation.
		negative: this was wrapped by negativeComparisonOp. Used only for "start" or "end" determiner computation.
	*/
	function comparisonOp(fn, disallowStartEnd, negative = false) {
		const compare = (left, right) => {
			let error;
			if ((error = TwineError.containsError(left, right))) {
				return error;
			}
			let [determinerValue, otherValue] = left.determiner ? [left,right] : right.determiner ? [right,left] : [];
			if (determinerValue) {
				const { determiner, determined } = determinerValue;
				/*
					The "start" and "end" determiners are implemented here. They involve progressively marching through each subsequence from the start
					or end of the value, and comparing to the other side until a true (or, if negated, false) match is found.
				*/
				if (determiner === "start" || determiner === "end") {
					if (disallowStartEnd) {
						return TwineError.create("operation", `I can't use '${disallowStartEnd}' with the 'start' or 'end' of ${objectName(determined)}.`);
					}
					if (otherValue.determiner) {
						/*
							Because comparing two "start" or "end" determiners is rather pointless (since the empty sequence matches both)
							an error message is also produced for doing so.
						*/
						if (otherValue.determiner === "start" || otherValue.determiner === "end") {
							return TwineError.create("operation", "I can't compare one value's 'start' or 'end' with another value's 'start' or 'end'.",
								"Please change one of them to use an exact range, such as '1stto4th' or '2ndlasttolast'."
							);
						}
						/*
							Now the other side is a "some" ("any") or "all" determiner. Swap the determiners' order, because "start of X [op] all of Y" only
							functions correctly if the "all" is unwound before the "start", i.e. each value in "all" is separately run
							against each value in the "start", instead of vice-versa.
						*/
						[determinerValue, otherValue] = [otherValue, determinerValue];
					}
					/*
						Iterate through the value, using the string forms of strings or the array forms of arrays.
					*/
					const seq = determinerValue.string || determinerValue.array;
					for (let i = 0; i < seq.length+1; i += 1) {
						const slice =
							/*
								Base case: The "start" and "end" of values should compare positively to the empty sequence, which
								we produce by this slightly sly constructor call. This is also why the +1 is attached to the loop definition above.
							*/
							!i ? seq.constructor() :
							determiner === "end" ? seq.slice(-i) : seq.slice(0,i);

						const result = determinerValue === left ? compare(slice, right) : compare(left, slice);
						if ((error = TwineError.containsError(result))) {
							return error;
						}
						/*
							As above, negated operators like "is not in" need to operate until false is encountered, not true.
						*/
						if (result !== negative) {
							return result;
						}
					}
					return negative;
				}
				/*
					All that remains are the "some" ("any") and "all" determiners.
				*/
				const all = determiner === "all";
				/*
					Normally we'd use Array#every and Array#some here, but we also need
					to pull out any TwineErrors which are produced doing each of these
					comparisons. So, these looping methods are expanded as follows.
				*/
				return determinerValue.array.reduce((result, e) => {
					let error, next = determinerValue === left ? compare(e, right) : compare(left, e);
					if ((error = TwineError.containsError(result, next))) {
						return error;
					}
					return (all ? result && next : result || next);
				}, all);
			}
			return fn(left, right);
		};
		return compare;
	}

	/*
		This produces an inverted version of the comparisonOp, for use with "is not in" and such,
		but which also doesn't accidentally devour thrown TwineErrors.
	*/
	function negativeComparisonOp(fn, disallowStartEnd) {
		return comparisonOp((l, r) => {
			const ret = fn(l,r);
			return TwineError.containsError(ret) ? ret : !ret;
		}, disallowStartEnd, true);
	}

	const andOrNotMessage =
		"If one of these values is a number, you may want to write a check that it 'is not 0'. "
		+ "Also, if one is a string, you may want to write a check that it 'is not \"\" '.";
	
	/*
		Now, let's define the operations themselves.
	*/
	Operations = {
		
		and: onlyPrimitives("boolean", doNotCoerce((l, r) => l && r), "use 'and' to join", andOrNotMessage),
		
		or: onlyPrimitives("boolean", doNotCoerce((l, r) => l || r), "use 'or' to join", andOrNotMessage),
		
		not: onlyPrimitives("boolean", e => !e, "use 'not' to invert", andOrNotMessage),
		
		"+":  doNotCoerce((l, r) => {
			/*
				I'm not a fan of the fact that + is both concatenator and
				arithmetic op, but I guess it's close to what people expect.
				Nevertheless, applying the logic that a string is just as much a
				sequential collection as an array, I feel I can overload +
				on collections to mean immutable concatenation or set union.
			*/
			if (Array.isArray(l)) {
				/*
					Note that the doNotCoerce wrapper above requires that
					the right side also be an array.
				*/
				return [...l, ...r];
			}
			let ret;
			/*
				For Maps and Sets, create a new instance combining left and right.
				You may note that in the case of Maps, values of keys used on the
				right side trump those on the left side.
			*/
			if (l instanceof Map) {
				ret = new Map(l);
				r.forEach((v,k) => ret.set(k, v));
				return ret;
			}
			if (l instanceof Set) {
				return new Set([...l, ...r].filter(unique).map(clone));
			}
			/*
				If a TwineScript object implements a + method, use that.
			*/
			else if (typeof l["TwineScript_+"] === "function") {
				return l["TwineScript_+"](r);
			}
			/*
				Finally, if it's a primitive, we defer to JS's addition operator.
			*/
			if ("string|number|boolean".includes(typeof l)) {
				return l + r;
			}
			/*
				Having got this far, there's nothing else that can be added.
				Return an error.
			*/
			return TwineError.create("operation", `I can't use + on ${objectName(l)}.`);
		}),
		"-":  doNotCoerce((l, r) => {
			/*
				Overloading - to mean "remove all instances from".
				So, "reed" - "e" = "rd", and [1,3,5,3] - 3 = [1,5].
			*/
			if (Array.isArray(l)) {
				/*
					Note that the doNotCoerce wrapper above requires that
					the right side also be an array. Subtracting 1 element
					from an array requires it be wrapped in an (a:) macro.
				*/
				return l.filter(val1 => !r.some(val2 => is(val1, val2)));
			}
			/*
				Sets, but not Maps, can be subtracted.
			*/
			if (l instanceof Set) {
				const rvals = [...r];
				return new Set([...l].filter(val1 => !rvals.some(val2 => is(val1, val2))));
			}
			if (typeof l === "string") {
				/*
					This is an easy but cheesy way to remove all instances
					of the right string from the left string.
				*/
				return l.split(r).join('');
			}
			/*
				Finally, if it's a number, subtract it.
			*/
			if (typeof l === "number") {
				return l - r;
			}
			return TwineError.create("operation", `I can't use - on ${objectName(l)}.`);
		}),
		"*":  onlyPrimitives("number", doNotCoerce((l, r) => l * r), "multiply"),
		"/":  onlyPrimitives("number", doNotCoerce((l, r) => {
			if (r === 0) {
				return TwineError.create("operation", `I can't divide ${objectName(l)} by zero.`);
			}
			return l / r;
		}), "divide"),
		"%":  onlyPrimitives("number", doNotCoerce((l, r) => {
			if (r === 0) {
				return TwineError.create("operation", `I can't modulo ${objectName(l)} by zero.`);
			}
			return l % r;
		}), "modulus"),
		
		/*
			The right sides of these wrapped calls are names of this operation, for both onlyPrimitives() and comparisonOp().
		*/
		"<":  comparisonOp(onlyPrimitives("number", doNotCoerce((l,r) => l <  r), "do < to"), "<"),
		">":  comparisonOp(onlyPrimitives("number", doNotCoerce((l,r) => l >  r), "do > to"), ">"),
		"<=": comparisonOp(onlyPrimitives("number", doNotCoerce((l,r) => l <= r), "do <= to"), "<="),
		">=": comparisonOp(onlyPrimitives("number", doNotCoerce((l,r) => l >= r), "do >= to"), ">="),
		
		is: comparisonOp(is),
		isNot: negativeComparisonOp(is),
		contains: comparisonOp(contains, "contains"),
		doesNotContain: negativeComparisonOp(contains, "does not contain"),
		isIn: comparisonOp((l,r) => contains(r,l), "is in"),
		isNotIn: negativeComparisonOp((l,r) => contains(r,l), "is not in"),

		isA: comparisonOp(isA, "is a"),
		isNotA: negativeComparisonOp(isA, "is not a"),

		/*
			"typifies", the reverse of "is a", is currently not a user-exposed operator, but this is
			required so that the compiler can process elided comparisons like "$a is not a number or string".
		*/
		typifies: comparisonOp((l,r) => isA(r,l)),
		untypifies: negativeComparisonOp((l,r) => isA(r,l)),
		/*
			"matches", conversely, is symmetrical.
		*/
		matches: comparisonOp(matches),
		doesNotMatch: negativeComparisonOp(matches),

		/*
			This takes a plain sequence value, and wraps
			it in a special structure that denotes it to be spreadable.
			This is created by the spread (...) operator.
		*/
		makeSpreader(val) {
			if (TwineError.containsError(val)) {
				return val;
			}
			/*
				TypedVars and Datatypes have a special response to the spread operator: turn into
				"rest parameter" versions of themselves.
			*/
			if (TypedVar.isPrototypeOf(val) || Datatype.isPrototypeOf(val)) {
				const value2 = clone(val);
				(TypedVar.isPrototypeOf(val) ? value2.datatype : value2).rest = true;
				return value2;
			}
			return {
				value: val,
				spreader: true,
				/*
					If a spreader is erroneously put in brackets (such as (...$arr)) then
					it becomes isolated as an object, and thus observable.
				*/
				TwineScript_TypeName: "a spreaded '...' value",
				TwineScript_ObjectName: plural(typeof val === 'string' || Array.isArray(val) ? [...val].length : 1, "spreaded '...' value"),
				TwineScript_Unstorable: true,
				TwineScript_ToSource() {
					return ''+[...val].map(toSource);
				},
			};
		},
	};
	return Object.freeze(Operations);
});
