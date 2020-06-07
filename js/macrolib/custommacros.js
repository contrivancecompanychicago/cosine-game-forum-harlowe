"use strict";
define(['utils', 'macros', 'utils/operationutils', 'datatypes/codehook', 'datatypes/typedvar', 'internaltypes/twineerror'], (Utils, Macros, {objectName}, CodeHook, TypedVar, TwineError) => {

	const {assign, create, freeze} = Object,
		{rest, either} = Macros.TypeSignature;

	const CustomMacro = freeze({
		TwineScript_TypeName: "a custom macro",
		TwineScript_ObjectName: "a custom macro",
	});

	Macros.add("macro", (_, ...parameters) => {
		/*
			The type-signature given below isn't as precise as it could be (because this macro, unlike all others,
			requires a different-typed final parameter after a rest parameter) so this loop corrects that.
		*/
		let i;
		for(i = 0; i < parameters.length; i += 1) {
			const last = (i !== parameters.length - 1);
			if (TypedVar.isPrototypeOf(parameters[i]) !== last) {
				return TwineError.create("datatype", "The " + (!last ? Utils.nth(parameters.length-i+1) + "-" : '')
					+ "last value given to (macro:) should be a " + (!last ? "datatyped variable" : "code hook") + ", not " + objectName(parameters[i]));
			}
		}
		const p = parameters.slice(0, i);
		return assign(create(CustomMacro), {
			parameters: p,
			typeSignature: p.map(p => p.datatype.toTypeSignatureObject()),
			body: parameters[i],
		});
	},
	[rest(either(TypedVar, CodeHook))]);
});
