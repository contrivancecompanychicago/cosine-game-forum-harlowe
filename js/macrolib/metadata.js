"use strict";
define(['macros','renderer', 'utils/operationutils', 'datatypes/lambda', 'internaltypes/twineerror'], (Macros, Renderer, {clone, objectName, isValidDatamapName}, Lambda, TwineError) => {
	/*d:
		Metadata data
		Certain kinds of macros are not used inside the passage itself, but are used to mark the passage as being special in some way, or having certain
		data available to other macros that inspect the story's state, such as (passages:) or (open-storylets:). These macros are "metadata" macros,
		because they attach metadata to the passage. These macros must appear at the very start of those passages, ahead of every other kind of macro.
	*/
	const {zeroOrMore, Any} = Macros.TypeSignature;
	Macros.add
		/*d:
			(storylet: Lambda) -> Metadata

			When placed in a passage, it marks that passage as a storylet, using the lambda as the condition on which it's available, so that other macros,
			like (open-storylets:), can see the passage.

			Example usage:

			* `(storylet: when $season is "winter" and $married is false and visits is 0)`
			* `(storylet: when "mortuary" is in (history: ))`

			Rationale:
			Storylets are mini-stories within a story - disconnected sequences of passages that can be visited non-linearly when certain conditions are fulfilled.
			They allow a different way of writing interactive fiction than the rigid tree structure of typical Twine games: instead,
			simply write scenes and events that occur in the story, use this macro in the first passage of these mini-stories to write a programming condition that
			determines when it would make sense for that scene to occur, and use macros like (open-storylets:) to dynamically create links to the storylets.
			This authoring style allows content to be added to the story without having to dramatically rearrange the story's structure.

			Examples of narrative structures that can be represented as storylets include: jobs on a job board that are available at different times but only
			acceptable once; encounters in a role-playing-game that vary based on randomness and location; random dream sequences between linear chapters;
			chores to perform in a housekeeping or farming simulation. Simply create clumps of passages containing each of these sequences, mark the first passage
			of each with this macro, and make the end of each (or a central "hub" passage that they link back to) with code that uses (open-storylets:)
			to create links elsewhere.

			Details:
			Being a metadata macro, a (storylet:) macro call must appear in the passage *before* every other non-metadata macro in the passage, such as (set:) and (if:).
			(This doesn't include macros inside a "header" tagged passage.) The recommended place to put it is at the top of the passage. This restriction is because
			the (storylet:) call's lambda is only ever checked outside the passage. Variable-changing macros in the passage, such as (set:), are not run until the
			passage is visited, even if they appear before a (storylet:) macro. So, the code `(set: $a to 2)(storylet: when $a is 2)` is misleading, because it won't
			cause $a to always be 2 when the lambda is checked.

			Inside a (storylet:) macro's lambda, the "visit" and "visits" identifiers refer to the containing passage, so they will often be 0. Checking visits
			(such as by `visits is 0`) allows you to make a storylet only be available once (because after that, it will have become visited). Also,
			the "exits" identifier cannot be used here (because it's meaningless in this context).

			Having multiple (storylet:) macros in a passage results in an error when (open-storylets:) is used.

			See also:
			(open-storylets:), (passages:), (event:)

			Added in: 3.2.0
			#storylet
		*/
		("storylet",
			(section, lambda) => {
				/*
					The dual nature of metadata macros - that they aren't visible in the passage itself but
					produce a value when run by Renderer's speculation - is illustrated here.
				*/
				return !section.stackTop.speculativePassage ?
					// Return a plain unstorable value that prints out as "".
					{
						TwineScript_TypeName:     "a (storylet:) requirement",
						TwineScript_ObjectName:   "a (storylet:) requirement",
						TwineScript_Unstorable:   true,
						TwineScript_Print:        String,
					}
					// Being a "when" lambda, there is no "it" object to iterate over, or a "pos".
					: lambda.apply(section, {fail:false, pass:true});
			},
			[Lambda.TypeSignature('when')]
		)
		/*d:
			(metadata: [...Any]) -> Metadata

			When placed in a passage, this adds the given names and values to the (passage:) datamap for this passage.

			Example usage:
			* `(metadata: "danger", 4, "hint", "Dragon teeth are fire-hardened, and dragon fillings must be fire-resistant.")` in a passage
			named "Dragon dentistry" causes `(passage:"Dragon dentistry")'s danger` to be 4, and `(passage:"Dragon dentistry")'s hint` to equal the given string.
			* `(metadata: "rarity", 5)` in a passage called "Adamantium" causes `(passage: "Adamantium")'s rarity` to be 5. You can then use
			`(passages: where it contains 'rarity' and its rarity >= (random: 1, 10))` to get a list of passages that may randomly exclude the "Adamantium" passage.

			Rationale:

			While the (passage:) and (passages:) datamaps can provide the tags, name and source code of your story's passages by default,
			there are many cases when you need more specific data than just strings, such as a number or a changer. An example is when making links for
			passages that have been chosen non-deterministically, such as by (open-storylets:) - you may want the link to be accompanied with a short description fitting
			the passage, or you may want each passage to have a random chance of not appearing at all. Moreover, you want to be able to write this information inside
			the passage itself, as you write it, just as tags are written on the passage as you write it.

			The (metadata:) macro provides this functionality - it augments the (passage:) datamap for the current passage,
			adding extra data of your choosing to it, as if by adding a (dm:) to it at startup.

			Details:

			The data names and values are provided to (metadata:) as if it was a (dm:) macro call – first the string names, then the values, in alternation.

			Being a metadata macro, a (metadata:) macro call must appear in the passage *before* every other non-metadata macro in the passage, such as (set:) and (if:).
			(This doesn't include macros inside a "header" tagged passage.) The recommended place to put it is at the top of the passage.

			Every passage's (metadata:) macro is run just once, at startup. If an error occurs while doing so (for instance, if a value is given without a matching name)
			then a dialog box will appear at startup, displaying the error.

			Since passages already have "source", "name" and "tags" data names in their datamap, trying to use these names in a (metadata:) macro will produce an error.

			Putting this in a "header", "startup" or "footer" tagged passage will NOT cause this metadata to be applied to every passage, much as how adding extra tags
			to a "header", "startup" or "footer" tagged passage will not cause those tags to apply to every passage.

			See also:
			(passage:), (passages:), (storylet:)

			Added in: 3.2.0
			#game state
		*/
		("metadata",
			(section, ...args) => {
				if (!section.stackTop.speculativePassage) {
					return {
						// Return a plain unstorable value that prints out as "".
						TwineScript_TypeName:     "a (metadata:) macro",
						TwineScript_ObjectName:   "a (metadata:) macro",
						TwineScript_Unstorable:   true,
						TwineScript_Print:        String,
					};
				}
				let key;
				const map = new Map();
				/*
					This takes the flat arguments "array" and runs map.set() with every two values.
					During each odd iteration, the element is the key. Then, the element is the value.
				*/
				const status = args.reduce((status, element) => {
					let error;
					/*
						Propagate earlier iterations' errors.
					*/
					if (TwineError.containsError(status)) {
						return status;
					}
					if (key === undefined) {
						key = element;
					}
					/*
						Specific to (metadata:): passage metadata keys can't be named "tags", "source" or "name" in any case-sensitivity.
					*/
					else if (["tags","source","name"].includes(key.toLowerCase())) {
						return TwineError.create("datatype",
							"You can't use '" + key + "' as a (metadata:) data name."
						);
					}
					/*
						Key type-checking must be done here.
					*/
					else if ((error = TwineError.containsError(isValidDatamapName(map, key)))) {
						return error;
					}
					/*
						This syntax has a special restriction: you can't use the same key twice.
					*/
					else if (map.has(key)) {
						return TwineError.create("macrocall",
							"You used the same data name (" + objectName(key) + ") twice in the same (metadata:) call."
						);
					}
					else {
						map.set(key, clone(element));
						key = undefined;
					}
					return status;
				}, true);
				/*
					Return an error if one was raised during iteration.
				*/
				if (TwineError.containsError(status)) {
					return status;
				}
				/*
					One error can result: if there's an odd number of arguments, that
					means a key has not been given a value.
				*/
				if (key !== undefined) {
					return TwineError.create("macrocall", "This (metadata:) macro has a data name without a value.");
				}
				return map;
			},
			zeroOrMore(Any)
		)
		;

	/*
		Metadata macros need to be registered with Renderer, just like blockers.
	*/
	Renderer.options.metadataMacros.push("storylet", "metadata");
});
