"use strict";
define('macrolib/metadata', ['macros','utils/operationutils', 'datatypes/lambda', 'internaltypes/twineerror'], (Macros, {clone, objectName, isValidDatamapName}, Lambda, TwineError) => {
	/*d:
		Metadata data

		Certain kinds of macros are not used inside the passage itself, but are used to mark the passage as being special in some way, or having certain
		data available to other macros that inspect the story's state, such as (passages:) or (open-storylets:). These macros are "metadata" macros,
		because they attach metadata to the passage. These macros must appear at the very start of those passages, ahead of every other kind of macro.
		Using them in any other location will cause an error.

		Every valid metadata macro is run only once, when the story begins. As such, "metadata" is not a type of data that's available to other macros,
		and there is no need for a datatype called `metadata`.
	*/
	const {zeroOrMore, Any} = Macros.TypeSignature;

	/*
		The dual nature of metadata macros - that they aren't visible in the passage itself but
		produce a value when run by Renderer's speculation - is illustrated here.
		This object is returned by each metadata macro that is called outside of a speculative passage.
	*/
	const unstorableObject = (macroName) => ({
		// Return a plain unstorable value that prints out as "".
		TwineScript_TypeName:     "a (" + macroName + ":) macro",
		TwineScript_ObjectName:   "a (" + macroName + ":) macro",
		TwineScript_Unstorable:   true,
		// Being unstorable and not used by any other data strctures, this doesn't need a ToSource() function.
		TwineScript_Print:        () => '',
	});

	/*d:
		(storylet: Lambda) -> Metadata

		When placed in a passage, it marks that passage as the beginning of a storylet, using the lambda as the condition upon which it's available to the player,
		so that other macros, like (open-storylets:), can see and select the passage.

		Example usage:

		* `(storylet: when $season is "winter" and $married is false and visits is 0)`
		* `(storylet: when (visited: "mortuary"))`

		Rationale:
		Storylets are mini-stories within a story - disconnected sequences of passages that can be visited non-linearly when certain conditions are fulfilled.
		They allow a different way of writing interactive fiction than the rigid tree structure of typical Twine games: instead,
		simply write scenes and events that occur in the story, use this macro in the first passage of these mini-stories to write a programming condition that
		determines when it would make sense for that scene to occur, and use macros like (open-storylets:) or (link-storylet:) to dynamically create links to the storylets.
		This authoring style allows content to be added to the story without having to dramatically rearrange the story's structure.

		Examples of narrative structures that can be represented as storylets include: jobs on a job board that are available at different times but only
		acceptable once; encounters in a role-playing-game that vary based on randomness and location; random dream sequences between linear chapters;
		chores to perform in a housekeeping or farming simulation. Simply create clumps of passages containing each of these sequences, mark the first passage
		of each with this macro, and make the end of each (or a central "hub" passage that they link back to) with code that uses (open-storylets:)
		to create links elsewhere.

		Details:
		This macro adds a "storylet" data name to the (passages:) datamap for this passage, letting you access the passed-in lambda. In fact, you can use (metadata:)
		in place of (storylet:) if you wish - `(storylet: when $hour is 12)` is actually just a shorthand for `(metadata:"storylet", when $hour is 12)`. (metadata:)
		can be used instead if you're already using it to attach other data. if you use both (storylet:) and `(metadata: "storylet"`, an error will result.

		Being a metadata macro, a (storylet:) macro call must appear in the passage *before* every other non-metadata macro in the passage, such as (set:) and (if:).
		(This doesn't include macros inside a "header" tagged passage.) The recommended place to put it is at the top of the passage. This restriction is because
		the (storylet:) call's lambda is only ever checked outside the passage. Variable-changing macros in the passage, such as (set:), are not run until the
		passage is visited, even if they appear before a (storylet:) macro. So, the code `(set: $a to 2)(storylet: when $a is 2)` is misleading, because it won't
		cause $a to always be 2 when the lambda is checked.

		Inside a (storylet:) macro's lambda, the "visit" and "visits" identifiers refer to the containing passage, so they will often be 0. Checking visits
		(such as by `visits is 0`) allows you to make a storylet only be available once (because after that, it will have become visited). Also,
		the "exits" identifier cannot be used here (because it's meaningless in this context).

		See also:
		(open-storylets:), (passages:), (event:), (metadata:)

		Added in: 3.2.0
		#storylet 1
	*/
	/*d:
		(urgency: Number) -> Metadata

		When placed in a passage that also has a (storylet:) call, it marks that passage as being more or less "urgent", meaning that (open-storylets:)
		will sort it earlier or later than other passages.

		Example usage:
		`(urgency: 2)` causes this storylet to appear earlier in the (open-storylets:) than storylets with `(urgency:1)` or no urgency macro.

		Rationale:
		The (open-storylets:) macro provides you with an array of all currently-open storylets, but that typically isn't the amount of options
		you'd like to show to the player each time. Often you'll just limit it to a few values using array data names like `1stto4th`. In that case, the
		order of the returned array matters a lot - being one of the first few values determines whether it'll be seen among the others. In those cases,
		it can sometimes be helpful to guarantee a certain storylet or storylets, when available, are always present in the first few values.
		The (urgency:) macro allows for this - give it a number, and it will be sorted above open storylets with a lower or no urgency number.

		Details:
		This is essentially a shorthand for calling (metadata:) with "urgency" - it adds an "urgency" data name and value to the passage's (passage:)
		datamap - except that it will error if a non-number is given to it.

		Storylets without an "urgency" metadata number, added by this macro or by (metadata:), are treated as having `(urgency: 0)`. This means
		that a storylet with a negative urgency, such as `(urgency: -11)`, will appear at the end of the (open-storylets:) array, unless a storylet
		with an even lower urgency is also open.

		See also:
		(exclusivity:)

		Added in: 3.2.0
		#storylet 4
	*/
	/*d:
		(exclusivity: Number) -> Metadata

		When placed in a passage that also has a (storylet:) call, it marks that passage as being more or less "exclusive", meaning that if it's open,
		it will prevent storylets with lesser exclusivity from appearing in (open-storylets:).

		Example usage:
		`(exclusivity: 2)` means that, if this storylet is open, other storylets with exclusivity lower than this are closed, and can't
		appear in (open-storylets:)'s array.

		Rationale:
		Storylets are very useful for creating non-linear stories, in which the player's available choices and directions are determined entirely
		by the game state, rather than an explicit web of links. But, sometimes it's necessary to pen the player in and prevent them from having the same
		range of choices. An example is a climactic final event in a story, which has its own storylet lambda, but which, when available, shouldn't
		be avoidable by picking another storylet. While you could code this by wording each other passage's storylet lambdas very carefully, such that no
		others are open when the final event is open, that would be very cumbersome. The (exclusivity:) macro lets you specify that
		a storylet should be an *exclusive* option that prevents more common options from being available.

		Details:
		This is essentially a shorthand for calling (metadata:) with "exclusivity" - it adds an "exclusivity" data name and value to the passage's (passage:)
		datamap - except that it will error if a non-number is given to it.

		Storylets without an "exclusivity" metadata number, added by this macro or by (metadata:), are treated as having `(exclusivity: 0)`. This means
		that a storylet with a negative exclusivity, such as `(exclusivity: -0.001)`, will not be able to appear in (open-storylets:) if any other storylets
		lacking an explicit (exclusivity:) call are also open.

		See also:
		(urgency:)

		Added in: 3.2.0
		#storylet 3
	*/
	[
		["storylet", Lambda.TypeSignature('when')],
		["urgency", Number],
		["exclusivity", Number],
	].forEach(([name, signature]) => {
		Macros.add(name, "Metadata", (section, arg) =>  !section.stackTop.speculativePassage ? unstorableObject(name) : arg, signature);
	});

	Macros.add
		/*d:
			(metadata: [...Any]) -> Metadata

			When placed in a passage, this adds the given names and values to the (passage:) datamap for this passage.

			Example usage:
			* `(metadata: "danger", 4, "hint", "Dragon teeth are fire-hardened.")` in a passage
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
			(This doesn't include macros inside a "header" or "footer" tagged passage.) The recommended place to put it is at the top of the passage.

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
		("metadata", "Metadata",
			(section, ...args) => {
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
						Key type-checking must be done here.
					*/
					else if ((error = TwineError.containsError(isValidDatamapName(map, key)))) {
						return error;
					}
					/*
						Of course, you can't use the same key twice.
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
				/*
					If this is being run in its own passage (instead of by a storylet macro) then all of the above was executed
					just for error-checking. Exit out here.
				*/
				if (!section.stackTop.speculativePassage) {
					return unstorableObject('metadata');
				}
				return map;
			},
			zeroOrMore(Any)
		);
});
