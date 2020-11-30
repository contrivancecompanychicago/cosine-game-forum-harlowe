"use strict";
define(['utils', 'passages', 'datatypes/changercommand', 'internaltypes/twineerror', 'utils/operationutils', 'markup', 'twinescript/compiler'],
({impossible}, Passages, ChangerCommand, TwineError, {objectName,toSource}, {lex}, compile) => {
	const {assign, create} = Object;
	/*
		State
		Singleton controlling the running game state.
	*/
	
	/*
		A browser compatibility check for localStorage and sessionStorage.
	*/
	const hasStorage = ["localStorage","sessionStorage"].map(name => {
		/*
			This is, to my knowledge, the only surefire way of measuring localStorage's
			availability.
			* On some browsers, window.localStorage will throw when run in an <iframe sandbox>
			* On some browsers, setItem() will throw in Private Browsing mode.
		*/
		try {
			return !!window[name]
				&& (() => {
					window[name].setItem("test", '1');
					window[name].removeItem("test");
					return true;
				})();
		} catch (e) {
			return false;
		}
	});
	
	/*
		The root prototype for every Moment's variables collection.
	*/
	const SystemVariables = assign(create(null), {
		/*
			Note that it's not possible for userland TwineScript to directly access or
			modify this base object.
		*/
		TwineScript_ObjectName: "this story's variables",

		/*
			This is the root prototype of every frame's variable type definitions. Inside a TypeDefs
			is every variable name that this variables collection contains, mapped to a Harlowe datatype.
		*/
		TwineScript_TypeDefs: create(null),

		/*
			This is used to distinguish to (set:) that this is a variable store,
			and assigning to its properties does affect game state.
		*/
		TwineScript_VariableStore: true,

		/*
			For testing purposes, there needs to be a way to "mock" having visited certain passages a certain number of times.
			Because (mock-visits:) calls should be considered modal, and can be undone, their effects need to be tied
			to the variable store.
			Note that currently, mock visits are NOT saved using (save-game:).
		*/
		TwineScript_MockVisits: null,
	});

	/*
		Prototype object for states remembered by the game.
	*/
	const Moment = {
		/*
			Current passage name
		*/
		passage: "",
		
		/*
			As the prototype object, its variable property is the prototype variables object.
		*/
		variables: SystemVariables,

		/*
			Make a new Moment that comes temporally after this.
			This is usually a fresh Moment, but the State deserialiser
			must re-create prior sessions' Moments.
			Thus, pre-set variables may be supplied to this method.
			
			@param {String} The name of the passage that the player is at in this moment.
			@param {Object} Variables to include in this moment.
		*/
		create(p, v) {
			const ret = create(Moment);
			ret.passage = p || "";
			// Variables are stored as deltas of the previous state's variables.
			// This is implemented using JS's prototype chain :o
			// For the first moment, this becomes a call to create(null),
			// keeping the prototype chain clean.
			ret.variables = assign(create(this.variables), v);
			return ret;
		}
	};
	
	/*
		Stack of previous states.
		This includes both the past (moments the player has created) as well as the future (moments
		the player has undone).
		Count begins at 0 (the game start).
	*/
	let timeline = [];
	
	/*
		Index to the game state just when the current passage was entered.
		This represents where the player is within the timeline.
		Everything beyond this index is the future. Everything before and including is the past.
		It usually equals timeline.length-1, except when the player undos.
	*/
	let recent = -1;
	
	/*
		The present - the resultant game state after the current passage executed.
		This is a 'potential moment' - a moment that could become the newest to enter the timeline.
		This is pushed onto the timeline (becoming "recent") when going forward,
		and discarded when going backward.
		Its passage name should equal that of recent.
	*/
	let present = Moment.create();
	
	/*
		The serialisability status of the story state.
		This is irreversibly set to a triplet of [var, value, turn] values,
		which are used for error messages, whenever a non-serialisable object
		is stored in a variable.
	*/
	let serialiseProblem;

	/*
		Debug Mode event handlers are stored here by on(). "forward" and "back" handlers are called
		when the present changes, and thus when play(), fastForward() and rewind() have been called.
		"load" handlers are called exclusively in deserialise().
	*/
	const eventHandlers = {
		forward: [],
		back: [],
		load: [],
	};

	let State;

	/*
		This enables session storage to preserve the game state across reloads, even when the browser
		(such as that of a phone) doesn't naturally preserve it using something like FF's bfcache.
	*/
	function saveSession() {
		if (State.hasSessionStorage) {
			const serialisation = State.serialise();
			/*
				Since we're in the middle of navigating to another Moment, just silently disregard errors.
			*/
			if (typeof serialisation === "string") {
				try {
					sessionStorage.setItem("Saved Session", serialisation);
				} catch(e) {
					// Again, silently disregard errors.
					return;
				}
			}
		}
	}

	/*
		A private method to create a new present after altering the state.
		@param {String} The name of the passage the player is now currently at.
	*/
	function newPresent(newPassageName) {
		present = (timeline[recent] || Moment).create(newPassageName);
		saveSession();
	}
	
	/*
		The current game's state.
	*/
	State = assign({
		/*
			Getters/setters
		*/

		/*
			Get the current passage name.
			Used as a common argument to Engine.showPassage()
		*/
		get passage() {
			return present.passage;
		},
		
		/*
			Get the current variables.
		*/
		get variables() {
			return present.variables;
		},

		/*
			Is there an undo cache?
		*/
		get pastLength() {
			return recent;
		},

		/*
			Is there a redo cache?
		*/
		get futureLength() {
			return (timeline.length - 1) - recent;
		},

		/*
			Get and set the current mockVisits state.
		*/
		get mockVisits() {
			return present.variables.TwineScript_MockVisits || [];
		},

		set mockVisits(value) {
			present.variables.TwineScript_MockVisits = value;
		},

		/*
			Did we ever visit this passage, given its name?
			Return the number of times visited.
		*/
		passageNameVisited(name) {
			let ret = 0;

			if (!Passages.get(name)) {
				return 0;
			}
			for (let i = 0; i <= recent; i++) {
				ret += +(name === timeline[i].passage);
			}

			return ret;
		},

		/*
			Return how long ago this named passage has been visited,
			or infinity if it was never visited.
			This isn't exposed directly to authors.
		*/
		passageNameLastVisited(name) {
			if (!Passages.get(name)) {
				return Infinity;
			}

			if (name === present.passage) {
				return 0;
			}

			for (let i = recent; i > 0; i--) {
				if (timeline[i].passage === name) {
					return (recent-i) + 1;
				}
			}

			return Infinity;
		},

		/*
			Return an array of names of all previously visited passages, in the order
			they were visited. This may include doubles. This IS exposed directly to authors.
		*/
		pastPassageNames() {
			const ret = [];

			for (let i = recent-1; i >= 0; i--) {
				ret.unshift(timeline[i].passage);
			}
			return ret;
		},

		/*
			Returns an array of all passage names. Used nowhere except for populating the Debug UI.
		*/
		timelinePassageNames() {
			return timeline.map(t => t.passage);
		},

		/*
			Movers/shakers
		*/

		/*
			Push the present state to the timeline, and create a new state.
			@param {String} The name of the passage the player is now currently at.
		*/
		play(newPassageName) {
			if (!present) {
				impossible("State.play","present is undefined!");
			}
			// Assign the passage name
			present.passage = newPassageName;
			// Clear the future, and add the present to the timeline
			timeline = timeline.slice(0,recent+1).concat(present);
			recent += 1;
			
			// create a new present
			newPresent(newPassageName);
			// Call the 'forward' event handler with this passage name.
			eventHandlers.forward.forEach(fn => fn(newPassageName));
		},

		/*
			Rewind the state. This will fail if the player is at the first moment.
			
			@param {String|Number} Either a string (passage id) or a number of steps to rewind.
			@return {Boolean} Whether the rewind was actually performed.
		*/
		rewind(arg) {
			let steps = 1,
				moved = false;

			if (arg) {
				if (typeof arg === "string") {
					steps = this.passageNameLastVisited(arg);
					if (steps === Infinity) {
						return;
					}
				} else if (typeof arg === "number") {
					steps = arg;
				}
			}
			for (; steps > 0 && recent > 0; steps--) {
				moved = true;
				recent -= 1;
			}
			if (moved) {
				newPresent(timeline[recent].passage);
				// Call the 'back' event handler.
				eventHandlers.back.forEach(fn => fn());
			}
			return moved;
		},

		/*
			Undo the rewinding of a state. Fails if no moments are in the future to be redone.
			Currently only accepts numbers.
			
			@param {Number} The number of turns to move forward.
			@return {Boolean} Whether the fast-forward was actually performed.
		*/
		fastForward(arg) {
			let steps = 1,
				moved = false;
			
			if (typeof arg === "number") {
				steps = arg;
			}
			for (; steps > 0 && timeline.length > 0; steps--) {
				moved = true;
				recent += 1;
			}
			if (moved) {
				newPresent(timeline[recent].passage);
				eventHandlers.forward.forEach(fn => fn(timeline[recent].passage, "fastForward"));
			}
			return moved;
		},
		
		/*
			This is used only by Debug Mode - it lets event handlers be registered and called when the State changes.
			"forward" functions have the signature (passageName, isFastForward). "back" functions have no signature.
			"load" functions have the signature (timeline), where timeline is the entire timeline Moments array.
		*/
		on(name, fn) {
			if (!(name in eventHandlers)) {
				impossible('State.on', 'invalid event name');
				return;
			}
			if (typeof fn === "function" && !eventHandlers[name].includes(fn)) {
				eventHandlers[name].push(fn);
			}
			return State;
		},

		/*
			This method is only for Harlowe debugging purposes. It is called nowhere except for the test specs
			and the documentation's live preview feature.
		*/
		reset() {
			timeline = [];
			recent = -1;
			present = Moment.create();
			serialiseProblem = undefined;
			eventHandlers.load.forEach(fn => fn(timeline));
		},

		hasStorage: hasStorage[0],
		hasSessionStorage: hasStorage[1],
	},
	/*
		In addition to the above simple methods, two serialisation methods are also present.
		These have a number of helper functions which are wrapped in this block.
	*/
	(()=>{

		/*
			This helper checks if serialisation is possible for this data value.
		*/
		function isSerialisable(obj) {
			const jsType = typeof obj;
			return !TwineError.containsError(obj) && (
				typeof obj.TwineScript_ToSource === "function" || Array.isArray(obj) || obj instanceof Map
					|| obj instanceof Set || jsType === "string" || jsType === "number" || jsType === "boolean"
					|| Object.isPrototypeOf.call(SystemVariables.TwineScript_TypeDefs, obj)
			);
		}

		/*
			Serialise the game history, from the present backward (ignoring the redo cache)
			into a JSON string.
			
			@return {String|Boolean} The serialised state, or false if serialisation failed.
		*/
		function serialise() {
			const ret = timeline.slice(0, recent + 1);
			/*
				We must determine if the state is serialisable.
				Once it is deemed unserialisable, it remains that way for the rest
				of the story. (Note: currently, rewinding back past a point
				where an unserialisable object was (set:) does NOT revert the
				serialisability status.)

				create an array (of [var, value] pairs) that shows each variable that
				couldn't be serialised at each particular turn.
			*/
			const serialisability = ret.map(
				(moment) => Object.keys(moment.variables)
					.filter((e) => moment.variables[e] && !isSerialisable(moment.variables[e]))
					.map(e => [e, moment.variables[e]])
			);
			/*
				Identify the variable and value that can't be serialised, and the turn it occurred,
				and save them into serialiseProblem. But, if such a problem was already found previously,
				use that instead.
			*/
			if (!serialiseProblem) {
				serialiseProblem = (serialisability.reduce(
					(problem, [name, value], turn) => (problem || (name && [name, value, turn + 1])),
					undefined
				));
			}
			/*
				If it can't be serialised, return a TwineError with all the details.
			*/
			if (serialiseProblem) {
				const [problemVar, problemValue, problemTurn] = serialiseProblem;

				return TwineError.create(
					"saving",
					"The variable $" + problemVar + " holds " + objectName(problemValue)
					+ " (which is, or contains, a complex data value) on turn " + problemTurn
					+ "; the game can no longer be saved."
				);
			}
			try {
				return JSON.stringify(ret, function(name, variable) {
					/*
						The timeline, which is an array of Moments with VariableStore objects, should be serialised
						such that only the variables inside the VariableStore are converted to Harlowe strings
						with toSource().
					*/
					if (this.TwineScript_VariableStore) {
						/*
							Serialising the TypeDefs, which is the only VariableStore property
							that isn't directly user-created, and is a plain JS object,
							requires a little special-casing.
						*/
						if (name === "TwineScript_TypeDefs") {
							return Object.keys(variable).reduce((a,key) => {
								/*
									Since the datatypes inside are Harlowe values,
									they should be serialised to source as well.
								*/
								a[key] = toSource(variable[key]);
								return a;
							},{});
						}
						return toSource(variable);
					}
					return variable;
				});
			}
			catch(e) {
				return false;
			}
		}

		/*
			A quick method to recompile objects whose values are Harlowe code strings, taken directly
			from localStorage.
			Since this should only receive formerly-serialised data, we don't really need to care about the
			scope of the eval().
		*/
		function recompileValues(section, obj) {
			Object.keys(obj).forEach(key =>
				!key.startsWith("TwineScript_") && (obj[key] = section.eval(compile(lex(obj[key], 0, 'macro'))))
			);
		}
		
		/*
			Deserialise the string and replace the current history.
			Since an error with save data isn't necessarily an author error, the errors returned
			by this function aren't TwineErrors.
		*/
		function deserialise(section, str) {
			let newTimeline,
				lastVariables = SystemVariables;
			const genericError = "The save data is unintelligible.";
			
			try {
				newTimeline = JSON.parse(str);
			}
			catch(e) {
				return Error(genericError);
			}
			/*
				Verify that the timeline is an array.
			*/
			if (!Array.isArray(newTimeline)) {
				return Error(genericError);
			}
			
			let momentError;
			if ((momentError = (newTimeline = newTimeline.map((moment) => {
				/*
					Here, we do some brief verification that the moments in the array are
					objects with "passage" and "variables" keys.
				*/
				if (typeof moment !== "object"
						|| !moment.hasOwnProperty("passage")
						|| !moment.hasOwnProperty("variables")) {
					return Error(genericError);
				}
				/*
					Check that the passage name in this moment corresponds to a real passage.
					As this is the most likely issue with invalid save data, this gets a precise message.
				*/
				if (!Passages.hasValid(moment.passage)) {
					return Error("The data refers to a passage named '" + moment.passage + "', but it isn't in this story.");
				}
				/*
					Recreate the variables prototype chain. This doesn't use setPrototypeOf() due to
					compatibility concerns.
				*/
				moment.variables = assign(create(lastVariables), moment.variables);
				/*
					If the variables object has a TypeDefs object, that needs to be recompiled as well,
					and have its own prototype chain re-established.
				*/
				if (Object.hasOwnProperty.call(moment.variables,'TwineScript_TypeDefs')) {
					const typeDefs = (moment.variables.TwineScript_TypeDefs =
						/*
							Notice that even though TypeDefs are optional on variables objects, JS prototype semantics
							mean that moment.variables.TwineScript_TypeDefs will always get the previous object in the chain.
						*/
						assign(create(lastVariables.TwineScript_TypeDefs), moment.variables.TwineScript_TypeDefs));
					/*
						Much like the variables, the datatypes are currently Harlowe code strings - though rather likely to be
						literals like "number" or "datamap".
					*/
					try {
						recompileValues(section, typeDefs);
					} catch(e) {
						return Error(genericError);
					}
				}
				/*
					Compile all of the variables (which are currently Harlowe code strings) back into Harlowe values.
				*/
				try {
					recompileValues(section, moment.variables);
				} catch(e) {
					return Error(genericError);
				}
				
				lastVariables = moment.variables;
				/*
					Re-establish the moment objects' prototype link to Moment.
				*/
				return assign(create(Moment), moment);
			})).find(e => e instanceof Error))) {
				return momentError;
			}
			timeline = newTimeline;
			eventHandlers.load.forEach(fn => fn(timeline));
			recent = timeline.length - 1;
			newPresent(timeline[recent].passage);
			return true;
		}
		return {
			serialise: serialise,
			deserialise: deserialise,
		};
	})());
	
	Object.seal(Moment);
	return Object.freeze(State);
});
