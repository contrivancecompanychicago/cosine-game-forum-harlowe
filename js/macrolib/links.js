"use strict";
define(['jquery', 'macros', 'utils', 'state', 'passages', 'engine', 'datatypes/changercommand', 'internaltypes/changedescriptor', 'datatypes/hookset', 'datatypes/lambda', 'internaltypes/twineerror'],
($, Macros, Utils, State, Passages, Engine, ChangerCommand, ChangeDescriptor, HookSet, Lambda, TwineError) => {
	/*
		This module defines the behaviour of links in Harlowe - both
		the normal passage links, and the (link:) macro's links.
		But, this does not include (click:) enchantments, which
		are technically not links (but behave identically).
	*/
	const {optional,rest,either} = Macros.TypeSignature;
	const emptyLinkTextMessages = ["Links can't have empty strings for their displayed text.",
		"In the link syntax, a link's displayed text is inside the [[ and ]], and on the non-pointy side of the -> or <- arrow if it's there."];
	const {assign} = Object;

	/*
		Register the event that this enchantment responds to
		in a jQuery handler.
		
		Sadly, since there's no permitted way to attach a jQuery handler
		directly to the triggering element, the "actual" handler
		is "attached" via a jQuery .data() key, and must be called
		from this <tw-story> handler.
	*/
	Utils.onStartup(() => {
		/*
			A browser compatibility check for touch events (which suggest a touchscreen). If true, then mouseover and mouseout events
			should have "click" added.
			A copy of this appears in macrolib/enchantments.js.
		*/
		const hasTouchEvents = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);

		function clickLinkEvent(e) {
			const link = $(this),
				/*
					Since there can be a <tw-enchantment> between the parent <tw-expression>
					that holds the linkPassageName data and this <tw-link> itself,
					we need to explicitly attempt to reach the <tw-expression>.
				*/
				expression = link.closest('tw-expression'),
				/*
					Links' events are, due to limitations in the ChangeDescriptor format,
					attached to the <tw-hook> or <tw-expression> containing the element.
				*/
				closest = link.closest('tw-expression, tw-hook'),
				event = closest.data('clickEvent'),
				/*
					Don't do anything if control flow in any section is currently blocked
					(which means the click input should be dropped).
				*/
				section = closest.data('section');

			/*
				The debug "open" buttons shouldn't activate enchantments on click.
			*/
			if (link.is('tw-open-button')) {
				return;
			}

			if (section && section.stackTop && section.stackTop.blocked &&
					/*
						However, links inside (dialog:)s and other blocking elements may still have their
						events occur. This is currently (as of October 2021) distinct from (click:) enchantments, which
						are "passage-wide" and thus remain blocked.
					*/
					(!(section.stackTop.blocked instanceof $) || !section.stackTop.blocked.find(link).length)) {
				return;
			}

			if (event) {
				/*
					If a link's body contains a <tw-error>, then don't
					allow it to be clicked anymore, so that (for instance), the error message
					can be expanded to see the line of additional advice.
				*/
				if (link.find('tw-error').length > 0) {
					return;
				}
				e.stopPropagation();
				event(link);
				return;
			}
			/*
				If no event was registered, then this must be a passage link.
			*/
			const next = expression.data('linkPassageName');
			/*
				The correct t8nDepart, t8nArrive and t8nTime belongs to the deepest <tw-enchantment>.
				Iterate through each <tw-enchantment> and update these variables.
				(A .each() loop is easier when working with a jQuery compared to a .reduce().)
			*/

			let transition = Object.assign({}, expression.data('passageT8n') || {});
			/*
				$().find() SHOULD return the tw-enchantments in ascending depth order.
			*/
			expression.find('tw-enchantment').each((_,e) => {
				Object.assign(transition, $(e).data('passageT8n') || {});
			});

			if (next) {
				e.stopPropagation();
				// TODO: stretchtext
				Engine.goToPassage(next, { transition });
				return;
			}
			/*
				Or, a (link-undo:) or (link-fullscreen:) link.
			*/
			if (link.is('[undo]')) {
				e.stopPropagation();
				Engine.goBack({ transition });
				return;
			}
			if (link.is('[fullscreen]')) {
				e.stopPropagation();
				Engine.toggleFullscreen();
				/*
					Notice that the presence of the handler below means that we don't have to
					run the link's event handler here, as it will be handled automatically.
				*/
				return;
			}
		}
		Utils.storyElement.on(
			/*
				The jQuery event namespace is "passage-link".
			*/
			"click.passage-link",
			/*
				Only links that haven't been altered to use "mouseover" "mouseout" or "doubleclick" changers can be triggered by clicking.
				This list of :not() classes is required for IE10 compatibility.
			*/
			'tw-link' + (!hasTouchEvents ? ':not(.enchantment-mouseover):not(.enchantment-mouseout):not(.enchantment-dblclick)' : ''),
			clickLinkEvent
		)
		/*
			These other events handle the different (action:)s that can be applied to a link.
			"tw-link.enchantment-mouseover" refers to (action:) given to (link:),
			and "tw-expression.enchantment-mouseover > tw-link" refers to (action:)[[Link]].

			This dissimilarity of link structures is something that'll probably be addressed in Harlowe 4.
		*/
		.on(
			"mouseover.passage-link",
			'tw-link.enchantment-mouseover, tw-expression.enchantment-mouseover > tw-link',
			clickLinkEvent
		).on(
			"mouseout.passage-link",
			'tw-link.enchantment-mouseout, tw-expression.enchantment-mouseout > tw-link',
			clickLinkEvent
		).on(
			"dblclick.passage-link",
			'tw-link.enchantment-dblclick, tw-expression.enchantment-dblclick > tw-link',
			clickLinkEvent
		);
		/*
			This handler updates all (link-fullscreen:) links' text, using their own event handlers,
			whenever the browser detects a fullscreen change.
		*/
		$(document).on('fullscreenchange', () => {
			$("tw-link[fullscreen]", Utils.storyElement).each((_, link) => {
				($(link).closest('tw-expression, tw-hook').data('fullscreenEvent') || Object)(link);
			});
		});
	});

	/*
		The mechanics of determining the passage name of a (link-goto:) or (link-reveal-goto:)
		link are slightly nontrivial.
		If there is an existing passage whose name is an exact match of the passage string,
		and the passage string is also the link text, then print the link text verbatim.
		Otherwise, if there is a passage whose name matches the text() resulting from rendering
		the link (such as "$name") then use that. Otherwise, the link is broken.
	*/
	function passageNameParse(section, text, passage) {
		passage = passage || text;
		/*
			As of Harlowe 3.1.0, if a passage exists with the unevaluated passage name of the link (for
			instance, "**Balcony**") then that's used instead of evaluating the link.
		*/
		const exactMatch = Passages.hasValid(text) && text === passage;

		/*
			The string representing the passage name is evaluated as TwineMarkup here -
			the link syntax accepts TwineMarkup in both link and passage position
			(e.g. [[**Go outside**]], [[$characterName->$nextLocation]]), and the text
			content of the evaluated TwineMarkup is regarded as the passage name,
			even though it is never printed.
			
			One concern is that of evaluation order: the passage name is always evaluated
			before the link text, as coded here. But, considering the TwineMarkup parser
			already discards the ordering of link text and passage name in the link
			syntax ([[a->b]] vs [[b<-a]]) then this can't be helped, and probably doesn't matter.
		*/
		let passageNameRender = section.evaluateTwineMarkup(Utils.unescape(passage), "a link's passage name");

		let error;
		if (exactMatch) {
			/*
				If there is an exact match, then the passage name, if it is also the text,
				should be rendered verbatim. To do this, first we check if rendering it caused HTML elements to
				appear (.children()), and, if so, verbatim markup is wrapped around the name.
			*/
			let verbatimGuard = (passageNameRender.children().length > 0)
				? "`".repeat((passage.match(/`+/) || []).reduce((a,e) => Math.max(a, e.length + 1), 1))
				: "";
			/*
				The \0 is a small kludge to prevent verbatim guards from merging with graves at the start or end
				of the text, causing them to become unbalanced. Browsers rendering these strings should discard them.
			*/
			text = verbatimGuard + "\0".repeat(!!verbatimGuard) + text + "\0".repeat(!!verbatimGuard) + verbatimGuard;
		}
		else {
			/*
				If a <tw-error> was returned by evaluateTwineMarkup, replace the link with it.
			*/
			if (passageNameRender.findAndFilter('tw-error').length) {
				/*
					Yes, this takes rendered <tw-error>s and extracts the original TwineError
					from them, only to render it again later. Alas, that is how it must be.
				*/
				error = passageNameRender.findAndFilter('tw-error').data('TwineError');
			}
			passage = passageNameRender.text();
		}
		return { text, passage, error };
	}
	
	[
		/*d:
			(link: String, [Changer]) -> Changer
			Also known as: (link-replace:)
			
			When attached to a hook, this replaces the hook with a link that has the given text. The link, when clicked, vanishes and reveals the hook.
			An optional changer can be given to alter the style of the link
			(instead of altering the style of the attached hook).
			
			Example usage:
			* `(link: "Stake")[The dracula crumbles to dust.]` will create a link reading "Stake"
			which, when clicked, disappears and shows "The dracula crumbles to dust."
			* `(link: "Click to continue")[==` will create a link that, using the unclosed hook syntax,
			defers the display of the remainder of the passage until it is clicked.
			
			Rationale:
			
			As you're aware, links are what the player uses to traverse your story. However,
			links can also be used to simply display text or run macros inside hooks. Just
			attach the (link:) macro to a hook, and the entire hook will not run or appear at all until the
			player clicks the link.
			
			Note that this particular macro's links disappear when they are clicked - if you want
			their words to remain in the text, or for only a small portion of the text
			to disappear, consider using (link-reveal:).
			
			Details:
			This creates a link which is visually indistinguishable from normal passage links. However, a changer can optionally be given, after the
			string, to change the appearance of the link. This must be a changer that would be accepted by (enchant-in:) or
			(link-style:) - which is to say, (link:), (replace:), (append-with:), or any of their relatives cannot be given, or else an error will result.
			Note that if you wish to apply a changer to every link in the passage (or, via the use of a 'header' or 'footer' tagged passage, every link
			in the story), then you can simply use (enchant:) with ?Link instead.

			The created link is displayed in place of the hook's contents, and is exempt from all changers that would normally apply
			to the hook. This means that changers like (text-colour:), added to this changer, will ONLY apply
			to the hook once it's revealed, and not the link itself. To apply changers to just the link, consider wrapping it in a
			hook itself and using (link-style:), such as by the following:
			```
			(link-style: (text-colour:red))[(link:"Hands stained red")[Hands pure and dry :)]]
			```
			Alternatively, you can just use (enchant:) with `?Link` to enchant every link with the same changer.
			
			See also:
			(link-reveal:), (link-rerun:), (link-repeat:), (link-goto:), (click:), (more:)

			Added in: 1.0.0
			#links 1
		*/
		["link", "link-replace"],
		/*d:
			(link-reveal: String, [Changer]) -> Changer
			Also known as: (link-append:)
			
			When attached to a hook, this replaces the hook with a link that has the given text. The link, when clicked, reveals the hook and becomes plain, unstyled text.
			An optional changer can be given to alter the style of the link (instead of altering the style of the attached hook).

			Example usage:
			`(link-reveal: "Heart")[broken]` will create a link reading "Heart"
			which, when clicked, changes to plain text, and shows "broken" after it.
			
			Rationale:
			
			This is similar to (link:), but allows the text of the link to remain in the passage
			after it is clicked. It allows key words and phrases in the passage to expand and
			reveal more text after themselves. Simply attach it to a hook, and the hook will only be
			revealed when the link is clicked.
			
			Details:
			This creates a link which is visually indistinguishable from normal passage links. However, a changer can optionally be given, after the
			string, to change the appearance of the link. This must be a changer that would be accepted by (enchant-in:) or
			(link-style:) - which is to say, (link:), (replace:), (append-with:), or any of their relatives cannot be given, or else an error will result.
			Note that if you wish to apply a changer to every link in the passage (or, via the use of a 'header' or 'footer' tagged passage, every link
			in the story), then you can simply use (enchant:) with ?Link instead.

			The created link is displayed in place of the hook's contents, and is exempt from all changers that would normally apply
			to the hook. This means that changers like (text-colour:), added to this changer, will ONLY apply
			to the hook once it's revealed, and not the link itself. To apply changers to just the link, consider wrapping it in a
			hook itself and using (link-style:), or just using (enchant:) with `?Link` to enchant every link.
			
			If the link text contains formatting syntax, such as "**bold**", then it will be retained
			when the link is demoted to text.
			
			See also:
			(link:), (link-rerun:), (link-repeat:), (link-goto:), (click:), (more:)

			Added in: 1.2.0
			#links 2
		*/
		["link-reveal", "link-append"],
		/*d:
			(link-repeat: String, [Changer]) -> Changer
			
			When attached to a hook, this replaces the hook with a link that has the given text. The link, when clicked, reveals the hook.
			Further clicks will cause the hook to repeat itself - a copy of the hook's code will be run, and the result appended to it,
			in a manner similar to (for:). An optional changer can be given to alter the style of the link
			(instead of altering the style of the attached hook).
			
			Example usage:
			* `(link-repeat: "Add cheese")[(set:$cheese to it + 1)]` will create a link reading "Add cheese"
			which, when clicked, adds 1 to the $cheese variable using (set:), and can be clicked repeatedly.
			* `(link-repeat: "Scream a little ")[A]` will, when the link is clicked, add an A to the hook each time.
			
			Rationale:
			
			This is similar to (link:), but allows the created link to remain in the passage
			after it is clicked. It can be used to make a link that fills with increasingly more text after
			each click, possibly conveying a sense of powerlessness or desperation.

			This macro is part of a pair with (link-rerun:) - the latter macro will empty the hook each time the link is
			clicked. This one should be used if you'd prefer the hook to retain each of its past runs.

			The created link is displayed in place of the hook's contents, and is exempt from all changers that would normally apply
			to the hook. This means that changers like (text-colour:), added to this changer, will ONLY apply
			to the hook once it's revealed, and not the link itself. To apply changers to just the link, consider wrapping it in a
			hook itself and using (link-style:), or just using (enchant:) with `?Link` to enchant every link.
			
			Details:
			This creates a link which is visually indistinguishable from normal passage links. However, a changer can optionally be given, after the
			string, to change the appearance of the link. This must be a changer that would be accepted by (enchant-in:) or
			(link-style:) - which is to say, (link:), (replace:), (append-with:), or any of their relatives cannot be given, or else an error will result.
			Note that if you wish to apply a changer to every link in the passage (or, via the use of a 'header' or 'footer' tagged passage, every link
			in the story), then you can simply use (enchant:) with ?Link instead.

			See also:
			(link-rerun:), (link-reveal:), (link:), (link-goto:), (click:)
			
			Added in: 1.2.0
			#links 3
		*/
		["link-repeat"],
		/*d:
			(link-rerun: String, [Changer]) -> Changer
			
			When attached to a hook, this replaces the hook with a link that has the given text. The link, when clicked, reveals the hook.
			Further clicks will cause the hook to rerun itself, as if by the effect of (rerun:). An optional changer can be given to alter the style of the link
			(instead of altering the style of the attached hook).
			
			Example usage:
			* `(link-rerun: "ROLL DICE ")[You rolled a (random:1,6).]` will create a link reading "ROLL DICE"
			which, when clicked, changes the hook to "You rolled a " followed by a random number between 1 and 6.

			Rationale:
			
			This is similar to (link:), but allows the created link to remain in the passage
			after it is clicked. It can be used to make a link which displays a slightly varying run of prose over and
			over, or a link which must be clicked multiple times before something can happen (using (set:) and (if:) to
			keep count of the number of clicks).

			This macro is part of a pair with (link-repeat:) - the latter macro will append each run of the hook,
			so that text gradually accumulates within it. This one should be used if you'd prefer the hook
			to remain at a certain size, or need it to always naturally flow from the link text.

			The created link is displayed in place of the hook's contents, and is exempt from all changers that would normally apply
			to the hook. This means that changers like (text-colour:), added to this changer, will ONLY apply
			to the hook once it's revealed, and not the link itself. To apply changers to just the link, provide them (added together if there
			are multiple) as the optional second value to this macro.

			Details:
			This creates a link which is visually indistinguishable from normal passage links. However, a changer can optionally be given, after the
			string, to change the appearance of the link. This must be a changer that would be accepted by (enchant-in:) or
			(link-style:) - which is to say, (link:), (replace:), (append-with:), or any of their relatives cannot be given, or else an error will result.
			Note that if you wish to apply a changer to every link in the passage (or, via the use of a 'header' or 'footer' tagged passage, every link
			in the story), then you can simply use (enchant:) with ?Link instead.

			See also:
			(link-repeat:), (link-reveal:), (link:), (link-goto:), (click:)

			Added in: 3.2.0
			#links 4
		*/
		["link-rerun"],
	].forEach(arr =>
		Macros.addChanger(arr,
			(_, text, changer) => {
				if (!text) {
					return TwineError.create("datatype", emptyLinkTextMessages[0]);
				}
				if (changer && !changer.canEnchant) {
					return TwineError.create(
						"datatype",
						`The changer given to (${arr[0]}:) can't be or include a revision, enchantment, or interaction changer like (replace:), (click:), or (link:).`
					);
				}
				return ChangerCommand.create(arr[0], [text].concat(changer || []), null,
					/*
						The canEnchant boolean.
						This should be "false", but for compatibility for Harlowe 3.3.0, this is currently true.
					*/
					true);
			},
			(desc, text, changer) => {
				const name = arr[0];
				/*
					As this is a deferred rendering macro, the current tempVariables
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
					Create a ChangeDescriptor for the created link, which overrides the entire descriptor if it's placed in its "enablers" array.
					The reason the original descriptor is returned, though, is so that additional non-enabler changers can apply to it.
				*/
				const descriptor = ChangeDescriptor.create({
					source: '<tw-link tabindex=0>' + text + '</tw-link>',
					/*
						For Commands whose ChangeDescriptor is permuted by their TwineScript_Attach() method,
						the target isn't installed until just before running. Therefore, the enabler needs to check
						the current descriptor's target, not store whatever it is now (as it could be undefined).
					*/
					target: () => desc.target,
					append: "replace",
					data: {
						section: desc.section,
						clickEvent: link => {
							/*
								Remove this enabler.
							*/
							desc.enablers = desc.enablers.filter(e => e.descriptor !== descriptor);

							/*
								Only (link-reveal:) turns the link into plain text:
								the others either remove it or leave it be.
							*/
							if (name === "link-reveal") {
								link.contents().unwrap();
							}
							/*
								(link-rerun:) replaces everything in the hook, but leaves
								the link, so that the replacement can be repeated. It does this by removing the link,
								then reattaching it after rendering.
							*/
							let parent = link.parentsUntil(':not(tw-enchantment)').parent();
							if (!parent.length) {
								parent = link.parent();
							}
							if (name === "link-rerun") {
								/*
									In addition to detaching the link, this removes the <tw-enchantment>s surrounding the link.
								*/
								const p = link.parentsUntil(':not(tw-enchantment)');
								link.detach();
								p.remove();
							}
							/*
								Only (link-replace:) and (link-rerun:) remove the link on click - the others merely append.
							*/
							if (name === "link" || name === "link-rerun") {
								parent.empty();
							}
							desc.section.renderInto("", null, desc, tempVariables);
							if (name === "link-rerun") {
								/*
									If ?Link is enchanted, reinserting just the link will result in the <tw-enchantment>s being reinstated.
								*/
								parent.prepend(link);
							}
						},
					},
				});
				/*
					Enablers are {descriptor, changer} objects. The descriptor, above, is used to create
					the link element. The changer is then applied to the created element (rather than the hook)
					so that, when it's removed (by clicking, via the above clickEvent), the outer hook remains
					unaffected by its styling.
				*/
				desc.enablers = (desc.enablers || []).concat({ descriptor, changer, });
				return desc;
			},
			[String, optional(ChangerCommand)]
		)
	);
	
	/*
		(link-goto:) is an eager version of (link:...)[(goto:...)], where the
		passage name ((goto:)'s argument) is evaluated alongside (link:)'s argument.
		It is also what the standard link syntax desugars to.
	*/
	Macros.addCommand
		/*d:
			(link-goto: String, [String]) -> Command
			
			Takes a string of link text, and an optional destination passage name, and makes a command to create
			a link that takes the player to another passage. The link functions identically to a standard link.
			
			Example usage:
			* `(link-goto: "Enter the cellar", "Cellar")` is approximately the same as `[[Enter the cellar->Cellar]]`.
			* `(link-goto: "Cellar")` is the same as `[[Cellar]]`.

			Rationale:
			This macro serves as an alternative to the standard link syntax (`[[Link text->Destination]]`), and has a key difference:
			The link syntax lets you supply a fixed text string for the link, and a markup expression for the destination
			passage's name. (link-goto:) also allows the link text to be any expression - so, something like
			`(link-goto: "Move " + $name + "to the cellar", "Cellar")` can be written.

			Details:
			If the passage name doesn't correspond to any existing passage, a broken link (a red link that can't be clicked)
			will be created.

			The resulting command from this macro, like all commands, can be saved and used elsewhere.
			If you have a complicated link you need to use in several passages, you could (set:) it to a variable and use that variable
			in its place.

			As a bit of trivia... the Harlowe engine actually converts all standard links into (link-goto:) macro calls internally -
			the link syntax is, essentially, a syntactic shorthand for (link-goto:).

			Note that (link-goto:), unlike (link:), doesn't accept a changer value to style the produced link. This is because, as
			this produces a command (and not a changer), you can simply attach changers to the front of it to style the link.

			See also:
			(link:), (link-reveal:), (link-undo:), (goto:)

			Added in: 1.0.0
			#links 5
		*/
		("link-goto",
			/*
				Return a new (link-goto:) object.
			*/
			(text) => {
				if (!text) {
					return TwineError.create("datatype", ...emptyLinkTextMessages);
				}
			},
			(cd, section, text, passage) => {
				/*
					First, check that the passage name can actually be parsed.
				*/
				let error;
				({text, passage, error} = passageNameParse(section, text, passage));
				if (error) {
					return error;
				}
				/*
					As an additional error, mistakenly attaching the wrong (t8n:) to a (link-goto:) macro will lead to
					a helpful advisory error being emitted.
				*/
				if (cd.transition) {
					const t = "transition";
					return TwineError.create("datatype", "Please attach ("+t+"-depart:) or ("+t+"-arrive:) to a passage link, not ("+t+":).");
				}

				let source;
				/*
					Check that the passage is indeed available.
				*/
				if (!Passages.hasValid(passage)) {
					/*
						Since the passage isn't available, create a broken link.
					*/
					source = '<tw-broken-link passage-name="' + Utils.escape(passage) + '">'
						+ text + '</tw-broken-link>';
				}
				/*
					This formerly exposed the passage name on the DOM in a passage-name attr,
					but as of 2.2.0, it no longer does. (Debug mode can still view the name due to
					an extra title added to the enclosing <tw-expression> by Renderer).
				*/
				source = source || '<tw-link tabindex=0 '
					/*
						Previously visited passages may be styled differently compared
						to unvisited passages.
					*/
					+ (State.passageNameVisited(passage) > 0 ? 'class="visited" ' : '')
					+ '>' + text + '</tw-link>';
				/*
					Instead, the passage name is stored on the <tw-expression>, to be retrieved by clickEvent() above.
				*/
				cd.data.linkPassageName = passage;
				/*
					All links need to store their section as jQuery data, so that clickLinkEvent can
					check if the section is blocked (thus preventing clicks).
				*/
				cd.data.section = section;
				return assign(cd, {
					source,
					/*
						Since this link doesn't reveal any hooks, it doesn't necessarily make sense that it should
						have transitionDeferred... but for consistency with the other links, it does.
						(Maybe it should error outright if (t8n:) is attached to it?)
					*/
					transitionDeferred: true,
				});
			},
			[String, optional(String)]
		)
		/*d:
			(link-storylet: [String], Number or Lambda, [String]) -> Command

			If there are storylets (passages containing a (storylet:) call) in this story, this will create a link to the first open storylet that
			matches the passed-in 'where' lambda, or, if a number **n** was passed in, the **n**th (or, if negative, **n**thlast) open storylet.
			An optional final string can provide text to display when no such storylet is open currently.

			Example usage:
			```
			You look over the paddock as you ponder three ways you may spend the coming day.
			* (link-storylet: 1, "//(Unavailable)//")
			* (link-storylet: 2, "//(Unavailable)//")
			* (link-storylet: 3, "//(Unavailable)//")
			```

			Rationale:
			The standard macro for accessing which storylets are currently open in the story is (open-storylets:). Combined
			with other macros such as (for:) and (link-goto:), links to storylets can be easily created. This macro provides
			a shorthand for the most basic case: creating a simple link to the first open storylet, second open storylet, and so forth.

			Details:
			The position functions similarly to the position number given to (subarray:) - positive numbers will count from the start,
			and negative numbers will count from the end. `(link-storylet:-1)` will produce a link to the last available storylet (which
			will be the one with the *least* (urgency:) value among open storylets). If the number 0 is given, an error will result.

			If there is no storylet available for the link (such as `(link-storylet: 6)` when only 4 storylets are currently open) then
			the optional final string will be displayed. If it isn't given, nothing will be displayed.

			Note that (link-storylet:), unlike (link:), doesn't accept a changer value to style the produced link. This is because, as
			this produces a command (and not a changer), you can simply attach changers to the front of it to style the link.

			Added in: 3.2.0
			#links 8
		*/
		("link-storylet",
			/*
				Return a new (link-storylet:) object.
			*/
			(...args) => {
				const condition = args[args.length === 1 || typeof args[0] !== 'string' ? 0 : 1];
				if (!condition || typeof condition === 'string') {
					return TwineError.create('datatype', '(link-storylet:) should be given one index number or one \'where\' lambda, after the optional link text string.');
				}
			},
			(cd, section, ...args) => {
				const condition = args[args.length === 1 ? 0 : args.length === 3 || typeof args[0] === "string" ? 1 : 2];
				let text = typeof args[0] === "string" && args[0];
				const unavailableText = args[args.length - 1] !== condition ? args[args.length - 1] : false;

				/*
					Mistakenly attaching the wrong (t8n:) to a (link-storylet:) macro will lead to
					a helpful advisory error being emitted.
				*/
				if (cd.transition) {
					const t = "transition";
					return TwineError.create("datatype", "Please attach ("+t+"-depart:) or ("+t+"-arrive:) to (link-storylet:), not ("+t+":).");
				}
				/*
					Obtain the storylet at the given index, or the first index that passes the 'where' lambda. If there's nothing there,
					simply don't display anything.
				*/
				const isLambda = Lambda.isPrototypeOf(condition);
				const storylets = Passages.getStorylets(section, isLambda && condition),
					err = TwineError.containsError(storylets);
				if (err) {
					return err;
				}
				let passage = storylets[isLambda ? 0 :
					/*
						The index is, of course, 1-indexed.
					*/
					condition < 0 ? storylets.length + condition : condition - 1];
				
				let source;
				/*
					If there is no passage fitting the index or lambda, either return if there's no "unavailable" text,
					or use it as the source instead of constructing the <tw-link>.
				*/
				if (!passage) {
					if (!unavailableText) {
						return cd;
					}
					source = unavailableText;
				}
				else {
					passage = passage.get('name');
					/*
						If the optional text wasn't given, use the passage name for the text.
					*/
					text = text || passage;

					/*
						Create the link in a manner consistent with (link-goto:).
					*/
					source = source || '<tw-link tabindex=0 '
						/*
							Previously visited passages may be styled differently compared
							to unvisited passages.
						*/
						+ (State.passageNameVisited(passage) > 0 ? 'class="visited" ' : '')
						+ '>' + text + '</tw-link>';
					/*
						Instead, the passage name is stored on the <tw-expression>, to be retrieved by clickEvent() above.
					*/
					cd.data.linkPassageName = passage;
					/*
						All links need to store their section as jQuery data, so that clickLinkEvent can
						check if the section is blocked (thus preventing clicks).
					*/
					cd.data.section = section;
				}
				return assign(cd, {
					source,
					/*
						Since this link doesn't reveal any hooks, it doesn't necessarily make sense that it should
						have transitionDeferred... but for consistency with the other links, it does.
						(Maybe it should error outright if (t8n:) is attached to it?)
					*/
					transitionDeferred: true,
				});
			},
			[either(parseInt, String, Lambda.TypeSignature('where')), optional(either(parseInt, String, Lambda.TypeSignature('where'))), optional(String)]
		)


		/*d:
			(link-undo: String, [String]) -> Command

			Takes a string of link text, and produces a link that, when clicked, undoes the current turn and
			sends the player back to the previously visited passage. The link appears identical to a typical
			passage link. An optional second string can be provided, which is shown instead of the link if it's not possible to undo.

			Example usage:
			`(link-undo:"Retreat", "Can't retreat!")` will produce a link reading "Retreat" if undos are available. If not,
			the text "Can't retreat!" is displayed instead.

			Rationale:
			The ability to undo the player's last turn, as an alternative to (go-to:), is explained in the documentation
			of the (undo:) macro. This macro provides a shorthand for placing (undo:) inside a (link:) attached hook.

			You may, as part of customising your story, be using (replace:) to change the ?sidebar, and remove its
			default "undo" link. If so, you can selectively provide undo links at certain parts of your story instead,
			by using this macro.

			Details:
			As with (undo:), (link-storylet:) and such, if undos aren't available (either due to this being the start of the story, or (erase-past:) being used)
			then either the optional second string will be displayed instead, or (if that wasn't provided) nothing will be displayed.

			If this is used in a passage, and (erase-past:) is used later in the passage to prevent undoing, then this link's text will automatically
			be replaced with the optional second string (or disappear if it's not provided). This is similar to how (link-fullscreen:) will
			update itself if another macro changes the player's fullscreen status.

			Note that (link-undo:), unlike (link:), doesn't accept a changer value to style the produced link. This is because, as
			this produces a command (and not a changer), you can simply attach changers to the front of it to style the link.

			See also:
			(undo:), (link-goto:), (icon-undo:)

			Added in: 2.0.0
			#links 7
		*/
		("link-undo",
			(text) => {
				if (!text) {
					return TwineError.create("datatype", emptyLinkTextMessages[0]);
				}
			},
			(cd, section, text, alt = '') => {
				if (State.pastLength < 1) {
					return assign(cd, { source: alt });
				}
				/*
					All links need to store their section as jQuery data, so that clickLinkEvent can
					check if the section is blocked (thus preventing clicks).
				*/
				cd.data.section = section;
				/*
					Since (erase-past:) means there is a possibility this link text could abruptly change, the current tempVariables
					object must be stored for reuse, as the section pops it when normal rendering finishes.
				*/
				const {tempVariables} = section.stackTop;
				cd.data.erasePastEvent = () =>
					/*
						Because (erase-past:) could have occurred inside a (dialog:), the text should only be updated when the section is unblocked.
					*/
					cd.data.section.whenUnblocked(() => {
						/*
							Display the next label, reusing the ChangeDescriptor that the original run received.
						*/
						const cd2 = assign({}, cd, {
							append: 'replace',
							source: alt,
							transitionDeferred: false,
						});
						/*
							Since cd2's target SHOULD equal expr, passing anything as the second argument won't do anything useful
							(much like how the first argument is overwritten by cd2's source). So, null is given.
						*/
						cd.section.renderInto("", null, cd2, tempVariables);
					});
				/*
					This currently reveals its purpose in the player-readable DOM by including an 'undo' attribute,
					which is used by the "click.passage-link" event handler.
				*/
				return assign(cd, {
					source: '<tw-link tabindex=0 undo>' + text + '</tw-link>',
					transitionDeferred: true,
				});
			},
			[String, optional(String)]
		)

		/*d:
			(link-show: String, ...HookName) -> Command

			Creates a link that, when clicked, shows the given hidden hooks, running the code within.

			Example usage:
			`But those little quirks paled before (link-show: "her darker eccentricities.", ?twist)`

			Rationale:
			As discussed in the documentation for (show:), that macro is intended as a complement to (click-replace:) (or perhaps
			(click-append:)). While both let you insert text at a location when a link is clicked, they differ in whether they let the
			author write the initial text or the replacement text at the location when coding the passage.

			Typical (click-append:) usage resembles the following, where the inserted text provides supplementary content to the passage's
			prose, and is written separately from it:

			```
			Ah. You remember her eldest well - [a frail, anxious child]<extra|. Unlikely to raise too much of a fuss.

			(click-append: ?extra)[, constantly frowning, mumbling every word they utter, flinching at the slightest noise]
			```

			Conversely, typical (show:) usage resembles the following, where the inserted text is a continuation of the passage's prose,
			and is written together with it:

			```
			"Look, it's important to comment even the simplest code...|extra)[ You might remember what it does now, but not at 4:50 PM on Friday \
			afternoon, when you're about to push to production and a runtime error shows up in it.]"

			You (link-reveal:"struggle to listen.")[(show: ?extra)]
			```

			The (link-show:) macro provides a convenient shorthand for the latter example, letting you write the final line as
			`You (link-show: "struggle to listen.", ?more)`.

			Details:
			As with most link macros, providing this with an empty link text string will result in an error.

			As with (show:) and (click:), providing this with a hook which is already visible, or which doesn't even exist,
			will NOT produce an error, but simply do nothing. Also, showing a hook that was hidden with (hide:) will not re-run the
			macros contained within, but simply make visible the hook as it was.

			Note that (link-show:), unlike (link:), doesn't accept a changer value to style the produced link. This is because, as
			this produces a command (and not a changer), you can simply attach changers to the front of it to style the link.

			See also:
			(show:), (link-reveal:), (click-append:), (more:)

			Added in: 3.0.0
			#links 8
		*/
		("link-show",
			(text) => {
				if (!text) {
					return TwineError.create("datatype", emptyLinkTextMessages[0]);
				}
			},
			(cd, section, text, ...hooks) => {
				/*
					All links need to store their section as jQuery data, so that clickLinkEvent can
					check if the section is blocked (thus preventing clicks).
				*/
				cd.data.section = section;
				cd.data.clickEvent = (link) => {
					link.contents().unwrap();

					hooks.forEach(hook => hook.forEach(section, elem => {
						/*
							As with (show:), the condition for checking if the target has already been shown is simply
							whether it has the "hidden" data Boolean.
						*/
						const hiddenSource = elem.data('originalSource') || '';
						const data = elem.data('hidden');
						if (!data) {
							return;
						}
						elem.removeData('hidden');
						/*
							If the "hidden" data is a jQuery, then it was previously hidden using (hide:). In that case, restore
							the hidden elements as-is without re-rendering.
						*/
						if (data instanceof $) {
							elem.empty().append(data);
						}
						else {
							const tempVariables = elem.data('tempVariables');
							section.renderInto("", null,
								assign({}, cd, { source: hiddenSource, target: elem, transitionDeferred: false }),
								/*
									Since the shown hook needs access to the tempVariables that are available at its location, retrieve
									the tempVariables data placed on it by Section.execute(), creating a new child scope using Object.create()
									(similar to how (for:) creates scopes for its renders.)
								*/
								tempVariables && Object.create(tempVariables)
							);
						}
					}));
				};
				return assign(cd, {
					source: '<tw-link tabindex=0>' + text + '</tw-link>',
					transitionDeferred: true,
				});
			},
			[String,rest(HookSet)]
		)
		/*d:
			(link-fullscreen: String, String, [String]) -> Command

			Creates a link that, when clicked, toggles the browser's fullscreen mode and windowed mode. The first string is used as its link text
			if the browser is currently in windowed mode, and the second string if it's currently in fullscreen mode. The link will automatically update
			(re-rendering the link text) to match the browser's current fullscreen state. The optional third string is used when fullscreen mode isn't allowed
			by the browser - if it's absent or an empty string, the link won't be displayed at all in that situation.

			Example usage:
			* `(link-fullscreen: "Turn fullscreen on", "Turn fullscreen off", "Fullscreen unavailable")`

			Rationale:
			Modern browsers allow web pages to take up the entire screen of the user, in a manner similar to desktop games. This feature can be useful
			for immersive or moody stories, such as horror stories, that wish to immerse the player's senses in a certain colour or shade, or to display
			impactful text that doesn't have to compete for attention from any other screen elements. While it can be more convenient to place an (icon-fullscreen:)
			in your story's sidebar, this macro can be useful if you remove or replace the sidebar with something else, and can serve as an alternative
			means of activating fullscreen mode.

			The third string is an error message or alternative text you can provide if the browser doesn't allow fullscreen mode to be entered, for whatever reason.
			If you're using this link in the middle of a sentence, you may want to use this to provide an alternative sentence fragment to fit the sentence.

			Details:
			When activated, this will make the page's `<html>` element be the fullscreen element, *not* `<tw-story>`. This is because, in most browsers,
			removing the fullscreen element from the page, however briefly, will deactivate fullscreen mode. Since the `(enchant:)` macro, when given ?Page,
			will often need to wrap `<tw-story>` in another element, those macro calls will deactivate fullscreen mode if `<tw-story>` was the fullscreen element.
			So, if you have edited the compiled HTML to add elements before and after it, such as a navigation bar, that will remain visible while the story
			is in fullscreen mode. Additionally, this means that the Debug Mode panel is still visible when fullscreen mode is activated.

			If the third string is present, and the browser reports to Harlowe that fullscreen mode is unavailable, then a string visually identical to
			a broken link will be displayed, using the third string as its text. This is, by default, a red link that cannot be clicked.

			Currently, there is no special functionality or error reporting when the browser reports that fullscreen mode is available, but the attempt
			to switch to fullscreen mode fails. In that case, the link will simply appear to do nothing.

			It is possible to "force" the player into fullscreen by nesting the code for a (goto:) call inside the second string, such as by
			`(link-fullscreen: "Continue.", "(goto:'Area 2')")`, which causes the (goto:) to be run only when the browser enters fullscreen mode,
			then immediately leaving the passage and continuing the story. This is NOT recommended, however, because browsers currently (as of 2020) allow
			the user to exit fullscreen mode at any time of their own accord, so a player that's not willing to enter fullscreen mode would simply exit
			it soon afterward, and this construction would ultimately accomplish very little.

			Note that (link-fullscreen:), unlike (link:), doesn't accept a changer value to style the produced link. This is because, as
			this produces a command (and not a changer), you can simply attach changers to the front of it to style the link.

			See also:
			(link-goto:), (link-undo:), (cycling-link:), (icon-fullscreen:), (checkbox-fullscreen:)

			Added in: 3.2.0
			#links 8
		*/
		("link-fullscreen",
			(enableText, disableText) => {
				if (!enableText || !disableText) {
					return TwineError.create("datatype", emptyLinkTextMessages[0]);
				}
			},
			(cd, section, enableText, disableText) => {
				/*
					The link text is updated every time the fullscreenEvent below is fired. And, it checks if fullscreen is available every time,
					just in case something caused it to be disabled.
				*/
				const linkText = () =>
					document.fullscreenEnabled || document.msFullscreenEnabled
						/*
							This currently reveals its purpose in the player-readable DOM by including a 'fullscreen' attribute,
							which is used by the "click.passage-link" event handler.
						*/
						? '<tw-link tabindex=0 fullscreen>' + (document.fullscreenElement || document.msFullscreenElement ? disableText : enableText) + '</tw-link>'
						/*
							This is a broken link, simply because there's no other Harlowe primitives that convey "something that should be clickable, but isn't".
						*/
						: (disableText ? '<tw-broken-link>' + disableText + '</tw-broken-link>' : '');
				/*
					As this is a deferred rendering macro, the current tempVariables
					object must be stored for reuse, as the section pops it when normal rendering finishes.
				*/
				const {tempVariables} = section.stackTop;
				/*
					All links need to store their section as jQuery data, so that clickLinkEvent can
					check if the section is blocked (thus preventing clicks).
				*/
				cd.data.section = section;
				cd.data.fullscreenEvent = () => {
					/*
						Because arbitrary code can be in the link text, the text should only be updated when the section is unblocked.
					*/
					(document.fullscreenEnabled || document.msFullscreenEnabled) && cd.data.section.whenUnblocked(() => {
						/*
							Display the next label, reusing the ChangeDescriptor that the original run received.
						*/
						const cd2 = assign({}, cd, {
							append: 'replace',
							source: linkText(),
							transitionDeferred: false,
						});
						/*
							Since cd2's target SHOULD equal expr, passing anything as the second argument won't do anything useful
							(much like how the first argument is overwritten by cd2's source). So, null is given.
						*/
						cd.section.renderInto("", null, cd2, tempVariables);
					});
				};
				return assign(cd, {
					source: linkText(),
					transitionDeferred: true,
				});
			},
			[String,String,optional(String)]
		);


	/*d:
		(link-reveal-goto: String, [String], [Changer]) -> Changer
		
		This is a convenient combination of the (link-reveal:) and (go-to:) macros, designed to let you run commands like (set:)
		just before going to another passage. The first string is the link text, and the second is the passage name. An optional
		changer, with which to style the link, can also be provided.
		
		Example usage:
		 * `(link-reveal-goto: "Study English", "Afternoon 1")[(set:$eng to it + 1)]` will create a link reading "Study English"
		which, when clicked, adds 1 to the $eng variable using (set:), and then goes to the passage "Afternoon 1".
		 * `(link-reveal-goto: "Fight the King of England", "Death")[(dialog:"You asked for it!")]` will create a link reading
		 "Fight the King of England" which, when clicked, displays an alert using (dialog:), and then goes to the passage "Death".
		
		Details:

		Note that the (visited:) macro can be used for checking if a passage was visited earlier in the game. So, you don't necessarily need to
		use this macro to record that the player has visited the destination passage. Generally, you should use this macro only if you
		need to record that the player used *this specific link* to visit that passage.

		Note also that there's no way to "cancel" traveling to the new passage once the link is clicked, unless you include (go-to:),
		(undo:), or another such macro inside the hook.
		
		See also:
		(link-reveal:), (link:), (link-goto:), (click:)
		
		Added in: 3.0.0
		#links 6
	*/
	Macros.addChanger(["link-reveal-goto"],
		(section, text, passage, changer) => {
			if (!text) {
				return TwineError.create("datatype", ...emptyLinkTextMessages);
			}
			/*
				To make sense of this macro's odd type signature, we need to check if the passage
				name is omitted, but the changer isn't.
			*/
			if (ChangerCommand.isPrototypeOf(passage)) {
				if (ChangerCommand.isPrototypeOf(changer)) {
					return TwineError.create("datatype", "You mustn't give two changers to (link-reveal-goto:)");
				}
				changer = passage;
				passage = undefined;
			}
			/*
				Perform the usual changer type-check that's used for (link:) etc.
			*/
			if (changer && !changer.canEnchant) {
				return TwineError.create(
					"datatype",
					"The changer given to (link-reveal-goto:) can't include a revision, enchantment, or interaction changer like (replace:), (click:), or (link:)."
				);
			}
			/*
				Being a variant of (link-goto:), this uses the same rules for passage name computation.
			*/
			let error;
			({text, passage, error} = passageNameParse(section, text, passage));
			if (error) {
				return error;
			}
			/*
				Because this is a desugaring of the link syntax, like (link-goto:), we should create
				a broken link only when the changer is attached.
			*/
			return ChangerCommand.create("link-reveal-goto", [text,passage,changer].filter(e => e !== undefined), null, /*canEnchant*/ false);
		},
		(desc, text, passageName, changer) => {
			/*
				As explained above, we create the broken link now, and dispose of
				whatever the contained hook had.
			*/
			if (!Passages.hasValid(passageName)) {
				desc.source = '<tw-broken-link passage-name="' + Utils.escape(passageName) + '">'
					+ text + '</tw-broken-link>';
				return;
			}
			/*
				Previously visited passages may be styled differently compared
				to unvisited passages.
			*/
			const visited = (State.passageNameVisited(passageName));
			/*
				As this is a deferred rendering macro, the current tempVariables
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
				As with (link:), it is necessary to crate a separate ChangeDescriptor for the created link.
			*/
			const descriptor = ChangeDescriptor.create({
				source: '<tw-link tabindex=0 ' + (visited > 0 ? 'class="visited" ' : '') + '>' + text + '</tw-link>',
				target: desc.target,
				append: "replace",
				data: {
					section: desc.section,
					append: "replace",
					clickEvent: link => {
						desc.enablers = desc.enablers.filter(e => e.descriptor !== descriptor);
						/*
							It may seem pointless to unwrap the link, now that we're going to
							somewhere else, but this change could be observed if a modal (alert:)
							was displayed by the innerSource.
						*/
						link.contents().unwrap();
						desc.section.renderInto("", null, desc, tempVariables);
						/*
							Having revealed, we now go-to, UNLESS the section was blocked, which either signifies
							a blocking macro like (prompt:) is active, or a different (go-to:) was activated.
							Much as in doExpressions() in section.renderInto(), we can check for an early exit via the DOM.
						*/
						desc.section.whenUnblocked(() => Engine.goToPassage(passageName, {
							transition: desc.data.passageT8n,
						}));
					},
				},
			});
			desc.enablers = (desc.enablers || []).concat({ descriptor, changer });
			return desc;
		},
		[String, optional(either(ChangerCommand, String)), optional(ChangerCommand)]
	);
});
