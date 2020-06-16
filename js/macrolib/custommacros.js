"use strict";
define(['utils', 'macros', 'state', 'utils/operationutils', 'datatypes/changercommand', 'datatypes/custommacro', 'datatypes/codehook', 'datatypes/typedvar', 'internaltypes/twineerror'],
(Utils, {add, addChanger, addCommand, TypeSignature: {rest, either, Any}}, State, {objectName}, ChangerCommand, CustomMacro, CodeHook, TypedVar, TwineError) => {

	/*d:
		(macro: [...TypedVar], CodeHook) -> CustomMacro

		Use this macro to construct your own custom macros, which you can (set:) into variables and call
		as easily as a built-in macro.

		Example usage:
		```
		(set: $healthSummary to (macro: dm-type _stats, [
			(set: _TheyAre to _stats's name + " is ")
			Dead characters get a single, pithy line.
			(if: _stats's HP <= 0)[(output: _TheyAre + "deceased.")]
			Living characters get specific status conditions referred to.
			(output:
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
		generative art, and so on. Being able to craft a language in which to write the many algorithms such
		games involve is essential to keeping your code succinct and readable.

		Creating a custom macro:

		Custom macros consist of two structures: a set of data inputs (called *parameters*), and a body of code that creates the output.
		Each of these is represented by two very specific data types, the TypedVar and the CodeHook.

		Each TypedVar consists of a datatype, the "-type" suffix, and a temp variable. When you, the author, call
		the macro and give data at that TypedVar's position, it is put into the temp variable if it fits the datatype.
		A macro stored in $treasure with `str-type _name, num-type price` can be called by `($treasure: "Gold Watch", 155)`.
		The datatypes are checked, and if they don't match (for instance, by incorrectly writing `($treasure: 155, "Gold Watch")`),
		then an error will result. This ensures that incorrectly written custom macro calls are caught early, just like with built-in macros.

		The CodeHook is where the code of your custom macro is written. You can (set:) temp variables in it, use (if:), (for:),
		(cond:) and so forth to run different sections of code, and output a final value using either (output:) or (output-hook:).
		(Consult each of those macros' articles to learn the exact means of using them, and their differences.) The temp variables
		specified by the TypedVars are automatically set with the passed-in data.

		Custom macros can be called like any other macro, by using the variable instead of a name: `($someCustomMacro:)` is how you would
		call a custom macro stored in the variable $someCustomMacro, and `(_anotherCustomMacro:)` is how you would
		call a custom macro stored in the temp variable _anotherCustomMacro.

		If you want to use a custom macro throughout your story, the best place to create it is in a "startup" tagged passage. This will aid
		in testing your story, as those passages' contents are always run first, regardless of the starting passage.

		Details:

		You can, of course, have zero TypedVars, for a macro that needs no input values, and simply outputs a complicated (or randomised) value
		by itself.

		Currently, (macro:) code hooks do NOT have access to temp variables created outside of them. `(set: _name to "Fox", _aCustomMacro to (macro:[(output:_name)])) (_aCustomMacro:)`
		will cause an error, because _name isn't accessible inside the _aCustomMacro macro. They do, however, have access to global variables (which begin with `$`).

		All custom macros must return some value. If no (output:) or (output-hook:) macros were run inside the code hook, an error will result.

		See also:
		(output:), (output-hook:)

		#custom macros 1
	*/
	add("macro", (_, ...parameters) => {
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
				if (parameters[i].varRef.object === State.variables) {
					return TwineError.create("datatype",
						"A custom macro's datatyped variables must be temp variables (with a '_'), not global variables (with a '$').",
						"Write them with a _ sigil at the start instead of a $ sigil.");
				}
				if (parameters[i].varRef.propertyChain.length > 1) {
					return TwineError.create("datatype",
						"A custom macro's datatyped variables can't be properties inside a data structure."
					);
				}
				const name = parameters[i].varRef.propertyChain[0];
				if (names.includes(name)) {
					return TwineError.create("datatype",
						"A custom macro's datatyped variables can't both be named '" + name + "'."
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
		(output: Any) -> Instant

		Use this macro inside a (macro:)'s CodeHook to output the value that the macro produces.

		Example usage:
		```
		(set: $randomCaps to (macro: str-type _str, [
			(output:
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
		If you wish to output a long span of code, please consider using the (output-hook:) changer instead.

		Details:
		As soon as an (output:) macro is run, all further macros and code in the CodeHook will be ignored,
		much like how the (go-to:) and (undo:) macros behave.

		Attempting to call (output:) outside of a custom macro's CodeHook will cause an error.

		See also:
		(output-hook:), (error:)

		#custom macros 2
	*/
	addCommand("output", () => {}, ({stack}, any) => {
		/*
			If this errors, then the error will be returned now.
		*/
		return outputValue("output", stack, any)
		/*
			By forcibly blocking the control flow of the section after executing this macro, (output:)
			has the same semantics as "return" in other programming languages.
		*/
			|| "blocked";
	}, [Any],
		/*attachable:false*/ false);

	/*d:
		(output-hook:) -> Changer

		Use this macro inside a (macro:)'s CodeHook to output a command that, when run, renders the attached hook.

		Example usage:
		```
		(set: $describePotion to (macro: dm-type _potion, [
			(size:0.7)+(box:"=XXXXX=")+(border:"solid")+(output-hook:)[\
			##(print:_potion's name)
			|==
			''Colour'': (print:_potion's colour)
			''Smell'': (print:_potion's smell)
			''Flask'': (print:_potion's flask)
			''Effect'': (print: _potion's effect)
			==|
			//(print: _potion's desc)//
			]
		]))
		($describePotion: (dm:
			"name", "Vasca's Dreambrew",
			"colour", "Puce",
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
		output a command that displays the hook, similar to how (print:) or (link-goto:) work.

		If you want your custom macro to return single values of data, like numbers or arrays, rather than hooks, please
		use the (output:) macro instead.

		Details:
		As soon as a hook with (output-hook:) attached is encountered, all further macros and code in the CodeHook will be ignored,
		just as how (output:) behaves. This behaviour is unique among changers.

		You can combine (output-hook:) with other changers, like (text-style:) or (link:). The hook that is displayed by the command
		will have those other changers applied to it.

		As you might have noticed, (output-hook:) accepts no values itself - simply attach it to a hook.

		Attempting to call (output:) outside of a custom macro's CodeHook will cause an error.

		See also:
		(output:), (error:)

		#custom macros 3
	*/
	addChanger("output-hook",
		(section) => Object.assign(ChangerCommand.create("output-hook", [section])),
		(cd, {stack,stackTop}) => {
			/*
				(output-hook:) commands are deferred render commands, but they need access to the temp variables
				present at the time of creation, inside the custom macro. This #awkward hack leverages
				loopVars to store the tempVariables, as just one sad little loop.
			*/
			cd.loopVars = Object.keys(stackTop.tempVariables).reduce((a,key) => {
				a[key] = [stackTop.tempVariables[key]];
				return a;
			},{});

			outputValue("output-hook", stack, cd);
			/*
				Unlike a command, changers have to explicitly block the section's control flow like so.
			*/
			stackTop.blocked = true;
			/*
				This leaves the passed-in CD unchanged.
				I believe every changer in Harlowe returns the same ChangeDescriptor, so any changers added to (output-hook:)
				before or after are still given to stackTop.
			*/
			return cd;
		},
		[]);

	/*d:
		(error: String) -> Instant

		Designed for use in custom macros, this causes the custom macro to immediately produce an error, with the given message,
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
		As with (output:), as soon as this is encountered, all further macros and code in the CodeHook will be ignored.
		Note that this occurs even if the macro is given as input to another macro - `(cond: false, (error:"There's a problem"), "")`
		will always produce the error, regardless of (cond:)'s behaviour.

		If an empty string is given to this macro, an error (different from the intended error) will be produced. Also,
		attempting to call (error:) outside of a custom macro's CodeHook will cause another (also different from intended) error.

		See also:
		(output:), (output-hook:)

		#custom macros 4
	*/
	addCommand("error",
		(message) => {
			if (!message) {
				return TwineError.create("datatype", "This (error:) macro was given an empty string.");
			}
		},
		({stack}, message) => {
			return outputValue("error", stack, TwineError.create("user", message)) || "blocked";
		},
	[String],
	/*attachable:false*/false);
});
