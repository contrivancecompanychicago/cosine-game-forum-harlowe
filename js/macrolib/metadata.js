"use strict";
define(['macros','renderer','datatypes/lambda'], (Macros, Renderer, Lambda) => {
	/*d:
		Metadata data
		Certain kinds of macros are not used inside the passage itself, but are used to mark the passage as being special in some way, or having certain
		data available to other macros that inspect the story's state, such as (passages:) or (open-storylets:). These macros are "metadata" macros,
		because they attach metadata to the passage. These macros must appear at the very start of those passages, ahead of every other kind of macro.
	*/
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
		The (storylet:) macro call must appear in the passage *before* every other kind of macro in the passage, such as (set:) and (if:). (This doesn't include
		macros inside a "header" tagged passage.) The recommended place to put it is at the top of the passage. This is because the (storylet:) call's lambda
		is only ever checked outside the passage. Variable-changing macros in the passage, such as (set:), are not run until the passage is visited, even
		if they appear before a (storylet:) macro. So, the code `(set: $a to 2)(storylet: when $a is 2)` won't cause $a to always be 2 when the lambda is checked.

		Inside a (storylet:) macro's lambda, the "visit" and "visits" identifiers refer to the containing passage, so they will often be 0. Checking visits
		(such as by `visits is 0`) allows you to make a storylet only be available once (because after that, it will have become visited). Also,
		the "exits" identifier cannot be used here (because it's meaningless in this context).

		Having multiple (storylet:) macros in a passage results in an error when (open-storylets:) is used.

		See also:
		(open-storylets:), (passages:), (event:)

		Added in: 3.2.0
		#storylet
	*/
	Macros.add
		("storylet",
			(section, lambda) => {
				/*
					The dual nature of metadata macros - that they aren't visible in the passage itself but
					produce a value when run by Renderer's speculation - is illustrated here.
				*/
				return !section.speculativePassage ?
					// Return a plain unstorable value that prints out as "".
					{
						TwineScript_TypeName:     "a (storylet:) requirement",
						TwineScript_ObjectName:   "a (storylet:) requirement",
						TwineScript_Unstorable:   true,
						TwineScript_Print:        String,
					}
					// Being a "when" lambda, there is no "it" object to iterate over.
					: lambda.apply(section, {fail:false, pass:true});
			},
			[Lambda.TypeSignature('when')]
		);

	/*
		Metadata macros need to be registered with Renderer, just like blockers.
	*/
	Renderer.options.metadataMacros.push("storylet");
});
