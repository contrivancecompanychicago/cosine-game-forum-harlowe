"use strict";
define(['jquery', 'macros', 'utils', 'utils/selectors', 'state', 'passages', 'engine', 'datatypes/changercommand', 'datatypes/hookset', 'internaltypes/twineerror'],
($, Macros, Utils, Selectors, State, Passages, Engine, ChangerCommand, HookSet, TwineError) => {
	/*
		This module defines the behaviour of links in Harlowe - both
		the normal passage links, and the (link:) macro's links.
		But, this does not include (click:) enchantments, which
		are technically not links (but behave identically).
	*/
	const {optional,rest} = Macros.TypeSignature;
	const emptyLinkTextMessages = ["Links can't have empty strings for their displayed text.",
		"In the link syntax, a link's displayed text is inside the [[ and ]], and on the non-pointy side of the -> or <- arrow if it's there."];
	//const emptyPassageNameMessages = ["Passage links must have a passage name.",
	//	"In the link syntax, a link's passage name is inside the [[ and ]], and on the pointy side of the -> or <- arrow if it's there."];
	const {assign} = Object;

	/*
		Register the event that this enchantment responds to
		in a jQuery handler.
		
		Sadly, since there's no permitted way to attach a jQuery handler
		directly to the triggering element, the "actual" handler
		is "attached" via a jQuery .data() key, and must be called
		from this <tw-story> handler.
	*/
	Utils.onStartup(() => $(Utils.storyElement).on(
		/*
			The jQuery event namespace is "passage-link".
		*/
		"click.passage-link",
		Selectors.internalLink,
		function clickLinkEvent() {
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
					But first of all, don't do anything if control flow in any section is currently blocked
					(which means the click input should be dropped).
				*/
				section = closest.data('section');
			if (section && section.stackTop && section.stackTop.blocked) {
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
			let transitionOut = expression.data('t8nDepart');
			let transitionIn = expression.data('t8nArrive');
			let transitionTime = expression.data('t8nTime');
			/*
				$().find() SHOULD return the tw-enchantments in ascending depth order.
			*/
			expression.find('tw-enchantment').each((_,e) => {
				transitionOut = $(e).data('t8nDepart') || transitionOut;
				transitionIn = $(e).data('t8nArrive') || transitionIn;
				transitionTime = $(e).data('t8nTime') !== undefined ? $(e).data('t8nTime') : transitionTime;
			});

			if (next) {
				// TODO: stretchtext
				Engine.goToPassage(next, { transitionOut, transitionIn, transitionTime });
				return;
			}
			/*
				Or, a (link-undo:) link.
			*/
			if (link.is('[undo]')) {
				Engine.goBack({ transitionOut, transitionIn, transitionTime });
				return;
			}
		}
	));

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
			(link: String) -> Changer
			Also known as: (link-replace:)
			
			Makes a changer to create a special link that can be used to show a hook.
			
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
			This creates a link which is visually indistinguishable from normal passage links.
			
			See also:
			(link-reveal:), (link-rerun:), (link-repeat:), (link-goto:), (click:), (more:)

			Added in: 1.0.0
			#links 1
		*/
		["link", "link-replace"],
		/*d:
			(link-reveal: String) -> Changer
			
			Makes a changer to create a special link that shows a hook, keeping the link's
			text visible after clicking, or only removing a portion of it.
			
			Example usage:
			`(link-reveal: "Heart")[broken]` will create a link reading "Heart"
			which, when clicked, changes to plain text, and shows "broken" after it.
			
			Rationale:
			
			This is similar to (link:), but allows the text of the link to remain in the passage
			after it is clicked. It allows key words and phrases in the passage to expand and
			reveal more text after themselves. Simply attach it to a hook, and the hook will only be
			revealed when the link is clicked.
			
			Details:
			This creates a link which is visually indistinguishable from normal passage links.

			If you want to make only a certain portion of the link text disappear when the whole link is clicked,
			simply place that portion inside a plain hook, one with no name and no macros attached to the front:
			`(link-reveal:"She gasped[.]")[and ran over to me.]` will create a link reading "She gasped." that becomes
			"She gasped and ran over to me." when clicked. This can be used to make the revealed text flow more naturally
			into the link text, by removing or adjusting punctuation.
			
			If the link text contains formatting syntax, such as "**bold**", then it will be retained
			when the link is demoted to text.
			
			See also:
			(link:), (link-rerun:), (link-repeat:), (link-goto:), (click:), (more:)

			Added in: 1.2.0
			#links 2
		*/
		["link-reveal"],
		/*d:
			(link-repeat: String) -> Changer
			
			Makes a changer to create a special link that shows a hook, and, when clicked again,
			repeats the hook, appending its contents again.
			
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
			
			Details:
			This creates a link which is visually indistinguishable from normal passage links.

			If you want to make a certain portion of the link text disappear when the link is clicked,
			simply put that section of the link text in a plain hook, one with no name and no macros attached
			to the front, as per (link-reveal:). Note that this text will disappear on the first click, and won't
			reappear or change on subsequent clicks.
			
			See also:
			(link-rerun:), (link-reveal:), (link:), (link-goto:), (click:)
			
			Added in: 1.2.0
			#links 3
		*/
		["link-repeat"],
		/*d:
			(link-rerun: String) -> Changer
			
			Makes a changer to create a special link that shows a hook, and, when clicked again,
			re-runs the hook, replacing its contents with a fresh run of its code.
			
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

			Details:
			This creates a link which is visually indistinguishable from normal passage links.

			If you want to make a certain portion of the link text disappear when the link is clicked,
			simply put that section of the link text in a plain hook, one with no name and no macros attached
			to the front, as per (link-reveal:). Note that this text will disappear on the first click, and won't
			reappear or change on subsequent clicks.
			
			Added in: 3.2.0
			#links 4
		*/
		["link-rerun"],
	].forEach(arr =>
		Macros.addChanger(arr,
			(_, expr) => {
				if (!expr) {
					return TwineError.create("macrocall", emptyLinkTextMessages[0]);
				}
				return ChangerCommand.create(arr[0], [expr]);
			},
			(desc, text) => {
				/*
					This check ensures that multiple concatenations of (link:) do not overwrite
					the original source with their successive '<tw-link>' substitutions.
				*/
				if (!desc.innerSource) {
					desc.innerSource = desc.source;
				}
				desc.source = '<tw-link tabindex=0>' + text + '</tw-link>';
				/*
					Only (link-replace:) and (link-rerun:) removes the link on click (by using the "replace"
					append method) - the others merely append.
				*/
				desc.append = (arr[0] === "link" || arr[0] === "link-rerun") ? "replace" : "append";
				desc.transitionDeferred = true;
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
					(desc.section && desc.section.stack[0]) ? desc.section.stack[0].tempVariables : Object.create(null);
				/*
					All links need to store their section as jQuery data, so that clickLinkEvent can
					check if the section is blocked (thus preventing clicks).
				*/
				desc.data.section = desc.section;
				desc.data.clickEvent = (link) => {
					/*
						Only (link-reveal:) turns the link into plain text:
						the others either remove it (via the above) or leave it be.
					*/
					if (arr[0] === "link-reveal") {
						link.contents().unwrap();
					}
					/*
						(link-rerun:) replaces everything in the hook, but leaves
						the link, so that the replacement can be repeated. It does this by removing the link,
						then reattaching it after rendering.
					*/
					let parent;
					if (arr[0] === "link-rerun") {
						/*
							Just to be sure that the link returns to the same DOM element, we
							save the element in particular here.
						*/
						parent = link.parent();
						link.detach();
					}
					desc.source = desc.innerSource + "";
					desc.transitionDeferred = false;
					desc.section.renderInto("", null, desc, tempVariables);
					if (arr[0] === "link-rerun") {
						parent.prepend(link);
					}
				};
			},
			[String]
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
			This command should not be attached to a hook.
			
			Example usage:
			* `(link-goto: "Enter the cellar", "Cellar")` is approximately the same as `[[Enter the cellar->Cellar]]`.
			* `(link-goto: "Cellar")` is the same as `[[Cellar]]`.

			Rationale:
			This macro serves as an alternative to the standard link syntax (`[[Link text->Destination]]`), but has a couple of
			slight differences.

			* The link syntax lets you supply a fixed text string for the link, and a markup expression for the destination
			passage's name. (link-goto:) also allows the link text to be any expression - so, something like
			`(link-goto: "Move " + $name + "to the cellar", "Cellar")` can be written.

			* The resulting command from this macro, like all commands, can be saved and used elsewhere.
			If you have a complicated link you need to use in several passages, you could (set:) it to a variable and use that variable
			in its place.

			Details:
			As a bit of trivia... the Harlowe engine actually converts all standard links into (link-goto:) macro calls internally -
			the link syntax is, essentially, a syntactic shorthand for (link-goto:).

			See also:
			(link:), (link-reveal:), (link-undo:), (goto:)

			Added in: 1.0.0
			#links 5
		*/
		(["link-goto"],
			/*
				Return a new (link-goto:) object.
			*/
			(text) => {
				if (!text) {
					return TwineError.create("macrocall", ...emptyLinkTextMessages);
				}
			},
			(cd, section, text, passage) => {
				/*
				*/
				let error;
				({text, passage, error} = passageNameParse(section, text, passage));
				if (error) {
					return error;
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
			(link-undo: String) -> Command

			Takes a string of link text, and produces a link that, when clicked, undoes the current turn and
			sends the player back to the previously visited passage. The link appears identical to a typical
			passage link.
			This command should not be attached to a hook.

			Example usage:
			`(link-undo:"Retreat")` behaves the same as `(link:"Retreat")[(undo: )]`.

			Rationale:
			The ability to undo the player's last turn, as an alternative to (go-to:), is explained in the documentation
			of the (undo:) macro. This macro provides a shorthand for placing (undo:) inside a (link:) attached hook.

			You may, as part of customising your story, be using (replace:) to change the ?sidebar, and remove its
			default "undo" link. If so, you can selectively provide undo links at certain parts of your story instead,
			by using this macro.

			Details:
			As with (undo:), if this command is used on the play session's first turn, an error will be produced (as there
			is yet nothing to undo at that time). You can check which turn it is by examining the `length` of the (history:)
			array.

			See also:
			(undo:), (link-goto:)

			Added in: 2.0.0
			#links 7
		*/
		("link-undo",
			(text) => {
				if (!text) {
					return TwineError.create("macrocall", emptyLinkTextMessages[0]);
				}
			},
			(cd, section, text) => {
				/*
					Users of (link-undo:) should always check that (history:) is longer than 1.
					(This isn't in the checkFn because this check only matters at Run() time).
				*/
				if (State.pastLength < 1) {
					return TwineError.create("macrocall", "I can't use (link-undo:) on the first turn.");
				}
				/*
					All links need to store their section as jQuery data, so that clickLinkEvent can
					check if the section is blocked (thus preventing clicks).
				*/
				cd.data.section = section;
				/*
					This currently reveals its purpose in the player-readable DOM by including an 'undo' attribute,
					which is used by the "click.passage-link" event handler.
				*/
				return assign(cd, {
					source: '<tw-link tabindex=0 undo>' + text + '</tw-link>',
					transitionDeferred: true,
				});
			},
			[String]
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
			"Look, it's important to comment even the simplest code...|extra)[ You might remember what it does now, but not at 4:50 PM on Friday
			afternoon, when you're about to push to production and a runtime error shows up in it.]"

			You (link-reveal:"struggle to listen.")[(show: ?extra)]
			```

			The (link-show:) macro provides a convenient shorthand for the latter example, letting you write the final line as
			`You (link-show: "struggle to listen.", ?more)`.

			Details:
			If you want to make a certain portion of the link text disappear when the whole link is clicked,
			simply place that portion inside a plain hook, one with no name and no macros attached to the front, as per (link-reveal:).
			`(link-show:"[Reply diplomatically.]", ?reply)` makes a link reading "Reply diplomatically." that disappears when clicked.

			As with most link macros, providing this with an empty link text string will result in an error.

			As with (show:) and (click:), providing this with a hook which is already visible, or which doesn't even exist,
			will NOT produce an error, but simply do nothing. Also, showing a hook that was hidden with (hide:) will not re-run the
			macros contained within, but simply make visible the hook as it was.

			See also:
			(show:), (link-reveal:), (click-append:), (more:)

			Added in: 3.0.0
			#links 8
		*/
		("link-show",
			(text) => {
				if (!text) {
					return TwineError.create("macrocall", emptyLinkTextMessages[0]);
				}
			},
			(cd, section, text, ...hooks) => {
				const [{tempVariables}] = section.stack;
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
							section.renderInto("", null,
								assign({}, cd, { source: hiddenSource, target: elem, transitionDeferred: false }),
								tempVariables
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
		);


	/*d:
		(link-reveal-goto: String, [String]) -> Changer
		
		This is a convenient combination of the (link-reveal:) and (go-to:) macros, designed to let you run commands like (set:)
		just before going to another passage. The first string is the link text, and the second is the passage name.
		
		Example usage:
		 * `(link-reveal-goto: "Study English", "Afternoon 1")[(set:$eng to it + 1)]` will create a link reading "Study English"
		which, when clicked, adds 1 to the $eng variable using (set:), and then goes to the passage "Afternoon 1".
		 * `(link-reveal-goto: "Fight the King of England", "Death")[(alert:"You asked for it!")]` will create a link reading
		 "Fight the King of England" which, when clicked, displays an alert using (alert:), and then goes to the passage "Death".
		
		Details:

		Note that there is already an idiom for checking if a passage was visited earlier in the game: `(history: ) contains "Passage name"`
		checks if the passage named "Passage name" was visited. So, you don't necessarily need to use this macro to record that the player
		has visited the destination passage.

		Note also that there's no way to "cancel" traveling to the new passage once the link is clicked, unless you include (go-to:),
		(undo:) or another such macro is inside the hook.
		
		See also:
		(link-reveal:), (link:), (link-goto:), (click:)
		
		Added in: 3.0.0
		#links 6
	*/
	Macros.addChanger(["link-reveal-goto"],
		(section, text, passage) => {
			if (!text) {
				return TwineError.create("macrocall", ...emptyLinkTextMessages);
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
			return ChangerCommand.create("link-reveal-goto", [text, passage]);
		},
		(desc, text, passageName) => {
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
				All of the following assigned properties are those assigned by (link-reveal:).
			*/
			if (!desc.innerSource) {
				desc.innerSource = desc.source;
			}
			/*
				Previously visited passages may be styled differently compared
				to unvisited passages.
			*/
			const visited = (State.passageNameVisited(passageName));
			desc.source = '<tw-link tabindex=0 ' + (visited > 0 ? 'class="visited" ' : '') + '>' + text + '</tw-link>';
			desc.append = "append";
			desc.transitionDeferred = true;
			/*
				As this is a deferred rendering macro, the current tempVariables
				object must be stored for reuse, as the section pops it when normal rendering finishes.
			*/
			const [{tempVariables}] = desc.section.stack;
			/*
				All links need to store their section as jQuery data, so that clickLinkEvent can
				check if the section is blocked (thus preventing clicks).
			*/
			desc.data.section = desc.section;
			desc.data.clickEvent = (link) => {
				desc.source = desc.innerSource;
				/*
					It may seem pointless to unwrap the link, now that we're going to
					somewhere else, but this change could be observed if a modal (alert:)
					was displayed by the innerSource.
				*/
				link.contents().unwrap();
				/*
					This technically isn't needed if the goToPassage() call below fires (that is, in normal circumstances),
					but its absence is observable if an error is displayed, so it might as well be included.
				*/
				desc.transitionDeferred = false;
				desc.section.renderInto(desc.innerSource + "", null, desc, tempVariables);
				/*
					Having revealed, we now go-to, UNLESS the section was blocked, which either signifies
					a blocking macro like (prompt:) is active, or a different (go-to:) was activated.
					Much as in doExpressions() in section.renderInto(), we can check for an early exit via the DOM.
				*/
				desc.section.whenUnblocked(() => Engine.goToPassage(passageName, { transitionOut: desc.data.t8nDepart, transitionIn: desc.data.t8nArrive }) );
			};
		},
		[String, optional(String)]
	);
});
