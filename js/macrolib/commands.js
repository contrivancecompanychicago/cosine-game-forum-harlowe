"use strict";
define(['jquery', 'macros', 'utils', 'state', 'passages', 'engine', 'internaltypes/twineerror',
	'internaltypes/twinenotifier', 'datatypes/assignmentrequest', 'datatypes/hookset', 'datatypes/codehook', 'datatypes/colour', 'datatypes/gradient', 'internaltypes/varref', 'datatypes/typedvar', 'datatypes/varbind', 'utils/operationutils', 'utils/renderutils'],
($, Macros, Utils, State, Passages, Engine, TwineError, TwineNotifier, AssignmentRequest, HookSet, CodeHook, Colour, Gradient, VarRef, TypedVar, VarBind, {printBuiltinValue, objectName, clone, toSource}, {dialog, geomParse, geomStringRegExp}) => {
	
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
	const {Any, Everything, rest, either, optional, zeroOrMore, nonNegativeInteger, positiveInteger, positiveNumber} = Macros.TypeSignature;
	const {assign} = Object;
	const {floor,ceil,abs,max,min} = Math;
	const {noop} = $;

	/*
		As localstorage keys are shared across domains, this prefix, using the current story's IFID,
		is necessary to ensure that multiple stories on a domain have their save files properly namespaced.
	*/
	function storagePrefix(text) {
		return "(" + text + " " + Utils.options.ifid + ") ";
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
	["set","put","unpack"].forEach(name =>
		/*d:
			(set: ...VariableToValue) -> Instant
			
			Stores data values in variables, optionally allowing you to permanently restrict the variable to a single datatype.
			
			Example usage:
			* `(set: $battlecry to "Save a " + $favouritefood + " for me!")` creates a variable called $battlecry containing a string.
			* `(set: _dist to $altitude - $enemyAltitude)` creates a temp variable called _dist.
			* `(set: num-type $funds to 0)` sets a variable and restricts its type to numbers, preventing non-numbers
			from ever being (set:) into it by accident.
			* `(set: const-type $robotText to (font:"Courier New"))` sets a variable and makes it so it can't ever be set
			to another value.
			* `(set: (p-either:"Ms.","Mr.","Mx.")-type $charTitle to "Mx.")` sets a variable that can only hold the strings "Mr.", "Ms." or "Mx.".

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

			The following example demonstrates where temp variables are visible.
			```
			(set: _a to 1) <- This is usable everywhere in this passage.
			[
				(set: _b to 1) <-- This is only usable inside this hook.
				(set: _a to it + 1) <-- This changes the outer _a variable.
				[
					(print: _a + _b) <-- You can refer to both _a or _b in this hook.
				]
			]
			(print: _b) <-- This will cause an error.
			```
			
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
			a temp variable, the passage or hook).

			See also:
			(put:), (move:), (unpack:)

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

			You can also use typed variables with (put:) - `(put: 1 into num-type $days)` permanently
			restricts $days to numbers. Consult the article about (set:) for more information about
			typed variables.
			
			`it` can also be used with (put:), but, interestingly, it's used on the right-hand side of
			the expression: `(put: $eggs + 2 into it)`.

			See also:
			(set:), (move:), (unpack:)

			Added in: 1.0.0
			#basics 2
		*/
		/*d:
			(unpack: ...VariableToValue) -> Instant

			A specialised variation of (put:) that lets you extract multiple values from an array, datamap or string, at once, and put them into
			multiple variables, by placing a matching data structure on the right of `into` containing variables at
			the positions of those values. For instance, `(unpack: (a: 1, 2, 3) into (a: $x, 2, $y))` sets $x to 1 and $y to 3,
			and `(unpack: (dm: "B", 3, "A", 1) into (dm: "A", $x, "B", $y))` sets $x to 1 and $y to 3. 

			Example usage:
			* `(unpack: (a:"north","northeast","south") into (a: _mainPath, _sidePath, _backPath))` sets three temp variables,
			by overwriting each variable in the array on the right with its matching value in the array on the left.
			* `(unpack: $characterStats into (dm: "Maths", _Maths, "Science", _Science))` is the same as `(set: _Maths to $characterStats's Maths, _Science to $characterStats's Science)`.
			* `(unpack: "The Safecracker" into (p:"The ", str-type _job))` extracts the string "Safecracker" from the value, and puts it in the variable _job.
			* `(unpack: (a: "Daria", 25, 14, 25) into (a: str, ...num-type $stats))` extracts the numbers from the left side into a new array stored in $stats.

			Rationale:

			Extracting values from data structures into variables using just the (set:) and (put:) macros can be rather cumbersome, especially if you need to extract
			values from the same array or datamap. The (unpack:) macro provides a means to efficiently access multiple values in such structures, by describing the locations of those values within
			the structure - if you want to obtain the first, second, and fourth values in an array and put them into $a, $b and $c, just write `(a: $a, $b, any, $c)`, in exactly those positions,
			to the right of `into`. The visual clarity of this can provide great assistance in understanding and reminding you of what the data structure is, and the relationship of the destination variables to
			their source values.

			The (unpack:) macro also lets you use string patterns (produced by (p:) and other such macros) to unpack strings into multiple components. To obtain all the digit characters at the
			start of a string, and nothing else, and put them into $a, just write `(p: ...digit-type $a)`. No long-winded (for:) loops and individual character checks are needed - simply describe the
			string using the pattern macros, using typed variables to mark parts to extract, and they can be easily extracted.

			Details:

			Harlowe checks that each value on the right side (henceforth called the "pattern side") has a value that matches it (using the same rules as the `matches` operator)
			on the left side (the "data side"), and overwrites the pattern side with the data side, causing the variables at various positions in the pattern side to be overwritten with values from
			the data. (Remember that datamaps' "positions" are determined by their datanames, not their locations in the (dm:) macro that created them, as,
			unlike arrays, they are not sequential.)

			For extracting substrings from strings, use the (p:) macro and its related macros to construct a string pattern, resembling
			array patterns. For instance, `(unpack: "Slime Ball" into (p: (p-either: "Silt", "Mud", "Peat", "Slime")-type _element, " ", (p-either: "Ball", "Blast", "Shot", "Beam")-type _shape))`
			extracts the words "Slime" and "Ball" from the value, and puts them in the _element and _shape temp variables. Note that
			when this is done, the _element variable is restricted to `(p-either: "Silt", "Mud", "Peat", "Slime")-type` data, so putting
			any other kind of string into it will cause an error. Generally, it's recommended to use temp variables for string destructuring, and then,
			if you need more general variables to hold the extracted substrings, place them in a less restricted variable afterward.

			Note that the pattern side's data structure can have any number of nested data structures inside it.
			`(unpack:  (a: (a: 1), 2, (dm: "A", 3)) into (a: (a: $x), 2, (dm: "A", $y)))` also sets $x to 1 and $y to 3. If you need to reach deeply
			into a data structure (such as one produced by (passages:), (saved-games:) or (open-storylets:)) to get a certain set of values,
			this can come in handy.

			You may have noticed that the data structures on the pattern side may have values that aren't variable names, such as the 2 in the
			preceding example. These can be used as error-checking values - if a matching value isn't present on the right side at that same position,
			then an error will be reported. To ensure that the data side does indeed contain the values you expect it to, you may include these
			values in the pattern side. Of course, you may want to simply enforce that a value of a given datatype is in that position, rather a specific
			value - this can be done by placing a datatype name at that position, like `num` or `str` or `empty`. Consult the datatype article for more
			information on datatype names.

			As you may have also noticed, this syntax is convenient for extracting values from the left side of arrays. But, what if you wish to only select
			values from the middle, or to skip certain values without putting them in variables? You could use a value or a datamap name at that position,
			such as by writing `(set: (a: num, $y, $x) to $array)` - though, if you aren't even certain of the data types that could be at those positions,
			you may find the special `any` data type to be a big help - `(set: (a: any, $y, $x) to $array)` sets $x to the 3rd value in $array and $y to the
			2nd value, without needing to worry about what the first value might be.

			(When dealing with string patterns, the equivalent of `any` is simply `str`, as strings can't contain non-string data.)

			This syntax can be combined with typed variables - simply place the typed variable where a normal variable would be
			within the pattern side. `(unpack: $array into (a: num, num-type $y, num-type _x))` not only sets $y and _x, but it also
			restricts them to number data, all in one statement. If the typed variable is inside an array, and involves a spread datatype (like `...num`)
			then it is restricted to data that matches `(a: ...num)` (i.e. arrays of zero or more `num` values), and it automatically gathers multiple values from the
			right-hand-side that match the datatype. `(set: (a: str, ...bool-type $examAnswers) to (a: "ANSWER KEY", true, false, false, true, false))`
			sets $examAnswers to `(a:true, false, false, true, false)`.
			
			If the destination doesn't contain any variables - for instance, if you write `(unpack: (a:2,3) into (a:3,2))` - then an error will be printed.

			For obvious reasons, (unpack:) can't be used with datasets - you'll have to convert them to arrays on the right side.

			See also:
			(set:), (put:), (move:)

			Added in: 3.2.0
			#data structure
		*/
		Macros.add(name, "Instant", (_, ...assignmentRequests) => {
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
				else if (ar.operator === "to" && name !== "set") {
					return TwineError.create("macrocall", "Please say 'into' when using the (put:) or (unpack:) macro.");
				}
				if ((VarRef.isPrototypeOf(ar.dest) || TypedVar.isPrototypeOf(ar.dest)) === (name === "unpack")) {
					return TwineError.create("macrocall", name === "unpack"
						? "Please use the (unpack:) macro with arrays, datamaps or (p:) patterns containing variables to the right of 'into'."
						: "Please use the (" + name + ":) macro with just single variables and typed variables to the "
							+ (name === "set" ? "left of 'to'." : "right of 'into'.",
						`You may wish to change this to the (${name !== "unpack" ? "unpack" : ar.operator === "to" ? "set" : "put"}:) macro.`));
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
				TwineScript_Print:        () => Utils.options.debug && debugMessage && TwineNotifier.create(debugMessage).render()[0].outerHTML || '',
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
			unpacking syntax (described in detail in (unpack:)'s article) can be used with (move:) as well -
			`(move: $array into (a: $x, $y))` will cause only the first and second values of $array to be moved into $x and $y.

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
		("move", "Instant", (_, ...assignmentRequests) => {
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
				TwineScript_Print:        () => Utils.options.debug && debugMessage && TwineNotifier.create(debugMessage).render()[0].outerHTML || '',
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
			(cd, _, name) => {
				cd.source = Passages.getTree(name);
				return cd;
			},
			[String])
		
		/*d:
			(print: Any) -> Command
			This command prints out any data provided to it, as text.
			
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

			If you have a string you need to print frequently, and you don't want to call (verbatim-print:) every time you need to print it,
			you may wish to simply (set:) a (verbatim-print:) into a variable, like so: `(set: $vbName to (verbatim-print:$name))`. Then, you can
			put the command (set in that variable) into passage prose, and it will work as expected.
			
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
			(verbatim-source: Any) -> Command
			Also known as: (v6m-source:)

			A convenient combination of (verbatim-print:) and (source:), this prints out the Harlowe source code of any value given to it.

			Example usage:
			`(v6m-source: (open-storylets: )'s 1st)` prints the source of the first datamap in the array generated by (open-storylets:).

			Rationale:
			This macro provides a quick way for you to display the source code of a Harlowe value. Normally, you can't easily print the string
			returned by (source:), because, funnily enough, Harlowe will immediately re-render it. You can use this macro instead. This can be
			helpful when you're debugging a story and wish to have a complicated expression's value constantly in view, especially in a "debug-footer" tagged passage.

			Details:
			For more details about the particulars of the source code generated by (source:), see that macro's article. Note that, as with that macro,
			commands created by custom macros (via the (output:) macro) cannot be converted to source - attempting to do so will produce an error.
			
			See also:
			(verbatim-print:), (source:)

			Added in: 3.2.0
			#debugging
		*/
		(["verbatim-source", "v6m-source"],
			(val) => {
				/*
					Note that since custom macro commands cannot be serialised, they can't have a TwineScript_ToSource() method that would return this error
					by itself. Also note that every built-in command has a TwineScript_ToSource() installed by Macros.
				*/
				if (val && val.TwineScript_TypeID === "command" && !val.TwineScript_ToSource) {
					return TwineError.create("datatype", "I can't construct the source code of a command created by a custom macro.");
				}
			},
			(cd, _, val) => {
				return assign(cd, { verbatim:true, source: printBuiltinValue(toSource(val)) });
			},
			[Any])

		/*d:
			(go-to: String) -> Command
			This command stops passage code and sends the player to a new passage, starting a new turn
			as if a passage link was clicked. If the passage named by the string does not exist, this produces an error.
			
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

			You should generally avoid using (go-to:) unconditionally in the passage - that is, avoid using it such
			that it would immediately run when the player enters, regardless of anything. This has a few side-effects:
			it makes it difficult to use (undo:) to return to this passage, and it counts as a new turn for the "turns" identifier even
			though the player didn't do or see anything. You can use (redirect:) in place of (go-to:) to avoid these issues.

			If you simply want to go back to the previous passage, forgetting the current turn, then you may use (undo:).
			
			See also:
			(link-goto:), (undo:), (redirect:)

			Added in: 1.0.0
			#navigation
		*/
		("go-to",
			(name) => {
				/*
					First, of course, check for the passage's existence.
				*/
				if (!Passages.hasValid(name)) {
					return TwineError.create("macrocall",
						`I can't (go-to:) to the passage '${name}' because it doesn't exist.`,
						"Check that you didn't mistype the passage name, or rename the passage to something else."
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
				return { blocked: true };
			},
			[String])

		/*d:
			(redirect: String) -> Command
			This command sends the player to a new passage. However, unlike (goto:), this does
			*not* start a new turn - undoing after this will send the player to the turn before the
			redirect occurred.
			
			Example usage:
			`(redirect: "Workdesk")`
			
			Rationale:
			(go-to:) is useful for transferring the player to a new passage after performing some
			interaction or waiting for some (event:), but is less useful for
			transferring the player from a passage unconditionally. Attempting to undo a turn, using
			(undo:) or (link-undo:), will simply cause the (go-to:) to activate again immediately,
			nullifying the attempt to undo the turn.

			While it's possible to use (display:) in place of a (go-to:), displaying the next passage
			instead of navigating to it, there are a few problems: the displayed passage won't be the name
			produced by (passage:), it won't be present in the (history:) array, the header and footer passages
			won't be re-run, and, of course, the text of the original passage remains onscreen.

			(redirect:) exists as an alternative to (go-to:) that avoids these problems. Furthermore,
			a use of (redirect:) typically indicates to other readers of the code that the change of passages is for
			technical reasons, not for in-story reasons, so the meaning of the two is distinct.

			Details:
			When a (redirect:) macro is used, the departing passage (the one containing the (redirect:) call)
			remains in the (history:) array, and is still considered visited by `visits`. However, no additional
			turn will result.

			Also, temp variables that were (set:) in the departing passage will not be accessible in the new passage.

			Transition changers that can be attached to (go-to:) can be attached to (redirect:), including
			(t8n-depart:) and (t8n-arrive:).

			If it is performed, (redirect:) will "halt" the passage and prevent any macros and text
			after it from running. So, a passage that contains:
			```
			(set: $listen to "I love")
			(redirect: "Train")
			(set: $listen to it + " you")
			```
			will *not* cause `$listen` to become `"I love you"` when it runs.
			
			See also:
			(go-to:), (undo:)

			Added in: 3.3.0
			#navigation
		*/
		("redirect",
			(name) => {
				/*
					First, of course, check for the passage's existence.
				*/
				if (!Passages.hasValid(name)) {
					return TwineError.create("macrocall",
						`I can't (redirect:) to the passage '${name}' because it doesn't exist.`,
						"Check that you didn't mistype the passage name, or rename the passage to something else."
					);
				}
			},
			(cd, _, name) => {
				/*
					As above for (goto:), so too for this.
				*/
				requestAnimationFrame(()=> Engine.redirect(name, { transition: cd.data.passageT8n }));
				return { blocked: true };
			},
			[String])

		/*d:
			(undo: [String]) -> Command
			This command stops passage code and "undoes" the current turn, sending the player to the previous visited
			passage and forgetting any variable changes that occurred in this passage. You may provide an optional
			string to display if undos aren't available.

			Example usage:
			`You scurry back whence you came... (after:2s)[(undo:)]` will undo the current turn after 2 seconds.

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
			
			If undos aren't available (either due to this being the start of the story, or (erase-past:) being used)
			then either the optional second string will be displayed (as markup) instead, or (if that wasn't provided) nothing will be displayed.

			If the previous turn featured the use of (redirect:), (undo:) will take the player to the passage in which the
			turn started, before any (redirect:) macros were run.

			Just like (go-to:), (undo:) will "halt" the passage and prevent any macros and text
			after it from running.

			See also:
			(go-to:), (link-undo:), (icon-undo:)

			Added in: 2.0.0
			#navigation
		*/
		("undo",
			noop,
			(cd, _, str) => {
				if (State.pastLength < 1) {
					return assign(cd, { source: str });
				}
				/*
					As with the (goto:) macro, the change of passage must be deferred until
					just after the passage has ceased rendering, to avoid <tw-story> being
					detached twice.
				*/
				requestAnimationFrame(()=> Engine.goBack({ transition: cd.data.passageT8n }));
				/*
					As with the (goto:) macro, {blocked} signals to Section's runExpression() to cease evaluation.
				*/
				return { blocked: true };
			},
			[optional(String)])

		/*d:
			(debug:) -> Command

			This command, which takes no values, opens the Debug Mode panel if it wasn't open already. This can be used even if the story
			didn't begin in Debug Mode initially.

			Example usage:
			* `(link:"DEBUG")[(debug:)]` creates a link that opens the Debug Mode panel.
			* `(after-error: )[(debug:)]` causes Debug Mode to open if any error occurs in the current passage. This is best used in a "header" or
			"footer" tagged passage.

			Rationale:
			Designed for use in testing, this macro allows you to selectively open the Debug Mode panel at certain parts of the game, after having played through
			the game normally without its presence. It's designed especially for use with (after-error:) - combining them as in the example above will allow
			you to start debugging immediately upon any error occurring.

			Details:
			Note that, to ensure that Harlowe runs at optimal performance, some Debug Mode features will not be immediately available if the panel is opened mid-game.
			In particular, the "replay" dialogs (available in Debug View) won't be available for macros and variables that have already been rendered prior to
			the panel opening.

			Using this macro will *not* cause the contents of passages tagged with "debug-header" or "debug-footer" to suddenly be added to the current passage. However,
			if the Debug Mode panel remains open after changing passages, those will be added to subsequent passages.

			See also:
			(after-error:)

			Added in: 3.3.0
			#debugging
		*/
		("debug",
			noop,
			Engine.enableDebugMode,
			[], false);

	/*
		An onchange event for <select> elements must be registered for the sake of the (dropdown:) macro,
		which is implemented similar to the link macros - the ChangeDescriptor's data.dropdownEvent indicates
		what to do when the <select> is interacted with.
	*/
	Utils.onStartup(() => Utils.storyElement.on(
		/*
			The jQuery event namespace is "dropdown-macro".
		*/
		"click.icon",
		"tw-icon",
		function iconEvent(e) {
			const icon = $(this),
				event = icon.data('clickEvent'),
				alt = icon.attr('alt');

			if (event) {
				event(icon);
			}
			/*
				The built-in icon commands are as follows.
			*/
			if (alt === "Undo") {
				e.stopPropagation();
				Engine.goBack();
			}
			if (alt === "Redo") {
				e.stopPropagation();
				Engine.goForward();
			}
			if (alt === "Fullscreen") {
				e.stopPropagation();
				Engine.toggleFullscreen();
			}
			if (alt === "Restart") {
				if (State.hasSessionStorage) {
					sessionStorage.removeItem("Saved Session");
				}
				window.location.reload();
			}
		}
	));

	/*
		The four icon commands are defined here, as quick arrays of [name, defaultIcon, visibilityTest]. Their names are
		upperfirsted because they are used for the resulting element's alt and title attributes.

		Note that the visibility test for "Fullscreen" doesn't (shouldn't) change as the game progresses, but is included as such
		anyways. Also, "Reload"'s visibility test always returns a truthy value.
	*/
	[
		["Undo", "&#8630;", () => State.pastLength > 0],
		["Redo", "&#8631;", () => State.futureLength > 0],
		["Fullscreen", "&#9974;", () => document.fullscreenEnabled || document.msFullscreenEnabled],
		["Restart", "&#10226;", Object],
	].forEach(([name, defaultIcon, visibilityTest]) => {
		/*d:
			(icon-undo: [String], [String]) -> Command

			Creates an icon, similar to those in the sidebar, that, if visible and clicked, undoes the current turn, returning to the previous passage, as if by (undo:). It is not
			visible if undos aren't available.

			Example usage:
			* `(replace:?sidebar)[(icon-undo: )(size:2)[(str-repeated:$flowers + 1, "✿ ")]]` alters the sidebar such that there is only an undo button, followed
			by a number of `✿ ` symbols equal to the number in $flowers plus 1. The space separating each florette symbol allows it to word-wrap normally. This would
			best be used in a "header" or "footer" tagged passage.
			* `(icon-undo:"👈")` creates an element that uses &#128072; as its icon instead of the default.
			* `(icon-undo:"Undo the turn")` creates an element with the label "Undo the turn" under it.
			* `(icon-undo:"👈", "Undo the turn")` combines both of the above.

			Rationale:
			By default, each passage in a Harlowe story features a narrow sidebar to the left, housing "Undo" and "Redo" menu icons.
			However, using the (replace:), (append:) or (prepend:) changers with the ?sidebar HookName, it is possible to dynamically change
			the sidebar, inserting or replacing its contents with any kind of prose. To that end, it is useful to be able to recreate
			the "Undo" and "Redo" menu icons exactly as they were, in case an earlier operation performed on the sidebar had removed them.

			Details:
			Of course, you can use this in normal passage prose, if you wish - they are merely commands, just like (link-goto:) or (print:).

			If you wish to change the icon to a different symbol, you may provide a string containing a single character to this macro.
			If none is given, the default symbol is &#8630; (in HTML, `&#8630;`).

			You may also provide a string that contains a label for the icon. This label must have more than one character in it (so that it isn't
			confused with the optional icon string) and will be placed beneath the icon. The label's contents will NOT be interpreted as Harlowe markup, so
			everything in it will be used verbatim for the label. This is because, unlike links, the label isn't considered part of passage prose.

			If both strings given to this macro have more than one character in them, an error will result.

			This command creates an element that uses the same default CSS styling as the sidebar's icons: a `<tw-icon>` holding a glyph of text at 66px font size,
			with 0.2 opacity that changes to 0.4 when hovered over.

			Like all sidebar icons, these will automatically hide themselves when they cannot be clicked, leaving a conspicuous space. In the
			case of the "Undo" icon, it will be hidden if it's the first turn of the game, and there is nothing to undo - or if (erase-past:)
			is used to prevent undos. If this is used in a passage, and (erase-past:) is used later in the passage to prevent undoing, then this will automatically,
			instantly hide itself.

			See also:
			(icon-redo:), (undo:), (link-undo:), (click-undo:)

			Added in: 3.2.0
			#sidebar 2
		*/
		/*d:
			(icon-redo: [String], [String]) -> Command

			Creates an icon, similar to those in the sidebar, that, if visible and clicked, "re-does" a turn that was undone. It is only visible if a turn has been undone.

			Example usage:
			* `(replace:?sidebar)[(b4r:"solid")+(b4r-color:gray)+(corner-radius:12)(icon-undo: )(b4r:"solid")+(b4r-color:gray)+(corner-radius:12)(icon-redo: )]` alters the sidebar such
			that the "Undo" and "Redo" icons have rounded borders around them.
			* `(icon-redo:"👉")` creates an element that uses &#128073; as its icon instead of the default.
			* `(icon-redo:"Redo the turn")` creates an element with the label "Redo the turn" under it.
			* `(icon-redo:"👉", "Redo the turn")` combines both of the above.

			Rationale:
			By default, each passage in a Harlowe story features a narrow sidebar to the left, housing "Undo" and "Redo" menu icons.
			However, using the (replace:), (append:) or (prepend:) changers with the ?sidebar HookName, it is possible to dynamically change
			the sidebar, inserting or replacing its contents with any kind of prose. To that end, it is useful to be able to recreate
			the "Undo" and "Redo" menu icons exactly as they were, in case an earlier operation performed on the sidebar had removed them.

			Details:
			Of course, you can use this in normal passage prose, if you wish - they are merely commands, just like (link-goto:) or (print:).

			If you wish to change the icon to a different symbol, you may provide a string containing a single character to this macro.
			If none is given, the default symbol is &#8631; (in HTML, `&#8631;`).

			You may also provide a string that contains a label for the icon. This label must have more than one character in it (so that it isn't
			confused with the optional icon string) and will be placed beneath the icon. The label's contents will NOT be interpreted as Harlowe markup, so
			everything in it will be used verbatim for the label. This is because, unlike links, the label isn't considered part of passage prose.

			If both strings given to this macro have more than one character in them, an error will result.

			This command creates an element that uses the same default CSS styling as the sidebar's icons: a `<tw-icon>` holding a glyph of text at 66px font size,
			with 0.2 opacity that changes to 0.4 when hovered over.

			Like all sidebar icons, these will automatically hide themselves when they cannot be clicked, leaving a conspicuous space. In the
			case of the "Redo" icon, it will be hidden if this is the latest turn of the game, and there is nothing to "re-do".

			See also:
			(icon-undo:)

			Added in: 3.2.0
			#sidebar 3
		*/
		/*d:
			(icon-fullscreen: [String], [String]) -> Command

			Creates an icon, similar to those in the sidebar, that, if visible and clicked, toggles fullscreen mode on or off.

			Example usage:
			* `(prepend:?sidebar)[(icon-fullscreen: )]` adds a fullscreen icon to the sidebar, above the "undo" and "redo" icons. This would best be used in a "header" or "footer" tagged passage.
			* `(icon-fullscreen:"▢")` creates an element that uses &#9634; as its icon instead of the default.
			* `(icon-fullscreen:"Fullscreen")` creates an element with the label "Fullscreen" under it.
			* `(icon-fullscreen:"▢", "Fullscreen")` combines both of the above.

			Rationale:
			By default, each passage in a Harlowe story features a narrow sidebar to the left, housing "Undo" and "Redo" menu icons.
			However, other functions may be desirable to have available to the player at all times, such as the capability to toggle fullscreen mode in the browser.
			While you could place a (link-fullscreen:) or (checkbox-fullscreen:) in your passage prose, placing the icon produced by this macro is a slightly more concise solution that fits with
			the use of the sidebar for view utility commands.

			Details:
			Of course, you can use this in normal passage prose, if you wish - they are merely commands, just like (link-goto:) or (print:).

			If you wish to change the icon to a different symbol, you may provide a string containing a single character to this macro.
			If none is given, the default symbol is &#9974; (in HTML, `&#9974;`).

			You may also provide a string that contains a label for the icon. This label must have more than one character in it (so that it isn't
			confused with the optional icon string) and will be placed beneath the icon. The label's contents will NOT be interpreted as Harlowe markup, so
			everything in it will be used verbatim for the label. This is because, unlike links, the label isn't considered part of passage prose.

			If both strings given to this macro have more than one character in them, an error will result.

			This command creates an element that uses the same default CSS styling as the sidebar's icons: a `<tw-icon>` holding a glyph of text at 66px font size,
			with 0.2 opacity that changes to 0.4 when hovered over.

			When activated, this will make the page's `<html>` element be the fullscreen element, *not* `<tw-story>`. This is because, in most browsers,
			removing the fullscreen element from the page, however briefly, will deactivate fullscreen mode. Since the `(enchant:)` macro, when given ?Page,
			will often need to wrap `<tw-story>` in another element, those macro calls will deactivate fullscreen mode if `<tw-story>` was the fullscreen element.
			So, if you have edited the compiled HTML to add elements before and after it, such as a navigation bar, that will remain visible while the story
			is in fullscreen mode. Additionally, this means that the Debug Mode panel is still visible when fullscreen mode is activated.

			If the browser reports to Harlowe that fullscreen mode is unavailable, then the icon will be hidden, leaving a conspicuous space.

			See also:
			(link-fullscreen:), (checkbox-fullscreen:)

			Added in: 3.2.0
			#sidebar 4
		*/
		/*d:
			(icon-restart: [String]) -> Command

			Creates an icon, similar to those in the sidebar, that, if visible and clicked, reloads the whole page, restarting the story from the beginning.

			Example usage:
			`(replace:?sidebar)[(icon-restart: )]` replaces the sidebar with just the "reload" icon.
			* `(icon-restart:"⟲")` creates an element that uses &#27F2; as its icon instead of the default.
			* `(icon-restart:"Restart")` creates an element with the label "Restart" under it.
			* `(icon-restart:"⟲", "Restart")` combines both of the above.

			Rationale:
			By default, each passage in a Harlowe story features a narrow sidebar to the left, housing "Undo" and "Redo" menu icons.
			However, other functions may be desirable to have available to the player at all times, such as an option to restart the story from the beginning.
			This would be best suited to short stories with a high density of random or branching content, such as a story with dozens of options that ends after
			a certain number of turns, or a procedurally generated puzzle with a lot of dead-ends.

			Details:
			Of course, you can use this in normal passage prose, if you wish - they are merely commands, just like (link-goto:) or (print:).

			If you wish to change the icon to a different symbol, you may provide a string containing a single character to this macro.
			If none is given, the default symbol is &#10226; (in HTML, `&#10226;`).

			You may also provide a string that contains a label for the icon. This label must have more than one character in it (so that it isn't
			confused with the optional icon string) and will be placed beneath the icon. The label's contents will NOT be interpreted as Harlowe markup, so
			everything in it will be used verbatim for the label. This is because, unlike links, the label isn't considered part of passage prose.

			If both strings given to this macro have more than one character in them, an error will result.

			This command creates an element that uses the same default CSS styling as the sidebar's icons: a `<tw-icon>` holding a glyph of text at 66px font size,
			with 0.2 opacity that changes to 0.4 when hovered over.

			Normally, Harlowe stories will attempt to preserve their current game state across browser page reloads.
			This macro will suppress this behaviour, guaranteeing that the story restarts from the beginning.

			Clicking this icon will NOT prompt the player with any kind of dialogue box warning them that this will restart the story. Instead, the story will
			restart without prompting.

			See also:
			(reload:)

			Added in: 3.2.0
			#sidebar 5
		*/
		Macros.addCommand(`icon-${name.toLowerCase()}`,
			(icon, label) => {
				if (typeof icon === "string" && typeof label === "string") {
					/*
						String lengths are checked using [...icon], as per other
						string length checks throughout Harlowe. If no string was given, don't throw an error.
					*/
					const length1 = [...icon].length, length2 = [...label].length;
					/*
						Icons can only be one character (i.e. UTF-8 code point) long. 
					*/
					if (length1 > 1 && length2 > 1) {
						return TwineError.create("datatype",
							`One of the two strings given to (icon-${name.toLowerCase()}:) should be 1 character long, for its icon.`
						);
					}
					if (length1 === 1 && length2 === 1) {
						return TwineError.create("datatype",
							`One of the two strings given to (icon-${name.toLowerCase()}:) should be 2 or more characters long, for its label.`
						);
					}
				}
			},
			(cd, _, icon, label) => {
				if ((typeof label === "string" && [...label].length === 1) || (typeof icon === "string" && [...icon].length > 1)) {
					[icon,label] = [label,icon];
				}
				/*
					The (icon-undo:) macro shares some code with (link-undo:) it will auto-update itself when the
					past is entirely erased. However, unlike (link-undo:), it has no alternative string to render, making this
					callback a little simpler.
				*/
				if (name === "Undo") {
					cd.data.erasePastEvent = icon => {
						/*
							Because (erase-past:) could have occurred inside a (dialog:), the icon should only be hidden when the section is unblocked.
						*/
						cd.section.whenUnblocked(() => $(icon).css('visibility','hidden'));
					};
				}
				return assign(cd, { source: `<tw-icon tabindex=0 alt="${name}" ${label ? `data-label="${label.replace('"',"&quot;")}"` : '' } title="${name}" ${visibilityTest() ? "" : 'style="visibility:hidden"'}>${icon || defaultIcon}</tw-icon>`});
			},
			[optional(String), optional(String)]);
	});

	/*d:
		(icon-counter: Bind, String, [String]) -> Command

		A command that creates a numeric counter element with a text label, designed to fit in the sidebar, displaying the contents of a number variable (rounded to a whole number as if by (trunc:)),
		and updating it whenever another macro changes it.

		Example usage:
		* `(append: ?sidebar)[(icon-counter: bind $sunseeds, "Sunflower Seeds")]` creates a counter element labeled `"Sunflower Seeds"`, which updates to match the number in $sunseeds.
		* `(set: $satchel to (dm:"tomato",2))(prepend: ?sidebar)[(icon-counter: bind $satchel's tomato, "Tomato", "Tomatoes")]` creates a counter element labeled `"Tomatoes"` if `$satchel's tomato` contains a number other than
		1, and `"Tomato"` otherwise.

		Rationale:
		The sidebar for Harlowe stories contains two basic gameplay utility functions by default – an (icon-undo:) button and an (icon-redo:) button – and can have more such buttons added using
		the other icon-related macros, along with changers such as (append:) and (prepend:), and ideally in a header or footer tagged passage. But, one can also use that space to hold status
		information relevant to the player. If the game features a number of vital numeric values, such as a score or a resource count, having that value be in constant view, and in a relatively consistent
		screen position, can be very helpful in keeping the player aware of their current status.

		This element is visually optimised toward small, whole numeric values, such as the whole numbers from 0 to 100. Numbers with a greater number of decimal places than that can be
		used, but they will likely exceed the width of the sidebar. Furthermore, decimal places in the value will not be displayed, but will be rounded using the (trunc:) algorithm.

		Details:
		The optional second string allows for you to provide singular and plural forms of the counter label, which change based on whether the counter is 1 or -1. The first string becomes the
		singular form of the label, and the second string serves as the plural.

		Unlike the other icon-related commands, which create clickable icons, the element this creates cannot be clicked, and is designed to be fully visible at all times. Thus,
		it does not have 30% opacity by default, but instead has 100% opacity. You may attach the (opacity:) changer to it to lower its opacity, if you wish.

		The font used for this element, by default, is Verdana (and falls back to the browser's default sans-serif font family). This is intended to visually differentiate this counter
		from story prose, which uses a serif font by default.

		If, when the element is created, the bound variable is not a number, then an error will result.
		However, if the bound variable ever changes to a non-number data value after that, then the counter will simply not update, instead of producing an error.

		See also:
		(meter:)

		Added in: 3.2.0
		#sidebar 6
	*/
	Macros.addCommand('icon-counter',
		(_, label, pluralLabel) => {
			const errorMsg = ` label string given to (icon-counter:) can't be empty or only whitespace.`;
			if (!label || !label.trim()) {
				return TwineError.create("datatype", `The 1st ` + errorMsg);
			}
			if (typeof pluralLabel === "string" && !pluralLabel.trim()) {
				return TwineError.create("datatype", `The 2nd ` + errorMsg);
			}
		},
		(cd, _, bind, label, pluralLabel) => {
			/*
				Being a UI display macro, all binds given to this macro are automatically promoted to 2binds, because the second bind
				(variable -> element) is the only one that matters.
			*/
			cd.attr.push({"data-2bind": true});
			/*
				This standard twoWayBindEvent updates the counter's text, very simply.
			*/
			cd.data.twoWayBindEvent = (_, obj, name) => {
				if (bind.varRef.matches(obj,name)) {
					const value = bind.varRef.get();
					if(typeof value === "number") {
						const icon = cd.target.children('tw-icon');
						icon.text(
								/*
									This check should have the same logic as the (trunc:) macro.
								*/
								value > 0 ? floor(value) : ceil(value)
							).attr('data-label', abs(value) !== 1 && pluralLabel !== undefined ? pluralLabel : label);
					}
				}
			};
			const value = bind.varRef.get();
			/*
				Though it's possible for it to be redefined, a type restriction check might as well be performed now
				when the command is being created.
			*/
			if (typeof value !== "number") {
				return TwineError.create("datatype",
					`(icon-counter:) can only be bound to a variable holding a number, not ${objectName(value)}.`
				);
			}
			return assign(cd, { source: `<tw-icon data-label="${
					Utils.escape(abs(value) !== 1 && pluralLabel !== undefined ? pluralLabel : label)
				}">${value > 0 ? floor(value) : ceil(value)}</tw-icon>`
			});
		},
		[VarBind, String, optional(String)]);

	/*d:
		(meter: Bind, Number, String, [String], [Colour or Gradient]) -> Command

		A command that creates a horizontal bar-graph meter, showing the current value of a number variable, relative to a maximum value, and updating it whenever
		that variable changes.

		Example usage:
		* `(set:$batteryPower to 800)(meter: bind $batteryPower, 1000, "X", "Battery Power: $batteryPower", (gradient: 90, 0, red, 1, orange))` creates a centered meter showing the value of the $batteryPower variable,
		from 0 to 1000, using a gradient from orange (full) to red (empty).
		* `(set:$threatLevel to 2)(b4r:'solid')(meter: bind $threatLevel, 10, "==X", red)` creates a right-aligned meter showing the value of the $threatLevel variable,
		from 0 to 10, in red, with a solid border.

		Rationale:
		For those making number-heavy games, presenting those numbers in an immediately recognisable fashion can be essential to a smooth game experience - and there are times when simply
		stating the numbers in the prose isn't as direct as you'd like. The standard videogame UI meter, a bar that fills with a colour to represent an important value, is a
		visual idiom familiar to many people. In addition to their familiarity, meters have important semantic value, too - simply by graphically presenting a value in a meter,
		a player can immediately get a sense of how important to their play session that value is, as well as understand what numeric range that value should occupy during play.

		Details:
		The meter will graph the value of the bound variable, from 0 to the given maximum value number (which must be positive). For instance, if that number is 20, then if the bound variable is 5,
		the meter bar will be 25% full.

		The meter is a "box" element, which takes up the full width of the passage or hook in which it's contained. Placing it inside column markup can
		allow you to place text alongside it, or other (meter:) commands, if you so desire.

		The first string you give to this macro is a "sizing line" identical to that accepted by (box:) and (input-box:) - consult their documentation for more
		information about those lines. However, the sizing line also determines the direction that the meter's bar fills. If the meter is left-aligned or
		occupies the full width (by being given "X" as a sizing string), the bar fills from left (empty) to right (full), and the opposite is true for
		right-alignment. Centre-alignment causes the bar to fill from the centre, expanding outward in both directions.

		The second, optional string is a label that is placed inside the meter, on top of the bar. This text is aligned in the same direction as the meter itself.
		Whenever the meter updates, the label is also re-rendered.

		Either a colour or a gradient can be given as the final value, with which to colour the bar. If neither is given, the bar will be a simple gray.
		If a gradient is given, and it isn't a (stripes:) gradient, its rotation will be automatically changed to 90 degrees, with the leftmost colour
		(at colour stop 0) being placed at the "empty" end of the meter, and the rightmost colour (at colour stop 1) placed at the "full" end. If the bar
		is center-aligned, then the gradient will be modified, with both ends of the graph having the leftmost colour, and the center having the rightmost colour.

		The meter is exclusively horizontal, and cannot be rotated unless you attach (text-rotate:) to it.

		Note: In Internet Explorer 10, the vertical height of the meter may be lower than as drawn in other browsers. This is due to a CSS limitation in that browser.

		See also:
		(icon-counter:)

		Added in: 3.2.0.
		#input and interface
	*/
	Macros.addCommand('meter',
		(_, __, widthStr, labelOrGradient) => {
			if (typeof labelOrGradient === 'string' && !labelOrGradient.trim()) {
				return TwineError.create("datatype", `The label string given to (meter:) can't be empty or only whitespace.`);
			}
			if (widthStr.search(geomStringRegExp) === -1
					/*
						A rather uncomfortable check needs to be made here: because widthStrs can have zero "=" signs
						on either side, and a middle portion consisting of essentially anything, the default text box
						could be confused for it, unless all 100%-width strings are prohibited to just single characters.
					*/
					|| (!widthStr.includes("=") && widthStr.length > 1)) {
				return TwineError.create("datatype", 'The (meter:) macro requires a sizing line'
						+ '("==X==", "==X", "=XXXX=" etc.) be provided, not ' + JSON.stringify(widthStr) + '.');
			}
		},
		(cd, section, bind, maxValue, widthStr, labelOrGradient, gradient) => {
			/*
				If a label wasn't provided, but a gradient was, correct the arguments.
			*/
			if (labelOrGradient && typeof labelOrGradient !== 'string') {
				gradient = labelOrGradient;
				labelOrGradient = undefined;
			}
			/*
				The default colour is a single 50% transparent gray, which is agnostic of whether the passage's colour
				scheme is dark or light.
			*/
			if (!gradient) {
				gradient = Colour.create({h:0, s:0, l:0.5, a:0.5});
			}
			/*
				Single-colours can be provided instead of gradients. However, the bar needs to be drawn with a gradient background,
				so that background-size can affect it. So, convert it to a gradient.
			*/
			if (Colour.isPrototypeOf(gradient)) {
				gradient = Gradient.create(90, [{ colour: gradient, stop:0, }, { colour: gradient, stop:1, }]);
			}
			/*
				The sizing line is used to determine the bar and text's alignment, as well as that of the <tw-expression> itself.
				Center alignment is used if there's left and right margins, and right alignment is used if there's no left margin.
				Notice that the "X" sizing line is interpreted as left alignment by default, rather than center alignment.
			*/
			const {marginLeft,size} = geomParse(widthStr);
			const isCenter = marginLeft > 0 && Math.ceil(marginLeft + size) < 100;
			/*
				This function is used for both initial assigment of styles to the <tw-meter>, and to live updates.
				Only the styles necessary for drawing the meter bar, in and of itself, are attached to the <tw-meter> element -
				the borders, placement and sizing are left to the parent <tw-expression>, so that borders applied by
				(b4r:) (which are placed on the <tw-expression>) interact correctly with the meter.
				Hence, this receives "height:100%".
			*/
			const makeStyleString = value => {
				const clampedSize = max(0, min(1, value / maxValue));
				/*
					The method for cutting a non-repeating gradient down by a percentage amount is to think
					of the problem from the opposite side: simply multiply the gradient's colour stops by
					the percentage's reciprocal, so that they extend beyond 100%.
				*/
				const g = gradient.repeating ? gradient : gradient.multiply(maxValue / value);
				return `height:100%;background-repeat:no-repeat;background-image:${
						/*
							A center-aligned graph consists of two different gradient backgrounds, extending to the left and right
							from the centre. This line produces the left extension.
						*/
						(isCenter ? assign(g, g.repeating ? {} : { angle: 270 }).toLinearGradientString() + ", " : '')
						/*
							And, this line produces either the right extension, or the entire bar for other alignments.
							Note that the gradient angle is reversed for right-alignment (270 rather than 90).
						*/
						+ assign(g, g.repeating ? {} : { angle: isCenter || marginLeft === 0 ? 90 : 270 }).toLinearGradientString()
					};background-size:${
						isCenter ? Array(2).fill(clampedSize * 50 + "%") : clampedSize * 100 + "%"
					};background-position-x:${
						/*
							This slightly complicated forumla is required to eliminate the compensatory
							position provided by background-position-x's normal behaviour, where 0 places
							the left edge at the left side and 100 places the right edge at the right side.
							Thanks to this page for assistance:
							https://css-tricks.com/focusing-background-image-precise-location-percentages/
						*/
						isCenter ? (-50 * 2/(2-clampedSize) + 100)  + "%," + (50 * 2/(2-clampedSize)) + "%"
						: marginLeft === 0 ? 'left' : 'right'
					};text-align:${
						isCenter ? 'center' : marginLeft === 0 ? 'left' : 'right'
					}`;
			};
			/*
				These other styles related to placement within the passage are, as mentioned, attached to the <tw-expression>
				using the ChangeDescriptor's styles array.
			*/
			cd.styles.push({
				'margin-left': marginLeft + '%',
				width: size + '%',
				height: '1.5em',
				display: 'block',
			});
			/*
				Being a UI display macro, all binds given to this macro are automatically promoted to 2binds, because the second bind
				(variable -> element) is the only one that matters.
			*/
			cd.attr.push({"data-2bind": true});
			/*
				As this is a deferred rendering macro (if a label is present), the current tempVariables
				object must be stored for reuse, as the section pops it when normal rendering finishes.
			*/
			const tempVariables = labelOrGradient && section.stackTop.tempVariables;
			/*
				This standard twoWayBindEvent updates the meter's CSS, very simply.
			*/
			cd.data.twoWayBindEvent = (expr, obj, name) => {
				if (bind.varRef.matches(obj,name)) {
					const value = bind.varRef.get();
					if (typeof value === "number") {
						const meter = cd.target.children('tw-meter');
						meter.attr('style', makeStyleString(value));
						if (labelOrGradient) {
							/*
								Re-render the label. We do NOT reuse the same ChangeDescriptor here, because this renders into the <tw-meter> instead of the
								wrapping <tw-expression>, and thus shouldn't have the same styles, borders, etc. as it.
							*/
							cd.section.renderInto("", null, { source: labelOrGradient, target: meter, append: 'replace', transitionDeferred: false, }, tempVariables);
						}
					}
				}
			};
			let value = bind.varRef.get();
			/*
				Though it's possible for it to be redefined, a type restriction check might as well be performed now
				when the command is being created.
			*/
			if (typeof value !== "number") {
				return TwineError.create("datatype",
					`(meter:) can only be bound to a variable holding a number, not ${objectName(value)}.`
				);
			}
			/*
				Like (box:), this needs display:block so that it can take up an entire row.
			*/
			return assign(cd, { source: `<tw-meter style="${ makeStyleString(value) }">${labelOrGradient || ''}</tw-meter>` });
		},
		[VarBind, positiveNumber, String, optional(either(String, Colour, Gradient)), optional(either(Colour, Gradient))]);

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
			#input and interface 1
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
			#input and interface 2
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
	Utils.onStartup(() => Utils.storyElement.on(
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

		Harlowe markup inside (dropdown:) labels will be ignored - the text will be treated as if the markup wasn't present. For instance,
		`(dropdown: bind $mode, "//Stealth//", "//Speed//")` will produce a dropdown with "Stealth" and "Speed", with the italic styling markup removed.

		See also:
		(cycling-link:), (checkbox:)

		Added in: 3.0.0
		#input and interface
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
					+ Utils.escape(label || '─'.repeat(longestLabelLength))
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
		This is the handler for (checkbox:).
	*/
	Utils.onStartup(() => Utils.storyElement.on(
		/*
			The jQuery event namespace is "checkbox-macro".
		*/
		"input.checkbox-macro",
		"input[type=checkbox]",
		function checkboxEvent() {
			const checkbox = $(this),
				/*
					The data should be stored on the nearest surrounding <tw-expression>.
				*/
				event = checkbox.closest('tw-expression').data('checkboxEvent');
			if (event) {
				event(checkbox);
			}
		}
	));
	/*
		A unique ID for checkbox elements, to bind their <label>s to them via their name attribute.
	*/
	let checkboxUUID = 1;

	/*d:
		(checkbox: Bind, String) -> Command

		A command that creates a checkbox input, which sets the given bound variable to `true` or `false`, depending on its state.

		Example usage:
		* `(checkbox: bind $gore, "Show violent scenes")` creates a checkbox labeled "Show violent scenes" which is initially unchecked.
		* `(checkbox: 2bind $perma, "Permadeath")` creates a checkbox which is initially checked if $perma is `true`, and continues to
		update itself whenever some other macros change $perma.

		Rationale:

		This command uses the common web page checkbox input to let you ask the player for their preference on an auxiliary or
		metatextual feature or decision. Unlike the (confirm:) command, this doesn't directly ask the player a yes/no question, but simply
		presents a phrase or option that they can opt into or out of. Thus, it is useful for offering choices that aren't directly "in-character"
		or diegetic in the narrative - though, you could still use it for that purpose if the clinical nature of a checkbox was especially fitting for the setting.

		Details:

		This macro accepts two-way binds using the `2bind` syntax. These will cause the checkbox's contents to always match the current value of the bound
		variable, and automatically update itself whenever any other macro changes it. However, if the variable no longer contains a boolean, then
		it won't update - for instance, if the variable becomes the number 23, the checkbox won't update.

		If the bound variable isn't two-way, the checkbox will be unchecked when it appears, and the variable will be set to `false` as soon as it is displayed.

		If the bound variable has already been given a type restriction (such as by `(set:num-type $candy)`), then, if that type isn't `string` or
		`str`, an error will result.

		If the label string is empty, an error will result.

		See also:
		(dropdown:), (input-box:), (confirm:)

		Added in: 3.2.0
		#input and interface 5
	*/
	Macros.addCommand("checkbox",
		() => {},
		(cd, _, bind, label) => {
			let checked = false;
			let uniqueName = "checkbox-" + (++checkboxUUID);
			/*
				If the binding is two-way, add the special [data-2bind] signalling attribute, get the initial checked
				value from the bound variable, and set up the two-way binding event.
			*/
			if (bind.bind === "two way") {
				cd.attr.push({"data-2bind": true});
				const value = bind.varRef.get();
				if (typeof value === "boolean") {
					checked = value;
				}
				cd.data.twoWayBindEvent = (input, obj, name) => {
					if (bind.varRef.matches(obj,name)) {
						const value = bind.varRef.get();
						/*
							Inward binding: when the variable changes (and remains a boolean), update the check status.
						*/
						if (typeof value === "boolean") {
							input.children('input[type=checkbox]').prop('checked', value);
						}
					}
				};
			}
			cd.data.checkboxEvent = (box) => {
				const value = box.is(':checked');
				const result = bind.set(value);
				if (TwineError.containsError(result)) {
					/*
						As with (input-box:), show any type-restriction errors that occur.

						A spot of trivia: if a Jasmine test spec tries to test the checkbox event using
						.click(), jQuery will produce an error, due to removing an element whilst performing a .click() on it.
					*/
					box.replaceWith(result.render(''));
				}
			};
			/*
				In HTML, checkboxes and labels are associated with [for] and [id] attribute keys.
			*/
			return assign(cd, { source: `<input id="${uniqueName}" type="checkbox" ${checked ? 'checked' : ''}><label for="${uniqueName}">${label}</label>`, append: "replace", });
		},
		[VarBind, String]
	);

	/*d:
		(checkbox-fullscreen: String) -> Command

		A command that creates a checkbox input, which toggles the browser's fullscreen mode and windowed mode. The checkbox will automatically update to match
		the browser's fullscreen status. If fullscreen mode cannot be entered, the checkbox will be disabled.

		Example usage:
		`(checkbox-fullscreen: "Fullscreen mode")`

		Rationale:
		Modern browsers allow web pages to take up the entire screen of the user, in a manner similar to desktop games. This feature can be useful
		for immersive or moody stories, such as horror stories, that wish to immerse the player's senses in a certain colour or shade, or to display
		impactful text that doesn't have to compete for attention from any other screen elements. While it can be more convenient to place an (icon-fullscreen:)
		in your story's sidebar, this macro can be useful if you remove or replace the sidebar with something else, and can serve as an alternative
		means of activating fullscreen mode.

		Details:
		When activated, this will make the page's `<html>` element be the fullscreen element, *not* `<tw-story>`. This is because, in most browsers,
		removing the fullscreen element from the page, however briefly, will deactivate fullscreen mode. Since the `(enchant:)` macro, when given ?Page,
		will often need to wrap `<tw-story>` in another element, those macro calls will deactivate fullscreen mode if `<tw-story>` was the fullscreen element.
		So, if you have edited the compiled HTML to add elements before and after it, such as a navigation bar, that will remain visible while the story
		is in fullscreen mode. Additionally, this means that the Debug Mode panel is still visible when fullscreen mode is activated.
		
		Currently, there is no special functionality or error reporting when the browser reports that fullscreen mode is available, but the attempt
		to switch to fullscreen mode fails. In that case, the checkbox will simply appear to do nothing.

		See also:
		(checkbox:), (link-fullscreen:), (icon-fullscreen:)

		Added in: 3.2.0.
		#input and interface 6
	*/
	Utils.onStartup(() =>
		$(document).on('fullscreenchange', () => {
			$("input[type=checkbox][id^=fullscreen]", Utils.storyElement).each((_, checkbox) => {
				($(checkbox).closest('tw-expression').data('fullscreenEvent') || Object)(checkbox);
			});
		})
	);
	Macros.addCommand("checkbox-fullscreen",
		() => {},
		(cd, _, label) => {
			let uniqueName = "fullscreenCheckbox-" + (++checkboxUUID);
			cd.data.fullscreenEvent = box => $(box).prop('checked', !!(document.fullscreenElement || document.msFullscreenElement));
			cd.data.checkboxEvent = () => Engine.toggleFullscreen();
			/*
				In HTML, checkboxes and labels are associated with [for] and [id] attribute keys.
			*/
			return assign(cd, {
				source: `<input id="${uniqueName}" type="checkbox" ${
					document.fullscreenEnabled || document.msFullscreenEnabled ? ' ' : "disabled "
				}${
					document.fullscreenElement || document.msFullscreenElement ? 'checked' : ''
				}><label for="${uniqueName}">${label}</label>`,
				append: "replace",
			});
		},
		[String]
	);


	/*
		This is the shared handler for (input-box:) and (force-input-box:).
	*/
	Utils.onStartup(() => Utils.storyElement.on(
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
		(input-box: [Bind], String, [Number], [String]) -> Command

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
		variable, and automatically update itself whenever any other macro changes it. However, if the variable no longer contains a string, then
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
		#input and interface 3
	*/
	/*d:
		(force-input-box: [Bind], String, [Number], String) -> Command

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
		#input and interface 4
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
			}
			/*
				The (force-input-box:) version of this event is further below.
			*/
			if (!force && bind) {
				cd.data.inputBoxEvent = (textarea) => {
					const value = textarea.val();
					const result = bind.set(value);
					if (TwineError.containsError(result)) {
						textarea.replaceWith(result.render(''));
					}
				};
			}
			/*
				The <textarea> is created with its height directly feeding into its rows value.
			*/
			let source = '<textarea style="width:100%" rows=' + height + '>'
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
							textarea.replaceWith(result.render(''));
						}
					}
					return true;
				};
			}
			cd.styles.push({
				/*
					Like (box:), this needs display:block so that it can take up an entire row.
				*/
				display: 'block',
				/*
					These need to be on the <tw-enchantment> so that the resulting border is one that (border:) can correctly replace.
				*/
				'margin-left': marginLeft + "%",
				width: size + '%',
				/*
					The default border style can be overridden with (border:).
				*/
				'border-style'() {
					return this.style.borderStyle || 'solid';
				},
			});
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
		
		(link:"Turn on fan")[(t8n:"dissolve")(show:?fan)]
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

		You can attach a transition changer, such as (transition:), (transition-time:), (transition-delay:), and the rest, to this command.
		Doing so will cause that transition to be applied to the hook.

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
		(hidden:), (replace:), (rerun:), (more:), (animate:)

		Added in: 2.0.0
		#showing and hiding
	*/
	/*d:
		(rerun: ...HookName) -> Command
		
		Reruns hooks, restoring them to their original contents, and running the macros within them an additional time.

		Example usage:
		```
		|1>[You drew a (either:...(range:2,10), "Jack", "Queen", "King", "Ace") of (either:"Hearts","Clubs","Spades","Diamonds").]
		(link-rerun:"Shuffle and draw.")[(t8n:"dissolve")(rerun:?1)]
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

		You can attach a transition changer, such as (transition:), (transition-time:), (transition-delay:), and the rest, to this command.
		Doing so will cause that transition to be applied to the hook.

		(rerun:), unlike (show:), will not work on hidden hooks until they become visible using (show:) or (link-show:).

		If you want to rerun a hook multiple times based on elapsed real time, use the (live:) macro.

		See also:
		(replace:), (show:), (more:), (live:), (animate:)

		Added in: 3.2.0
		#revision
	*/
	["show","rerun"].forEach(name => Macros.addCommand(name,
		/*
			The fact that these are variadic macros is unnecessary (due to the existence of the + operator
			on HookSets) and inconsistent with other macros like (click:), but, nevertheless...
		*/
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
					const tempVariables = elem.data('tempVariables');
					section.renderInto("", null,
						assign({}, cd, { append: "replace", source: elem.data('originalSource') || '', target: elem }),
						/*
							Since the shown hook needs access to the tempVariables that are available at its location, retrieve
							the tempVariables data placed on it by Section.execute(), creating a new child scope using Object.create()
							(similar to how (for:) creates scopes for its renders.)
						*/
						tempVariables && Object.create(tempVariables)
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

			Hides a hook, or hooks, that were already visible, without fully erasing them or their contained macro calls.

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
			(hide:) will hide every hook with the given names. To only hide a specific hook, you can use the
			possessive syntax, as usual: `(hide: ?1's 1st)`.

			If you want to remove the hook's contents all together, and re-create it anew later, consider using (replace:) and (rerun:)
			rather than (show:) and (hide:).

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(show:), (rerun:), (replace:)

			Added in: 3.2.0
			#showing and hiding
		*/
		("hide",
			noop,
			(section, ...hooks) => {
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
			},
			[rest(HookSet)], false /* Can't have attachments.*/)

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

			To avoid a potential infinite loop, whereby (load-game:) loads a game whose current passage contains
			another (load-game:) call, an error will occur if (load-game:) is run immediately after a game is loaded.
			("Immediately" means that the second (load-game:) call occurs with no time delay, such as by (after:), or with
			no player input, such as by (link:).)

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
				/*
					Throw an error if (load-game:) was already used to load this passage.
				*/
				if (section.loadedGame) {
					return TwineError.create('infinite',"I can't use (load-game:) immediately after loading a game.");
				}

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
					return { blocked: d };
				}
				requestAnimationFrame(Engine.showPassage.bind(Engine, State.passage, { loadedGame: true }));
			},
			[String], false /* Can't have attachments.*/)

		/*d:
			(erase-past: Number) -> Command

			This macro, when used, "erases" previous turns, preventing the player from using undo features (like (link-undo:))
			to return to them. Providing a positive number will erase that many turns from the start of the game, and providing a
			negative number will erase all the turns up to that point from the end.

			Example usage:
			* `(erase-past:-2)` erases all previous turns up to and including the second-last turn.
			* `(erase-past:-1)` erases all previous turns.
			* `(erase-past:1)` erases the first turn. This could be useful for erasing a "title screen" turn
			from the story, which doesn't make sense for the player to "undo".

			Rationale:
			By default, Harlowe allows the player (via the default sidebar) to undo any number of turns, all the way up to
			the start of the game. This macro makes it easy to limit this ability, either at key moments in the story (such as
			the starts of chapters or viewpoint switches) or constantly, by placing it in a "header" or "footer" tagged passage.

			Note that while it's possible to limit the player's ability to undo by simply removing or replacing the default (icon-undo:)
			instance from the sidebar (such as, for example, `(replace:?sidebar)[(if:$canUndo)(icon-undo:)]`, and then conditionally changing the $canUndo variable
			throughout the story), this macro provides a more direct way of limiting undos. In particular, it makes it
			easy to limit the *distance* that a player can undo from the current turn.

			Be careful and judicious in your use of this macro. In most cases, limiting the player's ability to undo actions isn't
			a particularly interesting or clever game design restriction. However, there are certain genres of game, such as
			survival horror games or experiential dream simulators, where suddenly limiting the ability to undo at periodic intervals
			can have a desirable disempowering effect.

			Details:
			This macro does nothing if it is run in a passage that has been returned to by "undo" (i.e. where there is one or more turns
			one could "redo" using (icon-redo:)). It only functions in the "present".

			If there aren't enough past turns to erase (for instance, when `(erase-past:4)` is run when only two turns have been taken) then
			all past turns will be erased.

			There is no way to "un-erase" the erased turns when this macro is used. Its effects are permanent.

			Use of this macro will *not* affect the (history:) macro, the (visited:) macro, or the `visits` and `turns` keywords (nor
			the debug-only (mock-visits:) and (mock-turns:) macros). These will continue to perform as if (erase-past:) was never called.
			However, the turns that they refer to (in which the "visits" occurred) will no longer be accessible to the player.

			This macro will internally "flatten" every erased turn into a single data structure, which is used to ensure that
			(history:) and (visited:) and other such features continue to behave as expected.
			As a result, using this macro will reduce the size of the data saved to browser localStorage by (save-game:). However, you should
			*not* use this macro solely on the hunch that it provides performance benefits for your story - such benefits only
			come to stories that take place over a very large number of turns, and who store a large amount of data in global
			variables (such as expansive datamaps and arrays that are changed frequently).

			If 0 is given, no past turns will be erased.

			See also:
			(restart:)

			Added in: 3.3.0
			#saving
		*/
		("erase-past",
			noop,
			(_, number) => {
				if (!State.futureLength) {
					State.erasePast(number);
				}
			},
		[parseInt], false /* Can't have attachments.*/)

		/*d:
			(mock-visits: ...String) -> Command

			A macro that can only be used in debug mode, this allows you to mark various passages as "visited", even though the player
			actually hasn't. This allows you to quickly test passages that use the `visits` keyword, or the `(history:)` datamap, without
			having to play through the whole game from the start.

			Example usage:
			* `(mock-visits:"Juice Temple", "Milk Temple", "Water Temple")` marks the passages "Juice Temple", "Milk Temple" and "Water Temple" as each having been visited once.
			* `(mock-visits:"Lobby","Lobby","Lobby")` marks the "Lobby" passage as having been visited 3 times.

			Rationale:
			Using the `visits` keyword, or the (history:) array, as a way to track the player's progress instead of using Boolean variables and (set:)
			can produce simpler, more understandable code - it's obvious what `(if: visits is > 2)` means just by looking at it. But, it comes
			with a cost: when testing your story using the "Play from here" feature in the Twine editor, you may want to pretend that you have visited the
			requisite passages a given number of times, so as to examine the resulting prose. If you were using variables, you could add a few temporary
			(set:) macros to the passage, or put them in a "debug-header" tagged passage, to adjust the variables to match a game in progress. This macro
			provides that same functionality to the `visits` keyword and (history:) array, letting you temporarily adjust it for testing purposes.

			Details:
			It's critical to understand that these are **mock** visits - the passages listed are not actually visited, and code inside them is not run by this macro.

			As stated above, this macro will cause an error if it's used outside debug mode. This is NOT intended for use in a final game - while temporarily
			tweaking the meaning of `visits` and (history:) is convenient for testing, the author should be able to trust that in the "real" game, they
			correctly report the visits the player has actually made, so that the story's code can be properly understood.

			Each occurrence of a passage name given to this macro counts as a single mock visit. Add multiples of the same passage name to register multiple mock
			visits to that passage.

			If this macro is used multiple times, only the final usage will count - all the rest will be forgotten. `(mock-visits:"A")(mock-visits:"B")`, for instance,
			will only cause the "B" passage to be considered visited 1 time. This allows you to remove mock visits in the middle of a story by writing `(mock-visits:)`.

			The effects of (mock-visits:) are saved by (save-game:) as of version 3.2.3.

			If you undo past a passage that used (mock-visits:), the effects of that macro call will be removed, as if it had been a (set:) macro call.

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(history:), (set:), (mock-turns:)

			Added in: 3.2.0
			#debugging
		*/
		("mock-visits",
			(...names) => {
				if (!Utils.options.debug) {
					return TwineError.create('debugonly', '(mock-visits:) cannot be used outside of debug mode.');
				}
				const incorrect = names.find(name => !Passages.hasValid(name));
				if (incorrect) {
					return TwineError.create('datatype', "I can't mock-visit '" + incorrect + "' because no passage with that name exists.");
				}
			},
			(_, ...names) => { State.mockVisits = clone(names); },
		[rest(String)], false /* Can't have attachments.*/)

		/*d:
			(mock-turns: Number) -> Command

			A macro that can only be used in debug mode, this allows you to artificially increase the number that the `visits` keyword
			evaluates to, without having to play through that many turns yourself.

			Example usage:
			* `(mock-turns: 3)` means that from here on, `turns` (and its alias `turn`) will produce a number 3 higher than the actual number of visits.

			Rationale:
			Using the `turns` keyword as a way to track the amount of "moves" the player has performed instead of using Boolean variables and (set:)
			can produce simpler, more understandable code - it's obvious what `(if: turns > 15)` means just by looking at it. But, it comes
			with a cost: when testing your story using the "Play from here" feature in the Twine editor, you may want to pretend that you have already
			performed a certain number of turns, so as to examine the resulting prose. If you were using variables, you could add a few temporary
			(set:) macros to the passage, or put them in a "debug-header" tagged passage, to adjust the variables to match a game in progress. This macro
			provides that same functionality to the `turns` keyword, letting you temporarily adjust it for testing purposes.

			Details:
			It's critical to understand that these are **mock** turns - no additional passages have actually been visited.

			As stated above, this macro will cause an error if it's used outside debug mode. This is NOT intended for use in a final game - while temporarily
			tweaking the meaning of `turns` is convenient for testing, the author should be able to trust that in the "real" game, they
			correctly report the turns the player has actually made, so that the story's code can be properly understood.

			If this macro is used multiple times, only the final usage will count - all the rest will be forgotten. `(mock-turns:7)(mock-turns:0)`, for instance,
			will cause `turns` to behave normally.

			The effects of (mock-turns:) are saved by (save-game:), so you can use save files for testing your story with these effects.

			If you undo past a passage that used (mock-turns:), the effects of that macro call will be removed, as if it had been a (set:) macro call.

			Giving negative values, or non-whole numbers to this macro will produce an error.

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(history:), (set:), (mock-visits:)

			Added in: 3.3.0
			#debugging
		*/
		("mock-turns",
			() => {
				if (!Utils.options.debug) {
					return TwineError.create('debugonly', '(mock-turns:) cannot be used outside of debug mode.');
				}
			},
			(_, number) => { State.mockTurns = number; },
		[nonNegativeInteger], false /* Can't have attachments.*/)

		/*d:
			(seed: String) -> Command

			A command that "fixes" Harlowe's random number generator, causing all random macros and features to output
			predetermined values based on the given "seed" string.

			Example usage:
			`(seed:"aeiouy")(random:1,10) (random:1,10) (random:1,10)` will print `3 2 6`.

			Rationale:
			One of the appeals of randomness in games is its unpredictability, but one of the detriments of it is its
			irreplicability. Once a series of random values has been rolled, it's usually not possible to replicate that
			streak of luck. This can be bothersome if, for instance, you want to give an unpredictable challenge to players,
			but don't want any one player to arbitrarily get an easier or harder challenge than another.

			This macro gives you the ability to control the randomness of your story. Harlowe (like most computer games)
			uses a "pseudo" random number generator (pseudo RNG, or PRNG) to make random choices. (It is "pseudo" because
			truly random numbers cannot be generated by a computer, and can only be found by sampling external physical phenomena.)

			Think of the PRNG as a "vine" of numbers, that "grow" from a single "seed" (a special modifier value). Each random
			feature in your story (like a single (either:) call) takes a number from the sequence and uses it to make a choice
			(like picking one of the (either:) values). So, as long as the seed is the same, the same values will be "grown",
			and if the player encounters random features in the same order, the same values will be taken.

			You may want to use (seed:) for these purposes:
			* Seed it based on a player name (inputted via (input-box:) or (prompt:)) to assign a unique challenge to each
			player that can
			* Seed it based on the current date (using (current-date:)) to produce a "daily challenge" that will be the same
			for all players (provided their system clock is set to the current date).

			Details:
			The oft-mentioned "random features" are the (random:), (either:) and (shuffled:) macros, as well as the `random`
			data names (invoked using 's random` or `random of`).

			Even though I've called the seed a "special modifier value", this macro actually takes a string. This is so
			that the aforementioned uses (such as using (current-date:)) are simple, and also so that you may
			provide (seed:) with easy-to-remember words like "apple", if you so wish. The string is internally converted
			to a number using a complicated procedure that ensures similar strings (like "app" and "appl") still grow
			very different sequences of random numbers. So, don't be concerned with using too-similar strings as seed values.

			Harlowe's random number generator is initially, automatically seeded based on the timestamp at which the game begins
			so you do *not* need to call this at all to get unpredictable randomness that isn't replicated
			across playthroughs. You should use this *only* to control your story's randomness, not create it.
			(restart:) will reset the seed using this method.

			The current seed (and the number of values currently taken) is saved when you use (save-game:), so loading a saved game will continue
			to use the same sequence of random values that were in use when the game was saved.

			(seed:) is best used at the very beginning of the story, or at least before the first random feature is used. Using it
			in the middle of the story will cause the randomness to use a different seed, and should generally only be used when
			you wish the player to replay a section of the story with different random values.

			Giving the same string to (seed:) will reset the number of values taken. So, if `(seed:"A")` followed by five `(random:1,10)`
			calls produced 4,2,8,4 and 9 in that order, then calling `(seed:"A")` again will cause the next five `(random:1,10)`
			calls to produce 4,2,8,4 and 9 in that order.

			Using (seed:) multiple times will not affect the "randomness" of the numbers produced - they will be
			similarly "random" and unpredictable.

			For reference, Harlowe's random number generator is [mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c) by Tommy Ettinger, and the seed is hashed
			with [MurmurHash3](https://en.wikipedia.org/wiki/MurmurHash) by Austin Appleby. It is not expected that Harlowe stories will use random elements at a frequency
			expected of action games (which use RNG up to hundreds of times per frame), and therefore a 32-bit algorithm should be sufficient.

			See also:
			(random:), (either:), (shuffled:)

			Added in: 3.3.0
			#game state
		*/
		("seed",
			noop,
			(_, seed) => { State.setSeed(seed); },
		[String], false /* Can't have attachments.*/)

		/*d:
			(dialog: [Bind], String or CodeHook, ...String) -> Command
			Also known as: (alert:)

			A command that, when used, displays a pop-up dialog box with the given string or codehook displayed, and a number of button-shaped links labeled with
			the remaining other strings. If an optional bound variable is provided, that variable is updated to match the pressed button.

			Example usage:
			* `(dialog: [Beyond this point, things get serious. Grab a snack and buckle up.], "Sure.")`
			* `(dialog: bind $defund, "Which department will you defund?", "Law Enforcement", "Education", "Health", "Public Housing")`

			Rationale:
			It may seem counterintuitive for such a heavily text-based medium as a hypertext story to have a need for dialog boxes, but they can serve as
			places to include auxiliary text that's contextually separate from the passage's themes, such as brief updates on characters, tasks and goals, or
			momentary asides on incidental world details. because they darken and cover the screen when they appear, they are also very useful for
			displaying and offering especially climactic actions or decisions, such as an irreversible ethical choice.

			While there are other dialog box-producing macros, namely (prompt:) and (confirm:), those are meant purely for input-gathering purposes.
			This is designed to be the most general-use dialog-producing macro, allowing any number of links, and optionally binding the clicked link to a variable.

			Details:
			There's no difference in behaviour when you provide this with a codehook instead of a string. That being said, codehooks are recommended because
			their internal markup is correctly coloured in the Twine editor, and because `"` or `'` symbols don't need to be escaped (using `\`) inside them.

			The dialog that is produced is implemented entirely in HTML. User CSS stylesheets can be used to style it, and (enchant:) macros that affect ?Link can
			affect the dialog links.

			In Harlowe versions prior to 3.1.0, this macro used the built-in `alert()` function of the browser, but to
			support certain newer browsers that no longer offer this function, the macro was changed.

			If no button strings are given, a single link reading "OK" will be used. Giving empty strings for any of the links will cause an error.

			When the dialog is on-screen, the entire game is essentially "paused" - until it is dismissed,
			no further computations are performed, links can't be clicked (except links inside the dialog text itself),
			(click:), (mouseover:) and (mouseout:) enchantments shouldn't work, and (live:) and (event:) macros
			shouldn't fire.

			For obvious reasons, you cannot supply a two-way bound variable to this macro. Doing so will cause an error to result.

			From version 3.2.0 on, it is possible to attach changers to this command. `(t8n:'slide-up')+(text-rotate-x:25)(dialog:"EMAIL SENT!")`, for instance, produces a dialog
			that's tilted upward, and which slides upward when it appears.

			See also:
			(cycling-link:), (prompt:), (confirm:)

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
						return TwineError.create("datatype", "(dialog:) needs a message string or codehook to display.");
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
				const d = dialog({
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
				});
				return { blocked: d };
			},
			[either(VarBind, String, CodeHook), optional(either(CodeHook, String)), zeroOrMore(String)])

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
			(restart:) -> Command
			Also known as: (reload:)

			When this command is used, the player's browser will immediately attempt to reload
			the page, in effect restarting the entire story.

			Example usage:
			`(click:"Restart")[(restart:)]`

			Details:
			Normally, Harlowe stories will attempt to preserve their current game state across browser page reloads.
			This macro will suppress this behaviour, guaranteeing that the story restarts from the beginning.

			In order to prevent an endless "restart loop", this macro can't be used in the first passatge of the story.
			Attempting to do so will cause an error.

			Using (restart:) will *not* erase any games that have been saved with (save-game:).

			This command can't have changers attached - attempting to do so will produce an error.

			See also:
			(icon-restart:), (erase-past:)

			Added in: 1.0.0
			#navigation
		*/
		(["restart","reload"],
			noop,
			(/* no cd because this is attachable:false */ ) => {
				if (State.turns <= 1) {
					return TwineError.create("infinite", "I mustn't (restart:) the story in the starting passage.");
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
			[String], false)

		/*d:
			(ignore: [...Any]) -> Command

			If you want to test your passage while ignoring a specific command macro in it, temporarily change that
			command macro's name to (ignore:), and it will ignore all of the data given to it.

			Example usage:
			`(ignore: ?ghost, (text-style:'outline'))` is an (enchant:) macro that has been temporarily changed to (ignore:), so that the
			passage may be tested without the style being applied.

			Rationale:
			If you want to quickly test some aspect of your passage, you may wish to remove one or more of the commands in it, such as
			(enchant:) or (hide:). These commands can have a large and cumbersome set of data given to them, and removing and adding them
			can be bothersome. The (ignore:) macro can be of assistance here: simply change the command's name to "ignore", and it will
			do nothing, while NOT causing an error regardless of what sort of data is given to it. Then, you can quickly change it back
			to the original name after testing.

			Details:
			While it will ignore all well-formed data given to it, (ignore:) will NOT suppress errors that are already present in the data.
			For instance, `(ignore: 4 + "2")` will still cause an error.

			This command can have changers attached, but will, of course, ignore them.

			See also:
			(test-true:), (test-false:)

			Added in: 3.2.0
			#debugging 1
		*/
		("ignore", noop, noop, [zeroOrMore(Everything)])

		/*d:
			(assert-exists: HookName or String) -> Command

			A debugging macro that confirms whether a hook with the given name, or passage text matching the given string, is present in the passage.
			If not, it will produce a helpful error. Use this to test whether enchantment macros like (click:), (enchant:) or (show:) are working properly.

			Example usage:
			* `(assert-exists: "the auroch")` will produce an error if the text "the auroch" isn't present in the passage.
			* `(assert-exists: ?bottomBar)` will produce an error if a ?bottomBar hook isn't present in the passage.

			Rationale:
			The macros in Harlowe that remotely affect other hooks or text based on their name or contents, such as (click:), are designed such that they
			do not cause an error if no matching hooks or text is found in the passage. This allows them to be thought of as similar to CSS rules for how passage prose
			is to be rendered - something like `(enchant:?dust, (text-style:'blur'))` states the "rule" that ?dust hooks are to be blurred - rather than as imperative commands
			that must be fulfilled there and then. This means that they can be placed in every passage, via "header" or "footer" tagged passages, without errors occurring.
			But, this flexibility comes at a cost. In the minority of situations where you need to be certain that a macro is affecting a visible in-passage
			structure, you'll often want to test with this macro, so as to produce an error if those structures do not exist.

			Details:
			This command (and note that (assert:) doesn't produce a command) probes the current passage in which it's located in order to determine whether to produce an error or not.
			As such, like all commands, it can be saved into a variable, and deployed into passage code using that variable, to save having to retype it in full.

			If you provide an empty string to this macro (which obviously can't be found in the passage), it will produce a different kind of error than what would be desired.

			See also:
			(error:), (assert:)

			Added in: 3.2.0
			#debugging 5
		*/
		("assert-exists",
			selector => {
				/*
					The only error that should be produced at command-creation time is that of basic type-checking.
				*/
				if (selector === "") {
					return TwineError.create('datatype', "(assert-exists:) mustn't be given an empty string.");
				}
			},
			(cd, section, selector) => {
				let count = 0;
				/*
					Rather than call .hooks(), and have to clean up the <tw-pseudo-hook> elements afterward, we simply call .forEach().
				*/
				(typeof selector === "string" ? HookSet.create({type: "string", data: selector}) : selector).forEach(section, () => { ++count; });
				if (!count) {
					return TwineError.create("assertion",
						`I didn't see any ${typeof selector === "string" ? "text occurrences of" : "hooks matching"} ${toSource(selector)} in this passage.`
					);
				}
				return cd;
			},
		[either(HookSet, String)]);

	/*
		The following couple of macros are not commands, but they are each intrinsically related to some of the macros above.
	*/
	Macros.add

		/*d:
			(assert: Boolean) -> Instant

			A debugging macro that produces a helpful error whenever the expression given to it produces Boolean false. Use this when testing your story
			to help ensure that certain facts about the game state are true or not.

			Example usage:
			`(assert: $isWounded is $isBleeding or $isBandaged)` ensures that if $isWounded is true, one of $isBleeding or $isBandaged MUST be true, and if it's false,
			both of them MUST be false. Otherwise, an error is produced.

			Rationale:
			Harlowe's debug mode provides panels to check the current game state, the contents of variables, active enchantments, and so forth, providing assistance
			in identifying bugs. Of course, knowing what variables contain is not the same as knowing whether the relationships between them are being maintained, and
			a way of encoding these relationships, in your story, can provide an additional layer of security when debugging your game. 

			(assert:) allows you to *assert* facts about the game state, facts which absolutely must be true, so much so that
			an error should be produced. For example, if your story's code assumes that the variable $nails will always be smaller than or equal to $maxNails, and you want to
			ensure that no bugs are written that cause $nails to be greater, you may write `(assert: $nails is <= $maxNails)`, and place that call in
			a "debug-header" tagged passage. Thus, should a bug ever appear which causes these variables to no longer maintain their relationship, the (assert:) call will produce an error.

			Details:
			Note that there are other tools within Harlowe to ensure that variables are obeying certain restrictions, which make the need for certain simple (assert:) calls
			unnecessary. Chief among these features is TypedVars, which can be provided to (set:) to permanently and automatically restrict a certain variable to a narrow range
			of data. Instead of writing `(assert: $petals is an int)`, you can change the earliest (set:) call that creates $petals to `(set: int-type $petals to 0)`.

			Though this is classed as a "debugging" macro, this works even outside of debug mode.

			This can also be useful within custom macros, as a shortened form of combining (if:) with (error:). However, the error message produced by (assert:) may not
			be as insightful as the customisable error message given to (error:), so it's not especially recommended for use within custom macros that are meant for other authors
			to use.

			See also:
			(error:), (assert-exists:)

			Added in: 3.2.0
			#debugging 4
		*/
		("assert", "Instant",
			(_, condition) => condition ? ({
				TwineScript_TypeID:       "instant",
				TwineScript_TypeName:     "an (assert:) operation",
				TwineScript_ObjectName:   "an (assert:) operation",
				TwineScript_Unstorable:    true,
				// Being unstorable and not used by any other data strctures, this doesn't need a ToSource() function.
				TwineScript_Print:        () => '',
			}) :
			/*
				The appendTitleText expando is used exclusively to append the visible error text with its titleText (which is the source of the <tw-expression>
				itself, usually). While a more sophisticated protocol could be devised, I currently (Dec 2020) deem it unnecessary.
			*/
			assign(TwineError.create("assertion", "An assertion failed: "), { appendTitleText:true }),
		[Boolean])

		/*d:
			(save-game: String, [String]) -> Boolean
			
			This macro saves the current game's state in browser storage, in the given save slot,
			and including a special filename. It can then be restored using (load-game:).
			
			Example usage:
			```
			##Chapter 2: The Mortuary
			(save-game:"Slot A","Chapter 2 start")
			```

			Rationale:
			
			Many web games use browser cookies to save the player's place in the game.
			Harlowe allows you to save the game, including all of the variables that were (set:)
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

			Using the (erase-past:) macro will, as a side effect of its turn-erasing functionality, reduce the size of the data saved
			to browser localStorage by (save-game:). However, you should *not* use that macro solely on the hunch that it provides
			performance benefits for your story. See the (erase-past:) macro's article for slightly more details.
			
			See also:
			(load-game:), (saved-games:), (erase-past:)

			Added in: 1.0.0
			#saving
		*/
		("save-game", "Boolean",
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
				const {pastAndPresent:serialisation} = State.serialise(false);
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
			(prompt: String or CodeHook, String, [String], [String]) -> String

			When this macro is evaluated, a browser pop-up dialog box is shown with the first string displayed,
			a text entry box containing the second string (as a default value), a confirm link and a cancel link.
			If the confirm link is clicked, it evaluates to the string in the text entry box. If "Cancel" is clicked, it evaluates to
			the default value regardless of the entry box's contents.

			Example usage:
			`(set: $name to (prompt: [Your name, please:], "Frances Spayne", "Don't care", "Confirm"))`

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
			no further computations are performed, links can't be clicked (except links inside the dialog text itself),
			(click:), (mouseover:) and (mouseout:) enchantments shouldn't work, and (live:) and (event:) macros
			shouldn't fire.

			A note about player-submitted strings: because most string-printing functionality in Harlowe (the (print:) macro,
			and putting variable names in bare passage prose) will attempt to render markup inside the strings, a player
			may cause disaster for your story by placing Harlowe markup inside a (prompt:) string, which, when displayed,
			produces either an error or some effect that undermines the story. In order to display those strings
			safely, you may use either the verbatim markup, the (verbatim:) changer, or (verbatim-print:).

			See also:
			(alert:), (confirm:), (input-box:)

			Added in: 1.0.0
			#popup
		*/
		("prompt", "String",
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
					}].concat(cancelButton === "" ? [] : {
						name: cancelButton || "Cancel",
						cancel: true,
						callback: () => section.unblock(defaultValue),
					}),
				});
				/*
					The blocking dialog is passed to section.stackTop.blocked. This allows
					certain local events within the dialog (such as (link:)s) to still be usable.
				*/
				section.stackTop.blocked = d;
				// Regrettably, this arbitrary timeout seems to be the only reliable way to focus the <input>.
				setTimeout(() => d.find('input').last().focus(), 100);
				/*
					This return value shouldn't be used anywhere.
				*/
				return 0;
			},
			[either(String, CodeHook), String, optional(String), optional(String)])

		/*d:
			(confirm: String or CodeHook, [String], [String]) -> Boolean

			When this macro is evaluated, a pop-up dialog box is shown with the given string displayed,
			as well as two links (whose text can also be provided) to confirm or cancel whatever action
			or fact the string tells the player. When it is submitted, it evaluates to the boolean `true` if the
			confirm link had been clicked, and `false` if the cancel link had.

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
			no further computations are performed, links can't be clicked (except links inside the dialog text itself),
			(click:), (mouseover:) and (mouseout:) enchantments shouldn't work, and (live:) and (event:) macros
			shouldn't fire.

			See also:
			(alert:), (prompt:), (checkbox:)

			Added in: 1.0.0
			#popup
		*/
		("confirm", "Boolean",
			(section, message, cancelButton, confirmButton) => {
				if (section.stackTop && section.stackTop.evaluateOnly) {
					return TwineError.create("macrocall", ...dialogError(section.stackTop.evaluateOnly));
				}
				if (confirmButton === "") {
					return TwineError.create("datatype", "The text for (confirm:)'s confirm link can't be blank.");
				}
				const d = dialog({
					section, message,
					defaultValue: false,
					buttons:[{
						name: confirmButton || "OK",
						confirm: true,
						callback: () => section.unblock(true),
					}].concat(cancelButton === "" ? [] : {
						name: cancelButton || "Cancel",
						cancel: true,
						callback: () => section.unblock(false),
					}),
				});
				/*
					The blocking dialog is passed to section.stackTop.blocked. This allows
					certain local events within the dialog (such as (link:)s) to still be usable.
				*/
				section.stackTop.blocked = d;
				/*
					This return value shouldn't be used anywhere.
				*/
				return 0;
			},
			[either(String, CodeHook), optional(String), optional(String)])

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
		("page-url", "String", () => window.location.href, []);
});
