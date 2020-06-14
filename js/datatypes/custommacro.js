"use strict";
define(['jquery','internaltypes/changedescriptor', 'internaltypes/varscope', 'internaltypes/twineerror'], ($, ChangeDescriptor, VarScope, TwineError) => {
	const {assign,create} = Object;
	/*d:
		CustomMacro data

		These are custom macros produced by the (macro:) macro. You can (and should) store them in variables using (set:),
		and call them like any other macro, by using the variable instead of a name: `($someCustomMacro:)` is how you would
		call a custom macro stored in the variable $someCustomMacro, and `(_anotherCustomMacro:)` is how you would
		call a custom macro stored in the temp variable _anotherCustomMacro.

		Custom macros have a single data name that you can examine.

		| Data name | Example | Meaning
		|---
		| `params` | `$customMacro's params`, `params of $customMacro` | An array containing all of the TypedVar data given to the (macro:) macro when this was created.

		Placing custom macros directly into passage prose, such as by calling (macro:) outside of a (set:) or another data-storing
		macro, or writing a custom macro call incorrectly, will cause an error.

		For more information about custom macros, see the (macro:) macro's article.
	*/

	/*
		If a custom macro returns a changeDescriptor, it should be considered a command macro.
		That means it should return an object similar to that returned by commandMaker in Macros.
		Note that custom commands actually differ from internal command macros in an important respect:
		the macro's entire body is run, and errors reported, at command creation.
		Normally, (link-goto:) and other macros only drop errors when the command itself is deployed,
		but I decided not to complicate macroEntryFn by doing that for just custom commands.
		This means the TwineScript_Run() function here simply returns a pre-permuted CD (albeit
		one that can be further permuted by TwineScript_Attach().
	*/
	const commandObjectName = "a custom command";
	const makeCommandObject = cd => {
		const ret = assign({
			TwineScript_ObjectName: commandObjectName,
			TwineScript_TypeName: commandObjectName,
			TwineScript_Print: () => "`[" + commandObjectName + "]`",
			TwineScript_Attach: changer => {
				changer.run(cd);
				return ret;
			},
			/*
				When this command is run, simply return the fully permuted CD.
			*/
			TwineScript_Run: () => cd,
		});
		return ret;
	};

	/*
		This creates the "fn" function, normally present in built-in macros' entries in Macros,
		that will be run by Macros.runCustom(). It takes the stored body, assigns the passed-in args
		to the variable names (since type-checking has been completed), sets up the environment
		in which the body is executed, executes it, then returns the result.
	*/
	const macroEntryFn = ({varNames, body}) => (section, ...args) => {
		/*
			The passed-in arguments to the custom macro become temp. variables
			immediately.
			You may notice this does NOT have access to any temp. variables outside the
			custom macro. So, closures do not exist in Harlowe custom macros at this time.
		*/
		const tempVariables = assign(create(VarScope), {
			TwineScript_VariableStoreName: "a custom macro call",
		});
		args.forEach((arg,i) => tempVariables[varNames[i]] = arg);

		/*
			Prepare the section stack by affixing the arguments, creating a sealed-off DOM to run the body,
			and attaching a special "output" property used to retrieve the output.
			The stack frame itself needs to be in a variable because .execute() will pop it off the stackTop.
		*/
		let output, dom = $('<p>').append(body.html);
		section.stack.unshift({
			tempVariables,
			dom,
			/*
				Output is used for both the values returned by (output:) and the ChangeDescriptors returned by (command:).
			*/
			output(data) {
				/*
					Because both output macros block control flow to force an early exit, there shouldn't be a need
					for a double-output error (i.e. output already having a value).
				*/
				output = data;
			},
		});
		section.execute();
		/*
			Section.execute() doesn't pop the stack frame if it's blocked, since it could potentially unblock, and
			the entire section is discarded when (goto:) or (undo:) activate. In the case of (output:), we must
			pop the stack frame ourselves.
		*/
		if (section.stackTop.blocked) {
			section.stack.shift();
		}
		/*
			If errors resulted from this execution, extract and return those instead of the output.
		*/
		const errors = dom.find('tw-error').get().map(e =>
			/*
				This makes use of the fact that rendered TwineErrors have the original error stashed on them, so that
				Section.evaluateTwineMarkup() can de-render them after the fact.
			*/
			$(e).data('TwineError').message
		).join('\n');

		if (errors.length) {
			//TODO: attach the DOM and view it with a given button.
			return TwineError.create('custommacro','These errors occurred when running a custom macro:\n' + errors);
		}

		/*
			Currently, custom macros are required to return something, even if that thing is an error.
		*/
		if (output === undefined) {
			return TwineError.create("custommacro", "This custom macro didn't output any data using (output:) or (output-hook:).");
		}
		/*
			As described above, if (output-hook:) was run, and a ChangeDescriptor was
			returned, then this custom macro should be considered a command macro.
		*/
		if (ChangeDescriptor.isPrototypeOf(output)) {
			return makeCommandObject(output);
		}
		/*
			Otherwise, simply return the outputted value.
		*/
		return output;
	};

	return Object.freeze({
		TwineScript_TypeName: "a custom macro",
		TwineScript_ObjectName: "a custom macro",
		TwineScript_GetProperty(prop) {
			if (prop === "params") {
				return [...this.params];
			}
		},
		TwineScript_Properties: ['params'],

		/*
			Custom macros have a TypeSignature that the type-checker functions in Macros
			require (using internal type-signature objects, not TypedVars), and with other values
			that Macros.addCustom() will pass into the macroEntryFn on execution: varNames and body.
		*/
		create(params, body) {
			const ret = Object.assign(Object.create(this), {
				params,
				varNames: params.map(p => p.varRef.propertyChain[0]),
				typeSignature: params.map(p => p.datatype.toTypeSignatureObject()),
				body,
			});
			ret.fn = macroEntryFn(ret);
			return ret;
		},
	});
});
