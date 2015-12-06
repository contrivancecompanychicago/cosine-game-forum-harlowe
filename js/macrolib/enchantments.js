define(['jquery', 'utils', 'macros', 'datatypes/hookset', 'datatypes/changercommand', 'internaltypes/enchantment'],
($, Utils, Macros, HookSet, ChangerCommand, Enchantment) => {
	"use strict";

	const {either} = Macros.TypeSignature;
	/*
		Built-in Revision, Interaction and Enchantment macros.
		This module modifies the Macros module only, and exports nothing.
	*/

	/*
		This experimental (enchant:) macro is currently just for testing purposes.
	*/
	Macros.add("enchant",
		(section, changer, scope) => ({
			TwineScript_ObjectName: "an (enchant:) command",
			TwineScript_TypeName:   "an (enchant:) command",
			TwineScript_Print() {
				const enchantment = Enchantment.create({
					scope: section.selectHook(scope),
					changer,
				});
				section.enchantments.push(enchantment);
				enchantment.enchantScope();
				return "";
			},
		}),
		[ChangerCommand, either(HookSet,String)]
	);

	/*
		Revision macros produce ChangerCommands that redirect where the attached hook's
		text is rendered - usually rendering inside an entirely different hook.
	*/
	const revisionTypes = [
			/*d:
				(replace: [HookName or String]) -> Changer
				
				Creates a command which you can attach to a hook, and replace a target
				destination with the hook's contents. The target is either a text string within
				the current passage, or a hook reference.

				Example usage:

				This example changes the words "categorical catastrophe" to "**dog**egorical **dog**astrophe"
				```
				A categorical catastrophe!
				(replace: "cat")[**dog**]
				```

				This example changes the `|face>` hook to read "smile":
				```
				A song in your heart, a |face>[song] on your face.
				(replace: ?face)[smile]
				```

				Rationale:
				A common way to make your stories feel dynamic is to cause their text to modify itself
				before the player's eyes, in response to actions they perform. You can check for these actions
				using macros such as (link:), (click:) or (live:), and you can make these changes using macros
				such as (replace:).

				Details:
				(replace:) lets you specify a target, and a block of text to replace the target with. The attached hook
				will not be rendered normally - thus, you can essentially place (replace:) commands anywhere in the passage
				text without interfering much with the passage's visible text.

				If the given target is a string, then every instance of the string in the current passage is replaced
				with a copy of the hook's contents. If the given target is a hook reference, then only named hooks
				with the same name as the reference will be replaced with the hook's contents. Use named hooks when
				you want only specific places in the passage text to change.

				If the target doesn't match any part of the passage, nothing will happen. This is to allow you to
				place (replace:) commands in `header` tagged passages, if you want them to conditionally affect
				certain named hooks throughout the entire game, without them interfering with other passages.

				See also:
				(append:), (prepend:)

				#revision
			*/
			"replace",
			/*d:
				(append: [HookName or String]) -> Changer

				A variation of (replace:) which adds the attached hook's contents to
				the end of each target, rather than replacing it entirely.

				Example usage:
				* `(append: "Emily")[, my maid] ` adds ", my maid " to the end of every occurrence of "Emily".
				* `(append: ?dress)[ from happier days]` adds " from happier days" to the end of the `|dress>` hook.

				Rationale:
				As this is a variation of (replace:), the rationale for this macro can be found in
				that macro's description. This provides the ability to append content to a target, building up
				text or amending it with an extra sentence or word, changing or revealing a deeper meaning.

				See also:
				(replace:), (prepend:)

				#revision
			*/
			"append",
			/*d:
				(prepend: [HookName or String]) -> Changer

				A variation of (replace:) which adds the attached hook's contents to
				the beginning of each target, rather than replacing it entirely.

				Example usage:

				* `(prepend: "Emily")[Miss ] ` adds "Miss " to the start of every occurrence of "Emily".
				* `(prepend: ?dress)[my wedding ]` adds "my wedding " to the start of the `|dress>` hook.

				Rationale:
				As this is a variation of (replace:), the rationale for this macro can be found in
				that macro's description. This provides the ability to prepend content to a target, adding
				preceding sentences or words to a text to change or reveal a deeper meaning.

				See also:
				(replace:), (append:)

				#revision
			*/
			"prepend"
		];
	
	revisionTypes.forEach((e) => {
		Macros.addChanger(e,
			(_, scope) => ChangerCommand.create(e, [scope]),
			(desc, scope) => {
				/*
					Now, if the source hook was outside the collapsing syntax,
					and its dest is inside it, then it should NOT be collapsed, reflecting
					its, shall we say, "lexical" position rather than its "dynamic" position.
					In order to obtain this information, though, we need the obscure jQuery
					context property, to obtain the original target's .context (which was
					set in the findAndFilter() call inside renderInto() in section).
					I don't like having to touch this API surface, but it has to be done, I guess.
				*/
				const collapsing = $(desc.target.context).parents().filter('tw-collapsed').length > 0;
				if (!collapsing) {
					desc.attr = [...desc.attr, { collapsing: false }];
				}
				/*
					Having done that, we may now alter the desc's target.
				*/
				desc.target = scope;
				desc.append = e;
				return desc;
			},
			either(HookSet,String)
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
		
		* {String} event The DOM event that triggers the rendering of this macro's contents.
		* {String} classList The list of classes to 'enchant' the hook with, to denote that it
		is ready for the player to trigger an event on it.
		* {String} rerender Determines whether to clear the span before rendering into it ("replace"),
		append the rendering to its current contents ("append") or prepend it ("prepend").
		Only used for "combos", like click-replace().
		* {Boolean} once Whether or not the enchanted DOM elements can trigger this macro
		multiple times.
		
		@method newEnchantmentMacroFns
		@param  {Function} innerFn       The function to perform on the macro's hooks
		@param  {Object}  [enchantDesc]  An enchantment description object, or null.
		@return {Function[]}             A pair of functions.
	*/
	function newEnchantmentMacroFns(enchantDesc, name) {
		// enchantDesc is a mandatory argument.
		Utils.assert(enchantDesc);
		
		/*
			Register the event that this enchantment responds to
			in a jQuery handler.
			
			Sadly, since there's no permitted way to attach a jQuery handler
			directly to the triggering element, the "actual" handler
			is "attached" via a jQuery .data() key, and must be called
			from this <html> handler.
		*/
		$(() => {
			Utils.storyElement.on(
				/*
					Put this event in the "enchantment" jQuery event
					namespace, solely for personal tidiness.
				*/
				enchantDesc.event + ".enchantment",
			
				// This converts a HTML class attribute into a CSS selector
				"." + enchantDesc.classList.replace(/ /g, "."),
			
				function generalEnchantmentEvent() {
					const enchantment = $(this),
						/*
							Run the actual event handler.
						*/
						event = enchantment.data('enchantmentEvent');
				
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
			(_, selector) => {
				/*
					If the selector is a HookRef (which it usually is), we must unwrap it
					and extract its plain selector string, as this ChangerCommand
					could be used far from the hooks that this HookRef selects,
					and we'll need to re-run the desc's section's selectHook() anyway.
				*/
				if (selector.selector) {
					selector = selector.selector;
				}
				return ChangerCommand.create(name, [selector]);
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
			function makeEnchanter(desc, selector) {
				/*
					Prevent the target's source from running immediately.
					This is unset when the event is finally triggered.
				*/
				desc.enabled = false;
				
				/*
					If a rerender method was specified, then this is a "combo" macro,
					which will render its hook's code into a separate target.
					
					Let's modify the descriptor to use that target and render method.
					(Yes, the name "rerender" is #awkward.)
				*/
				if (enchantDesc.rerender) {
					desc.target = selector;
					desc.append = enchantDesc.rerender;
				}
				
				/*
					This enchantData object is stored in the descriptor's Section's enchantments
					list, to allow the Section to easily enchant and re-enchant this
					scope whenever its DOM is altered (e.g. words matching this enchantment's
					selector are added or removed from the DOM).
				*/
				const enchantData = Enchantment.create({
					attr: Object.assign({
							class: enchantDesc.classList,
						},
						/*
							Include the tabIndex for link-type enchantments, so that they
							can also be clicked using the keyboard.
						*/
						enchantDesc.classList.includes("link") ? { tabIndex: '0' } : {}
					),
					data: {
						enchantmentEvent() {
							if (enchantDesc.once) {
								/*
									Remove this enchantment from the Section's list.
								*/
								const index = desc.section.enchantments.indexOf(enchantData);
								desc.section.enchantments.splice(index,1);
								/*
									Of course, the <tw-enchantment>s
									must also be removed.
								*/
								enchantData.disenchant();
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
								Object.assign({}, desc, { enabled: true })
							);
						},
					},
					scope: desc.section.selectHook(selector),
				});
				/*
					Add the above object to the section's enchantments.
				*/
				desc.section.enchantments.push(enchantData);
				/*
					Enchant the scope for the first time.
				*/
				enchantData.enchantScope();
				return desc;
			},
			either(HookSet,String)
		];
	}
	
	/*
		Interaction macros produce ChangerCommands that defer their attached
		hook's rendering, and enchantment a target hook, waiting for the
		target to be interacted with and then performing the deferred rendering.
	*/
	const interactionTypes = [
		/*d:
			(click: [HookName or String]) -> Changer

			Produces a command which, when attached to a hook, hides it and enchants the specified target, such that
			it visually resembles a link, and that clicking it causes the attached hook to be revealed.

			Example usage:
			* `There is a small dish of water. (click: "dish")[Your finger gets wet.]` causes "dish" to become a link that,
			when clicked, reveals "Your finger gets wet." at the specified location.
			* `[Fie and fuggaboo!]<shout| (click: ?shout)[Blast and damnation!]` does something similar to every hook named `<shout|`.

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

			See also:
			(link:), (link-reveal:), (link-repeat:), (mouseover:), (mouseout:), (replace:), (click-replace:)

			#links
		*/
		{
			name: "click",
			enchantDesc: {
				event    : "click",
				once     : true,
				rerender : "",
				classList: "link enchantment-link"
			}
		},
		/*d:
			(mouseover: [HookName or String]) -> Changer

			A variation of (click:) that, instead of showing the hook when the target is clicked, shows it
			when the mouse merely hovers over it. The target is also styled differently, to denote this
			hovering functionality.

			Rationale:

			(click:) and (link:) can be used to create links in your passage that reveal text or, in conjunction with
			other macros, transform the text in myriad ways. This macro is exactly like (click:), except that instead of
			making the target a link, it makes the target reveal the hook when the mouse hovers over it. This can convey
			a mood of fragility and spontaneity in your stories, of text reacting to the merest of interactions.

			Details:

			This macro is subject to the same rules regarding the styling of its targets that (click:) has, so
			consult (click:)'s details to review them.

			This macro is not recommended for use in games or stories intended for use on touch devices, as
			the concept of "hovering" over an element doesn't really make sense with that input method.
			
			See also:
			(link:), (link-reveal:), (link-repeat:), (click:), (mouseout:), (replace:), (mouseover-replace:)

			#links
		*/
		{
			name: "mouseover",
			enchantDesc: {
				event    : "mouseenter",
				once     : true,
				rerender : "",
				classList: "enchantment-mouseover"
			}
		},
		/*d:
			(mouseout: [HookName or String]) -> Changer

			A variation of (click:) that, instead of showing the hook when the target is clicked, shows it
			when the mouse moves over it, and then leaves. The target is also styled differently, to denote this
			hovering functionality.

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

			This macro is not recommended for use in games or stories intended for use on touch devices, as
			the concept of "hovering" over an element doesn't really make sense with that input method.
			
			See also:
			(link:), (link-reveal:), (link-repeat:), (click:), (mouseover:), (replace:), (mouseout-replace:)

			#links
		*/
		{
			name: "mouseout",
			enchantDesc: {
				event    : "mouseleave",
				once     : true,
				rerender : "",
				classList: "enchantment-mouseout"
			}
		}
	];
	
	interactionTypes.forEach((e) => Macros.addChanger(e.name, ...newEnchantmentMacroFns(e.enchantDesc, e.name)));
	
	/*
		Combos are shorthands for interaction and revision macros that target the same hook:
		for instance, (click: ?1)[(replace:?1)[...]] can be written as (click-replace: ?1)[...]
	*/
	/*d:
		(click-replace: [HookName or String]) -> Changer

		A special shorthand combination of the (click:) and (replace:) macros, this allows you to make a hook
		replace its own text with that of the attached hook whenever it's clicked. `(click: ?1)[(replace:?1)[...]]`
		can be rewritten as `(click-replace: ?1)[...]`.

		Example usage:
		```
		My deepest secret.
		(click-replace: "secret")[longing for you].
		```

		See also:
		(click-prepend:), (click-append:)

		#links
	*/
	/*d:
		(click-append: [HookName or String]) -> Changer

		A special shorthand combination of the (click:) and (append:) macros, this allows you to append
		text to a hook or string when it's clicked. `(click: ?1)[(append:?1)[...]]`
		can be rewritten as `(click-append: ?1)[...]`.

		Example usage:
		```
		I have nothing to fear.
		(click-append: "fear")[ but my own hand].
		```

		See also:
		(click-replace:), (click-prepend:)

		#links
	*/
	/*d:
		(click-prepend: [HookName or String]) -> Changer

		A special shorthand combination of the (click:) and (prepend:) macros, this allows you to prepend
		text to a hook or string when it's clicked. `(click: ?1)[(prepend:?1)[...]]`
		can be rewritten as `(click-prepend: ?1)[...]`.

		Example usage:
		```
		Who stands with me?
		(click-prepend: "?")[ but my shadow].
		```

		See also:
		(click-replace:), (click-append:)

		#links
	*/
	/*d:
		(mouseover-replace: [HookName or String]) -> Changer

		This is similar to (click-replace:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-replace:).

		#links
	*/
	/*d:
		(mouseover-append: [HookName or String]) -> Changer

		This is similar to (click-append:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-append:).

		#links
	*/
	/*d:
		(mouseover-prepend: [HookName or String]) -> Changer

		This is similar to (click-prepend:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-prepend:).

		#links
	*/
	/*d:
		(mouseout-replace: [HookName or String]) -> Changer

		This is similar to (click-replace:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-replace:).

		#links
	*/
	/*d:
		(mouseout-append: [HookName or String]) -> Changer

		This is similar to (click-append:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-append:).

		#links
	*/
	/*d:
		(mouseout-prepend: [HookName or String]) -> Changer

		This is similar to (click-prepend:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-prepend:).
		
		#links
	*/
	revisionTypes.forEach((revisionType) => {
		interactionTypes.forEach((interactionType) => {
			const enchantDesc = Object.assign({}, interactionType.enchantDesc, {
					rerender: revisionType
				}),
				name = interactionType.name + "-" + revisionType;
			Macros.addChanger(name, ...newEnchantmentMacroFns(enchantDesc, name));
		});
	});
});
