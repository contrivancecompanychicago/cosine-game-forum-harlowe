"use strict";
define(['utils', 'macros', 'state', 'utils/operationutils', 'datatypes/changercommand', 'datatypes/custommacro', 'datatypes/codehook', 'datatypes/typedvar', 'internaltypes/twineerror'],
(Utils, {add, addChanger, addCommand, TypeSignature: {rest, either, Any}}, State, {objectName}, ChangerCommand, CustomMacro, CodeHook, TypedVar, TwineError) => {

	/*d:
		(macro: [...TypedVar], CodeHook) -> CustomMacro

		Use this macro to construct your own custom macros, which you can (set:) into variables and call
		as easily as a built-in macro.

		Example usage:
		```
		(set: $healthSummary to (macro: datamap-type _stats, [
			(if: _stats's HP <= 0)[(output: "You appear to be deceased.")]
			(output:
				"Your vital signs are " + (cond: _stats's HP > 50, "fair.", "poor.") +
				(cond: _stats's poison > 0, " You are poisoned.", "") +
				(cond: _stats's heartbreak, " You are heartbroken.")
			)
		]))
		```

		TBW
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
			/*
				TODO: Error if any Live macros are in the CodeHook.
				TODO: Macros have optional names.
				TODO: Macros error when placed in bare passage prose.
			*/
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
