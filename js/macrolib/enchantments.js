"use strict";
define(['jquery', 'utils', 'utils/operationutils', 'engine', 'state', 'passages', 'macros', 'datatypes/hookset', 'datatypes/codehook', 'datatypes/changercommand', 'datatypes/lambda', 'internaltypes/changedescriptor', 'internaltypes/enchantment', 'internaltypes/twineerror'],
($, Utils, {is}, Engine, State, Passages, Macros, HookSet, CodeHook, ChangerCommand, Lambda, ChangeDescriptor, Enchantment, TwineError) => {

	const {either,rest,optional} = Macros.TypeSignature;
	const {assign} = Object;
	/*
		Built-in Revision, Interaction and Enchantment macros.
		This module modifies the Macros module only, and exports nothing.
	*/

	/*
		Common function to test a changer and confirm it contains no revision macros.
	*/
	function notRevisionChanger(macroName, changer) {
		if (ChangerCommand.isPrototypeOf(changer)) {
			const summary = changer.summary();
			if (['newTargets', 'target', 'appendSource', 'functions'].some(e => summary.includes(e))) {
				return TwineError.create(
					"datatype",
					"The changer given to (" + macroName + ":) can't include a revision or enchantment changer like (replace:) or (click:)."
				);
			}
		}
	}

	/*d:
		(change: HookName or String, Changer or Lambda) -> Command

		Applies a changer (or a "via" lambda producing a changer) to every occurrence of a hook or string in a passage, once.

		Example usage:
		* `(change: "gold", (text-colour: yellow) + (text-style:'bold'))` makes all prior occurrences of "gold" in the text be bold and yellow.
		* `(change: ?passage's chars, via (text-color:(hsl: pos * 10, 1, 0.5)))` colours all of the characters in the passage in a
		rainbow pattern.

		Rationale:
		While changers allow you to style or transform certain hooks in a passage, it can be tedious and error-prone to attach them to every
		occurrence as you're writing your story, especially if the attached changers are complicated. You can
		simplify this by storing changers in short variables, and attaching just the variables, like so:
		```
		(set: _ghost to (text-style:'outline'))
		_ghost[Awoo]
		_ghost[Ooooh]
		```
		Nevertheless, this can prove undesirable: you may want to not use the _ghost styling later in development, which would
		force you to remove the attached variables to avoid producing an error; you may want to only style a single word or phrase,
		and find it inconvenient to place it in a hook; you may simply not like dedicating variables to storing changers, or in placing
		(set:) macros at the start of your passage's prose.

		Instead, you can give the hooks the name "ghost", and then (change:) them afterward like so:
		```
		|ghost>[Awoo]
		|ghost>[Ooooh]
		(change: ?ghost, (text-style:'outline'))
		```

		This has a few advantages. As it ties the changer styling to a hook name rather than a variable, the (change:) can be removed later without causing errors.
		Placing the (change:) at the end of the passage can also make the passage's source more readable, the textual content being closer to the top.

		Details:
		The (change:) macro can target plain text instead of hooks, much like (click:) - simply provide a string instead of a hook name.
		If a "via" lambda is supplied to (change:) instead of a changer, then that lambda is used to compute a changer dynamically, using the `pos` keyword
		to distinguish each hook that's enchanted. For instance, `(change: "O", via (text-style:(cond: pos is an even, 'bold', 'none')))` changes only
		even-numbered instances of the letter "O".

		Like the (replace:), (append:) and (prepend:) macros, this macro does not affect text and hooks that appear after it, as it is an immediate
		command that only affects what has already been rendered. For an alternative version of this macro which does affect hooks and text after it,
		see (enchant:).

		The built-in hook names, ?Page, ?Passage, ?Sidebar and ?Link, as well as their data names like `chars` or `lines`, can be targeted by this macro,
		and can be styled on a per-passage basis this way.

		Using (text-colour:) with this macro will let you change the colour of links inside the indicated hook, with one exception:
		using (change:) to change the entire passage (via `?passage` or `?page`) with (text-colour:) will NOT affect links. This is to allow you
		to re-style the entire story without having to lose the distinct colour of links compared to passage text. You can change the colour of all links using
		an explicit `(change: ?link, (text-colour: $color))` or by using `(link-style: (text-colour: $color))[=` (that is, with unclosed hook markup).

		You can't use this macro to change the appearance or behaviour of a completely empty hook, such as `|A>[]`. Completely empty hooks (that haven't had text inserted
		by (replace-with:) and the like) are always hidden by Harlowe.

		You can use (change:) with (transition:) to add transitions to hooks or text elsewhere in the same passage – however, if the (change:) macro is
		run after the passage was initially rendered, the transitions will begin animating in the middle of their usual animations, or, if enough time
		has passed, won't run at all. For example, `(event: when time > 2s)[(change:"Riddles", (t8n:"Shudder")+(t8n-time:3s))]` will
		apply a 3-second transition to each instance of the word "Riddles" in the passage, but since 2 seconds have already passed since those words were
		rendered, only the last 1 second of the transition will be visible.

		You cannot use (change:) with (link:), (replace:), or any of its relatives – because the enchanted hook or text is already in the passage, the link can't appear
		and it can't replace anything.

		See also:
		(enchant:), (enchant-in:), (replace:)

		Added in: 3.2.0
		#basics 17
	*/
	/*d:
		(enchant: HookName or String, Changer or Lambda) -> Command

		Applies a changer (or a "via" lambda producing a changer) to every occurrence of a hook or string in a passage, and continues
		applying that changer to any further occurrences that are made to appear in the same passage later.

		Example usage:
		* `(enchant: "gold", (text-colour: yellow) + (text-style:'bold'))` makes all occurrences of "gold" in the text be bold and yellow.
		* `(enchant: ?passage's chars, via (t8n-delay:pos * 30) + (t8n:'instant'))` causes the passage's characters to "type out" when the
		player first visits, such as in a visual novel or other such computer game. Unlike (change:), this works well with instances of
		`(click:?page)[==` later in the passage.

		Rationale:
		This is a special version of (change:) which doesn't just perform a single transformation of a set of hooks or text - rather,
		like (click:), it creates an ongoing effect that constantly checks and reapplies the changers whenever new hooks or text are inserted into
		the passage, persisting until you navigate to another passage. Consider the following:
		```
		(enchant: ?ghost, (text-style:'outline'))
		|ghost>[Awooo]
		(link:">Wait.")[|ghost>[Oooowooo]]
		```
		If this were a (change:) command, the second hook revealed by the (link:) wouldn't be affected, as it is inserted into the passage after
		it's finished rendering. The (enchant:) macro allows you to guarantee that every hook or bit of text that you want the changer to affect
		is constantly affected.

		Details:
		The (enchant:) macro takes the same values as (change:) - a string can be given instead of a hook name, and a lambda can be given instead of
		a changer. See (change:)'s article for more details about these.

		This macro works well in "header" or "footer" tagged passages - using a lot of (enchant:) commands to style certain words or parts of
		every passage, you can essentially write a "styling language" for your story, where certain hook names "mean" certain colours or
		behaviour. (This is loosely comparable to using CSS to style HTML class names, but exclusively uses macros.)

		When targeting ?Page, ?Passage and ?Sidebar, there is generally no difference between using (enchant:) and using (change:), as there (usually)
		aren't any other hooks with those names in the passage.

		Like (change:), you cannot use (enchant:) with (link:), (replace:), or any of its relatives.

		The enchantment created by this macro cannot change the appearance or behaviour of a completely empty hook, such as `|A>[]`.
		However, once a hook stops being empty (such as when the (append:) macro appends to it), the
		enchantment created by this macro will automatically start applying to it.

		See also:
		(click:), (change:), (enchant-in:)

		Added in: 2.0.0
		#basics 18
	*/
	["enchant", "change"].forEach((name) => {
		Macros.addCommand(name,
			(_, changer) => {
				const error = notRevisionChanger(name, changer);
				if (error) {
					return error;
				}
			},
			(section, scope, changer) => {
				scope = HookSet.from(scope);
				const enchantments = [];
				/*
					If the changer (and currently it must be a changer) contains innerEnchantments, then those must be added to this enchantment
					now (because ChangerCommand.update() certainly won't touch them).
				*/
				if (ChangerCommand.isPrototypeOf(changer)) {
					/*
						These two lines are similar to those used by ChangerCommand.summary().
					*/
					const desc = ChangeDescriptor.create({section});
					changer.run(desc);
					if ((desc.innerEnchantments || []).length > 0) {
						/*
							innerEnchantments contains functions that produce Enchantments. These are run
							giving this outer (enchant:)'s scope as the localHook to which the Enchantment's own scope is constrained.
						*/
						const c = desc.innerEnchantments.map(e => e(scope));
						enchantments.push(...c);
					}
				}
				enchantments.push(Enchantment.create({
					scope,
					/*
						Because the changer provided to this macro could actually be a "via" lambda that produces changers,
						Enchantment has both "lambda" and "changer" properties to distinguish them.
						We make the distinction here.
					*/
					[ChangerCommand.isPrototypeOf(changer) ? "changer" : "lambda"]: changer,
					section,
				}));
				enchantments.forEach(e => {
					if (name === "enchant") {
						section.addEnchantment(e);
						/*
							When this is run in a normal section renderInto() flow, section.updateEnchantments() will
							be run automatically after this has been executed. However, if this was run as a result of an unblocked flow
							(via (dialog:) etc.) then it still needs to be run manually here.
						*/
						section.updateEnchantments();
					}
					else {
						e.enchantScope();
					}
				});
				return "";
			},
			[either(HookSet,String), either(ChangerCommand, Lambda.TypeSignature('via'))],
			false // Can't have attachments.
		);
	});

	/*d:
		(enchant-in: HookName or String, Changer or Lambda) -> Changer

		A variation of (enchant:) and (change:), this applies a changer to every occurrence of a hook or string within just the attached hook, rather than the whole passage. As
		with (enchant:), the changer will be applied to every additional occurrence inserted into the attached hook.

		Example usage:
		```
		(enchant:?frog, (text-style:"italic"))
		"Opening remarks?"
		|frog>["Crok, crok, crok."]
		(enchant-in: ?frog, (text-colour:green))
		["Your response?"
		|frog>["Croak, croak."]
		"A stunning rebuke!"
		|frog>["Croooak."]]
		```

		Rationale:
		While (change:) and (enchant:) both allow hooks to have changers or styles applied to them, these macros produce commands that must be placed in the passage, and which
		affect every match within the passage. It can sometimes be convenient to restrict the effect of (enchant:) to just matches within a single area of prose, especially when matching
		using strings, the `?Link` hook name, or `?Page's chars`. Thus, you can use (enchant-in:), attaching it to a hook that encloses the area you want it to affect. The enchantment it
		produces will be treated as though it didn't exist outside of the attached hook.

		Details:
		You can use built-in hook data names such as `lines` and `chars` with this macro, such as by `(enchant-in: ?page's lines, $changer)`, which will style all of the lines in the attached
		hook with $changer. However, this construction appears counterintuitive when written out - the HookName selects all of the lines in the page, but only those within the attached hook are
		styled. So, more readable shorthand macros exist for both of these - (line-style:) and (char-style:) - which you ought to use instead.

		This macro takes the same values as (enchant:) and (change:), and will produce the same errors for the same values. So, (link:), (replace:), or any of its relatives cannot be given as the second
		value, and neither can a lambda that doesn't produce a changer.

		Note that this macro can only affect explicit hooks or string occurrences, and can't affect just "part" of a target. For instance, `(enchant-in: ?page, (background:red))[DANGER]` will NOT turn
		the background of the attached hook red, but `(enchant-in: ?page's lines, (background:red))[DANGER]` will (because the text "DANGER" is a line of text, and is thus targeted by `?page's lines`).

		This enchantment will be listed in the "Enchantments" tab of the Debug Mode panel when it's active, alongside enchantments created by (enchant:).

		Due to Harlowe engine limitations, this currently does NOT work when created by a lambda given to `(enchant:)` or `(change:)`, such as in `(enchant: ?passage, via (enchant-in:?frogs,(bg:(hsl:pos*30,0.5,1))))`.

		See also:
		(enchant:), (change:), (link-style:)

		Added in: 3.2.0
		#basics 19
	*/
	Macros.addChanger("enchant-in",
		(_, scope, changer) => {
			const error = notRevisionChanger('enchant-in', changer);
			if (error) {
				return error;
			}
			return ChangerCommand.create('enchant-in', [scope, changer]);
		},
		(desc, scope, changer) => {
			/*
				The 'innerEnchantments' property of ChangeDescriptors is an array of functions, in order to solves a circular dependency
				where Enchantment <- ChangeDescriptor <- Enchantment.
			*/
			desc.innerEnchantments = (desc.innerEnchantments || []).concat(localHook => Enchantment.create({
				scope: HookSet.from(scope),
				localHook,
				[ChangerCommand.isPrototypeOf(changer) ? "changer" : "lambda"]: changer,
				section: desc.section,
			}));
			return desc;
		},
		[either(HookSet,String), either(ChangerCommand, Lambda.TypeSignature('via'))]
	);
	/*d:
		(link-style: Changer or Lambda) -> Changer

		When attached to a hook, this causes all of the links inside the hook to be styled using the specified changer. This is equivalent to using (enchant-in:) with `?link`.

		Example usage:
		* `(link-style:(b4r:"dotted"))[I stepped into the (link-reveal:"hall,")[ and the door shut behind me.]]` applies the changer produced by (b4r:) to the (link-reveal:) link.
		* `(link-style:via (text-colour:(cond: pos is an even, yellow, aqua)))[You choose: [[A]] [[B]] [[C]] [[D]] [[E]].]` gives the "A", "C" and "E" links an aqua colour, and the other links a yellow colour.

		Rationale:
		Links, being the primary interactive elements in your stories, need to be visually distinguished from the passage prose surrounding them. Harlowe applies a colour
		and boldness to links by default, but you'll often want to apply your own styles to links to suit your story. Rather than manually attach a changer holding those styles to
		every link where it appears, you can instead use this macro to style several links at once.

		If you wish to style every link in the passage or story equally, using (enchant:) with `?link` in a "header" or "footer" tagged passage is most effective. But, if you only wish to apply a
		style to links in certain sections of a passage, this macro is most effective.

		Details:
		As with (enchant-in:), this can be given a changer, or a lambda that produces a changer, which is run on each link individually, and can produce different changers for each, depending on
		their `pos` or a random macro. If the lambda doesn't produce a changer, an error will result.

		Also, as with (enchant-in:), (link:), (replace:), (append-with:), or any of its relatives cannot be given to this macro.

		This creates a hook-specific enchantment, similar to (enchant-in:), It will be listed under the "Enchantments" tab of the Debug Mode panel.

		This will also apply the style changer to (click:) links inside the hook.

		Due to Harlowe engine limitations, this currently does NOT work when created by a lambda given to `(enchant:)` or `(change:)`, such as in `(enchant: ?passage, via (link-style:(bg:(hsl:pos*30,0.5,1))))`.

		See also:
		(enchant-in:), (hover-style:), (line-style:), (char-style:)

		Added in: 3.2.0
		#styling
	*/
	/*d:
		(line-style: Changer or Lambda) -> Changer

		When attached to a hook, this causes all of the lines of prose inside the hook (identical to those that would be selected by `?page's lines`) to be styled using the specified changer.

		Example usage:
		This gives every line in the attached hook a dotted border. Notice that blank "lines" aren't styled, and are ignored.
		```
		(line-style:(b4r:"dotted"))
		[Sometimes I think

		that I'm losing myself

		Other times,

		that I never had a self
		in the first place.]
		```
		This makes each line to take up 50% of the passage width, and every other line in the attached hook be right-aligned.
		```
		(line-style: via (box:"=XX=")+(align: (cond: pos is an even, "<==", "==>")))
		[Sometimes you feel like
		your mind is in one place
		and your body is in another.]
		```

		Rationale:
		This is a convenient and more readable shorthand for using (enchant-in:) with `?page's lines`. This lets you style all of the lines within a hook, as if they were in individual hooks themselves.
		This allows you to alter and adjust the amount of text inside the hook without having to manually wrap each line in a hook, or attach a changer, after each alteration.

		Details:
		A line is any run of non-whitespace text or code between line breaks (or the hook's start and end) - a word-wrapped paragraph of prose is considered a single "line" as a result.

		As with (enchant-in:), this can be given a changer, or a lambda that produces a changer, which is run on each line individually, and can produce different changers for each, depending on
		their `pos` or a random macro. If the lambda doesn't produce a changer, an error will result.

		Also, as with (enchant-in:), (link:), (replace:), or any of their relatives cannot be given to this macro.

		This creates a hook-specific enchantment, similar to (enchant-in:), It will be listed under the "Enchantments" tab of the Debug Mode panel.

		Due to Harlowe engine limitations, this currently does NOT work when created by a lambda given to `(enchant:)` or `(change:)`, such as in `(enchant: ?passage, via (line-style:(bg:(hsl:pos*30,0.5,1))))`.

		See also:
		(enchant-in:), (hover-style:), (link-style:), (char-style:)

		Added in: 3.2.0
		#styling
	*/
	/*d:
		(char-style: Changer or Lambda) -> Changer

		When attached to a hook, this causes all of the individual non-whitespace characters inside the hook (identical to those that would be selected by `?page's chars`) to be styled using the specified changer.

		Example usage:
		* `(char-style:(text-style:"fidget"))[Maybe you stayed up too late.]`
		* `(char-style: via (text-style:(either:'none','blur','blurrier')))[My memory is patchy. You'll have to fill in the gaps yourself.]`
		* `(char-style: via (text-colour:(either:red,white,white)))[Blood? What blood? You're clean as a whistle.]`

		Rationale:
		This is a convenient and more readable shorthand for using (enchant-in:) with `?page's chars`. This lets you style all of the characters within a hook, as if they were in individual hooks themselves.
		A number of strange text effects are possible with this - each character can be rotated using (text-rotate-z:), each character can have a (hover-style:), each character can have a slightly different (text-size:),
		and so forth.

		Details:
		As with (enchant-in:), this can be given a changer, or a lambda that produces a changer, which is run on each character individually, and can produce different changers for each, depending on
		their `pos` or a random macro. If the lambda doesn't produce a changer, an error will result.

		Also, as with (enchant-in:), (link:), (replace:), or any of their relatives cannot be given to this macro.

		This creates a hook-specific enchantment, similar to (enchant-in:), It will be listed under the "Enchantments" tab of the Debug Mode panel.

		**Warning:** using (char-style:) may cause text-to-speech assistive programs to fail to read the hook's contents correctly. If this would be unacceptable for you or your story, refrain from using this macro.

		**Warning:** using (char-style:) to enchant very large amounts of text at once will likely cause excessive CPU load for the reader, making their browser unresponsive.

		Due to Harlowe engine limitations, this currently does NOT work when created by a lambda given to `(enchant:)` or `(change:)`, such as in `(enchant: ?passage, via (char-style:(bg:(hsl:pos*30,0.5,1))))`.

		See also:
		(enchant-in:), (hover-style:), (link-style:), (line-style:)

		Added in: 3.2.0
		#styling
	*/
	[
		['link-style', HookSet.create({type:'name', data:'link'})],
		['line-style', HookSet.create({type:'base', data: HookSet.create({type:'name', data:'page'})}, 'lines', undefined)],
		['char-style', HookSet.create({type:'base', data: HookSet.create({type:'name', data:'page'})}, 'chars', undefined)],
	].forEach(([name, scope]) => {
		Macros.addChanger(name,
			(_, changer) => {
				const error = notRevisionChanger(name, changer);
				if (error) {
					return error;
				}
				return ChangerCommand.create(name, [changer]);
			},
			(desc, changer) => {
				/*
					The 'innerEnchantments' property of ChangeDescriptors solves a circular dependency
					where Enchantment <- ChangeDescriptor <- Enchantment.
				*/
				desc.innerEnchantments = (desc.innerEnchantments || []).concat(localHook => Enchantment.create({
					scope, localHook,
					[ChangerCommand.isPrototypeOf(changer) ? "changer" : "lambda"]: changer,
					section: desc.section,
				}));
				return desc;
			},
			[either(ChangerCommand, Lambda.TypeSignature('via'))]
		);
	});

	/*
		Revision macros produce ChangerCommands that redirect where the attached hook's
		text is rendered - usually rendering inside an entirely different hook.
	*/
	const revisionTypes = [
			/*d:
				(replace: ...HookName or String) -> Changer
				
				Creates a command which you can attach to a hook, and replace target
				destinations with the hook's contents. The targets are either text strings within
				the current passage, or hook references.

				Not to be confused with (str-replaced:).

				Example usage:

				This example changes the words "categorical catastrophe" to "**dog**egorical **dog**astrophe"
				```
				A categorical catastrophe!
				(replace: "cat")[**dog**]
				```

				This example changes the `|face>` and `|heart>` hooks to read "smile":
				```
				A |heart>[song] in your heart, a |face>[song] on your face.
				(replace: ?face, ?heart)[smile]
				```

				Rationale:
				A common way to make your stories feel dynamic is to cause their text to modify itself
				before the player's eyes, in response to actions they perform. You can check for these actions
				using macros such as (link:), (click:) or (live:), and you can make these changes using macros
				such as (replace:).

				Using (replace:) is only one way of providing this dynamism, however - the (show:) macro also
				offers similar functionality. See that macro's article for an explanation of when you might prefer
				to use it over (replace:), and vice-versa.

				Details:
				(replace:) lets you specify a target, and a block of text to replace the target with. The attached hook
				(which specifies the replacement text) will not be rendered normally - thus, you can essentially put
				(replace:) commands anywhere in the passage text without interfering much with the passage's visible text.

				If the given target is a string, then every instance of the string in the current passage is replaced
				with a copy of the hook's contents. If the given target is a hook reference, then only named hooks
				with the same name as the reference will be replaced with the hook's contents. Use named hooks when
				you want only specific places in the passage text to change.

				If the target doesn't match any part of the passage, nothing will happen. This is to allow you to
				place (replace:) commands in `footer` tagged passages, if you want them to conditionally affect
				certain named hooks throughout the entire game, without them interfering with other passages.

				(replace:) (and its variations) cannot affects hooks or text that haven't been printed yet - if the (replace:)
				runs at the same time that the passage is appearing (as in, it isn't inside a hook that's delayed (live:), (link:), (show:)
				or similar macros), and a hook or line of text appears after it in the passage, the macro won't replace its contents
				even if it's a valid target. For example: `(replace: "cool")[hot] cool water` won't work because the (replace:) runs immediately,
				but `cool water (replace: "cool")[hot]` and `(event: when time > 5)[(replace: "cool")[hot]] cool water` will.

				As a result of the above, putting these in `header` tagged passages instead of `footer` tagged passages won't
				do much good, as they are printed before the rest of the passage.

				If you wish to use (replace:) to replace a hook with a copy of its own text, to undo the effects of other
				(replace:), (append:), (prepend:) or other macros on it, consider using the (rerun:) macro instead.

				See also:
				(append:), (prepend:), (show:), (rerun:), (more:), (replace-with:)

				Added in: 1.0.0
				#revision 1
			*/
			/*d:
				(replace-with: String or CodeHook) -> Changer

				A counterpart to (append-with:) and (prepend-with:), this replaces the entirety of the attached hook with the contents of the given string (or code hook).

				Example usage:
				* `(set: $vitalInfoChanger to it + (replace-with:"**This sentence may contain mature content, so we've excised it from your mind.**"))` causes
				the changer in $vitalInfoChanger, which may have been used previously in the story, to replace the hooks' text with a censorship notification.
				* `(set: $locked to [(text-color:red)[Locked Content] - Beat the game to unlock])` creates a changer which replaces the attached hook with
				`[(text-color:red)[Locked Content] - Beat the game to unlock]`. This is mostly similar to passing the string `"(text-color:red)[Locked Content] - Beat the game to unlock"`,
				but the contents of the code hook are syntax-highlighted in the passage editor, making it easier to read. 

				Rationale:
				This changer macro may seem unintuitive and without obvious purpose - what is the point of a changer that changes a hook so drastically that
				nothing is left of its original text, and the player never sees it? However, there are some minor cases where such an effect is helpful: being able to
				pre-fill an empty hook with a given line of text not only saves you from having to write out that text multiple times (similar to saving that text
				in a variable by itself and using (print:) or a bare variable to display it), but also allows additional changers to be combined with it, and
				for (replace:), (append:) and (prepend:) macros to modify it afterward, by targeting the specific name of the attached hook. And, you can, at a
				later point in a story, add this to an existing changer to cause hooks it formerly changed to display different text content.

				Details:
				This changer, when attached to a hook, will never allow the prose it replaces to be run - `(replace-with:"")[(set:$x to 1)]` will not allow
				the enclosed (set:) macro to be run before it is replaced.

				This macro can't be used with (enchant:) or (change:) - attempting to do so will produce an error. You'll want to instead use (replace:), which
				accomplishes the same effect.

				See also:
				(append:), (prepend:), (append-with:), (prepend-with:), (show:)

				Added in: 3.2.0
				#revision 4
			*/
			"replace",
			/*d:
				(append: ...HookName or String) -> Changer

				A variation of (replace:) which adds the attached hook's contents to
				the end of each target, rather than replacing it entirely.

				Example usage:
				* `(append: "Emily", "Em")[, my maid] ` adds ", my maid " to the end of every occurrence of "Emily" or "Em".
				* `(append: ?dress)[ from happier days]` adds " from happier days" to the end of the `|dress>` hook.

				Rationale:
				As this is a variation of (replace:), the rationale for this macro can be found in
				that macro's description. This provides the ability to append content to a target, building up
				text or amending it with an extra sentence or word, changing or revealing a deeper meaning.

				See also:
				(replace:), (prepend:), (show:), (rerun:), (more:), (append-with:)

				Added in: 1.0.0
				#revision 2
			*/
			/*d:
				(append-with: String or CodeHook) -> Changer

				Creates a changer that, when attached to a hook, adds the contents of the given string (or code hook) to the end of the hook.

				Example usage:
				* `(set: $cutie to (append-with:"~♡")+(color:red+white))` creates a changer that causes any attached hook to become pink and have `~♡` at the end.
				* `(set: $dateStamp to (append-with:[<br>Posted on: $date]))` creates a changer which appends `<br>Posted on: $date` to the end of the attached hook.
				This is mostly identical to providing the string `"<br>Posted on: $date"`, but the contents of the code hook are syntax-highlighted in the passage editor, making it easier to read.
				* `(set: $mattias to (prepend-with:'MATTIAS:"')+(append-with:'"'))` creates a changer that causes any attached hook to be surrounded with `MATTIAS:"`
				and `"`, which would be useful for character dialogue.

				Rationale:
				Some lines of prose you write in your story will tend to have identical endings, be they punctuation, dialogue tags, or otherwise,
				which you may tire of repetitively writing. This macro and (prepend-with:) allow you to automatically attach text without
				having to manually write it in full - simply save this changer to a variable, and attach it to the hook. While, it should
				be noted, you can use (append:) inside of a "footer" tagged passage to also automate this hook modification, this can, at
				times, be more convenient than having to modify a separate passage. Also, this macro is especially useful
				when combined with other changers, such as (text-style:), (font:) or (text-colour:).

				Details:
				The way this changer amends the text of the hook is similar to how (append:) amends hooks. To be precise, the full text of the hook is
				rendered before it is amended with these changers. This means that, among other things, code structures can't cross the boundary between
				the appended text and the hook - `(append-with:"</b>")[<b>Bold]` will NOT work as it seems - the `<b>` tag will not be matched with the `</b>`
				in the appended text.

				Multiple (append-with:) and (prepend-with:) changers can be added together. When this combined changer is attached to a hook,
				each constituent changer is applied in left-to-right order. So, `(append-with:" (5 Favs)")+(append-with:" (2 Reblogs)")[my teeth ate themselves]`
				will result in the hook reading `my teeth ate themselves (5 Favs) (2 Reblogs)`.

				This macro can't be used with (enchant:) or (change:) - attempting to do so will produce an error. You'll want to instead use (append:) or (prepend:),
				which accomplish the same effect of amending a hook or text occurrence remotely.

				See also:
				(append:), (replace:), (prepend-with:), (replace-with:), (show:)

				Added in: 3.2.0
				#revision 5
			*/
			"append",
			/*d:
				(prepend: ...HookName or String) -> Changer

				A variation of (replace:) which adds the attached hook's contents to
				the beginning of each target, rather than replacing it entirely.

				Example usage:

				* `(prepend: "Emily", "Em")[Miss ] ` adds "Miss " to the start of every occurrence of "Emily" or "Em".
				* `(prepend: ?dress)[my wedding ]` adds "my wedding " to the start of the `|dress>` hook.

				Rationale:
				As this is a variation of (replace:), the rationale for this macro can be found in
				that macro's description. This provides the ability to prepend content to a target, adding
				preceding sentences or words to a text to change or reveal a deeper meaning.

				See also:
				(replace:), (append:), (show:), (rerun:), (more:), (prepend-with:)

				Added in: 1.0.0
				#revision 3
			*/
			/*d:
				(prepend-with: String or CodeHook) -> Changer

				Creates a changer that, when attached to a hook, adds the contents of a given string (or code hook) to the start of the hook.

				Example usage:
				* `(set: $commandPrompt to (prepend-with:">")+(font:"Courier"))` creates a changer which makes the attached hook use a monospace font, with > placed at the start.
				* `(set: $dateStamp to (prepend-with:[**$location, $date.**<br>]))` creates a changer which prepends `**$location, $date.**<br>` to the start of the attached hook.
				This is mostly identical to providing the string `"**$location, $date.**<br>"`, but the contents of the code hook are syntax-highlighted in the passage editor, making it easier to read.
				* `(set: $mattias to (prepend-with:'MATTIAS:"')+(append-with:'"'))` creates a changer that causes any attached hook to be surrounded with `MATTIAS:"`
				and `"`, which would be useful for character dialogue.

				Rationale:
				Some lines of prose you write in your story will tend to have identical beginnings, be they punctuation, dialogue tags, or otherwise,
				which you may tire of repetitively writing. This macro and (prepend-with:) allow you to automatically attach text without
				having to manually write it in full - simply save this changer to a variable, and attach it to the hook. While, it should
				be noted, you can use (prepend:) inside of a "footer" tagged passage to also automate this hook modification, this can, at
				times, be more convenient than having to modify a separate passage. Also, this macro is especially useful
				when combined with other changers, such as (text-style:), (font:) or (text-colour:).

				Details:
				The way this changer amends the text of the hook is similar to how (prepend:) amends hooks. To be precise, the full text of the hook is
				rendered before it is amended with these changers. This means that, among other things, code structures can't cross the boundary between
				the prepended text and the hook - `(prepend-with:"<b>")[Bold</b>]` will NOT work as it seems - the `<b>` tag will not be matched with the `</b>`.

				Multiple (append-with:) and (prepend-with:) changers can be added together. When this combined changer is attached to a hook,
				each constituent changer is applied in left-to-right order. So, `(prepend-with:"RE:")+(prepend-with:"FWD:")[ARE YOUR EYES UPSIDE-DOWN?]`
				will result in the hook reading `RE:FWD:ARE YOUR EYES UPSIDE-DOWN?`.

				This macro can't be used with (enchant:) or (change:) - attempting to do so will produce an error. You'll want to instead use (append:) or (prepend:),
				which accomplish the same effect of amending a hook or text occurrence remotely.

				See also:
				(append:), (replace:), (prepend-with:), (replace-with:), (show:)

				Added in: 3.2.0
				#revision 6
			*/
			"prepend"
		];
	
	revisionTypes.forEach((e) => {
		Macros.addChanger(e,
			(_, ...scopes) => {
				/*
					If a selector is empty (which means it's the empty string) then throw an error,
					because nothing can be selected.
				*/
				if (!scopes.every(Boolean)) {
					return TwineError.create("datatype",
						`A string given to this (${e}:) macro was empty.`
					);
				}
				return ChangerCommand.create(e, scopes.map(HookSet.from));
			},
			(desc, ...scopes) => {
				/*
					Now, if the source hook was outside the collapsing syntax,
					and its dest is inside it, then it should NOT be collapsed, reflecting
					its, shall we say, "lexical" position rather than its "dynamic" position.
				*/
				const collapsing = $(desc.target).parents().filter('tw-collapsed,[collapsing=true]').length > 0;
				if (!collapsing &&
						/*
							If the (collapse:) changer was already applied to this descriptor
							(such as by (collapse:)+(replace:)), then don't override it.
						*/
						!desc.attr.some(e => e.collapsing)) {
					desc.attr = [...desc.attr, { collapsing: false }];
				}
				/*
					Having done that, we may now alter the desc's target.
					We need to eliminate duplicate targets, in cases such as (replace:?1) + (replace:?1, ?2).
				*/
				desc.newTargets = (desc.newTargets || []);
				desc.newTargets.push(
					...scopes.filter(target1 => !desc.newTargets.some(
							({target:target2, append}) => is(target1, target2) && e === append
						))
						/*
							Create a newTarget object, which is a {target, append, [before]} object that pairs the revision
							method with the target. This allows "(append: ?a) + (prepend:?b)" to work on the same
							ChangeDescriptor.
							"before" is needed to ensure that these are consistently scoped to only affect targets
							before it in the passage.
						*/
						.map(target => ({target, append:e, before:true}))
				);
				return desc;
			},
			rest(either(HookSet,String))
		)
		/*
			The three (-with:) changers are implemented here, just after their "inverse phrased" counterparts.
		*/
		(e + "-with",
			(_, addendum) => ChangerCommand.create(e + "-with", [addendum]),
			(desc, addendum) => {
				/*
					The "appendSource" property of ChangeDescriptors allows multiple (append-with:)s to be
					joined together.
				*/
				/*
					If the message is a CodeHook, use its lexed code tree.
				*/
				if (CodeHook.isPrototypeOf(addendum)) {
					addendum = addendum.code;
				}
				desc.appendSource = (desc.appendSource || []).concat({source: addendum, append:e});
				return desc;
			},
			either(CodeHook, String)
		);
	});
	
	/*
		This large routine generates functions for enchantment macros, to be applied to
		Macros.addChanger().
		
		An "enchantment" is a process by which selected hooks in a passage are
		automatically wrapped in <tw-enchantment> elements that have certain styling classes,
		and can trigger the rendering of the attached TwineMarkup source when they experience
		an event.
		
		In short, it allows various words to become links etc., and do something when
		they are clicked, just by deploying a single macro instantiation! Just type
		"(click:"house")[...]", and every instance of "house" in the section becomes
		a link that does something.
		
		The enchantDesc object is a purely internal structure which describes the
		enchantment. It contains the following:
		
		* {[String]} event The DOM event (or events) that triggers the rendering of this macro's contents.
		* {String} classList The list of classes to 'enchant' the hook with, to denote that it
		is ready for the player to trigger an event on it.
		* {String} rerender Determines whether to clear the span before rendering into it ("replace"),
		append the rendering to its current contents ("append") or prepend it ("prepend").
		Only used for "combos", like (click-replace:)
		* {String} [goto] A passage to go to after rendering.
		* {Boolean} once Whether or not the enchanted DOM elements can trigger this macro
		multiple times.
		
		@method newEnchantmentMacroFns
		@param  {Function} innerFn       The function to perform on the macro's hooks
		@param  {Object}  [enchantDesc]  An enchantment description object, or null.
		@return {Function[]}             A pair of functions.
	*/
	function newEnchantmentMacroFns(enchantDesc, name) {
		/*
			Register the event that this enchantment responds to
			in a jQuery handler.
			
			Sadly, since there's no permitted way to attach a jQuery handler
			directly to the triggering element, the "actual" handler
			is "attached" via a jQuery .data() key, and must be called
			from this <tw-story> handler.
		*/
		Utils.onStartup(() => {

			const classList = enchantDesc.classList.replace(/ /g, ".");
			const blockClassList = enchantDesc.blockClassList ? enchantDesc.blockClassList.replace(/ /g, ".") : '';
			const selector = "." + classList + (blockClassList ? ",." + blockClassList : '');

			Utils.storyElement.on(
				/*
					Put this event in the "enchantment" jQuery event
					namespace, solely for personal tidiness.
				*/
				enchantDesc.event.map(e => e + ".enchantment").join(' '),
				selector,
				function generalEnchantmentEvent(e) {
					/*
						The debug "open" buttons shouldn't activate enchantments.
					*/
					if ($(e.target).is('tw-open-button')) {
						return;
					}
					/*
						When multiple <tw-enchantment>s wrap the same element, they wrap it outward-to-inward
						first-to-last. So, we should execute the outermost enchantment first, as it is first
						in the passage code order.
					*/
					const enchantment = $(Array.from($(this).parents(selector).add(this))
						// compareDocumentPosition mask 8 means "contains".
						.sort((left, right) => (left.compareDocumentPosition(right)) & 8 ? 1 : -1)
						[0]
					);
					/*
						Run the actual event handler.
					*/
					const event = enchantment.data('enchantmentEvent');

					if (event) {
						event(enchantment);
					}
				}
			);
		});
		
		/*
			Return the macro function AND the ChangerCommand function.
			Note that the macro function's "selector" argument
			is that which the author passes to it when invoking the
			macro (in the case of "(macro: ?1)", selector will be "?1").
		*/
		return [
			(_, selector, changer) => {
				/*
					If the selector is empty (which means it's the empty string) then throw an error,
					because nothing can be selected.
				*/
				if (!selector) {
					return TwineError.create("datatype", "A string given to this (" + name + ":) macro was empty.");
				}
				/*
					For the optional second argument, perform the same changer type-check used for (enchant:).
				*/
				if (changer) {
					const error = notRevisionChanger(name, changer);
					if (error) {
						return error;
					}
				}
				return ChangerCommand.create(name, [HookSet.from(selector)].concat(changer ? [changer] : []));
			},
			/*
				This ChangerCommand registers a new enchantment on the Section that the
				ChangeDescriptor belongs to.
				
				It must perform the following tasks:
				1. Silence the passed-in ChangeDescriptor.
				2. Create an enchantment for the hooks selected by the given selector.
				3. Affix an enchantment event function (that is, a function to run
				when the enchantment's event is triggered) to the <tw-enchantment> elements.
				
				You may notice some of these are side-effects to a changer function's
				proper task of altering a ChangeDescriptor. Alas...
			*/
			function makeEnchanter(desc, selector, changer) {
				/*
					Prevent the target's source from running immediately.
					This is unset when the event is finally triggered.
				*/
				desc.enabled = false;
				/*
					As with links, any transitions on (click:), (mouseover:) or (mouseout:) are applied only to
					the hook when it eventually appears, not the interaction element.
				*/
				desc.transitionDeferred = true;
				
				/*
					If a rerender method was specified, then this is a "combo" macro,
					which will render its hook's code into a separate target.
					
					Let's modify the descriptor to use that target and render method.
					(Yes, the name "rerender" is #awkward.)
				*/
				if (enchantDesc.rerender) {
					desc.newTargets = (desc.newTargets || [])
						.concat({ target: selector, append: enchantDesc.rerender });
				}
				/*
					As these are deferred rendering macros, the current tempVariables
					object must be stored for reuse, as the section pops it when normal rendering finishes.
				*/
				const tempVariables =
					/*
						The only known situation when there is no section is when this is being run by
						ChangerCommand.summary(). In that case, the tempVariables will never be used,
						so a bare object can just be provided.
					*/
					(desc.section && desc.section.stackTop) ? desc.section.stackTop.tempVariables : Object.create(null);

				/*
					This enchantData object is stored in the descriptor's Section's enchantments
					list, to allow the Section to easily enchant and re-enchant this
					scope whenever its DOM is altered (e.g. words matching this enchantment's
					selector are added or removed from the DOM).
				*/
				const enchantData = Enchantment.create({
					functions: [
						target => {
							/*
								If the target <tw-enchantment> wraps a "block" element (currently defined as just
								<tw-story>, <tw-sidebar>, <tw-passage> or "display:block" elements) then use the enchantDesc's
								blockClassList instead of its classList. This is used to give (click: ?page)
								a different styling than just turning the entire passage text into a link.
							*/
							target.attr('class',
								target.children().is("tw-story, tw-sidebar, tw-passage") || target.children().css('display') === "block"
								? enchantDesc.blockClassList
								: enchantDesc.classList
							);
							/*
								Include the tabIndex so that they can also be clicked using the keyboard.
							*/
							target.attr({ tabIndex: '0' });
						}
					],
					data: {
						enchantmentEvent() {
							/*
								First, don't do anything if control flow in the section is currently blocked
								(which means the click/mouseover input should be dropped).

								Note that this currently (October 2021) does not allow enchantment events to fire
								even within a (dialog:) or other element which blocks control flow.
							*/
							if (desc.section.stackTop && desc.section.stackTop.blocked) {
								return;
							}
							if (enchantDesc.once) {
								/*
									Remove this enchantment from the Section's list.
								*/
								desc.section.removeEnchantment(enchantData);
							}
							/*
								If the enchantDesc has a "goto" property, then instead of filling the
								target with the source, go to the named passage (whose existence
								has already been verified).
							*/
							if (enchantDesc.goto) {
								Engine.goToPassage(enchantDesc.goto, {
									transition: enchantDesc.transition,
								});
								return;
							}
							/*
								If the enchantDesc has an "undo" property, then instead of filling the
								target with the source, undo the current turn.
							*/
							if (enchantDesc.undo) {
								Engine.goBack({ transition: enchantDesc.transition, });
								return;
							}
							/*
								At last, the target originally specified
								by the ChangeDescriptor can now be filled with the
								ChangeDescriptor's original source.
								
								By passing the desc as the third argument,
								all its values are assigned, not just the target.
								The second argument may be extraneous. #awkward
							*/
							desc.section.renderInto(
								desc.source,
								null,
								assign({}, desc, {
									// (click-rerun:) replaces (re-runs) the attached hook on each iteration,
									// instead of simply appending to it.
									append: !enchantDesc.once ? 'replace' : 'append',
									enabled: true,
									/*
										Turn transitions back on, so that the target
										can use them (given that the interaction element did not).
									*/
									transitionDeferred: false,
								}),
								tempVariables
							);
						},
					},
					scope: selector,
					section: desc.section,
					/*
						This name is used exclusively by Debug Mode.
					*/
					name,
					/*
						The optional changer/lambda argument leverages the same Enchantment functionality as (enchant:).
					*/
					[ChangerCommand.isPrototypeOf(changer) ? "changer" : "lambda"]: changer,
				});
				/*
					Add the above object to the section's enchantments (unless, of course, this was called by summary()).
				*/
				if (desc.section) {
					desc.section.addEnchantment(enchantData);
					/*
						Enchant the scope for the first time.
					*/
					enchantData.enchantScope();
				}
				return desc;
			},
			[either(HookSet,String), optional(either(ChangerCommand, Lambda.TypeSignature('via')))]
		];
	}

	/*
		A browser compatibility check for touch events (which suggest a touchscreen). If true, then mouseover and mouseout events
		should have "click" added.
	*/
	const hasTouchEvents = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);

	/*
		Interaction macros produce ChangerCommands that defer their attached
		hook's rendering, and enchantment a target hook, waiting for the
		target to be interacted with and then performing the deferred rendering.
	*/
	const interactionTypes = [
		/*d:
			(click: HookName or String, [Changer or Lambda]) -> Changer

			Produces a changer which, when attached to a hook, hides it and enchants the specified target, such that
			it visually resembles a link, and that clicking it causes the attached hook to be revealed.

			Example usage:
			```
			There is a small dish of water. (click: "dish")[Your finger gets wet.]
			```

			Rationale:

			The (link:) macro and its variations lets you make passages more interactive, by adding links that display text when
			clicked. However, it can often greatly improve your passage code's readability to write a macro call that's separate
			from the text that it affects. You could want to write an entire paragraph, then write code that makes certain words
			into links, without interrupting the flow of the prose in the editor.

			The (click:) macro lets you separate text and code in this way. Place (click:) hooks at the end of your passages, and have
			them affect named hooks, or text strings, earlier in the passage.

			Details:

			Text or hooks targeted by a (click:) macro will be styled in a way that makes them indistinguishable from passage links,
			and links created by (link:). When any one of the targets is clicked, this styling will be removed and the hook attached to the
			(click:) will be displayed.

			Additionally, if a (click:) macro is removed from the passage, then its targets will lose the link styling and no longer be
			affected by the macro.

			You can add further styling to the "links" produced by (click:) by providing an optional changer or "via" lambda as a second value, similar to (link:)'s optional
			changer. If a "via" lambda is supplied, then that lambda is used to compute a changer dynamically, based on specifics of
			each hook that's enchanted, similar to lambdas provided to (enchant:).

			Targeting ?Page, ?Passage or ?Sidebar:

			When a (click:) command is targeting the ?Page, ?Passage or ?Sidebar, instead of transforming the entire passage text into
			a link, something else will occur: a blue link-coloured border will surround the area, and
			the mouse cursor (on desktop browsers) will resemble a hand no matter what it's hovering over.

			Clicking a link when a (click:) is targeting the ?Page or ?Passage will cause both the link and the (click:) to
			activate at once.

			Using multiple (click:) commands to target the ?Page or ?Passage will require multiple clicks from the
			player to activate all of them. They activate in the order they appear on the page - top to bottom.

			See also:
			(link:), (link-reveal:), (mouseover:), (mouseout:), (replace:), (click-replace:)

			Added in: 1.0.0
			#links 9
		*/
		/*d:
			(click-rerun: HookName or String, [Changer or Lambda]) -> Changer

			A special version of the (click:) macro which allows the enchanted hook or text (specified by the first value) to be activated multiple times to re-run the attached hook.

			Example usage:
			```
			The only place you haven't searched yet is the washing basket, and you know there's nothing to find in there.

			(set:_t to 0)\
			(click-rerun:"washing basket")[(set:_t to it+1)You pull out (nth:_t, "two left socks","a tie-dyed tie","a thimble","a laced tablecloth"). Just in case it was under there.]
			```

			Rationale:
			While the (click:) macro lets you add links to your text without placing lots of macro code in the middle of your prose, there isn't
			an obvious way of creating a repeatable link, similar to (link-rerun:) or using (link:) with (rerun:), in the same way. This macro provides that functionality.

			Details:
			This changes the enchanted text into a link in the same way as (click:). As with most link macros, you may style the link by providing a changer (or a lambda
			producing a changer) as the second value.

			See also:
			(link-rerun:), (click:), (rerun:)

			Added in: 3.3.0
			#links 10
		*/
		{
			name: "click",
			enchantDesc: {
				event    : ["click"],
				once     : true,
				rerender : "",
				classList: "link enchantment-link",
				blockClassList: "enchantment-clickblock",
			}
		},
		/*d:
			(mouseover: HookName or String, [Changer or Lambda]) -> Changer

			A variation of (click:) that, instead of showing the hook when the target is clicked, shows it
			when the mouse pointer merely hovers over it. The target is also styled differently (with a dotted underline),
			to denote this hovering functionality.

			Example usage:
			```
			|1>[Hey, c'mover here, cutie.]
			(mouseover:?1)[Wanna merge brains over this printer cable?]
			```

			Rationale:

			(click:) and (link:) can be used to create links in your passage that reveal text or, in conjunction with
			other macros, transform the text in myriad ways. This macro is exactly like (click:), except that instead of
			making the target a link, it makes the target reveal the hook when the mouse hovers over it. This can convey
			a mood of fragility and spontaneity in your stories, of text reacting to the merest of interactions.

			Details:

			This macro is subject to the same rules regarding the styling of its targets that (click:) has, so
			consult (click:)'s details to review them. Note, though, that rather than making its targets appear as links, it instead,
			by default, applies a dotted border around them.

			You can add further styling to the targets by providing an optional changer or "via" lambda as a second value, similar to (link:)'s optional
			changer. If a "via" lambda is supplied, then that lambda is used to compute a changer dynamically, based on specifics of
			each hook that's enchanted, similar to lambdas provided to (enchant:).

			This macro is not recommended for use in games or stories intended for use on touch devices, as
			the concept of "hovering" over an element doesn't really make sense with that input method. In the event
			that a story using this macro is played on a touch device, this macro will fall back to simply being activated
			by clicking/touching.

			Targeting ?Page, ?Passage or ?Sidebar:

			When a (mouseover:) command is targeting the ?Passage or ?Sidebar, a dotted border will surround the area, and the hook will
			run when the pointer hovers over that area, as expected.

			While you can also target ?Page with this macro, the result won't be that interesting: if the mouse pointer is anywhere
			on the page, it will immediately run.

			See also:
			(link:), (link-reveal:), (link-repeat:), (click:), (mouseout:), (replace:), (mouseover-replace:), (hover-style:)

			Added in: 1.0.0
			#links 14
		*/
		{
			name: "mouseover",
			enchantDesc: {
				event    : ["mouseenter", hasTouchEvents ? "click" : ""].filter(Boolean),
				once     : true,
				rerender : "",
				classList: "enchantment-mouseover",
				blockClassList: "enchantment-mouseoverblock"
			}
		},
		/*d:
			(mouseout: HookName or String, [Changer or Lambda]) -> Changer

			A variation of (click:) that, instead of showing the hook when the target is clicked, shows it
			when the mouse pointer moves over it, and then leaves. The target is also styled differently (a translucent cyan frame),
			to denote this hovering functionality.

			Example usage:
			```
			|1>[CORE OVERRIDE]
			(mouseout:?1)[Core overridden. The programs are going wild.]
			```

			Rationale:

			(click:) and (link:) can be used to create links in your passage that reveal text or, in conjunction with
			other macros, transform the text in myriad ways. This macro is exactly like (click:), but rather than
			making the target a link, it makes the target reveal the hook when the mouse stops hovering over it.
			This is very similar to clicking, but is subtly different, and conveys a sense of "pointing" at the element to
			interact with it rather than "touching" it. You can use this in your stories to give a dream-like or unearthly
			air to scenes or places, if you wish.

			Details:

			This macro is subject to the same rules regarding the styling of its targets that (click:) has, so
			consult (click:)'s details to review them.

			You can add further styling to the targets by providing an optional changer or "via" lambda as a second value, similar to (link:)'s optional
			changer. If a "via" lambda is supplied, then that lambda is used to compute a changer dynamically, based on specifics of
			each hook that's enchanted, similar to lambdas provided to (enchant:).

			This macro is not recommended for use in games or stories intended for use on touch devices, as
			the concept of "hovering" over an element doesn't really make sense with that input method. In the event
			that a story using this macro is played on a touch device, this macro will fall back to simply being activated
			by clicking/touching.

			Targeting ?Page, ?Passage or ?Sidebar:

			When a (mouseover:) command is targeting the ?Passage or ?Sidebar, a solid border will surround the area. When the mouse pointer enters it,
			the area will turn translucent cyan until the pointer leaves, whereupon the hook will run, as expected.

			While you can also target ?Page with this macro, the result won't be that interesting: the macro will only run when the pointer
			leaves the page altogether, such as by proceeding to another browser tab. Additionally, the translucent cyan background won't be present.
			
			See also:
			(link:), (link-reveal:), (link-repeat:), (click:), (mouseover:), (replace:), (mouseout-replace:), (hover-style:)

			Added in: 1.0.0
			#links 19
		*/
		{
			name: "mouseout",
			enchantDesc: {
				event    : ["mouseleave", hasTouchEvents ? "click" : ""].filter(Boolean),
				once     : true,
				rerender : "",
				classList: "enchantment-mouseout",
				blockClassList: "enchantment-mouseoutblock"
			}
		}
	];
	
	interactionTypes.forEach((e) => {
		Macros.addChanger(e.name, ...newEnchantmentMacroFns(e.enchantDesc, e.name));
		/*
			Only (click:) gets a (rerun:) variant.
		*/
		if (e.name === "click") {
			Macros.addChanger(e.name + '-rerun', ...newEnchantmentMacroFns(assign({}, e.enchantDesc, { once: false }), e.name + '-rerun'));
		}
	});

	/*
		A separate click event needs to be defined for an .enchantment-clickblock wrapping <tw-story>, which is explained below.
	*/
	Utils.onStartup(() => {
		interactionTypes.forEach(({enchantDesc}) => {
			if (enchantDesc.blockClassList) {
				Utils.storyElement.on(
					/*
						Put this event in the "enchantment" jQuery event namespace, alongside the other enchantment events.
					*/
					enchantDesc.event.map(e => e + ".enchantment").join(' '),
					/*
						Since this event is on <tw-story>, it can't select its parent in a selector. So, that parent
						must be selected in the function.
					*/
					function(e) {
						/*
							The debug "open" buttons shouldn't activate enchantments.
						*/
						if ($(e.target).is('tw-open-button')) {
							return;
						}
						/*
							When multiple <tw-enchantment>s wrap the same element, they wrap it outward-to-inward
							first-to-last. So, we should execute the outermost enchantment first, as it is first
							in the passage code order.
						*/
						const enchantment = $(Array.from($(this).parents('.' + enchantDesc.blockClassList.replace(/ /g, ".")))
							// compareDocumentPosition mask 8 means "contains".
							.sort((left, right) => (left.compareDocumentPosition(right)) & 8 ? 1 : -1)
							[0]
						);
						/*
							Run the actual event handler.
						*/
						const event = enchantment.data('enchantmentEvent');

						if (event) {
							event(enchantment);
						}
					}
				);
			}
		});
	});
	
	/*
		Combos are shorthands for interaction and revision macros that target the same hook:
		for instance, (click: ?1)[(replace:?1)[...]] can be written as (click-replace: ?1)[...]
	*/
	/*d:
		(click-replace: HookName or String, [Changer or Lambda]) -> Changer

		A special shorthand combination of the (click:) and (replace:) macros, this allows you to make a hook
		replace its own text with that of the attached hook whenever it's clicked. `(click: ?1)[(replace:?1)[...]]`
		can be rewritten as `(click-replace: ?1)[...]`.

		Example usage:
		```
		My deepest secret.
		(click-replace: "secret")[longing for you]
		```

		See also:
		(click-prepend:), (click-append:)

		Added in: 1.0.0
		#links 10
	*/
	/*d:
		(click-append: HookName or String, [Changer or Lambda]) -> Changer

		A special shorthand combination of the (click:) and (append:) macros, this allows you to append
		text to a hook or string when it's clicked. `(click: ?1)[(append:?1)[...]]`
		can be rewritten as `(click-append: ?1)[...]`.

		Example usage:
		```
		I have nothing to fear.
		(click-append: "fear")[ but my own hand]
		```

		See also:
		(click-replace:), (click-prepend:)

		Added in: 1.0.0
		#links 11
	*/
	/*d:
		(click-prepend: HookName or String, [Changer or Lambda]) -> Changer

		A special shorthand combination of the (click:) and (prepend:) macros, this allows you to prepend
		text to a hook or string when it's clicked. `(click: ?1)[(prepend:?1)[...]]`
		can be rewritten as `(click-prepend: ?1)[...]`.

		Example usage:
		```
		Who stands with me?
		(click-prepend: "?")[ but my shadow]
		```

		See also:
		(click-replace:), (click-append:)

		Added in: 1.0.0
		#links 12
	*/
	/*d:
		(mouseover-replace: HookName or String, [Changer or Lambda]) -> Changer

		This is similar to (click-replace:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-replace:).

		Example usage:
		```
		You can't touch me!
		(mouseover-replace: ?passage)[Aah! That tickles!]
		```

		See also:
		(mouseover-prepend:), (mouseover-append:)

		Added in: 1.0.0
		#links 15
	*/
	/*d:
		(mouseover-append: HookName or String, [Changer or Lambda]) -> Changer

		This is similar to (click-append:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-append:).

		Example usage:
		```
		You reach into the box...
		(mouseover-append: "box...")[ ...and pull out the final jewel.]
		```

		See also:
		(mouseover-prepend:), (mouseover-replace:)

		Added in: 1.0.0
		#links 16
	*/
	/*d:
		(mouseover-prepend: HookName or String, [Changer or Lambda]) -> Changer

		This is similar to (click-prepend:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-prepend:).

		Example usage:
		```
		#THE END
		(mouseover-prepend: "END")[(REAL) ]
		```

		See also:
		(mouseover-replace:), (mouseover-append:)

		Added in: 1.0.0
		#links 17
	*/
	/*d:
		(mouseout-replace: HookName or String, [Changer or Lambda]) -> Changer

		This is similar to (click-replace:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-replace:).

		Example usage:
		```
		You kiss her on the lips.
		(mouseout-replace: "lips")[mouth that once sneered so cruelly at you.]
		```

		See also:
		(mouseout-prepend:), (mouseout-append:)

		Added in: 1.0.0
		#links 20
	*/
	/*d:
		(mouseout-append: HookName or String, [Changer or Lambda]) -> Changer

		This is similar to (click-append:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-append:).

		Example usage:
		```
		Hold my hand.
		(mouseout-append: "hand.")[
		Thank you.]
		```

		See also:
		(mouseout-prepend:), (mouseout-replace:)

		Added in: 1.0.0
		#links 21
	*/
	/*d:
		(mouseout-prepend: HookName or String, [Changer or Lambda]) -> Changer

		This is similar to (click-prepend:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-prepend:).

		Example usage:
		```
		Touch my cheek.
		(mouseout-prepend: "cheek")[bristly, unshaven ]
		```

		See also:
		(mouseout-append:), (mouseout-replace:)

		Added in: 1.0.0
		#links 22
	*/
	revisionTypes.forEach((revisionType) => {
		interactionTypes.forEach((interactionType) => {
			const enchantDesc = assign({}, interactionType.enchantDesc, {
					rerender: revisionType
				}),
				name = interactionType.name + "-" + revisionType;
			Macros.addChanger(name, ...newEnchantmentMacroFns(enchantDesc, name));
		});
	});
	/*d:
		(click-goto: HookName or String, String) -> Command

		A special shorthand combination of the (click:) and (go-to:) macros, this allows you to make a hook
		or bit of text into a passage link. `(click-goto: ?1, 'Passage Name')` is equivalent to `(click: ?1)[(goto:'Passage Name')]`

		Example usage:
		```
		Time to get in your crimchair, plug in your crimphones, power up your crimrig and your crimgrip - the next page in your crimming career awaits.
		(click-goto: "crim", "Test")
		```

		Details:
		This construction differs from simply nesting (go-to:) in a hook, as in `(click:?page)[(goto:"Stonehenge")]` in one important respect: you can
		attach the (t8n-depart:) and (t8n-arrive:) changers to the (click-goto:) command, such as by `(t8n-depart:"dissolve")(click-goto:?page, "Stonehenge")`,
		and the passage transition will be applied when you click the indicated area. In the former construction, you'd have to attach the (t8n-depart:) and (t8n-arrive:)
		macros to the interior (go-to:) command rather than the (click:) command.

		See also:
		(link-goto:), (mouseover-goto:), (mouseout-goto:)

		Added in: 3.0.0
		#links 11
	*/
	/*d:
		(mouseover-goto: HookName or String, String) -> Command

		This is similar to (click-goto:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-goto:).

		Example usage:
		```
		Wait... what's |2>[over there?]
		(mouseover-goto: ?2, "Test")
		```

		See also:
		(link-goto:), (click-undo:), (mouseout-goto:)

		Added in: 3.0.0
		#links 16
	*/
	/*d:
		(mouseout-goto: HookName or String, String) -> Command

		This is similar to (click-goto:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-goto:).

		Example usage:
		```
		You sink your head into your pillow.
		(mouseout-goto:"pillow", "Test")
		```

		See also:
		(link-goto:), (click-undo:), (mouseover-goto:)

		Added in: 3.0.0
		#links 21
	*/
	/*d:
		(click-undo: HookName or String) -> Command

		A special shorthand combination of the (click:) and (undo:) macros, this allows you to make a hook
		or bit of text into a passage link. `(click-undo: ?1)` is equivalent to `(click: ?1)[(undo: )]`

		Example usage:
		`You might have gotten yourself into a pickle that only time travel can get you out of. (click-undo: ?page)`

		Details:
		This will, of course, cause an error if it's encountered on the first turn of the game (when there's nothing to undo).

		You can attach the (t8n-depart:) and (t8n-arrive:) changers to (click-undo:), such as by `(t8n-depart:"dissolve")(click-undo:?page)`,
		and the passage transition will be applied when you click the indicated area. In the former construction, you'd have to attach the (t8n-depart:) and (t8n-arrive:)
		macros to the interior (undo:) command rather than the (click:) command.

		See also:
		(link-undo:), (mouseover-undo:), (mouseout-undo:)

		Added in: 3.2.0
		#links 11
	*/
	/*d:
		(mouseover-undo: HookName or String, String) -> Command

		This is similar to (click-undo:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-undo:).

		Example usage:
		```
		Now isn't the time to think about that. Look!
		(mouseover-undo:"Look!")
		```

		See also:
		(link-undo:), (click-undo:), (mouseout-undo:)

		Added in: 3.2.0
		#links 16
	*/
	/*d:
		(mouseout-undo: HookName or String, String) -> Command

		This is similar to (click-undo:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-undo:).

		Example usage:
		```
		You sink your face into your partner's shoulder.
		(mouseout-undo:"your partner's shoulder")
		```

		See also:
		(link-undo:), (click-undo:), (mouseover-undo:)

		Added in: 3.2.0
		#links 21
	*/
	interactionTypes.forEach((interactionType) => {
		['goto','undo'].forEach(type => {
			const name = interactionType.name + "-" + type;
			Macros.addCommand(name,
				(selector, passage) => {
					/*
						If either of the arguments are the empty string, show an error.
					*/
					if (!selector || (!passage && type === 'goto')) {
						return TwineError.create("datatype", "A string given to this (" + name + ":) macro was empty.");
					}
					/*
						First, of course, check for the passage's existence.
					*/
					if (type === "goto" && !Passages.hasValid(passage)) {
						return TwineError.create("macrocall",
							"I can't (" + name + ":) the passage '" + passage + "' because it doesn't exist."
						);
					}
				},
				(desc, section, selector, passage) => {
					if (type === 'undo' && State.pastLength < 1) {
						return TwineError.create("macrocall", "I can't (undo:) on the first turn.");
					}
					/*
						Now, newEnchantmentMacroFns() is only designed to return functions for use with addChanger().
						What this kludge does is take the second changer function, whose signature is (descriptor, selector),
						and then call it in TwineScript_Print() when the command is run, passing in a fake ChangeDescriptor
						with only a "section" property.
					*/
					const [,makeEnchanter] = newEnchantmentMacroFns(assign({}, interactionType.enchantDesc,
						{ transition: desc.data.passageT8n, },
						type === "undo" ? { undo: true } : { goto: passage }
					), name);
					makeEnchanter({section}, HookSet.from(selector));
					return assign(desc, { source: '' });
				},
				[either(HookSet,String)].concat(type === "undo" ? [] : String)
			);
		});
	});
});
