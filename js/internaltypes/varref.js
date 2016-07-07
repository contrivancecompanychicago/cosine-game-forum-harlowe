define(['state', 'internaltypes/twineerror', 'utils/operationutils', 'datatypes/hookset', 'datatypes/colour'],
(State, TwineError, {isObject, isSequential, objectName, clone, numericIndex, isValidDatamapName}, HookSet, Colour) => {
	'use strict';
	/*
		VarRefs are essentially objects pairing a chain of properties
		with an initial variable reference - "$red's blue's gold" would be
		a VarRef pairing $red with ["blue","gold"]. They represent variables
		in TwineScript source.
		Accessing variable values is compiled to a VarRef.get() call, setting
		them amounts to a VarRef.set() call made by the (set:) or (put:) macro,
		and deleting them amounts to a VarRef.delete() call.
	*/
	let VarRefProto;
	/*
		The default defaultValue, used for all uninitialised properties
		and variables, is 0.
	*/
	const defaultValue = 0;

	/*
		This converts a single TwineScript property index into a JavaScript property indexing
		operation.
		
		While doing so, it checks if a property name is valid, and returns
		an error instead if it is not.
		@return {String|Error}
	*/
	function compilePropertyIndex(obj, prop) {
		/*
			Check if it's a valid property name.
		*/
		let error;
		if (obj instanceof Map &&
				(error = TwineError.containsError(isValidDatamapName(obj,prop)))) {
			return error;
		}
		
		/*
			Sequentials have special sugar string property indices:
			
			length: this falls back to JS's length property for Arrays and Strings.
			1st, 2nd etc.: indices.
			last: antonym of 1st.
			2ndlast, 3rdlast: reverse indices.
		*/
		if (isSequential(obj)) {
			let match;
			/*
				Number properties are treated differently from strings by sequentials:
				the number 1 is treated the same as the string "1st", and so forth.
			*/
			if (typeof prop === "number") {
				if (prop === 0) {
					return TwineError.create("property", "You can't access elements at position 0 of "
					+ objectName(obj)
					+ ".",
					"Only positive and negative position values exist.");
				}
				/*
					Since JS arrays are 0-indexed, we need only subtract 1 from prop
					to convert it to a JS property index.
				*/
				else if (prop > 0) {
					prop -= 1;
				}
			}
			/*
				Given that prop is a string, convert "1st", "2ndlast", etc. into a number.
				Note that this glibly allows "1rd" or "2st".
				There's no real problem with this.
			*/
			else if (typeof prop === "string" && (match = /(\d+)(?:st|[nr]d|th)last/i.exec(prop))) {
				/*
					obj.length cannot be trusted here: if it's an astral-plane
					string, then it will be incorrect. So, just pass a negative index
					and let Operations.get() do the work of offsetting it after it
					deals with the astral characters.
				*/
				prop = -match[1] + "";
			}
			else if (typeof prop === "string" && (match = /(\d+)(?:st|[nr]d|th)/i.exec(prop))) {
				prop = match[1] - 1 + "";
			}
			else if (prop === "last") {
				prop = -1;
			}
			else if (prop !== "length") {
				return TwineError.create("property",
					"You can only access position strings/numbers ('4th', 'last', '2ndlast', (2), etc.) and 'length' of "
					+ objectName(obj) + ", not " + objectName(prop) + ".");
			}
		}
		/*
			Sets, being essentially a limited kind of arrays, cannot have any
			property access other than 'length'.
		*/
		else if (obj instanceof Set) {
			if (prop !== "length") {
				return TwineError.create("property", "You can only get the 'length' of a "
					+ objectName(obj)
					+ ".",
					"To check contained values, use the 'contains' operator.");
			}
			/*
				This kludge must be used to pave over a little difference
				between Arrays and Sets.
			*/
			prop = "size";
		}
		/*
			Numbers and booleans cannot have properties accessed.
		*/
		else if (typeof obj === "number" || typeof obj === "boolean") {
			return TwineError.create("property", "You can't get data values from "
				+ objectName(obj) + ".");
		}
		return prop;
	}

	function compilePropertyChain(object, propertyChain) {
		const compiledPropertyChain = propertyChain.reduce((arr, prop,i) => {
			/*
				If the property is computed, just compile its value.
			*/
			if (prop.computed) {
				prop = prop.value;
			}
			/*
				If prop is another VarRef (such as in "$b's ($a)") then read
				its value now.
			*/
			if (VarRefProto.isPrototypeOf(prop)) {
				prop = prop.get();
			}
			/*
				Properties can be single values, or arrays.
			*/
			if (Array.isArray(prop)) {
				prop = prop.map(prop => compilePropertyIndex(object, prop));
			}
			else {
				prop = compilePropertyIndex(object, prop);
			}

			/*
				Either the current compiled property contains an error, or a previous
				property resulted in an error. Due to the inability of .reduce to early-exit,
				we must check on every loop.
			*/
			let error;
			if ((error = TwineError.containsError(arr, prop))) {
				return error;
			}
			/*
				Obtain the object to use in the next iteration
				(if this isn't the last iteration)
			*/
			if (i < propertyChain.length-1) {
				object = get(object, prop);
			}
			arr.push(prop);
			return arr;
		},[]);

		return {
			compiledPropertyChain,
			deepestObject: object,
		};
	}

	/*
		As Maps have a different means of accessing stored values
		than arrays, these tiny utility functions are needed.
		They have the slight bonus that they can fit into some .reduce() calls
		below, which potentially offsets the cost of being re-created for each varRef.
		
		Note: strings cannot be passed in here as obj because of their UCS-2 .length:
		you must pass Array.from(str) instead.
	*/
	function objectOrMapGet(obj, prop) {
		if (obj === undefined) {
			return obj;
		} else if (obj instanceof Map) {
			return obj.get(prop);
		} else {
			/*
				As mentioned in compilePropertyIndex, obj.length
				cannot be accurately determined until here and now.
				Recall that unary + converts negative to positive, so
				"-0" must be used in its place.
			*/
			if (isSequential(obj) && prop-0 < 0 &&
					/*
						This should be <= because (a:1,2,3)'s (-3) should
						access the first element.
					*/
					Math.abs(prop) <= obj.length) {
				prop = obj.length + (prop-0);
			}
			if (obj.TwineScript_GetElement && Number.isFinite(+prop)) {
				return obj.TwineScript_GetElement(prop);
			} else {
				const ret = obj[prop];
				if (typeof ret !== "function") {
					return ret;
				}
			}
		}
	}
	
	/*
		A helper for canSet, and VarRef.get(), this renders computed indices
		in (brackets) and syntax indices in 'single-quotes', for
		error message purposes.
	*/
	function propertyDebugName(prop) {
		if (prop.computed) {
			if (typeof prop.value === "string") {
				return "('" + prop.value + "')";
			}
			return "(" + prop.value + ")";
		}
		return "'" + prop + "'";
	}
	
	/*
		Determine, before running objectOrMapSet, whether trying to
		set this property will work. If not, create a TwineError.
	*/
	function canSet(obj, prop) {
		/*
			As with get() below, array properties allow multiple property keys to be set at once.
		*/
		if (Array.isArray(prop)) {
			return prop.map(prop => canSet(obj, prop));
		}

		const
			// Error messages which must be identical in both cases where they are used.
			specialCollectionErrorMsg = "I won't add " + propertyDebugName(prop)
				+ " to " + objectName(obj)
				+ " because it's one of my special system collections.",
			writeproofErrorMsg = "I can't modify '" + propertyDebugName(prop)
				+ "' because it holds one of my special system collections.";

		/*
			HookRefs cannot be altered.
		*/
		if (HookSet.isPrototypeOf(obj)) {
			return TwineError.create('operation', "I can't modify " + objectName(obj),
				'You should alter hooks indirectly using macros like (replace:) or (enchant:).');
		}
		/*
			Neither can datasets.
		*/
		if (obj instanceof Set) {
			return TwineError.create('operation', "I can't modify " + objectName(obj),
				'You should use an (array:) if you need to modify the data inside this dataset.');
		}
		/*
			Neither can colours.
		*/
		if (Colour.isPrototypeOf(obj)) {
			return TwineError.create('operation', "I can't modify the components of " + objectName(obj));
		}

		if (obj instanceof Map) {
			/*
				The "TwineScript_Sealed" expando property means that this map/object cannot be
				expanded (presumably because it's a system variable).
			*/
			if (obj.TwineScript_Sealed && !obj.has(prop)) {
				return TwineError.create("operation", specialCollectionErrorMsg);
			}
			if (obj.TwineScript_Writeproof &&
					obj.TwineScript_Writeproof.includes(prop)) {
				return TwineError.create("operation", writeproofErrorMsg);
			}
			return true;
		}
		/*
			As sequentials have limited valid property names, subject
			the prop to some further examination.
		*/
		if (isSequential(obj)) {
			/*
				Unlike in JavaScript, you can't change the length of
				an array or string - it's fixed.
			*/
			if(prop === "length") {
				return TwineError.create(
					"operation",
					"I can't forcibly alter the length of " + objectName(obj) + "."
				);
			}
			/*
				Sequentials can only have 'length' (addressed above)
				and number keys (addressed below) assigned to.
				I hope this check is sufficient to distinguish integer indices...
			*/
			else if (+prop !== (prop|0)) {
				return TwineError.create("property",
					objectName(obj) + " can only have position keys ('3rd', '1st', (5), etc.), not "
					+ propertyDebugName(prop) + "."
				);
			}
		}
		/*
			Identifiers cannot be set.
		*/
		if (obj.TwineScript_Identifiers && prop in obj) {
			return TwineError.create('keyword',
				"I can't alter the value of the '"
				+ prop + "' identifier.", "You can only alter data in variables and hooks, not fixed identifiers.");
		}
		/*
			Sealed objects or writeproof properties must be respected.
		*/
		if (obj.TwineScript_Sealed && !(prop in obj)) {
			return TwineError.create("operation", specialCollectionErrorMsg);
		}
		if (obj.TwineScript_Writeproof &&
				obj.TwineScript_Writeproof.includes(prop)) {
			return TwineError.create("operation", writeproofErrorMsg);
		}
		/*
			Numbers and booleans cannot have properties altered.
		*/
		if (typeof obj === "number" || typeof obj === "boolean") {
			return TwineError.create("operation", "You can't alter the data values of "
				+ objectName(obj) + ".");
		}
		return true;
	}
	
	/*
		This should only be run after canSet(), above, has verified it is safe.
	*/
	function objectOrMapSet(obj, prop, value) {
		if (obj instanceof Map) {
			obj.set(prop, value);
		} else {
			/*
				As mentioned in compilePropertyIndex, obj.length
				cannot be accurately determined until here and now.
				Recall that unary + converts negative to positive, so
				"-0" must be used in its place.
			*/
			if (isSequential(obj) && prop-0 < 0) {
				prop = obj.length + (prop-0);
			}
			if (obj.TwineScript_Set) {
				obj.TwineScript_Set(prop);
			} else {
				obj[prop] = value;
			}
		}
	}

	/*
		As with the two above, delete() has this helper method
		which performs the actual deletoon based on object type.
	*/
	function objectOrMapDelete(obj, prop) {
		/*
			As mentioned previously, conversion of negative props must occur now.
		*/
		if (isSequential(obj) && prop-0 < 0) {
			prop = obj.length + (prop-0);
		}
		/*
			If it's an array, and the prop is an index,
			we should remove the item in-place without creating a hole.
		*/
		if (Array.isArray(obj) && numericIndex.exec(prop)) {
			obj.splice(prop, 1);
		}
		/*
			If it's a Map or Set, use the delete() method.
		*/
		else if (obj instanceof Map || obj instanceof Set) {
			obj.delete(prop);
		}
		/*
			If it has a TwineScript_DeleteValue method, call that.
			This will usually be a hook reference.
		*/
		else if (obj.TwineScript_DeleteValue) {
			obj.TwineScript_DeleteValue(prop);
		}
		/*
			Note: The only plain object anticipated to be provided here is the
			state variables object.
		*/
		else delete obj[prop];
	}
	
	/*
		This helper function wraps a TwineError so that it can be a valid return
		value for VarRefProto.create().
	*/
	function wrapError(error) {
		/*
			VarRefProto's return value is generally assumed to have these three
			methods on it. By providing this dummy wrapper whenever an error
			is returned, the error can be safely delivered when those expected
			methods are called.
		*/
		function self() {
			return error;
		}
		return {
			get: self,
			set: self,
			delete: self,
			varref: true,
		};
	}

	/*
		A wrapper around Javascript's [[get]], which
		returns an error if a property is absent rather than
		returning undefined. (Or, in the case of State.variables,
		uses a default value instead of returning the error.)
		
		@method get
		@return {Error|Anything}
	*/
	function get(obj, prop, originalProp) {
		/*
			If prop is an array (that is, a slice), retrieve every value for each
			property key. This allows, for instance, getting a subarray by passing a range.
		*/
		if (Array.isArray(prop)) {
			/*
				HookSets, when sliced, produce another HookSet rather than an array.
			*/
			if (HookSet.isPrototypeOf(obj)) {
				/*
					HookSet's implementation of TwineScript_GetElement supports
					arrays of properties being passed in.
				*/
				return obj.TwineScript_GetElement(prop);
			}
			return (prop.map(e => get(obj, e,
					/*
						This is incorrect, but I don't have access to the "original"
						version of this property name contained in the array.
					*/
					e
				)))
				/*
					Strings, when sliced, produce another string rather than an array.
				*/
				[typeof obj === "string" ? "join" : "valueOf"]("");
		}
		/*
			Due to Javascript's regrettable use of UCS-2 for string access,
			astral plane glyphs won't be correctly regarded as single characters,
			unless the following kludge is employed.
		*/
		if (typeof obj === "string") {
			obj = [...obj];
		}

		const result =  objectOrMapGet(obj, prop);
		/*
			An additional error condition exists for get(): if the property
			doesn't exist, don't just return undefined.
			
			I wanted to use hasOwnProperty here, but it didn't work
			with the State.variables object, which, as you know, uses
			differential properties on the prototype chain. Oh well,
			it's probably not that good an idea anyway.
		*/
		if (result === undefined) {
			/*
				If the property is actually a State.variables access,
				then it's a variable, and uses the defaultValue in place
				of undefined.
			*/
			if (obj === State.variables) {
				return defaultValue;
			}
			return TwineError.create("property", "I can't find a "
				// Use the original non-compiled property key in the error message.
				+ propertyDebugName(originalProp)
				+ " data name in "
				+ objectName(obj));
		}
		return result;
	}

	/*
		This is a helper function for set() and delete(), which simplifies the act of
		modifying TwineScript objects' properties and properly applying those changes
		up the property chain.
		It lets the caller provide a reduceRight callback and initial value, which is called on
		an array of [object, prop] pairs, where each pair, when referenced, is the next pair's
		object, and the final prop is this.deepestProperty.
	*/
	function mutateRight(fn, value) {
		const result = this.compiledPropertyChain
			/*
				This somewhat complicated operation changes compiledPropertyChain
				into an array of [object, prop] pairs
			*/
			.reduce((arr, prop) => {
				let object;
				/*
					The current pair consists of the object referenced
					by the previous pair (or this.object on the first
					iteration), and the current property.
				*/
				if (arr.length === 0) {
					object = this.object;
				}
				else {
					object = get(...arr[arr.length-1]);
				}
				return arr.push([object, prop]) && arr;
			}, [])
			/*
				This is a reduceRight because the rightmost object-property pair
				must be dealt with first, followed by those further left.
			*/
			.reduceRight(fn, value);
		return (TwineError.containsError(result) ? result : undefined);
	}

	/*
		The prototype object for VarRefs.
	*/
	VarRefProto = Object.freeze({
		varref: true,
		
		get() {
			return get(this.deepestObject, this.compiledPropertyChain.slice(-1)[0],
				/*
					This is the original non-computed property. It is used only for
					the error message when no property is found.
				*/
				this.propertyChain.slice(-1)[0]
			);
		},
		
		/*
			A wrapper around Javascript's [[set]], which does a lot of
			preparation before the assignment is performed.
		*/
		set(value) {
			/*
				Show an error if this request is attempting to assign to a value which isn't
				stored in the variables or temp. variables.
				e.g. (set: (a:)'s 1st to 1)
			*/
			if (this.object && !(this.object.TwineScript_VariableStore)) {
				return TwineError.create("macrocall", "I can't (set:) "
					+ objectName(this)
					+ ", if the "
					+ (objectName(this.object).match(/ (.+$)/) || ['',"value"])[1]
					+ " isn't stored in a variable.",
					"Modifying data structures that aren't in variables won't change the game state at all."
				);
			}

			/*
				For each *object*:
				- Set the *property* inside the *object* to the *preceding value*
				- Make the *object* be the *preceding value*
			*/
			return mutateRight.call(this, (value, [object, property], i) => {
				/*
					First, propagate errors from the preceding iteration, or from
					compilePropertyChain() itself.
				*/
				let error;
				if ((error = TwineError.containsError(value, object, property) || TwineError.containsError(
						isObject(object) && canSet(object, property)
					))) {
					return error;
				}

				/*
					HookSets have a special restriction: only strings can be assigned to it.
					As of July 2015, nothing else has an assignee restriction.
				*/
				if (HookSet.isPrototypeOf(object) && typeof value !== "string") {
					return TwineError.create(
						"datatype",
						"You can only set hook references to strings, not " + objectName(value) + "."
					);
				}

				/*
					Only attempt to clone the object if it's not the final iteration.
				*/
				if (i > 0) {
					object = clone(object);
				}

				/*
					Certain types of objects require special means of assigning
					their values than just objectOrMapSet().

					Strings are immutable, so modifications to them must be done
					by splicing them.
				*/
				if (typeof object === "string") {
					if (typeof value !== "string" || value.length !== (Array.isArray(property) ? property.length : 1)) {
						return TwineError.create("datatype", "I can't put this non-string value, " + objectName(value) + ", in a string.");
					}
					/*
						Convert strings to an array of code points, to ensure that the indexes are correct.
					*/
					object = [...object];
					/*
						Insert each character into the string, one by one,
						using this loop.
					*/
					const valArray = [...value];
					/*
						If property is a single index, convert it into an array
						now through the usual method.
					*/
					[].concat(property).forEach(index => {
						/*
							Because .slice treats negative indices differently than we'd
							like right now, negatives must be normalised.
						*/
						if (0+index < 0) {
							index = object.length + (0+index);
						}
						/*
							Note that the string's length is preserved during each iteration, so
							the index doesn't need to be adjusted to account for a shift.
						*/
						object = [...object.slice(0, index), valArray.shift(), ...object.slice(index+1)];
					});
					object = object.join('');
				}
				/*
					Other types of objects simply call objectOrMapSet, once or multiple times
					depending on if the property is a slice.
				*/
				else if (isObject(object)) {
					/*
						If the property is an array of properties, and the value is an array also,
						set each value to its matching property.
						e.g. (set: $a's (a:2,1) to (a:2,3)) will set position 1 to 3, and position 2 to 1.
					*/
					if (Array.isArray(property) && isSequential(value)) {
						/*
							Due to Javascript's regrettable use of UCS-2 for string access,
							astral plane glyphs won't be correctly regarded as single characters,
							unless the following kludge is employed.
						*/
						if (typeof value === "string") {
							value = [...value];
						}
						/*
							Iterate over each property, and zip it with the value
							to set at that property position. For example:
							(a: 1) to (a: "wow")
							would set "wow" to the position "1"
						*/
						property.map((prop,i) => [prop, value[i]])
							.forEach(([e, value]) => objectOrMapSet(object, e, value));
					}
					else {
						objectOrMapSet(object, property, value);
					}
				}
				return object;
			}, value);
		},

		/*
			A wrapper around Javascript's delete operation, which
			returns an error if the deletion failed, and also removes holes in
			arrays caused by the deletion.
			This is only used by the (move:) macro.
		*/
		delete() {
			return mutateRight.call(this, (value, [object, property], i) => {
				/*
					First, propagate errors from the preceding iteration, or from
					compilePropertyChain() itself.
				*/
				let error;
				if ((error = TwineError.containsError(value, object, property) || TwineError.containsError(
						isObject(object) && canSet(object, property)
					))) {
					return error;
				}
				/*
					Only attempt to clone the object if it's not the final iteration.
					(Remember that reverseRight reverses the progression of the i parameter.)
				*/
				if (i > 0) {
					object = clone(object);
				}
				/*
					If this is the first iteration, then delete the property.
				*/
				if (value === null) {
					if (isObject(object)) {
						/*
							If the property is an array of properties, delete each property.
						*/
						if (Array.isArray(property)) {
							/*
								Iterate over each property, and zip it with the value
								to set at that property position. For example:
								(a: 1) to (a: "wow")
								would set "wow" to the position "1"
							*/
							property.forEach(prop => objectOrMapDelete(object, prop));
						}
						else {
							objectOrMapDelete(object, property);
						}
					}
				}
				/*
					Otherwise, perform a set of the previous iteration's object,
					updating this object-property pair.
				*/
				else {
					objectOrMapSet(object, property, value);
				}
				return object;
			}, null);
		},

		/*
			This creator function accepts an object and a property chain.
			But, it can also expand another VarRef that's passed into it.
			This is almost always called by compiled TwineScript code.
		*/
		create(object, propertyChain) {
			/*
				First, propagate passed-in errors.
			*/
			let error;
			if ((error = TwineError.containsError(object))) {
				return wrapError(error);
			}
			/*
				The propertyChain argument can be an arrays of strings and/or
				computed property objects, or just a single one of those.
				So, convert a single passed value to an array of itself.
			*/
			propertyChain = [].concat(propertyChain);
			/*
				If the passed-in object is another varRef, expand the
				propertyChain to include its own, and use its object.
			*/
			if (VarRefProto.isPrototypeOf(object)) {
				propertyChain = object.propertyChain.concat(propertyChain);
				object = object.object;
			}

			const {compiledPropertyChain, deepestObject} = compilePropertyChain(object, propertyChain);
			if ((error = TwineError.containsError(compiledPropertyChain, deepestObject))) {
				return wrapError(error);
			}

			/*
				Create the VarRefProto instance.
			*/
			return Object.assign(Object.create(VarRefProto), {
				object, propertyChain, compiledPropertyChain, deepestObject
			});
		},
		
		get TwineScript_ObjectName() {
			/*
				If this.object is State.variables, then
				print a $ instead of "[name]'s"
			*/
			return (this.object === State.variables ? "$" : (objectName(this.object) + "'s "))
				/*
					If the property chain contains a single, potentially computed value, then get the
					value's debug name. Otherwise, get the full chain's debug names.
				*/
				+ (this.propertyChain.length === 1
					? propertyDebugName(this.propertyChain[0])
					: this.propertyChain.reduce((a, e) => a + "'s " + propertyDebugName(e))
				);
		},
	});
	
	return VarRefProto;
});
