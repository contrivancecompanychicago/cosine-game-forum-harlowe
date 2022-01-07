"use strict";
define(['jquery','macros', 'utils', 'utils/renderutils', 'datatypes/colour', 'datatypes/hookset', 'datatypes/gradient', 'datatypes/changercommand', 'datatypes/lambda', 'internaltypes/changedescriptor', 'internaltypes/twineerror'],
($, Macros, Utils, {geomParse, geomStringRegExp}, Colour, HookSet, Gradient, ChangerCommand, Lambda, ChangeDescriptor, TwineError) => {

	/*
		Built-in hook style changer macros.
		These produce ChangerCommands that apply CSS styling to their attached hooks.
		
		This module modifies the Macros module only, and exports nothing.
	*/
	/*d:
		Changer data
		
		Changers are similar to commands, but they only have an effect when they're attached to hooks,
		passage links and commands, and modify them in some manner. Macros that work like this include (text-style:), (font:),
		(t8n:), (text-rotate:), (hook:), (click:), (link:), (for:), (if:), and more.

		```
		(set: $sawDuckHarbinger to true)
		(if: $sawDuckHarbinger)[You still remember spying the black duck, harbinger of doom.]
		(t8n-depart: "dissolve")[[Return to the present]]
		```

		You can save changers into variables, and re-use them many times in your story:
		```
		(set: $robotic to (font:'Courier New'))
		$robotic[Hi, it's me. Your clanky, cold friend.]
		```
		Alternatively, you may prefer to use the (change:) or (enchant:) macro to accomplish the same thing using only hook names:
		```
		|robotic>[Hi, it's me. Your clanky, cold friend.]
		(change: ?robotic, (font:'Courier New'))
		```
		Changers can be combined using the `+` operator: `(text-colour: red) + (font: "Courier New")[This text is red Courier New.]`
		styles the text using both changers at once. These combined changers, too, can be saved in variables or used with (change:)
		or (enchant:).
		```
		(set: _alertText to (font:"Courier New") + (text-style: "buoy")+(text-colour:"#e74"))
		_alertText[Social alert: no one read the emails you sent yesterday.]
		_alertText[Arithmetic error: I forgot my seven-times-tables.]
		```
	*/
	const
		{assign} = Object,
		{either, wrapped, optional, Any, Everything, zeroOrMore, rest, insensitiveSet, positiveNumber, positiveInteger, nonNegativeNumber, percent} = Macros.TypeSignature,
		IfTypeSignature = [wrapped(Boolean, "If you gave a number, you may instead want to check that the number is not 0. "
			+ "If you gave a string, you may instead want to check that the string is not \"\".")];

	/*
		The (hover-style:) macro uses these jQuery events to add and remove the
		hover styles when hovering occurs.
	*/
	Utils.onStartup(() => $(Utils.storyElement).on(
		/*
			The jQuery event namespace is "hover-macro".
		*/
		"mouseenter.hover-macro",
		/*
			The "hover" attr is set by (hover-style:), and used to signal that a hover
			style is attached to the <tw-hook>.

			To be confident that these handlers fire with no race conditions,
			the selectors require the signalling 'hover' value be true or false,
			and the handlers manually set them, in mimickry of the CSS :hover pseudo.
		*/
		"[hover=false]",
		function () {
			const elem = $(this),
				changer = elem.data('hoverChanger');
			/*
				To restore the element's current styles when mousing off it, we must
				store the attr in a data slot.
			*/
			elem.data({ mouseoutStyle: elem.attr('style') || '' });
			/*
				Now, we can apply the hover style to the element.
			*/
			ChangeDescriptor.create({ target: elem }, changer).update();
			elem.attr('hover',true);
		}
	)
	.on(
		"mouseleave.hover-macro",
		"[hover=true]",
		function () {
			const elem = $(this),
				/*
					As outlined above, the style the element had before hovering
					can now be reinstated, erasing the hover style.
				*/
				mouseoutStyle = elem.data('mouseoutStyle');
			elem.attr('style', mouseoutStyle)
				.removeData('mouseoutStyle')
				.attr('hover',false);
		}
	));

	/*
		A list of valid transition names. Used by (transition:).
	*/
	const validT8ns = insensitiveSet("instant", "dissolve", "fade", "rumble", "shudder", "pulse", "zoom", "flicker", "slideleft", "slideright", "slideup", "slidedown",
		"fadeleft", "faderight", "fadeup", "fadedown", "blur");
	const validBorders = insensitiveSet('dotted','dashed','solid','double','groove','ridge', 'inset','outset','none');
	Macros.addChanger
		/*d:
			(if: Boolean) -> Changer
			
			This macro accepts only booleans, and produces a changer that can be attached to hooks
			to hide them "if" the value was false.
			
			Example usage:
			`(if: $legs is 8)[You're a spider!]` will show the `You're a spider!` hook if `$legs` is `8`.
			Otherwise, it is not run.
			
			Rationale:
			In a story with multiple paths or threads, where certain events could occur or not occur,
			it's common to want to run a slightly modified version of a passage reflecting the current
			state of the world. The (if:), (unless:), (else-if:) and (else:) macros let these modifications be
			switched on or off depending on variables, comparisons or calculations of your choosing.
			
			Details:
			Note that the (if:) macro only runs once, when the passage or hook containing it is rendered. Any
			future change to the condition (such as a (link:) containing a (set:) that changes a variable) won't
			cause it to "re-run", and show/hide the hook anew.

			However, if you attach (if:) to a named hook, and the (if:) hides the hook, you can manually reveal
			the hook later in the passage (such as, after a (link:) has been clicked) by using the (show:) macro
			to target the hook. Named hooks hidden with (if:) are thus equivalent to hidden named hooks like `|this)[]`.

			Alternatives:
			The (if:) and (hidden:) macros are not the only attachment that can hide or show hooks! In fact,
			a variable that contains a boolean can be used in its place. For example:
			
			```
			(set: $foundWand to true, $foundHat to true, $foundBeard to true)
			(set: $isAWizard to $foundWand and $foundHat and $foundBeard)
			
			$isAWizard[You wring out your beard with a quick twisting spell.]
			You step into the ruined library.
			$isAWizard[The familiar scent of stale parchment comforts you.]
			```
			By storing a boolean inside `$isAWizard`, it can be used repeatedly throughout the story to
			hide or show hooks as you please.

			if you want to conditionally display very short strings, or small values inside a macro call, you may want
			to use the shorter (cond:) macro instead.

			See also:
			(unless:), (else-if:), (else:), (cond:), (show:)

			Added in: 1.0.0
			#basics 6
		*/
		("if",
			(_, expr) => ChangerCommand.create("if", [expr]),
			(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(unless: Boolean) -> Changer
			
			This macro is the negated form of (if:): it accepts only booleans, and returns
			a changer that can be attached hooks to hide them "if" the value was true.
			
			For more information, see the documentation of (if:).

			Example usage:
			```
			(set: $form to "human")
			(unless: $form is "duck")[The cold autumn rain chills your skin.]
			```

			Added in: 1.0.0
			#basics 7
		*/
		("unless",
			(_, expr) => ChangerCommand.create("unless", [expr]),
			(d, expr) => d.enabled = d.enabled && !expr,
		IfTypeSignature)
		
		/*d:
			(else-if: Boolean) -> Changer
			
			This macro's result changes depending on whether the previous hook in the passage
			was shown or hidden. If the previous hook was shown, then this changer hides the attached
			hook. Otherwise, it acts like (if:), showing the attached hook if it's true, and hiding it
			if it's false. If there was no preceding hook before this, then an error message will be printed.

			Example usage:
			```
			Your stomach makes {
			(if: $size is 'giant')[
			    an intimidating rumble! You'll have to eat plenty of trees.
			](else-if: $size is 'big')[
			    a loud growl. You're hungry for some shrubs.
			](else: )[
			    a faint gurgle. You hope to scavenge some leaves.
			]}
			```
			
			Rationale:
			If you use the (if:) macro, you may find you commonly use it in forked branches of
			source: places where only one of a set of hooks should be displayed. In order to
			make this so, you would have to phrase your (if:) expressions as "if A happened",
			"if A didn't happen and B happened", "if A and B didn't happen and C happened", and so forth,
			in that order.
			
			The (else-if:) and (else:) macros are convenient variants of (if:) designed to make this easier: you
			can merely say "if A happened", "else, if B happened", "else, if C happened" in your code.
			
			Details:
			Just like the (if:) macro, (else-if:) only checks its condition once, when the passage or hook contaning
			it is rendered.

			The (else-if:) and (else:) macros do not need to only be paired with (if:)! You can use (else-if:) and
			(else:) in conjunction with boolean variables, like so:
			```
			(set:$married to false, $date to false)
			$married[You hope this warrior will someday find the sort of love you know.]
			(else-if: not $date)[You hope this warrior isn't doing anything this Sunday (because \
			you've got overtime on Saturday.)]
			```

			If you attach (else-if:) to a named hook, and the (else-if:) hides the hook, you can reveal the hook later
			in the passage by using the (show:) macro to target the hook.

			if you want to conditionally display very short strings, or small values inside a macro call, you may want to use
			the shorter (cond:) macro instead.

			See also:
			(if:), (unless:), (else:), (cond:), (show:)

			Added in: 1.0.0
			#basics 8
		*/
		("elseif", (section, expr) => {
			/*
				This and (else:) check the lastHookShown expando
				property, if present.
			*/
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's no (if:) or something else before this to do (else-if:) with.");
			}
			return ChangerCommand.create("elseif", [section.stack[0].lastHookShown === false && !!expr]);
		},
		(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(else:) -> Changer
			
			This is a convenient limited variant of the (else-if:) macro. It will simply show
			the attached hook if the preceding hook was hidden, and hide it otherwise.
			If there was no preceding hook before this, then an error message will be printed.
			
			Example usage:
			```
			The coins fall... 
			\(if: (either:false, false, false, true))
				[and both land on tails! That means you've won the bet!]
			\(else: )
				[and one of them lands heads-up.]
			```

			Rationale:
			After you've written a series of hooks guarded by (if:) and (else-if:), you'll often have one final
			branch to show, when none of the above have been shown. (else:) is the "none of the above" variant
			of (else-if:), which needs no boolean expression to be provided. It's essentially the same as
			`(else-if: true)`, but shorter and more readable.
			
			For more information, see the documentation of (else-if:).
			
			Notes:
			Just like the (if:) macro, (else:) only checks its condition once, when the passage or hook contaning
			it is rendered.

			Due to a mysterious quirk, it's possible to use multiple (else:) macro calls in succession:
			```
			(set: $isUtterlyEvil to (either:true,false))
			$isUtterlyEvil[You suddenly grip their ankles and spread your warm smile into a searing smirk.]
			(else:​)[In silence, you gently, reverently rub their soles.]
			(else:​)[Before they can react, you unleash a typhoon of tickles!]
			(else:​)[They sigh contentedly, filling your pious heart with joy.]
			```
			This usage can result in a somewhat puzzling passage source structure, where each (else:) hook
			alternates between visible and hidden depending on the first such hook. So, it is best avoided.

			If you attach (else:) to a named hook, and the (else:) hides the hook, you can reveal the hook later
			in the passage by using the (show:) macro to target the hook.

			See also:
			(if:), (unless:), (else-if:), (cond:), (show:)

			Added in: 1.0.0
			#basics 9
		*/
		("else", (section) => {
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's nothing before this to do (else:) with.");
			}
			return ChangerCommand.create("else", [section.stack[0].lastHookShown === false]);
		},
		(d, expr) => d.enabled = d.enabled && expr,
		null)

		/*d:
			(hidden:) -> Changer

			Produces a changer that can be attached to hooks to hide them.

			Example usage:
			```
			Don't you recognise me? (hidden:)|truth>[I'm your OC, brought to life!]
			```
			The above example is the same as
			```
			Don't you recognise me? |truth)[I'm your OC, brought to life!]
			```

			Rationale:
			While there is a way to succinctly mark certain named hooks as hidden, by using parentheses instead of
			`<` or `>` marks, this macro provides a clear way for complex changers to hide their attached hooks.
			This works well when added to the (hook:) macro, for instance, to specify a hook's name and visibility
			in a single changer.

			This macro is essentially identical in behaviour to `(if:false)`, but reads better.

			This macro takes no values - each changer value it produces is the same.

			See also:
			(if:), (hook:), (show:)

			Added in: 2.0.0
			#showing and hiding
		*/
		("hidden",
			() => ChangerCommand.create("hidden"),
			(d) => d.enabled = false,
			null
		)

		/*d:
			(verbatim:) -> Changer
			Also known as: (v6m:)

			When attached to a hook or command, the markup inside that would normally be rendered into HTML
			is instead presented as plain text, as if the verbatim markup was used on it.

			Example usage:
			* ``(v6m: )[ \(`A`)/ ]`` prints a kaomoji without fear of its source being interpreted as markup.
			* `(v6m: )(print:(source:$playerInfo))` prints the source of the datamap in $playerInfo, without re-rendering it.

			Rationale:
			Harlowe conveniently allows you to print strings containing markup and variables, such as `"Your rank is ''$rank''"`, rendering
			them as if they were written directly in the passage. However, there are many situations where you would prefer not to do so,
			and where you can't conveniently wrap that content in the verbatim markup. Chief among these is player-inputted text: since
			players can write valid Harlowe markup into (prompt:) and (input-box:) elements, displaying such text could cause no end of
			disaster for your story. Additionally, since this text can also include unmatched verbatim markup, attempting to encase it
			in verbatim markup is non-trivially difficult. This macro provides an easier way to guarantee that the markup, if present, is not
			rendered.

			In addition, you may want to write a hook without having to worry about the task of placing its contents inside verbatim markup,
			or write a hook containing textual references to HTML or Harlowe code. Even if it turns out to be unnecessary, having this macro
			on hand can be reassuring.

			Details:
			This macro takes no values - each changer value it produces is the same.

			See also:
			(collapse:), (verbatim-print:)

			Added in: 3.2.0
			#basics 15
		*/
		(["verbatim","v6m"],
			() => ChangerCommand.create("verbatim"),
			(d) => d.verbatim = true,
			null
		)

		/*d:
			(live: [Number]) -> Changer
			When you attach this changer to a hook, the hook becomes "live", which means that it's repeatedly re-run
			every certain number of milliseconds, replacing the source inside of the hook with a newly computed version.
			
			Example usage:
			```
			{(live: 0.5s)[
			    (either: "Bang!", "Kaboom!", "Whammo!", "Pow!")
			]}
			```
			
			Rationale:
			Twine passage text generally behaves like a HTML document: it starts as code, is changed into a
			rendered page when you "open" it, and remains so until you leave. But, you may want a part of the
			page to change itself before the player's eyes, for its code to be re-renders "live"
			in front of the player, while the remainder of the passage remains the same.
			
			Certain macros, such as the (link:) macro, allow a hook to be withheld until after an element is
			interacted with. The (live:) macro is more versatile: it re-renders a hook every specified number of
			milliseconds. If (if:) or (unless:) macros are inside the hook, they of course will be re-evaluated each time.
			
			Details:
			Numbers given to macros such as (live:) can be suffixed with `ms` or `s` to indicate whether you mean milliseconds or
			seconds (see the article on number data for more information). If you give a bare number, the macro interprets it as milliseconds.

			Live hooks will continue to re-render themselves until they encounter and print a (stop:) macro. (stop:) should be used
			whenever you don't need to keep the hook "live", to save on processing and passage repainting (which can interfere
			with clicking, selecting text, and other interactions).

			If you want to just display a hook once a certain thing happens (that is, when the condition in an (if:) macro becomes
			true) and then (stop:), then the (event:) macro may be shorter and easier to use for this. If you want to display a hook after
			a certain amount of time has passed, then the (after:) macro is almost certainly what you'd prefer to use.

			Currently, you **cannot** attach (live:) to a command (such as in `(live:2s)(link-goto:"?")`). You have to wrap the command
			in a hook (such as `(live:2s)[(link-goto:"?")]`).

			See also:
			(event:), (more:), (after:)

			Added in: 1.0.0
			#live 1
		*/
		("live",
			(_, delay) => ChangerCommand.create("live", [delay]),
			(d, delay) => {
				d.enabled = false;
				d.data.live = {delay};
			},
			optional(Number)
		)

		/*d:
			(event: Lambda) -> Changer

			Hooks that have this changer attached will only be run when the given condition becomes true.

			Example usage:
			```
			(event: when time > 5s)[==Oops, I forgot the next link: [[Go east]].
			```

			Rationale:
			While the (live:) macro is versatile in providing time-based text updating, one of its common uses - checking if some
			variable has changed using (if:), and then displaying a hook and stopping the macro with (stop:) - is rather
			cumbersome. This macro provides that functionality in a shorter form - the example above is equivalent to:
			```
			{(live: 0.2s)[
			    (if: time > 5s)[
			        Oops, I forgot the next link: [[Go east]].(stop: )
			    ]
			]}
			```

			Details:
			This macro only takes a "when" lambda, which is like a "where" lambda but with "where" changed to
			"when" for readability purposes. This lambda doesn't have a temp variable before "when" - it doesn't iterate over anything,
			except, perhaps, moments in time.

			Because (event:) hooks only run once, the (stop:) macro is unnecessary here.

			Currently, you **cannot** attach (event:) to a command (such as in `(event: when $a is 1)(link-goto:"?")`). You have to wrap the command
			in a hook (such as `(event:when $a is 1)[(link-goto:"?")]`).

			See also:
			(live:), (after:), (more:)

			Added in: 3.0.0
			#live 3
		*/
		("event",
			(_, event) => ChangerCommand.create("event", [event]),
			(d, event) => {
				d.enabled = false;
				d.data.live = {event};
			},
			Lambda.TypeSignature('when')
		)

		/*d:
			(more:) -> Changer

			Hooks that have this changer attached will only be run once no other exits - links, (mouseover:) or (mouseout:) elements - are remaining
			in the passage, and will reveal "more" prose.

			Example usage:
			```
			(link:"Look at the duck.")[The duck drifts on the lake's surface.]
			(link:"Look at the clouds.")[Seems like rain, which is bad news for just one of you.]
			(more:)[You've looked at the duck, and the clouds.]
			```

			Rationale:
			It's common to use hook-revealing macros like (link:) to provide elaboration on a scene, which the player can encounter in any order
			they wish. You may want to require each of these elaborations and details be visited by the player, only displaying the link to
			the next passage (or further story-setting material) after they have all been explored. You could implement this using `(event: when exits is 0)`,
			but this macro, (more:), provides a shorter and more readable alternative.

			Details:
			This is functionally identical to `(event: when exits is 0)`. For more information on what is and is not considered an "exit", see the article
			for the "exits" keyword.

			If multiple (more:) elements are in the passage, they will appear in the order they appear. This may cause earlier ones to reveal
			links inside their hooks, and thus "block" the subsequent ones from revealing. In the case of
			`(more:)[You see [[an exit]] ahead.] (more:)[But you hear chuckling behind you...]`, the first (more:) hook will reveal
			a passage link, thus causing the second hook to not be revealed.

			See also:
			(show:), (link-show:)

			Added in: 3.1.0
			#live 5
		*/
		("more",
			() => ChangerCommand.create("more"),
			d => {
				d.enabled = false;
				d.data.live = {
					/*
						In order to implement (more:), I decided to leverage the existing implementation for (event:).
						As such, the following is a fake "when" Lambda, complete with fake "when" property, which is passed to
						runLiveHook() in section.js, as if it was created by Lambda.create().
					*/
					event: {
						when: true,
						filter: section => section.operations.Identifiers.exits !== 0 ? [] : [true],
					},
				};
			},
			null
		)

		/*d:
			(after: Number, [Number]) -> Changer

			Hooks that have this changer attached will only be run once the given amount of time has passed since the passage was rendered. An
			optional second number specifies that the player can speed up the delay by holding down a keyboard key or mouse button, or by touching the touch device.

			Example usage:
			This example makes 3 additional hooks appear, one by one. The delays can only be sped up if the passage has been visited before.
			The `time + 2s` idiom is a convenient way to express that each hook is displayed 2 seconds after the last one was displayed (as the `time` identifier
			tracks the time passed since the passage was rendered, not the containing hook).
			```
			There she was. (after: 2s, (cond: visits > 0, 200ms, 0))[=
			Covered in fur, (after: time + 2s, (cond: visits > 0, 200ms, 0))[=
			sitting on all fours, (after: time + 2s, (cond: visits > 0, 200ms, 0))[=
			and howling at the moon.
			```

			Rationale:
			This macro is a shorthand form of (event:) that only is given an amount of time to wait. `(after:2s)` is the same as `(event: when time > 2s)`.
			It is also similar to (live:), except that it only runs the hook at most once.

			One significant difference this has over (event:) is that it can offer the player the ability to speed up transitions. Frequently asking the player to wait for timed delays
			can be detrimental to the pacing of a story, especially if they are revisiting earlier passages, and providing an option to skip or expedite them is often
			greatly appreciated.

			Details:
			Numbers given to macros such as (after:) can be suffixed with `ms` or `s` to indicate whether you mean milliseconds or
			seconds (see the article on number data for more information). If you give a bare number, the macro interprets it as milliseconds.

			The optional second number given is an amount of milliseconds (or, if suffixed with `s`, seconds) to advance the transition. For each
			millisecond of the transition, Harlowe checks if a key or button is held, and if so, then it is advanced
			by the given number (in addition to the elapsed millisecond).

			See also:
			(live:), (event:), (more:), (transition-skip:)

			Added in: 3.2.0
			#live 4
		*/
		("after",
			(_, delay, skip) => ChangerCommand.create("after", [delay].concat(skip !== undefined ? [skip] : [])),
			(d, delay, skip) => {
				d.enabled = false;
				d.data.live = {
					event: {
						when: true,
						filter: section => {
							if (Utils.anyInputDown() && skip) {
								delay -= skip;
							}
							return section.operations.Identifiers.time > delay ? [true] : [];
						},
					},
				};
			},
			[positiveNumber, optional(nonNegativeNumber)]
		)

		/*d:
			(hook: String) -> Changer
			A changer that allows the author to give a hook a computed tag name.
			
			Example usage:
			`(hook: $name)[]` gives the hook a name equal to what string is in the $name variable.
			
			Rationale:
			It's possible to add together changers, save them in variables, and use them in various locations
			throughout your story. You may, after doing so, want to give a common name to each of those hooks that
			have that variable attached, so that, for instance, the (append:) macro can act on them as one.
			This changer can be added to those changers to allow the hooks to be named, like so.
			`(font:"Museo Slab")+(hook: "title")`.
			
			Also, unlike the nametag syntax for hook names, (hook:) can be given any string expression:
			`(hook: "eyes" + (string:$eyeCount))` is valid, and will, as you'd expect, give the hook
			the name of `eyes1` if `$eyeCount` is 1.

			Details:
			If an empty string is given to this macro, an error will be produced.

			See also:
			(hidden:), (hooks-named:)

			Added in: 1.0.0
			#styling
		*/
		("hook",
			(_, name) => {
				if (!name) {
					return TwineError.create("datatype", "(hook:) names can't be empty strings.");
				}
				return ChangerCommand.create("hook", [name]);
			},
			(d, name) => d.attr.push({name: name}),
			[String]
		)

		/*d:
			(for: Lambda, [...Any]) -> Changer
			Also known as: (loop:)

			When attached to a hook, this repeats the attached hook, setting a temporary variable to a different value on each repeat.

			Example usage:
			* `(for: each _item, ...$arr) [You have the _item.]` prints "You have the " and the item, for each item in $arr.
			* `(for: _ingredient where it contains "petal", ...$reagents) [Cook the _ingredient?]` prints "Cook the " and the string, for
			each string in $reagents which contains "petal".

			Rationale:
			Suppose you're using arrays to store strings representing inventory items, or character datamaps,
			or other kinds of sequential game information - or even just built-in arrays like (history:) - and you
			want to print out a sentence or paragraph for each item. The (for:) macro can be used to print something "for each"
			item in an array easily - simply write a hook using a temp variable where each item should be printed or used,
			then give (for:) an "each" lambda that uses the same temp variable.

			Details:
			If no extra values are given after the lambda (for instance, by using `...` with an empty array), then nothing will happen
			and the attached hook will not be printed at all.

			Don't make the mistake of believing you can alter an array by trying to (set:) the temp variable in each loop - such
			as `(for: each _a, ...$arr)[(set: _a to it + 1)]`. This will NOT change $arr - only the temp variable will change (and
			only until the next loop, where another $arr value will be put into it). If you want to alter an array item-by-item, use
			the (altered:) macro.

			The temp variable inside the hook will shadow any other identically-named temp variables outside of it: if you
			`(set: _a to 1)`, then `(for: each _a, 2,3)[ (print: _a) ]`, the inner hook will print "2" and "3", and you won't be
			able to print or set the "outer" _a.

			You may want to simply print several copies of a hook a certain number of times, without any particular
			array data being looped over. You can use the (range:) macro with it instead: `(for: each _i, ...(range:1,10))`, and
			not use the temp variable inside the hook at all.

			As it is a changer macro, (for:)'s value is a changer which can be stored in a variable - this command stores all
			of the values originally given to it, and won't reflect any changes to the values, or their container arrays, since then.

			Alternatives:
			You may be tempted to use (for:) not to print anything at all, but to find values inside arrays using (if:), or
			form a "total" using (set:). The lambda macros (find:) and (folded:), while slightly less straightforward,
			are recommended to be used instead.

			See also:
			(find:), (folded:), (if:)

			Added in: 2.0.0
			#basics 10
		*/
		(["for", "loop"],
			(_, lambda, ...args) => {
				if (!lambda.loop) {
					return TwineError.create(
						"datatype",
						"The lambda provided to (for:) must refer to a temp variable, not just 'it'."
					);
				}
				return ChangerCommand.create("for", [lambda].concat(args));
			},
			(d, lambda, ...args) => {
				const loopVars = lambda.filter(d.section, args);
				let error;
				if ((error = TwineError.containsError(loopVars))) {
					return error;
				}
				d.loopVars[lambda.loop.getName()] = loopVars || [];
			},
			[Lambda.TypeSignature('where'), zeroOrMore(Any)]
		)

		/*d:
			(transition: String) -> Changer
			Also known as: (t8n:)
			
			A changer that applies a built-in CSS transition to a hook as it appears. Give this macro one of these strings (capitalisation and hyphens ignored):
			`"instant"`, `"dissolve"`, `"fade"`, `"rumble"`, `"shudder"`, `"pulse"`, `"zoom"`, `"flicker"`, `"slide-left"`, `"slide-right"`, `"slide-up"`, `"slide-down"`,
			`"fade-left"`, `"fade-right"`, `"fade-up"` and `"fade-down"`.
			
			Example usage:
			`(t8n: "pulse")[Gleep!]` makes the hook `[Gleep!]` use the "pulse" transition
			when it appears.
			
			Details:
			At present, the following text strings will produce a particular transition:
			* "instant" (causes the hook to instantly appear)
			* "dissolve" or "fade" (causes the hook to gently fade in)
			* "flicker" (causes the hook to roughly flicker in - don't use with a long (transition-time:))
			* "shudder" (causes the hook to instantly appear while shaking back and forth)
			* "rumble" (causes the hook to instantly appear while shaking up and down)
			* "slide-right" (causes the hook to slide in from left to right)
			* "slide-left" (causes the hook to slide in from right to left)
			* "slide-up" (causes the hook to slide in from bottom to top)
			* "slide-down" (causes the hook to slide in from top to bottom)
			* "fade-right" (causes the hook to gently fade in while sliding rightward)
			* "fade-left" (causes the hook to gently fade in while sliding leftward)
			* "fade-up" (causes the hook to gently fade in while sliding upward)
			* "fade-down" (causes the hook to gently fade in while sliding downward)
			* "pulse" (causes the hook to instantly appear while pulsating rapidly)
			* "zoom" (causes the hook to scale up from the mouse pointer)
			* "blur" (causes the hook to appear from a blur)
			
			All transitions are 0.8 seconds long, unless a (transition-time:) changer is added
			to the changer.

			You can't combine transitions by adding them together, like you can with (text-style:) -
			`(t8n:"dissolve")+(t8n:"shudder")` won't make a transition that simultaneously dissolve-fades and shudders.

			While you can attach this to (link-show:) to change the transitions it uses, you can't use this macro to change
			the passage transitions used by links or (link-goto:), and trying to do so will cause an error. Please use
			(transition-depart:) or (transition-arrive:) for this purpose instead.

			The "blur" transition will not work in Internet Explorer 10 or 11.

			See also:
			(text-style:), (transition-time:), (transition-delay:), (transition-skip:), (animate:)

			Added in: 1.0.0
			#transitions 1
		*/
		(["transition", "t8n"],
			(_, name) => ChangerCommand.create("transition", [Utils.insensitiveName(name)]),
			(d, name) => {
				d.transition     = name;
				if (name === "zoom") {
					d.transitionOrigin = function() {
						const el = $(this), {left, top} = el.offset();
						return (Utils.mouseCoords.x - left) + "px " + (Utils.mouseCoords.y - top) + "px";
					};
				}
				return d;
			},
			[validT8ns]
		)

		/*d:
			(transition-time: Number) -> Changer
			Also known as: (t8n-time:)
			
			A changer that, when added to a (transition:) changer, adjusts the time of the transition.

			Example usage:
			`(set: $slowTransition to (transition:"shudder") + (transition-time: 2s))` creates a transition
			style which uses "shudder" and takes 2 seconds.

			Details:
			Much like (live:), this macro should be given a number of milliseconds (such as `50ms`) or seconds
			(such as `10s`). Providing 0 or fewer seconds/milliseconds is not permitted and will result in an error.

			This can be attached to links, much like (t8n:) itself.

			See also:
			(transition:)

			Added in: 1.0.0
			#transitions 2
		*/
		(["transition-time", "t8n-time"],
			(_, time) => ChangerCommand.create("transition-time", [time]),
			(d, time) => {
				d.transitionTime     = time;
				/*
					(transition-time:) does a sort of unfortunate double duty: specifying the transition time
					for hooks AND links.
				*/
				d.data.passageT8n = assign(d.data.passageT8n || {}, { time });
				return d;
			},
			[positiveNumber]
		)
		/*d:
			(transition-delay: Number) -> Changer
			Also known as: (t8n-delay:)
			
			A changer that, when added to a (transition:) changer, delays the start of the transition by a given time.

			Example usage:
			`(t8n:"slide-right")+(t8n-delay:3s)[Sorry I'm late.]` makes the text slide in from the right, but only
			after 3 seconds have passed.

			Details:
			Much like (live:), this macro should be given a number of milliseconds (such as `50ms`) or seconds
			(such as `10s`). Providing negative seconds/milliseconds is not permitted and will result in an error.

			Unlike (transition-time:), this does nothing when attached to links, because clicking the link should
			begin the transition immediately. Attaching it to a link will not produce an error.

			See also:
			(transition:), (transition-time:), (transition-skip:)

			Added in: 3.2.0
			#transitions 2
		*/
		(["transition-delay", "t8n-delay"],
			(_, time) => ChangerCommand.create("transition-delay", [time]),
			(d, time) => {
				d.transitionDelay = time;
				return d;
			},
			[nonNegativeNumber]
		)
		/*d:
			(transition-skip: Number) -> Changer
			Also known as: (t8n-skip:)
			
			A changer that, when added to a (transition:) changer, allows the player to skip or accelerate the transition by
			holding down a keyboard key or mouse button, or by touching the touch device.

			Example usage:
			`(t8n:"slide-right")+(t8n-time:3s)+(t8n-skip:0.2s)[OK! I'm comin'!]` makes the text slide in from the right,
			but only after 3 seconds have passed... but if the player holds a key, mouse button, or the screen, it gets
			advanced by an additional 0.2 seconds each millisecond they hold.

			Rationale:
			It's tempting to use transitions a lot in your story, but these can come at a cost to the player - watching
			and waiting for transitions to complete can be tiring and detrimental to your story's pacing, especially
			if they have to revisit certain parts of your story a lot. This macro can help by providing them with a means
			of skipping or accelerating the transitions if they so choose.

			Details:
			The number given is an amount of milliseconds (or, if suffixed with `s`, seconds) to advance the transition. For each
			millisecond of the transition, Harlowe checks if a key or button is held, and if so, then it is advanced
			by the given number (in addition to the elapsed millisecond).

			If a non-positive number is given, an error will be produced.

			This effect advances both a transition's (transition-time:)s and (transition-delay:)s.

			See also:
			(transition:), (transition-delay:), (transition-time:)

			Added in: 3.2.0
			#transitions 6
		*/
		(["transition-skip", "t8n-skip"],
			(_, time) => ChangerCommand.create("transition-skip", [time]),
			(d, time) => {
				d.transitionSkip = time;
				return d;
			},
			[positiveNumber]
		)

		/*d:
			(transition-depart: String) -> Changer
			Also known as: (t8n-depart:)
			
			A changer that alters passage links, (link-goto:)s, and most every other kind of link, changing which
			passage fade-out animation the link uses.
			
			Example usage:
			* `(t8n-depart: "dissolve")[[Next morning]]` changes the `[[Next morning]]` link, such
			that clicking it takes you to the "Next morning" passage with the current passage smoothly fading out
			instead of instantly disappearing.
			* `(enchant: ?Link, (t8n-depart: "dissolve"))` causes ALL passage links to use the smooth fade-out. This
			is best used in a "header" or "footer" tagged passage.
			
			Details:
			This macro accepts the exact same transition names as (transition:).
			* "instant" (causes the passage to instantly vanish)
			* "dissolve" or "fade" (causes the passage to gently fade out)
			* "flicker" (causes the passage to roughly flicker in - don't use with a long (transition-time:)))
			* "shudder" (causes the passage to disappear while shaking back and forth)
			* "rumble" (causes the passage to instantly appear while shaking up and down)
			* "slide-right" (causes the passage to slide out toward the right)
			* "slide-left" (causes the passage to slide out toward the left)
			* "slide-up" (causes the passage to slide out toward the top)
			* "slide-down" (causes the passage to slide out toward the bottom)
			* "fade-right" (causes the passage to gently fade out while sliding rightward)
			* "fade-left" (causes the passage to gently fade out while sliding leftward)
			* "fade-up" (causes the passage to gently fade out while sliding upward)
			* "fade-down" (causes the passage to gently fade out while sliding downward)
			* "pulse" (causes the passage to disappear while pulsating rapidly)
			* "zoom" (causes the passage to shrink down toward the mouse pointer)
			* "blur" (causes the passage to vanish into a blur)

			Attaching this macro to a hook that isn't a passage link won't do anything (no error message will be produced).

			You can't combine transitions by adding them together, like you can with (text-style:) -
			`(t8n-depart:"dissolve")+(t8n-depart:"shudder")` won't make a transition that simultaneously dissolve-fades and shudders.

			The "blur" transition will not work in Internet Explorer 10 or 11.

			See also:
			(transition-arrive:)

			Added in: 3.0.0
			#transitions 4
		*/
		(["transition-depart", "t8n-depart"],
			(_, name) => ChangerCommand.create("transition-depart", [Utils.insensitiveName(name)]),
			(d, name) => {
				d.data.passageT8n = assign(d.data.passageT8n || {}, { depart:name });
				if (name === "zoom") {
					d.data.passageT8n.departOrigin = function() {
						const el = $(this), {left, top} = el.offset();
						return (Utils.mouseCoords.x - left) + "px " + (Utils.mouseCoords.y - top) + "px";
					};
				}
				return d;
			},
			[validT8ns]
		)

		/*d:
			(transition-arrive: String) -> Changer
			Also known as: (t8n-arrive:)
			
			A changer that alters passage links, (link-goto:)s, and most every other kind of link, changing which
			passage fade-in animation the link uses.
			
			Example usage:
			* `(t8n-arrive: "instant")[[Next morning]]` changes the `[[Next morning]]` link, such
			that clicking it takes you to the "Next morning" passage, which instantly pops in instead of slowly fading in as usual.
			* `(enchant: ?Link, (t8n-arrive: "instant"))` causes ALL passage links to use the instant pop-in. This
			is best used in a "header" or "footer" tagged passage.
			
			Details:
			This macro accepts the exact same transition names as (transition:).
			* "instant" (causes the passage to instantly vanish)
			* "dissolve" or "fade" (causes the passage to gently fade out)
			* "flicker" (causes the passage to roughly flicker out - don't use with a long (transition-time:))
			* "shudder" (causes the passage to disappear while shaking back and forth)
			* "rumble" (causes the passage to instantly appear while shaking up and down)
			* "slide-right" (causes the passage to slide in from left to right)
			* "slide-left" (causes the passage to slide in from right to left)
			* "slide-up" (causes the passage to slide in from bottom to top)
			* "slide-down" (causes the passage to slide in from top to bottom)
			* "fade-right" (causes the passage to gently fade in while sliding rightward)
			* "fade-left" (causes the passage to gently fade in while sliding leftward)
			* "fade-up" (causes the passage to gently fade in while sliding upward)
			* "fade-down" (causes the passage to gently fade in while sliding downward)
			* "pulse" (causes the passage to disappear while pulsating rapidly)
			* "zoom" (causes the passage to scale up from the mouse pointer)
			* "blur" (causes the passage to appear from a blur)

			Attaching this macro to a hook that isn't a passage link won't do anything (no error message will be produced).

			You can't combine transitions by adding them together, like you can with (text-style:) -
			`(t8n-depart:"dissolve")+(t8n-depart:"shudder")` won't make a transition that simultaneously dissolve-fades and shudders.

			The "blur" transition will not work in Internet Explorer 10 or 11.

			See also:
			(transition-depart:)

			Added in: 3.0.0
			#transitions 5
		*/
		(["transition-arrive", "t8n-arrive"],
			(_, name) => ChangerCommand.create("transition-arrive", [Utils.insensitiveName(name)]),
			(d, name) => {
				d.data.passageT8n = assign(d.data.passageT8n || {}, { arrive:name });
				if (name === "zoom") {
					d.data.passageT8n.arriveOrigin = function() {
						const el = $(this), {left, top} = el.offset(), height = el.height();
						return {
							'transform-origin': ((Utils.mouseCoords.x - left) * 100 / el.width()) + "% "
								+ ((Utils.mouseCoords.y - top) * 100 / height + "%"),
							height: height + "px",
						};
					};
				}
				return d;
			},
			[validT8ns]
		)

		/*d:
			(button:) -> Changer

			When applied to a link, this changer styles it so that it resembles a button, and makes it take up the entire passage width. It is not
			recommended that this be used on non-link hooks.

			Example usage:
			* `(button:)[[Go to the cemetery]]` applies the button style to a single passage link.
			* `(enchant:?link's 2ndlast + ?link's last, (button:))` enchants the second-last and last links in the passage with the button style.

			Rationale:
			Harlowe links, by default, are designed to appear inside and among prose, in the manner of HTML prose. That being said, a story written in a more
			traditional interactive fiction style will often want to finish a passage with a series of exit links. These links can benefit from being more
			visually prominent and inviting, rather than just single fragments of text. The (button:) changer provides links with a styling that is more typical
			of other interactive fiction engines' link options.

			Details:
			This is essentially a shortcut for a number of other changers added together. `(link: "Link Text", (button:))` is equivalent to
			`(link:"Link Text",(align:"=><=")+(box:"X")+(b4r:"solid")+(css:"padding:0px")+(corner-radius:16))`. However, unlike the latter,
			this changer is designed to work correctly with (click:) and `(enchant:"text")`, so that the button border matches the current link colour.

			To make (button:) links appear in two or more columns, or make two (button:) links appear side-by-side, consider using the column markup.

			This changer can be provided to non-link hooks or commands, but since the result will have the same borders and spacing as a button while not
			being clickable, it is not recommended to use it this way.

			This changer adds the class "enchantment-button" to <tw-link> and <tw-enchantment> elements.

			See also:
			(align:), (border:), (box:), (corner-radius:)

			Added in: 3.2.0
			#styling
		*/
		("button",
			() => ChangerCommand.create("button", []),
			(d) => {
				/*
					In order for this to be validly considered usable with (enchant:), it should only have an "attr" item instead of a "functions" item.
					This is currently the only way for a ChangeDescriptor to modify an element's class... as uncomfortable as it is.
				*/
				d.attr.push({
					class() {
						return this.className + (this.classList.contains('enchantment-button') ? '' : ' '.repeat(this.className.length > 0) + 'enchantment-button');
					},
				});
				return d;
			},
			[]
		)

		/*d:
			(border: String, [String], [String], [String]) -> Changer
			Also known as: (b4r:)

			A changer macro that applies a CSS border to the hook.

			Example usage:
			```
			(b4r:"dotted")[I love you!
			I want to be your wife!]
			```

			Details:

			The border macros accept up to four values. These values refer to *sides of a rectangle*, going clockwise
			from the top: the first value is the **top** edge (12 o'clock), second is the **right** edge (3 o'clock),
			third is the **bottom** edge (6 o'clock), fourth is the **left** edge (9 o'clock). You can stop giving
			values anywhere. If an edge doesn't have a value, then it will use whatever the opposite edge's value is.

			* `(border: "solid", "dotted", "dashed", "double")` provides all four sides.
			* `(border: "solid", "dotted", "dashed")` stops at the bottom edge, so the left edge will use "dotted", to match
			the right edge.
			* `(border: "solid", "dotted")` stops at the right edge, so the bottom edge will use "solid", to match
			the top edge, and the left edge will use "dotted", to match the right edge.
			* `(border: "solid")` causes all of the edges to use "solid".

			This macro affects the style of the border, and accepts the following border names.

			| String | Example
			|---
			| "none" | Example text
			| "solid" | <span style="border: 2px solid black;margin:2px;display:inline-block">Example text</span>
			| "dotted" | <span style="border: 2px dotted black;margin:2px;display:inline-block">Example text</span>
			| "dashed" | <span style="border: 2px dashed black;margin:2px;display:inline-block">Example text</span>
			| "double" | <span style="border: 2px double black;margin:2px;display:inline-block">Example text</span>
			| "groove" | <span style="border: 2px groove black;margin:2px;display:inline-block">Example text</span>
			| "ridge" | <span style="border: 2px ridge black;margin:2px;display:inline-block">Example text</span>
			| "inset" | <span style="border: 2px inset black;margin:2px;display:inline-block">Example text</span>
			| "outset" | <span style="border: 2px outset black;margin:2px;display:inline-block">Example text</span>

			The "none" type can be used to remove a border that another changer may have included. NOTE: As of Harlowe 3.2.2,
			this can only be used to remove borders from combined changers, such as by `(set: $changer to it + (b4r:"none"))`,
			and can't be used to remove borders from already-changed hooks or other structures.

			The default size of the border, with no other CSS changes to any elements, is 2px (2 pixels),
			unless a change is applied using (border-size:).

			Due to browser CSS limitations, the border will force the hook to become a single rectangular area. The hook can
			no longer word-wrap, and moreover occupies every line in which its text is contained. So, this changer is best
			suited for entire paragraphs of text (or hooks using the (box:) changer) rather than single words or phrases.

			See also:
			(border-size:), (border-colour:), (corner-radius:)

			Added in: 3.2.0
			#borders 1
		*/
		(["border","b4r"],
			(_, ...names) => ChangerCommand.create("border", names.map(Utils.insensitiveName)),
			(d, ...names) => {
				d.styles.push({
					display() {
						let d = $(this).css('display');
						/*
							Borders require block-style formatting for the hook.
							Let's not alter the display property if there is no border, actually,
							and also, if there's already a block display for it (such as via (box:)).
						*/
						if (names.every(n => n === 'none') || !d.includes("inline")) {
							return d;
						}
						return "inline-block";
					},
					/*
						Because this macro's edge order is the same as CSS's, we simply
						provide the names here as-is.
					*/
					"border-style": names.join(' '),
					"border-width"() {
						/*
							Don't replace deliberately-placed border sizes.
							Note: .css('border-width') doesn't work (and moreover is slower).
						*/
						return this.style.borderWidth || '2px';
					},
				});
				return d;
			},
			[validBorders, ...Array(3).fill(optional(validBorders))]
		)

		/*d:
			(border-size: Number, [Number], [Number], [Number]) -> Changer
			Also known as: (b4r-size:)

			When applied to a hook being changed by the (border:) changer, this multiplies the size
			of the border by a given amount.

			Example usage:
			`(b4r:"solid")+(b4r-size:4)[Do not read anything outside of this box.]`

			Details:

			The border macros accept up to four values. These values refer to *sides of a rectangle*, going clockwise
			from the top: the first value is the **top** edge (12 o'clock), second is the **right** edge (3 o'clock),
			third is the **bottom** edge (6 o'clock), fourth is the **left** edge (9 o'clock). You can stop giving
			values anywhere. If an edge doesn't have a value, then it will use whatever the opposite edge's value is
			(or the top value if it's the only one).

			The default size of borders added using (border:) is 2px (2 pixels). The number given is a number of
			CSS pixels to set the new size to. Since CSS pixels don't exactly correspond to display pixels
			(such as, for instance, if the browser window is zoomed in) then it's possible to have a non-whole
			number of CSS pixels (such as 1.5, which would, if the browser window was zoomed in to 200%, become
			3 display pixels). Thus, this macro accepts numbers with fractional values. That being said,
			if a number lower than 0 is given, an error will be produced.

			See also:
			(border:), (corner-radius:), (text-size:)

			Added in: 3.2.0
			#borders 3
		*/
		(["border-size","b4r-size"],
			(_, ...widths) => ChangerCommand.create("border-size", widths),
			(d, ...widths) => {
				d.styles.push({ "border-width": widths.map(width => width + "px").join(' ') });
				return d;
			},
			[nonNegativeNumber, ...Array(3).fill(optional(nonNegativeNumber))]
		)

		/*d:
			(corner-radius: Number, [Number], [Number], [Number]) -> Changer

			When applied to a hook, this rounds the corners by the given number of pixels, causing the hook
			to become increasingly round or button-like.

			Example usage:
			```
			(b4r:'solid')+(corner-radius:8)[Hasn't this gone on too long?]
			(b4r:'solid')+(corner-radius:12)[Shouldn't you tell them the truth?]
			(b4r:'solid')+(corner-radius:16)[//That you're not really who you say you are??//]
			```

			Details:
			The border macros accept up to four values. These values refer to *corners of a rectangle*, going clockwise
			from the top: the first value is the **top-left** corner (10 o'clock), second is the **top-right** corner (2 o'clock),
			third is the **bottom-right** corner (4 o'clock), fourth is the **bottom-left** corner (8 o'clock). You can stop giving
			values anywhere. If a corner doesn't have a value, then it will use whatever the opposite corner's value is
			(or the top-left value if it's the only one).

			Obviously, unless the hook has a (background:) or a (border:), the rounded corners will not be visible, and this
			changer will have no real effect.

			If the hook has a (border:), values greater than the border's (border-width:) (which is 2 if it wasn't changed)
			will cause the interior of the element to become constrained by the curvature of the corners, as the
			rectangle's corners get cut off. Because of this, this macro also adds interior padding (distance between the
			border and the contained text) equal to each of the passed-in numbers, unless another changer (such as (css:))
			provided a different padding value.

			See also:
			(border:), (background:), (border-size:)

			Added in: 3.2.0
			#borders 4
		*/
		("corner-radius",
			(_, ...radii) => ChangerCommand.create("corner-radius", radii),
			(d, ...radii) => {
				d.styles.push({
					"border-radius": radii.map(r => r + "px").join(' '),
					padding() { return this.style.padding || radii.map(r => r + "px").join(' '); },
				});
				return d;
			},
			[nonNegativeNumber, ...Array(3).fill(optional(nonNegativeNumber))]
		)

		/*d:
			(border-colour: String or Colour, [String or Colour], [String or Colour], [String or Colour]) -> Changer
			Also known as: (b4r-colour:), (border-color:), (b4r-color:)

			When applied to a hook being changed by the (border:) changer, this changes the border's colour.

			Example usage:
			* `(b4r-color:magenta)+(b4r:"ridge")[LEVEL 01: DREAM WORLD]`
			* `(b4r-color:red,yellow,green,blue)+(b4r:"dotted")[Isn't it a lovely time?]`

			Details:
			The border macros accept up to four values. These values refer to *sides of a rectangle*, going clockwise
			from the top: the first value is the **top** edge (12 o'clock), second is the **right** edge (3 o'clock),
			third is the **bottom** edge (6 o'clock), fourth is the **left** edge (9 o'clock). You can stop giving
			values anywhere. If an edge doesn't have a value, then it will use whatever the opposite edge's value is
			(or the top value if it's the only one).

			Much like (text-colour:), this accepts either a Colour (such as those produced by (hsl:) or (rgb:), or plain literals
			like `#fff`), or a CSS colour string.

			Certain (border:) styles, namely "ridge", "groove", "inset" and "outset", will modify the colour,
			darkening it for certain parts of the border to produce their namesake appearance.

			Selecting `"transparent"` as the colour will cause the border to "disappear", but also cause the space surrounding
			the hook to remain.

			See also:
			(background:), (text-colour:)

			Added in: 3.2.0
			#borders 2
		*/
		(["border-colour","b4r-colour","border-color","b4r-color"],
			(_, ...colours) => ChangerCommand.create("border-colour", colours.map(c => Colour.isPrototypeOf(c) ? c.toRGBAString(c) : c)),
			(d, ...colours) => {
				d.styles.push({ "border-color": colours.join(' ') });
				return d;
			},
			[either(String,Colour),...Array(3).fill(optional(either(String,Colour)))]
		)

		/*d:
			(opacity: Number) -> Changer
			
			This styling changer changes how opaque the attached hook is, using a value from 0 to 1. Reducing the value makes it more transparent.
			An opacity of 0 makes the hook invisible.

			Example usage:
			`(opacity: 0.5)[You don't think there's (color:green)[a revenant] nearby, do you?]` makes the hook 50% transparent.
			
			Details:
			This affects the entire hook, including its background, any borders added by (border:), and so forth. Moreover, this does not override
			"alpha" opacity values of colours produced by (hsl:), (rgb:) and (lch:) – the multiple transparency effects produced by these will
			multiplicatively stack with one another.

			Each nested usage of (opacity:) also multiplicatively stacks with one another. If two hooks with opacity 0.5 are nested, such as by `(opacity:0.5)[(opacity:0.5)[Faded]]`,
			then the inner hook will have an opacity equivalent to 0.25. As a consequence of this, you can't use (opacity:) inside a partially transparent hook
			to bring the inner hook up to 100% opacity.

			Two (text-style:) styles, "fade-in-out" and "opacity", will override this changer if it's affecting the same hook.

			See also:
			(hsl:), (rgb:), (text-colour:)

			Added in: 3.2.0
			#styling
		*/
		("opacity",
			(_, cent) => ChangerCommand.create("opacity", [cent]),
			(d, cent) => d.styles.push({opacity: cent}),
			[percent]
		)

		/*d:
			(font: String) -> Changer
			
			This styling changer changes the font used to display the text of the attached hook. Provide
			the font's family name (such as "Helvetica Neue" or "Courier") as a string.

			Example usage:
			`(font:'Courier New')[And what have we here?]`

			Details:
			Currently, this command will only work if the font is available to the player's browser, or
			if font files are linked using `url()` in your story's stylesheet, or embedded using base64 (explanations
			for which are beyond the scope of this macro's description).

			No error will be reported if the provided font name is not available, invalid or misspelled.

			See also:
			(text-style:), (text-size:)

			Added in: 1.0.0
			#styling
		*/
		("font",
			(_, family) => ChangerCommand.create("font", [family]),
			(d, family) => {
				d.styles.push({'font-family': family});
				return d;
			},
			[String]
		)
		
		/*d:
			(align: String) -> Changer
			
			This styling changer changes the alignment of text in the attached hook, as if the
			`===>`~ arrow syntax was used. In fact, these same arrows (`==>`~, `=><=`~, `<==>`~, `====><=`~ etc.)
			should be supplied as a string to specify the degree of alignment.

			Example usage:
			`(align: "=><==")[Hmm? Anything the matter?]`

			Details:
			Hooks affected by this changer will take up their own lines in the passage, regardless of
			their placement in the story prose. This allows them to be aligned in the specified manner.

			Added in: 1.1.0
			#styling
		*/
		("align",
			(_, arrow) => {
				/*
					I've decided to reimplement the aligner arrow parsing algorithm
					used in markup/Markup and Renderer here for decoupling purposes.
				*/
				let style,
					centerIndex = arrow.indexOf("><");
				
				if (!/^(==+>|<=+|=+><=+|<==+>)$/.test(arrow)) {
					return TwineError.create('datatype', 'The (align:) macro requires an alignment arrow '
						+ '("==>", "<==", "==><=" etc.) be provided, not "' + arrow + '"');
				}
				
				if (~centerIndex) {
					/*
						Find the left-align value
						(Since offset-centered text is centered,
						halve the left-align - hence I multiply by 50 instead of 100
						to convert to a percentage.)
					*/
					const alignPercent = Math.round(centerIndex / (arrow.length - 2) * 50);
					style = assign({
							'text-align'  : 'center',
							'max-width'   : '50%',
						},
						/*
							25% alignment is centered, so it should use margin-auto.
						*/
						(alignPercent === 25) ? {
							'margin-left' : 'auto',
							'margin-right': 'auto',
						} : {
							'margin-left' : alignPercent + '%',
					});
				}
				else if (arrow[0] === "<" && arrow.slice(-1) === ">") {
					style = {
						'text-align'  : 'justify',
						'max-width'   : '50%',
					};
				}
				else if (arrow.includes(">")) {
					style = {
						'text-align'  : 'right'
					};
				}
				else {
					/*
						If this is nested inside another (align:)-affected hook,
						this is necessary to assert leftward alignment.
					*/
					style = {
						'text-align'  : 'left'
					};
				}
				// This final property is necessary for margins to appear.
				style.display = 'inline-block';
				return ChangerCommand.create("align", [style]);
			},
			(d, style) => {
				d.styles.push(style);
			},
			[String]
		)
		
		/*d:
			(text-colour: String or Colour) -> Changer
			Also known as: (colour:), (text-color:), (color:)

			This styling changer changes the colour used by the text in the attached hook.
			You can supply either a string with a CSS-style colour (a colour name or
			RGB number supported by CSS), or a built-in colour object.

			Example usage:
			`(colour: red + white)[Pink]` combines the built-in red and white colours to make pink.
			`(colour: #696969)[Gray]` uses a CSS-style colour to style the text gray.

			Details:
			This macro only affects the text colour. To change the text background, call upon
			the (background:) macro.

			This macro will change the colour of links inside the contained hook, with one exception: using
			(change:) to change the entire passage (via `?passage` or `?page`) with (text-colour:)
			will NOT affect links. This is to allow you to re-style the entire story without having to lose
			the distinct colour of links compared to passage text. You can change the colour of all links using
			an explicit `(enchant: ?link, (text-colour: $color))`.

			Also, while this will change the colour of links inside the contained hook, the hover colour
			for the link will remain the same. You can alter that colour by styling the links using (hover-style:).

			See also:
			(background:)

			Added in: 1.0.0
			#styling
		*/
		(["text-colour", "text-color", "color", "colour"],
			(_, CSScolour) => ChangerCommand.create("text-colour", [CSScolour]),
			(d, CSScolour) => {
				/*
					Convert TwineScript CSS colours to bad old hexadecimal.
				*/
				if (Colour.isPrototypeOf(CSScolour)) {
					CSScolour = CSScolour.toRGBAString(CSScolour);
				}
				d.styles.push({'color': CSScolour});
				return d;
			},
			[either(String, Colour)]
		)
		/*d:
			(text-size: Number) -> Changer
			Also known as: (size:)

			This styling changer changes the text size of the attached hook by the given fraction.
			Give it a number greater than 1 to enlarge the text, and a number smaller to decrease
			the text. Providing 1 to this macro will revert the text size back to the default.

			Example usage:
			```
			This is normal text.
			(text-size:0.5)[Umm... this text is half the size of normal text]
			(size:2)[This text is enlarged twofold!]
			```

			Details:
			The default text size for Harlowe, with no other CSS changes to any elements, is 16px (16 pixels), and its
			default line height is 24px. This macro multiplies both of those CSS properties by the given
			number, scaling both proportionally. This size is absolute - any pure CSS alterations to the text
			size of the passage, story or page, using (css:) or story stylesheets, will NOT be taken into account.

			This macro also scales any markup which displays text larger or smaller by default, such as
			header markup or the "superscript" (text-style:).

			Be careful about using this macro with (hover-style:) - changing the displayed size of the "hover region"
			when the mouse begins to hover over it can lead to the pointer "slipping off" the region, causing it to abruptly
			stop hovering (and deactivating the style) unexpectedly.

			See also:
			(text-style:), (font:)

			Added in: 3.2.0
			#styling
		*/
		(["text-size", "size"],
			(_, percent) => ChangerCommand.create("text-size", [percent]),
			(d, percent) => {
				/*
					The constants 24 and 36 are what the default CSS, "font-size:1.5em" and "line-height:1.5em",
					compute to (on Firefox) with no other CSS changes.
				*/
				d.styles.push({'font-size': percent*24 + "px", 'line-height': percent*36 + "px" });
				return d;
			},
			[nonNegativeNumber]
		)
		/*d:
			(text-indent: Number) -> Changer
			
			This styling changer causes the attached hook to be indented by the given number of pixels.

			Example usage:
			* `(enchant: ?passage's lines, (text-indent:12))` gives each line (paragraph) of the passage an indent of 12 pixels.
			* `(text-indent: 24)+(size:1.5)[CHAPTER TWO]` makes just this hook have a leading indent of 24 pixels.

			Rationale:
			Indentation of initial letters has long been used in typesetting as a means of helping the human eye distinguish paragraphs of
			text from each other. While you can use line breaks to separate paragraphs, this often takes up an uncomfortable amount of vertical space,
			and can be unsuitable for long sections of prose. This macro can be used to provide indentation to single hooks, or, using (change:) or (enchant:),
			to every line in a passage.

			Details:
			This will place a gap before the first character of the attached hook, even if it isn't at the start of a line.

			The given number is the number of CSS pixels to indent the hook by. If it is negative, an error will be produced.

			Because this uses the CSS 'text-indent' attribute, hooks using this macro will have their CSS `display` attribute
			set to `inline-block`.

			It is recommended that you do NOT use this macro for precisely placing text offset from the left or right of the passage.
			You will get better results using the (align:) macro, aligner marker, or column markup for this purpose.

			See also:
			(align:)

			Added in: 3.2.0
			#styling
		*/
		("text-indent",
			(_, width) => ChangerCommand.create("text-indent", [width]),
			(d, width) => {
				d.styles.push({
					'text-indent': width + "px",
					display: 'inline-block',
				});
				return d;
			},
			[nonNegativeNumber]
		)
		/*d:
			(text-rotate-z: Number) -> Changer
			Also known as: (text-rotate:)

			This styling changer visually rotates the attached hook clockwise by a given number of
			degrees. The rotational axis is in the centre of the hook.

			Example usage:
			`(text-rotate:45)[Tilted]` will produce <span style="display:inline-block;transform:rotate(45deg);">Tilted</span>
			
			Details:

			The surrounding non-rotated text will behave as if the rotated text is still in its original position -
			the horizontal space of its original length will be preserved, and text it overlaps with vertically will
			ignore it.

			A rotation of 180 degrees will, due to the rotational axis, flip the hook upside-down and back-to-front, as
			if the (text-style:) styles "mirror" and "upside-down" were both applied.

			Due to browser limitations, hooks using this macro will have its CSS `display` attribute
			set to `inline-block`.

			See also:
			(text-style:), (text-rotate-y:), (text-rotate-x:)

			Added in: 1.0.0
			#styling
		*/
		(["text-rotate-z","text-rotate"],
			(_, rotation) => ChangerCommand.create("text-rotate-z", [rotation]),
			(d, rotation) => {
				d.styles.push({display: 'inline-block', 'transform'() {
					let currentTransform = $(this).css('transform') || '';
					if (currentTransform === "none") {
						currentTransform = '';
					}
					return currentTransform + " rotate(" + rotation + "deg)";
				}});
				return d;
			},
			[Number]
		)
		/*d:
			(text-rotate-y: Number) -> Changer

			This styling changer visually rotates the attached hook clockwise, around the Y axis (vertical), by a given number of
			degrees, making it appear to lean into the page. The rotational axis is in the centre of the hook.

			Example usage:
			```
			(text-rotate-y:45)+(size:1.5)[ATE BREAKFAST!

			READ THE NEWS!

			FOUND A LOST SOCK!]
			```
			
			Details:

			The surrounding non-rotated text will behave as if the rotated text is still in its original position -
			the horizontal space of its original length will be preserved, and text it overlaps with vertically will
			ignore it.

			A rotation of 90 degrees will, due to the rotational axis, cause the hook to disappear, appearing edge-on to the viewer.
			A rotation of 180 degrees willreverse the hook, as if `(text-style:"mirror")` was applied.

			Due to browser limitations, hooks using this macro will have its CSS `display` attribute
			set to `inline-block`.

			See also:
			(text-style:), (text-rotate-z:), (text-rotate-x:)

			Added in: 3.2.0
			#styling
		*/
		("text-rotate-y",
			(_, rotation) => ChangerCommand.create("text-rotate-y", [rotation]),
			(d, rotation) => {
				d.styles.push({display: 'inline-block', 'transform'() {
					let currentTransform = $(this).css('transform') || '';
					if (currentTransform === "none") {
						currentTransform = '';
					}
					return currentTransform + " perspective(50vw) rotateY(" + rotation + "deg)";
				}});
				return d;
			},
			[Number]
		)
		/*d:
			(text-rotate-x: Number) -> Changer

			This styling changer visually rotates the attached hook clockwise, around the X axis (horizontal), by a given number of
			degrees, making it appear to lean into the page. The rotational axis is in the centre of the hook.

			Example usage:
			```
			(text-rotate-x:-45)[You feel a strange

			lightness, as if you're

			in an elevator that's

			suddenly started

			plunging rapidly.]
			```
			
			Details:

			The surrounding non-rotated text will behave as if the rotated text is still in its original position -
			the horizontal space of its original length will be preserved, and text it overlaps with vertically will
			ignore it.

			A rotation of 90 degrees will, due to the rotational axis, cause the hook to disappear, appearing edge-on to the viewer.
			A rotation of 180 degrees will, due to the rotational axis, flip the hook upside-down, as if `(text-style:"upside-down")` was applied.

			Due to browser limitations, hooks using this macro will have its CSS `display` attribute
			set to `inline-block`.

			See also:
			(text-style:), (text-rotate-y:), (text-rotate-z:)

			Added in: 3.2.0
			#styling
		*/
		("text-rotate-x",
			(_, rotation) => ChangerCommand.create("text-rotate-x", [rotation]),
			(d, rotation) => {
				d.styles.push({display: 'inline-block', 'transform'() {
					let currentTransform = $(this).css('transform') || '';
					if (currentTransform === "none") {
						currentTransform = '';
					}
					return currentTransform + " perspective(50vw) rotateX(" + rotation + "deg)";
				}});
				return d;
			},
			[Number]
		)
		/*d:
			(background: Colour or String or Gradient) -> Changer
			Also known as: (bg:)

			This styling changer alters the background colour or background image
			of the attached hook. Supplying a gradient (produced by (gradient:)) will set the
			background to that gradient. Supplying a colour (produced by (rgb:) or (hsl:),
			a built-in colour value like `red`, or a bare colour value like #FA9138) will set
			the background to a flat colour. CSS strings that resemble HTML hex colours (like "#FA9138") will
			also provide flat colour. Other strings will be interpreted as an image URL,
			and the background will be set to it.

			Example usage:
			* `(background: red + white)[Pink background]`
			* `(background: (gradient: 0, 0,red, 1,black))[Red-black gradient background]`
			* `(background: #663399)[Purple background]`
			* `(background: "#663399")[Purple background]`
			* `(background: "marble.png")[Marble texture background]`

			Details:
			
			Combining two (background:) changers will do nothing if they both influence the
			colour or the image. For instance `(background:red) + (background:white)` will simply
			produce the equivalent `(background:white)`. However, `(background:red) + (background:"mottled.png")`
			will work as intended if the background image contains transparency, allowing the background
			colour to appear through it. Note that gradients count as background images, not colours - you can
			combine gradients whose colours are partially transparent with flat colours, such as
			`(background: (gradient: 90, 0, (hsla:0,0,0,0.5), 1, (hsla:0,0,0,0))) + (background: red)`

			Currently, supplying other CSS colour names (such as `burlywood`) is not
			permitted - they will be interpreted as image URLs regardless.

			No error will be reported if the image at the given URL cannot be accessed.

			See also:
			(colour:)

			Added in: 1.0.0
			#styling
		*/
		(["background", "bg"],
			(_, value) => ChangerCommand.create("background", [value]),
			(d, value) => {
				let property;

				//Convert TwineScript CSS colours to bad old hexadecimal.
				if (Colour.isPrototypeOf(value)) {
					value = value.toRGBAString(value);
				}
				//Convert TwineScript gradients into CSS linear-gradients.
				else if (Gradient.isPrototypeOf(value)) {
					value = value.toLinearGradientString(value);
				}
				/*
					Different kinds of values can be supplied to this macro
				*/
				if (Colour.isHexString(value) || Colour.isCSS3Function(value)) {
					property = {"background-color": value};
				}
				else if (value.startsWith('linear-gradient(') || value.startsWith('repeating-linear-gradient(')) {
					property = {"background-image": value};
				}
				else {
					/*
						When Harlowe can handle base64 image passages,
						this will invariably have to be re-worked.
					*/
					/*
						background-size:cover allows the image to fully cover the area
						without tiling, which I believe is slightly more desired.
					*/
					property = {"background-size": "cover", "background-image": "url(" + value + ")"};
				}
				d.styles.push(property, {
					/*
						We also need to alter the "display" property in a case where the element
						has block children - the background won't display if it's kept as initial.
					 */
					display() {
						const e = $(this);
						/*
							Don't change the "display" if there are no element children.
							childrenProbablyInline() defaults to false for elements with no element children.
						*/
						return (!e.children().length || Utils.childrenProbablyInline(e)) ? $(this).css('display') : "block";
					},
				});
				return d;
			},
			[either(String,Colour,Gradient)]
		)
		
		/*d:
			(text-style: ...String) -> Changer
			
			This applies one or more selected built-in text styles to the hook's text. Give this macro one of these strings (capitalisation and hyphens ignored):
			`"none"`, `"bold"`, `"italic"`, `"underline"`, `"double-underline"`, `"wavy-underline"`, `"strike"`, `"double-strike"`, `"wavy-strike"`, `"superscript"`,
			`"subscript"`, `"blink"`, `"shudder"`, `"mark"`, `"condense"`, `"expand"`, `"outline"`, `"shadow"`, `"emboss"`, `"smear"`, `"blur"`, `"blurrier"`,
			`"mirror"`, `"upside-down"`, `"fade-in-out"`, `"rumble"`, `"sway"`, `"buoy"` or `"fidget"`.
			
			Example usage:
			* `The shadow (text-style: "shadow")[flares] at you!` will style the word "flares" with a shadow.
			* `(set: $s to (text-style: "shadow")) The shadow $s[flares] at you!` will also style it with a shadow.
			* `(text-style: "italic", "emboss")[Richard Donahue, King for Hire]` makes the text italic and embossed.
			
			Rationale:
			While Harlowe offers markup for common formatting styles like bold and italic, having these
			styles available from a changer macro provides some extra benefits: it's possible, as with all
			such style macros, to (set:) them into a variable, combine them with other changers, and re-use them
			succinctly throughout the story (by using the variable in place of the macro).
			
			Furthermore, this macro also offers many less common but equally desirable styles to the author,
			which are otherwise unavailable or difficult to produce.
			
			Details:
			At present, the following text strings will produce a particular style. All of these are case-insensitive and dash-insensitive - "UPSIDE-DOWN" and "upsidedown" both work in place of "upside-down".

			| String | Example | Incompatible with
			|---
			| "none"           | <t-s></t-s> | 
			| "bold"           | <t-s style="font-weight:bold"></t-s> | 
			| "italic"         | <t-s style="font-style:italic"></t-s> | 
			| "underline"      | <t-s style="text-decoration: underline"></t-s> | "double-underline", "wavy-underline", "strike", "double-strike", "wavy-strike"
			| "double-underline" | <t-s style="text-decoration: underline;text-decoration-style:double"></t-s> | "underline", "wavy-underline","strike", "double-strike", "wavy-strike"
			| "wavy-underline" | <t-s style="text-decoration: underline;text-decoration-style:wavy"></t-s> | "underline", "double-underline", "strike", "double-strike", "wavy-strike"
			| "strike"         | <t-s style="text-decoration: line-through"></t-s> | "underline", "double-underline", "wavy-underline", "double-strike", "wavy-strike"
			| "double-strike"  | <t-s style="text-decoration: line-through;text-decoration-style:double"></t-s> | "underline", "double-underline", "wavy-underline", "strike", "wavy-strike"
			| "wavy-strike"    | <t-s style="text-decoration: line-through;text-decoration-style:wavy"></t-s> | "underline", "double-underline", "wavy-underline", "strike", "double-strike"
			| "superscript"    | <t-s style="vertical-align:super;font-size:.83em"></t-s> | "subscript"
			| "subscript"      | <t-s style="vertical-align:sub;font-size:.83em"></t-s> | "superscript"
			| "mark"           | <t-s style="background-color: hsla(60, 100%, 50%, 0.6)"></t-s> | (background-color:)
			| "outline"        | <t-s style="color:white; text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px  1px 0 black, 1px  1px 0 black"></t-s> | "shadow", "emboss", "blur", blurrier", "smear"
			| "shadow"         | <t-s style="text-shadow: 0.08em 0.08em 0.08em black"></t-s> | "outline", "emboss", "blur", "blurrier", "smear"
			| "emboss"         | <t-s style="text-shadow: 0.04em 0.04em 0em black"></t-s> | "outline", "shadow", "blur", "blurrier", "smear"
			| "condense"       | <t-s style="letter-spacing:-0.08em"></t-s> | "expand"
			| "expand"         | <t-s style="letter-spacing:0.1em"></t-s> | "condense"
			| "blur"           | <t-s style="text-shadow: 0em 0em 0.08em black; color:transparent"></t-s> | "outline", "shadow", "emboss", "blurrier", "smear"
			| "blurrier"       | <t-s style="text-shadow: 0em 0em 0.2em black; color:transparent"></t-s> | "outline", "shadow", "emboss", "blur", "smear"
			| "smear"          | <t-s style="text-shadow: 0em 0em 0.02em black, -0.2em 0em 0.5em black, 0.2em 0em 0.5em black; color:transparent"></t-s> | "outline", "shadow", "emboss", "blur", "blurrier"
			| "mirror"         | <t-s style="display:inline-block;transform:scaleX(-1)"></t-s> | "upside-down"
			| "upside-down"    | <t-s style="display:inline-block;transform:scaleY(-1)"></t-s> | "mirror"
			| "blink"          | <t-s style="animation:fade-in-out 1s steps(1,end) infinite alternate"></t-s> | "fade-in-out", "rumble", "shudder", "sway", "buoy", "fidget", (opacity:)
			| "fade-in-out"    | <t-s style="animation:fade-in-out 2s ease-in-out infinite alternate"></t-s> | "blink", "rumble", "shudder", "sway", "buoy", "fidget", (opacity:)
			| "rumble"         | <t-s style="display:inline-block;animation:rumble linear 0.1s 0s infinite"></t-s> | "fade-in-out", "blink", "sway", "fidget"
			| "shudder"        | <t-s style="display:inline-block;animation:shudder linear 0.1s 0s infinite"></t-s> | "fade-in-out", "blink", "buoy", "fidget"
			| "sway"           | <t-s style="display:inline-block;animation:sway 5s linear 0s infinite"></t-s> | "fade-in-out", "blink", "rumble", "buoy", "fidget"
			| "buoy"           | <t-s style="display:inline-block;animation:buoy 5s linear 0s infinite"></t-s> | "fade-in-out", "blink", "shudder", "sway", "fidget"
			| "fidget"         | <t-s style="display:inline-block;animation:fidget 60s step-end 0s infinite"></t-s> | "fade-in-out", "blink", "rumble", "shudder", "sway", "buoy"
			
			You can use the "none" style to remove an existing style from a combined changer. NOTE: As of Harlowe 3.2.2,
			this can only be used to remove styles from combined changers, such as by `(set: $changer to it + (text-style:"none"))`,
			and can't be used to remove styles from already-changed hooks or other structures.

			Due to browser limitations, combining many of these changers won't work exactly as intended – `(text-style: "underline", "strike")`, for instance,
			will cause only the latter of the two to be applied, in this case "strike". These incompatibilities are listed in the table above.
			
			Also due to browser limitations, hooks using "mirror" or "upside-down" will have their CSS `display` attribute set to `inline-block`.

			Note that the animations "rumble" and "shudder" are particularly intense, and may induce frustration or illness in
			motion-sensitive readers. Take care when using them.

			Finally, "doublestrike" and "scribble" will be replaced with "strike" when run on Internet Explorer, as will "double-underline" and
			"wavy-underline" be replaced with "underline".

			See also:
			(css:)

			Added in: 1.0.0
			#styling
		*/
		/*
			For encapsulation, the helpers that these two methods use are stored inside
			this closure, and used in the addChanger call.
		*/
		(...(() => {
				const
					/*
						This is a shorthand used for the definitions below. As a function, it is treated as a dependent
						attribute (dependent on the element's previous text-colour) so it will be applied at the same time
						as the actual dependent attribute (text-shadow, which uses the existing text-colour to colour the shadow).
					*/
					colourTransparent =  { color: () => "transparent", },
					/*
						These map style names, as input by the author as this macro's first argument,
						to CSS attributes that implement the styles. These are all hand-coded.
					*/
					styleTagNames = assign(Object.create(null), {
						none:         {},
						bold:         { 'font-weight': 'bold' },
						italic:       { 'font-style': 'italic' },
						underline:    { 'text-decoration': 'underline' },
						doubleunderline: { 'text-decoration': 'underline', 'text-decoration-style': 'double' },
						wavyunderline: { 'text-decoration': 'underline', 'text-decoration-style': 'wavy' },
						strike:       { 'text-decoration': 'line-through' },
						doublestrike: { 'text-decoration': 'line-through', 'text-decoration-style': 'double' },
						wavystrike:   { 'text-decoration': 'line-through', 'text-decoration-style': 'wavy' },
						superscript:  { 'vertical-align': 'super', 'font-size': '.83em' },
						subscript:    { 'vertical-align': 'sub', 'font-size': '.83em' },
						blink: {
							animation: "fade-in-out 1s steps(1,end) infinite alternate",
							// .css() handles browser prefixes by itself.
						},
						shudder: {
							animation: "shudder linear 0.1s 0s infinite",
						},
						mark: {
							'background-color': 'hsla(60, 100%, 50%, 0.6)',
						},
						condense: {
							"letter-spacing": "-0.08em",
						},
						expand: {
							"letter-spacing": "0.1em",
						},
						outline: [{
								"text-shadow"() {
									const colour = $(this).css('color');
									return "-1px -1px 0 " + colour
										+ ", 1px -1px 0 " + colour
										+ ",-1px  1px 0 " + colour
										+ ", 1px  1px 0 " + colour;
								},
							},
							{
								color() { return Utils.parentColours($(this)).backgroundColour; },
							}
						],
						shadow: {
							"text-shadow"() { return "0.08em 0.08em 0.08em " + $(this).css('color'); },
						},
						emboss: {
							"text-shadow"() { return "0.04em 0.04em 0em " + $(this).css('color'); },
						},
						smear: [{
								"text-shadow"() {
									const colour = $(this).css('color');
									return "0em   0em 0.02em " + colour + ","
										+ "-0.2em 0em  0.5em " + colour + ","
										+ " 0.2em 0em  0.5em " + colour;
								},
							},
							// Order is important: as the above function queries the color,
							// this one, eliminating the color, must run afterward.
							colourTransparent
						],
						blur: [{
								"text-shadow"() { return "0em 0em 0.08em " + $(this).css('color'); },
							},
							colourTransparent
						],
						blurrier: [{
								"text-shadow"() { return "0em 0em 0.2em " + $(this).css('color'); },
								"user-select": "none",
							},
							colourTransparent
						],
						mirror: {
							display: "inline-block",
							transform: "scaleX(-1)",
						},
						upsidedown: {
							display: "inline-block",
							transform: "scaleY(-1)",
						},
						fadeinout: {
							animation: "fade-in-out 2s ease-in-out infinite alternate",
						},
						rumble: {
							animation: "rumble linear 0.1s 0s infinite",
						},
						sway: {
							animation: "sway linear 2.5s 0s infinite",
						},
						buoy: {
							animation: "buoy linear 2.5s 0s infinite",
						},
						fidget: {
							animation() {
								return "fidget step-end 60s " + (-Math.random()*60) + "s infinite" + (Math.random()<0.5 ? " reverse" : "");
							},
						},
					});
				
				return [
					"text-style",
					(_, ...styleNames) => ChangerCommand.create("text-style", styleNames.map(Utils.insensitiveName)),
					(d, ...styleNames) => {
						for (let i = 0; i < styleNames.length; i+=1) {
							if (styleNames[i] === "none") {
								d.styles = [];
							}
							else {
								d.styles = d.styles.concat(styleTagNames[styleNames[i]]);
							}
						}
						return d;
					},
					[rest(insensitiveSet(...Object.keys(styleTagNames)))]
				];
			})()
		)

		/*d:
			(collapse:) -> Changer

			When attached to a hook, this collapses the whitespace within the hook, in the same manner as the collapsing whitespace markup.

			Example usage:
			* `(collapse:)[This text is (set:$a to 1) collapsed.]`
			* `(enchant: ?page, (collapse:))`

			Rationale:
			While the collapsing whitespace markup allows specific sections of passage prose to be collapsed, there are times when you want
			this functionality available as a changer, such as to style the whole page using (change:), or to add it to another changer.
			This macro provides that functionality.

			Details:
			Unlike most macros, this takes no values - there is only one way of collapsing whitespace (for now).

			This collapses whitespace in the same manner as the collapsing whitespace markup, so consult its documentation for more information.

			There is no way to reverse this whitespace-collapsing effect - it is permanently removed.

			When this is used with (change:) or (enchant:) to affect an existing hook, its excess whitespace will be deleted immediately, with no transition.
			Moreover, the whitespace-collapsing effect is ongoing, not just a once-off effect. This becomes clear when you consider
			the following code.
			```
			(enchant:?1, (collapse:))
			|1>["Back in time? Is this a time travel story now?"]
			(append:?1)[
				he shook his head.
			]
			```
			Because the enchantment is an ongoing effect, the text appended to ?1 will be collapsed, even though it's written outside of the collapsing hook.
			This would not occur if ?1 was a span of collapsing whitespace markup.

			Added in: 3.1.0
			#styling
		*/
		("collapse",
			() => ChangerCommand.create("collapse"),
			(d) => {
				d.attr.push({ collapsing: true });
				return d;
			},
			[]
		)

		/*d:
			(hover-style: Changer) -> Changer

			Given a style-altering changer, it makes a changer which only applies when the hook or command is hovered over
			with the mouse pointer, and is removed when hovering off.

			Example usage:
			* `(enchant:?Link, (hover-style:(text-style:'italic')))` makes each of the page's links turn italic when hovered over.
			* `(text-colour:transparent)+(hover-style:(text-color:red))[The butler] killed Marcus O'Fogarty.` makes a hook, whose
			text is normally transparent, turn white when hovered over.
			* `(hover-style:)[]`

			Rationale:
			Making text react in small visual ways when the pointer hovers over it is an old hypertext tradition. It lends a
			degree of "life" to the text, making it seem aware of the player. This feeling of life is best used to signify
			interactivity - it seems to invite the player to answer in turn, by clicking. So, adding them to (link:) commands,
			as well as interaction commands like (cycling-link:), is recommended.

			Details:
			True to its name, this macro can only be used for subtle style changes. Only the following changers (and combinations
			thereof) may be given to (hover-style:) - any others will produce an error:
			* (align:)
			* (background:)
			* (css:)
			* (font:)
			* (text-colour:)
			* (text-indent:)
			* (text-rotate-x:)
			* (text-rotate-y:)
			* (text-rotate-z:)
			* (text-style:)
			* (text-size:)
			
			More extensive mouse-based interactivity should use the (mouseover:) and (mouseout:) macros.

			This macro is not recommended for use in games or stories intended for use on touch devices, as
			the concept of "hovering" over an element doesn't really make sense with that input method.

			Note that in versions of Harlowe prior to 3.2.0, this could be combined with (link:), (link-repeat:), or (link-reveal:)
			to apply changers to the link, except for (text-colour:). This has since been changed, and now, when combined with (link:)
			changers, (hover-style:) will only apply to the revealed hook. (The intended way to style the link in that case is to provide (hover-style:) as
			the optional second value to a link changer, such as by `(link-rerun:"Retry", (hover-style:(color:red)))`.)
			Note that `(link-goto:)` and passage links aren't changers, so (hover-style:) can be attached to them, as expected.

			See also:
			(link-style:), (line-style:), (char-style:)

			Added in: 2.0.0
			#styling
		*/
		("hover-style",
			(_, changer) => {
				/*
					To verify that this changer exclusively alters the style, we run this test ChangeDescriptor through.
					(We could use changer.summary(), but we need a finer-grained look at the attr of the ChangeDescriptor.)
				*/
				const desc = ChangeDescriptor.create(),
					test = (changer.run(desc), desc.summary());

				if (test + '' !== "styles") {
					/*
						For (css:), check that only "attr" is also present, and that attr's only
						element is a {style} object.
					*/
					if (!(test.every(e => e === "styles" || e === "attr") &&
							desc.attr.every(elem => Object.keys(elem) + '' === "style"))) {
						return TwineError.create(
							"datatype",
							"The changer given to (hover-style:) must only change the hook's style."
						);
					}
				}
				return ChangerCommand.create("hover-style", [changer]);
			},
			(d, changer) => {
				d.data.hoverChanger = changer;
				/*
					This is a function instead of a bare value because of the following reason:
					when a link is inside a (hover-style:) enchanted hook, the act of clicking the
					link causes the same ChangeDescriptor to be re-run, but with the link's source
					replaced with the innerSource. As a result, when the hook is hovered over,
					its old "hover" attr gets clobbered... unless this function explicitly checks for
					and returns it.
				*/
				d.attr.push({ hover: (_, oldHover) => oldHover === undefined ? false : oldHover });
				return d;
			},
			[ChangerCommand]
		)

		/*d:
			(css: String) -> Changer
			
			This takes a string of inline CSS, and applies it to the hook, as if it
			were a HTML "style" property.
			
			Example usage:
			```
			(css: "background-color:indigo;color:white;")[What's going on? Where am I?]
			```
			
			Rationale:
			The built-in macros for layout and styling hooks, such as (text-style:),
			are powerful and geared toward ease-of-use, but do not entirely provide
			comprehensive access to the browser's styling. This changer macro allows
			extended styling, using inline CSS, to be applied to hooks.
			
			This is, however, intended solely as a "macro of last resort" - as it requires
			basic knowledge of CSS - a separate language distinct from Harlowe - to use,
			and requires it be provided a single inert string, it's not as accommodating as
			the other such macros.
			
			See also:
			(text-style:)

			Added in: 2.0.0
			#styling
		*/
		("css",
			(_, text) => {
				/*
					Add a trailing ; if one was neglected. This allows it to
					be concatenated with existing styles.
				*/
				if (!text.trim().endsWith(";")) {
					text += ';';
				}
				return ChangerCommand.create("css", [text]);
			},
			(d, text) => {
				d.attr.push({style() {
					return ($(this).attr('style') || "") + text;
				}});
				return d;
			},
			[String]
		)
		/*d:
			(test-true: ...[Any]) -> Changer

			If you want to test your passage, while ignoring a specific changer macro in it, temporarily change that
			changer macro's name to (test-true:), and it will ignore all of the data given to it, while enabling the hook.

			Example usage:
			* `(test-true: $eggs is 1)[Only one egg remaining!]` features an (if:) macro that has been temporarily changed to (test-true:).

			Rationale:
			While testing your passage, you may wish to examine what would happen if a changer, such as (if:) or (else:), were to have no effect on its hook.
			But, removing and adding the macro from your passage code may get tedious and error-prone, especially if you need to disable several such
			changers at once. Instead, you can simply temporarily change the macro's name to (test-true:), and change it back later. Regardless of what data is given
			to this macro (colour data for (background:), booleans for (if:), hooks for (replace:)), this macro won't cause an error.

			Details:
			While it will ignore all well-formed data given to it, (test-true:) will NOT suppress errors that are already present in the data.
			For instance, `(test-true: 5 + "3")[]` will still cause an error.

			If (test-true:) and another changer are added together, such as in `(test-true:)+(if:visits is 1)`, then the latter changer will take precedence and
			override it.

			See also:
			(ignore:), (test-false:)

			Added in: 3.2.0
			#debugging 2
		*/
		("test-true",
			() => ChangerCommand.create("test-true", []),
			d => d.enabled = true,
			zeroOrMore(Everything)
		)
		/*d:
			(test-false: ...[Any]) -> Changer

			If you want to test your passage in order to see what would happen if an (if:), (unless:) or (else-if:) macro would hide the hook it's attached to,
			you can temporarily change the name of the macro to (test-false:), which causes it to ignore the data given to it and act as if it was given `false`.

			Example usage:
			* `(test-false: $eggs is 1)[Only one egg remaining!]` features an (if:) macro that has been temporarily changed to (test-false:).

			Rationale:
			This is a counterpart of (test-true:), designed specifically for testing hooks with (if:), (unless:) and (else-if:) changers attached. For most
			changers, using (test-true:) is sufficient to temporarily suppress the effect of the changer. However, if you want the hook to remain
			hidden by default during the test, then using (test-true:) would still cause the hook to be displayed. While you could temporarily attach
			(hidden:) to the hook as well, this can be cumbersome, especially if that would involve adding an additional changer to a long
			sequence of changers attached to that hook. (test-false:) provides a more convenient alternative.

			Details:
			While it will ignore all well-formed data given to it, (test-false:) will NOT suppress errors that are already present in the data.
			For instance, `(test-false: 5 + "3")[]` will still cause an error.

			If (test-false:) and another changer are added together, such as in `(test-false:)+(if:visits is 1)`, then the latter changer will take precedence and
			override it.

			See also:
			(ignore:), (test-true:)

			Added in: 3.2.0
			#debugging 3
		*/
		("test-false",
			() => ChangerCommand.create("test-false", []),
			d => d.enabled = false,
			zeroOrMore(Everything)
		);

	/*
		This is NOT a changer, but a command, yet, since it uses validT8ns, it is defined in this file extraordinarily.
	*/
	/*d:
		(animate: HookName, String, [Number]) -> Command

		A command that causes a hook to briefly animate, as if a (transition:) was applied to it. The length of time that the animation plays can be optionally
		altered by providing a number.

		Example usage:
		`(when: time > 15s)[You'd better get going now, pardner. (animate:?passage's links, "rumble")]` causes all of the links in the passage to briefly
		shake using the "rumble" transition after 15 seconds have passed.

		Rationale:
		Transitions allow incoming text to animate in a visually stylish fashion, but there are times you might want already displayed text to suddenly animate,
		as if it had just transitioned in anew. This command can be useful, when used sparingly, to draw the attention of the player toward a particular part
		of the passage, such as a link, or an easily missed word, after they click a link or wait a certain amount of time. It can be particularly interesting
		when used to draw attention to a part that, until then, had nothing visually remarkable about it, so as to highlight it for only a moment.

		Details:
		(animate:) recognises the same transition names as (transition:), except for "instant" (which obviously cannot be animated). These names are:

		* "dissolve" or "fade" (causes the hook to gently fade in)
		* "flicker" (causes the hook to roughly flicker in - don't use with a long (transition-time:))
		* "shudder" (causes the hook to instantly appear while shaking back and forth)
		* "rumble" (causes the hook to instantly appear while shaking up and down)
		* "slide-right" (causes the hook to slide in from left to right)
		* "slide-left" (causes the hook to slide in from right to left)
		* "slide-up" (causes the hook to slide in from bottom to top)
		* "slide-down" (causes the hook to slide in from top to bottom)
		* "fade-right" (causes the hook to gently fade in while sliding rightward)
		* "fade-left" (causes the hook to gently fade in while sliding leftward)
		* "fade-up" (causes the hook to gently fade in while sliding upward)
		* "fade-down" (causes the hook to gently fade in while sliding downward)
		* "pulse" (causes the hook to instantly appear while pulsating rapidly)
		* "zoom" (causes the hook to scale up from the mouse pointer)
		* "blur" (causes the hook to appear from a blur)

		The optional time value, which alters the animation's length of time, corresponds to (transition-time:). Additional alterations to the animation
		can be given by attaching the other two transition changers, (transition-delay:) and (transition-skip:), to this command.

		You may notice that other, permanent animations are available as (text-style:) options. (animate:)'s animations operate separately to those,
		and animations unique to (text-style:) can't be temporarily applied with this macro. Instead, use (change:) with (text-style:) to apply those
		animations.

		See also:
		(show:), (rerun:), (transition:)

		Added in: 3.2.0
		#transitions
	*/
	Macros.addCommand
		("animate",
			$.noop,
			(cd, section, hook, transition, transitionTime) => {
				hook.forEach(section, target => {
					/*
						The "zoom" trasition continues to transition-in the element from the mouse pointer's position, even though
						a click may or may not have been used to reveal this (animate:) call. The following is
						largely copied from (transition:)'s code, above.
					*/
					let transitionOrigin;
					if (name === "zoom") {
						const {left, top} = target.offset();
						transitionOrigin = (Utils.mouseCoords.x - left) + "px " + (Utils.mouseCoords.y - top) + "px";
					}

					Utils.transitionIn(target, transition, cd.transitionTime || transitionTime, cd.transitionDelay, cd.transitionSkip, 0,
						transitionOrigin
					);
				});
			},
			[rest(HookSet), insensitiveSet(...validT8ns.innerType.filter(e => e !== "instant")), optional(positiveNumber)]);

	/*d:
		(box: String, [Number]) -> Changer

		When attached to a hook, it becomes a "box", with a given width proportional to the containing element's width,
		an optional number of lines tall, and a scroll bar if its contained text is longer than its height can contain.

		Example usage:
		* `(box:"=XX=", 1)[Chapter complete]` produces a box that's centered, 50% of the containing element's width, and 1 line tall.
		* `(box:"==X", 3)[Chapter complete]` produces a box that's right-aligned, 33% of the containing element's width, 3 lines tall.
		* `(box:"X", 7)[Chapter complete]` produces a box that takes up the full containing element's width, and 7 lines tall.
		* `(enchant: ?passage, (box:"XXX="))` enchants the passage, placing it in the left of the window.

		Rationale:

		There are times when you want to make a block of text appear to occupy an enclosed, small region with its own scroll bar,
		so that players can scroll through it separate from the rest of the passage - for instance, if it's an excerpt of some
		in-story document, or if it's a "message log" which has lots of text appended to it with (append:). This macro
		provides that ability.

		Details:
		The first value you give to this macro is a "sizing line" similar to the aligner and column markup - a sequence of zero or
		more `=` signs, then a sequence of characters (preferably "X"), then zero or more `=` signs. Think of this string as a visual
		depiction of the box's horizontal proportions - the `=` signs are the space to the left and right, and the characters in
		the middle are the box itself. If you wish to specify that the box should take up the full width, you must provide
		just a single character, like "X" - anything more will cause an error.

		The second, optional value is a height, in text lines. This size varies based on the font size of the containing element,
		which is adjustible with (text-size:) and other changers. The hook will be given a CSS `height` value of `1em` multiplied
		by the number of lines given. If you need to reposition the hook vertically, consider using (float-box:) instead. if no
		height is given, then it will use a height large enough to display all of the lines, as usual. If a non-whole number is
		given, an error will be produced.

		The "containing element" is whatever structure contains the hook. If it's inside column markup, the containing column is the
		element. If it's inside another hook (including a hook that also has (box:) attached), that hook is the element. Usually,
		however, it will just be the passage itself.

		This changer does not interact well with (align:), which also sets the horizontal placement of hooks - adding these changers
		together will cause one to override the placement of the other. (align:) will also, if center-alignment is given, force
		the hook's horizontal size to 50% of the containing element.

		If you want the box's horizontal size to be a large proportion of the available width, it may be more readable if you uniformly varied
		the characters that comprise the sizing string: `(box:"=XxxxXxxxXxxxX=", 0.25)`, for instance, makes it easier to discern that
		the box is 13/15th of the available width.

		You can use this with (change:) or (enchant:) and `?passage` to affect the placement of the passage in the page. (Note that doing so will change
		the horizontal padding of the `<tw-story>` HTML element, which is normally 20%. It will become 0%, and the `<tw-passage>`'s new margins
		will define its position on the screen.)

		The resulting hook has the CSS attributes "display:block", "overflow-y:auto", and "box-sizing:content-box". Additionally,
		the hook will have 'padding:1em', unless another padding value has been applied to it (such as via (css:)).

		See also:
		(align:), (float-box:)

		Added in: 3.2.0
		#styling
	*/
	/*d:
		(float-box: String, String) -> Changer

		When attached to a hook, it becomes a "floating box", placed at a given portion of the window, sized proportionally to the
		window's dimensions, and with a scroll bar if its contained text is longer than its height can contain.

		Example usage:
		* `(float-box: "X====","Y====")[CASH: $35,101]` produces a box that's placed in the top-left corner of the window,
		is 20% of the window's width, and 20% of the window's height.
		* `(float-box: "=XXX=","======Y")[Marvin: "Really?"]` produces a box that's placed in the middle bottom of the window,
		is 60% of the window's width, and 1/7th of the window's height.

		Rationale:
		This is a variant of (box:). There are times when you want a single block of text to be separated from the main passage's text,
		to the point where it's positioned offset from it as a separate panel - character statistics readouts in RPGs, and commentary
		asides are two possible uses. Unlike (box:), which leaves the hook in the passage, this provides that necessary spatial separation.

		Details:
		The values you give to this macro are "sizing lines" identical to those accepted by (box:) - consult its documentation for more
		information about those lines. However, while those lines scaled the hook proportional to the "containing element", (float-box:)
		scales proportional to the reader's browser window, using `vw` and `wh` CSS units. The second string references the vertical
		position and size of the hook - since (box:) cannot affect the vertical position of the hook, it only accepts a number representing
		its size.

		It's a recommended convention that the centre characters in the sizing line strings be "X" (for "X axis") for the horizontal line
		and "Y" (for "Y axis") for the vertical - but you may use whatever you wish as long as it is not a `=`.

		Since it is "floating", this box remains fixed in the window even when the player scrolls up and down.

		The resulting hook has the CSS attributes "display:block", "position:fixed" and "overflow-y:auto". Additionally, the hook will have
		'padding:1em', unless another padding value has been applied to it (such as via (css:)).

		See also:
		(align:), (box:)

		Added in: 3.2.0
		#styling
	*/

	['box','float-box'].forEach(name => Macros.addChanger(name,
		/*
			Even though these two macros differ in type signature, they have the same function bodies. The "height"
			argument is a string for one macro and a number for another, so checks are necessary to distinguish them.
		*/
		(_, widthStr, height) => {
			const widthErr = widthStr.search(geomStringRegExp) === -1
				/*
					A rather uncomfortable check needs to be made here: because widthStrs can have zero "=" signs
					on either side, and a middle portion consisting of essentially anything, the default text box
					could be confused for it, unless all 100%-width strings are prohibited to just single characters.
				*/
				|| (widthStr.length > 1 && !widthStr.includes('='));
			const heightErr = name === "float-box" && (height.search(geomStringRegExp) === -1
				|| (height.length > 1 && !height.includes('=')));
			if (widthErr || heightErr) {
				return TwineError.create("datatype", 'The (' + name + ':) macro requires a sizing line'
						+ '("==X==", "==X", "=XXXX=" etc.) be provided, not "' + (widthErr ? widthStr : height) + '".');
			}
			return ChangerCommand.create(name, [widthStr, height].filter(e => e !== undefined));
		},
		(d, widthStr, height) => {
			const {marginLeft,size} = geomParse(widthStr);
			let top;
			if (name === "float-box") {
				({marginLeft:top, size:height} = geomParse(height));
			}
			/*
				(box:)es are within flow; they use the % of the containing box (and <tw-passage> is considered
				a box). (float-box:)es are not within flow, and use "vh".
			*/
			const boxUnits = (name === "box" ? "%" : "vw");
			const styles = {
				display:        "block",
				width:           size + boxUnits,
				"max-width":     size + boxUnits,
				[name === "box" ? "margin-left" : "left"]: marginLeft + boxUnits,
				"box-sizing":   "content-box",
				"overflow-y":   "auto",
				padding() {
					const p = $(this).css('padding');
					// Chrome compat hack: instead of an empty string, unpadded elements have "0px" padding.
					return (p && p !== "0px") ? p : '1em';
				},
			};
			if (height !== undefined) {
				styles.height = height + (name === "box" ? "em" : "vh");
			}
			if (name === "float-box") {
				assign(styles, {
					position: 'fixed',
					top: top + "vh",
					/*
						Being disconnected from their parent and placed over arbitrary document regions,
						float-boxes need their own background-color.
					*/
					'background-color'() { return Utils.parentColours($(this)).backgroundColour; },
				});
			}
			d.styles.push(styles);
			return d;
		},
		[String, name === "box" ? optional(positiveInteger) : String]
	));
});
