"use strict";
define(['jquery', 'utils', 'utils/operationutils', 'engine', 'passages', 'macros', 'datatypes/hookset', 'datatypes/changercommand', 'datatypes/lambda', 'internaltypes/enchantment', 'internaltypes/twineerror'],
($, Utils, {is}, Engine, Passages, Macros, HookSet, ChangerCommand, Lambda, Enchantment, TwineError) => {

	const {either,rest} = Macros.TypeSignature;
	/*
		Built-in Revision, Interaction and Enchantment macros.
		This module modifies the Macros module only, and exports nothing.
	*/

	/*d:
		(enchant: HookName or String, Changer or Lambda) -> Command

		Applies a changer (or a "via" lambda producing a changer) to every occurrence of a hook or string in a passage, and continues
		applying that changer to any further occurrences that are made to appear in the same passage later.

		Example usage:
		* `(enchant: "gold", (text-colour: yellow) + (text-style:'bold'))` makes all occurrences of "gold" in the text be bold and yellow.
		* `(enchant: ?passage's chars, via (text-color:(hsl: pos * 10, 1, 0.5)))` colours all of the characters in the passage in a
		rainbow pattern.
		* `(enchant: ?passage's chars, via (t8n-delay:pos * 30) + (t8n:'instant'))` causes the passage's characters to "type out" when the
		player first visits, such as in a visual novel or other such computer game.

		Rationale:
		While changers allow you to style or transform certain hooks in a passage, it can be tedious and error-prone to attach them to every
		occurrence as you're writing your story, especially if the attached changers are complicated. You can
		simplify this by storing changers in short variables, and attaching just the variables, like so:
		```
		(set: _ghost to (text-style:'outline'))
		_ghost[Awoo]
		_ghost[Ooooh]
		```
		Nevertheless, this can prove undesirable: you may want to remove the _ghost styling later in development, which would
		force you to remove the attached variables to avoid producing an error; you may want to only style a single word or phrase,
		and find it inconvenient to place it in a hook; you may simply not like having code, like that (set:) macro,
		be at the start of your passage; you may not want to keep track of which variables hold which changers, given the possibility (if
		you're using normal variables) that they could be changed previously in the story.

		Instead, you can give the hooks the name "ghost", and then (enchant:) them afterward like so:
		```
		|ghost>[Awoo]
		|ghost>[Ooooh]
		(enchant: ?ghost, (text-style:'outline'))
		```
		The final (enchant:) macro can target words instead of hooks, much like (click:) - simply provide a string instead of a hook name.

		This macro works well in "header" tagged passages - using a lot of (enchant:) commands to style certain words or parts of
		every passage, you can essentially write a "styling language" for your story, where certain hook names "mean" certain colours or
		behaviour. (This is loosely comparable to using CSS to style class names, but exclusively uses macros.)

		If a "via" lambda is supplied to (enchant:) instead of a changer, then that lambda can compute a changer dynamically, based on specifics of
		each hook that's enchanted. For instance, `(enchant: "O", via (text-style:(cond: its pos % 2 is 0, 'bold', 'none')))`

		Details:
		Unlike the (replace:), (append:) and (prepend:) macros, this macro can affect text and hooks that appear after it. This is because it creates
		an ongoing effect, giving a style to hooks and making them retain it, whereas those replacement macros can be considered single, immediate commands.

		As with (click:), the "enchantment" affects the text produced by (display:) macros, and any hooks changed by (replace:) etc. in the future,
		until the player makes their next turn.

		The built-in hook names, ?Page, ?Passage, ?Sidebar and ?Link, can be targeted by this macro, and can be styled on a per-passage basis this way.

		Using (text-colour:) with this macro will let you change the colour of links inside the indicated hook, with one exception:
		using (enchant:) to enchant the entire passage (via `?passage` or `?page`) with (text-colour:) will NOT affect links. This is to allow you
		to re-style the entire story without having to lose the distinct colour of links compared to passage text. You can change the colour of all links using
		an explicit `(enchant: ?link, (text-colour: $color))`.

		You can use (enchant:) with (transition:) to add transitions to hooks or text elsewhere in the same passage – however, if those hooks or words have already appeared,
		they won't abruptly animate. For example, `(event: when time > 2s)[(enchant:"Riddles", (t8n:"Shudder"))]` adds an (enchant:) macro call to the passage
		after 2 seconds, and won't affect instances of the word "Riddles" that are already in the passage.

		You cannot use (enchant:) with (link:) or any of its relatives – because the enchanted hook or text is already in the passage, the link can't appear.

		See also:
		(click:)

		Added in: 2.0.0
		#basics
	*/
	Macros.addCommand("enchant",
		(scope, changer) => {
			/*
				First, test the changer to confirm it contains no revision macros.
			*/
			if (ChangerCommand.isPrototypeOf(changer)) {
				const summary = changer.summary();
				if (summary.includes('newTargets') || summary.includes('target')) {
					return TwineError.create(
						"datatype",
						"The changer given to (enchant:) can't include a revision command like (replace:) or (append:)."
					);
				}
			}
		},
		(section, scope, changer) => {
			const enchantment = Enchantment.create({
				scope: HookSet.from(scope),
				/*
					Because the changer provided to this macro could actually be a "via" lambda that produces changers,
					Enchantment has both "lambda" and "changer" properties to distinguish them.
					We make the distinction here.
				*/
				[ChangerCommand.isPrototypeOf(changer) ? "changer" : "lambda"]: changer,
				section,
			});
			section.addEnchantment(enchantment);
			/*
				section.updateEnchantments() will be run automatically after
				this has been executed, meaning we don't have to do it here.
			*/
			return "";
		},
		[either(HookSet,String), either(ChangerCommand, Lambda.TypeSignature('via'))],
		false // Can't have attachments.
	);

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
				(append:), (prepend:), (show:), (rerun:), (more:)

				Added in: 1.0.0
				#revision
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
				(replace:), (prepend:), (show:), (rerun:), (more:)

				Added in: 1.0.0
				#revision
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
				(replace:), (append:), (show:), (rerun:), (more:)

				Added in: 1.0.0
				#revision
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
						"A string given to this ("
						+ e
						+ ":) macro was empty."
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
				function generalEnchantmentEvent() {
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
			(_, selector) => {
				/*
					If the selector is empty (which means it's the empty string) then throw an error,
					because nothing can be selected.
				*/
				if (!selector) {
					return TwineError.create("datatype", "A string given to this (" + name + ":) macro was empty.");
				}
				return ChangerCommand.create(name, [HookSet.from(selector)]);
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
				const [{tempVariables}] = desc.section.stack;

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
								<tw-story>, <tw-sidebar> or <tw-passage>) then use the enchantDesc's
								blockClassList instead of its classList. This is used to give (click: ?page)
								a different styling than just turning the entire passage text into a link.
							*/
							target.attr('class',
								target.children().is("tw-story, tw-sidebar, tw-passage")
								? enchantDesc.blockClassList
								: enchantDesc.classList
							);
						}
					],
					attr:
						/*
							Include the tabIndex for link-type enchantments, so that they
							can also be clicked using the keyboard. This includes the clickblock
							enchantment.
						*/
						(enchantDesc.classList + '').match(/\b(?:link|enchantment-clickblock)\b/)
							? { tabIndex: '0' }
							: {},
					data: {
						enchantmentEvent() {
							/*
								First, don't do anything if control flow in the section is currently blocked
								(which means the click/mouseover input should be dropped).
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
								Object.assign({}, desc, {
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
				});
				/*
					Add the above object to the section's enchantments.
				*/
				desc.section.addEnchantment(enchantData);
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
			(click: HookName or String) -> Changer

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

			Targeting ?Page, ?Passage or ?Sidebar:

			When a (click:) command is targeting the ?Page, ?Passage or ?Sidebar, instead of transforming the entire passage text into
			a link, something else will occur: a blue link-coloured border will surround the area, and
			the mouse cursor (on desktop browsers) will resemble a hand no matter what it's hovering over.

			Clicking a link when a (click:) is targeting the ?Page or ?Passage will cause both the link and the (click:) to
			activate at once.

			Using multiple (click:) commands to target the ?Page or ?Passage will require multiple clicks from the
			player to activate all of them. They activate in the order they appear on the page - top to bottom.

			See also:
			(link:), (link-reveal:), (link-repeat:), (mouseover:), (mouseout:), (replace:), (click-replace:)

			Added in: 1.0.0
			#links 9
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
			(mouseover: HookName or String) -> Changer

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
			consult (click:)'s details to review them.

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
			(mouseout: HookName or String) -> Changer

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
	
	interactionTypes.forEach((e) => Macros.addChanger(e.name, ...newEnchantmentMacroFns(e.enchantDesc, e.name)));

	/*
		A separate click event needs to be defined for an .enchantment-clickblock wrapping <tw-story>, which is explained below.
	*/
	Utils.onStartup(() => {
		interactionTypes.forEach(({name, enchantDesc}) => {
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
					function() {
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
		(click-replace: HookName or String) -> Changer

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
		(click-append: HookName or String) -> Changer

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
		(click-prepend: HookName or String) -> Changer

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
		(mouseover-replace: HookName or String) -> Changer

		This is similar to (click-replace:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-replace:).

		Added in: 1.0.0
		#links 15
	*/
	/*d:
		(mouseover-append: HookName or String) -> Changer

		This is similar to (click-append:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-append:).

		Added in: 1.0.0
		#links 16
	*/
	/*d:
		(mouseover-prepend: HookName or String) -> Changer

		This is similar to (click-prepend:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-prepend:).

		Added in: 1.0.0
		#links 17
	*/
	/*d:
		(mouseout-replace: HookName or String) -> Changer

		This is similar to (click-replace:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-replace:).

		Added in: 1.0.0
		#links 20
	*/
	/*d:
		(mouseout-append: HookName or String) -> Changer

		This is similar to (click-append:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-append:).

		Added in: 1.0.0
		#links 21
	*/
	/*d:
		(mouseout-prepend: HookName or String) -> Changer

		This is similar to (click-prepend:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-prepend:).

		Added in: 1.0.0
		#links 22
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
	/*d:
		(click-goto: HookName or String, String) -> Command

		A special shorthand combination of the (click:) and (go-to:) macros, this allows you to make a hook
		or bit of text into a passage link. `(click-goto: ?1, 'Passage Name')` is equivalent to `(click: ?1)[(goto:'Passage Name')]`

		Example usage:
		```
		Time to get in your crimchair, plug in your crimphones, power up your crimrig and your crimgrip - the next page in your crimming career awaits.
		(click-goto: "crim", "Test")
		```

		See also:
		(link-goto:)

		Added in: 3.0.0
		#links 11
	*/
	/*d:
		(mouseover-goto: HookName or String, String) -> Command

		This is similar to (click-goto:), but uses the (mouseover:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-goto:).

		Added in: 3.0.0
		#links 16
	*/
	/*d:
		(mouseout-goto: HookName or String, String) -> Command

		This is similar to (click-goto:), but uses the (mouseout:) macro's behaviour instead of
		(click:)'s. For more information, consult the description of (click-goto:).

		Added in: 3.0.0
		#links 21
	*/
	interactionTypes.forEach((interactionType) => {
		const name = interactionType.name + "-goto";
		Macros.addCommand(name,
			(selector, passage) => {
				/*
					If either of the arguments are the empty string, show an error.
				*/
				if (!selector || !passage) {
					return TwineError.create("datatype", "A string given to this (" + name + ":) macro was empty.");
				}
				/*
					First, of course, check for the passage's existence.
				*/
				if (!Passages.hasValid(passage)) {
					return TwineError.create("macrocall",
						"I can't (" + name + ":) the passage '" + passage + "' because it doesn't exist."
					);
				}
			},
			(desc, section, selector, passage) => {
				/*
					Now, newEnchantmentMacroFns() is only designed to return functions for use with addChanger().
					What this kludge does is take the second changer function, whose signature is (descriptor, selector),
					and then call it in TwineScript_Print() when the command is run, passing in a fake ChangeDescriptor
					with only a "section" property.
				*/
				const [,makeEnchanter] = newEnchantmentMacroFns(Object.assign({}, interactionType.enchantDesc, {
					goto: passage,
					transition: desc.data.passageT8n,
				}), name);
				makeEnchanter({section}, HookSet.from(selector));
				return Object.assign(desc, { source: '' });
			},
			[either(HookSet,String), String]
		);
	});
});
