"use strict";
define(['jquery','macros', 'utils', 'utils/selectors', 'datatypes/colour', 'datatypes/gradient', 'datatypes/changercommand', 'datatypes/lambda', 'internaltypes/changedescriptor', 'internaltypes/twineerror'],
($, Macros, Utils, Selectors, Colour, Gradient, ChangerCommand, Lambda, ChangeDescriptor, TwineError) => {

	/*
		Built-in hook style changer macros.
		These produce ChangerCommands that apply CSS styling to their attached hooks.
		
		This module modifies the Macros module only, and exports nothing.
	*/
	/*d:
		Changer data
		
		Changer commands (changers) are similar to ordinary commands, but they only have an effect when they're attached to hooks,
		passage links and commands, and modify them in some manner. Macros that work like this include (text-style:), (font:),
		(t8n:), (text-rotate:), (hook:), (click:), (link:), (for:), (if:), and more.

		```
		(if: $sawDuckHarbinger)[You still remember spying the black duck, harbinger of doom.]
		(t8n-depart: "dissolve")[[Return to the present]]
		```

		You can save changer commands into variables, and re-use them many times in your story:
		```
		(set: $robotic to (font:'Courier New'))
		$robotic[Hi, it's me. Your clanky, cold friend.]
		```
		Alternatively, you may prefer to use the (enchant:) macro to accomplish the same thing using only hook names:
		```
		|robotic>[Hi, it's me. Your clanky, cold friend.]
		(enchant: ?robotic, (font:'Courier New'))
		```
		Changers can be combined using the `+` operator: `(text-colour: red) + (font: "Courier New")[This text is red Courier New.]`
		styles the text using both changers at once. These combined changers, too, can be saved in variables or used with (enchant:).
		```
		(set: _alertText to (font:"Courier New") + (text-style: "shudder")+(text-colour:"#e74"))
		_alertText[Social alert: no one read the emails you sent yesterday.]
		_alertText[Arithmetic error: I forgot my seven-times-tables.]
		```
	*/
	const
		{either, wrapped, optional, Any, zeroOrMore, rest, insensitiveSet, positiveNumber, nonNegativeNumber} = Macros.TypeSignature,
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
	const validT8ns = ["instant", "dissolve", "rumble", "shudder", "pulse", "flicker", "slideleft", "slideright", "slideup", "slidedown"];
	const validBorders = ['dotted','dashed','solid','double','groove','ridge', 'inset','outset','none'];
	Macros.addChanger
		/*d:
			(if: Boolean) -> Changer
			
			This macro accepts only booleans, and produces a command that can be attached to hooks
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
			a command that can be attached hooks to hide them "if" the value was true.
			
			For more information, see the documentation of (if:).

			Added in: 1.0.0
			#basics 7
		*/
		("unless",
			(_, expr) => ChangerCommand.create("unless", [!expr]),
			(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(else-if: Boolean) -> Changer
			
			This macro's result changes depending on whether the previous hook in the passage
			was shown or hidden. If the previous hook was shown, then this command hides the attached
			hook. Otherwise, it acts like (if:), showing the attached hook if it's true, and hiding it
			if it's false. If there was no preceding hook before this, then an error message will be printed.

			Example usage:
			```
			Your stomach makes {
			(if: $size is 'giant')[
			    an intimidating rumble! You'll have to eat plenty of trees.
			](else-if: $size is 'big')[
			    a loud growl. You're hungry for some shrubs.
			](else:​)[
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

			Produces a command that can be attached to hooks to hide them.

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
			Numbers given to macros such as `(live:)` can be suffixed with `ms` or `s` to indicate whether you mean milliseconds or
			seconds (see the article on number data for more information). If you give a bare number, the macro interprets it as milliseconds.

			Live hooks will continue to re-render themselves until they encounter and print a (stop:) macro. (stop:) should be used
			whenever you don't need to keep the hook "live", to save on processing and passage repainting (which can interfere
			with clicking, selecting text, and other interactions).

			If you want to just display a hook once a certain thing happens (that is, when the condition in an (if:) macro becomes
			true) and then (stop:), then the (event:) macro may be shorter and easier to use for this.

			Currently, you **cannot** attach (live:) to a command (such as in `(live:2s)(link-goto:"?")`). You have to wrap the command
			in a hook (such as `(live:2s)[(link-goto:"?")]`).

			See also:
			(event:)

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
			(live:)

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
			#live 4
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
						filter: section => {
							return section.eval("Operations").Identifiers.exits !== 0 ? [] : [true];
						},
					},
				};
			},
			null
		)

		/*d:
			(hook: String) -> Changer
			A command that allows the author to give a hook a computed tag name.
			
			Example usage:
			`(hook: $name)[]`
			
			Rationale:
			You may notice that it isn't possible to attach a nametag to hooks with commands
			already attached - in the case of `(font:"Museo Slab")[The Vault]<title|`, the nametag results
			in an error. This command can be added with other commands to allow the hook to be named:
			`(font:"Museo Slab")+(hook: "title")`.
			
			Furthermore, unlike the nametag syntax, (hook:) can be given any string expression:
			`(hook: "eyes" + (string:$eyeCount))` is valid, and will, as you'd expect, give the hook
			the name of `eyes1` if `$eyeCount` is 1.

			See also:
			(hidden:)

			Added in: 1.0.0
			#styling
		*/
		("hook",
			(_, name) => ChangerCommand.create("hook", [name]),
			(d, name) => d.attr.push({name: name}),
			[String]
		)

		/*d:
			(for: Lambda, [...Any]) -> Changer
			Also known as: (loop:)

			A command that repeats the attached hook, setting a temporary variable to a different value on each repeat.

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

			As it is a changer macro, (for:)'s value is a changer command which can be stored in a variable - this command stores all
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
				return ChangerCommand.create("for", [lambda, args]);
			},
			(d, lambda, args) => {
				const loopVars = lambda.filter(d.section, args);
				let error;
				if ((error = TwineError.containsError(loopVars))) {
					return error;
				}
				d.loopVars[lambda.loop] = loopVars || [];
			},
			[Lambda.TypeSignature('where'), zeroOrMore(Any)]
		)

		/*d:
			(transition: String) -> Changer
			Also known as: (t8n:)
			
			A command that applies a built-in CSS transition to a hook as it appears.
			
			Example usage:
			`(t8n: "pulse")[Gleep!]` makes the hook `[Gleep!]` use the "pulse" transition
			when it appears.
			
			Details:
			At present, the following text strings will produce a particular transition:
			* "instant" (causes the hook to instantly appear)
			* "dissolve" (causes the hook to gently fade in)
			* "flicker" (causes the hook to roughly flicker in - don't use with a long (transition-time:))
			* "shudder" (causes the hook to instantly appear while shaking back and forth)
			* "rumble" (causes the hook to instantly appear while shaking up and down)
			* "slide-right" (causes the hook to slide in from the right)
			* "slide-left" (causes the hook to slide in from the left)
			* "slide-top" (causes the hook to slide in from the top)
			* "slide-bottom" (causes the hook to slide in from the bottom)
			* "pulse" (causes the hook to instantly appear while pulsating rapidly)
			
			All transitions are 0.8 seconds long, unless a (transition-time:) command is added
			to the command.

			You can't combine transitions by adding them together, like you can with (text-style:) -
			`(t8n:"dissolve")+(t8n:"shudder")` won't make a transition that simultaneously dissolve-fades and shudders.

			See also:
			(text-style:), (transition-time:), (transition-delay:), (transition-skip:)

			Added in: 1.0.0
			#transitions 1
		*/
		(["transition", "t8n"],
			(_, name) => ChangerCommand.create("transition", [Utils.insensitiveName(name)]),
			(d, name) => {
				d.transition     = name;
				return d;
			},
			[insensitiveSet(...validT8ns)]
		)

		/*d:
			(transition-time: Number) -> Changer
			Also known as: (t8n-time:)
			
			A command that, when added to a (transition:) command, adjusts the time of the transition.

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
					for hooks AND links. This is bearable because the likelihood of a link needing its own timed
					transition and a differently-timed passage transition should be low (and can be worked around
					using wrapper hooks anyway).
				*/
				d.data.t8nTime       = time;
				return d;
			},
			[positiveNumber]
		)
		/*d:
			(transition-delay: Number) -> Changer
			Also known as: (t8n-delay:)
			
			A command that, when added to a (transition:) command, delays the start of the transition by a given time.

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
			
			A command that, when added to a (transition:) command, allows the player to skip or accelerate the transition by
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
			The number given is an amount of milliseconds (or seconds, if specified) to advance the transition. For each
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
			* "dissolve" (causes the passage to gently fade out)
			* "flicker" (causes the passage to roughly flicker in - don't use with a long (transition-time:)))
			* "shudder" (causes the passage to disappear while shaking back and forth)
			* "rumble" (causes the passage to instantly appear while shaking up and down)
			* "slide-right" (causes the passage to slide in from the right)
			* "slide-left" (causes the passage to slide in from the left)
			* "pulse" (causes the passage to disappear while pulsating rapidly)

			Attaching this macro to a hook that isn't a passage link won't do anything (no error message will be produced).

			You can't combine transitions by adding them together, like you can with (text-style:) -
			`(t8n-depart:"dissolve")+(t8n-depart:"shudder")` won't make a transition that simultaneously dissolve-fades and shudders.

			See also:
			(transition-arrive:)

			Added in: 3.0.0
			#transitions 4
		*/
		(["transition-depart", "t8n-depart"],
			(_, name) => ChangerCommand.create("transition-depart", [Utils.insensitiveName(name)]),
			(d, name) => {
				d.data.t8nDepart = name;
				return d;
			},
			[insensitiveSet(...validT8ns)]
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
			* "dissolve" (causes the passage to gently fade out)
			* "flicker" (causes the passage to roughly flicker out - don't use with a long (transition-time:))
			* "shudder" (causes the passage to disappear while shaking back and forth)
			* "rumble" (causes the passage to instantly appear while shaking up and down)
			* "slide-right" (causes the passage to slide in from the right)
			* "slide-left" (causes the passage to slide in from the left)
			* "pulse" (causes the passage to disappear while pulsating rapidly)

			Attaching this macro to a hook that isn't a passage link won't do anything (no error message will be produced).

			You can't combine transitions by adding them together, like you can with (text-style:) -
			`(t8n-depart:"dissolve")+(t8n-depart:"shudder")` won't make a transition that simultaneously dissolve-fades and shudders.

			See also:
			(transition-depart:)

			Added in: 3.0.0
			#transitions 5
		*/
		(["transition-arrive", "t8n-arrive"],
			(_, name) => ChangerCommand.create("transition-arrive", [Utils.insensitiveName(name)]),
			(d, name) => {
				d.data.t8nArrive = name;
				return d;
			},
			[insensitiveSet(...validT8ns)]
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

			*`(border: "solid", "dotted", "dashed", "double")` provides all four sides.
			*`(border: "solid", "dotted", "dashed")` stops at the bottom edge, so the left edge will use "dotted", to match
			the right edge.
			*`(border: "solid", "dotted")` stops at the right edge, so the bottom edge will use "solid", to match
			the top edge, and the left edge will use "dotted", to match the right edge.
			*`(border: "solid")` causes all of the edges to use "solid".

			This macro affects the style of the border, and accepts the following border names:

			| String | Example
			|---
			| "none" | Example text
			| "solid" | <span style="border: 8px solid black;margin:2px;display:inline-block">Example text</span>
			| "dotted" | <span style="border: 8px dotted black;margin:2px;display:inline-block">Example text</span>
			| "dashed" | <span style="border: 8px dashed black;margin:2px;display:inline-block">Example text</span>
			| "double" | <span style="border: 8px double black;margin:2px;display:inline-block">Example text</span>
			| "groove" | <span style="border: 8px groove black;margin:2px;display:inline-block">Example text</span>
			| "ridge" | <span style="border: 8px ridge black;margin:2px;display:inline-block">Example text</span>
			| "inset" | <span style="border: 8px inset black;margin:2px;display:inline-block">Example text</span>
			| "outset" | <span style="border: 8px outset black;margin:2px;display:inline-block">Example text</span>

			The "none" type can be used to remove a border that another changer may have included.

			The default size of the border, with no other CSS changes to any elements, is 8px (8 pixels),
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
					"display"() {
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
						return this.style.borderWidth || '8px';
					},
				});
				return d;
			},
			[insensitiveSet(...validBorders), ...Array(3).fill(optional(insensitiveSet(...validBorders)))]
		)

		/*d:
			(border-size: Number, [Number], [Number], [Number]) -> Changer
			Also known as: (b4r-size:)

			When applied to a hook being changed by the (border:) changer, this multiplies the size
			of the border by a given amount.

			Example usage:
			`(b4r:"solid")+(b4r-size:1/8)[Do not read anything outside of this box.]`

			Details:

			The border macros accept up to four values. These values refer to *sides of a rectangle*, going clockwise
			from the top: the first value is the **top** edge (12 o'clock), second is the **right** edge (3 o'clock),
			third is the **bottom** edge (6 o'clock), fourth is the **left** edge (9 o'clock). You can stop giving
			values anywhere. If an edge doesn't have a value, then it will use whatever the opposite edge's value is
			(or the top value if it's the only one).

			The default size of borders added using (border:) is 8px (8 pixels). The number given is multiplied
			by 8 to produce the new size (in CSS pixels). If a number lower than 0 is given, an error will be produced.

			See also:
			(border:), (corner-radius:), (text-size:)

			Added in: 3.2.0
			#borders 3
		*/
		(["border-size","b4r-size"],
			(_, ...widths) => ChangerCommand.create("border-size", widths),
			(d, ...widths) => {
				d.styles.push({ "border-width": widths.map(width => (width*8) + "px").join(' ') });
				return d;
			},
			[nonNegativeNumber, ...Array(3).fill(optional(nonNegativeNumber))]
		)

		/*d:
			(corner-radius: Number, [Number], [Number], [Number]) -> Changer

			When applied to a hook, this rounds the corners, causing the hook to become
			increasingly round or button-like.

			Example usage:
			```
			(b4r:'solid')+(corner-radius:1)[Hasn't this gone on too long?]
			(b4r:'solid')+(corner-radius:2)[Shouldn't you tell them the truth?]
			(b4r:'solid')+(corner-radius:6)[//That you're not really who you say you are??//]
			```

			Details:
			The border macros accept up to four values. These values refer to *sides of a rectangle*, going clockwise
			from the top: the first value is the **top** edge (12 o'clock), second is the **right** edge (3 o'clock),
			third is the **bottom** edge (6 o'clock), fourth is the **left** edge (9 o'clock). You can stop giving
			values anywhere. If an edge doesn't have a value, then it will use whatever the opposite edge's value is
			(or the top value if it's the only one).

			Obviously, unless the hook has a (background:) or a (border:), the rounded corners will not be visible, and this
			changer will have no real effect.

			If the hook has a (border:), values greater than the border's (border-width:) (which is 1 if it wasn't changed)
			will cause the interior of the element to become constrained by the curvature of the corners, as the
			rectangle's corners get cut off. Because of this, this macro also adds a slight amount of interior
			padding (distance between the border and the contained text) equal to 1px (1 pixel) multiplied by the
			passed-in number, unless another changer (such as (css:)) provided a different padding value.

			See also:
			(border:), (background:), (border-size:)

			Added in: 3.2.0
			#borders 4
		*/
		("corner-radius",
			(_, ...radii) => ChangerCommand.create("corner-radius", radii),
			(d, ...radii) => {
				d.styles.push({
					"border-radius": radii.map(r => (r*8) + "px").join(' '),
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
			`(b4r-color:magenta)+(b4r:"ridge")[LEVEL 01: DREAM WORLD]`
			`(b4r-color:red,yellow,green,blue)+(b4r:"dotted")[Isn't it a lovely time?]`

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
			(font: String) -> Changer
			
			This styling command changes the font used to display the text of the attached hook. Provide
			the font's family name (such as "Helvetica Neue" or "Courier") as a string.

			Example usage:
			`(font:"Skia")[And what have we here?]`

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
			
			This styling command changes the alignment of text in the attached hook, as if the
			`===>`~ arrow syntax was used. In fact, these same arrows (`==>`~, `=><=`~, `<==>`~, `====><=`~ etc.)
			should be supplied as a string to specify the degree of alignment.

			Example usage:
			`(align: "=><==")[Hmm? Anything the matter?]`

			Details:
			Hooks affected by this command will take up their own lines in the passage, regardless of
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
					style = Object.assign({
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

			This styling command changes the colour used by the text in the attached hook.
			You can supply either a string with a CSS-style colour (a colour name or
			RGB number supported by CSS), or a built-in colour object.

			Example usage:
			`(colour: red + white)[Pink]` combines the built-in red and white colours to make pink.
			`(colour: #696969)[Gray]` uses a CSS-style colour to style the text gray.

			Details:
			This macro only affects the text colour. To change the text background, call upon
			the (background:) macro.

			This macro will change the colour of links inside the contained hook, with one exception:
			using (enchant:) to enchant the entire passage (via `?passage` or `?page`) with (text-colour:)
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
			(_, CSScolour) => {
				/*
					Convert TwineScript CSS colours to bad old hexadecimal.
					This is important as it enables the ChangerCommand to be serialised
					as a string more easily.
				*/
				if (Colour.isPrototypeOf(CSScolour)) {
					CSScolour = CSScolour.toRGBAString(CSScolour);
				}
				return ChangerCommand.create("text-colour", [CSScolour]);
			},
			(d, CSScolour) => {
				d.styles.push({'color': CSScolour});
				return d;
			},
			[either(String, Colour)]
		)
		/*d:
			(text-size: Number) -> Changer
			Also known as: (size:)

			This styling command changes the text size of the attached hook by the given fraction.
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
			(text-rotate: Number) -> Changer

			This styling command visually rotates the attached hook clockwise by a given number of
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
			(text-style:)

			Added in: 1.0.0
			#styling
		*/
		("text-rotate",
			(_, rotation) => ChangerCommand.create("text-rotate", [rotation]),
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
			(background: Colour or String or Gradient) -> Changer

			This styling command alters the background colour or background image
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
			
			Combining two (background:) commands will do nothing if they both influence the
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
		("background",
			(_, value) => {
				//Convert TwineScript CSS colours to bad old hexadecimal.
				if (Colour.isPrototypeOf(value)) {
					value = value.toRGBAString(value);
				}
				//Convert TwineScript gradients into CSS linear-gradients.
				else if (Gradient.isPrototypeOf(value)) {
					value = value.toLinearGradientString(value);
				}
				return ChangerCommand.create("background", [value]);
			},
			(d, value) => {
				let property;
				/*
					Different kinds of values can be supplied to this macro
				*/
				if (Colour.isHexString(value) || Colour.isCSS3Function(value)) {
					property = {"background-color": value};
				}
				else if (value.startsWith('linear-gradient(')) {
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
					property = {"background-size": "cover", "background-image":"url(" + value + ")"};
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
			
			This applies one or more selected built-in text styles to the hook's text.
			
			Example usage:
			* `The shadow (text-style: "shadow")[flares] at you!` will style the word "flares" with a shadow.
			* `(set: $s to (text-style: "shadow")) The shadow $s[flares] at you!` will also style it with a shadow.
			* `(text-style: "italic", "emboss")[Richard Donahue, King for Hire]` makes the text italic and embossed.
			
			Rationale:
			While Twine offers markup for common formatting styles like bold and italic, having these
			styles available from a command macro provides some extra benefits: it's possible, as with all
			such style macros, to (set:) them into a variable, combine them with other commands, and re-use them
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
			| "underline"      | <t-s style="text-decoration: underline"></t-s> | "strike"
			| "strike"         | <t-s style="text-decoration: line-through"></t-s> | "underline"
			| "superscript"    | <t-s style="vertical-align:super;font-size:.83em"></t-s> | "subscript"
			| "subscript"      | <t-s style="vertical-align:sub;font-size:.83em"></t-s> | "superscript"
			| "mark"           | <t-s style="background-color: hsla(60, 100%, 50%, 0.6)"></t-s> | (background-color:)
			| "outline"        | <t-s style="color:white; text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px  1px 0 black, 1px  1px 0 black"></t-s> | "shadow", "emboss", "blur", blurrier", "smear"
			| "shadow"         | <t-s style="text-shadow: 0.08em 0.08em 0.08em black"></t-s> | "outline", "emboss", "blur", "blurrier", "smear"
			| "emboss"         | <t-s style="text-shadow: 0.08em 0.08em 0em black"></t-s> | "outline", "shadow", "blur", "blurrier", "smear"
			| "condense"       | <t-s style="letter-spacing:-0.08em"></t-s> | "expand"
			| "expand"         | <t-s style="letter-spacing:0.1em"></t-s> | "condense"
			| "blur"           | <t-s style="text-shadow: 0em 0em 0.08em black; color:transparent"></t-s> | "outline", "shadow", "emboss", "blurrier", "smear"
			| "blurrier"       | <t-s style="text-shadow: 0em 0em 0.2em black; color:transparent"></t-s> | "outline", "shadow", "emboss", "blur", "smear"
			| "smear"          | <t-s style="text-shadow: 0em 0em 0.02em black, -0.2em 0em 0.5em black, 0.2em 0em 0.5em black; color:transparent"></t-s> | "outline", "shadow", "emboss", "blur", "blurrier"
			| "mirror"         | <t-s style="display:inline-block;transform:scaleX(-1)"></t-s> | "upside-down"
			| "upside-down"    | <t-s style="display:inline-block;transform:scaleY(-1)"></t-s> | "mirror"
			| "blink"          | <t-s style="animation:fade-in-out 1s steps(1,end) infinite alternate"></t-s> | "fade-in-out", "rumble", "shudder", "sway", "buoy"
			| "fade-in-out"    | <t-s style="animation:fade-in-out 2s ease-in-out infinite alternate"></t-s> | "blink", "rumble", "shudder", "sway", "buoy"
			| "rumble"         | <t-s style="display:inline-block;animation:rumble linear 0.1s 0s infinite"></t-s> | "blink", "fade-in-out", "shudder", "sway", "buoy"
			| "shudder"        | <t-s style="display:inline-block;animation:shudder linear 0.1s 0s infinite"></t-s> | "blink", "fade-in-out", "rumble", "sway", "buoy"
			| "sway"           | <t-s style="display:inline-block;animation:sway 5s linear 0s infinite"></t-s> | "blink", "fade-in-out", "rumble", "shudder", "buoy"
			| "buoy"           | <t-s style="display:inline-block;animation:buoy 5s linear 0s infinite"></t-s> | "blink", "fade-in-out", "rumble", "shudder", "sway"
			
			You can use the "none" style to remove an existing style from a combined changer.

			Due to browser limitations, combining many of these changers won't work exactly as intended – `(text-style: "underline", "strike")`, for instance,
			will cause only the latter of the two to be applied, in this case "strike". These incompatibilities are listed in the table above.
			
			Also due to browser limitations, hooks using "mirror", "upside-down", "sway", "buoy", "rumble" or "shudder" will have its CSS `display`
			attribute set to `inline-block`.

			Note that the animations of "rumble" and "shudder" are particularly intense, and may induce frustration or illness in
			motion-sensitive readers. Take care when using them.

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
					styleTagNames = Object.assign(Object.create(null), {
						none:         {},
						bold:         { 'font-weight': 'bold' },
						italic:       { 'font-style': 'italic' },
						underline:    { 'text-decoration': 'underline' },
						strike:       { 'text-decoration': 'line-through' },
						superscript:  { 'vertical-align': 'super', 'font-size': '.83em' },
						subscript:    { 'vertical-align': 'sub', 'font-size': '.83em' },
						blink: {
							animation: "fade-in-out 1s steps(1,end) infinite alternate",
							// .css() handles browser prefixes by itself.
						},
						shudder: {
							animation: "shudder linear 0.1s 0s infinite",
							display: "inline-block",
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
							"text-shadow"() { return "0.08em 0.08em 0em " + $(this).css('color'); },
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
							display: "inline-block",
						},
						sway: {
							animation: "sway linear 2.5s 0s infinite",
							display: "inline-block",
						},
						buoy: {
							animation: "buoy linear 2.5s 0s infinite",
							display: "inline-block",
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
			(hover-style: Changer) -> Changer

			Given a style-altering changer, it makes a changer which only applies when the hook or expression is hovered over
			with the mouse pointer, and is removed when hovering off.

			Example usage:
			The following makes a (link:) that turns italic when the mouse hovers over it.
			```
			(hover-style:(text-style:'italic'))+(link:"The lake")
			[The still, cold lake.]
			```

			Rationale:
			Making text react in small visual ways when the pointer hovers over it is an old hypertext tradition. It lends a
			degree of "life" to the text, making it seem aware of the player. This feeling of life is best used to signify
			interactivity - it seems to invite the player to answer in turn, by clicking. So, adding them to (link:) changers,
			instead of just bare words or paragraphs, is highly recommended.

			Details:
			True to its name, this macro can only be used for subtle style changes. Only the following changers (and combinations
			thereof) may be given to (hover-style:) - any others will produce an error:
			* (align:)
			* (background:)
			* (css:)
			* (font:)
			* (text-colour:)
			* (text-rotate:)
			* (text-style:)
			* (text-size:)
			
			More extensive mouse-based interactivity should use the (mouseover:) and (mouseout:) macros.

			This macro is not recommended for use in games or stories intended for use on touch devices, as
			the concept of "hovering" over an element doesn't really make sense with that input method.

			See also:
			(mouseover:), (mouseout:)

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
			
			Usage example:
			```
			(css: "background-color:indigo")
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
		;

	/*d:
		(box: String, Number) -> Changer

		When attached to a hook, it becomes a "box", with a given width proportional to the containing element's width,
		a given number of lines tall, and a scroll bar if its contained text is longer than its height can contain.

		Example usage:
		* `(box:"=XX=", 1)[Chapter complete]` produces a box that's centered, 50% of the containing element's width, and 1 line tall.
		* `(box:"==X", 3)[Chapter complete]` produces a box that's right-aligned, 33% of the containing element's width, 3 lines tall.
		* `(box:"X", 7)[Chapter complete]` produces a box that takes up the full containing element's width, and 7 lines tall.

		Rationale:

		There are times when you want to make a block of text appear to occupy an enclosed, small region with its own scroll bar,
		so that players can scroll through it separate from the rest of the passage - for instance, if it's an excerpt of some
		in-story document, or if it's a "message log" which has lots of text appended to it with (append:). This macro
		provides that ability.

		Details:
		The first value you give to this macro is a "sizing line" similar to the aligner and column markup - a sequence of zero or
		more `=` signs, then a sequence of characters (preferably "X"), then zero or more `=` signs. Think of this string as a visual
		depiction of the box's horizontal proportions - the `=` signs are the space to the left and right, and the characters in
		the middle are the box itself.

		The second value is a height, in text lines. This size varies based on the font size of the containing element,
		which is adjustible with (text-size:) and other changers. The hook will be given a CSS `height` value of `1em` multiplied
		by the number of lines given. If you need to reposition the hook vertically, consider using (float-box:) instead.

		The "containing element" is whatever structure contains the hook. If it's inside column markup, the containing column is the
		element. If it's inside another hook (including a hook that also has (box:) attached), that hook is the element. Usually,
		however, it will just be the passage itself.

		This changer does not interact well with (align:), which also sets the horizontal placement of hooks - adding these changers
		together will cause one to override the placement of the other. (align:) will also, if center-alignment is given, force
		the hook's horizontal size to 50% of the containing element.

		If you want the box's horizontal size to be a large proportion of the available width, it may be more readable if you uniformly varied
		the characters that comprise the sizing string: `(box:"=XxxxXxxxXxxxX=", 0.25)`, for instance, makes it easier to discern that
		the box is 13/15th of the available width.

		You can use this with (enchant:) and `?passage` to affect the placement of the passage in the page.

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
	const geomStringRegExp = /^(=*)([^=]+)=*$/;
	const geomParse = str => {
		const length = str.length;
		const [matched, left, inner] = (geomStringRegExp.exec(str) || []);
		if (!matched) {
			return {marginLeft:0, size:0};
		}
		return {marginLeft: (left.length/length)*100, size: (inner.length/length)*100};
	};

	['box','float-box'].forEach(name => Macros.addChanger(name,
		/*
			Even though these two macros differ in type signature, they have the same function bodies. The "height"
			argument is a string for one macro and a number for another, so checks are necessary to distinguish them.
		*/
		(_, widthStr, height) => {
			const widthErr = widthStr.search(geomStringRegExp) === -1;
			const heightErr = (name === "float-box" && height.search(geomStringRegExp) === -1);
			if (widthErr || heightErr) {
				return TwineError.create("datatype", 'The (' + name + ':) macro requires a sizing line'
						+ '("==X==", "==X", "=XXXX=" etc.) be provided, not "' + (widthErr ? widthStr : height) + '".');
			}
			if (name === "box" && (height <= 0)) {
				return TwineError.create("datatype", 'The (' + name + ':) macro requires a positive number, not '
					+ height + '.');
			}
			return ChangerCommand.create(name, [widthStr, height]);
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
				[name === "box" ? "margin-left" : "left"]: marginLeft + boxUnits,
				height:          height + (name === "box" ? "em" : "vh"),
				"box-sizing":   "content-box",
				"overflow-y":   "auto",
				padding() { return $(this).css('padding') || '1em'; },
			};
			if (name === "float-box") {
				Object.assign(styles, {
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
		[String, name === "box" ? Number : String]
	));
});
