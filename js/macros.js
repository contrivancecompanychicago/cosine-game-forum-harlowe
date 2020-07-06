"use strict";
define(['jquery', 'utils/naturalsort', 'utils', 'utils/operationutils', 'datatypes/changercommand', 'datatypes/custommacro', 'datatypes/lambda', 'datatypes/hookset', 'datatypes/codehook', 'datatypes/typedvar', 'internaltypes/changedescriptor', 'internaltypes/twineerror'],
($, NaturalSort, {insensitiveName, nth, plural, andList, lockProperty}, {objectName, typeName, singleTypeCheck, toSource}, ChangerCommand, CustomMacro, Lambda, HookSet, CodeHook, TypedVar, ChangeDescriptor, TwineError) => {
	/*
		This contains a registry of macro definitions, and methods to add to that registry.
	*/
	
	let Macros;
	const
		// Private collection of registered macros.
		macroRegistry = {};
		
	function spreadArguments(args) {
		return args.reduce((newArgs, el) => {
			if (el && el.spreader === true) {
				const {value} = el;
				/*
					TwineErrors, obviously, can't be spread.
				*/
				const error = TwineError.containsError(value);
				if (error) {
					newArgs.push(error);
				}
				/*
					Currently, the full gamut of spreadable
					JS objects isn't available - only arrays, sets, and strings.
				*/
				else if (Array.isArray(value)
						|| typeof value === "string") {
					for(let i = 0; i < value.length; i++) {
						newArgs.push(value[i]);
					}
				}
				else if (value instanceof Set) {
					newArgs.push(...Array.from(value).sort(NaturalSort("en")));
				}
				/*
					TypedVars have a special response to the spread operator: turn into
					"rest parameter" versions of themselves.
				*/
				else if (TypedVar.isPrototypeOf(value)) {
					/*
						Since these are unstorable, they don't have to be cloned before mutating.
					*/
					value.rest = true;
					newArgs.push(value);
				}
				else {
					newArgs.push(
						TwineError.create("operation",
							"I can't spread out "
							+ objectName(value)
							+ ", because it is not a string, dataset, or array."
						)
					);
				}
			}
			else {
				newArgs.push(el);
			}
			return newArgs;
		}, []);
	}
	
	/*
		This takes a macro entry (which is passed in along with its name),
		and type-checks the args passed to it before running it (or, alternatively, returning
		an error.)
	*/
	function typeCheckAndRun(name, {fn, typeSignature, isChanger = false}, args) {
		/*
			This is kind of embarrassing... but repeated trailing commas is actually not
			an invalid syntax in Harlowe. (a:,,,,) simply produces (a:), despite being
			compiled to "Macros.run("a", [section,,,,,]); The reason
			is that the .reduce() in spreadArguments filters those empty JS array cells out.
			However, it won't do that if args is spread out using a rest param, like
			[section, ...args]. So, that separation between section and args must, currently,
			be done here.
		*/
		const section = args[0];
		args = spreadArguments(args.slice(1));
		/*
			The typeSignature *should* be an Array, but if it's just one item,
			we can normalise it to Array form.
			If the item is null or undefined, then that means it should be a 0-length type signature.
		*/
		typeSignature = [].concat(typeSignature || []);
		
		/*
			Custom macros have no name.
		*/
		const custom = !name;
		/*
			The invocation (its name in "(name:)" format) is used solely for error message generation.
			If the macro has more than one name, we'll (often incorrectly, but still informatively)
			use the first name, as we have no other information about which macro name was used.
			It's an uncomfortable state of affairs, I know.
		*/
		const invocation = (custom ? '' : "(" + (Array.isArray(name) && name.length > 1 ? name[0] : name) + ":)");
		name = custom ? "this custom macro" : "the " + invocation + " macro" ;

		/*
			This is also used for error message generation: it provides the author with
			a readable sentence about the type signature of the macro.
		*/
		let signatureInfo;
		if (typeSignature.length > 0) {
			signatureInfo = name + " must only be given "
				// Join [A,B,C] into "A, B, and C".
				+ andList(typeSignature.map(typeName))
				+ (typeSignature.length > 1 ? ", in that order" : ".");
		} else {
			signatureInfo = (
				name + " must not be given any data." + (custom ? '' : " Just write " + invocation)
			);
		}
		let rest;

		for(let ind = 0, end = Math.max(args.length, typeSignature.length); ind < end; ind += 1) {
			let type = typeSignature[ind];
			const arg = args[ind];

			if (TwineError.containsError(arg)) {
				return arg;
			}

			/*
				Passing a hook as an argument to a changer gives a unique hint.
			*/
			if (CodeHook.isPrototypeOf(arg) && isChanger) {
				return TwineError.create(
					"syntax", "Please put this hook outside the parentheses of the changer macro, not inside it.",
					"Hooks should appear after a macro" + (custom ? '.' : ": " + invocation + "[Some text]")
				);
			}

			/*
				A rare early error check can be made up here: if ind >= typeSignature.length,
				and Rest is not in effect, then too many params were supplied.
			*/
			if (ind >= typeSignature.length && !rest) {
				return TwineError.create(
					"datatype",
					(args.length - typeSignature.length) +
						" too many values were given to " + name + ".",
					signatureInfo
				);
			}
			
			/*
				If a Rest type has already come before, then it will fill in for
				the absence of a type now.
			*/
			type || (type = rest);
			/*
				Conversely, if the rest type is being introduced now,
				we now note it down and extract the type parameter...
			*/
			if (type.innerType && (type.pattern === "rest" || type.pattern === "zero or more")) {
				rest = type.innerType;
				/*
					...but, we only extract the type parameter if it's a Rest.
					ZeroOrMore is used in singleTypeCheck as a synonym for Optional,
					and should remain boxed.
				*/
				if (type.pattern === "rest") {
					type = type.innerType;
				}
			}
			// Now do the check.
			if (!singleTypeCheck(arg,type)) {
				/*
					If the check failed, an error message must be supplied.
					We can infer the reason why singleTypeCheck returned just by
					examining arg.
					
					For instance, if the arg is undefined, then the problem is a
					"not enough values" error.
				*/
				if (arg === undefined) {
					return TwineError.create(
						"datatype",
						name + " needs "
							+ plural((typeSignature.length - ind), "more value") + ".",
						signatureInfo
					);
				}
				/*
					Unstorable data types are the only kinds which Any signatures will not
					match. Produce a special error message in this case.
				*/
				if (arg && arg.TwineScript_Unstorable &&
						(type === Macros.TypeSignature.Any ||
							(type.innerType && type.innerType === Macros.TypeSignature.Any))) {
					return TwineError.create(
						"datatype",
						name + "'s " + nth(ind + 1) + " value, " + objectName(arg) + ", is not valid data for this macro.",
						signatureInfo
					);
				}

				/*
					If the data type is a lambda, produce special error messages.
				*/
				if (arg && Lambda.isPrototypeOf(arg) && type.pattern === "lambda") {
					/*
						Print an error comparing the expected clauses with the actual ones.
					*/
					/*jshint -W083 */
					return TwineError.create('datatype',
						name + "'s " + nth(ind + 1) + " value (a lambda) should have "
						+ andList(["where","when","making","via","with"].filter(e => type.clauses.includes(e)).map(e => "a '" + e + "' clause"))
						+ ", not "
						+ andList(["where","when","making","via","with"].filter(e => e in arg).map(e => "a '" + e + "' clause"))
						+ ".");
				}

				/*
					Insensitive set patterns also have a special error description.
				*/
				if (type.pattern === "insensitive set") {
					return TwineError.create('datatype', objectName(arg) + ' is not a valid name string for ' + name + ".",
						'Only the following names are recognised (capitalisation and hyphens ignored): ' + andList(type.innerType) + "."
					);
				}

				/*
					Otherwise, give the generic data type error message.
				*/
				return TwineError.create(
					"datatype",
					name + "'s " +
						nth(ind + 1) + " value is " + objectName(arg) +
						", but should be " +
						typeName(type) + ".",
					/*
						If this type signature has a custom error message, use that here.
					*/
					type.message || signatureInfo
				);
			}
		}
		/*
			Type checking has passed - now let the macro run.
		*/
		return fn(section, ...args);
	}
	
	/*
		The bare-metal macro registration function.
		If an array of names is given, an identical macro is created under each name.
	*/
	function privateAdd(name, fn, typeSignature, isChanger = false) {
		// Add the fn to the macroRegistry, plus aliases (if name is an array of aliases)
		const obj = { fn, typeSignature };
		if (isChanger) {
			obj.isChanger = true;
		}
		Object.freeze(obj);
		if (Array.isArray(name)) {
			name.forEach((n) => lockProperty(macroRegistry, insensitiveName(n), obj));
		} else {
			lockProperty(macroRegistry, insensitiveName(name), obj);
		}
	}

	/*
		A helper for addCommand() which produces a function that makes
		that macro's Command objects. Currently, Commands do not have a shared prototype,
		so this function performs their initialisation in its stead.
	*/
	const commandMaker = (firstName, checkFn, runFn, attachable) => (section, ...args) => {
		/*
			The passed-in checkFn should only return a value if the check fails,
			and that value must be a TwineError. I'm so confident about this that I'm not even
			going to add a TwineError.containsError() call here.
		*/
		const error = checkFn(...args);
		if (error) {
			return error;
		}
		/*
			For attachables: this ChangeDescriptor is a private variable of the object,
			permuted by TwineScript_Attach(), and given to the runFn whenever that's
			finally called.
			This SHOULD not cause a problem where reusing a command in a variable multiple times
			causes the descriptor to be permuted multiple times, provided those are written
			sensibly and don't use existing values of the descriptor. ._.
		*/
		let cd = ChangeDescriptor.create();

		const ret = Object.assign({
				TwineScript_TypeID:   "command",
				TwineScript_ObjectName: "a (" + firstName + ":) command",
				TwineScript_TypeName: "a (" + firstName + ":) command",
				TwineScript_Print: () => "`[A (" + firstName + ":) command]`",
				TwineScript_ToSource() {
					return "(" + firstName + ":" + args.map(toSource) + ")";
				},
			},
			/*
				Only assign the TwineScript_Attach() method, and a TwineScript_Run() that
				passes in the ChangeDescriptor, if this permits attachments.
			*/
			attachable ? {
				TwineScript_Attach: changer => {
					changer.run(cd);
					return ret;
				},
				TwineScript_Run: section => runFn(cd, section, ...args),
			} : {
				TwineScript_Run: section => runFn(section, ...args),
		});
		return ret;
	};
	
	Macros = {
		/*
			Checks if a given macro name is registered.
		*/
		has(e) {
			e = insensitiveName(e);
			return macroRegistry.hasOwnProperty(e);
		},
		
		/*
			Retrieves a registered macro definition by name, or false if it isn't defined.
		*/
		get(e) {
			e = insensitiveName(e);
			return (macroRegistry.hasOwnProperty(e) && macroRegistry[e]);
		},
		
		/*
			A wrapper for privateAdd() that can be chained.
		*/
		add: function add(name, fn, typeSignature) {
			privateAdd(name, fn, typeSignature);
			// Return the function to enable "bubble chaining".
			return add;
		},
		
		/*
			Takes two functions, and registers them as a live Changer macro.
			
			Changers return a transformation function (a ChangerCommand) that is used to mutate
			a ChangeDescriptor object, that itself is used to alter a Section's rendering.
			
			The second argument, ChangerCommandFn, is the "base" for the ChangerCommands returned
			by the macro. The ChangerCommands are partial-applied versions of it, pre-filled
			with author-supplied parameters.
			
			For instance, for (font: "Skia"), the changerCommandFn is partially applied with "Skia"
			as an argument, augmented with some other values, and returned as the ChangerCommand
			result.
		*/
		addChanger: function addChanger(name, fn, changerCommandFn, typeSignature) {
			
			privateAdd(name, fn, typeSignature, true);
			ChangerCommand.register(Array.isArray(name) ? name[0] : name, changerCommandFn);
			
			// Return the function to enable "bubble chaining".
			return addChanger;
		},

		/*
			Takes a function, and produces a Command (a macro that produces an opaque object with
			TwineScript_ObjectName(), TwineScript_TypeName(), TwineScript_Print() and TwineScript_Run()
			functions).
			If it's attachable, it also has a TwineScript_Attach() function, which permutes an internal
			ChangeDescriptor that the object later passes to its TwineScript_Print() function. This is used
			for macros like (link:) which can have changers like (t8n:) attached to
			them, as if like hooks.
		*/
		addCommand: function addCommand(name, checkFn, runFn, typeSignature, attachable = true) {
			/*
				Commands need a canonical name for their TwineScript_Print() methods.
				Since name can be either a single string or an array, this is needed
				to unwrap it.
			*/
			const firstName = [].concat(name)[0];
			privateAdd(name, commandMaker(firstName, checkFn, runFn, attachable), typeSignature);
			// Return the function to enable "bubble chaining".
			return addCommand;
		},
		
		/*
			These helper functions/constants are used for defining semantic type signatures for
			standard library macros.
		*/
		TypeSignature: {
			
			optional: (type) => ({pattern: "optional", innerType: type }),
			
			zeroOrMore: (type) => ({pattern: "zero or more", innerType: type }),
			
			either: (...innerType) => ({pattern: "either", innerType }),
			
			rest: (type) => ({pattern: "rest", innerType: type }),
			
			/*
				Note that "innerType" here isn't actually a valid type, but simply a set of
				recognised values. #awkward
			*/
			insensitiveSet: (...values) => ({pattern: "insensitive set",   innerType: values }),

			numberRange: (min = 0, max = Infinity) =>
				({pattern: "range", min, max, range: arg => typeof arg === "number" && !Number.isNaN(arg) && arg >= min && arg <= max }),

			nonNegativeInteger:
				{ pattern: "range", integer: true, min:0, max: Infinity, range: arg => typeof arg === "number" && !Number.isNaN(arg) && arg >= 0 && !(arg+'').includes('.') },

			positiveInteger:
				{ pattern: "range", integer: true, min:1, max: Infinity, range: arg => typeof arg === "number" && !Number.isNaN(arg) && arg >= 1 && !(arg+'').includes('.') },

			/*
				This is used exclusively to provide custom error messages for particular
				type constraints.
			*/
			
			wrapped(innerType, message) {
				return {pattern: "wrapped", innerType, message };
			},
			
			/*d:
				Any data
				
				A macro that is said to accept "Any" will accept any kind of data
				without complaint, as long as the data does not contain any errors.
			*/
			Any: {
				TwineScript_TypeName: "anything",
			},
			
		},

		/*
			Runs a built-in macro.
			
			In compile(), the myriad arguments given to a macro invocation are
			converted to 2 arguments to runMacro.
		*/
		run(name, args) {
			/*
				Check if the macro exists as a built-in.
			*/
			if (!Macros.has(name)) {
				return TwineError.create("macrocall",
					"I can't run the macro '" + name + "' because it doesn't exist.",
					"Did you mean to run a macro? If you have a word written like (this:), it is regarded as a macro name."
				);
			}
			return typeCheckAndRun(name, Macros.get(name), args);
		},
		
		/*
			Runs a custom macro, whose definition is passed in instead of a name.
		*/
		runCustom(obj, args) {
			/*
				First, check that the variable is indeed a macro.
			*/
			if (!CustomMacro.isPrototypeOf(obj)) {
				return TwineError.create("macrocall", "I can't call " + objectName(obj) + " because it isn't a custom macro.");
			}
			return typeCheckAndRun('', obj, args);
		},
	};

	/*
		Some final commonly-used TypeSignatures.
	*/
	Object.assign(Macros.TypeSignature, {
		positiveNumber:      Macros.TypeSignature.numberRange(0.0001, Infinity),
		nonNegativeNumber:   Macros.TypeSignature.numberRange(0, Infinity),
		percent:             Macros.TypeSignature.numberRange(0, 1),
	});
	
	return Object.freeze(Macros);
});
