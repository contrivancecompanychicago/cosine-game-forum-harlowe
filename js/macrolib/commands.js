"use strict";
define(['jquery', 'macros', 'utils', 'state', 'passages', 'renderer', 'engine', 'internaltypes/twineerror',
	'internaltypes/twinenotifier', 'datatypes/assignmentrequest', 'datatypes/hookset', 'datatypes/codehook', 'datatypes/lambda', 'datatypes/varbind', 'utils/operationutils', 'utils/renderutils'],
($, Macros, Utils, State, Passages, Renderer, Engine, TwineError, TwineNotifier, AssignmentRequest, HookSet, CodeHook, Lambda, VarBind, {printBuiltinValue}, {dialog, geomParse, geomStringRegExp}) => {
	
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
	const {Any, rest, either, optional, zeroOrMore, positiveInteger} = Macros.TypeSignature;
	const {assign} = Object;
	const {noop} = $;

	/*
		As localstorage keys are shared across domains, this prefix, using the current story's IFID,
		is necessary to ensure that multiple stories on a domain have their save files properly namespaced.
	*/
	function storagePrefix(text) {
		return "(" + text + " " + Engine.options.ifid + ") ";
	}
	
	/*d:
		VariableToValue data
		
		This is a special value that only (set:) and (put:) make use of.
		It's created by joining a value and a variable (or a TypedVar, or data structure containing TypedVars) with the `to` or `into` keywords:
		`$emotion to 'flustered'` is an example of a VariableToValue. It exists primarily to make (set:) and (put:) more readable.
	*/
	/*d:
		Instant data

		A few special macros in Harlowe perform actions immediately, as soon as they're evaluated.
		These can be used in passages, but cannot have their values saved using (set:) or (put:),
		or stored in data structures.
	*/
	["set","put"].forEach(name =>
		/*d:
			(set: ...VariableToValue) -> Instant
			
			Stores data values in variables.
			
			Example usage:
			* `(set: $battlecry to "Save a " + $favouritefood + " for me!")` creates a variable called $battlecry containing a string.
			* `(set: _dist to $altitude - $enemyAltitude)` creates a temp variable called _dist.
			* `(set: num-type $funds to 0)` sets a variable and restricts its type to numbers, preventing non-numbers
			from ever being (set:) into it by accident.
			* `(set: const-type $robotText to (font:"Courier New"))` sets a variable and makes it so it can't ever be set
			to another value.
			* `(set: (a: _mainPath, _sidePath, _backPath) to (a:"north","northeast","south"))` sets three temp variables (by overwriting)
			each variable in the array on the left with its matching value in the array on the right.
			* `(set: (dm: "Maths", _Maths, "Science", _Science) to $characterStats)` is the same as `(set: _Maths to $characterStats's Maths, _Science to $characterStats's Science)`.
			* `(set: (p-either:"Ms.","Mr.","Mx.")-type $charTitle to "Mx.")` sets a variable that can only hold the strings "Mr.", "Ms." or "Mx.".
			* `(set: (p:"The ", str-type _job) to "The Safecracker")` uses de-structuring to extract the string "Safecracker" from the value, and puts it in the variable _job.
			* `(set: (a: str, ...num-type $stats) to (a: "Daria", 25, 14, 25))` uses de-structuring to extract the numbers from the right side into a new array stored in $stats.

			Rationale:
			
			Variables are data storage for your game. You can store data values under special names
			of your choosing, and refer to them later.

			There are two kinds of variables. Normal variables, whose names begin with `$`, persist between passages,
			and should be used to store data that will be needed throughout the entire game. Temp variables,
			whose names begin with `_`, only exist inside the hook or passage that they're first (set:), and
			are forgotten after the hook or passage ends. You should use temp variables if you're writing passage
			code that mustn't accidentally affect any other passages' variables (by using (set:) on a variable name
			that someone else was using for something different). This can be essential in collaborative work
			with other authors working on the same story independently, or when writing code to be used in multiple stories.
			
			Variables have many purposes: keeping track of what the player has accomplished,
			managing some other state of the story, storing hook styles and changers, and
			other such things. You can display variables by putting them in passage text,
			attach them to hooks, and create and change them using the (set:) and (put:) macros.
			
			Details:
			
			In its basic form, a variable is created or changed using `(set: ` variable `to` value `)`.
			You can also set multiple variables in a single (set:) by separating each VariableToValue
			with commas: `(set: $weapon to 'hands', $armour to 'naked')`, etc.
			
			You can also use `it` in expressions on the right-side of `to`. Much as in other
			expressions, it's a shorthand for what's on the left side: `(set: $vases to it + 1)`
			is a shorthand for `(set: $vases to $vases + 1)`.

			Due to the variable syntax potentially conflicting with dollar values (such as $1.50) in your story text,
			variables cannot begin with a numeral.

			Destructuring:

			As of Harlowe 3.2.0, you can extract multiple values from an array, datamap or string, at once, and set them into
			multiple variables, by placing a matching data structure on the left of `to` containing variables at
			the positions of those values. For instance, `(set: (a: $x, 2, $y) to (a: 1, 2, 3))` sets $x to 1 and $y to 3,
			and `(set: (dm: "A", $x, "B", $y) to (dm: "B", 3, "A", 1))` sets $x to 1 and $y to 3. Harlowe checks that each value on the left side has a
			value that matches it (using the same rules as the `matches` operator) on the right side, and overwrites the left side with the
			right side, causing the variables at various positions in the left side to be overwritten with values from the
			right. This is known as **de-structuring**. (Remember that datamaps' "positions" are determined by their datanames, not their locations
			in the (dm:) macro that created them, as, unlike arrays, they are not sequential.)

			For extracting substrings from strings, use the (p:) macro and its related macros to construct a string pattern, resembling
			array patterns. For instance, `(set: (p: (p-either: "Silt", "Mud", "Peat", "Slime")-type _element, " ", (p-either: "Ball", "Blast", "Shot", "Beam")-type _shape) to "Slime Ball")`
			extracts the words "Slime" and "Ball" from the value, and puts them in the _element and _shape temp variables. Note that
			when this is done, the _element variable is restricted to `(p-either: "Silt", "Mud", "Peat", "Slime")-type` data, so putting
			any other kind of string into it will cause an error. Generally, it's recommended to use temp variables for string destructuring, and then,
			if you need more general variables to hold the extracted substrings, place them in a less restricted variable afterward.

			Note that the left side's data structure can have any number of nested data structures inside it.
			`(set: (a: (a: $x), 2, (dm: "A", $y)) to (a: (a: 1), 2, (dm: "A", 3)))` also sets $x to 1 and $y to 3. If you need to reach deeply
			into a data structure (such as one produced by (passages:), (saved-games:) or (open-storylets:)) to get a certain set of values,
			this can come in handy.

			You may have noticed that the data structures on the left side may have values that aren't variable names, such as the 2 in the
			preceding example. These can be used as error-checking values -if a matching value isn't present on the right side at that same position,
			then an error will be reported. To ensure that the right side does indeed contain the values you expect it to, you may include these
			values in the left side. Of course, you may want to simply enforce that a value of a given datatype is in that position, rather a specific
			value - this can be done by placing a datatype name at that position, like `num` or `str` or `empty`. Consult the datatype article for more
			information on datatype names.

			As you may have also noticed, this syntax is convenient for extracting values from the left side of arrays. But, what if you wish to only select
			values from the middle, or to skip certain values without putting them in variables? You could use a value or a datamap name at that position,
			such as by writing `(set: (a: num, $y, $x) to $array)` - though, if you aren't even certain of the data types that could be at those positions,
			you may find the special `any` data type to be a big help - `(set: (a: any, $y, $x) to $array)` sets $x to the 3rd value in $array and $y to the
			2nd value, without needing to worry about what the first value might be.

			(When dealing with string patterns, the equivalent of `any` is simply `str`, as strings can't contain non-string data.)
			
			If the destination doesn't contain any variables - for instance, if you write `(set: (a:2,3)'s 1st to 1)`,
			or `(set: true to 2)` - then an error will be printed.

			For obvious reasons, de-structuring can't be used with datasets - you'll have to convert them to arrays on the right side.

			Typed variables:

			A common source of errors in a story is when a variable holding one type of data is mistakenly overridden
			with a different type of data, such as when putting `"1"` (the string "1") into a variable that should
			hold numbers. A good way to guard against this is to make the variable a **typed variable**, which is permanently
			restricted to a single datatype. The first time you set data to the variable, write `(set: num-type $days to 1)` to
			permanently restrict $days to numbers. That way, if you accidentally put `"1"` into it, an error will appear
			immediately, explaining the issue. Moreover, typed variables serve a code documentation purpose: they help
			indicate and explain the purpose of a variable by showing what data is meant to be in it. You can use any
			datatype before the `-type` syntax - see the article about datatype data for more details.

			In addition to just restricting a variable to a type, you may wish to specify that a variable should only hold one
			value for the entire story - a style changer, for instance, or a datamap holding fixed values for a
			procedural-generation algorithm. For these, you want to use the `const` (short for "constant") datatype.
			Using this, the variable is guaranteed to constantly hold that value for the entirety of the story (or, if it's
			a temp variable, the passage).

			This syntax can be combined with de-structuring - simply place the typed variable where a normal variable would be
			within a data structure. `(set: (a: num, num-type $y, num-type _x) to $array)` not only sets $y and _x, but it also
			restricts them to number data, all in one statement. If the typed variable is inside an array, and involves a spread datatype (like `...num`)
			then it is restricted to data that matches `(a: ...num)` (i.e. arrays of zero or more `num` values), and it automatically gathers multiple values from the
			right-hand-side that match the datatype. `(set: (a: str, ...bool-type $examAnswers) to (a: "ANSWER KEY", true, false, false, true, false))`
			sets $examAnswers to `(a:true, false, false, true, false)`.

			See also:
			(push:), (move:)

			Added in: 1.0.0
			#basics 1
		*/
		/*d:
			(put: ...VariableToValue) -> Instant
			
			A left-to-right version of (set:) that requires the word `into` rather than `to`.
			
			Example usage:
			* `(put: "Save a " + $favouritefood + " for me!" into $battlecry)` creates a variable called $battlecry.
			* `(put: $altitude - $enemyAltitude into _dist)` creates a temp variable called _dist.
			* `(put: 0 into num-type $funds)` sets a variable and restricts its type to numbers, preventing non-numbers
			from ever being (put:) into it by accident.
			* `(put: (font:"Courier New") into const-type $robotText)` sets a variable and makes it so it can't ever be set
			to another value.

			Rationale:
			
			This macro has an identical purpose to (set:) - it creates and changes variables.
			For a basic explanation, see the rationale for (set:).
			
			Almost every programming language has a (set:) construct, and most of these place the
			variable on the left-hand-side. However, a minority, such as HyperTalk, place the variable
			on the right. Harlowe allows both to be used, depending on personal preference. (set:) reads
			as `(set: ` variable `to` value `)`, and (put:) reads as `(put: ` value `into` variable `)`.
			
			Details:
			
			Just as with (set:), a variable is changed using `(put: ` value `into` variable `)`. You can
			also set multiple variables in a single (put:) by separating each VariableToValue
			with commas: `(put: 2 into $batteries, 4 into $bottles)`, etc.

			De-structuring also works, although you will need to remember that the left side of a (set:) is
			the right side of a (put:) - `(set: (a: any, $y, $x) to $arr)` would be written as
			`(put: $arr into (a: any, $y, $x))`.

			You can also use typed variables with (put:) - `(put: 1 into num-type $days)` permanently
			restricts $days to numbers. Consult the article about (set:) for more information about
			typed variables.
			
			`it` can also be used with (put:), but, interestingly, it's used on the right-hand side of
			the expression: `(put: $eggs + 2 into it)`.

			See also:
			(set:), (move:)

			Added in: 1.0.0
			#basics 2
		*/
		Macros.add(name, (_, ...assignmentRequests) => {
			let debugMessage = "";
			/*
				This has to be a plain for-loop so that an early return
				is possible.
			*/
			for(let i = 0; i < assignmentRequests.length; i+=1) {
				const ar = assignmentRequests[i];

				if (ar.operator === "into" && name === "set") {
					return TwineError.create("macrocall", "Please say 'to' when using the (set:) macro.");
				}
				else if (ar.operator !== "into" && name === "put") {
					return TwineError.create("macrocall", "Please say 'into' when using the (put:) macro.");
				}

				const debugMessage = ar.set();
				if (TwineError.containsError(debugMessage)) {
					return debugMessage;
				}
			}

			/*
				There's nothing that can be done with the results of (set:) or (put:)
				operations, except to display nothing when they're in bare passage text.
				Return a plain unstorable value that prints out as "".
			*/
			return {
				TwineScript_TypeID:       "instant",
				TwineScript_TypeName:     "a (" + name + ":) operation",
				TwineScript_ObjectName:   "a (" + name + ":) operation",
				TwineScript_Unstorable: true,
				// Being unstorable and not used by any other data strctures, this doesn't need a ToSource() function.
				TwineScript_Print:        () => Engine.options.debug && debugMessage && TwineNotifier.create(debugMessage).render()[0].outerHTML,
			};
		},
		[rest(AssignmentRequest)])
	);

	Macros.add
		/*d:
			(move: ...VariableToValue) -> Instant
			
			A variant of (put:) that, if transferring data from a data structure, deletes the source value
			after copying it - in effect moving the value from the source to the destination.
			
			Example usage:
			* `(move: $arr's 1st into $var)`

			Rationale:
			You'll often use data structures such as arrays or datamaps as storage for values
			that you'll only use once, such as a list of names to print out. When it comes time
			to use them, you can remove it from the structure and retrieve it in one go.

			Details:
			You must use the `into` keyword, like (put:), with this macro. This is because, like (put:),
			the destination of the value is on the right, whereas the source is on the left.

			As with (set:) and (put:), you can also change multiple variables in a single (move:) by
			separating each VariableToValue with commas: `(move: $a's 1st into $b, $a's 2nd into $c)`, etc. Also,
			destructuring syntax (described in detail in (set:)'s article) works with (move:) as well - `(move: $array into (a: $x, $y))`
			will cause only the first and second values of $array to be moved into $x and $y.

			If the data value you're accessing cannot be removed - for instance, if it's an array's `length` -
			then an error will be produced.

			This macro works very well with the `random` data value of arrays: `(move: $deck's random into $card)`
			will remove a random value from $deck and put it into $card. Thus, you can use arrays as random "decks"
			of values that you can draw from and use once in your story.

			Note that this will only delete the data from the source if the source is inside a data structure.
			Moving from variable to variable, such as by `(move:$p into $q)`, won't cause $p to be deleted.

			Just as with (set:) or (put:), typed variables can also be used with the destination variable of (move:).
			Writing `(move: $enemies's 1st into dm-type $currentEnemy)` will move a datamap from $enemies's 1st and
			put it into $currentEnemy, while also restricting $currentEnemy to datamap data for the rest of the story.
			Note that if $enemies's 1st is not, in fact, a datamap, an error will result.

			See also:
			(put:), (set:)

			Added in: 1.0.0
			#basics 3
		*/
		("move", (_, ...assignmentRequests) => {
			let debugMessage = "";
			/*
				This has to be a plain for-loop so that an early return
				is possible.
			*/
			for(let i = 0; i < assignmentRequests.length; i+=1) {
				const ar = assignmentRequests[i];
				if (ar.operator !== "into") {
					return TwineError.create("macrocall", "Please say 'into' when using the (move:) macro.");
				}

				const debugMessage = ar.set(true);
				if (TwineError.containsError(debugMessage)) {
					return debugMessage;
				}
			}
			return {
				TwineScript_TypeID:       "instant",
				TwineScript_TypeName:     "a (move:) operation",
				TwineScript_ObjectName:   "a (move:) operation",
				TwineScript_Unstorable: true,
				// Being unstorable and not used by any other data strctures, this doesn't need a ToSource() function.
				TwineScript_Print:        () => Engine.options.debug && debugMessage && TwineNotifier.create(debugMessage).render()[0].outerHTML,
			};
		},
		[rest(AssignmentRequest)]);

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
			such as changers - but these will usually become bare descriptive
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

			Note that, once stored in a variable, a (print:) command is not a string. So, you
			can't provide it to (upperfirst:) and other such macros. `(upperfirst: (print: $name))`
			will produce an error. However, if $name contains a string, you can provide it to
			(upperfirst:) before giving it to (print:), such as `(print: (upperfirst: $name))`.

			If you need this command to print strings without the markup in the string
			being rendered, you may use the (verbatim:) changer to change the command, or
			use the (verbatim-print:) variant instead.
			
			See also:
			(str:), (display:), (verbatim-print:)

			Added in: 1.0.0
			#basics 4
		*/
		("print",
			noop,
			(cd, _, val) =>
				/*
					The printBuiltinValue() call can call commands' TwineScript_Print() method,
					so it must be withheld until here, so that wordings like (set: $x to (print:(goto:'X')))
					do not execute the command prematurely.
				*/
				assign(cd, { source: printBuiltinValue(val) }),
			[Any])

		/*d:
			(verbatim-print: Any) -> Command
			Also known as: (v6m-print:)

			A convenient combination of (verbatim:) and (print:), this prints out any single argument given to
			it, as text, but without rendering the resulting text as markup.

			Example usage:
			* `(v6m-print: (source: $textChanger))` prints out the source of the value stored in $textChanger.
			* `(set: $name to (v6m-print: (prompt: "Enter your name:")))` prompts the player for their name, then
			stores a command that displays that name verbatim whenever it's printed.

			Rationale:
			In practice, this is functionally identical to a (verbatim:) changer attached to a (print:) command. However, one major
			difference is that this can be stored in a variable and used in passage prose by itself, without having to
			attach the changer each time. This scenario is especially useful when dealing with player-inputted text:
			rather than having to display it with two macros each time, you can simply save this command in a variable
			and use that variable.

			Details:
			As with (print:), once text is given to this command, there's no easy way to extract it from the command value
			without using (source:). So, you can't provide it to (upperfirst:) and other such macros.
			`(upperfirst: (verbatim-print: $name))` will produce an error. Instead, convert the original string
			using (upperfirst:) before giving it to (verbatim-print:).
			
			See also:
			(verbatim:), (print:)

			Added in: 3.2.0
			#basics 16
		*/
		(["verbatim-print", "v6m-print"],
			noop,
			(cd, _, val) =>
				/*
					The printBuiltinValue() call can call commands' TwineScript_Print() method,
					so it must be withheld until here, so that wordings like (set: $x to (print:(goto:'X')))
					do not execute the command prematurely.
				*/
				assign(cd, { verbatim:true, source: printBuiltinValue(val) }),
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
				requestAnimationFrame(()=> Engine.goToPassage(name, { transition: cd.data.passageT8n }));
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
			noop,
			(cd) => {
				if (State.pastLength < 1) {
					return TwineError.create("macrocall", "I can't (undo:) on the first turn.");
				}
				/*
					As with the (goto:) macro, the change of passage must be deferred until
					just after the passage has ceased rendering, to avoid <tw-story> being
					detached twice.
				*/
				requestAnimationFrame(()=> Engine.goBack({ transition: cd.data.passageT8n }));
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

			If the bound variable has already been given a type restriction (such as by `(set:num-type $candy)`), then, if that type isn't `string` or `str`, an error
			will result.

			If you use (replace:) to alter the text inside a (cycling-link:), such as `(cycling-link: bind $tattoo, "Star", "Feather")(replace:"Star")[Claw]`,
			then the link's text will be changed, but the value assigned to the bound variable will *not* - $tattoo will still be "Star", and clicking the
			link twice will return the link's text to "Star". This differs from (dropdown:)'s behaviour in this situation.

			If only one string was given to this macro, an error will be produced.

			Added in: 3.0.0
			#input 1
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

			If the bound variable has already been given a type restriction (such as by `(set:num-type $candy)`), then, if that type isn't `string` or `str`, an error
			will result.

			If you use (replace:) to alter the text inside a (seq-link:), such as `(seq-link: bind $candy, "Two candies", "One candy", "Some wrappers")(replace:"Two")[Five]`,
			then the link's text will be changed, but the value assigned to the bound variable will *not* - $candy will still be "Two candies" until the link is clicked.

			If only one string was given to this macro, an error will be produced.

			Added in: 3.2.0
			#input 2
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
				const {tempVariables} = section.stackTop;

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

	/*
		This is the shared handler for (input-box:) and (force-input-box:).
	*/
	Utils.onStartup(() => $(Utils.storyElement).on(
		/*
			The jQuery event namespace is "input-box-macro".
		*/
		"input.input-box-macro",
		"textarea",
		function inputBoxEvent() {
			const inputBox = $(this),
				/*
					The data should be stored on the nearest surrounding <tw-expression>.
				*/
				event = inputBox.closest('tw-expression').data('inputBoxEvent');
			if (event) {
				event(inputBox);
			}
		}
	));

	/*d:
		(input-box: [VarBind], String, [Number], [String]) -> Command

		A command macro that creates a text input box of the given position, width and height, allowing the player
		to input any amount of text, which can optionally be automatically stored in a variable.

		Example usage:
		* `(input-box: "=X=")` creates an input box that's 33% of the passage width, centered, and 3 lines tall.
		* `(input-box: "XXX=", 5)` creates an input box that's 75% of the passage width, positioned left, and 5 lines tall.
		* `(input-box: bind $code, "XXX=", 5)` creates an input box that's the same as above, but whenever it's edited, the text is stored
		in the $code variable.
		* `(input-box: bind $code, "XXX=", 5, "10 PRINT 'HELLO'")` creates an input box that's the same as above, but initially contains
		the text `"10 PRINT 'HELLO'"`.

		Rationale:
		While there are other means of accepting player text input into the story, such as the (prompt:) macro, you may desire an input region
		that is integrated more naturally into the passage's visual design, and which allows a greater quantity of text to be inputted. This macro
		offers that functionality.

		Details:
		Most of the values you can give to this macro are optional. The only mandatory value is the sizing line, which is the same kind of
		line given to (box:) - a sequence of zero or more `=` signs, then a sequence of characters (preferably "X"), then zero or
		more `=` signs. Think of this string as a visual depiction of the box's horizontal proportions - the `=` signs are the space to
		the left and right, and the characters in the middle are the box itself. Also, to avoid ambiguity with the second string given to this macro,
		a string representing 100% width (no margins) must be a single character, such as just "X".

		The optional number, which must come directly after the sizing line, is a height, in text lines. If this is absent, the box will be sized to 3
		lines. Note, however, that this macro creates a `<textarea>` element, which, in some browsers, can be dynamically resized by the reader by
		clicking and dragging the lower-right corner - so your passage's layout should take into account the possibility of the input box changing size
		dramatically.

		This macro accepts two-way binds using the `2bind` syntax. These will cause the box's contents to always match the current value of the bound
		variable, and automatically update itself whenever any other macro changes it. However, if the variable no longer contains a string then
		it won't update - for instance, if the variable becomes the number 23, the box won't update.

		If the bound variable isn't two-way, the variable will be set to the box's contents as soon as it is displayed - so, it will become the optional
		initial text string, or, if it wasn't given, an empty string.

		If the bound variable has already been given a type restriction (such as by `(set:num-type $candy)`), then, if that type isn't `string` or
		`str`, an error will result.

		The optional initial text string given to this macro will *not* be parsed as markup, but inserted into the box verbatim - so, giving
		`"''CURRENT SAVINGS'': $lifeSavings"` will not cause the $lifeSavings variable's contents to be printed into the box, nor will "CURRENT SAVINGS"
		be in boldface.

		A note about player-submitted strings: because most string-printing functionality in Harlowe (the (print:) macro, and putting variable names
		in bare passage prose) will attempt to render markup inside the strings, a player may cause disaster for your story by placing Harlowe markup
		inside an (input-box:) bound variable, which, when displayed, produces either an error or some effect that undermines the story. In order to
		display those strings safely, you may use either the verbatim markup, the (verbatim:) changer, or (verbatim-print:).

		See also:
		(force-input-box:), (prompt:)

		Added in: 3.2.0
		#input 3
	*/
	/*d:
		(force-input-box: [VarBind], String, [Number], String) -> Command

		A command macro that creates an empty text input box of the given position, width and height, which appears to offer the
		player a means to input text, but instead replaces every keypress inside it with characters from a pre-set string that's
		relevant to the story.

		Example usage:
		* `(force-input-box: "XX=", "I'm sorry, father. I've failed you.")` creates an input box that's 33% of the passage width, centered,
		and which forces the player to type the string "I'm sorry, father. I've failed you.".

		Rationale:
		There are times when, for narrative reasons, you want the player, in the role of a character, to type text into a diegetic textbox, or make
		a seemingly "spontaneous" dialogue reply, but are unable to actually permit the player to type anything they want, as the story you're telling calls for
		specific dialogue or text at this point. While you could simply offer a "pretend" textbox using the (box:) macro, that can't actually be typed into, this
		macro offers an interesting and unexpected alternative: a textbox that tricks the player into thinking they can type anything, only to change the text to fit
		your narrative letter-by-letter as they type it.

		This interface element has very potent and unsettling symbolism - the player suddenly being unable to trust their own keyboard to relay their words gives a
		strong feeling of unreality and loss of control, and as such, it is advised that, unless you wish to leverage that symbolism for horror purposes, you
		should perhaps prepare the player for this element's eccentricity with some accompanying text. Besides that, giving the player the tactile sense of typing words
		can help them occupy the role of their viewpoint character in situations where it's called for, such as a story revolving around text messaging or chat clients.

		Details:
		Unlike (input-box:), the final string is mandatory, as it holds the text that the input box will contain as the player "types" it in.

		The first string you give to this macro is a "sizing line" identical to that accepted by (box:) and (input-box:) - consult their documentation for more
		information about those lines.

		The optional number, which must come directly after the sizing line, is a height, in text lines. If this is absent, the box will be sized to 3
		lines. Note, however, that this macro creates a `<textarea>` element, which, in some browsers, can be dynamically resized by the reader by
		clicking and dragging the lower-right corner - so your passage's layout should take into account the possibility of the input box changing size
		dramatically.

		Because you already know what the text in the box will become, you may feel there's no need to have a bound variable. However, you might wish to bind a temporary
		variable, and then check using a live macro when that variable has become filled with the full string, thus indicating that the player has read it. Otherwise,
		there is no mechanism to ensure that the player actually type out the entire string.

		If the bound variable is two-way, and it contains a string, then, when the input box appears, a number of fixed text characters equal to the string's length will be
		inserted into the input box automatically, and then the variable will update to match. Otherwise, if the bound variable is one-way, the variable will simply
		become an empty string (and then be updated to match the box's contents whenever the player "types" into it).

		See also:
		(input-box:), (prompt:), (box:)

		Added in: 3.2.0
		#input 4
	*/
	["input-box", "force-input-box"].forEach(name => Macros.addCommand(name,
		(...args) => {
			/*
				This somewhat contrived set of checks discerns meaning from the passed-in arguments.
			*/
			const
				varBindProvided = VarBind.isPrototypeOf(args[0]),
				heightProvided = typeof args[1 + varBindProvided] === "number",
				textProvided = typeof args[1 + varBindProvided + heightProvided] === "string",
				widthStr = args[+varBindProvided];

			/*
				First type-check: that the string given is a sizing line.
			*/
			if (typeof widthStr !== "string" || widthStr.search(geomStringRegExp) === -1
					/*
						A rather uncomfortable check needs to be made here: because widthStrs can have zero "=" signs
						on either side, and a middle portion consisting of essentially anything, the default text box
						could be confused for it, unless all 100%-width strings are prohibited to just single characters.
					*/
					|| (!widthStr.includes("=") && widthStr.length > 1)) {
				return TwineError.create("datatype", 'The (' + name + ':) macro requires a sizing line'
						+ '("==X==", "==X", "=XXXX=" etc.) be provided, not ' + JSON.stringify(widthStr) + '.');
			}
			/*
				Second type-check: that (force-input-box:) does, indeed, receive a string.
			*/
			if (name === "force-input-box" && !textProvided) {
				return TwineError.create("datatype", 'The (' + name + ':) macro requires a string of text to forcibly input.');
			}
			/*
				Remaining type-checks: that there are no other values than the given optional values.
			*/
			const intendedLength = 1 + varBindProvided + heightProvided + textProvided;
			if (args.length > intendedLength) {
				return TwineError.create("datatype", "An incorrect combination of values was given to this (" + name + ":) macro.");
			}
		},
		(cd, _, ...args) => {
			const
				force = name === "force-input-box",
				/*
					Again, these contrived lines extract which of the three optional values were given.
				*/
				varBindProvided = VarBind.isPrototypeOf(args[0]),
				heightProvided = typeof args[1 + varBindProvided] === "number",
				/*
					Now the values are actually extracted and computed.
				*/
				bind = varBindProvided && args[0],
				height = heightProvided ? args[1 + varBindProvided] : 3,
				{marginLeft,size} = geomParse(args[+varBindProvided]);

			let text = (typeof args[1 + varBindProvided + heightProvided] === "string") ? args[1 + varBindProvided + heightProvided] : '',
				/*
					(force-input-box:)es have no initial text, UNLESS they're bound to a string variable (see below).
				*/
				initialText = force ? '' : text;

			if (bind.bind === "two way") {
				/*
					If double-binding is present, change the provided text to match the variable, if it
					already holds text.
				*/
				cd.attr.push({"data-2bind": true});
				const bindValue = bind.varRef.get();
				if (typeof bindValue === "string") {
					initialText = force ? text.slice(0, bindValue.length) : bindValue;
					/*
						The 2-way bind is met by a third bind: that of the (force-input-box:) itself,
						changing the variable's string and the <textarea>'s all at once.
					*/
					const result = bind.set(initialText);
					if (TwineError.containsError(result)) {
						return result;
					}
				}
				/*
					This event is called by a handler installed in VarBind.js. Every variable set causes
					this to fire - if it was the bound variable, then try to update the textarea
					to match the variable (if it's a string).
					Also note that the passed-in jQuery is not the <textarea>, but the containing <tw-expression>
					with the [data-2bind] attribute.
				*/
				cd.data.twoWayBindEvent = (expr, obj, name) => {
					if (bind.varRef.matches(obj,name)) {
						const value = bind.varRef.get();
						if (typeof value === "string") {
							expr.find('textarea').val(force ? text.slice(0, value.length) : value);
						}
					}
				};
			}
			else if (bind) {
				/*
					For normal binds, do the reverse, even before player input has been received.
				*/
				const result = bind.set(force ? '' : text);
				if (TwineError.containsError(result)) {
					return result;
				}
				if (!force) {
					cd.data.inputBoxEvent = (textarea) => {
						const value = textarea.val();
						const result = bind.set(value);
						if (TwineError.containsError(result)) {
							textarea.replaceWith(result.render(value));
						}
					};
				}
			}
			/*
				The <textarea> is created with its height directly feeding into its rows value.
			*/
			let source = '<textarea style="margin-left:' + marginLeft + "%;width:" + size + '%" rows=' + height + '>'
				/*
					HTML-escape the passed-in text, which is apparently all that's necessary.
					(force-input-box:)es, of course, start with no text inside.
				*/
				+ Utils.escape(initialText) + '</textarea>';
			/*
				The (force-input-box:) has a different event to (input-box:) - updating the contents on its
				own terms (that is, with the canned text string.)
			*/
			if (force) {
				/*
					Once again, Harlowe represents strings in code points, which is not how .split() represents them,
					so Array.from() must split the string instead.
				*/
				const codePoints = Array.from(text);
				cd.data.inputBoxEvent = (textarea) => {
					/*
						While we could track the length of inputted characters ourselves, this is less likely to
						desynchronise from displayed reality.
					*/
					const {length} = textarea.val();
					const value = codePoints.slice(0, length).join('');
					textarea.val(value);
					/*
						Because (force-input-box:) can't use the previous inputBoxEvent, keeping
						the bound variable updated needs to be done here, too.
					*/
					if (bind) {
						const result = bind.set(value);
						if (TwineError.containsError(result)) {
							textarea.replaceWith(result.render(value));
						}
					}
					return true;
				};
			}
			/*
				Like (box:), this needs display:block so that it can take up an entire row.
			*/
			cd.styles.push({ display: 'block' });
			return assign(cd, { source, append: "replace", });
		},
		[either(VarBind, String), optional(either(positiveInteger,String)), optional(either(positiveInteger,String)), optional(String)])
	);

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
		noop,
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
						assign({}, cd, { append: "replace", source: elem.data('originalSource') || '', target: elem }),
						/*
							Since the shown hook needs access to the tempVariables that are available at its location, retrieve
							the tempVariables data placed on it by Section.execute().
						*/
						elem.data('tempVariables')
					);
				}
			}));
			return cd;
		},
		[rest(HookSet)])
	);

	/*
		This is a shared error message for (confirm:) and (prompt:).
	*/
	const dialogError = evalOnly => ["I can't use a dialog macro in " + evalOnly + ".",
		"Please rewrite this without putting such macros here."];

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
			noop,
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
			noop,
			noop,
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
			noop,
			(/* no cd because this is attachable:false */ section, slotName) => {
				const saveData = localStorage.getItem(storagePrefix("Saved Game") + slotName);
				
				if (!saveData) {
					return TwineError.create("saving", "I can't find a save slot named '" + slotName + "'!");
				}
				
				/*
					If this returns false, the save itself is drastically incorrect.
				*/
				const result = State.deserialise(section, saveData);
				if (result instanceof Error) {
					/*
						Since this could be an issue with multiple versions of the same story,
						showing a TwineError, a developer-facing error, seems incorrect. So, instead
						a (confirm:) is shown, offering to delete the data.
					*/
					const d = dialog({
							message: "Sorry to interrupt... The story tried to load saved data, but there was a problem.\n"
								+ result.message
								+ "\n\nThat data might have been saved from a different version of this story. Should I delete it?"
								+ "\n(Type 'delete' and choose Yes to delete it.)"
								+ "\n\nEither way, the story will now continue without loading the data.",
							defaultValue: "",
							buttons: [
								{name:"Yes", confirm:true, callback: () => {
									if ("delete" === d.find('input').last().val()) {
										localStorage.removeItem(storagePrefix("Saved Game") + slotName);
									}
									section.unblock('');
								}},
								{name:"No", cancel:true, callback: () => section.unblock()},
							],
						});
					Utils.storyElement.append(d);
					return "blocked";
				}
				requestAnimationFrame(Engine.showPassage.bind(Engine, State.passage, false /* stretchtext value */));
			},
			[String], false)

		/*d:
			(dialog: [VarBind], String, ...String) -> Command
			Also known as: (alert:)

			A command that, when used, displays a pop-up dialog box with the given string displayed, and a number of links labeled with
			the remaining other strings. When one of the links is clicked to dismiss the dialog, it evaluates to the string text of that clicked
			link. If an optional bound variable is provided, that variable is updated to match the pressed button.

			Example usage:
			* `(dialog: "Beyond this point, things get serious. Grab a snack and buckle up.", "Sure.")`
			* `(dialog: bind $defund, "Which department will you defund?", "Law Enforcement", "Education", "Health", "Public Housing")`

			Rationale:
			It may seem counterintuitive for such a heavily text-based medium as a hypertext story to have a need for dialog boxes, but they can serve as
			places to include auxiliary text that's contextually separate from the passage's themes, such as brief updates on characters, tasks and goals, or
			momentary asides on incidental world details. because they darken and cover the screen when they appear, they are also very useful for
			displaying and offering especially climactic actions or decisions, such as an irreversible ethical choice.

			While there are other dialog box-producing macros, namely (prompt:) and (confirm:), those are meant purely for input-gathering purposes.
			This is designed to be the most general-use dialog-producing macro, allowing any number of links, and optionally binding the clicked link to a variable.

			Details:
			The dialog that is produced is implemented entirely in HTML. User CSS stylesheets can be used to style it, and (enchant:) macros that affect ?Link can
			affect the dialog links.

			In Harlowe versions prior to 3.1.0, this macro used the built-in `alert()` function of the browser, but to
			support certain newer browsers that no longer offer this function, the macro was changed.

			If no button strings are given, a single link reading "OK" will be used. Giving empty strings for any of the links will cause an error.

			When the dialog is on-screen, the entire game is essentially "paused" - until it is dismissed, no further computations are performed, links can't be clicked,
			and (live:) and (event:) macros shouldn't fire.

			For obvious reasons, you cannot supply a two-way bound variable to this macro. Doing so will cause an error to result.

			From version 3.2.0 on, it is possible to attach changers to this command. `(t8n:'slide-up')+(text-rotate-x:25)(dialog:"EMAIL SENT!")`, for instance, produces a dialog
			that's tilted upward, and which slides upward when it appears.

			See also:
			(alert:), (cycling-link:), (prompt:), (confirm:)

			Added in: 1.0.0
			#popup 1
		*/
		(["dialog","alert"],
			(varBind, message, ...buttons) => {
				if (VarBind.isPrototypeOf(varBind)) {
					if (varBind.bind === "two way") {
						return TwineError.create("datatype", "(dialog:) shouldn't be given two-way bound variables.");
					}
					/*
						The type signature isn't good enough to specify that this needs a VarRef and a string, so this
						small check is necessary.
					*/
					if (message === undefined) {
						return TwineError.create("datatype", "(dialog:) needs a message string to display.");
					}
				}
				else if (message !== undefined) {
					buttons.unshift(message);
				}
				const blank = buttons.findIndex(e => e === "");
				if (blank > -1) {
					return TwineError.create("datatype", "(dialog:)'s " + Utils.nth(blank+1) + " link text shouldn't be an empty string.");
				}
			},
			(cd, section, varBind, message, ...buttons) => {
				/*
					If a bound variable wasn't supplied, awkwardly shimmy all the values to the left.
				*/
				if (!VarBind.isPrototypeOf(varBind)) {
					if (message !== undefined) {
						buttons.unshift(message);
					}
					message = varBind;
					varBind = undefined;
				}
				/*
					If there are no button names given, default to a single "OK" button.
				*/
				if (!buttons.length) {
					buttons = ["OK"];
				}
				/*
					Create the dialog, passing in the ChangeDescriptor, to be used when rendering the string.
				*/
				Utils.storyElement.append(dialog({
					section, message, cd,
					buttons: buttons.map(b => ({
						name: b,
						callback() {
							/*
								VarBind.set() only returns either undefined, or a TwineError (see: mutateRight in VarRef).
								And, since .unblock() will place the TwineError where it should go (in the blockedValues
								stack), this line is sufficient to pass through any resulting TypedVar errors.
							*/
							section.unblock((varBind && varBind.set(b)) || '');
						},
					})),
				}));
				return "blocked";
			},
			[either(VarBind, String), zeroOrMore(String)])

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
			noop,
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
			noop,
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
			noop,
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
			(prompt: String, String, [String], [String]) -> String

			When this macro is evaluated, a browser pop-up dialog box is shown with the first string displayed,
			a text entry box containing the second string (as a default value), a confirm link and a cancel link.
			If the confirm link is clicked, it evaluates to the string in the text entry box. If "Cancel" is clicked, it evaluates to
			the default value regardless of the entry box's contents.

			Example usage:
			`(set: $name to (prompt: "Your name, please:", "Frances Spayne", "Don't care", "Confirm"))`

			Details:
			The dialog that is produced is implemented entirely in HTML. User CSS stylesheets can be used to
			style it, and (enchant:) macros that affect ?Link can affect the dialog links.

			The order of the two optional strings is: the cancel link text, followed by the confirm link text. If
			one or neither of these is provided, the defaults for each are "Cancel" and "OK". Giving a blank string
			for the cancel link will cause that link to disappear. Giving an empty string for the confirm link will
			cause an error (because that link must be clickable for the dialog to work).

			In Harlowe versions prior to 3.1.0, this macro used the built-in `prompt()` function of the browser, but to
			support certain newer browsers that no longer offer this function, the macro was changed.

			When the dialog is on-screen, the entire game is essentially "paused" - until it is dismissed,
			no further computations are performed, links can't be clicked, and (live:) and (event:) macros
			shouldn't fire.

			A note about player-submitted strings: because most string-printing functionality in Harlowe (the (print:) macro,
			and putting variable names in bare passage prose) will attempt to render markup inside the strings, a player
			may cause disaster for your story by placing Harlowe markup inside a (prompt:) string, which, when displayed,
			produces either an error or some effect that undermines the story. In order to display those strings
			safely, you may use either the verbatim markup, the (verbatim:) changer, or (verbatim-print:).

			See also:
			(alert:), (confirm:)

			Added in: 1.0.0
			#popup
		*/
		("prompt",
			(section, message, defaultValue, cancelButton, confirmButton) => {
				/*
					Since (prompt:) and (confirm:) create dialogs as soon as they're evaluated, we need this extra check,
					in addition to the one in Section for expressions, to ensure that this isn't being used in a pure
					evaluation context, such as a link's text, or a (storylet:) macro.
				*/
				if (section.stackTop && section.stackTop.evaluateOnly) {
					return TwineError.create("macrocall", ...dialogError(section.stackTop.evaluateOnly));
				}
				if (confirmButton === "") {
					return TwineError.create("datatype", "The text for (prompt:)'s confirm link can't be blank.");
				}
				const d = dialog({
					section, message, defaultValue,
					buttons:[{
						name: confirmButton || "OK",
						confirm: true,
						callback: () => section.unblock(d.find('input').last().val()),
					},{
						name: cancelButton || "Cancel",
						cancel: true,
						callback: () => section.unblock(defaultValue),
					}],
				});
				Utils.storyElement.append(d);
				// Regrettably, this arbitrary timeout seems to be the only reliable way to focus the <input>.
				setTimeout(() => d.find('input').last().focus(), 100);
			},
			[String, String, optional(String), optional(String)])

		/*d:
			(confirm: String, [String], [String]) -> Boolean

			When this macro is evaluated, a pop-up dialog box is shown with the given string displayed,
			as well as two links (whose text can also be provided) to confirm or cancel whatever action
			or fact the string tells the player. When it is submitted, it evaluates to the boolean true if the
			confirm link had been clicked, and false if the cancel link had.

			Example usage:
			`(set: $makeCake to (confirm: "Transform your best friend into a cake?", "Do not", "Please do"))`

			Details:
			The dialog that is produced is implemented entirely in HTML. User CSS stylesheets can be used to
			style it, and (enchant:) macros that affect ?Link can affect the dialog links.

			The order of the two optional strings is: the cancel link text, followed by the confirm link text. If
			one or neither of these is provided, the defaults for each are "Cancel" and "OK". Giving a blank string
			for the cancel link will cause that link to disappear. Giving an empty string for the confirm link will
			cause an error (because that link must be clickable for the dialog to work).

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
			(section, message, cancelButton, confirmButton) => {
				if (section.stackTop && section.stackTop.evaluateOnly) {
					return TwineError.create("macrocall", ...dialogError(section.stackTop.evaluateOnly));
				}
				if (confirmButton === "") {
					return TwineError.create("datatype", "The text for (confirm:)'s confirm link can't be blank.");
				}
				Utils.storyElement.append(dialog({
					section, message,
					defaultValue: false,
					buttons:[{
						name: confirmButton || "OK",
						confirm: true,
						callback: () => section.unblock(true),
					},{
						name: cancelButton || "Cancel",
						cancel: true,
						callback: () => section.unblock(false),
					}],
				}));
			},
			[String, optional(String), optional(String)])

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
