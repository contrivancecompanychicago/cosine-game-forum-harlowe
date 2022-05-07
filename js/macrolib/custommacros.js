"use strict";
define(['utils', 'macros', 'state', 'utils/operationutils', 'datatypes/changercommand', 'datatypes/custommacro', 'datatypes/codehook', 'datatypes/typedvar', 'internaltypes/twineerror'],
(Utils, Macros, State, {objectName, toSource}, ChangerCommand, CustomMacro, CodeHook, TypedVar, TwineError) => {
	const {add, addChanger, addCommand, TypeSignature: {rest, either, Any, Everything, zeroOrMore}} = Macros;
	/*d:
		(macro: [...TypedVar], CodeHook) -> CustomMacro

		Use this macro to construct your own custom macros, which you can (set:) into variables and call
		as easily as a built-in macro.

		Example usage:
		The following custom macro creates a command that displays a randomly rotated hook in red, with the given opacity.
		```
		(set:$ghostlyLaughter to (macro: num-type _o, [
			(output: )+(text-rotate:(random:0,360))+(text-colour:(hsla:0, 1, 0.5, _o))[HE HE HE]
		]))
		($ghostlyLaughter:0.9) ($ghostlyLaughter:0.5) ($ghostlyLaughter:0.3)
		```

		The following custom macro creates a text string based on how many turns the player has taken. It takes no data.
		```
		(set: $fancyTimeName to (macro: [
			(set: _timeOfDay to turns % 24 + 1)
			(output-data: (a:
				"midnight", "dreamshour", "wolfshour", "dark's end", "lightbreak", "afterdawn", "early rise", "awakening",
				"early warming", "joyshour", "first lunch", "shadow's end", "zenith", "shadow's birth", "second lunch", "hopeshour", "early cooling",
				"lightfade", "sundown", "dark's birth", "supper", "early rest", "slumbering", "catshour"
			)'s (_timeOfDay))
		]))
		It is now ($fancyTimeName:).
		```

		The following custom macro takes a datamap containing a character's attributes, and prints a line of text describing a character.
		```
		(set: $charSheet to (dm: "name", str, "HP", num, "poison", num, "heartbreak", bool))
		(set: $healthSummary to (macro: $charSheet-type _stats, [
			This text inside the macro is not displayed during the game.
			(set: _TheyAre to _stats's name + " is ")
			Dead characters get a single, pithy line.
			(if: _stats's HP <= 0)[(output: _TheyAre + "deceased.")]
			Living characters get specific status conditions referred to.
			(output-data:
				_TheyAre + "in " + (cond: _stats's HP > 50, "fair", "poor") + " health." +
				(cond: _stats's poison > 0, " " + _TheyAre + "poisoned.", "") +
				(cond: _stats's heartbreak, " " + _TheyAre + "heartbroken.", "")
			)
		]))
		(set: $steelyStats to (dm: "name", "Steely", "HP", 80, "poison", 0, "heartbreak", true))
		($healthSummary: $steelyStats)
		```

		Rationale:

		This macro provides you with the means to expand Harlowe's collection of built-in macros with
		custom utilities tailored specifically for your story. While many Twine projects are simple
		hypertext stories, there are many that use it to make more complicated simulations, role-playing games,
		generative art, and so on. Being able to craft a personal language of macros in which to write the many algorithms
		and textual structures such games involve is essential to keeping your code succinct and readable.

		Writing the parameters:

		Custom macros consist of two structures: a set of data inputs (called *parameters*), and a body of code that creates the output.

		Each parameter consists of a datatype or pattern of data, the "-type" suffix, and a temp variable, just like typed temp variables created with (set:).
		When you, the author, call the macro and give data at that parameter's position, it is put into the temp variable if it fits the datatype.
		A macro stored in $treasure with `str-type _name, num-type price` can be called by `($treasure: "Gold Watch", 155)`.
		The types are checked, and if they don't match (for instance, by incorrectly writing `($treasure: 155, "Gold Watch")`),
		then an error will result. This ensures that incorrectly written custom macro calls are caught early, just like with built-in macros.

		As with TypedVars used in other places, you can use a complex data structure as the "type" of the variable - `(a: num, num)-type _coords`
		specifies a parameter that requires an array of two numbers. If you wish to write a very general value-selection or data-structure macro,
		such as `(a:)` or `(either:)`, that can take any kind of data value, you can write `any-type` for that parameter. However, using `any-type` is
		not recommended unless you genuinely need it, as you miss out on the ability to catch wrong-type errors.

		You might, on occasion, want to make a macro that can take an arbitrary amount of values, similar to certain built-in macros like `(a:)`,
		`(altered:)`, and so forth. To do this, you can place the spread `...` syntax in front of a parameter's datatype. Just as a spread datatype
		matches zero or more values when it is used with the `matches` operator, a spread parameter represents zero or more values of the same data type
		that you give to a macro call. Think of this as the opposite counterpart of the spread `...` syntax in macro calls. Instead of turning one value
		(such as an array) into many spread-out values, this turns many values into a single array value. A custom macro stored in $mean with `...num-type _n` can be called
		with `($mean:1,4,5,6)`, which sets _n to `(a:1,4,5,6)`. `($mean:2,3)` sets _n to `(a:2,3)`, and `($mean:)` sets _n to `(a:)`. Note that
		because it takes every value at or after it, it must be the final parameter	of your custom macro.

		```
		(set: $mean to (macro: ...num-type _a, [
			(output-data:(folded: _num making _total via _total + _num, ..._a) / _a's length)
		]))
		One's 7 foot 4, one's 4 foot 7. Add 'em up and divide by two, ya get a regular ($mean:7 + 4/12, 4 + 7/12)-foot person.
		```

		Writing the code:

		The CodeHook, conversely, is where the code of your custom macro is written. You can (set:) temp variables in it, use (if:), (for:),
		(cond:), and so forth to run different sections of code, and finally output something using either (output:) or (output-data:).
		(Consult each of those macros' articles to learn the exact means of using them, and their differences.) The temp variables
		specified by the aforementioned typed variables are automatically set with the passed-in data.

		Custom macros can be called like any other macro, by using the variable instead of a name: `($someCustomMacro:)` is how you would
		call a custom macro stored in the variable $someCustomMacro, and `(_anotherCustomMacro:)` is how you would
		call a custom macro stored in the temp variable _anotherCustomMacro.

		If you want to use a custom macro throughout your story, the best place to create it is in a "startup" tagged passage. This will aid
		in testing your story, as those passages' contents are always run first, regardless of the starting passage.

		Normally, players can't see inside code hooks, but if an error occurs inside a custom macro, the error message will have an "Open" button
		allowing the code hook's interior to be viewed. You can take advantage of this by adding (print:) commands inside the code hook, showing
		you what certain variables contain at certain places in the hook.

		Details:

		You can, of course, have zero parameters, for a macro that needs no input values, and simply outputs a complicated (or randomised) value
		by itself.

		Currently, (macro:) code hooks do NOT have access to temp variables created outside of the (macro:) call. `(set: _name to "Fox")(set:_aCustomMacro to (macro:[(output-data:_name)])) (_aCustomMacro:)`
		will cause an error, because _name isn't accessible inside the _aCustomMacro macro. They do, however, have access to global variables (which begin with `$`).

		Much like with typed variables given to (set:) or (put:), each temp variable associated with a parameter is restricted to the given data type. So,
		`(macro:num-type _a,[(set:_a to 'text')(output-data:_a)]` will cause an error when run.

		All custom macros must return some value. If no (output:) or (output-data:) macros were run inside the code hook, an error will result.

		If you find yourself writing custom macros that do nothing except call another macro, such as `(macro: num-type _a, [(out-data:(range:0,_a))])`,
		then you may prefer to use the (partial:) macro instead of (macro:).

		See also:
		(output:), (output-data:), (partial:)

		Added in: 3.2.0
		#custom macros 1
	*/
	add("macro", "CustomMacro", (_, ...parameters) => {
		/*
			The type-signature given below isn't as precise as it could be (because this macro, unlike all others,
			requires a different-typed final parameter after a rest parameter) so this loop corrects that.
		*/
		let i;
		const names = [];
		for(i = 0; i < parameters.length; i += 1) {
			const last = (i === parameters.length - 1);
			// The param must be a typedvar XOR the last parameter.
			if (TypedVar.isPrototypeOf(parameters[i]) === last) {
				return TwineError.create("datatype", "The " + (!last ? Utils.nth(parameters.length-i+1) + "-" : '')
					+ "last value given to (macro:) should be a " + (!last ? "datatyped variable" : "code hook") + ", not " + objectName(parameters[i]));
			}
			/*
				Even though the VarRefs themselves are not used at all as objects when running custom macros, it is still
				important that they are not syntactically written as global variables, but rather temp variables, as that
				is how they semantically behave inside the code hook / macro body.
			*/
			if (!last) {
				const ACM = "A custom macro";
				if (parameters[i].varRef.object === State.variables) {
					return TwineError.create("datatype",
						ACM + "'s typed variables must be temp variables (with a '_'), not global variables (with a '$').",
						"Write them with a _ symbol at the start instead of a $ symbol.");
				}
				if (parameters[i].varRef.propertyChain.length > 1) {
					return TwineError.create("datatype",
						ACM + "'s typed variables can't be properties inside a data structure."
					);
				}
				if (parameters[i].datatype.rest && i !== parameters.length - 2) {
					return TwineError.create("datatype",
						ACM + " can only have one spread variable, and it must be its last variable."
					);
				}
				const name = parameters[i].varRef.propertyChain[0];
				if (names.includes(name)) {
					return TwineError.create("datatype",
						ACM + "'s typed variables can't both be named '" + name + "'."
					);
				}
				names.push(name);
			}
		}
		return CustomMacro.create(parameters.slice(0, -1), parameters[parameters.length-1]);
	},
	[rest(either(TypedVar, CodeHook))]);

	/*
		This utility function, which could perhaps be integrated into Section, drills through a stack to find
		the frame that has an output() function, and puts the data in it. Additionally, if that function
		can't be found anywhere, then it's safe to assume that (output:) was called outside of a
		custom macro.
	*/
	const outputValue = (name, stack, data) => {
		const inCustomMacro = stack.some(frame => {
			if (typeof frame.output === "function") {
				frame.output(data);
				return true;
			}
		});
		if (!inCustomMacro) {
			return TwineError.create("macrocall","(" + name + ":) should only be used inside a code hook passed to (macro:).");
		}
	};

	/*d:
		(output-data: Any) -> Instant
		Also known as: (out-data:)

		Use this macro inside a (macro:)'s CodeHook to output the value that the macro produces.

		Example usage:
		```
		(set: $randomCaps to (macro: str-type _str, [
			(output-data:
				(folded: _char making _out via _out + (either:(lowercase:_char),(uppercase:_char)),
				..._str)
			)
		]))
		($randomCaps:"I think my voice module is a little bit very broken.")
		```

		Rationale:
		For more information on custom macros, consult the (macro:) macro's article.
		All custom macros have inputs and output. This macro specifies the data value to output - provide it at the end
		of your macro's CodeHook, and give it the value you want the macro call to evaluate to.

		This is best suited for macros which primarily compute single data values, like strings, arrays and datamaps.
		If you wish to output a long span of code, please consider using the (output:) changer instead.

		Details:
		As soon as an (output-data:) macro is run, all further macros and code in the CodeHook will be ignored,
		much like how the (go-to:) and (undo:) macros behave.

		Attempting to call (output-data:) outside of a custom macro's CodeHook will cause an error.

		See also:
		(output:), (error:)

		Added in: 3.2.0
		#custom macros 3
	*/
	addCommand(["output-data", "out-data"], () => {}, ({stack}, any) => {
		/*
			If this errors, then the error will be returned now.
		*/
		return outputValue("output-data", stack, any)
		/*
			By forcibly blocking the control flow of the section after executing this macro, (output:)
			has the same semantics as "return" in other programming languages.
		*/
			|| { blocked: true };
	}, [Any],
		/*attachable:false*/ false);

	/*d:
		(output:) -> Changer
		Also known as: (out:)

		Use this macro inside a (macro:)'s CodeHook to output a command that, when run, renders the attached hook.

		Example usage:
		```
		(set: $describePotion to (macro: dm-type _potion, [
			(size:0.7)+(box:"=XXXXX=")+(border:"solid")+(output:)[\
			##(print:_potion's name)
			|==
			''Hue'': (print:_potion's hue)
			''Smell'': (print:_potion's smell)
			''Flask'': (print:_potion's flask)
			''Effect'': (print: _potion's effect)
			==|
			//(print: _potion's desc)//
			]
		]))
		($describePotion: (dm:
			"name", "Vasca's Dreambrew",
			"hue", "Puce",
			"smell", "Strong acidic honey",
			"flask", "Conical, green glass, corked",
			"effect", "The drinker will, upon sleeping, revisit the last dream they had, exactly as it was.",
			"desc", "Though Vasca was famed in life for her more practical potions, this brew is still sought after"
			+ " by soothsayers and dream-scryers alike.",
		))
		```

		Rationale:
		For more information on custom macros, consult the (macro:) macro's article.
		All custom macros have inputs and output. This macro lets you output an entire hook, displaying it in a single
		call of the macro. Attach this to a hook at the end of your custom macro's code hook, and the custom macro will
		produce a command that displays the hook, similar to how (print:) or (link-goto:) work.

		If you want your custom macro to return single values of data, like numbers or arrays, rather than hooks, please
		use the (output-data:) macro instead.

		Details:
		As soon as a hook with (output:) attached is encountered, all further macros and code in the CodeHook will be ignored,
		just as how (go-to:) and (redirect:) behave. This behaviour is unique among changers.

		You can combine (output:) with other changers, like (text-style:) or (link:). The hook that is displayed by the command
		will have those other changers applied to it.

		As you might have noticed, (output:) accepts no values itself - simply attach it to a hook.

		Attempting to use (output:) outside of a custom macro's CodeHook will cause an error.

		See also:
		(output-data:), (error:)

		Added in: 3.2.0
		#custom macros 2
	*/
	addChanger(["output", "out"],
		() => Object.assign(ChangerCommand.create("output", [])),
		(cd) => {
			const {section:{stack,stackTop}} = cd;
			/*
				(output:) commands are deferred render commands, but they need access to the temp variables
				present at the time of creation, inside the custom macro. This #awkward hack leverages
				loopVars to store the tempVariables, as just one sad little loop.

				This must collect all of the tempVariables in this stack, so an 'in' loop (without hasOwnProperty) must be used.
			*/
			cd.loopVars = {};
			for(let key in stackTop.tempVariables) {
				if(!key.startsWith('TwineScript_')) {
					cd.loopVars[key] = [stackTop.tempVariables[key]];
				}
			}
			/*
				This is used to suppress the output hook (that which this changer is attached to) from being run inside the
				custom macro.
			*/
			cd.output = true;

			outputValue("output", stack, cd);
			/*
				Unlike a command, changers have to explicitly block the section's control flow like so.
			*/
			stackTop.blocked = true;
			/*
				This leaves the passed-in CD unchanged.
				I believe every changer in Harlowe returns the same ChangeDescriptor, so any changers added to (output:)
				before or after are still given to stackTop.
			*/
			return cd;
		},
		[]);

	/*d:
		(error: String) -> Instant

		Designed for use in custom macros, this causes the custom macro to immediately produce an error, with the given message string,
		and ceases running any further code in the CodeHook.
		
		Example usage:
		```
		(set: $altCaps to (macro: str-type _input, [
			(if: _input is "")[(error: "I can't alt-caps an empty string.")]
			(output:
				(folded: _char making _result via _result +
					(cond: pos % 2 is 0, (lowercase:_char), (uppercase:_char)),
					..._input
				)
			)
		]))
		($altCaps:"")
		```

		Rationale:
		Allowing your custom macros to produce insightful error messages is essential to making them user-friendly, especially
		if you intend other authors to use them. In the example above, for instance, an empty string inputted to the $altCaps
		macro would causes (folded:) to produce an error, as `..._input` would spread zero characters. However, the earlier
		custom error provides a better message, explaining exactly what the problem is.

		Details:
		As with (output-data:), as soon as this is encountered, all further macros and code in the CodeHook will be ignored.
		Note that this occurs even if the macro is given as input to another macro - `(cond: false, (error:"There's a problem"), "")`
		will always produce the error, regardless of (cond:)'s behaviour.

		If an empty string is given to this macro, an error (different from the intended error) will be produced. Also,
		attempting to call (error:) outside of a custom macro's CodeHook will cause another (also different from intended) error.

		See also:
		(output:), (output-data:), (assert:)

		Added in: 3.2.0
		#custom macros 4
	*/
	addCommand("error",
		(message) => {
			if (!message) {
				return TwineError.create("datatype", "This (error:) macro was given an empty string.");
			}
		},
		({stack}, message) => {
			return outputValue("error", stack, TwineError.create("user", message)) || { blocked: true };
		},
	[String],
	/*attachable:false*/false);

	/*d:
		(partial: String or CustomMacro, [...Any]) -> CustomMacro

		When given either the string name of a built-in macro, or a custom macro, followed by various values, this creates a custom
		macro that serves as a shorthand for calling the given macro with those values, plus any additional values.

		Example usage:
		* `(set: $zeroTo to (partial:"range", 0))` sets $zeroTo to a custom macro which is a shortcut for calling (range:) with 0 as the first value.
		`($zeroTo: 10)` is the same as `(range:0,10)`. `($zeroTo: 5)` is the same as `(range:0,5)`.
		* `(set: $askDLG to (partial:"dialog", bind _result))` sets $askDLG to a custom macro that calls (dialog:) bound to the _result temp variable. This
		can be used repeatedly to show dialogs that ask input from the player, without having to include the bound variable each time.
		* `(set: $next to (partial:"link-goto", "==>"))` creates a custom macro that produces passage links, where the link text is always "==>".
		Calling `($next2:)` would thus be equivalent to `(link-goto: "==>", "Continue")`.
		* `(set: $next2 to (partial: $next, "Continue"))` takes the previous example's custom macro, stored in $next, and makes a version where the passage name is always "Continue".
		* `(set: $envNoise to (partial:'either',"","",""))` creates a custom macro that randomly chooses between three empty strings and any other values you might
		give. This could be used for random flavour text in environments: `($envNoise:"You hear a jingling windchime")` would only display the text
		"You hear a jingling windchime" 25% of the time the macro is run.

		Rationale:

		This is designed as a shorthand for writing certain common macro calls with the same first values over and over. Think of (partial:) as creating
		a *partial macro call* - one that isn't finished, but which can be used to make finished calls to that macro, by providing the remaining values.

		You may notice that a number of macros in Harlowe have a "configuration-first" ordering of their values - (rotated:) takes the number of rotations first,
		(sorted:) takes the optional sorting lambda first, (cycling-link:) takes the optional bound variable first, and so forth. This ordering works well with
		(partial:).

		Details:

		Don't fall into the trap of thinking the values given to (partial:) will be re-evaluated on each call of the custom macro! For instance,
		`(partial: "count", (history: ))` will *not* produce a custom macro that is always equivalent to `(count:(history: ), ..._someOtherNumbers)`.
		Remember that (history:) produces an array of passage names each time it's called. It is that array that is given to (partial:), so every
		call to the produced custom macro will use *that* array, and not whatever the current (history:) array would be.

		Unlike macros created with (macro:), the "params" data name of macros created with (partial:) is always an empty array.

		As of 3.3.0, this can **not** be used with metadata macros such as (metadata:) or (storylet:). Giving "metadata", "storylet" or other such
		macros' names will produce an error.

		See also:
		(macro:)

		Added in: 3.3.0
		#custom macros
	*/
	add("partial", "CustomMacro", (_, nameOrCustomMacro, ...args) => {
		const customMacro = typeof nameOrCustomMacro !== "string" && nameOrCustomMacro;
		const name = !customMacro && nameOrCustomMacro;
		if (!customMacro) {
			if (!Macros.has(name)) {
				return TwineError.create('macrocall', `The macro name given to (partial:), "${nameOrCustomMacro}", isn't the name of a built-in macro.`);
			}
			if (Macros.get(name).returnType === "Metadata") {
				return TwineError.create('macrocall', `(partial:) can't be used with metadata macros such as (${nameOrCustomMacro}:)`);
			}
		}
		/*
			This has an obvious problem when nameOrCustomMacro is a custom macro: the entire source of the original custom macro must be
			included in the (source:) representation of this partial. However, there's no way around it.
		*/
		const source = `(partial:${toSource(nameOrCustomMacro)},${args.map(a => toSource(a))})`;
		/*
			createFromFn() allows a special kind of custom macro to be created using a JS function instead of a codehook body.
		*/
		const macro = CustomMacro.createFromFn((section, ...moreArgs) => {
				const ret = Macros[typeof nameOrCustomMacro === "string" ? 'run' : 'runCustom'](nameOrCustomMacro, section, args.concat(moreArgs));
				if (TwineError.containsError(ret)) {
					ret.message = `An error occurred while running the (partial:)-created macro, ${macro.TwineScript_ObjectName}:\n` + ret.message;
				}
				return ret;
			},
			/*
				The TwineScript_ObjectName of this macro usually specifically references the macro call it's equivalent to, but in the case of it being a partial
				of an unnamed custom macro (in the case of a (macro:) call being given to (partial:) directly) there isn't an easy way of representing this in a way
				that accurately portrays the original call. Thus, 
			*/
			`a (partial:) custom macro of ${!name && !customMacro.TwineScript_KnownName ? `another unnamed custom macro` : `(${name || customMacro.TwineScript_KnownName}:${args.map(a => toSource(a))})`}`,
			/*
				This is the TwineScript_ToSource of this custom macro. The source representation is cached above to save a little time.
			*/
			() => source,
			/*
				The type signature, used for basic Harlowe type-checking, is simply constructed by reducing the prior macro's type signature.
			*/
			(name ? Macros.get(name).typeSignature : customMacro.typeSignature)
				/*
					Chop off all the pre-filled args, unless they are "rest" or "zeroOrMore".
				*/
				.filter((e,i) => i >= args.length || (e.pattern === "rest" || e.pattern === "zero or more"))
		);
		return macro;
	},
	[either(String, CustomMacro), zeroOrMore(Everything)]);
});
