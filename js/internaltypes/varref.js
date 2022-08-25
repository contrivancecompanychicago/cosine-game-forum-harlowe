"use strict";
define('internaltypes/varref', ['state', 'internaltypes/twineerror', 'utils', 'utils/operationutils', 'datatypes/hookset'],
(State, TwineError, {impossible, andList, nth}, {is, isObject, toSource, isSequential, objectName, typeName, clone, isValidDatamapName, subset, collectionType, unstorableValue, matches}, HookSet) => {
	const {isArray} = Array;
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
		Debug Mode event handlers are stored here by on().
	*/
	const eventHandlers = {
		set: [],
		delete: [],
	};

	/*
		This converts a single TwineScript property index into a JavaScript property indexing
		operation.
		
		While doing so, it checks if a property name is valid, and returns
		an error instead if it is not.
		@return {String|Error}
	*/
	const youCanOnlyAccess = "You can only access position strings/numbers ('4th', 'last', '2ndlast', (2), etc.), slices ('1stTo2ndlast', '3rdTo5th'), ";
	const noZeroth = "You can't access the '0th' or '0thlast' position of ";
	function compilePropertyIndex(obj, prop) {
		/*
			Check if it's a valid property name.
		*/
		let error;
		if (TwineError.containsError(prop)) {
			return error;
		}
		if (obj instanceof Map &&
				(error = TwineError.containsError(isValidDatamapName(obj,prop)))) {
			return error;
		}
		
		/*
			Sequentials have special sugar string property indices:
			
			length: this falls back to JS's length property for Arrays and Strings.
			1st, 2nd etc.: 1-based indices.
			last: antonym of 1st.
			2ndlast, 3rdlast: reverse indices.
			1stTo2ndlast, 3rdlastToLast: slices.
			random: random index.
			some (any), all, start, end: produce special "determiner" objects used for comparison operations.
		*/
		if (isSequential(obj)) {
			let match;
			/*
				Due to speed concerns, objectName() must not be called unless it will definitely be used.
			*/
			/*
				Number properties are treated differently from strings by sequentials:
				the number 1 is treated the same as the string "1st", and so forth.
			*/
			if (typeof prop === "number") {
				if (prop === 0) {
					return TwineError.create("property", `You can't access elements at position 0 of ${objectName(obj)}.`,
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
			else if (typeof prop === "string" && (match = /^(\d+)(?:st|[nr]d|th)last$/i.exec(prop))) {
				if (match[1] === "0") {
					return TwineError.create("property", noZeroth + objectName(obj) + ".");
				}
				/*
					obj.length cannot be trusted here: if it's an astral-plane
					string, then it will be incorrect. So, just pass a negative index
					and let get() do the work of offsetting it after it
					deals with the astral characters.
				*/
				prop = -match[1];
			}
			else if (typeof prop === "string" && (match = /^(\d+)(?:st|[nr]d|th)$/i.exec(prop))) {
				if (match[1] === "0") {
					return TwineError.create("property", noZeroth + objectName(obj) + ".");
				}
				/*
					It's actually important that prop remains a number and not a string:
					a few operations (such as canSet()) use the type of the props to
					check if the VarRef's property chain remains legal.
				*/
				prop = match[1] - 1;
			}
			/*
				In addition to "1st", "2ndlast" and such, "1stTo2ndlast" can also be used.
				These produce an array of properties identical to that produced by putting
				(range:) in property index position.
			*/
			else if (typeof prop === "string" &&
					(match = /^(?:(\d+)(?:st|[nr]d|th)(last)?|last)to(?:(\d+)(?:st|[nr]d|th)(last)?|last)$/i.exec(prop))) {
				/*
					Convenient fact: when "lastto1st" is supplied, match becomes [undefined, undefined, 1, undefined].
					The defaults here mean that "last" becomes (first = 0, firstNeg = undefined), which becomes -1.
				*/
				let [,first = 0,firstNeg,last = 0,lastNeg] = match;
				first = (firstNeg ? -first : first - 1);
				last = (lastNeg ? -last : last - 1);

				/*
					Because the range could cross from 0 to negative (such as in the case of 1stTo2ndlast), and because
					obj might be a HookSet whose length can't be immediately computed, we must defer the computation
					of the actual positions to get(), using this crude object.
				*/
				prop = { last, first };
			}
			else if (prop === "last") {
				prop = -1;
			}
			/*
				So that things like (move:) and typed variables still sensibly work, "random" is compiled into a random index here,
				rather than at get-time.
			*/
			else if (prop === "random") {
				if (!obj.length) {
					return TwineError.create("property", `I can't get a random value from ${objectName(obj)}, because it's empty.`);
				}
				/*
					Again, to get the true code point length of strings, Array.from() is called for.
				*/
				prop = State.random() * Array.from(obj).length | 0;
			}
			/*
				HookSets should be the only sequential with additional string properties.
			*/
			else if (HookSet.isPrototypeOf(obj) && !HookSet.TwineScript_Properties.includes(prop)) {
				return TwineError.create("property", `${youCanOnlyAccess
					+ andList(HookSet.TwineScript_Properties.map(p => "'" + p + "'"))} of ${objectName(obj)}, not ${typeof prop === "string" ? toSource(prop) : objectName(prop)}.`);
			}
			else if (!["length","some","any","all","start","end","random"].includes(prop) && !HookSet.isPrototypeOf(obj)) {
				return TwineError.create("property", `${youCanOnlyAccess}'length', 'some', 'any', 'all', 'start', 'end', and 'random' of ${objectName(obj)}, not ${typeof prop === "string" ? toSource(prop) : objectName(prop)}.`);
			}
		}
		/*
			Sets, being essentially a limited kind of arrays, cannot have any
			property access other than 'length', 'some' ('any'), and 'all'.
		*/
		else if (obj instanceof Set) {
			if (!["length","some","any","all"].includes(prop)) {
				return TwineError.create("property",  `${youCanOnlyAccess}'length', 'some', 'any', and 'all' of ${objectName(obj)}.`,
					"You can't access specific individual data values from datasets.");
			}
			/*
				This kludge must be used to pave over a little difference
				between Arrays and Sets.
			*/
			if (prop === "length") {
				prop = "size";
			}
		}
		/*
			This should catch Colours and Gradients.
		*/
		else if (isArray(obj.TwineScript_Properties) && !obj.TwineScript_Properties.includes(prop)) {
			return TwineError.create("property",
				`You can only get the ${andList(obj.TwineScript_Properties.map(p => "'" + p + "'"))} of ${objectName(obj)}, not ${typeof prop === "string" ? toSource(prop) : objectName(prop)}.`);
		}
		/*
			Numbers and booleans cannot have properties accessed.
		*/
		else if (typeof obj === "number" || typeof obj === "boolean") {
			return TwineError.create("property", `You can't get any data values, let alone ${objectName(prop)}, from ${objectName(obj)}`);
		}
		return prop;
	}

	function compilePropertyChain(object, propertyChain) {
		let arr = [];
		/*
			These use for-loops for performance reasons.
		*/
		for (let i = 0; i < propertyChain.length; i += 1) {
			let prop = propertyChain[i];
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
			if (isArray(prop)) {
				let prop2 = [];
				for(let j = 0; j < prop.length; j += 1) {
					prop2[j] = compilePropertyIndex(object, prop[j]);
				}
				prop = prop2;
			}
			else {
				prop = compilePropertyIndex(object, prop);
			}

			/*
				Check for errors.
			*/
			let error;
			if ((error = TwineError.containsError(prop))) {
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
		}
		return arr;
	}

	/*
		This helper converts negative property positions into JS positions.
		As mentioned in compilePropertyIndex, obj.length
		cannot be accurately determined until objectOrMapGet() and objectOrMapSet().
	*/
	function convertNegativeProp(obj, prop) {
		/*
			Recall that unary + converts negative to positive, so
			"-0" must be used in its place.
		*/
		if (prop-0 < 0 &&
				/*
					This should be <= because (a:1,2,3)'s (-3) should
					access the first element.
				*/
				Math.abs(prop) <= obj.length) {
			return obj.length + (prop-0);
		}
		return prop;
	}

	/*
		This helper creates a determiner, which is a special object returned
		from a sequence's "any", "all", "start" or "end" properties, and, when used in comparison
		operations like "contains" and ">", allows all of the sequence's elements
		to be compared succinctly.
	*/
	function createDeterminer(obj, prop) {
		const name = `"${prop} value${prop === "any" ? '' : 's'}" of `;

		return {
			determiner: prop,
			/*
				This is used solely for error messages.
			*/
			determined: obj,
			/*
				The "some" ("any") and "all" determiners require the ability to extract code points
				from strings at will.
			*/
			array: [...obj],
			/*
				The "start" and "end" determiners require the ability to reconstruct
				string determiners into their original string value. Storing it here
				saves that computation.
			*/
			string: typeof obj === "string" && obj,
			TwineScript_ObjectName: name + objectName(obj),
			TwineScript_ToSource() { return `${prop} of ${toSource(obj)}`; },
			TwineScript_TypeName: name + "a data structure",
			TwineScript_Unstorable: true,
			TwineScript_Print() {
				return "`[" + this.TwineScript_TypeName + "]`";
			},
		};
	}

	/*
		As Maps and other objects have a different means of accessing stored values
		than arrays, these tiny utility functions are needed.
		They have the slight bonus that they can fit into some .reduce() calls
		below, which potentially offsets the cost of being re-created for each varRef.
	*/
	/*
		Because of the performance concerns of converting strings to arrays repeatedly,
		as well as checking them for astral characters, strings whose properties are accessed
		have their 'correct' representations cached in this Map.
		For obvious reasons, this cache basically never has to be invalidated.
	*/
	const astralCharacter = /[^\x0000-\xFFFF]/;
	const testedStrings = new Map();
	function objectOrMapGet(obj, prop) {
		if (obj === undefined) {
			return obj;
		}
		if (obj instanceof Map) {
			return obj.get(prop);
		}
		if ((prop === "some" || prop === "any" || prop === "all" || prop === "start" || prop === "end") && !obj.TwineScript_VariableStore) {
			return createDeterminer(obj,prop);
		}
		/*
			Due to Javascript's regrettable use of UCS-2 for string access,
			astral plane glyphs won't be correctly regarded as single characters,
			unless the following kludge is employed.
			This must be placed after the createDeterminer() branch,
			and before the convertNegativeProp() branch.
		*/
		if (typeof obj === "string") {
			/*
				Check the cache first.
			*/
			if (testedStrings.has(obj)) {
				obj = testedStrings.get(obj);
			}
			/*
				This check should provide a little perf benefit in most cases,
				where the string only has basic plane characters.
			*/
			else if (astralCharacter.test(obj)) {
				/*
					Cache the array version of this astral string.
				*/
				const arrayed = [...obj];
				testedStrings.set(obj, arrayed);
				obj = arrayed;
			}
			else {
				/*
					Cache this basic string.
				*/
				testedStrings.set(obj, obj);
			}
		}
		if (isSequential(obj) && Number.isFinite(prop)) {
			prop = convertNegativeProp(obj,prop);
		}
		if (obj.TwineScript_GetProperty) {
			return obj.TwineScript_GetProperty(prop);
		}
		/*
			This shouldn't be accessible to user-authored code... but I might as well leave it.
		*/
		const ret = obj[prop];
		if (typeof ret !== "function") {
			return ret;
		}
	}
	
	/*
		A helper for canSet, and VarRef.get(), this renders computed indices
		in (brackets) and syntax indices in 'single-quotes', for
		error message purposes.
	*/
	function propertyDebugName(prop) {
		if (prop.computed) {
			let {value} = prop;
			if (VarRefProto.isPrototypeOf(value)) {
				value = value.get();
			}
			if (typeof value === "string") {
				return "('" + value + "')";
			}
			return "(" + value + ")";
		}
		if (typeof prop === "number") {
			return nth(prop);
		}
		return "'" + prop + "'";
	}

	/*
		Determine, before running objectOrMapSet, whether trying to
		set any value to this property will work. If not, create a TwineError.
	*/
	function canSet(obj, prop, value) {
		/*
			First, variable stores.
		*/
		if (obj.TwineScript_VariableStore) {
			/*
				Currently, only variable stores have TypeDefs, and thus typed variables.
				The following code performs the type-checking that the TypeDefs provide.
			*/
			if (obj.TwineScript_TypeDefs && prop in obj.TwineScript_TypeDefs) {
				/*
					This should never be called when prop is an array - the map() below should always sort it out.
				*/
				const type = obj.TwineScript_TypeDefs[prop];
				/*
					Simply due to weariness, I've decided to hard-code the special case for the "const" datatype.
				*/
				if (type.name === "const") {
					/*
						Because, currently, only base variable store variables can be type-restricted
						(as above) then get() isn't needed to check the variable's current contents.
					*/
					if (obj[prop] !== undefined) {
						return TwineError.create("operation", `I can't alter ${obj === State.variables ? "$" : "_"}${prop} because it's been restricted to a constant value.`,
							"This variable can't be changed for the rest of the story.");
					}
				}
				else if (!matches(type,value)) {
					return TwineError.create('operation', `I can't set ${obj === State.variables ? "$" : "_"}${prop} to ${typeName(value)} because it's been restricted to ${toSource(type)}-type data.`,
						"You can restrict a variable or data name by giving a typed variable to (set:) or (put:)."
					);
				}
			}
			return true;
		}
		/*
			As with get() below, array properties allow multiple property keys to be set at once.
		*/
		if (isArray(prop)) {
			return prop.map(prop => canSet(obj, prop));
		}

		/*
			Maps can only have string names.
		*/
		if (obj instanceof Map) {
			if(typeof prop !== "string") {
				return TwineError.create('operation',
					`${objectName(obj)} can only have string data names, not ${objectName(prop)}.`);
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
			if(["length","random","some","any","all","start","end"].includes(prop)) {
				return TwineError.create(
					"operation",
					"I can't forcibly alter the '" + prop + "' of " + objectName(obj) + ".",
					prop === "start" || prop === "end" ? "Alter the values at actual positions, like 1st or 2ndlast, rather than just the '" + prop + "'." : undefined
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
			return true;
		}
		/*
			Identifiers cannot be set.
		*/
		if (obj.TwineScript_Identifiers && prop in obj) {
			return TwineError.create('keyword',
				"I can't alter the value of the '"
				+ prop + "' identifier.", "You can only alter data in variables, not fixed identifiers.");
		}

		return TwineError.create('operation', "I can't modify " + objectName(obj),
			obj instanceof Set ? 'You should use an (array:) if you need to modify the data inside this dataset.' :
			HookSet.isPrototypeOf(obj) ? 'You should alter hooks indirectly using macros like (replace:) or (enchant:).' : undefined
		);
	}
	
	/*
		This should only be run after canSet(), above, has verified it is safe.
	*/
	function objectOrMapSet(obj, prop, value, valueRef) {
		const origProp = prop;
		if (obj instanceof Map) {
			obj.set(prop, value);
		} else {
			if (isSequential(obj)) {
				prop = convertNegativeProp(obj, prop);
			}
			/*
				This is currently only used by the System Variables in State.
			*/
			if (obj.TwineScript_Set) {
				obj.TwineScript_Set(prop, value, valueRef);
			} else {
				obj[prop] = value;
			}
		}
		eventHandlers.set.forEach(fn => fn(obj, origProp, value));
	}

	/*
		As with the two above, delete() has this helper method
		which performs the actual deletion based on object type.
	*/
	function objectOrMapDelete(obj, prop) {
		const origProp = prop;
		/*
			As mentioned previously, conversion of negative props must occur now.
		*/
		if (isSequential(obj)) {
			prop = convertNegativeProp(obj, prop);
		}
		/*
			If it's an array, and the prop is an index,
			we should remove the item in-place without creating a hole.
		*/
		if (isArray(obj) && /^(?:[1-9]\d*|0)$/.exec(prop)) {
			obj.splice(prop, 1);
		}
		/*
			If it's a Map or Set, use the delete() method.
		*/
		else if (obj instanceof Map || obj instanceof Set) {
			obj.delete(prop);
		}
		else if (obj.TwineScript_Delete) {
			obj.TwineScript_Delete(prop);
		}
		/*
			Note: The only plain object anticipated to be provided here is the
			state variables object.
		*/
		else delete obj[prop];
		eventHandlers.delete.forEach(fn => fn(obj, origProp));
	}

	/*
		A wrapper around Javascript's [[get]], which
		returns an error if a property is absent rather than
		returning undefined. (Or, in the case of State.variables,
		uses a default value instead of returning the error.)
		
		@method get
		@return {Error|Anything}
	*/
	function get(obj, prop, originalProp = prop, returnUndefined = false) {
		/*
			{first, last} properties are slices (continuous subsets) created by the "?a's 2ndlasttolast" accesses.
			This syntax should only be usable with sequentials (as determined by isSequential()).
		*/
		if (prop && typeof prop === "object" && "last" in prop && "first" in prop) {
			/*
				Because HookSets aren't data structures and have no resolvable length,
				the {first, last} object must be passed in as-is.
			*/
			if (HookSet.isPrototypeOf(obj)) {
				return obj.TwineScript_GetProperty(prop);
			}
			/*
				All other sequentials are either arrays or strings, and
				can be handled with OperationUtils.subset().
			*/
			const {first,last} = prop;
			/*
				subset() only accepts 1-indexed indices, due to being used primarily by (subarray:).
				With some #awkward embarrassment, the indices must be converted back.
			*/
			return subset(obj, first + (first >= 0), last + (last >= 0));
		}
		/*
			If prop is an array (that is, a discrete subset), retrieve every value for each
			property key. This allows, for instance, getting a subarray by passing a range.
		*/
		if (isArray(prop)) {
			/*
				HookSets, when subsetted, produce another HookSet rather than an array.
			*/
			if (HookSet.isPrototypeOf(obj)) {
				/*
					HookSet's implementation of TwineScript_GetProperty supports
					arrays of properties being passed in.
				*/
				return obj.TwineScript_GetProperty(prop);
			}
			return (prop.map(e => get(obj, e,
					/*
						This is incorrect, but I don't have access to the "original"
						version of this property name contained in the array.
					*/
					e
				)))
				/*
					Strings, when subsetted, produce another string rather than an array.
				*/
				[typeof obj === "string" ? "join" : "valueOf"]("");
		}
		const result = objectOrMapGet(obj, prop);
		/*
			An additional error condition exists for get(): if the property
			doesn't exist, don't just return undefined.
		*/
		if (result === undefined && !returnUndefined) {
			/*
				If the property is actually a State.variables access,
				then it's a variable, and uses the defaultValue in place
				of undefined.
			*/
			if (obj === State.variables) {
				return defaultValue;
			}
			/*
				If this is a temp variable access, display the following error message
				about the visibility of temp variables.
			*/
			if (obj.TwineScript_VariableStore?.type === 'temp') {
				return TwineError.create("property",
					// Don't use propertyDebugName(), because it puts the string name in quotes.
					`There isn't a temp variable named _${originalProp} in this place.`,
					"Temp variables only exist inside the same passage, hook, or lambda in which they're created.");
			}
			if (isArray(obj) && typeof prop === "number") {
				return TwineError.create("property", `This array of ${obj.length} elements doesn't have a ${propertyDebugName(
						originalProp + (typeof originalProp === "number" ? 1 : ''))} element.`,
					obj.length ? `It contains: ${andList(obj.map(objectName))}.` : "The array is empty.");
			}
			const keys = Array.from(typeof obj.keys === "function" && obj.keys());
			return TwineError.create("property", 
				// Use the original non-compiled property key in the error message.
				`I can't find a ${propertyDebugName(originalProp)} data name in ${objectName(obj)}`,
				obj instanceof Map && keys.length ? (`Its names include: ${andList(keys)}.`) : undefined);
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
		get() {
			/*
				For speed concerns, this is a for-loop.
			*/
			let deepestObject = this.object;
			for(let i = 0; i < this.compiledPropertyChain.length - 1; i += 1) {
				deepestObject = get(deepestObject, this.compiledPropertyChain[i]);
				/*
					This can produce an error in the case of things like $a's 1st's 1st, where $a is (a:).
					The outer '1st' compiles the left side as a VarRef.
				*/
				if (TwineError.containsError(deepestObject)) {
					return deepestObject;
				}
			}

			return get(deepestObject, this.compiledPropertyChain.slice(-1)[0],
				/*
					This is the original non-computed property. It is used only for
					the error message when no property is found.
				*/
				this.propertyChain.slice(-1)[0]
			);
		},

		has() {
			/*
				This is the same as VarRefProto.get(), except that it only checks for existence.
			*/
			let deepestObject = this.object;
			for(let i = 0; i < this.compiledPropertyChain.length - 1; i += 1) {
				deepestObject = get(deepestObject, this.compiledPropertyChain[i], undefined, true);
				if (deepestObject === undefined || TwineError.containsError(deepestObject)) {
					return false;
				}
			}
			return get(deepestObject, this.compiledPropertyChain.slice(-1)[0],
				/*
					originalProp doesn't need to be passed in for this call.
				*/
				undefined, true) !== undefined;
		},
		
		/*
			A wrapper around Javascript's [[set]], which does a lot of
			preparation before the assignment is performed.
		*/
		set(value, valueRef) {
			/*
				Show an error if this request is attempting to assign to a value which isn't
				stored in the variables or temp. variables.
				e.g. (set: (a:)'s 1st to 1).
				The identifiers store has a different, better error message produced by canSet().
			*/
			if (this.object && !this.object.TwineScript_VariableStore && !this.object.TwineScript_Identifiers) {
				return TwineError.create("macrocall", `I can't (set:) ${objectName(this)}, if the ${(objectName(this.object).match(/ (.+$)/) || ['', "value"])[1]} isn't stored in a variable.`,
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
						canSet(object, property, value)
					))) {
					return error;
				}

				/*
					Produce an error if the value is "unstorable", OR if it contains an unstorable.
				*/
				let unstorable;
				if ((unstorable = unstorableValue(value))) {
					return TwineError.create("operation", `${objectName(value)} can't be stored${value.TwineScript_Unstorable ? '' : collectionType(value) ? ` because it holds ${objectName(unstorable)}` : ''}.`);
				}

				/*
					Only clone the object if it's not the final iteration (i.e. the root VariableStore or whatever).
				*/
				if (i > 0) {
					object = clone(object);
				}
				/*
					Special case for temp variables: inner hooks can modify outer hooks' values.
				*/
				else if (object.TwineScript_VariableStore?.type === 'temp' && object !== State.variables) {
					let parent = object;
					while(parent.TwineScript_VariableStore?.type === 'temp' && !hasOwnProperty.call(parent, property)) {
						parent = Object.getPrototypeOf(parent);
					}
					if (parent.TwineScript_VariableStore?.type === 'temp') {
						object = parent;
					}
				}

				/*
					Certain types of objects require special means of assigning
					their values than just objectOrMapSet().

					Strings are immutable, so modifications to them must be done
					by splicing them.
				*/
				if (typeof object === "string") {
					if (typeof value !== "string") {
						return TwineError.create("datatype", `I can't put this non-string value, ${objectName(value)}, in a string.`);
					}
					else if (value.length !== (isArray(property) ? property.length : 1)) {
						return TwineError.create("datatype", `${objectName(value)}is not the right length to fit into this string location.`);
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
						If the value's knownName needs to be updated, do that now.
						This only needs to be performed during sets, not deletes, because
						deletes (of properties deep in data structures) simply cause sets
						of the parent object to the same variable.
					*/
					if (value.TwineScript_KnownName !== undefined) {
						/*
							Only clone the value if it already has a knownName (which implies that it's already in a variable, and
							being copied from one to another).
						*/
						if (value.TwineScript_KnownName !== '') {
							value = clone(value);
						}
						value.TwineScript_KnownName = toSource(this);
					}
					/*
						If the property is an array of properties, and the value is sequential also,
						set each value to its matching property.
						e.g. (set: $a's (a:2,1) to (a:2,3)) will set position 1 to 3, and position 2 to 1.
					*/
					if (isArray(property) && isSequential(value)) {
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
							.forEach(([e, value]) => objectOrMapSet(object, e, value,
								/*
									Passing valueRef to each iteration is fine because
									only the final set to SystemVariables uses it.
								*/
								valueRef));
					}
					else {
						objectOrMapSet(object, property, value, valueRef);
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
						canSet(object, property)
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
					/*
						Much as in set(), we must convert strings to an array in order
						to delete characters from them.
					*/
					const isString = typeof object === "string";
					if (isString) {
						object = [...object];
					}

					/*
						If the property is an array of properties, delete each property.
					*/
					if (isArray(property)) {
						/*
							Iterate over each property position, and delete them.
							If the object is sequential, we must first remove duplicate
							positions, and sort the unique positions in descending order,
							so that deleting one will not change the positions of the next.

							Note that property sequences which include "length" should still
							work with this.
						*/
						if (isSequential(object)) {
							property = [...new Set(property)];
							property.sort((a,b) =>
								convertNegativeProp(object, b) - convertNegativeProp(object, a));
						}
						property.forEach(prop => objectOrMapDelete(object, prop));
					}
					else {
						objectOrMapDelete(object, property);
					}
					/*
						Now, convert the string back, if string it once was.
					*/
					if (isString) {
						object = object.join('');
					}
				}
				/*
					Otherwise, perform a set of the previous iteration's object,
					updating this object-property pair.
				*/
				else {
					objectOrMapSet(object, property, value, false);
				}
				return object;
			}, null);
		},

		/*
			Whenever a (set:), (put:) or (move:) has a TypedVar, that type definition needs to be registered in the TypeDefs store
			for that variable's variable store.
		*/
		defineType(type) {
			const {object, compiledPropertyChain} = this;
			/*
				Because this is only ever called (by AssignmentRequest, Lambda, and Patterns) after having constructed a TypedVar using this
				VarRef, checking that this is a proper defineType() target (i.e. the compiledPropertyChain's length is 1) is not necessary.
			*/
			/*
				The TypeDefs property chain is constructed here.
				Each stack frame's variables collection can have a TypeDefs object as an own-property.
				However, unlike variables, its presence in a stack frame is optional, and only
				added once it's first needed.
			*/
			const prop = compiledPropertyChain[0];
			if (!hasOwnProperty.call(object,"TwineScript_TypeDefs")) {
				object.TwineScript_TypeDefs = Object.create(object.TwineScript_TypeDefs || null);
			}
			/*
				Here is the check that this variable's type isn't being redefined, and the error.
				Note that it is permitted to "redefine" to the exact same type.
			*/
			const defs = object.TwineScript_TypeDefs;
			const existingType = defs[prop];
			if (existingType && !is(existingType, type)) {
				return TwineError.create("operation",
					"I can't redefine the type of " + objectName(this)
					+ " to " + (type.TwineScript_ObjectName || typeName(type))
					+ ", as it is already " + (existingType.TwineScript_ObjectName || typeName(existingType)) + ".");
			}
			/*
				Having done that, simply affix the type.
			*/
			(object.TwineScript_DefineType ? object.TwineScript_DefineType(prop, type) : defs[prop] = type);
			
			/*
				As a necessary special case, defining the const type should erase the currently contained
				value, as it is about to be redefined to its true value in the containing (set:) that
				called this method.
			*/
			if (type.name === "const") {
				object[prop] = undefined;
			}
		},

		/*
			This small check is used by two-way VarBinds to determine if they need to update
			whenever a VarRef "set" event is fired. The check is, simply, if the set object and
			name match the lowest level of a VarRef's property chain.
		*/
		matches(obj, name) {
			return this.object === obj && this.compiledPropertyChain[0] === name;
		},

		/*
			A quick way to retrieve the name of the root variable in the scope.
		*/
		getName() {
			return this.compiledPropertyChain[0];
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
				return error;
			}
			/*
				The propertyChain argument can be an arrays of strings and/or
				computed property objects, or just a single one of those.
				So, convert a single passed value to an array of itself.
			*/
			!Array.isArray(propertyChain) && (propertyChain = [].concat(propertyChain));
			/*
				If the passed-in object is another varRef, expand the
				propertyChain to include its own, and use its object.
			*/
			if (VarRefProto.isPrototypeOf(object)) {
				propertyChain = object.propertyChain.concat(propertyChain);
				object = object.object;
			}
			/*
				If the passed-in object is a TypedVar, expand the propertyChain
			*/
			const compiledPropertyChain = compilePropertyChain(object, propertyChain);
			if ((error = TwineError.containsError(compiledPropertyChain))) {
				return error;
			}

			/*
				Create the VarRefProto instance.
			*/
			return Object.assign(Object.create(VarRefProto), {
				object, propertyChain, compiledPropertyChain
			});
		},

		TwineScript_ToSource() {
			const debugName = (name, pos) => {
				if (!pos && (this.object.TwineScript_VariableStore))
					return name;
				return propertyDebugName(name);
			};
			/*
				If this.object is State.variables, then print a $ instead of "[name]'s".
				Conversely, print "_" for temporary variables inside a VariableStore.
			*/
			return (this.object === State.variables ? "$" :
					this.object.TwineScript_VariableStore?.type === 'temp' ? "_" :
					(toSource(this.object) + "'s ")) +
				/*
					If the property chain contains a single, potentially computed value, then get the
					value's debug name. Otherwise, get the full chain's debug names.
				*/
				(this.propertyChain.length === 1
					? debugName(this.propertyChain[0])
					: this.propertyChain.reduce((a, e, i) => a + "'s " + debugName(e,i))
				);
		},
		
		get TwineScript_ObjectName() {
			/*
				If this is a VarRef of a non-variable (such as ?hook's links's 1st) then perform
				a variation of ToSource (above) that favours the object name of the root object.
			*/
			if (!this.object.TwineScript_VariableStore) {
				return objectName(this.object) + "'s " + (this.propertyChain.length === 1
						? propertyDebugName(this.propertyChain[0])
						: this.propertyChain.reduce((a, e, i) => a + "'s " + propertyDebugName(e,i))
					);
			}
			return `the ${this.object.TwineScript_VariableStore?.type === 'temp' ? 'temp ' : ''}variable ${this.TwineScript_ToSource()}`;
		},

		/*
			This is used by two-way bind macros and by Debug Mode - it lets event handlers be registered
			and called when variables change.
			"set" functions have the signature (obj, prop, value).
			"delete" functions have the signature (obj, prop).
		*/
		on(name, fn) {
			if (!(name in eventHandlers)) {
				impossible('VarRef.on', 'invalid event name');
				return;
			}
			if (typeof fn === "function" && !eventHandlers[name].includes(fn)) {
				eventHandlers[name].push(fn);
			}
			return VarRefProto;
		},
	});
	
	return VarRefProto;
});
