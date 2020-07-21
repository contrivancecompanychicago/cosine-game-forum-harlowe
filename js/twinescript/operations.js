"use strict";
define([
	'jquery',
	'state',
	'datatypes/assignmentrequest',
	'utils/operationutils',
	'internaltypes/varref',
	'datatypes/typedvar',
	'internaltypes/twineerror',
],
($, State, AssignmentRequest, {isObject, collectionType, is, isA, clone, unique, contains, matches, typeName, objectName}, VarRef, TypedVar, TwineError) => {
	/*
		Operation objects are a table of operations which TwineScript proxies
		for/sugars over JavaScript. These include basic fixes like the elimination
		of implicit type coercion and the addition of certain early errors, but also
		includes support for new TwineScript operators, overloading of old operators,
		and other things.
	*/
	let Operations,
		/*d:
			it -> Any

			This keyword is a shorthand for the closest leftmost value in an expression. It lets you write
			`(if: $candles < 2 and it > 5)` instead of `(if: $candles < 2 and $candles > 5)`, or `(set: $candles to it + 3)`
			instead of `(set: $candles to $candles + 3)`. (You can't, however, use it in a (put:) or (move:) macro:
			`(put:$red + $blue into it)` is invalid.)

			Since `it` uses the closest leftmost value, `(print: $red > 2 and it < 4 and $blue > 2 and it < 4)` is the same as
			`(print: $red > 2 and $red < 4 and $blue > 2 and $blue < 4)`.

			`it` is case-insensitive: `IT`, `iT` and `It` are all acceptable as well.

			In some situations, the `it` keyword will be *inserted automatically* by Harlowe when the story runs. If you write an
			incomplete comparison expression where the left-hand side is missing, like `(print: $red > 2 and < 4)`,
			then, when running, the `it` keyword will automatically be inserted into the absent spot - producing, in this case,
			`(print: $red > 2 and it < 4)`. Note that in situations where the `it` keyword would not have an obvious value, such as
			`(print: < 4)`, an error will result nonetheless.

			If the `it` keyword equals a datamap, string, array, or other "collection" data type, then you can access data values
			using the `its` variant - `(print: $red is 'egg' and its length is 3)` or `(set:$red to its 1st)`. Much like the `'s`
			operator, you can use computed values with `its` - `(if: $red's length is 3 and its $position is $value)` will work as
			expected.

			Added in: 1.0.0
		*/
		/*
			The "it" keyword is bound to whatever the last left-hand-side value
			in a comparison operation was. Since its scope is so ephemeral,
			it can just be a shared identifier right here.
		*/
		It = 0;
	
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
					"I can only "
						+ operationVerb + " " + type + "s, not "
						+ objectName(typeof left !== type ? left : right)
						+ ".",
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
				const msg = objectName(left) + " isn't the same type of data as " + objectName(right);
				return TwineError.create("operation",
					msg[0].toUpperCase() + msg.slice(1)
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
			It = left;
			let [determinerValue, otherValue] = left.determiner ? [left,right] : right.determiner ? [right,left] : [];
			if (determinerValue) {
				const { determiner } = determinerValue;
				/*
					The "start" and "end" determiners are implemented here. They involve progressively marching through each subsequence from the start
					or end of the value, and comparing to the other side until a true (or, if negated, false) match is found.
				*/
				if (determiner === "start" || determiner === "end") {
					if (disallowStartEnd) {
						return TwineError.create("operation", "I can't use '" + disallowStartEnd + "' with the 'start' or 'end' of " + objectName(determinerValue) + ".");
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
							Now the other side is an "any" or "all" determiner. Swap the determiners' order, because "start of X [op] all of Y" only
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
					All that remains are the "any" and "all" determiners.
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
		
		/*
			While for the most part Operations is static, instances should
			nonetheless be created...
		*/
		create(section) {
			/*
				The only varying state that an Operations instance would have,
				compared to the prototype, is this "section" argument.
			*/
			
			const ret = Object.create(this);
			
			/*
				This contains special runtime identifiers which may change at any time.
			*/
			ret.Identifiers = {

				/*
					This signifier is used solely by VarRef to determine if Identifiers is being
					used as an assignment destination.
				*/
				TwineScript_Identifiers: true,

				get it() {
					return It;
				},
				
				/*d:
					time -> Number

					This keyword evaluates to the number of milliseconds passed since the passage
					was displayed. Its main purpose is to be used alongside changers
					such as (live:), (event:) or (link:). `(link:"Click")[(if: time > 5s)[...]]`, for instance,
					can be used to determine if 5 seconds have passed since this passage was displayed,
					and thus whether the player waited 5 seconds before clicking the link.

					It's recommended that you compare values of time using the `ms` or `s` suffixes for number data.
					See the article on number data for more information.

					When the passage is initially being rendered, `time` will be 0.

					`time` used in (display:) macros will still produce the time of the host passage, not the
					contained passage. So, you can't use it to determine how long the (display:)ed passage
					has been present in the host passage.

					Added in: 1.0.0
				*/
				/*
					The "time" keyword binds to the number of milliseconds since the passage
					was rendered.
			
					It might be something of a toss-up whether the "time" keyword should
					intuitively refer to the entire passage's lifetime, or just the nearest
					hook's. I believe that the passage is what's called for here.
				*/
				get time() {
					/*
						This can't be used during storylet speculation, for obvious reasons.
					*/
					if (section.stackTop && section.stackTop.evaluateOnly) {
						return TwineError.create("operation", "'time' can't be used in " + section.stackTop.evaluateOnly + ".");
					}
					return (Date.now() - section.timestamp);
				},
				/*d:
					visits -> Number

					Also known as: visit

					This keyword (which can alternatively be written as "visit") evaluates to the number of times
					the current passage has been visited this game, including the current visit. In (storylet:) macros,
					when Harlowe decides whether this passage is available to (open-storylets:), this will often be 0, but when
					actually visiting the passage, it will be at least 1.

					Its main purpose is to be used in (if:) macros, such as `(if: visits is 1)`, or `(if: visits > 4)`. If you
					use one particular formulation a lot in your story, such as `(if: visits is 1)`, you can (set:) the (if:)
					into a variable using `(set: $first to (if:visits is 1))` and then use $first in its place, such as in
					`$first[You've discovered a new island.]`.

					Similarly, it is also useful with the (cond:) and (nth:) macros - the latter letting you simply use `visit`
					as its first value to vary the results based on the number of times the passage is visited.

					`visits` used in (display:) macros will still produce the number of times the host passage was visited,
					not the contained passage. So, you can't use it to determine how many times the (display:)ed passage
					has been (display:)ed.

					Added in: 3.1.0
				*/
				get visits() {
					const {stackTop:{speculativePassage}} = section;
					return State.pastPassageNames().filter(name => name === (speculativePassage || State.passage)).length
						// Only add 1 (counting the current visit) if this isn't speculation, or the speculative passage equals State.passage (i.e. we're at that passage now).
						+ (!speculativePassage || speculativePassage === State.passage);
				},

				get visit() {
					return ret.Identifiers.visits;
				},

				/*d:
					exits -> Number

					Also known as: exit
					
					This keyword (which can alternatively be written as "exit") evaluates to the number of currently available "exits"
					in a passage - the number of link, mouseover, and mouseout elements that are active on the page, which could lead to new content and progress.

					This keyword is designed to be used with (live:) and (event:) - you can make a hook only
					be revealed when a certain number of exits are available, with `(event: when exits < 3)` and similar. The (more:) macro is a shorthand
					form for `(event: when exits is 0)`.

					The complete list of elements considered to be "exit" elements is as follows:
					* Links created by (link:), (link-repeat:), (link-reveal:), (link-goto:), (link-reveal-goto:), and (link-show:).
					* Passage links (which are the same as (link-goto:) links).
					* Links created by (click:), (click-replace:), (click-append:), (click-prepend:), and (click-goto:).
					* Mouseover areas created by (mouseover:), (mouseover-replace:), (mouseover-append:), (mouseover-prepend:), and (mouseover-goto:).
					* Mouseout areas created by (mouseout:), (mouseout-replace:), (mouseout-append:), (mouseout-prepend:), and (mouseout-goto:).

					Do note the following, however.
					* Multiple passage links that lead to the same passage (such as `[[A->Dead]] [[B->Dead]] [[C->Dead]]`) are all counted separately.
					* As of Harlowe 3.1.0, this does not consider (link-undo:) macros to be exits, as they tend to only undo game progress.
					* This will also not consider (event:) or (live:) macros to be exits, even if they are guaranteed to display their hooks
					eventually.
					* As with macros like (replace:), the `exits` keyword can't see forward to forthcoming elements, unless they've
					already appeared. For instance, the (print:) in `(print:exits is 1) [[Retreat->Hall]]` will show `false`, because the link after it
					hasn't appeared in the passage yet, but the (print:) in `(live:20s)[(print:exits is 1)] [[Retreat->Hall]]`
					will show `true`.
					* This can't be used in a (storylet:)'s lambda, because those lambdas are only checked when you're outside the passage.

					Finally, the "undo" and "redo" links in the sidebar will not be counted, either.

					Added in: 3.1.0
				*/
				get exits() {
					/*
						This can't be used during storylet speculation, for obvious reasons.
					*/
					if (section.stackTop && section.stackTop.evaluateOnly) {
						return TwineError.create("operation", "'exit' and 'exits' can't be used in " + section.stackTop.evaluateOnly + ".");
					}
					return section.dom.find('tw-enchantment, tw-link')
						.filter((_,e) =>
							$(e).data('enchantmentEvent') ||
							$(e).parent().data('linkPassageName')  ||
							/*
								Currently, (link:) <tw-link>s' parent <tw-hook>s have the clickEvent on them,
								which makes sense in the context of changeDescriptors (the link is created by
								replacing the <tw-hook>'s contents with the <tw-link> and giving the hook the
								clickEvent) but does feel a little #awkward.
							*/
							$(e).parent().data('clickEvent'))
						.length;
				},

				get exit() {
					return ret.Identifiers.exits;
				},

				/*d:
					pos -> Number

					Used exclusively in lambdas, this keyword evaluates to the position of the current data value that this lambda is processing.

					Consider a macro that uses lambdas, such as (altered:) - you give it a lambda, and then one or more data values, such as
					in `(altered: via it + (str:pos), "A","B","C")`. When the lambda is processing "A", the pos identifier is 1, for "B" it's 2, and for
					"C" it's 3. This can be used for a number of purposes. You can attach an ascending number to each data value, as in that example.
					You can make only odd-numbered values be altered by using `(cond: pos is an odd, it, it + (str:pos))` (which uses the "odd" datatype).
					You can make every third value be followed by a comma, by using `(cond: pos % 3 is 2, it, it + ',')`.

					Note that this only corresponds to the position of the values when given to the macro - if you use the `...` operator to spread arrays'
					values into a macro, such as `(find: where it is > pos, ...$array1, ...$array2, ...$array3)`, then values from $array2 and $array3 will not
					have a pos that corresponds to their placement inside those arrays, but rather relative to all of the values, including those in $array1.

					Make sure you do NOT write this as `its pos` - the pos is not a data value of the data itself! If `it` was `(dm:'HP',20,'XP',12)`, `its pos`
					would cause an error, as there is no "pos" value in that datamap.

					Using this anywhere other than a lambda, or using it in a 'when' lambda (which doesn't operate over a sequence of values), will cause an error.

					Added in: 3.1.0
				*/
				get pos() {
					if (!section.stackTop || section.stackTop.evaluateOnly || !section.stackTop.lambdaPos) {
						return TwineError.create("operation", "'pos' can only be used in lambdas that aren't 'when' lambdas.");
					}
					/*
						This really, really should never be a non-number, but just in case...
					*/
					return +section.stackTop.lambdaPos || 1;
				}
			};
			
			return ret;
		},

		/*
			This is used to implement "elided comparisons", such as (if: $A is $B or $C).
			The right side, "or $C", is converted to "elidedComparisonOperator('or', 'is', $C)".
			If $C is boolean, then the expression is considered to be (if: $A is ($B or $C)),
			as usual. But, if it's not, then it's (if: ($A is $B) or ($A is $C)).
		*/
		elidedComparisonOperator(logicalOp, comparisonOp, ...values) {
			return values.reduce((result, value) => {
				if (typeof value === 'boolean') {
					return value;
				}
				return Operations[logicalOp](
					result,
					Operations[comparisonOp](It, value)
				);
			},
			// This is true when logicalOp is "and", and false for "or" -
			// that is, the identity values for those operations.
			logicalOp === "and");
		},
		
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
			return TwineError.create("operation", "I can't use + on " + objectName(l) + ".");
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
			return TwineError.create("operation", "I can't use - on " + objectName(l) + ".");
		}),
		"*":  onlyPrimitives("number", doNotCoerce((l, r) => l * r), "multiply"),
		"/":  onlyPrimitives("number", doNotCoerce((l, r) => {
			if (r === 0) {
				return TwineError.create("operation", "I can't divide " + objectName(l) + " by zero.");
			}
			return l / r;
		}), "divide"),
		"%":  onlyPrimitives("number", doNotCoerce((l, r) => {
			if (r === 0) {
				return TwineError.create("operation", "I can't modulo " + objectName(l) + " by zero.");
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
			The only user-produced value which is passed into this operation is the bool -
			the passVal and failVal are internally supplied.
		*/
		where(bool, passVal, failVal) {
			let err;
			if ((err = TwineError.containsError(bool))) {
				return err;
			}
			if (typeof bool !== "boolean") {
				return TwineError.create("operation",
					"This lambda's 'where' clause must evaluate to true or false, not "
					+ objectName(bool)
					+ ".");
			}
			return bool ? passVal : failVal;
		},

		/*
			This takes a plain value assumed to be an array, and wraps
			it in a special structure that denotes it to be spreadable.
			This is created by the spread (...) operator.
		*/
		makeSpreader(val) {
			return {
				value: val,
				spreader: true,
				/*
					If a spreader is erroneously put in brackets (such as (...$arr)) then
					it becomes isolated as an object, and thus observable.
				*/
				TwineScript_TypeName: "a spreaded '...' value",
				TwineScript_ObjectName: "a spreaded '...' value",
				TwineScript_Unstorable: true,
			};
		},

		/*
			And here is the function for creating AssignmentRequests.
			Because a lot of error checking must be performed, and
			appropriate error messages must be generated, all of this
			is part of TwineScript instead of the AssignmentRequest module.
		*/
		makeAssignmentRequest(dest, src, operator) {
			const
				/*
					Refuse if the object or value is an error.
				*/
				error = TwineError.containsError(dest, src);
			
			if (error) {
				return error;
			}
			
			// The input is all clear, it seems.
			return AssignmentRequest.create(dest, src, operator);
		},
		
		/*
			This helper function sets the It identifier to a passed-in VarRef,
			while returning the original VarRef.
			This can't be combined with makeAssignmentRequest, because the 'it'
			identifier is often immediately used by the second argument of makeAssignmentRequest,
			such as in "(set:$b to its 1st)", which compiles to:

			Operations.makeAssignmentRequest(Operations.setIt(VarRef.create(State.variables,"b")),VarRef.create(Operations.Identifiers.it,"1st").get())
		*/
		setIt(e) {
			/*
				Only set the it identifier if the given value is a VarRef or TypedVar.
				Notice that this also returns errors.
			*/
			if (!(VarRef.isPrototypeOf(e) || TypedVar.isPrototypeOf(e))) {
				return e;
			}
			return (It = e.get()), e;
		},

		/*
			This, however, is more low-level: instead of being directly called from compiled
			user code, it is called indirectly in order to discreetly mutate the "it" identifier.
			To underscore that this must not be called from user code, it returns undefined.
		*/
		initialiseIt(e) {
			It = e;
		},
	};
	return Object.freeze(Operations);
});
