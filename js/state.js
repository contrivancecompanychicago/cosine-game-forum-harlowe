"use strict";
define(['utils', 'passages', 'internaltypes/twineerror', 'utils/operationutils', 'markup'],
({impossible}, Passages, TwineError, {objectName,toSource}, {lex}) => {
	const {assign, create, defineProperty} = Object;
	const {imul} = Math;
	/*
		This ensures that serialisation of Maps and Sets works as expected.
	*/
	defineProperty(Map.prototype, 'toJSON', { value: undefined });
	defineProperty(Set.prototype, 'toJSON', { value: undefined });

	/*
		State
		Singleton controlling the running game state.
	*/

	/*
		PRNG settings.
	*/
	let seed = '', seedIter = 0;
	/*
		mulberry32 by Tommy Ettinger, seeded with MurmurHash3 by Austin Appleby.
		This is seeded with a single character to save space in save files (where this is saved
		alongside the seedIter).
	*/
	function mulberryMurmur32(s = String.fromCodePoint(Date.now()%0x110000), iter=0) {
		seedIter = iter;
		seed = s;
		let k, i = 0, h = 2166136261;
		for(; i < seed.length; i+=1) {
			k = imul(seed.charCodeAt(i), 3432918353);
			k = k << 15 | k >>> 17;
			h ^= imul(k, 461845907);
			h = h << 13 | h >>> 19;
			h = imul(h, 5) + 3864292196 | 0;
		}
		h ^= seed.length;
		h ^= h >>> 16; h = imul(h, 2246822507);
		h ^= h >>> 13; h = imul(h, 3266489909);
		h ^= h >>> 16;
		h = (h >>> 0) + 0x6D2B79F5 * seedIter;
		return () => {
			seedIter += 1;
			let t = (h += 0x6D2B79F5);
			t = imul(t ^ t >>> 15, t | 1);
			t ^= t + imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}
	let PRNG = mulberryMurmur32();
	
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
		Prototype object for states remembered by the game.
	*/
	const Moment = {
		/*
			Current passage name and variables store.
		*/
		passage: "",
		variables: create(null),
		/*
			This optional string is only used for (redirect:)s, and represents each passage redirected to during the previous moment.
			These are added to (history:).
		*/
		visits: undefined,
		/*
			(seed:) and (mock-visits:) calls produce these stateful changes, which are also recorded.
		*/
		seed: undefined,
		seedIter: undefined,
		mockVisits: undefined,
		mockTurns: undefined,

		/*
			Make a new Moment that comes temporally after this.
			This is usually a fresh Moment, but the State deserialiser
			must re-create prior sessions' Moments.
			Thus, pre-set variables may be supplied to this method.
			
			@param {String} The name of the passage that the player is at in this moment.
			@param {Object} Variables to include in this moment.
		*/
		create(p) {
			const ret = create(Moment);
			ret.passage = p || "";
			// Variables are stored as deltas of the previous state's variables.
			ret.variables = create(null);

			/*
				Value Refs (used to reconstruct long values from save files) are tracked as well.
				This doesn't matter to the System Variables or the epoch, so it isn't included.
			*/
			ret.valueRefs = create(null);
			return ret;
		}
	};

	/*
		A special "moment-like object" that holds stuff that took place before the first moment,
		either because it was erased by (erase-past:), or it occurred during page initialisation.
		This is distinguished from other moments by lacking a "passage" property.
	*/
	let epoch = {
		/*
			A list of passages which were visited (either by (redirect:) or normally), but whose visits were erased by (erase-past:).
		*/
		visits: undefined,
		/*
			A number of additional turns which were erased by (erase-past:).
		*/
		turns: undefined,
		/*
			The initial seed for this "game", which cannot be undone using the story Undo features.
			This can only be changed by (load-game:) or (erase-past:). Additional explicit (seed:) calls override this, obviously.
		*/
		seed,
		seedIter: 0,
		/*
			The epoch should only have variables when (erase-past:) erased some moments which had (set:) various variables,
			thus flattening them onto here.
		*/
		variables: create(null),
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
		A cache of the serialised JSON form of the past moments. Invalidated (made falsy) whenever pastward temporal movement
		occurs. Why isn't the present included? Because the present is liable to change as (set:) macros are run. Remember that
		each past moment reflects the game state as the passage was *left*, not entered.
	*/
	let serialisedPast = '';
	/*
		A cache of the past passage names. Because (history:) uses this, it's a good idea to cache it.
	*/
	let pastPassageNames = [];

	/*
		A function to invalidate both of the above at the same time.
	*/
	function invalidateCaches() {
		serialisedPast = '';

		pastPassageNames = [];
		for (let i = 0; i <= recent; i+=1) {
			/*
				"visits" represents redirects accrued at the end of the previous moment
				Add them before this moment's passage name.
			*/
			if (timeline[i].visits) {
				pastPassageNames.push(...timeline[i].visits);
			}
			/*
				Don't include the present passage's name as a "past" passage name.
			*/
			if (i !== recent) {
				pastPassageNames.push(timeline[i].passage);
			}
		}
	}

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

	/*
		The global variable scope. This is progressively mutated as the game progresses,
		and deltas of these changes (on a per-turn basis) are stored in Moments.

		TODO: Move all methods (EXCEPT TwineScript_Set() and TwineScript_Delete(), which are called by VarRef) off this and onto State itself.
	*/
	const SystemVariablesProto = assign(create(null), {
		/*
			Note that it's not possible for userland TwineScript to directly access or
			modify this base object.
		*/
		TwineScript_ObjectName: "this story's variables",

		/*
			This is the root prototype of every frame's variable type definitions. Inside a TypeDefs
			is every variable name that this variables collection contains, mapped to a Harlowe datatype.
		*/
		TwineScript_TypeDefs: null,

		/*
			This is used to distinguish to (set:) that this is a variable store,
			and assigning to its properties does affect game state.
		*/
		TwineScript_VariableStore: "global",

		/*
			All read/update/delete operations on this scope also update the delta for the current moment (present).
		*/
		TwineScript_Delete(prop) {
			delete this[prop];
			/*
				Setting this Moment's variable to 'null' marks it as deleted, for serialisation.
				Note that the SystemVariables store has this as 'undefined' (via the previous
				statement) so this (probably) isn't visible outside of State.
			*/
			present.variables[prop] = null;
			delete present.valueRefs[prop];
		},

		TwineScript_Set(prop, value, valueRef) {
			this[prop] = value;
			/*
				It's not necessary to clone (pass-by-value) the value when placing it on the delta,
				because once placed in the variable store, it should be impossible to mutate
				the value anymore - only by replacing it with another TwineScript_Set().
			*/
			present.variables[prop] = value;
			/*
				The value reference (used for save file reconstruction) is also recorded.
			*/
			present.valueRefs[prop] = valueRef;
		},

		TwineScript_GetProperty(prop) {
			return this[prop];
		},

		TwineScript_DefineType(prop, type) {
			this.TwineScript_TypeDefs[prop] = type;
			/*
				VarRef.defineType() automatically installs TwineScript_TypeDefs on 
			*/
			if (!hasOwnProperty.call(present.variables,"TwineScript_TypeDefs")) {
				present.variables.TwineScript_TypeDefs = create(null);
			}
			present.variables.TwineScript_TypeDefs[prop] = type;
		},
	});
	let SystemVariables;
	/*
		For testing purposes, there needs to be a way to "mock" having visited certain passages a certain number of times.
		Because (mock-visits:) and (mock-turns:) calls should be considered modal, and can be undone, their effects need to be tied
		to the variable store.
	*/
	let mockVisits, mockTurns;

	/*
		This is used to flatten a timeline into a single moment, which is either the present (for reconstructSystemVariables),
		or the epoch (for erasePast).
	*/
	const flattenMomentVariables = (array, dest) => {
		for (let i = 0; i < array.length; i += 1) {
			const moment = array[i];
			/*
				Each moment's mockVisits, mockTurns and seed replaces the previous.
			*/
			moment.mockVisits !== undefined && (mockVisits = moment.mockVisits);
			moment.mockTurns !== undefined && (mockTurns = moment.mockTurns);
			moment.seed !== undefined       && (seed = moment.seed);
			moment.seedIter !== undefined   && (seedIter = moment.seedIter);
			for (let prop in moment.variables) {
				/*
					The TwineScript_TypeDefs object (of inaccessible/non-writable data structures) doesn't need to have its contents cloned.
				*/
				if (prop === "TwineScript_TypeDefs") {
					assign(dest.TwineScript_TypeDefs, moment.variables[prop]);
				}
				else if (!prop.startsWith("TwineScript_")) {
					/*
						The JSON value "null" represents variables deleted by (move:).
					*/
					if (moment.variables[prop] === null) {
						delete dest[prop];
					}
					else {
						dest[prop] = moment.variables[prop];
					}
				}
			}
		}
	};

	/*
		Whenever a turn is undone or the game state is reloaded entirely, the global variable
		scope must be rebuilt.
	*/
	function reconstructSystemVariables() {
		mockVisits = mockTurns = undefined;
		/*
			Start with just the epoch.
		*/
		const ret = assign(create(SystemVariablesProto), { TwineScript_TypeDefs: create(null), }, epoch.variables || {});
		/*
			Then flatten every moment into this one.
		*/
		flattenMomentVariables(timeline.slice(0, recent + 1), ret);
		/*
			Now we're done, except for recalibrating the PRNG.
		*/
		SystemVariables = ret;
		/*
			If we're undoing to the start, restore the initial seed state.
		*/
		PRNG = mulberryMurmur32(recent === 0 ? epoch.seed : seed, recent === 0 ? epoch.seedIter : seedIter);
	}
	reconstructSystemVariables();

	let State;
	/*
		This enables session storage to preserve the game state across reloads, even when the browser
		(such as that of a phone) doesn't naturally preserve it using something like FF's bfcache.
	*/
	function saveSession(serialisation) {
		if (State.hasSessionStorage) {
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
		present = Moment.create(newPassageName);

		/*
			Update the serialisedPast cache, so that the moment that used to be
			the present is included in it. This is how serialisedPast is incrementally
			increased as the game progresses.
		*/
		let pastAndPresent;
		({past:serialisedPast, pastAndPresent} = State.serialise(true));

		saveSession(pastAndPresent);
	}

	/*
		The current game's state.
	*/
	State = {
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
			return SystemVariables;
		},

		/*
			Is there an undo cache?
		*/
		get pastLength() {
			return recent;
		},

		/*
			Used by the "turns" identifier.
		*/
		get turns() {
			return recent + 1 + (epoch.turns || 0) + (mockTurns || 0);
		},

		/*
			Is there a redo cache?
		*/
		get futureLength() {
			return (timeline.length - 1) - recent;
		},

		/*
			Get and set the current mockVisits and mockTurns state.
		*/
		get mockVisits() {
			return mockVisits || [];
		},

		set mockVisits(value) {
			mockVisits = value;
			present.mockVisits = value;
		},

		get mockTurns() {
			return mockTurns || 0;
		},

		set mockTurns(value) {
			mockTurns = value;
			present.mockTurns = value;
		},

		/*
			Used by (history:). Because storylets are liable to call (history:) a lot,
			it's ideal to do as little work as necessary in this.
		*/
		history() {
			let ret = State.pastPassageNames();
			if (epoch.visits) {
				ret = epoch.visits.concat(ret);
			}
			if (mockVisits) {
				ret = mockVisits.concat(ret);
			}
			return ret;
		},

		/*
			Used by (erase-past:). All moments before the specified index are flattened into the epoch.

			Note that this should simply never be called when used in a past moment (not the one at the end of the timeline).
		*/
		erasePast(ind) {
			if (ind < 0) {
				ind = timeline.length-1;
			}
			const excised = timeline.splice(0, ind);
			excised.forEach(e => {
				flattenMomentVariables(e, epoch);
				epoch.visits.push(...(e.visits || []), e.passage);
			});
			epoch.turns += excised.length;
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
		pastPassageNames: () => pastPassageNames,

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
		*/
		play(newPassageName) {
			if (!present) {
				impossible("State.play","present is undefined!");
			}
			// Push the soon-to-be past passage name into the cache.
			present.passage && pastPassageNames.push(present.passage);
			// Assign the passage name.
			present.passage = newPassageName;

			// Clear the future, and add the present to the timeline.
			timeline = timeline.slice(0,recent+1).concat(present);
			recent += 1;
			
			// Create a new present
			newPresent(newPassageName);
			// Call the 'forward' event handler with this passage name.
			eventHandlers.forward.forEach(fn => fn(newPassageName));
		},

		/*
			Push the present state to the timeline, and create a new state.
		*/
		redirect(newPassageName) {
			if (!present) {
				impossible("State.redirect","present is undefined!");
			}
			/*
				Each moment stores the passages visited by (redirect:)s that occured during it,
				solely for the sake of (history:).
			*/
			present.visits = (present.visits || []).concat(newPassageName);
			// The departing passage name still goes into the cache.
			present.passage && pastPassageNames.push(present.passage);
			// Assign the passage name.
			present.passage = newPassageName;
			// That's all!
			//TODO: Debug Mode redirect event
		},

		/*
			Rewind the state. This will fail and return false if the player is at the first moment.
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
				invalidateCaches();

				newPresent(timeline[recent].passage);
				/*
					Recompute the present variables based on the timeline.
				*/
				reconstructSystemVariables();
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
				/*
					Recompute the present variables based on the timeline.
				*/
				reconstructSystemVariables();
				/*
					Call the 'fast forward' event handler. This is used exclusively by debug mode,
					which is why it has the "fastForward" direction string passed in.
				*/
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
			PRNG = mulberryMurmur32();
			epoch = {
				seed,
				seedIter,
				variables: create(null),
			};
			invalidateCaches();
			reconstructSystemVariables();
			serialiseProblem = undefined;
			eventHandlers.load.forEach(fn => fn(timeline));
		},

		hasStorage: hasStorage[0],
		hasSessionStorage: hasStorage[1],

		/*
			A way to set the RNG seed.
			The new seed and seedIter is stored as a hidden variable in present.variables.
		*/
		setSeed(seed) {
			PRNG = mulberryMurmur32(seed);

			present.seed = seed;
			present.seedIter = seedIter;
		},

		/*
			A way to call the current PRNG, while also storing the changed seedIter
			as a hidden variable in present.variables.
		*/
		random: () => {
			const ret = PRNG();
			present.seedIter = seedIter;
			return ret;
		},

		/*
			The following is an in-place Fisher–Yates shuffle.
			Used only in data structure macros and value macros.
		*/
		shuffled(...list) {
			return list.reduce((a,e,ind) => {
				// Obtain a random number from 0 to ind inclusive.
				const j = (this.random()*(ind+1)) | 0;
				if (j === ind) {
					a.push(e);
				}
				else {
					a.push(a[j]);
					a[j] = e;
				}
				return a;
			},[]);
		},
	};

	/*
		In addition to the above simple methods, two serialisation methods are also present.
		These have a number of helper functions.
	*/

	/*
		This helper checks if serialisation is possible for this data value.
	*/
	function isSerialisable(obj) {
		const jsType = typeof obj;
		return !TwineError.containsError(obj) && (
			typeof obj.TwineScript_ToSource === "function" || Array.isArray(obj) || obj instanceof Map
				|| obj instanceof Set || jsType === "string" || jsType === "number" || jsType === "boolean"
		);
	}

	/*
		Serialise the game history, from the present backward (ignoring the redo cache)
		into a JSON string.
		
		@return {Object|Boolean} The serialised state (in two strings), or false if serialisation failed.
	*/
	State.serialise = newPresent => {
		let whatToSerialise;
		/*
			- If serialisedPast isn't set yet, serialise everything up to the present.
			- At the start of each turn (i.e newPresent == true), serialise the recently finished moment,
			and the new moment.
			- During a turn (i.e. (save-game:) or whatever),
			serialise only the current moment (assume serialisedPast is up to date).
		*/
		whatToSerialise = timeline.slice(!serialisedPast ? 0 : newPresent ? recent-1 : recent, recent+1);
		/*
			The epoch object must be included first.
		*/
		if (!serialisedPast) {
			whatToSerialise.unshift(epoch);
		}

		/*
			We must determine if the state is serialisable.
			Once it is deemed unserialisable, it remains that way for the rest
			of the story. (Note: currently, rewinding back past a point
			where an unserialisable object was (set:) does NOT revert the
			serialisability status.)

			Create an array (of [var, value] pairs) that shows each variable that
			couldn't be serialised at each particular turn.
		*/
		const serialisability = whatToSerialise.map(
			(moment) => hasOwnProperty.call(moment,'seed') ? [] : Object.keys(moment.variables)
				.filter((e) => moment.variables[e] && !e.startsWith('TwineScript_') && !isSerialisable(moment.variables[e]))
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
		/*
			Note: This MUST NOT be an arrow function, because JSON.stringify uses 'this' in the given callback.
			As of Oct 2021, it's currently not decided what should happen when a mock visits savefile is loaded outside of Debug Mode.
		*/
		let serialiseFn = function (name, variable) {
			/*
				Special optimisation: when a Moment has no changed variables, redirects, seeds, or whatever,
				replace it with a string of just the passage name.
			*/
			if (Moment.isPrototypeOf(variable)) {
				if (variable.visits  === undefined
						&& variable.mockVisits  === undefined
						&& variable.mockTurns  === undefined
						&& variable.seed === undefined
						&& variable.seedIter === undefined
						&& Object.keys(variable.variables).every(e => e.startsWith("TwineScript_"))) {
					return variable.passage;
				}
			}
			// If this is the ValueRefs object, don't serialise it
			// Note that the epoch doesn't have a valueRefs.
			if (Moment.isPrototypeOf(this) && name === "valueRefs") {
				return undefined;
			}
			/*
				Variables objects should be serialised such that only the variables inside
				the VariableStore are converted to Harlowe strings with toSource().
			*/
			if ((Moment.isPrototypeOf(this) || epoch === this) && name === "variables") {
				const ret = {};
				for (let key in this.variables) {
					/*
						Serialising the TypeDefs, which is the only VariableStore property
						that isn't directly user-created, and is a plain JS object,
						requires a little special-casing.
					*/
					if (key === "TwineScript_TypeDefs") {
						ret[key] = {};
						for (let typeDef in this.variables[key]) {
							/*
								Since the datatypes inside are Harlowe values,
								they should be serialised to source as well.
							*/
							ret[key][typeDef] = toSource(this.variables[key][typeDef]);
						}
					}
					/*
						"null", representing deleted variables, is passed as-is to become a JSON null.
						(Currently (Jan 2022), though, nothing can delete values.)
					*/
					else if (this.variables[key] === null) {
						 ret[key] = null;
					}
					else if (this.valueRefs[key]) {
						/*
							Values with a reference are serialised as an array (generated in Runner by the "to" and "into" handler)
							of [passage name, passage text start index, passage text end index], which is used to reconstruct the value
							when loading the save file.
						*/
						ret[key] = this.valueRefs[key];
					}
					else {
						ret[key] = toSource(this.variables[key]);
					}
				}
				return ret;
			}
			return variable;
		};
		let pastToSerialise = whatToSerialise.slice(0, -1);
		let updatedPast = serialisedPast;
		/*
			If there's no extra pastToSerialise, serialisedPast doesn't need to be updated.
		*/
		try {
			if (pastToSerialise.length) {
				/*
					The amount of ] marks that must be repeatedly sliced off with .slice(0,-1) and .slice(1) to
					concatenate these JSON serialised arrays together is very #awkward.
				*/
				updatedPast = (!updatedPast ? "[" : updatedPast.slice(0, -1) + ",") + JSON.stringify(pastToSerialise, serialiseFn).slice(1);
			}
			return {
				past: updatedPast,
				/*
					Currently, serialiseFn assumes that its input is an array of moments, and can't serialise a single moment by itself.
					Hence, while whatToSerialise.slice(-1) is a one-element array, the contained element can't be passed itself.
				*/
				pastAndPresent: updatedPast.slice(0, -1) + (updatedPast ? ',' : '[') + JSON.stringify(whatToSerialise.slice(-1), serialiseFn).slice(1),
			};
		}
		catch(e) {
			return { past: false, pastAndPresent: false };
		}
	};

	/*
		A quick method to recompile objects whose values are Harlowe code strings, taken directly
		from localStorage.
		Since this should only receive formerly-serialised data, we don't really need to care about the
		scope of the eval().
	*/
	function recompileValues(section, moment, obj) {
		for (let key in obj) {
			if (hasOwnProperty.call(obj, key) && !key.startsWith("TwineScript_")) {
				/*
					ValueRefs are arrays consisting of
					[ passage name, start index, end index, other execution state ],
					whereas normal variables are strings of Harlowe source.

					Note that TypeDefs values can't be serialised as "reconstruct",
					so this check won't do anything unwanted to them.
				*/
				if (Array.isArray(obj[key])) {
					/*
						Save and re-use this ValueRef for the next time the game is saved.
					*/
					moment.valueRefs[key] = obj[key];

					const [passageName, start, end] = obj[key];
					const source = Passages.get(passageName).get('source');
					obj[key] = section.eval(lex(source.slice(start, end), '', 'macro'));
				}
				else {
					obj[key] = section.eval(lex(obj[key], '', 'macro'));
				}
			}
			/*
				Compatibility with Harlowe 3.2.3.
			*/
			else if (key === "TwineScript_MockVisits") {
				moment.mockVisits = obj[key];
			}
		}
	}
	
	/*
		Deserialise the string and replace the current history.
		Since an error with save data isn't necessarily an author error, the errors returned
		by this function aren't TwineErrors.
	*/
	State.deserialise = (section, str) => {
		let newTimeline;
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
		
		for(let i = 0; i < newTimeline.length; i += 1) {
			let moment = newTimeline[i];
			/*
				If it's just a string, uncompress it into a full JSON "moment".
			*/
			if (typeof moment === "string") {
				moment = { passage: moment, variables: {} };
			}
			/*
				If it's the epoch object, process it.
			*/
			else if (typeof moment === "object" && !hasOwnProperty.call(moment,"passage")) {
				/*
					If there's erroneously more epoch objects than in the first position, ignore them.
				*/
				if (i === 0) {
					epoch = moment;
					PRNG = mulberryMurmur32(moment.seed, moment.seedIter);
				}
				/*
					Seamlessly remove this non-state object from the timeline.
				*/
				newTimeline.splice(i--,1);
				continue;
			}
			/*
				Here, we do some brief verification that the remaining moments in the array are
				objects with "passage" and "variables" keys.
			*/
			else if (typeof moment !== "object"
					|| !hasOwnProperty.call(moment,"variables")) {
				/*
					Rather than freak out, just disregard this object altogether.
				*/
				newTimeline.splice(i--,1);
				continue;
			}
			/*
				The valueRefs record is restored here (as it wasn't saved in the savefile for obvious reasons).
			*/
			moment.valueRefs = create(null);
			/*
				Clean the prototype of the variables object.
			*/
			moment.variables = assign(create(null), moment.variables);
			/*
				Check that the passage name in this moment corresponds to a real passage.
				As this is the most likely issue with invalid save data, this gets a precise message.
			*/
			if (!Passages.hasValid(moment.passage)) {
				return Error(`The data refers to a passage named '${moment.passage}', but it isn't in this story.`);
			}
			/*
				If the variables object has a TypeDefs object, that needs to be recompiled as well.
			*/
			if (hasOwnProperty.call(moment.variables,'TwineScript_TypeDefs')) {
				/*
					Much like the variables, the datatypes are currently Harlowe code strings - though rather likely to be
					literals like "number" or "datamap".
				*/
				try {
					recompileValues(section, moment, moment.variables.TwineScript_TypeDefs);
				} catch(e) {
					return Error(`The variable types on turn ${i+1} couldn't be reconstructed.`);
				}
			}
			/*
				Compile all of the variables (which are currently Harlowe code strings) back into Harlowe values.
			*/
			try {
				recompileValues(section, moment, moment.variables);
			} catch(e) {
				return Error(`The variables on turn ${i+1} couldn't be reconstructed.`);
			}
			/*
				Re-establish the moment objects' prototype link to Moment.
			*/
			newTimeline[i] = assign(create(Moment), moment);
		}
		timeline = newTimeline;
		recent = timeline.length - 1;
		eventHandlers.load.forEach(fn => fn(timeline));
		invalidateCaches();
		reconstructSystemVariables();
		newPresent(timeline[recent].passage);
		return true;
	};
	
	Object.seal(Moment);
	return Object.freeze(State);
});
