"use strict";
define(['jquery', 'requestAnimationFrame', 'macros', 'utils', 'utils/selectors', 'state', 'passages', 'engine', 'internaltypes/twineerror', 'datatypes/hookset', 'datatypes/varbind', 'utils/operationutils'],
($, requestAnimationFrame, Macros, {storyElement, toJSLiteral, unescape}, Selectors, State, Passages, Engine, TwineError, HookSet, VarBind, {printBuiltinValue}) => {
	
	/*d:
		Command data
		
		Commands are special kinds of data which perform an effect when they're placed in the passage.
		Most commands are created from macros placed directly in the passage, but, like all forms of
		data, they can be saved into variables using (set:) and (put:), and stored for later use.

		Macros that produce commands include (alert:), (save-game:), (load-game:), and more.

		Commands like (display:), (print:), (link:), (show:) and so on are used to print data or an interactive
		element into the passage. These elements can be styled like hooks, by attaching changers to the macro,
		as if it was a hook.

		In addition to their visual appearance, you can also change what passage transitions links use,
		by applying (t8n-depart:) and (t8n-arrive:). (Note that since normal passage links are identical to the
		(link-goto:) macro, you can also attach changers to passage links.)
	*/
	const {Any, rest, either, optional} = Macros.TypeSignature;
	const {assign} = Object;
	
	const hasStorage = !!localStorage
		&& (() => {
			/*
				This is, to my knowledge, the only surefire way of measuring localStorage's
				availability - on some browsers, setItem() will throw in Private Browsing mode.
			*/
			try {
				localStorage.setItem("test", '1');
				localStorage.removeItem("test");
				return true;
			} catch (e) {
				return false;
			}
		})();

	/*
		As localstorage keys are shared across domains, this prefix, using the current story's IFID,
		is necessary to ensure that multiple stories on a domain have their save files properly namespaced.
	*/
	function storagePrefix(text) {
		return "(" + text + " " + Engine.options.ifid + ") ";
	}
	
	Macros.addCommand
		/*d:
			(display: String) -> Command
			
			This command writes out the contents of the passage with the given string name.
			If a passage of that name does not exist, this produces an error.
			
			Example usage:
			`(display: "Cellar")` prints the contents of the passage named "Cellar".
			
			Rationale:
			Suppose you have a section of code or source that you need to include in several different
			passages. It could be a status display, or a few lines of descriptive text. Instead of
			manually copy-pasting it into each passage, consider placing it all by itself in another passage,
			and using (display:) to place it in every passage. This gives you a lot of flexibility: you can,
			for instance, change the code throughout the story by just editing the displayed passage.
			
			Details:
			Text-targeting macros (such as (replace:)) inside the
			displayed passage will affect the text and hooks in the outer passage
			that occur earlier than the (display:) command. For instance,
			if passage A contains `(replace:"Prince")[Frog]`, then another passage
			containing `Princes(display:'A')` will result in the text `Frogs`.
			
			Like all commands, this can be set into a variable. It's not particularly
			useful in that state, but you can use that variable in place of that command,
			such as writing `$var` in place of `(display: "Yggdrasil")`.

			#basics 5
		*/
		("display",
			(name) => {
				/*
					Test for the existence of the named passage in the story.
					This and the next check must be made now, because the Passages
					datamap could've been tinkered with since this was created.
				*/
				if (!Passages.has(name)) {
					return TwineError.create("macrocall",
						"I can't (display:) the passage '"
						+ name
						+ "' because it doesn't exist."
					);
				}
			},
			(cd, _, name) => assign(cd, { source: unescape(Passages.get(name).get('source')) }),
			[String])
		
		/*d:
			(print: Any) -> Command
			This command prints out any single argument provided to it, as text.
			
			Example usage:
			`(print: $var + "s")`
			
			Details:
			It is capable of printing things which (str:) cannot convert to a string,
			such as changer commands - but these will usually become bare descriptive
			text like `[A (font: ) command]`. You may find this useful for debugging purposes.
			
			This command can be stored in a variable instead of being performed immediately.
			Notably, the expression to print is stored inside the command, instead of being
			re-evaluated when it is finally performed. So, a passage
			that contains:
			```
			(set: $name to "Dracula")
			(set: $p to (print: "Count " + $name))
			(set: $name to "Alucard")
			$p
			```
			will still result in the text `Count Dracula`. This is not particularly useful
			compared to just setting `$p` to a string, but is available nonetheless.
			
			See also:
			(str:), (display:)

			#basics 4
		*/
		("print",
			() => {},
			(cd, _, val) =>
				/*
					The printBuiltinValue() call can call commands' TwineScript_Print() method,
					so it must be withheld until here, so that wordings like (set: $x to (print:(goto:'X')))
					do not execute the command prematurely.
				*/
				assign(cd, { source: printBuiltinValue(val) }),
			[Any])

		/*d:
			(go-to: String) -> Command
			This command stops passage code and sends the player to a new passage.
			If the passage named by the string does not exist, this produces an error.
			
			Example usage:
			`(go-to: "The Distant Future")`
			
			Rationale:
			There are plenty of occasions where you may want to instantly advance to a new
			passage without the player's volition. (go-to:) provides access to this ability.
			
			(go-to:) can accept any expression which evaluates to
			a string. You can, for instance, go to a randomly selected passage by combining it with
			(either:) - `(go-to: (either: "Win", "Lose", "Draw"))`.
			
			(go-to:) can be combined with (link:) to accomplish the same thing as (link-goto:):
			`(link:"Enter the hole")[(go-to:"Falling")]` However, you
			can include other macros inside the hook to run before the (go-to:), such as (set:),
			(put:) or (save-game:).
			
			Details:

			You can attach changers like (t8n-depart:) and (t8n-arrive:) to this to
			alter the transition animation used when (go-to:) activates. Other kinds of changers
			won't do anything, though.

			If it is performed, (go-to:) will "halt" the passage and prevent any macros and text
			after it from running. So, a passage that contains:
			```
			(set: $listen to "I love")
			(go-to: "Train")
			(set: $listen to it + " you")
			```
			will *not* cause `$listen` to become `"I love you"` when it runs.
			
			Going to a passage using this macro will count as a new "turn" in the game's passage history,
			much as if a passage link was clicked. If you want to go back to the previous passage,
			forgetting the current turn, then you may use (undo:).
			
			See also:
			(link-goto:), (undo:), (loadgame:)

			#links
		*/
		("go-to",
			(name) => {
				/*
					First, of course, check for the passage's existence.
				*/
				if (!Passages.has(name)) {
					return TwineError.create("macrocall",
						"I can't (go-to:) the passage '"
						+ name
						+ "' because it doesn't exist."
					);
				}
			},
			(cd, _, name) => {
				/*
					When a passage is being rendered, <tw-story> is detached from the main DOM.
					If we now call another Engine.goToPassage in here, it will attempt
					to detach <tw-story> twice, causing a crash.
					So, the change of passage must be deferred until just after
					the passage has ceased rendering.
				*/
				requestAnimationFrame(()=> Engine.goToPassage(name, { transitionOut: cd.data.t8nDepart, transitionIn: cd.data.t8nArrive }));
				/*
					But how do you immediately cease rendering the passage?
					
					This object's property name causes Section's runExpression() to
					cancel expression evaluation at that point. This means that for, say,
						(goto: "X")(set: $y to 1)
					the (set:) will not run because it is after the (goto:)
				*/
				return assign(cd, { earlyExit: true });
			},
			[String])

		/*d:
			(undo:) -> Command
			This command stops passage code and "undoes" the current turn, sending the player to the previous visited
			passage and forgetting any variable changes that occurred in this passage.

			Example usage:
			`You scurry back whence you came... (live:2s)[(undo:)]` will undo the current turn after 2 seconds.

			Rationale:
			The (go-to:) macro sends players to different passages instantly. But, it's common to want to
			send players back to the passage they previously visited, acting as if this turn never happened.
			(undo:) provides this functionality.

			By default, Harlowe offers a button in its sidebar that lets players undo at any time, going
			back to the beginning of the game session. However, if you wish to use this macro, and only permit undos
			in certain passages and occasions, you may remove the button by using (replace:) on the ?sidebar in
			a header tagged passage.

			Details:
			You can attach changers like (t8n-depart:) and (t8n-arrive:) to this to
			alter the transition animation used when (undo:) activates. Other kinds of changers
			won't do anything, though.
			
			If this is the first turn of the game session, (undo:) will produce an error. You can check which turn it is
			by examining the `length` of the (history:) array.

			Just like (go-to:), (undo:) will "halt" the passage and prevent any macros and text
			after it from running.

			See also:
			(go-to:), (link-undo:)

			#links
		*/
		("undo",
			() => {},
			(cd) => {
				if (State.pastLength < 1) {
					return TwineError.create("macrocall", "I can't (undo:) on the first turn.");
				}
				/*
					As with the (goto:) macro, the change of passage must be deferred until
					just after the passage has ceased rendering, to avoid <tw-story> being
					detached twice.
				*/
				requestAnimationFrame(()=> Engine.goBack({ transitionOut: cd.data.t8nDepart, transitionIn: cd.data.t8nArrive }));
				/*
					As with the (goto:) macro, earlyExit signals to
					Section's runExpression() to cease evaluation.
				*/
				return assign(cd, { earlyExit: true });
			},
			[])

		/*d:
			(cycling-link: [Bind], ...String) -> Command

			A command that, when evaluated, creates a cycling link - a link which does not go anywhere, but changes its own text
			to the next in a looping sequence of strings, and sets the optional bound variable to match the string value of the text.

			Example usage:
			* `(cycling-link: bind $head's hair, "Black", "Brown", "Blonde", "Red", "White")` binds the "hair" value in the $head datamap to the
			current link text.
			* `(cycling-link: "Mew", "Miao", "Mrr", "Mlem")` has no bound variable.

			Rationale:
			The cycling link is an interaction idiom popularised in Twine 1 which combines the utility of a dial input element with
			the discovery and visual consistency of a link: the player can typically only discover that this is a cycling link by clicking it,
			and can then discover the full set of labels by clicking through them. This affords a number of subtle dramatic and humourous
			possibilities, and moreover allows the link to sit comfortably among passage prose without standing out as an interface element.

			The addition of a variable bound to the link, changing to match whichever text the player finally dialed the link to, allows
			cycling links to affect subsequent passages, and thus for the link to be just as meaningful in affecting the story's course as any
			other, even though no hooks and (set:)s can be attached to them.

			Details:
			If one of the strings is empty, such as `(cycling-link: "Two eggs", "One egg", "")`, then upon reaching the empty string, the link
			will disappear permanently. If the *first* string is empty, an error will be produced (because then the link can never appear at all).

			If attempting to render one string produces an error, such as `(cycling-link: "Goose", "(print: 2 + 'foo')")`, then the error will only appear
			once the link cycles to that string.

			The bound variable will be set to the first value as soon as the cycling link is displayed - so, even if the player doesn't
			interact with the link at all, the variable will still have the intended value.

			If you want to include the current value of the bound variable in the link's series of strings, simply refer to it directly after
			the bind: `(cycling-link: bind $hat, $hat, "Beret", "Poker visor", "Tricorn")` will place $hat's current value in the series,
			and, as the first value, it will harmlessly overwrite $hat with itself (and thus leave it unchanged). Additionally, if you have
			an array of strings that you'd like to reuse for the same cycling link in multiple passages, say as
			`(set: $allHats to (a: "Helmet", "Beret", "Poker visor", "Tricorn"))`, and you'd like each cycling link to start on
			whatever matching value is currently in $hat, simply first provide $hat as the first value,
			then follow it with $allHats with $hat removed: `(cycling-link: bind $hat, $hat, ...($allHats - (a:$hat)))`. (Note that this doesn't
			preserve the order of $allHats relative to $hat, however.)

			If only one string was given to this macro, an error will be produced.

			#input
		*/
		("cycling-link",
			(...labels) => {
				if (labels[0] === "") {
					return TwineError.create("macrocall", "The first string in a (cycling-link:) can't be empty.");
				}
				if (labels.length <= (VarBind.isPrototypeOf(labels[0]) ? 2 : 1)) {
					return TwineError.create("macrocall",
						"I need two or more strings to cycle through, not just '"
						+ labels[labels.length - 1]
						+ "'."
					);
				}
			},
			(cd, _, ...labels) => {
				/*
					Often, all the params are labels. But if the first one is actually the optional VarBind,
					we need to extract it from the labels array.
				*/
				let bind;
				if (VarBind.isPrototypeOf(labels[0])) {
					bind = labels.shift();
				}
				let index = 0;

				cd.data.clickEvent = (link) => {
					/*
						Rotate to the next label, cycling around if it's past the end.
					*/
					index = (index + 1) % labels.length;
					let source = (labels[index] === "" ? "" : '<tw-link>' + labels[index] + '</tw-link>');
					/*
						If there's a bound variable, set it to the value of the next string.
						(If it returns an error, let that replace the source.)
					*/
					if (bind) {
						const result = bind.set(labels[index]);
						if (TwineError.containsError(result)) {
							/*
								As this clickEvent occurs when the interface element has already been rendered,
								we need to explicitly replace the link with the rendered error rather than return
								the error (to nobody).
							*/
							link.replaceWith(result.render(labels[index]));
							return;
						}
					}
					/*
						Display the next label, reusing the ChangeDescriptor (and thus the transitions, style changes, etc)
						that the original run received.
					*/
					const cd2 = assign({}, cd, { source, transitionDeferred: false, });
					/*
						Since cd2's target SHOULD equal link, passing anything as the second argument won't do anything useful
						(much like how the first argument is overwritten by cd2's source). So, null is given.
					*/
					cd.section.renderInto("", null, cd2);
				};
				/*
					As above, the bound variable, if present, is set to the first label. Errors resulting
					from this operation can be returned immediately.
				*/
				let source = '<tw-link>' + labels[0] + '</tw-link>';
				if (bind) {
					const result = bind.set(labels[index]);
					if (TwineError.containsError(result)) {
						return result;
					}
				}
				return assign(cd, { source, append: "replace", transitionDeferred: true, });
			},
			[either(VarBind, String), rest(String)]);

	/*
		An onchange event for <select> elements must be registered for the sake of the (dropdown:) macro,
		which is implemented similar to the link macros - the ChangeDescriptor's data.dropdownEvent indicates
		what to do when the <select> is interacted with.
	*/
	$(() => $(storyElement).on(
		/*
			The jQuery event namespace is "dropdown-macro".
		*/
		"change.dropdown-macro",
		"select",
		function changeDropdownEvent() {
			const dropdown = $(this),
				/*
					Dropdowns' events are, due to limitations in the ChangeDescriptor format,
					attached to the <tw-hook> or <tw-expression> containing the element.
				*/
				event = dropdown.closest('tw-expression, tw-hook').data('dropdownEvent');

			if (event) {
				event(dropdown);
			}
		}
	));
	/*d:
		(dropdown: Bind, ...String) -> Command

		TBW

		#input
	*/
	Macros.addCommand("dropdown",
		() => {},
		(cd, _, bind, ...labels) => {
			let source = '<select>'
				+ labels.map((label, i) =>
					'<option' + (i === 0 ? ' selected' : '') + '>' + label + '</option>'
				).join('\n')
				+ '</select>';

			cd.data.dropdownEvent = (dropdownMenu) => {
				const value = dropdownMenu.val();
				const result = bind.set(value);
				if (TwineError.containsError(result)) {
					/*
						As this clickEvent occurs when the interface element has already been rendered,
						we need to explicitly replace the link with the rendered error rather than return
						the error (to nobody).
					*/
					dropdownMenu.replaceWith(result.render(value));
					return;
				}
			};
			const result = bind.set(labels[0]);
			if (TwineError.containsError(result)) {
				return result;
			}
			return assign(cd, { source, append: "replace", });
		},
		[VarBind, String, rest(String)])

		/*d:
			(show: ...HookName) -> Command

			Reveals hidden hooks, running the code within.

			Example usage:
			```
			|fan)[The overhead fan spins lazily.]
			
			(link:"Turn on fan")[(show:?fan)]
			```

			Rationale:
			The purpose of hidden hooks is, of course, to eventually show them - and this macro is
			how you show them. You can use this command inside a (link:), trigger it in real-time with
			a (live:) macro, or anywhere else.

			Using (show:) vs (replace:):
			There are different reasons for using hidden hooks and (show:) instead of (replace:). For your stories,
			think about whether the prose being revealed is part of the "main" text of the passage, or is just an aside.
			In neatly-coded stories, the main text should appear early in a passage's code, as the focus of the
			writer's attention.

			When using (replace:), the replacement prose is written far from its insertion point. This can improve
			readability when the insertion point is part of a long paragraph or sentence, and the prose is a minor aside
			or amendment, similar to a footnote or post-script, that would clutter the paragraph were it included inside.
			Additionally, (replace:) can be used in a "header" or "footer" tagged passage to affect certain named hooks
			throughout the story.

			```
			You turn away from her, facing the grandfather clock, its [stern ticking]<1| filling the tense silence.

			(click-replace: ?1)[echoing, hollow ticking]
			```

			When using (show:), the hidden hook's position is fixed in the passage prose. This can improve
			readability when the hidden hook contains a lot of the "main" text of a passage, which provides vital context
			and meaning for the rest of the text.

			```
			I don't know where to begin... |1)[The weird state of my birth, the prophecy made centuries ago,
			my first day of school, the day of the meteors, the day I awoke my friends' powers... so many strands in
			the tapestry of my tale, and no time to unravel them.] ...so for now I'll start with when we fell down the hole.

			(link:"Where, indeed?")[(show:?1)]
			```

			But, there aren't any hard rules for when you should use one or the other. As a passage changes in the writing, you should feel free to change between one or the other, or leave your choice as-is.

			Details:
			(show:) will reveal every hook with the given name. To only reveal a specific hook, you can use the
			possessive syntax, as usual: `(show: ?shrub's 1st)`.

			If you provide to (show:) a hook which is already visible, nothing will happen - no error will be produced.

			See also:
			(hidden:), (replace:)

			#showing and hiding
		*/
		("show",
			() => {},
			(cd, section, ...hooks) => {
				hooks.forEach(hook => hook.forEach(section, elem => {
					const hiddenSource = elem.data('hiddenSource');
					if (hiddenSource === undefined) {
						/*
							Originally there was an error here, but it wasn't actually working, and I
							decided that having (show:) silently fail when given already-shown
							hooks' names provides it with slightly more flexibility in use, comparable to how most
							hook-selecting macros like (click:) are permissive about the names given.
						*/
						return;
					}
					section.renderInto("", null,
						assign({}, cd, { source: hiddenSource, target: elem })
					);
				}));
				return cd;
			},
			[rest(HookSet)])

		/*d:
			(stop:) -> Command
			This macro, which accepts no arguments, creates a (stop:) command, which is not configurable.
			
			Example usage:
			```
			{(live: 1s)[
			    (if: $packedBags)[OK, let's go!(stop:)]
			    (else: )[(either:"Are you ready yet?","We mustn't be late!")]
			]}
			```
			
			Rationale:
			Clunky though it looks, this macro serves a single important purpose: inside a (live:)
			macro's hook, its appearance signals that the macro must stop running. In every other occasion,
			this macro does nothing.

			This command can't have changers attached - attempting to do so will produce an error.
			
			See also:
			(live:)

			#live
		*/
		("stop",
			() => {},
			() => "",
			[], false)

		/*d:
			(save-game: String, [String]) -> Boolean
			
			This macro saves the current game's state in browser storage, in the given save slot,
			and including a special filename. It can then be restored using (load-game:).
			
			Rationale:
			
			Many web games use browser cookies to save the player's place in the game.
			Twine allows you to save the game, including all of the variables that were (set:)
			or (put:), and the passages the player visited, to the player's browser storage.
			
			(save-game:) is a single operation that can be used as often or as little as you
			want to. You can include it on every page; You can put it at the start of each "chapter";
			You can put it inside a (link:) hook, such as
			```
			{(link:"Save game")[
			  (if:(save-game:"Slot A"))[
			    Game saved!
			  ](else: )[
			    Sorry, I couldn't save your game.
			  ]
			]}
			```
			and let the player choose when to save.
			
			Details:
			
			(save-game:)'s first string is a slot name in which to store the game. You can have as many slots
			as you like. If you only need one slot, you can just call it, say, `"A"`, and use `(save-game:"A")`.
			You can tie them to a name the player gives, such as `(save-game: $playerName)`, if multiple players
			are likely to play this game - at an exhibition, for instance.
			
			Giving the saved game a file name is optional, but allows that name to be displayed by finding it in the
			$Saves datamap. This can be combined with a (load-game:)(link:) to clue the players into the save's contents:
			```
			(link: "Load game: " + ("Slot 1") of Saves)[
			  (load-game: "Slot 1")
			]
			```
			
			(save-game:) evaluates to a boolean - true if the game was indeed saved, and false if the browser prevented
			it (because they're using private browsing, their browser's storage is full, or some other reason).
			Since there's always a possibility of a save failing, you should use (if:) and (else:) with (save-game:)
			to display an apology message in the event that it returns false (as seen above).

			This command can't have changers attached - attempting to do so will produce an error.
			
			See also:
			(load-game:), (saved-games:)

			#saving
		*/
		("save-game",
			() => {},
			(_, slotName, fileName) => {
				/*
					The default filename is the empty string.
				*/
				fileName = fileName || "";
				
				if (!hasStorage) {
					/*
						If storage isn't available, that's the unfortunate fault of the
						browser. Return false, signifying that the save failed, and
						allowing the author to display an apology message.
					*/
					return false;
				}
				const serialisation = State.serialise();
				if (TwineError.containsError(serialisation)) {
					/*
						On the other hand, if serialisation fails, that's presumably
						the fault of the author, and an error should be given.
					*/
					return serialisation;
				}
				/*
					In case setItem() fails, let's run this in a try block.
				*/
				try {
					localStorage.setItem(
						/*
							Saved games are prefixed with (Saved Game <ifid>).
						*/
						storagePrefix("Saved Game") + slotName, serialisation);
					
					/*
						The file name is saved separately from the state, so that it can be retrieved
						without having to JSON.parse() the entire state.
					*/
					localStorage.setItem(
						/*
							Saved games are prefixed with (Saved Game Filename <ifid>).
						*/
						storagePrefix("Saved Game Filename") + slotName, fileName);
					return true;
				} catch(e) {
					/*
						As above, if it fails, a return value of false is called for.
					*/
					return false;
				}
			},
			[String, optional(String)], false)

		/*d:
			(load-game: String) -> Command
			
			This command attempts to load a saved game from the given slot, ending the current game and replacing it
			with the loaded one. This causes the passage to change.
			
			Example usage:
			```
			{(if: $Saves contains "Slot A")[
			  (link: "Load game")[(load-game:"Slot A")]
			]}
			```
			
			Details:
			Just as (save-game:) exists to store the current game session, (load-game:) exists to retrieve a past
			game session, whenever you want. This command, when given the string name of a slot, will attempt to
			load the save, completely and instantly replacing the variables and move history with that of the
			save, and going to the passage where that save was made.
			
			This macro assumes that the save slot exists and contains a game, which you can check by seeing if
			`(saved-games:) contains` the slot name before running (load-game:).

			This command can't have changers attached - attempting to do so will produce an error.
			
			See also:
			(save-game:), (saved-games:)
			
			#saving
		*/
		("load-game",
			() => {},
			(_, slotName) => {
				const saveData = localStorage.getItem(storagePrefix("Saved Game") + slotName);
				
				if (!saveData) {
					return TwineError.create("saving", "I can't find a save slot named '" + slotName + "'!");
				}
				
				State.deserialise(saveData);
				/*
					There's not a strong reason to check for the destination passage existing,
					because (save-game:) can only be run inside a passage. If this fails,
					the save itself is drastically incorrect.
				*/
				requestAnimationFrame(Engine.showPassage.bind(Engine, State.passage, false /* stretchtext value */));
				return { earlyExit: 1 };
			},
			[String], false)

		/*d:
			(alert: String) -> Command

			This macro produces a command that, when evaluated, shows a browser pop-up dialog box with the given
			string displayed, and an "OK" button to dismiss it.

			Example usage:
			`(alert:"Beyond this point, things get serious. Grab a snack and buckle up.")`

			Details:
			This is essentially identical to the Javascript `alert()` function in purpose and ability. You
			can use it to display a special message above the game itself. But, be aware that as the box uses
			the player's operating system and browser's styling, it may clash visually with the design
			of your story.

			When the dialog is on-screen, the entire game is essentially "paused" - no further computations are
			performed until it is dismissed.

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(prompt:), (confirm:)

			#popup
		*/
		("alert",
			() => {},
			(_, text) => {
				window.alert(text);
				return "";
			},
			[String], false)

		/*d:
			(prompt: String, String) -> String

			When this macro is evaluated, a browser pop-up dialog box is shown with the first string displayed,
			a text entry box containing the second string (as a default value), and an "OK" button to submit.
			When it is submitted, it evaluates to the string in the text entry box.

			Example usage:
			`(set: $name to (prompt: "Your name, please:", "Frances Spayne"))`

			Details:
			This is essentially identical to the Javascript `prompt()` function in purpose and ability. You can
			use it to obtain a string value from the player directly, such as a name for the main character.
			But, be aware that as the box uses the player's operating system and browser's styling, it
			may clash visually with the design of your story.

			When the dialog is on-screen, the entire game is essentially "paused" - no further computations are
			performed until it is dismissed.

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(alert:), (confirm:)

			#popup
		*/
		("prompt",
			() => {},
			(_, text, value) => window.prompt(text, value) || "",
			[String, String], false)

		/*d:
			(confirm: String) -> Boolean

			When this macro is evaluated, a browser pop-up dialog box is shown with the given string displayed,
			as well as "OK" and "Cancel" button to confirm or cancel whatever action or fact the string tells the player.
			When it is submitted, it evaluates to the boolean true if "OK" had been pressed, and false if "Cancel" had.

			Example usage:
			`(set: $makeCake to (confirm: "Transform your best friend into a cake?"))`

			Details:
			This is essentially identical to the Javascript `confirm()` function in purpose and ability. You can
			use it to ask the player a question directly, and act on the result immediately.
			But, be aware that as the box uses the player's operating system and browser's styling, it
			may clash visually with the design of your story.

			When the dialog is on-screen, the entire game is essentially "paused" - no further computations are
			performed until it is dismissed.

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(alert:), (prompt:)

			#popup
		*/
		("confirm",
			() => {},
			(_, text) => window.confirm(text),
			[String], false)

		/*d:
			(open-url: String) -> Command

			When this macro is evaluated, the player's browser attempts to open a new tab with the given
			URL. This will usually require confirmation from the player, as most browsers block
			Javascript programs such as Harlowe from opening tabs by default.

			Example usage:
			`(open-url: "http://www.example.org/")`

			Details:
			If the given URL is invalid, no error will be reported - the browser will simply attempt to
			open it anyway.

			Much like the `<a>` HTML element, the URL is treated as a relative URL if it doesn't start
			with "http://", "https://", or another such protocol. This means that if your story file is
			hosted at "http://www.example.org/story.html", then `(open-url: "page2.html")` will actually open
			the URL "http://www.example.org/page2.html".

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(goto-url:)

			#url
		*/
		("open-url",
			() => {},
			(_, text) => {
				window.open(text, '');
				return "";
			},
			[String], false)

		/*d:
			(reload:) -> Command

			When this command is used, the player's browser will immediately attempt to reload
			the page, in effect restarting the entire story.

			Example usage:
			`(click:"Restart")[(reload:)]`

			Details:
			If the first passage in the story contains this macro, the story will be caught in a "reload
			loop", and won't be able to proceed. No error will be reported in this case.

			This command can't have changers attached - attempting to do so will produce an error.

			#url
		*/
		("reload",
			() => {},
			() => {
				if (State.pastLength < 1) {
					return TwineError.create("infinite", "I mustn't (reload:) the page in the starting passage.");
				}
				window.location.reload();
				/*
					This technically doesn't need to be an "early exit" command
					like (goto:), because reload() halts all execution by itself.
					But, when proper error-checking is added, this will be necessary.
				*/
				return { earlyExit: 1 };
			},
			[], false)

		/*d:
			(goto-url: String) -> Command

			When this command is used, the player's browser will immediately attempt to leave
			the story's page, and navigate to the given URL in the same tab. If this succeeds, then
			the story session will "end".

			Example usage:
			`(goto-url: "http://www.example.org/")`

			Details:
			If the given URL is invalid, no error will be reported - the browser will simply attempt to
			open it anyway.
			
			Much like the `<a>` HTML element, the URL is treated as a relative URL if it doesn't start
			with "http://", "https://", or another such protocol. This means that if your story file is
			hosted at "http://www.example.org/story.html", then `(open-url: "page2.html")` will actually open
			the URL "http://www.example.org/page2.html".

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(open-url:)

			#url
		*/
		("goto-url",
			() => {},
			(_, url)=>{
				window.location.assign(url);
				/*
					As with (reload:), this early exit signal will be useful once
					proper editing is added.
				*/
				return { earlyExit: 1 };
			},
			[String], false);

	/*d:
		(page-url:) -> String

		This macro produces the full URL of the story's HTML page, as it is in the player's browser.

		Example usage:
		`(if: (page-url:) contains "#cellar")` will be true if the URL contains the `#cellar` hash.

		Details:
		This **may** be changed in a future version of Harlowe to return a datamap containing more
		descriptive values about the URL, instead of a single string.

		#url
	*/
	Macros.add("page-url", () => window.location.href, []);
});
