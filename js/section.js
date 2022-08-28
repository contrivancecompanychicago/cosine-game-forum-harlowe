"use strict";
define('section', [
	'jquery',
	'utils',
	'twinescript/runner',
	'twinescript/operations',
	'state',
	'utils/operationutils',
	'utils/renderutils',
	'utils/scripttag',
	'datatypes/changercommand',
	'datatypes/colour',
	'datatypes/lambda',
	'datatypes/codehook',
	'internaltypes/changedescriptor',
	'internaltypes/varscope',
	'internaltypes/twineerror',
	'internaltypes/twinenotifier',
],
($, Utils, run, Operations, State, {printBuiltinValue,objectName,typeID,isObject}, {collapse}, runScriptTag, ChangerCommand, Colour, Lambda, CodeHook, ChangeDescriptor, VarScope, TwineError, TwineNotifier) => {

	const {assign, create, keys} = Object;
	let Section;

	/*
		Section objects represent a block of Twine source rendered into the DOM.
		It contains its own DOM, a reference to any enclosing Section,
		and methods and properties related to invoking code within it.
		
		The big deal of having multiple Section objects (and the name Section itself
		as compared to "passage" or "screen") is that multiple simultaneous passages'
		(such as stretchtext mode) code can be hygenically scoped. Hook references
		in one passage cannot affect another, and so forth. (This hygeine is currently
		not implemented, however, as neither is stretchtext.)

		After a section has finished rendering, one can expect it to be discarded.
		The following things allow a section object to persist:
		* Live hook macros (until they deactivate themselves when the section is removed from the DOM)
		* Saved (enchant:), (link-goto:) and other macros.
	*/
	
	/*
		Apply the result of a <tw-expression>'s evaluation to the next hook.
		If the result is a changer command, live command or boolean, this will cause the hook
		to be rendered differently.

		@param {jQuery} The <tw-expression> element.
		@param {Any} The result of running the expression.
		@param {jQuery} The next <tw-hook> element, passed in solely to save re-computing it.
	*/
	function applyExpressionToHook(expr, result, nextHook) {
		/*
			If result is a ChangerCommand, please run it.
		*/
		if (result && typeof result === "object" && ChangerCommand.isPrototypeOf(result)) {
			/*
				The use of popAttr prevents the hook from executing normally
				if it wasn't actually the eventual target of the changer function.
			*/
			/*
				TODO: Remove this cachedData manipulation in 4.0 (see Section.execute)
			*/
			const source = nextHook.popData('source') || nextHook[0].cachedData?.source;
			nextHook[0]?.cachedData && (nextHook[0].cachedData.source = undefined);

			nextHook.data('originalSource', source);
			/*
				Rather than simply passing the changer to renderInto(),
				run a fresh CD through it. If it was a live changer, this will be re-used
				for each additional iteration.
			*/
			const desc = ChangeDescriptor.create({
				/*
					Don't forget: nextHook may actually be empty.
					This is acceptable - the result changer could alter the
					target appropriately.
				*/
				target: nextHook, source, section: this, append: "append"});
			/*
				(for:) changers can produce errors on running instead of just on creation.
			*/
			const error = result.run(desc);
			if (TwineError.containsError(error)) {
				expr.replaceWith(error.render(expr.attr('title')));
			}

			const enabled = this.renderInto(
				source,
				/*
					Because we're passing in a ChangeDescriptor, the target may be null.
				*/
				null,
				desc
			);

			if (!enabled) {
				const name = Utils.insensitiveName(expr.attr('name'));
				/*
					The 'false' class is used solely by debug mode to visually denote
					that a macro such as (if:) (but not (hidden:)) suppressed a hook.
				*/
				if (["if", "elseif", "unless", "else", "testfalse"].includes(name)) {
					expr.addClass("false");
					/*
						Unfortunately, (else-if:) must be special-cased, so that it doesn't affect
						lastHookShown, instead preserving the value of the original (if:).
					*/
					if (name !== "elseif") {
						this.stackTop.lastHookShown = false;
					}
				}
				/*
					If the changer command included a (live:) or (event:) command,
					set up the intervals to live-update the attached macro.
				*/
				if (nextHook.data('live')) {
					runLiveHook.call(this, expr, desc, nextHook);
				}
				return true;
			}
			/*
				Do note: renderInto(), via ChangeDescriptor.render(), installs the 'hidden' and 'originalSource'
				attributes on the non-enabled hook by itself, thus not requiring this function to do it.
			*/
		}
		/*
			Attached false values hide hooks as well.
			This is special: as it prevents hooks from being run, an (else:)
			that follows this will pass.
		*/
		else if (result === false) {
			/*
				Removing the 'source' attribute is necessary to prevent this from being rendered
				by Section.
			*/
			/*
				TODO: Remove this cachedData manipulation in 4.0 (see Section.execute)
			*/
			const source = nextHook.popData('source') || nextHook[0].cachedData?.source;
			nextHook[0]?.cachedData && (nextHook[0].cachedData.source = undefined);

			if (source) {
				nextHook.cachedData && (nextHook.cachedData.source = undefined);
				nextHook.data('originalSource', source);
				nextHook.data('hidden',true);
			}
			expr.addClass("false");
			
			this.stackTop.lastHookShown = false;
			return true;
		}
		/*
			If the result isn't a boolean, simply decline to attach it, and allow Section to print it where it is.
		*/
		else if (result !== true) {
			return false;
		}
		/*
			The (else:) and (elseif:) macros require a little bit of state to be
			saved after every hook interaction: whether or not the preceding hook
			was shown or hidden by the attached expression.
			Sadly, we must oblige with this overweening demand.
		*/
		this.stackTop.lastHookShown = true;
		return true;
	}
	
	/*
		This function selects the next sibling element which isn't a whitespace text node,
		nor a <br>. It also returns the intervening whitespace.
	*/
	function nextNonWhitespace(e) {
		const {nextSibling} = (e instanceof $ ? e[0] : e);
		if (nextSibling &&
				((nextSibling instanceof Text && !nextSibling.textContent.trim())
				|| ["br","tw-consecutive-br"].includes((nextSibling.tagName || '').toLowerCase()))) {

			const { whitespace, nextElem } = nextNonWhitespace(nextSibling);
			return { whitespace: $(nextSibling).add(whitespace), nextElem };
		}
		return { whitespace: $(), nextElem: $(nextSibling) };
	}

	/*
		The debug-only eval replay button is appended to both <tw-expression>s and <tw-error>s, with the replay data attached.
		Since the consumer is always $().append(), returning undefined is fine.
	*/
	const makeReplayButton = replay => {
		if (replay?.length) {
			return $("<tw-open-button replay label='🔍'>").data('evalReplay', replay);
		}
	};
	
	/*
		Run a newly rendered <tw-expression> element's code, obtain the resulting value,
		and apply it to the next <tw-hook> element, if present.
	*/
	function runExpression(expr, code) {
		/*
			Execute the expression, and obtain its result value.
		*/
		let result = this.eval(code);
		/*
			Add the replay button if replay data is available.
		*/
		expr.append(makeReplayButton(this.evalReplay));
		/*
			If this stack frame is being rendered in "evaluate only" mode (i.e. it's inside a link's passage name or somesuch)
			then it's only being rendered to quickly check what the resulting DOM looks like. As such, changers or commands which
			alter game state should not be run, and an error should be produced.
		*/
		if (this.stackTop.evaluateOnly && result && (ChangerCommand.isPrototypeOf(result) || typeof result.TwineScript_Run === "function")) {
			result = TwineError.create("syntax",
				`I can't work out what ${this.stackTop.evaluateOnly} should evaluate to, because it contains a ${(ChangerCommand.isPrototypeOf(result)) ? "changer." : "command."}`,
				"Please rewrite this without putting changers or commands here."
			);
		}

		/*
			Consecutive changer expressions, separated with "+" and followed by a hook,
			will "chain up" into a single command, which is then applied to that hook.

			As long as the result is a changer, it may link up with an expression following it
			if a "+" is placed between them.

			Note: If the result isn't a changer at all, then it might be another kind of value
			(a boolean, or a (live:) command) which still can be attached, but not chained.
		*/
		let whitespace, nextElem, nextHook = $();
		nextElem = expr;
		while(ChangerCommand.isPrototypeOf(result)) {
			/*
				Check if the next non-whitespace element is a +, an attachable expression, or a hook.
			*/
			({whitespace, nextElem} = nextNonWhitespace(nextElem));
			if (nextElem[0] && nextElem[0].nodeType === Node.TEXT_NODE && nextElem[0].textContent.trim() === "+") {
				/*
					Having found a +, we must confirm the non-ws element after it is an expression.
					If it is, we try to + it with the changer.
					(If it's a Hook Expression, this + will fail and neither it nor the changer will be executed)
				*/
				let whitespaceAfter, plusMark = nextElem;
				({whitespace:whitespaceAfter, nextElem} = nextNonWhitespace(plusMark));
				if (nextElem.is('tw-expression')) {
					/*
						It's an expression - we can join them.
						Add the expressions, and remove the interstitial + and whitespace.
					*/
					/*
						TODO: Remove this cachedData manipulation in 4.0 (see Section.execute)
					*/
					const code = nextElem.popData('code') || nextElem[0]?.cachedData?.code;
					nextElem[0]?.cachedData && (nextElem[0].cachedData.code = undefined);

					const nextValue = this.eval(code);
					/*
						(But, don't join them if the nextValue contains its own error.)
					*/
					if (TwineError.containsError(nextValue)) {
						result = nextValue;
						break;
					}
					const newResult = Operations["+"](result, nextValue);
					$(whitespace).add(plusMark).add(whitespaceAfter).remove();
					/*
						If this causes result to become an error, create a new error with a more appropriate
						message.
					*/
					if (TwineError.containsError(newResult)) {
						result = TwineError.create("operation",
							"I can't combine " + objectName(result) + " with " + objectName(nextValue) + ".",
							/*
								Because of the common use-case of attaching changers to commands, and the potential to confuse
								this with combining changers inline, a special elaboration is given for changer + command.
							*/
							typeof nextValue.TwineScript_Run === "function"
								? `If you want to attach this changer to ${objectName(nextValue)}, remove the + between them.`
								: "Changers can only be added to other changers."
						);
					}
					else {
						result = newResult;
					}
					/*
						Because changers cannot be +'d with anything other than themselves,
						this continue, jumping back to the while condition above, will always continue
						the loop.
					*/
					continue;
				}
				/*
					If the next element wasn't an expression, fall down to the error below.
				*/
			}
			/*
				If instead of a +, it's another kind of expression, we attempt to determine if it has TwineScript_Attach().
				If not, then the changer's attempted attachment fails and an error results, and it doesn't matter if the expression
				is dropped (by us executing its js early) as well.
			*/
			if (nextElem.is('tw-expression')) {
				/*
					TODO: Remove this cachedData manipulation in 4.0 (see Section.execute)
				*/
				const code = nextElem.popData('code') || nextElem[0]?.cachedData?.code;
				nextElem[0]?.cachedData && (nextElem[0].cachedData.code = undefined);

				const nextValue = this.eval(code);
				nextElem.append(makeReplayButton(this.evalReplay));
				/*
					Errors produced by expression evaluation should be propagated above changer attachment errors, I guess.
				*/
				if (TwineError.containsError(nextValue)) {
					result = nextValue;
					break;
				}
				/*
					Here's where the attachment happens, if it can. If an error results from TwineScript_Attach(), it'll be handled down the line.
				*/
				if (nextValue && typeof nextValue === "object" && typeof nextValue.TwineScript_Attach === "function") {
					/*
						This should subtly mutate the command object in-place (which doesn't really matter as it was produced
						from raw JS just a few lines above) leaving it ready to be TwineScript_Run() far below.
					*/
					result = nextValue.TwineScript_Attach(this, result);
					break;
				}
				/*
					When the attachment can't happen, produce an error mentioning that only certain structures allow changers to attach.
					Again, potential confusion between attaching changers to commands and combining changers necessitates a special error
					message for this situation.
				*/
				else if (ChangerCommand.isPrototypeOf(nextValue)) {
					expr.replaceWith(TwineError.create("operation",
						`Changers like (${result.macroName}:) need to be combined using + between them.`,
						`Place the + between the changer macros, or the variables holding them. The + is absent only between a changer and its attached hook or command.`
					).render(expr.attr('title')));
					return;
				}
				else {
					expr.replaceWith(TwineError.create("operation",
						`${objectName(nextValue)} can't have changers like (${result.macroName}:) attached.`,
						"Changers placed just before hooks, links and commands will attempt to attach, but in this case it didn't work."
					).render(expr.attr('title')));
					return;
				}
			}
			if (nextElem.is('tw-hook')) {
				/*
					If it's an anonymous hook, apply the summed changer to it
					(and remove the whitespace).
				*/
				whitespace.remove();
				nextHook = nextElem;
				break;
			}
			/*
				If it's neither hook nor expression, then this evidently isn't connected to
				a hook at all. Produce an error.
			*/
			if (!result.macroName) {
				Utils.impossible('Section.runExpression', 'changer has no macroName');
			}
			const macroCall = (expr.attr('title') || ("(" + result.macroName + ": ...)"));
			expr.replaceWith(TwineError.create("syntax",
				`The (${result.macroName}:) changer should be stored in a variable or attached to a hook.`,
				`Macros like this should appear before a hook: ${macroCall}[Some text]`
			).render(expr.attr('title')));
			return;
		}

		/*
			Apply the return type attribute, used by debug mode, to the expression.
			Note that this won't matter if the expr is replaced with an error later.
			Also, since debug mode can be enabled at any time via (debug:),
			we're doing this regardless of its current state.
		*/
		expr.attr('return', typeID(result));

		/*
			If the above loop wasn't entered at all (i.e. the result wasn't a changer) then an error may
			be called for. For now, obtain the next hook anyway.
		*/
		nextHook = nextHook.length ? nextHook : nextNonWhitespace(expr).nextElem.filter('tw-hook');

		/*
			Print any error that resulted.
			This must of course run after the sensor/changer function was run,
			in case that provided an error.
		*/
		let error;
		if ((error = TwineError.containsError(result))) {
			/*
				Errors have the debug replay button attached, too, if replay data is available.
			*/
			expr.replaceWith(error.render(expr.attr('title')).append(makeReplayButton(this.evalReplay)));
		}
		/*
			If we're in debug mode, a TwineNotifier may have been sent.
			In which case, print that *inside* the expr, not replacing it.
		*/
		else if (TwineNotifier.isPrototypeOf(result)) {
			expr.append(result.render());
		}
		/*
			If the expression is a Command, run it and, if it returns a ChangeDescriptor,
			run that against the expr.
		*/
		else if (result && typeof result.TwineScript_Run === "function") {
			result = result.TwineScript_Run(this);
			/*
				TwineScript_Run() can also return TwineErrors that only resulted
				from running the command (such as running (undo:) on the first turn).
			*/
			if (TwineError.containsError(result)) {
				expr.replaceWith(result.render(expr.attr('title')));
			}
			else if (ChangeDescriptor.isPrototypeOf(result)) {
				/*
					Unimplemented behaviour (2018-07-20): live changers can't be attached to commands, only
					proper hooks.
				*/
				if (result.data?.live) {
					expr.replaceWith(TwineError.create("unimplemented",
						"I currently can't attach (live:) or (event:) macros to commands - only hooks."
					).render(expr.attr('title')));
					return;
				}
				/*
					We need to update the ChangeDescriptor to have these fields, so
					that certain interaction macros that want to reuse it (such as (cycling-link:))
					can pass it to renderInto().
				*/
				result.section = this;
				result.target = nextElem;
				
				this.renderInto('', nextElem, result);
			}
			/*
				If TwineScript_Run returns a {blocked} object,
				then block control flow. This is usually caused by dialog macros like (alert:) or (confirm:),
				or interruption macros like (goto:).
			*/
			else if (isObject(result) && result.blocked) {
				this.stackTop.blocked = result.blocked;
				/*
					This is the only way to get errors back from a command (i.e. not a value macro)
					that blocked the section, and put them in the original initiating <tw-expression>.
				*/
				expr.data('code', {
					type: 'macro',
					blockedValue: true,
					/*
						These three things are used only by the Debug Replay feature.
					*/
					text: expr.attr('title') || '',
					start: 0,
					end: (expr.attr('title') || '').length,
				});
				return;
			}
			else if (result) {
				Utils.impossible("Section.runExpression",
					`TwineScript_Run() returned a non-ChangeDescriptor ${typeof result}: "${result}"`);
			}
		}
		/*
			Attempt to attach the expression to the next hook. If it succeeds, we're done.
		*/
		else if (nextHook.length && applyExpressionToHook.call(this, expr, result, nextHook)) {
			return;
		}
		/*
			Print the expression if it's a string, codehook, number, data structure,
			or is some other data type without a TwineScript_Run().
		*/
		else if (
				/*
					If it's plain data, it shouldn't be attached to a hook.
					If it was attached, an error should be produced
					(by applyExpressionToHook) to clue the author into the correct attachable types.
				*/
				(typeof result === "string"
				|| typeof result === "number"
				|| result instanceof Map
				|| result instanceof Set
				|| Array.isArray(result)
				|| Colour.isPrototypeOf(result))
				|| CodeHook.isPrototypeOf(result)
				|| (result && typeof result.TwineScript_Print === "function" && !ChangerCommand.isPrototypeOf(result))) {
			/*
				TwineScript_Print(), when called by printBuiltinValue(), typically emits
				side-effects. These will occur... now.
			*/
			result = printBuiltinValue(result);
			/*
				Errors directly replace the element.
			*/
			if (TwineError.containsError(result)) {
				expr.replaceWith(result.render(expr.attr('title')));
			}
			else if (typeof result !== "string" && !Array.isArray(result)) {
				Utils.impossible(`printBuiltinValue() produced a non-string non-array ${typeof result}`);
			}
			else {
				/*
					Transition the resulting Twine code into the expression's element.
				*/
				this.renderInto(result, expr);
			}
		}
		/*
			The only remaining values should be unattached changers, or booleans.
		*/
		else if (!(ChangerCommand.isPrototypeOf(result) || typeof result === "boolean")) {
			Utils.impossible('Section.runExpression', `The expression evaluated to an unknown value: ${result}`);
		}
	}

	/*
		A live hook is one that has the (live:) or (event:) macro attached.
		It repeatedly re-renders, allowing a passage to have "live" behaviour.
		
		The default delay for (live:), which is also used by (event:), is 20ms.

		This is exclusively called by runExpression().
	*/
	function runLiveHook(expr, cd, target) {
		/*
			Events given here MUST have a 'when' property.
		*/
		const {delay, event} = target.data('live');
		/*
			Prepare a new changeDescriptor to use once the hook is finally being run.
			This always has 'replace' because currently (Feb 2022) no live macros
			purely append or prepend.
		*/
		cd = assign({}, cd, {append:'replace', transitionDeferred: false, enabled:true});
		/*
			But, remove the liveness from the new ChangeDescriptor, for obvious reasons.
		*/
		cd.data = assign({}, cd.data, { live: undefined });
		/*
			Obtain the code of the hook that the (live:) or (event:) changer suppressed.
		*/
		const source = target.data('originalSource') || "";
		/*
			Similarly to the other delayed rendering macros like (link:) and (click:),
			this too must store the current stack tempVariables object, so that it can
			give the event access to the temp variables visible at render time.
		*/
		const {tempVariables} = this.stackTop;
		/*
			Store the target's current parent, to check that it's still in the DOM.
		*/
		/*
			The use of .bind() here is to save reinitialising the inner function on every call.
		*/
		let previousTimestamp = null;
		let duration = delay;
		let recursive;
		const animFrameCallback = timestamp => {
			if (previousTimestamp) {
				duration -= (timestamp - previousTimestamp);
			}
			previousTimestamp = timestamp;
			
			if (duration > 0) {
				requestAnimationFrame(animFrameCallback);
				return;
			}
			duration = delay;
			recursive();
		};
		recursive = this.whenUnblocked.bind(this, () => {
			/*
				We must do an inDOM check here in case a different (live:) macro
				(or a (goto:) macro) caused this to leave the DOM between
				previous runs, or if this was erroneously used in a (macro:) macro's code hook.
			*/
			if (!this.inDOM()) {
				return;
			}
			/*
				If this is an (event:) command, check the event (which should be a "when" lambda)
				and if it's not happened yet, wait for the next timeout.

				Note: Lambda.filter() returns the passed-in array with values filtered out based on
				whether the lambda was false. So, passing in 'true' will return [true] if
				the lambda was true and [] (an empty array) if not.
			*/
			const eventFired = (event?.filter(this, [true], tempVariables));
			if (TwineError.containsError(eventFired)) {
				eventFired.render(this, expr.attr('title')).replaceAll(expr);
				return;
			}
			/*
				(live:) macros always render; (event:), (more:) and (after:) macros only render once the event fired.
			*/
			if (event && !eventFired[0]) {
				requestAnimationFrame(animFrameCallback);
				return;
			}
			this.renderInto(source, target, cd, tempVariables);
			/*
				If the event DID fire, on the other hand, we should stop.
			*/
			if (eventFired) {
				return;
			}
			/*
				The (stop:) command causes the nearest (live:) command enclosing
				it to be stopped. If a (stop:) is in the rendering target, we shan't continue running.
			*/
			if (target.find("tw-expression[name='stop']").length) {
				return;
			}
			/*
				Re-rendering will also cease if this section was removed from the DOM,
				possibly by a (replace:) inside this hook.
			*/
			if (!this.inDOM()) {
				return;
			}
			
			/*
				Otherwise, resume re-running.
			*/
			requestAnimationFrame(animFrameCallback);
		});
		requestAnimationFrame(animFrameCallback);
	}

	/*
		Debug Mode event handlers (for adding and removing enchantments) are stored here by onEnchant().
	*/
	const eventHandlers = {
		add: [], remove: [],
	};

	Section = {
		/*
			Creates a new Section which inherits from this one.
			Note: while all Sections use the methods on this Section prototype,
			there isn't really much call for a Section to delegate to its
			parent Section.
			
			@param {jQuery} The DOM that comprises this section.
			@return {Section} Object that inherits from this one.
		*/
		create(dom = Utils.storyElement) {
			/*
				Install all of the non-circular properties.
			*/
			let ret = assign(create(this), {
				/*
					The time this Section was rendered. Of course, it's
					not been rendered yet, but it needs to be recorded this early because
					TwineScript uses it.
				*/
				timestamp: Date.now(),
				/*
					The root element for this section. Macros, hookRefs, etc.
					can only affect those in this Section's DOM.
				*/
				dom,
				/*
					The expression stack is an array of plain objects,
					each housing runtime data that is local to the expression being
					evaluated. It is used by macros such as "display" and "if" to
					keep track of prior evaluations - e.g. display loops, (else:).
					Its objects currently are allowed to possess:
					- tempVariables: VarScope
					- desc: ChangeDescriptor
					- collapses: Boolean (used by collapsing markup)
					- lastHookShown: Boolean (used by (else:) and (elseif:))
					- dom: jQuery (used by blockers)
					- blocked: Boolean or jQuery (used by blockers; a jQuery denotes the blocking element)
					- blockedValues: Array (used by blockers)
					- evaluateOnly: String (used by evaluateTwineMarkup())
					- finalIter: Boolean (used for infinite loop checks)
					- lambdaPos: Number (only used by lambdas and the "pos" identifier)
					
					render() pushes a new object to this stack before
					running expressions, and pops it off again afterward.
				*/
				stack: [],
				/*
					This is an enchantments stack. Enchantment objects (created by macros
					such as (click:)) are tracked here to ensure that post-hoc permutations
					of this enchantment's DOM are also enchanted correctly.
				*/
				enchantments: [],
				/*
					When a section's execution becomes blocked, certain callbacks that need to run only
					once the section becomes unblocked (such as (event:) events) are registered here.
				*/
				unblockCallbacks: [],
				/*
					This is only used for a purely encapsulated mutation inside Runner to pass data up and down the
					run() calls. Nevertheless, it exists.
				*/
				freeVariables: null,
				/*
					Only used in Debug Mode, this allows any <tw-expression>'s result evaluation to be reviewed step-by-step.
					See this.eval().
				*/
				evalReplay: null,
				/*
					This is set by Engine whenever it navigates to a passage as a result of (load-game:). It prevents
					(load-game:) from running again in that passage until initial rendering ends.
				*/
				loadedGame: false,
				/*
					The identifiers reference aspects of the currently rendered passage, such as the number of exits
					or the time since rendering.
				*/
				Identifiers: {

					/*
						This signifier is used solely by VarRef to determine if Identifiers is being
						used as an assignment destination.
					*/
					TwineScript_Identifiers: true,
					/*d:
						it -> Any

						Like all identifiers, `it` is case-insensitive: `IT`, `iT` and `It` are all acceptable as well.

						This keyword is usually a shorthand for the most recently evaluated expression's leftmost value. It lets you write
						`(if: $candles < 2 and it > 5)` instead of `(if: $candles < 2 and $candles > 5)`, or `(set: $candles to it + 3)`
						instead of `(set: $candles to $candles + 3)`. (You can't, however, use it in a (put:) or (move:) macro:
						`(put:$red + $blue into it)` is invalid.)

						Since `it` uses the most recent expression's leftward value, `(print: $red > 2 and it < 4 and $blue > 2 and it < 4)` is the same as
						`(print: $red > 2 and $red < 4 and $blue > 2 and $blue < 4)`. This value of `it` changes to $blue in `it < 4` because
						the expression `$blue > 2` was evaluated by Harlowe just before, and $blue is the leftmost value inside that expression.
						(To get a greater sense of how Harlowe evaluates expressions, use Debug View in Harlowe's Debug Mode, then click on a 🔍
						button in the passage.)

						###Inferred `it`:

						In some situations, the `it` keyword will be *inserted automatically* by Harlowe when the story runs. If you write an
						incomplete comparison expression where the left-hand side is missing, like `(print: $red > 2 and < 4)`,
						then, when running, the `it` keyword will automatically be inserted into the absent spot - producing, in this case,
						`(print: $red > 2 and it < 4)`.

						###Inferred comparisons:

						In addition to the above, there are some situations involving chains of `and` and `or` operators where Harlowe can insert
						a missing `it` keyword *and the most recently-evaluated comparison operator*. If you write `(if: $a > 2 and 3)`, then Harlowe
						will decide, since it is incorrect to use `and` directly with numbers, that what you *actually* meant was `(if: $a > 2 and it > 3)`.

						###Special case - right-side inferred comparisons:

						Harlowe will make inferences even if the comparison is on the right side of the chain of `and` and `or` operators, such as `(if: 3 and 4 < $a)`.
						In these cases, however, Harlowe will slightly change the rules of the `it` keyword to conform to English grammar intuitions. `(if: 3 and 4 < $a)`
						intuitively means "if both 3 and 4 are less than $a" in English. So, it is interpreted by Harlowe as follows.
						Since `4 < $a` is the only complete expression, it is evaluated first. Then, the *rightmost* value, $a, becomes the `it` identifier's value.
						Then, `3` becomes `3 < it`. The macro call is now equivalent to `(if: 3 < $a and 4 < $a)`.

						Note that, since this special case **only** applies to `it` keywords that Harlowe inserts by itself, you shouldn't really worry about it when
						writing your stories. Just be aware of how right-side inferred comparisons work.

						###Special case - `it` in lambdas:

						There is another special case regarding the `it` identifier: inside `where`, `via` or `making` lambdas, `it` refers to the data value
						that the lambda is currently operating on, saving you from having to write it, or, in some cases, name it at all. A lambda like
						`_num where _num > 4` can be shortened to just `where it > 4` - the `it` identifier in this case replacing the `_num` temp variable entirely.

						###The `its` variant:

						If the `it` keyword equals a datamap, string, array, or other "collection" data type, then you can access data values
						using the `its` variant - `(print: $red is 'egg' and its length is 3)` or `(set:$red to its 1st)`. Much like the `'s`
						operator, you can use computed values with `its` - `(if: $red's length is 3 and its $position is $value)` will work as
						expected.

						Added in: 1.0.0
					*/
					/*
						The "it" keyword is bound to whatever the last left-hand-side value
						in a comparison operation was. Since its scope is so ephemeral,
						it can just be a shared identifier right here.
					*/
					it: 0,

					/*d:
						time -> Number

						This keyword evaluates to the number of milliseconds passed since the passage
						was displayed. Its main purpose is to be used alongside changers
						such as (live:), (event:) or (link:). `(link:"Click")[(if: time > 5s)[...]]`, for instance,
						can be used to determine if 5 seconds have passed since this passage was displayed,
						and thus whether the player waited 5 seconds before clicking the link.

						It's recommended that you compare values of time using the `ms` or `s` suffixes for number data.
						See the article on number data for more information.

						When the passage is initially being rendered, `time` will be 0.

						`time` used in (display:) macros will still produce the time of the host passage, not the
						contained passage. So, you can't use it to determine how long the (display:)ed passage
						has been present in the host passage.

						Added in: 1.0.0
					*/
					/*
						The "time" keyword binds to the number of milliseconds since the passage
						was rendered.
				
						It might be something of a toss-up whether the "time" keyword should
						intuitively refer to the entire passage's lifetime, or just the nearest
						hook's. I believe that the passage is what's called for here.
					*/
					get time() {
						/*
							This can't be used during storylet speculation, for obvious reasons.
						*/
						if (ret.stackTop?.evaluateOnly) {
							return TwineError.create("operation", `'time' can't be used in ${ret.stackTop.evaluateOnly}.`);
						}
						return (Date.now() - ret.timestamp);
					},

					/*d:
						turns -> Number

						Also known as: turn

						This keyword (which can alternatively be written as "turn") evaluates to the number of turns that have occurred in this game. A "turn" is any movement to a
						passage, including movements back to the same passage, by passage links or by various (go-to:)-related macros.
						(redirect:) does not cause a new turn to occur, so using it will not increase this value.

						Much like the "visits" keyword, its main purpose is to be used with simple macros like (nth:) or (if:) to change what
						text is displayed, such as by `(if: turns > 7)`. It is also useful in (storylet:) lambdas, such as `(storylet: when turns > 7)`,
						for storylets that should only be available when a certain number of turns have elapsed.

						For testing purposes, it can be convenient to temporarily alter `turns`'s value, so as to recreate a
						certain game state. The (mock-turns:) macro, usable only in debug mode, lets you artificially increase the number
						that this evaluates to.

						Added in: 3.3.0
					*/
					get turns() {
						return State.turns;
					},

					get turn() {
						return State.turns;
					},

					/*d:
						visits -> Number

						Also known as: visit

						This keyword (which can alternatively be written as "visit") always equals the number of times
						the current passage has been visited this game, including the current visit.

						Much like the "turns" keyword, its main purpose is to be used in (if:) macros, such as `(if: visits is 1)`,
						or `(if: visits > 4)`. If you use one particular formulation a lot in your story, such as `(if: visits is 1)`, you can (set:) the (if:)
						into a variable using `(set: $first to (if:visits is 1))` and then use $first in its place, such as in
						`$first[You've discovered a new island.]`.

						Similarly, it is also useful with the (cond:) and (nth:) macros - the latter letting you simply use `visit`
						as its first value to vary the results based on the number of times the passage is visited.

						This can also be used to great effect in (storylet:) macros, such as `(storylet: when visits is 0)`, where it will always refer to the containing
						passage itself. When Harlowe decides whether this passage is available to (open-storylets:), this will often be 0, but when
						actually visiting the passage, it will be at least 1.

						`visits` used in (display:) macros will still produce the number of times the *host* passage was visited,
						not the contained passage. So, you can't use it to determine how many times the (display:)ed passage
						has been (display:)ed.

						Using (redirect:) to go to a passage will count as a "visit" for that passage, even though it doesn't start a new turn.

						For testing purposes, it can be convenient to temporarily alter `visits`'s value, so as to recreate a
						certain game state. The (mock-visits:) macro, usable only in debug mode, lets you increase the number of
						times certain passages have been "visited", so that this keyword produces higher numbers when in those passages.

						By default, Harlowe records an unlimited amount of passage visits. However, you can use the (forget-visits:) macro to
						make Harlowe "forget" visits that are a certain number of turns old.

						Added in: 3.1.0
					*/
					get visits() {
						const {stackTop:{speculativePassage}} = ret;
						const filter = name => name === (speculativePassage || State.passage);
						return State.history().filter(filter).length
							// Only add 1 (counting the current visit) if this isn't speculation, or the speculative passage equals State.passage (i.e. we're at that passage now).
							+ (!speculativePassage || speculativePassage === State.passage);
					},

					get visit() {
						return ret.Identifiers.visits;
					},

					/*d:
						exits -> Number

						Also known as: exit
						
						This keyword (which can alternatively be written as "exit") evaluates to the number of currently available "exits"
						in a passage - the number of link, mouseover, and mouseout elements that are active on the page, which could lead to new content and progress.

						This keyword is designed to be used with (live:) and (event:) - you can make a hook only
						be revealed when a certain number of exits are available, with `(event: when exits < 3)` and similar. The (more:) macro is a shorthand
						form for `(event: when exits is 0)`.

						The complete list of elements considered to be "exit" elements is as follows:
						* Links created by (link:), (link-repeat:), (link-reveal:), (link-goto:), (link-reveal-goto:), and (link-show:).
						* Passage links (which are the same as (link-goto:) links).
						* Links created by (click:), (click-replace:), (click-append:), (click-prepend:), and (click-goto:).
						* Mouseover areas created by (mouseover:), (mouseover-replace:), (mouseover-append:), (mouseover-prepend:), and (mouseover-goto:).
						* Mouseout areas created by (mouseout:), (mouseout-replace:), (mouseout-append:), (mouseout-prepend:), and (mouseout-goto:).

						Do note the following, however.
						* Multiple passage links that lead to the same passage (such as `[[A->Dead]] [[B->Dead]] [[C->Dead]]`) are all counted separately.
						* As of Harlowe 3.1.0, this does not consider (link-undo:) macros to be exits, as they tend to only undo game progress.
						* This will also not consider (event:) or (live:) macros to be exits, even if they are guaranteed to display their hooks
						eventually.
						* As with macros like (replace:), the `exits` keyword can't see forward to forthcoming elements, unless they've
						already appeared. For instance, the (print:) in `(print:exits is 1) [[Retreat->Hall]]` will show `false`, because the link after it
						hasn't appeared in the passage yet, but the (print:) in `(live:20s)[(print:exits is 1)] [[Retreat->Hall]]`
						will show `true`.
						* This can't be used in a (storylet:)'s lambda, because those lambdas are only checked when you're outside the passage.

						Finally, the "undo" and "redo" links in the sidebar will not be counted, either.

						Added in: 3.1.0
					*/
					get exits() {
						/*
							This can't be used during storylet speculation, for obvious reasons.
						*/
						if (ret.stackTop?.evaluateOnly) {
							return TwineError.create("operation", `'exit' and 'exits' can't be used in ${ret.stackTop.evaluateOnly}.`);
						}
						return ret.dom.find('tw-enchantment, tw-link')
							.filter((_,e) => {
								e = $(e);
								return e.data('enchantmentEvent') ||
									e.parent().data('linkPassageName')  ||
									/*
										Currently, (link:) <tw-link>s' parent <tw-hook>s have the clickEvent on them,
										which makes sense in the context of changeDescriptors (the link is created by
										replacing the <tw-hook>'s contents with the <tw-link> and giving the hook the
										clickEvent) but does feel a little #awkward.
									*/
									e.parent().data('clickEvent');
							})
							.length;
					},

					get exit() {
						return ret.Identifiers.exits;
					},

					/*d:
						pos -> Number

						Used exclusively in lambdas, this keyword evaluates to the position of the current data value that this lambda is processing.

						Consider a macro that uses lambdas, such as (altered:) - you give it a lambda, and then one or more data values, such as
						in `(altered: via it + (str:pos), "A","B","C")`. When the lambda is processing "A", the pos identifier is 1, for "B" it's 2, and for
						"C" it's 3. This can be used for a number of purposes. You can attach an ascending number to each data value, as in that example.
						You can make only odd-numbered values be altered by using `(cond: pos is an odd, it, it + (str:pos))` (which uses the "odd" datatype).
						You can make every third value be followed by a comma, by using `(cond: pos % 3 is 2, it, it + ',')`.

						Note that this only corresponds to the position of the values when given to the macro - if you use the `...` operator to spread arrays'
						values into a macro, such as `(find: where it is > pos, ...$array1, ...$array2, ...$array3)`, then values from $array2 and $array3 will not
						have a pos that corresponds to their placement inside those arrays, but rather relative to all of the values, including those in $array1.

						Make sure you do NOT write this as `its pos` - the pos is not a data value of the data itself! If `it` was `(dm:'HP',20,'XP',12)`, `its pos`
						would cause an error, as there is no "pos" value in that datamap.

						Using this anywhere other than a lambda, or using it in a 'when' lambda (which doesn't operate over a sequence of values), will cause an error.

						Added in: 3.1.0
					*/
					get pos() {
						if (!ret.stackTop || ret.stackTop.evaluateOnly || !ret.stackTop.lambdaPos) {
							return TwineError.create("operation", "'pos' can only be used in lambdas that aren't 'when' lambdas.");
						}
						/*
							This really, really should never be a non-number, but just in case...
						*/
						return +ret.stackTop.lambdaPos || 1;
					}
				},
			});
			return ret;
		},

		/*
			Lexer tokens, usually from <tw-expression> elements, are evaluated here.
		*/
		eval(args) {
			/*
				This sets up the debug-only evalReplay array, which records each step of the evaluation process
				for viewing when the player clicks the replay button. Runner checsk for the mere presence of this
				array, and populates it itself. Because of the number of varied eval() consumers out there,
				the replay data can't be succinctly included as a return value of this, but is instead
				left as a mutated property on this section.
			*/
			if (Utils.options.debug && Utils.options.evalReplay) {
				/*
					The initial code listing is the full text of all tokens.
				*/
				const code = Array.isArray(args) ? args.reduce((a,e) => a + e.text, '') : args.text || '';
				this.evalReplay = [{
					code,
					fromCode: code,
					/*
						Because tokens' starts and ends are in passage-wise coordinates,
						recording the passage-wise start of the first token allows Runner to
						convert them to expression-wise coordinates.
					*/
					basis:(Array.isArray(args) ? args[0] : args).start,
					start: 0,
					end: code.length,
					diff: 0,
				}];
			}
			let ret;
			try {
				ret = run(this, args);
			} catch(e) {
				window.console?.error(e);
				this.evalReplay = null;
				return TwineError.create('', `An internal error occurred while trying to run ${[].concat(args).map(e=>e.text).join('')}.`,
					`The error was "${e.message}".\nIf this is the latest version of Harlowe, please consider reporting a bug (see the documentation).`);
			}
			/*
				For replays with only two frames, remove the first "Once upon a time" frame.
			*/
			if (this.evalReplay && this.evalReplay.length === 2) {
				this.evalReplay.shift();
			}
			return ret;
		},

		/*
			This is an alias for the top of the expression stack, used mainly to access the "blocked"
			and "blockedValues" properties.
		*/
		get stackTop() {
			return this.stack[0];
		},
		
		/*
			A quick check to see if this section's DOM is connected to the story's DOM.
			Currently only used by runLiveHook().
		*/
		inDOM() {
			return Utils.storyElement.find(this.dom).length > 0;
		},
		
		/*
			This function allows an expression of TwineMarkup to be evaluated as data, and
			determine the content within it.
			This is currently only used by (link-goto:), to determine the link's passage name.
		*/
		evaluateTwineMarkup(expr, evalName) {
			/*
				The expression is rendered into this loose DOM element, which
				is then discarded after returning. Hopefully no leaks
				will arise from this.
			*/
			const p = $('<p>');
			
			/*
				Render the text, using this own section as the base (which makes sense,
				as the recipient of this function is usually a sub-expression within this section).
			
				No changers, etc. are capable of being applied here.
			*/
			this.stack.unshift({
				desc: ChangeDescriptor.create({ target: p, source: expr, section: this, append:"append" }),
				tempVariables: this.stackTop.tempVariables,
				/*
					This special string (containing the reason we're evaluating this markup)
					causes all command and changer values in the markup to become errors,
					and suppress all blockers. This forcibly prevents [[(set: $a to it+1)Beans]] from being
					written.
				*/
				evaluateOnly: evalName,
				finalIter: true,
			});
			this.execute();
			
			/*
				But first!! Pull out any errors that were generated.
				We return the plain <tw-error> elements in order to save re-creating
				them later in the pipeline, even though it makes the type signature of
				this function {String|jQuery} somewhat #awkward.
			*/
			let errors;
			if ((errors = p.find('tw-error')).length > 0) {
				return errors;
			}
			return p;
		},

		/*
			This is a counterpart to evaluateTwineMarkup(): instead of taking markup and executing it as HTML,
			this takes macro arguments and evaluates them in this section's context, in a separate stack frame which
			is discarded afterward (hence that it is "speculative" execution). As you can tell, this is
			used for (storylet:) and (metadata:) execution during startup and when running (open-storylets:).
		*/
		speculate(code, speculativePassage, evalName) {
			this.stack.unshift({
				/*
					As with evaluateTwineMarkup(), above, these two are used to suppress command, blocker and changer values, which
					should not appear in any code which needs to be evaluated speculatively.
				*/
				evaluateOnly: evalName,
				finalIter: true,
				/*
					A new tempVariables frame is created, solely to have a different TwineScript_VariableStore name, so that
					errors occurring during evaluation have the correct name for this context.
				*/
				tempVariables: assign(create(VarScope), { TwineScript_VariableStore: { type: 'temp', name:evalName, } }),
				/*
					This string is used by storylet metadata macros like (storylet: when visits is 0),
					which, when run via speculation by (open-storylets:), need "visits" to mean visits of
					their containing passage, and not the currently visited passage. And, when run normally,
					they need to return an unstorable object instead of their lambda's result.
				*/
				speculativePassage,
			});
			
			/*
				Cache the evalReplay of section, so that the speculative execution doesn't clobber it.
			*/
			const {evalReplay} = this;
			this.evalReplay = null;

			/*
				Passages can speculatively execute either code (that is, (metadata:) calls) or compiled lambdas
				(that is, when storylet lambdas are run.)
			*/
			let ret;
			if (Lambda.isPrototypeOf(code)) {
				ret = code.apply(this, {fail:false, pass:true});
			}
			else if (code) {
				ret = run(this, code);
			}
			/*
				Restore the state of this section before the execution.
			*/
			this.stack.shift();
			this.evalReplay = evalReplay;
			return ret;
		},
		
		/*
			Renders the given markup, or a lexed tree, into a given element,
			transitioning it in. A ChangerCommand can be provided to
			modify the ChangeDescriptor object that controls how the code
			is rendered.
			
			This is used primarily by Engine.showPassage() to render
			passage data into a fresh <tw-passage>, but is also used to
			render TwineMarkup into <tw-expression>s (by runExpression())
			and <tw-hook>s (by render() and runLiveHook()).
		*/
		renderInto(source, target, changer, tempVariables = null) {
			/*
				This is the ChangeDescriptor that defines this rendering.
			*/
			const desc = ChangeDescriptor.create({ target, source, section: this, append: "append"});
			
			/*
				Run the changer function, if given, on that descriptor.
			*/
			if (changer) {
				/*
					If a non-changer object (such as another descriptor) was passed in, assign its values,
					overwriting the default descriptor's.
					Honestly, having non-changer descriptor-altering objects
					is a bit displeasingly rough-n-ready, but it's convenient...
				*/
				if (!ChangerCommand.isPrototypeOf(changer)) {
					assign(desc, changer);
				}
				else {
					const error = changer.run(desc);
					if (TwineError.containsError(error)) {
						error.render(target.attr('title')).replaceAll(target);
						return false;
					}
				}
			}

			/*
				The changer may have altered the target - update the target variable to match.
			*/
			target = desc.target;
			
			/*
				Infinite regress can occur from a couple of causes: (display:) loops, or evaluation loops
				caused by something as simple as (set: $x to "$x")$x.
				So: bail if the stack length has now proceeded over 50 levels deep, ignoring extra iterations of the same for-loop.
			*/
			if (this.stack.length >= 50) {
				const depth = this.stack.reduce((a, {finalIter}) =>
					/*
						Ignore all iteration stack frames except for the final iteration. This permits (for:) (which
						needs all its stack frames put on at once due to some implementation kerfuffle involving flow blockers)
						to loop over 50+ elements without being a false positive.
					*/
					a + !!finalIter, 0);
				if (depth >= 50) {
					TwineError.create("infinite", "Printing this expression may have trapped me in an infinite loop.")
						.render(target.attr('title')).replaceAll(target);
					return false;
				}
			}

			const createStackFrame = (desc, tempVariables, finalIter) => {
				/*
					Special case for hooks inside existing collapsing syntax:
					their whitespace must collapse as well.
					(This may or may not change in a future version).
					
					Important note: this uses the **original** target, not desc.target,
					to determine if it's inside a <tw-collapsed>. This means that
					{(replace:?1)[  H  ]} will always collapse the affixed hook regardless of
					where the ?1 hook is.
				*/
				let collapses = (target instanceof $ && target.is('tw-hook')
							&& target.parents('tw-collapsed,[collapsing=true]').length > 0);
				this.stack.unshift({desc, finalIter, tempVariables, collapses, evaluateOnly: this.stackTop && this.stackTop.evaluateOnly });
			};

			/*
				If no temp variables store was created for the child stack frames of this render, create one now.
				Rather than a proper constructor, it is currently initialised in here.
			*/
			if (!tempVariables) {
				/*
					The temp variable scope of the rendered DOM inherits from the current
					stack, or, if absent, the base VarScope class.
				*/
				tempVariables = create(this.stack.length ?  this.stackTop.tempVariables : VarScope);
			}
			/*
				For debug mode, the temp variables store needs to also carry the name of its enclosing lexical scope.
				We derive this from the current target.

				(The target should always be truthy, but, just in case...)
			*/
			if (!hasOwnProperty.call(tempVariables,'TwineScript_VariableStore')) {
				const targetTag = target?.tag();
				tempVariables.TwineScript_VariableStore = {
					type: 'temp',
					name: (
						targetTag === 'tw-hook' ? (target.attr('name') ? ("?" + target.attr('name')) : "an unnamed hook") :
						targetTag === 'tw-expression' ? ("a " + target.attr('type') + " expression") :
						targetTag === 'tw-passage' ? "this passage" :
						"an unknown scope"
					)
				};
			}

			/*
				We need to check if the subsequent this.execute() call will block the stack - hence, here's a quick
				confirmation whether it is currently blocked beforehand.
			*/
			const isBlockedBefore = this.stackTop?.blocked;

			/*
				If the descriptor features a loopVar, we must loop - that is, render and execute once for
				each value in the loopVars, assigning the value to their temp. variable names in a new data stack per loop.

				For a loopVars such as {
					a: [1,2,3],
					b: [5,6],
				},
				the created tempVariables objects should be these two:
				{ a: 2, b: 6 }.
				{ a: 1, b: 5 },
			*/
			if (keys(desc.loopVars).length) {
				// Copy the loopVars, to avoid permuting the descriptor.
				const loopVars = assign({}, desc.loopVars);
				// Find the shortest loopVars array, and iterate that many times ()
				let len = Math.min(...keys(loopVars).map(name => loopVars[name].length));

				// A gentle debug notification to remind the writer how many loops the (for:) executed,
				// which is especially helpful if it's 0.
				TwineNotifier.create(len + " loop" + (len !== 1 ? "s" : "")).render().prependTo(target);

				/*jshint -W083 */
				if (len) {
					for(let i = len - 1; i >= 0; i -= 1) {
						/*
							All the stack frames need to be placed on the stack at once so that blocked flow (from (alert:))
							can resume seamlessly by just continuing to read from the stack.
						*/
						createStackFrame(desc,
							keys(loopVars).reduce((a,name) => {
								/*
									Successive execute() calls pop these stack frames in reverse order; hence, we must
									put them on in reverse order, too, using i's descending count.
								*/
								a[name] = loopVars[name][i];
								return a;
							}, create(tempVariables), i === len - 1)
						);
					}
					/*
						Having populated the stack frame with each individual loop variable, it's now time to
						run them, checking after each iteration to see if a flow control block was caused.
					*/
					for (let i = len - 1; i >= 0 && !this.stackTop.blocked; i -= 1) {
						this.execute();
					}
				}
			}
			/*
				Otherwise, just render and execute once normally.
			*/
			else {
				createStackFrame( desc, tempVariables, true);
				this.execute();
			}
			
			/*
				Finally, update the enchantments now that the DOM is modified.
				We should only run updateEnchantments in the "top level" render call,
				to save on unnecessary DOM mutation.
				This can be determined by just checking that this Section's stack is empty or blocked.
			*/
			if (this.stack.length === 0 || (!isBlockedBefore && this.stackTop?.blocked)) {
				this.updateEnchantments();
			}

			/*
				This return value is solely used by debug mode to colour <tw-expression>
				macros for (if:) in cases where it suppressed a hook.
			*/
			return desc.enabled;
		},

		/*
			This runs a single flow of execution throughout a freshly rendered DOM,
			replacing <tw-expression> and <tw-hook> elements that have "source"
			or "code" data with their renderings. It should be run whenever renderInto()
			creates new DOM elements, and whenever a blocker finishes and calls unblock().
		*/
		execute() {
			let {desc, dom, collapses, evaluateOnly} = this.stackTop;

			if (desc && !dom) {
				/*
					Run the changeDescriptor, and get all the newly rendered elements.
					Then, remove the desc from the stack frame and use the DOM from now on
					(which won't be very long unless a blocker appears).
					The reason the desc is stored in the stack at all is because of (for:) macros -
					it puts multiple frames on the stack at once, and it's memory-efficient to have
					a single descriptor for each of them rather than a pre-rendered DOM.
				*/
				dom = desc.render();

				this.stackTop.dom = dom;
				this.stackTop.desc = undefined;
			}
			/*
				Execute the expressions immediately.
			*/
			dom.findAndFilter('tw-hook,tw-expression,script[type="application/x-harlowe"]')
					/*
						For compatibility with 3.2, each expression's data is backed up as a DOM element expando property, in case they are removed from the DOM
						before running. This should be removed in 4.0, so that the more intuitive behaviour (removing from the DOM
						prevents expressions from running) is used instead.
					*/
					.each((_, expr) => {
						let d = $(expr).data();
						/*
							These should be the same 3 data values assigned to freshly-created elements in Renderer.
						*/
						expr.cachedData = {
							blockers: d.blockers,
							code: d.code,
							source: d.source,
						};
					})
					.each((_, expr) => {
				/*
					This is used to halt the loop if a hook contained a blocker - the call to renderInto()
					would've created another stack frame, which, being blocked, hasn't been removed yet.
					This needs to be at the start of the function, not the end, or else (output:)'s blocking
					won't work, for reasons I do not understand.
				*/
				if (this.stackTop.blocked) {
					return false;
				}
				/*
					Retrieve the backed-up jQuery data().
				*/
				let {cachedData} = expr;
				cachedData && (expr.cachedData = undefined);

				expr = $(expr);
				
				switch(expr.tag()) {
					case 'tw-hook':
					{
						/*
							Since hooks can be re-ran with (rerun:), their original content AST needs to be stored.
						*/
						let src = expr.popData('source') || cachedData?.source;
						if (src) {
							expr.data('originalSource', src);
						}
						/*
							Also, much as I'd prefer not to do this, the (show:) and (rerun:) macro needs to have access to any given <tw-hook>'s
							temp variables store, so that rerunning it will cause the correct temp variables to be used, rather than those
							available at the (show:) callsite.
						*/
						expr.data('tempVariables', this.stackTop.tempVariables);
						/*
							First, hidden hooks should not be rendered.
							The 'hidden' data value is used by (show:) and (link-show:). If it's a boolean, then it hasn't been shown (run) yet.
							If it's a jQuery, it has been shown, and its contents should be used instead of rendering.
						*/
						if (expr.popAttr('hidden')) {
							expr.data('hidden',true);
							break;
						}
						/*
							Now we can render visible hooks.
							Note that hook rendering may be triggered early by attached expressions, so a hook lacking 'content'
							data has probably already been rendered.
						*/
						if (src) {
							this.renderInto(src, expr);
						}
						break;
					}
					case 'tw-expression':
					{
						/*
							Control flow blockers are sub-expressions which, when evaluated, block control flow
							until some signal, such as user input, is provided, whereupon control
							flow proceeds as usual. These have been extracted from the main expressions by Renderer,
							and are run separately before the main expression.

							Because there are no other side-effect-on-evaluation expressions in Harlowe (as other state-changers
							like (loadgame:) are Commands, which only perform effects in passage prose), we can safely
							extract and run the blockers' code separately from the parent expression with peace of mind.

							Blocker expressions are identified by having 'blockers' data, which should persist across
							however many executions it takes for the passage to become unblocked.
						*/
						const blockers = expr.data('blockers') || cachedData?.blockers;
						if (blockers) {
							if (evaluateOnly) {
								expr.removeData('blockers').removeData('code').replaceWith(
									TwineError.create("syntax",
										`I can't use a macro like (prompt:) or (confirm:) in ${evaluateOnly}.`,
										"Please rewrite this without putting such macros here."
									).render(expr.attr('title'), expr)
								);
								return;
							}
							if (blockers.length) {
								/*
									The first blocker can now be taken out and run, which
									blocks this section and ends execution.

									The blocker's own macro call may cause this.stackTop to become a jQuery of the blocked
									element, so that events can still fire within it. Thus, this setting is only a special backup.
								*/
								this.stackTop.blocked = true;
								let error = this.eval(blockers.shift());
								/*
									If the blocker's code resulted in an error (such as a basic type signature error),
									this is the first occasion it'd become known. Display that error, if it is given,
									and unblock this section.
								*/
								if (TwineError.containsError(error)) {
									this.stackTop.blocked = false;
									expr.removeData('blockers').replaceWith(error.render(expr.attr('title'), expr));
								}
								return false;
							}
							else {
								expr.removeData('blockers');
							}
						}
						const code = expr.popData('code') || cachedData?.code;
						if (code) {
							runExpression.call(this, expr, code);
						}
						break;
					}
					case 'script':
					{
						/*
							So that jQuery and document.querySelector calls can access the entire DOM of the passage,
							the <tw-story> element is reattached early. This is a bit regrettable performance-wise,
							but it seems to be the only way to make these things work as expected.
						*/
						Utils.reattachStoryElement();

						/*
							Do nothing if there's no inner text (which would be the case if it has a [src]) attribute.
						*/
						if (!expr.text()) {
							break;
						}
						try {
							runScriptTag(expr.text(), this.stackTop.tempVariables);
						} catch(e) {
							/*
								runScriptTag can throw either TwineErrors (such as errors from VarRef.set())
								or plain JS errors.
							*/
							if (TwineError.isPrototypeOf(e)) {
								expr.replaceWith(e.render(expr.text(), expr));
							}
							else {
								window.console?.error(e);
								expr.replaceWith(
									TwineError.create('',
										`A Javascript error occurred while running this <script> element.`,
										`The error was "${e}". Check the browser console for more details.`
									).render(expr.text(), expr)
								);
							}
						}
					}
				}
			});

			/*
				If the section was blocked, then don't shift() the stack frame, but leave it until it's unblocked.
			*/
			if (this.stackTop.blocked) {
				return;
			}

			/*
				The collapsing syntax's effects are applied here, after all the expressions and sub-hooks have been
				fully rendered.
			*/
			if (dom.length && collapses) {
				collapse(dom);
			}
			dom.findAndFilter('tw-collapsed,[collapsing=true]').each(function() {
				collapse($(this));
			});

			/*
				Focus any <input> elements (from (input:) and (input-box:)) that were added to the page.
				Regrettably, this arbitrary timeout seems to be the only reliable way to focus the <input>.
			*/
			setTimeout(() => dom.find('input, textarea').first().focus(), 100);
			
			/*
				After evaluating the expressions, pop the passed-in data stack object (and its scope).
				Any macros that need to keep the stack object (mainly interaction and deferred rendering macros like
				(link:) and (event:)) have already stored it for themselves.
			*/
			this.stack.shift();
		},
		
		/*
			Updates all enchantments in the section. Should be called after every
			DOM manipulation within the section (such as, at the end of .render()).
		*/
		updateEnchantments() {
			this.enchantments.forEach((e) => {
				/*
					This first method removes old <tw-enchantment> elements...
				*/
				e.disenchant();
				/*
					...and this one adds new ones.
				*/
				e.enchantScope();
			});
		},

		/*
			This is used exclusively by Debug Mode to add the handlers for adding and removing enchantments.

			This is a static method shared by all Sections.
		*/
		on(event, fn) {
			eventHandlers[event].push(fn);
			return this;
		},

		addEnchantment(enchantment) {
			this.enchantments.push(enchantment);
			eventHandlers.add.forEach(fn => fn(this, enchantment));
		},

		removeEnchantment(enchantment) {
			const index = this.enchantments.indexOf(enchantment);
			this.enchantments.splice(index,1);
			enchantment.disenchant();
			eventHandlers.remove.forEach(fn => fn(this, enchantment));
		},

		/*
			Every control flow blocker macro needs to call section.unblock() with its return value (if any) when finished.
		*/
		unblock(value) {
			if (!this.stack.length) {
				Utils.impossible('Section.unblock', 'stack is empty');
			}
			this.stackTop.blocked = false;
			/*
				The value passed in is stored in the stack's blockedValues array, where it should
				be retrieved by other blockers, or the main expression, calling blockedValue().
				Only in rare circumstances (currently, just the (alert:) command) will no blocked value be passed in.
			*/
			if (value !== undefined) {
				this.stackTop.blockedValues = (this.stackTop.blockedValues || []).concat(value);
			}
			while (this.stack.length && !this.stackTop.blocked) {
				this.execute();
			}
			/*
				If the section became fully unblocked, it is time to run the "when unblocked"
				callbacks.
			*/
			if (!this.stack.length) {
				/*
					This is a "while" loop that uses .shift(), so that the state of
					this.unblockCallbacks remains valid after each iteration, in case another
					blockage occurs.
				*/
				while(this.unblockCallbacks.length > 0) {
					const callback = this.unblockCallbacks.shift();
					callback();
					/*
						If the callback caused the section to suddenly become blocked again, stop
						processing the callbacks.
					*/
					if (this.stackTop?.blocked) {
						return;
					}
				}
			}
		},

		/*
			Callbacks that need to be run ONLY when the section is unblocked (such as (live:) events, interaction
			element events, and (goto:)) are registered here. Or, if it's already unblocked, they're run immediately.

			immediateFn is a variation of fn used when the section is already unblocked. Currently (March 2022), only runLiveHook()
			uses it.
		*/
		whenUnblocked(fn, immediateFn) {
			if (!this.stack.length || !this.stackTop.blocked) {
				(immediateFn || fn)();
				return;
			}
			this.unblockCallbacks = this.unblockCallbacks.concat(fn);
		},

		/*
			Renderer permutes control flow blocker tokens into blockedValue tokens, which are compiled into
			blockedValue() calls. After the control flow blockers' code is run, the blockedValues array has been populated
			with the results of the blockers, and each call places them back into the parent expression.
		*/
		blockedValue() {
			const {stackTop} = this;
			if (!stackTop) {
				Utils.impossible('Section.blockedValue', 'stack is empty');
				return 0;
			}
			if (!stackTop.blockedValues || !stackTop.blockedValues.length) {
				Utils.impossible('Section.blockedValue', 'blockedValues is missing or empty');
				return 0;
			}
			return stackTop.blockedValues.shift();
		},

	};
	
	return Object.preventExtensions(Section);
});
