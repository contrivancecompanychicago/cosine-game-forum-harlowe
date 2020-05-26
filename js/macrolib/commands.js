"use strict";
define(['jquery', 'requestAnimationFrame', 'macros', 'utils', 'utils/selectors', 'state', 'passages', 'renderer', 'engine', 'internaltypes/twineerror', 'datatypes/hookset', 'datatypes/lambda', 'datatypes/varbind', 'utils/operationutils', 'utils/dialog'],
($, requestAnimationFrame, Macros, Utils, Selectors, State, Passages, Renderer, Engine, TwineError, HookSet, Lambda, VarBind, {printBuiltinValue}, Dialog) => {
	
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

			Added in: 1.0.0
			#basics 5
		*/
		("display",
			(name) => {
				/*
					Test for the existence of the named passage in the story.
					This and the next check must be made now, because the Passages
					datamap could've been tinkered with since this was created.
				*/
				if (!Passages.hasValid(name)) {
					return TwineError.create("macrocall",
						"I can't (display:) the passage '"
						+ name
						+ "' because it doesn't exist."
					);
				}
			},
			(cd, _, name) => assign(cd, { source: Utils.unescape(Passages.get(name).get('source')) }),
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

			Added in: 1.0.0
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

			Added in: 1.0.0
			#links
		*/
		("go-to",
			(name) => {
				/*
					First, of course, check for the passage's existence.
				*/
				if (!Passages.hasValid(name)) {
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
					Blocking the passage immediately ceases rendering; note that this should never get unblocked.
				*/
				return "blocked";
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

			Added in: 2.0.0
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
					As with the (goto:) macro, "blocked" signals to Section's runExpression() to cease evaluation.
				*/
				return "blocked";
			},
			[]);

		/*d:
			(cycling-link: [Bind], ...String) -> Command

			A command that, when evaluated, creates a cycling link - a link which does not go anywhere, but changes its own text
			to the next in a looping sequence of strings, and sets the optional bound variable to match the string value of the text.

			Example usage:
			* `(cycling-link: bind $head's hair, "Black", "Brown", "Blonde", "Red", "White")` binds the "hair" value in the $head datamap to the
			current link text.
			* `(cycling-link: "Mew", "Miao", "Mrr", "Mlem")` has no bound variable.
			* `(cycling-link: 2bind $pressure, "Low", "Medium", "High")` has a two-way bound variable. Whenever $pressure is either "Low", "Medium",
			or "High", the link will change its text automatically to match.

			Rationale:
			The cycling link is an interaction idiom popularised in Twine 1 which combines the utility of a dial input element with
			the discovery and visual consistency of a link: the player can typically only discover that this is a cycling link by clicking it,
			and can then discover the full set of labels by clicking through them. This allows a variety of subtle dramatic and humourous
			possibilities, and moreover allows the link to sit comfortably among passage prose without standing out as an interface element.

			The addition of a variable bound to the link, changing to match whichever text the player finally dialed the link to, allows
			cycling links to affect subsequent passages, and thus for the link to be just as meaningful in affecting the story's course as any
			other, even though no hooks and (set:)s can be attached to them.

			Details:

			This macro accepts two-way binds using the `2bind` syntax. These will cause the link to rotate its values to match the current value of the bound
			variable, if it can - if $pressure is "Medium" when entering the passage with `(cycling-link: 2bind $pressure, "Low", "Medium", "High")`, then it will
			rotate "Medium" to the front, as if the link had already been clicked once. Also, it will automatically update itself whenever
			any other macro changes the bound variable. However, if the variable no longer matches any of the link's strings, then it won't update - for
			instance, if the variable becomes "It's Gonna Blow", then a cycling link with the strings "Low", "Medium" and "High" won't update.

			If one of the strings is empty, such as `(cycling-link: "Two eggs", "One egg", "")`, then upon reaching the empty string, the link
			will disappear permanently. If the *first* string is empty, an error will be produced (because then the link can never appear at all).

			If attempting to render one string produces an error, such as `(cycling-link: "Goose", "(print: 2 + 'foo')")`, then the error will only appear
			once the link cycles to that string.

			The bound variable will be set to the first value as soon as the cycling link is displayed - so, even if the player doesn't
			interact with the link at all, the variable will still have the intended value.

			If you use (replace:) to alter the text inside a (cycling-link:), such as `(cycling-link: bind $tattoo, "Star", "Feather")(replace:"Star")[Claw]`,
			then the link's text will be changed, but the value assigned to the bound variable will *not* - $tattoo will still be "Star", and clicking the
			link twice will return the link's text to "Star". This differs from (dropdown:)'s behaviour in this situation.

			If only one string was given to this macro, an error will be produced.

			Added in: 3.0.0
			#input
		*/
		/*d:
			(seq-link: [Bind], ...String) -> Command
			Also known as: (sequence-link:)

			A command that creates a link that does not go anywhere, but changes its own text to the next in a sequence of strings, becoming plain text once the final
			string is reached, and setting the optional bound variable to match the text at all times.

			Example usage:
			* `(seq-link: bind $candy, "Two candies", "One candy", "Some wrappers")` sets the $candy variable to always equal the currently displayed string. "Some wrappers", the final
			string, becomes plain text instead of a link.
			* `(seq-link: "We nodded,", "turned,", "and departed, not a word spoken")` has no bound variable.

			Rationale:
			This is a variation of the (cycling-link:) command macro that does not cycle - for more information about that macro,
			see its corresponding article. This is a simpler macro, being simply a link that changes when clicked without looping, albeit less useful as
			a means of obtaining the player's input.

			While it's possible to produce this effect by simply using (link:) and nesting it, such as by `(link:"We nodded,")[(link:"turned,")[and departed, not a word spoken]]`,
			this macro is much more convenient to write when you wish to use a large amount of link labels. Additionally, this macro allows a bound variable to
			keep track of which string the player viewed last, as with (cycling-link:), which would be slightly more complicated to track using (link:) and (set:).

			Details:
			If one of the strings is empty, such as `(seq-link: "Two eggs", "One egg", "")`, then upon reaching the empty string, the link
			will disappear permanently. If the *first* string is empty, an error will be produced (because then the link can never appear at all).

			If attempting to render one string produces an error, such as `(seq-link: "Goose", "(print: 2 + 'foo')")`, then the error will only appear
			once the link cycles to that string.

			The bound variable will be set to the first value as soon as the sequence link is displayed - so, even if the player doesn't
			interact with the link at all, the variable will still have the intended value.

			If you use (replace:) to alter the text inside a (seq-link:), such as `(seq-link: bind $candy, "Two candies", "One candy", "Some wrappers")(replace:"Two")[Five]`,
			then the link's text will be changed, but the value assigned to the bound variable will *not* - $candy will still be "Two candies" until the link is clicked.

			If only one string was given to this macro, an error will be produced.

			Added in: 3.2.0
			#input
		*/
		[["cycling-link"],["seq-link","sequence-link"]].forEach((name, seq) => Macros.addCommand(name,
			(...labels) => {
				if (labels[0] === "") {
					return TwineError.create("datatype", "The first string in a (" + name[0] + ":) can't be empty.");
				}
				if (labels.length <= (VarBind.isPrototypeOf(labels[0]) ? 2 : 1)) {
					return TwineError.create("datatype",
						"I need two or more strings to " + (seq ? "sequence" : "cycle") + " through, not just '"
						+ labels[labels.length - 1]
						+ "'."
					);
				}
			},
			(cd, section, ...labels) => {
				/*
					Often, all the params are labels. But if the first one is actually the optional VarBind,
					we need to extract it from the labels array.
				*/
				let bind;
				if (VarBind.isPrototypeOf(labels[0])) {
					bind = labels.shift();
				}
				let index = 0;
				/*
					If there's a bind, and it's two-way, and one of the labels matches the bound
					variable's value, change the index to match.
				*/
				if (bind && bind.bind === "two way") {
					/*
						The two-way binding attribute (used by the handler to find bound elements)
						is installed, and if the variable currently matches an available label,
						the index changes to it.
					*/
					cd.attr.push({"data-2bind": true});
					const bindIndex = labels.indexOf(bind.varRef.get());
					if (bindIndex > -1) {
						index = bindIndex;
					}
				}

				/*
					As this is a deferred rendering macro, the current tempVariables
					object must be stored for reuse, as the section pops it when normal rendering finishes.
				*/
				const [{tempVariables}] = section.stack;

				/*
					This updater function is called when the element is clicked, and again
					when a two-way binding fires from a variable update.
				*/
				function nextLabel(expr, activated) {
					const ending = (index >= labels.length-1 && seq);
					let source = (labels[index] === "" ? "" :
						/*
							...ending if this is a (seq-link:), or cycling around if it's past the end.
						*/
						ending ? labels[index] : '<tw-link>' + labels[index] + '</tw-link>');
					/*
						Remove the clickEvent if this really is the end.
					*/
					if (ending) {
						cd.data.clickEvent = undefined;
					}
					/*
						If there's a bound variable, and this rerender wasn't called by
						a two-way binding activation, set it to the value of the next string.
						(If it returns an error, let that replace the source.)
					*/
					if (bind && !activated) {
						const result = bind.set(labels[index]);
						if (TwineError.containsError(result)) {
							/*
								As this clickEvent occurs when the interface element has already been rendered,
								we need to explicitly replace the link with the rendered error rather than return
								the error (to nobody).
							*/
							expr.replaceWith(result.render(labels[index]));
							return;
						}
					}
					/*
						Display the next label, reusing the ChangeDescriptor (and thus the transitions, style changes, etc)
						that the original run received.
					*/
					const cd2 = assign({}, cd, { source, transitionDeferred: false, });
					/*
						Since cd2's target SHOULD equal expr, passing anything as the second argument won't do anything useful
						(much like how the first argument is overwritten by cd2's source). So, null is given.
					*/
					cd.section.renderInto("", null, cd2, tempVariables);
				}
				/*
					The 2-way bind could have set the index to the end of the label list. If that label is "",
					don't install the event.
				*/
				labels[index] && (cd.data.clickEvent = (expr) => {
					/*
						Rotate to the next label...
					*/
					index = (index + 1) % labels.length;
					nextLabel(expr, false);
				})
				/*
					This event is called by a handler installed in VarBind.js. Every variable set causes
					this to fire - if it was the bound variable, then try to update the link
					to match the variable (if a match exists).
				*/
				&& (cd.data.twoWayBindEvent = (expr, obj, name) => {
					if (bind.varRef.matches(obj,name)) {
						const value = bind.varRef.get();
						const bindIndex = labels.indexOf(value);
						// Only actually update if the new index differs from the current.
						if (bindIndex > -1 && bindIndex !== index) {
							index = bindIndex;
							/*
								Rotate to the given label, making sure not to recursively
								call set() on the binding again.
							*/
							nextLabel(expr, true);
						}
					}
				});

				/*
					As above, the bound variable, if present, is set to the first label. Errors resulting
					from this operation can be returned immediately.
				*/
				let source = '<tw-link>' + labels[index] + '</tw-link>';
				if (bind) {
					const result = bind.set(labels[index]);
					if (TwineError.containsError(result)) {
						return result;
					}
				}
				return assign(cd, { source, append: "replace", transitionDeferred: true, });
			},
			[either(VarBind, String), rest(String)])
	);
	/*
		An onchange event for <select> elements must be registered for the sake of the (dropdown:) macro,
		which is implemented similar to the link macros - the ChangeDescriptor's data.dropdownEvent indicates
		what to do when the <select> is interacted with.
	*/
	Utils.onStartup(() => $(Utils.storyElement).on(
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

		A command that, when evaluated, creates a dropdown menu with the given strings as options.
		When one option is selected, the bound variable is set to match the string value of the text.

		Example usage:
		* `(dropdown: bind _origin, "Abyssal outer reaches", "Gyre's wake", "The planar interstice")` has a normal bound variable.
		* `(dropdown: 2bind $title, "Duke", "King", "Emperor")` has a two-way bound variable - if $title is "Duke", "King" or "Emperor",
		then the dropdown will automatically be scrolled to that option.

		Rationale:
		Dropdown menus offer a more esoteric, but visually and functionally unique way of presenting the player with
		a choice from several options. Compared to other list-selection elements like (cycling-link:)s or lists of links,
		dropdowns are best used for a long selection of options which should be displayed all together, but would not otherwise
		easily fit in the screen in full.

		While dropdowns, whose use in form UI suggests themes of bureaucracy and utility, may appear best used for "character
		customisation" screens and other non-narrative purposes, that same imagery can also be a good reason to use them within prose
		itself - for instance, to present an in-story bureaucratic form or machine control panel.

		Details:

		This macro accepts two-way binds using the `2bind` syntax. These will cause the dropdown to always match the current value of the bound
		variable, if it can. Also, it will automatically update itself whenever any other macro changes the bound variable. However,
		if the variable no longer matches any of the dropdown's strings, then it won't update - for
		instance, if the variable becomes "Peasant", then a dropdown with the strings "Duke", "King" and "Emperor" won't update.

		Note that unlike (cycling-link:), another command that uses bound variables, the bound variable is mandatory here.

		Also note that unlike (cycling-link:), empty strings can be given. These instead create **separator elements**,
		which are rendered as unselectable horizontal lines that separate groups of options. Having empty strings as the first or
		last elements, however, will result in an error (as these can't meaningfully separate one group from another).

		The first element in a (dropdown:) will always be the one initially displayed and selected - and thus, the one that is
		immediately set into the bound variable.

		If you use (replace:) to alter the text inside a (dropdown:), such as `(dropdown: bind $tattoo, "Star", "Feather")(replace:"Star")[Claw]`,
		then the option text and the value assigned to the bound variable will change - but *only* when the player next interacts with the dropdown.
		$tattoo will be "Star" until a new option is selected, whereupon it will become either "Claw" or "Feather" depending on which was picked.

		See also:
		(cycling-link:)

		Added in: 3.0.0
		#input
	*/
	Macros.addCommand("dropdown",
		(_, ...labels) => {
			if (labels[0] === "" || labels[labels.length-1] === "") {
				return TwineError.create("datatype", "The first or last strings in a (dropdown:) can't be empty.",
					"Because empty strings create separators within (dropdown:)s, having them at the start or end doesn't make sense.");
			}
			if (labels.length <= 1) {
				return TwineError.create("datatype",
					"I need two or more strings to create a (dropdown:) menu, not just " + labels.length + "."
				);
			}
		},
		(cd, _, bind, ...labels) => {
			let index = 0;
			/*
				If there's a bind, and it's two-way, and one of the labels matches the bound
				variable's value, change the index to match.
			*/
			if (bind.bind === "two way") {
				cd.attr.push({"data-2bind": true});
				const bindIndex = labels.indexOf(bind.varRef.get());
				if (bindIndex > -1) {
					index = bindIndex;
				}
			}
			/*
				In order to create separators that are long enough, we must find the longest
				label's length (in code points, *not* UCS2 length) and then make the
				separators that long.
			*/
			const longestLabelLength = Math.max(...labels.map(e=>[...e].length));
			let source = '<select>'
				+ labels.map((label, i) =>
					'<option' + (i === index ? ' selected' : '') + (label === "" ? ' disabled' : '') + '>'
					/*
						Create the separator using box-drawing "─" characters, which should be
						visually preferable to plain hyphens.
					*/
					+ (label || '─'.repeat(longestLabelLength))
					+ '</option>'
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
			/*
				This event is called by a handler installed in VarBind.js. Every variable set causes
				this to fire - if it was the bound variable, then try to update the dropdown
				to match the variable (if a match exists).
			*/
			cd.data.twoWayBindEvent = (dropdownMenu, obj, name) => {
				if (bind.varRef.matches(obj,name)) {
					const value = bind.varRef.get();
					const bindIndex = labels.indexOf(value);
					// Only actually update if the new index differs from the current.
					if (bindIndex > -1 && bindIndex !== index) {
						dropdownMenu.find('select').val(value);
						index = bindIndex;
					}
				}
			};
			/*
				This is designed to overcome a limitation of Windows Chrome, which gives <select>s
				with a transparent background colour a colour of white.
			*/
			cd.styles.push({
				'background-color'() { return Utils.parentColours($(this)).backgroundColour; },
			});
			const result = bind.set(labels[index]);
			if (TwineError.containsError(result)) {
				return result;
			}
			return assign(cd, { source, append: "replace", });
		},
		[VarBind, String, rest(String)]);

	/*d:
		(show: ...HookName) -> Command

		Reveals hidden hooks, running the code within if it's not been shown yet.

		Example usage:
		```
		|fan)[The overhead fan spins lazily.]
		
		(link:"Turn on fan")[(show:?fan)]
		```

		Rationale:
		The purpose of hidden hooks is, of course, to eventually show them - and this macro is
		how you show them. You can use this command inside a (link:), trigger it in real-time with
		a (live:) macro, or anywhere else. You can also re-reveal a hook that had been hidden with (hide:), but
		any macros in that hook won't be re-run.

		<h4>Using (show:) vs (replace:):</h4>

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

		But, there aren't any hard rules for when you should use one or the other. As a passage changes in the writing, you should
		feel free to change between one or the other, or leave your choice as-is.

		Details:
		(show:) will reveal every hook with the given name. To only reveal a specific hook, you can use the
		possessive syntax, as usual: `(show: ?shrub's 1st)`.

		Much like (replace:), (show:) cannot affects hooks or text that haven't been printed yet - if the (show:)
		runs at the same time that the passage is appearing (as in, it isn't inside a hook that's delayed by (live:), (link:), (event:)
		or similar macros), and a hook or line of text appears after it in the passage, the macro won't replace its contents
		even if it's a valid target. For example: `(show:?fence)|fence)[A white picket fence.]` won't work because the (show:) runs immediately.

		If you provide to (show:) a hook which is already visible, nothing will happen - no error will be produced. If you provide to
		(show:) a hook that had been visible, but was hidden with (hide:), then the hook will reappear, but its macros won't be re-run.
		If you wish to re-run an already visible hook, use (rerun:). Note that hooks whose visible contents have been replaced with
		nothing, such as via `(replace: ?1)[]`, are still considered "visible".

		If you wish to reveal a hook after a number of other links have been clicked and removed, such as those created
		by (link-reveal:) or (click:), you may find the (more:) macro to be convenient.

		See also:
		(hidden:), (replace:), (rerun:), (more:)

		Added in: 2.0.0
		#showing and hiding
	*/
	/*d:
		(rerun: ...HookName) -> Command
		
		Reruns hooks, restoring them to their original contents, and running the macros within them an additional time.

		Example usage:
		```
		|1>[You drew a (either:...(range:2,10), "Jack", "Queen", "King", "Ace") of (either:"Hearts","Clubs","Spades","Diamonds").]
		(link-rerun:"Shuffle and draw.")[(rerun:?1)]
		```

		Rationale:
		You may often use macros like (replace:) or (append:) to alter the contents of hooks in your passages. But, you may also want an
		easy way of reversing these changes, to restore the hook to its original state as it had been written in your passage's code.
		This macro provides a means of doing so without having to reload or revisit the entire passage.

		In addition to re-running hooks elsewhere in the passage, you can produce some useful effects by having a (rerun:) affect its containing hook:
		```
		|1>[You're nude in the changing room, with only your reflection for company.
		(link:"Dress up")[You dress yourself up. Regrettably, you both look worse. (link:"Take off clothes")[(rerun:?1)]]]
		```

		Furthermore, as (rerun:) causes macros in the hook to re-run themselves, it can be used to "update" hooks to match the present game state:
		```
		(set:$energy to 100)
		|1>[Shields: $energy % (text-color:red)[( - $dmg %)]]
		(link-rerun: "Take the punch")[(set:$dmg to (either:1,2,3), $energy to it - $dmg)You get punched square in the cockpit!(rerun: ?1)]
		```

		Details:
		(rerun:) will use the hook's original source *as it was written* in the passage source - any alterations done to it using (replace:) and other
		such macros will not be considered.

		(rerun:) will re-run every hook with the given name. To only re-run a specific hook, you can use the
		possessive syntax, as usual: `(rerun: ?daydream's 1st)`.

		(rerun:), unlike (show:), will not work on hidden hooks until they become visible using (show:) or (link-show:).

		If you want to rerun a hook multiple times based on elapsed real time, use the (live:) macro.

		See also:
		(replace:), (show:), (more:), (live:)

		Added in: 3.2.0
		#revision
	*/
	["show","rerun"].forEach(name => Macros.addCommand(name,
		() => {},
		(cd, section, ...hooks) => {
			hooks.forEach(hook => hook.forEach(section, elem => {
				const data = elem.data('hidden');
				/*
					The test for whether a hook has been shown is, simply, whether it has "hidden" data.
					The (show:) macro only works on hidden hooks, and the (rerun:) macro only works on non-hidden hooks.
				*/
				if ((data !== undefined) === (name === "rerun")) {
					/*
						Originally there was an error here, but it wasn't actually working, and I
						decided that having (show:) silently fail when given already-shown
						hooks' names provides it with slightly more flexibility in use, comparable to how most
						hook-selecting macros like (click:) are permissive about the names given.
					*/
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
						assign({}, cd, { append: "replace", source: elem.data('originalSource') || '', target: elem })
					);
				}
			}));
			return cd;
		},
		[rest(HookSet)])
	);

	Macros.addCommand
		/*d:
			(hide: ...HookName) -> Command

			Hides a hook that was already visible, without fully erasing it or its contained macro calls.

			Example usage:
			```
			The exam paper sits before you.
			|2>[(link-rerun:"Peek at palm")[(show:?1)(hide:?2)]]
			|1)[It says:
			(random:10,90)0m, (random:2,10)deg, 1/(either:2,3,4)
			(link-rerun:"Hide palm")[(hide:?1)(show:?2)]]
			```

			Rationale:
			There are times when you need to remove a hook from visibility, but don't want its contents to be forgotten or re-run,
			as would happen if you used (replace:). The (hide:) macro simply makes a hook invisible, keeping its contents stored
			as they are until you use (show:) to reveal them again.

			Details:
			(hide:) will hide every hook with the given name. To only hide a specific hook, you can use the
			possessive syntax, as usual: `(hide: ?1's 1st)`.

			If you want to remove the hook's contents all together, and re-create it anew later, consider using (replace:) and (rerun:)
			rather than (show:) and (hide:).

			See also:
			(show:), (rerun:), (replace:)

			Added in: 3.2.0
			#showing and hiding
		*/
		("hide",
			() => {},
			(cd, section, ...hooks) => {

				hooks.forEach(hook => hook.forEach(section, elem => {
					/*
						The test for whether a hook has been shown is, simply, whether it has "hidden" data.
						The (show:) macro only works on hidden hooks, and the (rerun:) macro only works on non-hidden hooks.
					*/
					if (Boolean(elem.data('hidden'))) {
						/*
							Just as with (show:), this doesn't produce an error when run on already-hidden hooks.
						*/
						return;
					}
					/*
						To hide a hook, such that its contents aren't affected by or visible to any other elements:
						Take its .contents(), detach it, and make it the 'hidden' data.
					*/
					elem.data('hidden', elem.contents().detach());
				}));
				return cd;
			},
			[rest(HookSet)])

		/*d:
			(stop:) -> Command
			This macro, which accepts no arguments, creates a (stop:) command, which is not configurable.
			
			Example usage:
			```
			{(set:$packedBags to true)(live: 1s)[
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

			Added in: 1.0.0
			#live 2
		*/
		/*
			The existence of this macro is checked by searching for its <tw-expression> DOM element
			within a hook.
		*/
		("stop",
			() => {},
			() => {},
			[], false)

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
			`(saved-games: ) contains` the slot name before running (load-game:).

			This command can't have changers attached - attempting to do so will produce an error.

			In the event that the saved data exists, but contains an error - for instance, if it refers to a passage
			which doesn't exist in this story, which could happen if one version of the story is used to save it, and
			another is used to open it - then a polite dialog box will appear asking the reader whether or not the data
			should be deleted. An example of such a dialog is below.
			<blockquote>
			Sorry to interrupt... The story tried to load saved data, but there was a problem.
			The data refers to a passage named 'example', but it isn't in this story.<br><br>
			That data might have been saved from a different version of this story. Should I delete it?<br>
			(Type 'delete' and choose OK to delete it.)<br><br>
			Either way, the story will now continue without loading the data.
			</blockquote>

			See also:
			(save-game:), (saved-games:)
			
			Added in: 1.0.0
			#saving
		*/
		("load-game",
			() => {},
			(/* no cd because this is attachable:false */ section, slotName) => {
				const saveData = localStorage.getItem(storagePrefix("Saved Game") + slotName);
				
				if (!saveData) {
					return TwineError.create("saving", "I can't find a save slot named '" + slotName + "'!");
				}
				
				/*
					If this returns false, the save itself is drastically incorrect.
				*/
				const result = State.deserialise(saveData);
				if (result instanceof Error) {
					/*
						Since this could be an issue with multiple versions of the same story,
						showing a TwineError, a developer-facing error, seems incorrect. So, instead
						a (confirm:) is shown, offering to delete the data.
					*/
					const d = Dialog({
							message: "Sorry to interrupt... The story tried to load saved data, but there was a problem.\n"
								+ result.message
								+ "\n\nThat data might have been saved from a different version of this story. Should I delete it?"
								+ "\n(Type 'delete' and choose OK to delete it.)"
								+ "\n\nEither way, the story will now continue without loading the data.",
							defaultValue: "",
							cancelCallback: () => section.unblock(),
							confirmCallback() {
								if ("delete" === d.find('input').last().val()) {
									localStorage.removeItem(storagePrefix("Saved Game") + slotName);
								}
								section.unblock();
							},
						});
					Utils.storyElement.append(d);
					// Regrettably, this arbitrary timeout seems to be the only reliable way to focus the <input>.
					setTimeout(() => d.find('input').last().focus(), 100);
					return "blocked";
				}
				requestAnimationFrame(Engine.showPassage.bind(Engine, State.passage, false /* stretchtext value */));
			},
			[String], false)

		/*d:
			(alert: String) -> Command

			This macro produces a command that, when evaluated, shows a pop-up dialog box with the given
			string displayed, and an "OK" link to dismiss it.

			Example usage:
			`(alert:"Beyond this point, things get serious. Grab a snack and buckle up.")`

			Details:
			The dialog that is produced is implemented entirely in HTML. User CSS stylesheets can be used to
			style it, and (enchant:) macros that affect ?Link can affect the dialog links.

			In Harlowe versions prior to 3.1.0, this macro used the built-in `alert()` function of the browser, but to
			support certain newer browsers that no longer offer this function, the macro was changed.

			When the dialog is on-screen, the entire game is essentially "paused" - until it is dismissed,
			no further computations are performed, links can't be clicked, and (live:) and (event:) macros
			shouldn't fire.

			This macro can't have changers attached - attempting to do so will produce an error.

			See also:
			(prompt:), (confirm:)

			Added in: 1.0.0
			#popup
		*/
		("alert",
			() => {},
			(/* no cd because this is attachable:false */ section, message) => {
				Utils.storyElement.append(Dialog({message, defaultValue:false, cancelCallback: () => section.unblock()}));
				section.stackTop.blocked = true;
			},
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

			Added in: 1.0.0
			#url
		*/
		("open-url",
			() => {},
			(/* no cd because this is attachable:false */ _, text) => {
				window.open(text, '');
			},
			[String], false)

		/*d:
			(reload:) -> Command

			When this command is used, the player's browser will immediately attempt to reload
			the page, in effect restarting the entire story.

			Example usage:
			`(click:"Restart")[(reload:)]`

			Details:
			Normally, Harlowe stories will attempt to preserve their current game state across browser page reloads.
			This macro will suppress this behaviour, guaranteeing that the story restarts from the beginning.

			If the first passage in the story contains this macro, the story will be caught in a "reload
			loop", and won't be able to proceed. No error will be reported in this case.

			This command can't have changers attached - attempting to do so will produce an error.

			Added in: 1.0.0
			#url
		*/
		("reload",
			() => {},
			(/* no cd because this is attachable:false */ ) => {
				if (State.pastLength < 1) {
					return TwineError.create("infinite", "I mustn't (reload:) the page in the starting passage.");
				}
				if (State.hasSessionStorage) {
					sessionStorage.removeItem("Saved Session");
				}
				window.location.reload();
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

			Added in: 1.0.0
			#url
		*/
		("goto-url",
			() => {},
			(/* no cd because this is attachable:false */ _, url)=>{
				window.location.assign(url);
			},
			[String], false);

	/*
		The following couple of macros are not commands, but they are each intrinsically related to some of the macros above.
	*/
	Macros.add
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
			(saved-games:) datamap. This can be combined with a (load-game:)(link:) to clue the players into the save's contents:
			```
			(link: "Load game: " + ("Slot 1") of (saved-games: ))[
			  (load-game: "Slot 1")
			]
			```
			
			(save-game:) evaluates to a boolean - true if the game was indeed saved, and false if the browser prevented
			it (because they're using private browsing, their browser's storage is full, or some other reason).
			Since there's always a possibility of a save failing, you should use (if:) and (else:) with (save-game:)
			to display an apology message in the event that it returns false (as seen above).
			
			See also:
			(load-game:), (saved-games:)

			Added in: 1.0.0
			#saving
		*/
		("save-game",
			(_, slotName, fileName) => {
				/*
					The default filename is the empty string.
				*/
				fileName = fileName || "";
				
				if (!State.hasStorage) {
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
					serialise() returns a TwineError if the state can't be serialised, and
					false if it could but threw. In the latter case, pass the false to
					the author, in keeping with below.
				*/
				else if (serialisation === false) {
					return false;
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
			[String, optional(String)])

		/*d:
			(prompt: String, String) -> String

			When this macro is evaluated, a browser pop-up dialog box is shown with the first string displayed,
			a text entry box containing the second string (as a default value), an "OK" link and a "Cancel" link.
			If "OK" is clicked, it evaluates to the string in the text entry box. If "Cancel" is clicked, it evaluates to
			the default value regardless of the entry box's contents.

			Example usage:
			`(set: $name to (prompt: "Your name, please:", "Frances Spayne"))`

			Details:
			The dialog that is produced is implemented entirely in HTML. User CSS stylesheets can be used to
			style it, and (enchant:) macros that affect ?Link can affect the dialog links.

			In Harlowe versions prior to 3.1.0, this macro used the built-in `prompt()` function of the browser, but to
			support certain newer browsers that no longer offer this function, the macro was changed.

			When the dialog is on-screen, the entire game is essentially "paused" - until it is dismissed,
			no further computations are performed, links can't be clicked, and (live:) and (event:) macros
			shouldn't fire.

			See also:
			(alert:), (confirm:)

			Added in: 1.0.0
			#popup
		*/
		("prompt",
			(section, message, defaultValue) => {
				/*
					Since (prompt:) and (confirm:) create dialogs as soon as they're evaluated, we need this extra check,
					in addition to the one in Section for expressions, to ensure that this isn't being used in a pure
					evaluation context, such as a link's text, or a (storylet:) macro.
				*/
				if (section.stackTop && section.stackTop.evaluateOnly) {
					return TwineError.create("macrocall",
						"I can't use a macro like (prompt:) or (confirm:) in " + section.stackTop.evaluateOnly + ".",
						"Please rewrite this without putting such macros here."
					);
				}
				const d = Dialog({
					message,
					defaultValue,
					cancelCallback() {
						section.unblock(defaultValue);
					},
					confirmCallback() {
						section.unblock(d.find('input').last().val());
					},
				});
				Utils.storyElement.append(d);
				// Regrettably, this arbitrary timeout seems to be the only reliable way to focus the <input>.
				setTimeout(() => d.find('input').last().focus(), 100);
			},
			[String, String])

		/*d:
			(confirm: String) -> Boolean

			When this macro is evaluated, a pop-up dialog box is shown with the given string displayed,
			as well as "OK" and "Cancel" link to confirm or cancel whatever action or fact the string tells the player.
			When it is submitted, it evaluates to the boolean true if "OK" had been clicked, and false if "Cancel" had.

			Example usage:
			`(set: $makeCake to (confirm: "Transform your best friend into a cake?"))`

			Details:
			The dialog that is produced is implemented entirely in HTML. User CSS stylesheets can be used to
			style it, and (enchant:) macros that affect ?Link can affect the dialog links.

			In Harlowe versions prior to 3.1.0, this macro used the built-in `confirm()` function of the browser, but to
			support certain newer browsers that no longer offer this function, the macro was changed.

			When the dialog is on-screen, the entire game is essentially "paused" - until it is dismissed,
			no further computations are performed, links can't be clicked, and (live:) and (event:) macros
			shouldn't fire.

			See also:
			(alert:), (prompt:)

			Added in: 1.0.0
			#popup
		*/
		("confirm",
			(section, message) => {
				/*
					As with (prompt:), we need an extra check here.
				*/
				if (section.stackTop && section.stackTop.evaluateOnly) {
					return TwineError.create("macrocall",
						"I can't use a macro like (prompt:) or (confirm:) in " + section.stackTop.evaluateOnly + ".",
						"Please rewrite this without putting such macros here."
					);
				}
				Utils.storyElement.append(Dialog({
					message, defaultValue: false, cancelCallback: () => section.unblock(false), confirmCallback: () => section.unblock(true)
				}));
			},
			[String])

		/*d:
			(page-url:) -> String

			This macro produces the full URL of the story's HTML page, as it is in the player's browser.

			Example usage:
			`(if: (page-url:) contains "#cellar")` will be true if the URL contains the `#cellar` hash.

			Details:
			This **may** be changed in a future version of Harlowe to return a datamap containing more
			descriptive values about the URL, instead of a single string.

			Added in: 1.0.0
			#url
		*/
		("page-url", () => window.location.href, []);
	/*
		The two macros which block control flow during evaluation, (prompt:) and (confirm:), need to be registered with
		Renderer, to ensure they are executed before the rest of the expression containing them.
	*/
	Renderer.options.blockerMacros.push("prompt","confirm");

});
