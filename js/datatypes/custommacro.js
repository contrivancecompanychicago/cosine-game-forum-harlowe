"use strict";
define(['jquery','utils/operationutils','internaltypes/changedescriptor', 'internaltypes/varref', 'internaltypes/varscope', 'internaltypes/twineerror', 'internaltypes/twinenotifier'], ($, {objectName, typeName, matches}, ChangeDescriptor, VarRef, VarScope, TwineError, TwineNotifier) => {
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
			TwineScript_TypeID:   "command",
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
			/*
				Note that since these cannot be serialised, they can't have a TwineScript_ToSource() method.
			*/
		});
		return ret;
	};

	/*
		This creates the "fn" function, normally present in built-in macros' entries in Macros,
		that will be run by Macros.runCustom(). It takes the stored body, assigns the passed-in args
		to the variable names (since type-checking has been completed), sets up the environment
		in which the body is executed, executes it, then returns the result.
	*/
	const macroEntryFn = (macro) => (section, ...args) => {
		/*
			First, increment the "called" value for this macro, which is used just below.
		*/
		macro.called += 1;

		const {varNames, params, body} = macro;
		/*
			The passed-in arguments to the custom macro become temp. variables
			immediately.
			You may notice this does NOT have access to any temp. variables outside the
			custom macro. So, closures do not exist in Harlowe custom macros at this time.
		*/
		const tempVariables = assign(create(VarScope), {
			TwineScript_VariableStoreName: macro.TwineScript_ObjectName + " call #" + macro.called,
			TwineScript_TypeDefs: create(null),
		});
		/*
			Whenever an error occurs, the DOM may be displayed. When that happens, TwineNotifiers displaying the input variables
			should be added to the start of the DOM.
		*/
		const notifiers = [];
		/*
			Feed the values into the variables scope with the correct names, taking care to
			make sure that rest params turn into arrays.
		*/
		let i = 0;
		args.forEach((arg, argIndex) => {
			const name = varNames[i];
			/*
				Load up the runtime type constraints, first. Note that rests become arrays, so they must be
				constrained as such... even though the array contents itself currently cannot.
			*/
			tempVariables.TwineScript_TypeDefs[name] = params[i].datatype.rest ?
				/*
					Due to a circular dependency, this module can't import Datatype. So, we obtain Datatype.create()
					from the passed-in datatype's prototype chain. Yeah.
				*/
				params[i].datatype.create('array') : params[i].datatype;
			/*
				Now, load up the actual value.
				This uses VarRef.set() instead of a straight assignment to invoke
				the VarRef 'set' event, as well as updating the TwineScript_KnownName of the value.
			*/
			const ref = VarRef.create(tempVariables, name);
			if (params[i].datatype.rest) {
				/*
					Because each .set() activates the 'set' event for VarRef, which includes Debug Mode's
					DOM updating, we need to only use .set() on the final iteration.
				*/
				const newArray = (tempVariables[name] || []).concat(arg);
				if (argIndex < args.length-1) {
					tempVariables[name] = newArray;
					return;
				} else {
					ref.set(newArray);
				}
			}
			else {
				ref.set(arg);
				i += 1;
			}
			notifiers.push(TwineNotifier.create(objectName(ref) + " is now " + objectName(tempVariables[name])));
		});
		/*
			Of course, giving no values to a rest param is valid, too.
		*/
		if (args.length) {
			i += 1;
		}
		if (params[i] && params[i].datatype.rest) {
			VarRef.create(tempVariables, varNames[i]).set([]);
			tempVariables.TwineScript_TypeDefs[name] = params[i].datatype.create('array');
		}

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
				Output is used for both the values returned by (output:) and the ChangeDescriptors returned by (output-hook:).
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
		const errors = dom.find('tw-error');

		if (errors.length) {
			/*
				Attach all those saved-up notifiers to the DOM.
			*/
			dom.prepend(notifiers.map(n => n.render()),"<br>");
			return TwineError.create('propagated', errors.length + ' error' + (errors.length > 1 ? 's' : '') + ' occurred when running ' + macro.TwineScript_ObjectName + '.',
				undefined, dom);
		}

		/*
			Currently, custom macros are required to return something, even if that thing is an error.
		*/
		if (output === undefined) {
			return TwineError.create("custommacro", macro.TwineScript_ObjectName + " didn't output any data or hooks using (output:) or (output-data:).");
		}
		/*
			As described above, if (output:) was run, and a ChangeDescriptor was
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

	const CustomMacro = Object.freeze({
		TwineScript_TypeID:   "macro",
		TwineScript_TypeName: "a custom macro",
		get TwineScript_ObjectName() {
			return this.TwineScript_KnownName ? "the " + this.TwineScript_KnownName + " macro" : "a custom macro";
		},
		TwineScript_GetProperty(prop) {
			if (prop === "params") {
				return [...this.params];
			}
		},
		TwineScript_Properties: ['params'],

		TwineScript_Print() {
			return "`[" + this.TwineScript_ObjectName + "]`";
		},

		/*
			As with Lambda.TwineScript_Clone(), this is rather naive, but should
			be sufficient given macros shouldn't be mutatable from user code.
		*/
		TwineScript_Clone() {
			return assign(create(CustomMacro), this);
		},

		TwineScript_ToSource() {
			return "(macro:" + this.params.map(p => p.TwineScript_ToSource())
				// This .concat() only adds a comma to the resulting string if params contained any other values.
				.concat('') + this.body.TwineScript_ToSource() + ")";
		},

		/*
			Custom macros have a TypeSignature that the type-checker functions in Macros
			require (using internal type-signature objects, not TypedVars), and with other values
			that Macros.addCustom() will pass into the macroEntryFn on execution: varNames and body.
		*/
		create(params, body) {
			const ret = assign(create(this), {
				params,
				/*
					The number of times this has been called throughout the whole story. Used
					entirely by the tempVariables scope of custom macro calls, to make
					Debug Mode's variables pane more informative.
				*/
				called: 0,
				varNames: params.map(p => p.varRef.propertyChain[0]),
				typeSignature: params.map(p => {
					/*
						Convert the datatype of this param into a Harlowe internal type signature.
					*/
					let type;
					if (p.datatype.toTypeSignatureObject) {
						type = p.datatype.toTypeSignatureObject({rest:p.rest});
					} else {
						type = {pattern: "range", range: e => matches(p.datatype, e), name: typeName(p.datatype)};
					}
					/*
						TypedVars, when "spread", become rest parameters. These should be translated
						into the "zeroOrMore" pattern used by Macros.
					*/
					if (p.rest) {
						return {pattern: "zero or more", innerType: type};
					}
					return type;
				}),
				body,
				/*
					knownName is assigned to whatever variable this data structure was last assigned to, by VarRef.set().
				*/
				TwineScript_KnownName: "",
			});
			ret.fn = macroEntryFn(ret);
			return ret;
		},
	});
	return CustomMacro;
});
