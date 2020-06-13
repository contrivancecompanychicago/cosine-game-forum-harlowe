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
			Living characters get specific status conditions called out.
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

		Details:

		You can, of course, have zero TypedVars, for a macro that needs no input values, and simply outputs a complicated (or randomised) value
		by itself.

		In this version, (macro:) code hooks do NOT have access to temp variables created outside of them. `(set: _name to "Fox", _aCustomMacro to (macro:[(output:_name)])) (_aCustomMacro:)`
		will cause an error, because _name isn't accessible inside the _aCustomMacro macro.

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
		for(i = 0; i < parameters.length; i += 1) {
			const last = (i === parameters.length - 1);
			if (TypedVar.isPrototypeOf(parameters[i]) === last) {
				return TwineError.create("datatype", "The " + (!last ? Utils.nth(parameters.length-i+1) + "-" : '')
					+ "last value given to (macro:) should be a " + (!last ? "datatyped variable" : "code hook") + ", not " + objectName(parameters[i]));
			}
			/*
				Even though the varRefs themselves are not used at all as objects when running custom macros, it is still
				important that they are not syntactically written as global variables, but rather temp variables, as that
				is how they semantically behave inside the code hook / macro body.
			*/
			if (!last && parameters[i].varRef.object === State.variables) {
				return TwineError.create("datatype",
					"The datatyped variables named for (macro:) must be temp variables (with a '_'), not global variables (with a '$').",
					"Write them with a _ sigil at the start instead of a $ sigil.");
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
	const outputValue = (stack, data) => {
		const inCustomMacro = stack.some(frame => {
			if (typeof frame.output === "function") {
				frame.output(data);
				return true;
			}
		});
		if (!inCustomMacro) {
			return TwineError.create("macrocall","(output:) and (output-hook:) should only be used inside a code hook passed to (macro:).");
		}
	};

	/*d:
		(output: Any) -> Instant

		TBW

		See also:
		(output-hook:)

		#custom macros 2
	*/
	addCommand("output", () => {}, ({stack}, any) => {
		/*
			If this errors, then the error will be returned now.
		*/
		return outputValue(stack, any)
		/*
			By forcibly blocking the control flow of the section after executing this macro, (output:)
			has the same semantics as "return" in other programming languages.
		*/
			|| "blocked";
	}, [Any],
		/*attachable:false*/ false);

	/*d:
		(output-hook: Any) -> Changer

		TBW

		See also:
		(output:)

		#custom macros 3
	*/
	addChanger("output-hook",
		(section) => Object.assign(ChangerCommand.create("output-hook", [section]), { TwineScript_Unstorable: true }),
		(cd, section) => {
			outputValue(section.stack, cd);
			/*
				Unlike a command, changers have to explicitly block the section's control flow like so.
			*/
			section.stackTop.blocked = true;
			/*
				This leaves the passed-in CD unchanged.
				I believe every changer in Harlowe returns the same ChangeDescriptor, so any changers added to (output-hook:)
				before or after are still given to stackTop.
			*/
			return cd;
		},
		[]);
});
