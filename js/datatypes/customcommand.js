"use strict";
define(['internaltypes/changedescriptor', 'internaltypes/twineerror'], (ChangeDescriptor, TwineError) => {
	const {assign,create} = Object;
	/*
		If a custom macro returns a {toSource, changer, hook, vars} object, it should be considered a command macro.
		That means macroEntryFn should return an object similar to that returned by commandMaker in Macros.
		Note that custom commands actually differ from internal command macros in an important respect:
		the macro's entire body is run, and errors reported, at command creation.
		Normally, (link-goto:) and other macros only drop errors when the command itself is deployed,
		but I decided not to complicate macroEntryFn by doing that for just custom commands.
		This means the TwineScript_Run() function here simply returns a pre-permuted CD (albeit
		one that can be further permuted by TwineScript_Attach().
	*/
	const CustomCommand = Object.seal({
		
		TwineScript_TypeID:   "command",
		TwineScript_ObjectName: "a custom command",
		TwineScript_TypeName: "a custom command",
		TwineScript_Print: () => "`[a custom command]`",

		create(commandDesc) {
			const {toSource, changer, hook, variables} = commandDesc;
			/*
				This #awkward hack leverages loopVars to provide the tempVariables to the changer, as just one sad little loop.
				This must collect all of the tempVariables in this stack, so an 'in' loop (without hasOwnProperty) must be used.
			*/
			const loopVars = {};
			for(let key in variables) {
				/*
					A normal loopVars object looks something like this:
					{ a: [1,2,3], b: [5,6], },
					where each array position represents a loop iteration. As there is only one loop iteration here, each variable gets an array of 1 element.
				*/
				loopVars[key] = [variables[key]];
			}
			/*
				Note that this has no section - that is only added when TwineScript_Run() is called.
				This allows the custom command, which could contain (replace:) or other such revision operations,
				to work across passages.
			*/
			const cd = ChangeDescriptor.create({source: hook, loopVars}, changer);
			if (TwineError.containsError(cd)) {
				return cd;
			}
			const ret = assign(create(this), {
				/*
					TODO: doesn't this mutate the custom command??
				*/
				TwineScript_Attach: attachedChanger => {
					const error = attachedChanger.run(cd);
					if (TwineError.containsError(error)) {
						return error;
					}
					return ret;
				},
				TwineScript_Run: section => {
					cd.section = section;
					return cd;
				},
				/*
					While this is output by (source:), this is not used for State serialisation.
				*/
				TwineScript_ToSource() {
					return toSource;
				},
				/*
					The internals of the custom command must be given to State for serialisation, to completely
					capture the internal variables, the (out:) hook, and the (out:) changer (combined with other changers) that was
					attached to that hook. There isn't really an easier way of doing this at the moment.
				*/
				TwineScript_CustomCommand() {
					return commandDesc;
				},
			});
			return ret;
		},
	});
	return CustomCommand;
});