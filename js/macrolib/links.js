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
	$(() => $(Utils.storyElement).on(
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
				event = link.closest('tw-expression, tw-hook').data('clickEvent');

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
	
	[
		/*d:
			(link: String) -> Changer
			Also known as: (link-replace:)
			
			Makes a changer to create a special link that can be used to show a hook.
			
			Example usage:
			`(link: "Stake")[The dracula crumbles to dust.]` will create a link reading "Stake"
			which, when clicked, disappears and shows "The dracula crumbles to dust."
			
			Rationale:
			
			As you're aware, links are what the player uses to traverse your story. However,
			links can also be used to simply display text or run macros inside hooks. Just
			attach the (link:) macro to a hook, and the entire hook will not run or appear at all until the
			player clicks the link.
			
			Note that this particular macro's links disappear when they are clicked - if you want
			their words to remain in the text, consider using (link-reveal:).
			
			Details:
			This creates a link which is visually indistinguishable from normal passage links.
			
			See also:
			(link-reveal:), (link-repeat:), (link-goto:), (click:)

			#links 1
		*/
		["link", "link-replace"],
		/*d:
			(link-reveal: String) -> Changer
			
			Makes a changer to create a special link that shows a hook, keeping the link's
			text visible after clicking.
			
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
			
			If the link text contains formatting syntax, such as "**bold**", then it will be retained
			when the link is demoted to text.
			
			See also:
			(link:), (link-repeat:), (link-goto:), (click:)

			#links 2
		*/
		["link-reveal"],
		/*d:
			(link-repeat: String) -> Changer
			
			Makes a changer to create a special link that shows a hook, and, when clicked again,
			re-runs the hook, appending its contents again.
			
			Example usage:
			`(link-repeat: "Add cheese")[(set:$cheese to it + 1)]` will create a link reading "Add cheese"
			which, when clicked, adds 1 to the $cheese variable using (set:), and can be clicked repeatedly.
			
			Rationale:
			
			This is similar to (link:), but allows the created link to remain in the passage
			after it is clicked. It can be used to make a link that displays more text after
			each click, or which must be clicked multiple times before something can happen (using (set:)
			and (if:) to keep count of the number of clicks).
			
			Details:
			This creates a link which is visually indistinguishable from normal passage links.
			Each time the link is clicked, the text and macros printed in the previous run are
			appended.
			
			See also:
			(link-reveal:), (link:), (link-goto:), (click:)
			
			#links 3
		*/
		["link-repeat"]
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
					Only (link-replace:) removes the link on click (by using the "replace"
					append method) - the others merely append.
				*/
				desc.append = arr[0] === "link" ? "replace" : "append";
				desc.transitionDeferred = true;
				desc.data.clickEvent = (link) => {
					/*
						Only (link-reveal:) turns the link into plain text:
						the others either remove it (via the above) or leave it be.
					*/
					if (arr[0] === "link-reveal") {
						link.contents().unwrap();
					}
					desc.source = desc.innerSource + "";
					desc.transitionDeferred = false;
					desc.section.renderInto("", null, desc);
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

			* The link syntax lets you supply a fixed text string for the link, and an expression for the destination
			passage's name. However, it does not provide any other means of computing the link. (link-goto:) also
			allows the link text to be any expression - so, something like `(link-goto: "Move " + $name + "to the cellar", "Cellar")`
			can be written.

			* The resulting command from this macro, like all commands, can be saved and used elsewhere.
			If you have a complicated link you need to use in several passages, you could (set:) it to a variable and use that variable
			in its place.

			Details:
			As a bit of trivia... the Harlowe engine actually converts all standard links into (link-goto:) macro calls internally -
			the link syntax is, essentially, a syntactic shorthand for (link-goto:).

			See also:
			(link:), (link-reveal:), (link-repeat:), (link-undo:), (goto:)

			#links 4
		*/
		(["link-goto"],
			/*
				Return a new (link-goto:) object.
			*/
			(text, passage) => {
				if (!text) {
					return TwineError.create("macrocall", ...emptyLinkTextMessages);
				}
				if (!passage) {
					passage = text;
				}
			},
			(cd, section, text, passage) => {
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
				const passageName = section.evaluateTwineMarkup(Utils.unescape(passage || text));
				
				let source;
				/*
					If a <tw-error> was returned by evaluateTwineMarkup, replace the link with it.
				*/
				if (passageName instanceof $) {
					/*
						section.runExpression() is able to accept jQuery objects
						being returned from TwineScript_Print().
					*/
					source = passageName;
				}
				/*
					Check that the passage is indeed available.
				*/
				if (!Passages.has(passageName)) {
					/*
						Since the passage isn't available, create a broken link.
						TODO: Maybe this should be an error as well??
					*/
					source = '<tw-broken-link passage-name="' + Utils.escape(passageName) + '">'
						+ text + '</tw-broken-link>';
				}
				/*
					Previously visited passages may be styled differently compared
					to unvisited passages.
				*/
				const visited = (State.passageNameVisited(passageName));
				
				/*
					This formerly exposed the passage name on the DOM in a passage-name attr,
					but as of 2.2.0, it no longer does. (Debug mode can still view the name due to
					an extra title added to the enclosing <tw-expression> by Renderer).
				*/
				source = source || '<tw-link tabindex=0 ' + (visited > 0 ? 'class="visited" ' : '')
					+ '">' + text + '</tw-link>';
				/*
					Instead, the passage name is stored on the <tw-expression>, to be retrieved by clickEvent() above.
				*/
				cd.data.linkPassageName = passageName;
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

			#links 6
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
			Ah. You remember her eldest well - [a frail, anxious child]<more|. Unlikely to raise too much of a fuss.

			(click-append: ?more)[, constantly frowning, mumbling every word they utter, flinching at the slightest noise]
			```

			Conversely, typical (show:) usage resembles the following, where the inserted text is a continuation of the passage's prose,
			and is written together with it:

			```
			"Look, it's important to comment even the simplest code...|more)[ You might remember what it does now, but not at 4:50 PM on Friday
			afternoon, when you're about to push to production and a runtime error shows up in it.]"

			You (link-reveal:"struggle to listen.")[(show: ?more)]
			```

			The (link-show:) macro provides a convenient shorthand for the latter example, letting you write the final line as
			`You (link-show: "struggle to listen.", ?more)`.

			Details:
			As with most link macros, providing this with an empty link text string will result in an error.

			As with (show:) and (click:), providing this with a hook which is already visible, or which doesn't even exist,
			will NOT produce an error, but simply do nothing.

			See also:
			(show:), (link-reveal:), (click-append:)

			#links 6
		*/
		("link-show",
			(text) => {
				if (!text) {
					return TwineError.create("macrocall", emptyLinkTextMessages[0]);
				}
			},
			(cd, section, text, ...hooks) => {
				cd.data.clickEvent = (link) => {
					link.contents().unwrap();
					hooks.forEach(hook => hook.forEach(section, elem => {
						const hiddenSource = elem.data('hiddenSource');
						if (hiddenSource === undefined) {
							return;
						}
						section.renderInto("", null,
							assign({}, cd, { source: hiddenSource, target: elem, transitionDeferred: false })
						);
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

		Note that there is already an idiom for checking if a passage was visited earlier in the game: `(history:) contains "Passage name"`
		checks if the passage named "Passage name" was visited. So, you don't necessarily need to use this macro to record that the player
		has visited the destination passage.

		Note also that there's no way to "cancel" traveling to the new passage once the link is clicked, unless you include (go-to:),
		(undo:) or another such macro is inside the hook.
		
		See also:
		(link-reveal:), (link:), (link-goto:), (click:)
		
		#links 5
	*/
	Macros.addChanger(["link-reveal-goto"],
		(section, text, passage) => {
			if (!text) {
				return TwineError.create("macrocall", ...emptyLinkTextMessages);
			}
			if (!passage) {
				passage = text;
			}
			/*
				Being a variant of (link-goto:), this uses the same rules for passage name computation
				from TwineMarkup, as described in that macro.
			*/
			const passageName = section.evaluateTwineMarkup(Utils.unescape(passage || text));
			/*
				If TwineMarkup rendering produced an error, return it.
				<tw-error> elements have the original TwineError object stashed on them, which we
				can retrieve now.
			*/
			if (passageName instanceof $) {
				return passageName.data('TwineError');
			}
			/*
				We could check for the passage's existence here, but because this is a desugaring of
				the link syntax, like (link-goto:), we should create a broken link instead, when
				the changer is attached.
			*/
			return ChangerCommand.create("link-reveal-goto", [text || passage, passageName]);
		},
		(desc, text, passageName) => {
			/*
				As explained above, we create the broken link now, and dispose of
				whatever the contained hook had.
			*/
			if (!Passages.has(passageName)) {
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
				desc.section.renderInto(desc.innerSource + "", null, desc);
				/*
					Having revealed, we now go-to, UNLESS an early exit was invoked, which signifies a different (go-to:) was
					activated.
					Much as in doExpressions() in section.renderInto(), we can check for an early exit via the DOM.
				*/
				if (!desc.target.find('[earlyexit]').length) {
					Engine.goToPassage(passageName, { transitionOut: desc.data.t8nDepart, transitionIn: desc.data.t8nArrive });
				}
			};
		},
		[String, optional(String)]
	);
});
