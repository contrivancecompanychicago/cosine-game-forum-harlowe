"use strict";
define([
	'jquery',
	'utils',
	'utils/selectors',
	'renderer',
	'twinescript/environ',
	'twinescript/operations',
	'state',
	'utils/operationutils',
	'datatypes/changercommand',
	'datatypes/hookset',
	'datatypes/colour',
	'internaltypes/changedescriptor',
	'internaltypes/varscope',
	'internaltypes/twineerror',
	'internaltypes/twinenotifier',
],
($, Utils, Selectors, Renderer, Environ, Operations, State, {printBuiltinValue,objectName}, ChangerCommand, HookSet, Colour, ChangeDescriptor, VarScope, TwineError, TwineNotifier) => {

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
			const enabled = this.renderInto(
				/*
					The use of popAttr prevents the hook from executing normally
					if it wasn't actually the eventual target of the changer function.
				*/
				nextHook.popAttr('source'),
				/*
					Don't forget: nextHook may actually be empty.
					This is acceptable - the result changer could alter the
					target appropriately.
				*/
				nextHook,
				result
			);

			if (!enabled) {
				const name = Utils.insensitiveName(expr.attr('name'));
				/*
					The 'false' class is used solely by debug mode to visually denote
					that a macro such as (if:) (but not (hidden:)) suppressed a hook.
				*/
				if (["if", "elseif", "unless", "else"].includes(name)) {
					expr.addClass("false");
					/*
						Unfortunately, (else-if:) must be special-cased, so that it doesn't affect
						lastHookShown, instead preserving the value of the original (if:).
					*/
					if (name !== "elseif") {
						this.stack[0].lastHookShown = false;
					}
				}
				/*
					If the changer command included a (live:) or (event:) command,
					set up the intervals to live-update the attached macro.
				*/
				if (nextHook.data('live')) {
					const {delay, event} = nextHook.data('live');
					runLiveHook.call(this, expr, nextHook, delay, event);
				}
				return;
			}
		}
		/*
			Attached false values hide hooks as well.
			This is special: as it prevents hooks from being run, an (else:)
			that follows this will pass.
		*/
		else if (result === false) {
			/*
				Just as in ChangeDescriptor.render(), suppressing a hook will move
				its source into a 'hiddenSource' data store.
			*/
			if (nextHook.attr('source')) {
				nextHook.data('hiddenSource', nextHook.popAttr('source'));
			}
			expr.addClass("false");
			
			this.stack[0].lastHookShown = false;
			return;
		}
		/*
			Any other values that aren't primitive true should result in runtime errors
			when attached to hooks.
		*/
		else if (result !== true) {
			expr.replaceWith(TwineError.create("datatype",
					objectName(result) + " cannot be attached to this hook.",
					"Only Booleans, changer commands, and the (live:) macro can be attached to hooks."
				).render(expr.attr('title')));
		}
		/*
			The (else:) and (elseif:) macros require a little bit of state to be
			saved after every hook interaction: whether or not the preceding hook
			was shown or hidden by the attached expression.
			Sadly, we must oblige with this overweening demand.
		*/
		this.stack[0].lastHookShown = true;
	}
	
	/*
		This function selects the next sibling element which isn't a whitespace text node,
		nor a <br>. It also returns the intervening whitespace.
	*/
	function nextNonWhitespace(e) {
		const {nextSibling} = (e instanceof $ ? e[0] : e);
		if (nextSibling &&
				((nextSibling instanceof Text && !nextSibling.textContent.trim())
				|| (nextSibling.tagName || '').toLowerCase() === "br")) {

			const { whitespace, nextElem } = nextNonWhitespace(nextSibling);
			return { whitespace: $(nextSibling).add(whitespace), nextElem };
		}
		return { whitespace: $(), nextElem: $(nextSibling) };
	}
	
	/*
		Run a newly rendered <tw-expression> element's code, obtain the resulting value,
		and apply it to the next <tw-hook> element, if present.
		
		@param {jQuery} The <tw-expression> to run.
	*/
	function runExpression(expr) {
		/*
			Execute the expression, and obtain its result value.
		*/
		let result = this.eval(expr.popAttr('js') || '');

		/*
			If this stack frame is being rendered in "evaluate only" mode (i.e. it's inside a link's passage name or somesuch)
			then it's only being rendered to quickly check what the resulting DOM looks like. As such, changers or commands which
			alter game state should not be run, and an error should be produced.
		*/
		if (this.stackTop.evaluateOnly && result && (ChangerCommand.isPrototypeOf(result) || typeof result.TwineScript_Run === "function")) {
			result = TwineError.create("syntax",
				"I can't work out what this "
				+ (this.stackTop.evaluateOnly)
				+ " should evaluate to, because it contains a "
				+ (ChangerCommand.isPrototypeOf(result)) ? "changer" : "command.",
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
			if (nextElem[0] instanceof Text && nextElem[0].textContent.trim() === "+") {
				/*
					Having found a +, we must confirm the non-ws element after it is an expression.
					If it is, we try to + it with the changer.
					(If it's a Hook Expression, this + will fail and neither it nor the changer will be executed)
				*/
				let whitespaceAfter, plusMark = nextElem;
				({whitespace:whitespaceAfter, nextElem} = nextNonWhitespace(plusMark));
				if (nextElem.is(Selectors.expression)) {
					/*
						It's an expression - we can join them.
						Add the expressions, and remove the interstitial + and whitespace.
					*/
					const nextValue = this.eval(nextElem.popAttr('js'));
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
								? "If you want to attach this changer to " + objectName(nextValue) + ", remove the + between them."
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
			if (nextElem.is(Selectors.expression)) {
				const nextValue = this.eval(nextElem.popAttr('js'));
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
					result = nextValue.TwineScript_Attach(result);
					break;
				}
				/*
					When the attachment can't happen, produce an error mentioning that only certain structures allow changers to attach.
					Again, potential confusion between attaching changers to commands and combining changers necessitates a special error
					message for this situation.
				*/
				else if (ChangerCommand.isPrototypeOf(nextValue)) {
					expr.replaceWith(TwineError.create("operation",
						"Changers like (" + result.macroName + ":) need to be combined using + between them.",
						"Place the + between the changer macros, or the variables holding them."
						+ " The + is absent only between a changer and its attached hook or command."
					).render(expr.attr('title')));
					return;
				}
				else {
					expr.replaceWith(TwineError.create("operation",
						objectName(nextValue) + " can't have changers like (" + result.macroName + ":) attached.",
						"Changers placed just before hooks, links and commands will attempt to attach, but in this case it didn't work."
					).render(expr.attr('title')));
					return;
				}
			}
			if (nextElem.is(Selectors.hook)) {
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
				"The (" + result.macroName + ":) changer should be stored in a variable or attached to a hook.",
				"Macros like this should appear to the left of a hook: " + macroCall + "[Some text]"
			).render(expr.attr('title')));
			return;
		}
		/*
			If the above loop wasn't entered at all (i.e. the result wasn't a changer) then an error may
			be called for. For now, obtain the next hook anyway.
		*/
		nextHook = nextHook.length ? nextHook : nextNonWhitespace(expr).nextElem.filter(Selectors.hook);

		/*
			Print any error that resulted.
			This must of course run after the sensor/changer function was run,
			in case that provided an error.
		*/
		let error;
		if ((error = TwineError.containsError(result))) {
			if (error instanceof Error) {
				error = TwineError.fromError(error);
			}
			expr.replaceWith(error.render(expr.attr('title'), expr));
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
				if (result.data && result.data.live) {
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
				If TwineScript_Run returns the string "blocked",
				then block control flow. This is usually caused by dialog macros like (alert:) or (confirm:),
				or interruption macros like (goto:).
			*/
			else if (result === "blocked") {
				this.stackTop.blocked = true;
				return;
			}
			else if (result) {
				Utils.impossible("Section.runExpression",
					"TwineScript_Run() returned a non-ChangeDescriptor " + typeof result + ': "' + result + '"');
			}
		}
		/*
			Print the expression if it's a string, number, data structure,
			or is some other data type without a TwineScript_Run().
		*/
		else if (
				/*
					If it's plain data, it shouldn't be attached to a hook.
					If it was attached, an error should be produced
					(by applyExpressionToHook) to clue the author into the correct attachable types.
				*/
				(!nextHook.length &&
				(typeof result === "string"
				|| typeof result === "number"
				|| result instanceof Map
				|| result instanceof Set
				|| Array.isArray(result)
				|| Colour.isPrototypeOf(result)))
				//  However, commands will cleanly "detach" without any error resulting.
				|| (result && typeof result.TwineScript_Print === "function" && !ChangerCommand.isPrototypeOf(result))) {
			/*
				TwineScript_Print(), when called by printBuiltinValue(), typically emits
				side-effects. These will occur... now.
			*/
			result = printBuiltinValue(result);
			/*
				Errors (which may be TwineErrors but could also be raw JS errors from try {} blocks)
				directly replace the element.
			*/
			if (TwineError.containsError(result)) {
				if (result instanceof Error) {
					result = TwineError.fromError(result);
				}
				expr.replaceWith(result.render(expr.attr('title')));
			}
			else if (typeof result !== "string") {
				Utils.impossible("printBuiltinValue() produced a non-string " + typeof result);
			}
			else {
				/*
					Transition the resulting Twine code into the expression's element.
				*/
				this.renderInto(result, expr);
			}
		}
		else if (nextHook.length) {
			applyExpressionToHook.call(this, expr, result, nextHook);
		}
		/*
			The only remaining values should be unattached changers, or booleans.
		*/
		else if (!(ChangerCommand.isPrototypeOf(result) || typeof result === "boolean")) {
			Utils.impossible('Section.runExpression', "The expression evaluated to an unknown value: " + result.toSource());
		}
	}
	
	/*
		This quick memoized feature test checks if the current platform supports Node#normalize().
	*/
	const supportsNormalize = (() => {
		let result;
		return () => {
			if (result !== undefined) {
				return result;
			}
			const p = $('<p>');
			/*
				If the method is absent, then...
			*/
			if (!p[0].normalize) {
				return (result = false);
			}
			/*
				There are two known normalize bugs: not normalising text ranges containing a hyphen,
				and not normalising blank text nodes. This attempts to discern both bugs.
			*/
			p.append(document.createTextNode("0-"),document.createTextNode("2"),document.createTextNode(""))
				[0].normalize();
			return (result = (p.contents().length === 1));
		};
	})();

	/*
		Both of these navigates up the tree to find the nearest text node outside this element,
		earlier or later in the document.
		These return an unwrapped Text node, not a jQuery.
	*/
	function prevParentTextNode(e) {
		const elem = e.first()[0],
			parent = e.parent();
		/*
			Quit early if there's no parent.
		*/
		if (!parent.length) {
			return null;
		}
		/*
			Get the parent's text nodes, and obtain only the last one which is
			earlier (or later, depending on positionBitmask) than this element.
		*/
		let textNodes = parent.textNodes().filter((e) => {
			const pos = e.compareDocumentPosition(elem);
			return pos & 4 && !(pos & 8);
		});
		textNodes = textNodes[textNodes.length-1];
		/*
			If no text nodes were found, look higher up the tree, to the grandparent.
		*/
		return !textNodes ? prevParentTextNode(parent) : textNodes;
	}
	
	function nextParentTextNode(e) {
		const elem = e.last()[0],
			parent = e.parent();
		/*
			Quit early if there's no parent.
		*/
		if (!parent.length) {
			return null;
		}
		/*
			Get the parent's text nodes, and obtain only the last one which is
			earlier (or later, depending on positionBitmask) than this element.
		*/
		const textNodes = parent.textNodes().filter((e) => {
			const pos = e.compareDocumentPosition(elem);
			return pos & 2 && !(pos & 8);
		})[0];
		/*
			If no text nodes were found, look higher up the tree, to the grandparent.
		*/
		return !textNodes ? nextParentTextNode(parent) : textNodes;
	}

	/*
		<tw-collapsed> elements should collapse whitespace inside them in a specific manner - only
		single spaces between non-whitespace should remain.
		This function performs this transformation by modifying the text nodes of the passed-in element.

		@param {jQuery} The element whose whitespace must collapse.
	*/
	function collapse(elem) {
		/*
			A .filter() callback which removes nodes inside a <tw-verbatim>,
			a replaced <tw-hook>, or a <tw-expression> element, unless it is also inside a
			<tw-collapsed> inside the <tw-expression>. Used to prevent text inside those
			elements from being truncated.
		*/
		function noVerbatim(e) {
			/*
				The (this || e) dealie is a kludge to support its use in a jQuery
				.filter() callback as well as a bare function.
			*/
			return $(this || e).parentsUntil('tw-collapsed')
				.filter('tw-verbatim, tw-expression, '
					/*
						Also, remove nodes that have collapsing=false on their parent elements,
						which is currently (June 2015) only used to denote hooks whose contents were (replace:)d from
						outside the collapsing syntax - e.g. {[]<1|}(replace:?1)[Good  golly!]
					*/
					+ '[collapsing=false]')
				.length === 0;
		}
		/*
			We need to keep track of what the previous and next exterior text nodes are,
			but only if they were also inside a <tw-collapsed>.
		*/
		let beforeNode = prevParentTextNode(elem);
		if (!$(beforeNode).parents('tw-collapsed').length) {
			beforeNode = null;
		}
		let afterNode = nextParentTextNode(elem);
		if (!$(afterNode).parents('tw-collapsed').length) {
			afterNode = null;
		}
		/*
			- If the node contains <br>, replace with a single space.
		*/
		elem.findAndFilter('br:not([data-raw])')
			.filter(noVerbatim)
			.replaceWith(document.createTextNode(" "));
		/*
			Having done that, we can now work on the element's nodes without concern for modifying the set.
		*/
		const nodes = elem.textNodes();
		
		/*
			This is part of an uncomfortable #kludge used to determine whether to
			retain a final space at the end, by checking how much was trimmed from
			the finalNode and lastVisibleNode.
		*/
		let finalSpaces = 0;
		
		nodes.reduce((prevNode, node) => {
			/*
				- If the node is inside a <tw-verbatim> or <tw-expression>, regard it as a solid Text node
				that cannot be split or permuted. We do this by returning a new, disconnected text node,
				and using that as prevNode in the next iteration.
			*/
			if (!noVerbatim(node)) {
				return document.createTextNode("A");
			}
			/*
				- If the node contains runs of whitespace, reduce all runs to single spaces.
				(This reduces nodes containing only whitespace to just a single space.)
			*/
			node.textContent = node.textContent.replace(/\s+/g,' ');
			/*
				- If the node begins with a space and previous node ended with whitespace or is empty, trim left.
				(This causes nodes containing only whitespace to be emptied.)
			*/
			if (node.textContent[0] === " "
					&& (!prevNode || !prevNode.textContent || prevNode.textContent.search(/\s$/) >-1)) {
				node.textContent = node.textContent.slice(1);
			}
			return node;
		}, beforeNode);
		/*
			- Trim the rightmost nodes up to the nearest visible node.
			In the case of { <b>A </b><i> </i> }, there are 3 text nodes that need to be trimmed.
			This uses [].every to iterate up until a point.
		*/
		[...nodes].reverse().every((node) => {
			if (!noVerbatim(node)) {
				return false;
			}
			// If this is the last visible node, merely trim it right, and return false;
			if (!node.textContent.match(/^\s*$/)) {
				node.textContent = node.textContent.replace(/\s+$/, (substr) => {
					finalSpaces += substr.length;
					return '';
				});
				return false;
			}
			// Otherwise, trim it down to 0, and set finalSpaces
			else {
				finalSpaces += node.textContent.length;
				node.textContent = "";
				return true;
			}
		});
		/*
			- If the afterNode is present, and the previous step removed whitespace, reinsert a single space.
			In the case of {|1>[B ]C} and {|1>[''B'' ]C}, the space inside ?1 before "C" should be retained.
		*/
		if (finalSpaces > 0 && afterNode) {
			nodes[nodes.length-1].textContent += " ";
		}
		/*
			Now that we're done, normalise the nodes.
			(But, certain browsers' Node#normalize may not work,
			in which case, don't bother at all.)
		*/
		elem[0] && supportsNormalize() && elem[0].normalize();
	}
	
	/*
		A live hook is one that has the (live:) macro attached.
		It repeatedly re-renders, allowing a passage to have "live" behaviour.
		
		The default delay for (live:), which is also used by (event:), is 20ms.

		This is exclusively called by runExpression().
	*/
	function runLiveHook(expr, target, delay = 20, event = undefined) {
		if (event) {
			Utils.assertMustHave(event, ["when"]);
		}
		/*
			Obtain the code of the hook that the (live:) or (event:) changer suppressed.
		*/
		const source = target.data('hiddenSource') || "";
		/*
			Similarly to the other delayed rendering macros like (link:) and (click:),
			this too must store the current stack tempVariables object, so that it can
			give the event access to the temp variables visible at render time.
		*/
		const [{tempVariables}] = this.stack;
		/*
			This closure runs every frame (that the section is unblocked) from now on, until
			the target hook is gone.
			The use of .bind() here is to save reinitialising the inner function on every call.
		*/
		const recursive = this.whenUnblocked.bind(this, () => {
			/*
				We must do an inDOM check here in case a different (live:) macro
				(or a (goto:) macro) caused this to leave the DOM between
				previous runs.
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
			const eventFired = (event && event.filter(this, [true], tempVariables));
			if (TwineError.containsError(eventFired)) {
				eventFired.render(expr.attr('title')).replaceAll(expr);
				return;
			}
			if (event && !eventFired[0]) {
				setTimeout(recursive, delay);
				return;
			}
			/*
				(live:) macros always render; (event:) macros only render once the event fired.
			*/
			this.renderInto(source, target, {append:'replace'});
			/*
				If the event DID fire, on the other hand, we should stop.
			*/
			if (eventFired) {
				return;
			}
			/*
				The (stop:) command causes the nearest (live:) command enclosing
				it to be stopped. Inside an (if:), it allows one-off live events to be coded.
				If a (stop:) is in the rendering target, we shan't continue running.
			*/
			if (target.find(Selectors.expression + "[name='stop']").length) {
				return;
			}
			/*
				Re-rendering will also cease if this section is removed from the DOM.
			*/
			if (!this.inDOM()) {
				return;
			}
			/*
				Otherwise, resume re-running.
			*/
			setTimeout(recursive, delay);
		});
		
		setTimeout(recursive, delay);
	}

	Section = {
		/*
			Creates a new Section which inherits from this one.
			Note: while all Sections use the methods on this Section prototype,
			there isn't really much call for a Section to delegate to its
			parent Section.
			
			@param {jQuery} The DOM that comprises this section.
			@return {Section} Object that inherits from this one.
		*/
		create(dom) {
			// Just some overweening type-checking.
			if(!(dom instanceof $ && dom.length === 1)) {
				Utils.impossible('Section.create','called with no DOM element');
			}
			
			/*
				Install all of the non-circular properties.
			*/
			let ret = Object.assign(Object.create(this), {
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
				dom: dom || Utils.storyElement,
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
					- blocked: Boolean (used by blockers)
					- blockedValues: Array (used by blockers)
					- evaluateOnly: String (used by evaluateTwineMarkup())
					- finalIter: Boolean (used for infinite loop checks)
					
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
					This string is used by storylet metadata macros like (storylet: when visits is 0),
					which, when run via speculation by (open-storylets:), need "visits" to mean visits of
					their containing passage, and not the currently visited passage. And, when run normally,
					they need to return an unstorable object instead of their lambda's result.
				*/
				speculativePassage: undefined,
			});
			
			/*
				Add a TwineScript environ and mix in its eval() method.
			*/
			ret = Environ(ret);
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
			A quick check to see if this section's DOM is connected to the
			story's DOM.
			Currently only used by recursiveSensor().
		*/
		inDOM() {
			return $(Utils.storyElement).find(this.dom).length > 0;
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
				desc: ChangeDescriptor.create({ target: p, source: expr, section: this}),
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
			Renders the given TwineMarkup code into a given element,
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
			const desc = ChangeDescriptor.create({ target, source, section: this});
			
			/*
				Run the changer function, if given, on that descriptor.
			*/
			if (changer) {
				/*
					If a non-changer object was passed in, assign its values,
					overwriting the default descriptor's.
					Honestly, having non-changer descriptor-altering objects
					is a bit displeasingly rough-n-ready, but it's convenient...
				*/
				if (!ChangerCommand.isPrototypeOf(changer)) {
					Object.assign(desc, changer);
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
				let collapses = (target instanceof $ && target.is(Selectors.hook)
							&& target.parents('tw-collapsed').length > 0);

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
				tempVariables = Object.create(this.stack.length ?  this.stackTop.tempVariables : VarScope);
				/*
					For debug mode, the temp variables store needs to also carry the name of its enclosing lexical scope.
					We derive this from the current target.

					(The target should always be truthy, but, just in case...)
				*/
				const targetTag = target && target.tag();
				tempVariables.TwineScript_VariableStoreName = (
					targetTag === Selectors.hook ? (target.attr('name') ? ("?" + target.attr('name')) : "an unnamed hook") :
					targetTag === Selectors.expression ? ("a " + target.attr('type') + " expression") :
					targetTag === Selectors.passage ? "this passage" :
					"an unknown scope"
				);
			}

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
			if (Object.keys(desc.loopVars).length) {
				// Copy the loopVars, to avoid permuting the descriptor.
				const loopVars = Object.assign({}, desc.loopVars);
				// Find the shortest loopVars array, and iterate that many times ()
				let len = Math.min(...Object.keys(loopVars).map(name => loopVars[name].length));

				// A gentle debug notification to remind the writer how many loops the (for:) executed,
				// which is especially helpful if it's 0.
				/*if (Engine.options.debug) {
					TwineNotifier.create(len + " loop" + (len !== 1 ? "s" : "")).render().prependTo(target);
				}*/

				/*jshint -W083 */
				if (len) {
					for(let i = len - 1; i >= 0; i -= 1) {
						/*
							All the stack frames need to be placed on the stack at once so that blocked flow (from (alert:))
							can resume seamlessly by just continuing to read from the stack.
						*/
						createStackFrame(desc,
							Object.keys(loopVars).reduce((a,name) => {
								/*
									Successive execute() calls pop these stack frames in reverse order; hence, we must
									put them on in reverse order, too, using i's descending count.
								*/
								a[name] = loopVars[name][i];
								return a;
							}, Object.create(tempVariables), i === len - 1)
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
				This can be determined by just checking that this Section's stack is empty.
			*/
			if (this.stack.length === 0) {
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
			replacing <tw-expression> and <tw-hook> elements that have latent [source]
			or [js] attributes with their renderings. It should be run whenever renderInto()
			creates new DOM elements, and whenever a blocker finishes and calls unblock().
		*/
		execute() {
			let [{desc, dom, collapses, evaluateOnly}] = this.stack;

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
				This provides (sigh) a reference to this object usable by the
				inner function, below.
			*/
			const section = this;

			/*
				Execute the expressions immediately.
			*/
			dom.findAndFilter(Selectors.hook + ',' + Selectors.expression)
					.each(function() {
				const expr = $(this);
				
				switch(expr.tag()) {
					case Selectors.hook:
					{
						/*
							First, hidden hooks should not be rendered, and instead stash
							their source as "hiddenSource" data for macros to activate
							later.
						*/
						if (expr.attr('hidden')) {
							expr.removeAttr('hidden');
							expr.data('hiddenSource', expr.popAttr('source'));
						}
						/*
							Now we can render visible hooks.
							Note that hook rendering may be triggered early by attached
							expressions, so a hook lacking a 'source' attr may have
							already been rendered.
						*/
						if (expr.attr('source')) {
							section.renderInto(expr.popAttr('source'), expr);
						}
						break;
					}
					case Selectors.expression:
					{
						/*
							Control flow blockers are sub-expressions which, when evaluated, block control flow
							until some signal, such as user input, is provided, whereupon control
							flow proceeds as usual. These have been extracted from the main expressions by Renderer,
							and are run separately before the main expression.

							Because there are no other side-effect-on-evaluation expressions in Harlowe (as other state-changers
							like (loadgame:) are Commands, which only perform effects in passage prose), we can safely
							extract and run the blockers' code separately from the parent expression with peace of mind.
						*/
						if (expr.attr('blockers')) {
							if (evaluateOnly) {
								expr.removeAttr('blockers').removeAttr('js').replaceWith(
									TwineError.create("syntax",
										"I can't use a macro like (prompt:) or (confirm:) in " + evaluateOnly + ".",
										"Please rewrite this without putting such macros here."
									).render(expr.attr('title'), expr)
								);
								return;
							}
							/*
								Convert the blockers attribute into a JS array, so that each blocker code string
								can be cleanly shift()ed from it after the previous was unblocked.
							*/
							let blockers = [];
							try {
								blockers = JSON.parse(expr.popAttr('blockers'));
								/*
									Reinsert the blockers array as element data.
								*/
								expr.data('blockers', blockers);
							} catch(e) {
								Utils.impossible('Section.execute', 'JSON.parse blockers failed.');
							}
						}
						/*
							Blocker expressions are identified by having 'blockers' data, which should persist across
							however many executions it takes for the passage to become unblocked.
						*/
						if (expr.data('blockers')) {
							const blockers = expr.data('blockers');
							if (blockers.length) {
								/*
									The first blocker can now be taken out and run, which
									blocks this section and ends execution.
								*/
								section.stackTop.blocked = true;
								let error = section.eval(blockers.shift());
								/*
									If the blocker's code resulted in an error (such as a basic type signature error),
									this is the first occasion it'd become known. Display that error, if it is given,
									and unblock this section.
								*/
								if (TwineError.containsError(error)) {
									section.stackTop.blocked = false;
									expr.removeData('blockers').replaceWith(error.render(expr.attr('title'), expr));
								}
								return false;
							}
							else {
								expr.removeData('blockers');
							}
						}
						if (expr.attr('js')) {
							runExpression.call(section, expr);
						}
					}
					/*
						This is used to halt the loop if a hook contained a blocker - the call to renderInto()
						would've created another stack frame, which, being blocked, hasn't been removed yet.
					*/
					if (section.stackTop.blocked) {
						return false;
					}
				}
			});

			/*
				If the section was blocked, then don't shift() the stack frame, but leave it until it's unblocked.
			*/
			if (section.stackTop.blocked) {
				return;
			}

			/*
				The collapsing syntax's effects are applied here, after all the expressions and sub-hooks have been
				fully rendered.
			*/
			if (dom.length && collapses) {
				collapse(dom);
			}
			
			dom.findAndFilter(Selectors.collapsed).each(function() {
				collapse($(this));
			});
			
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
					if (this.stackTop.blocked) {
						return;
					}
				}
			}
		},

		/*
			Callbacks that need to be run ONLY when the section is unblocked (such as (live:) events, interaction
			element events, and (goto:)) are registered here. Or, if it's already unblocked, they're run immediately.
		*/
		whenUnblocked(fn) {
			if (!this.stack.length || !this.stackTop.blocked) {
				fn();
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
			}
			if (!stackTop.blockedValues || !stackTop.blockedValues.length) {
				Utils.impossible('Section.blockedValue', 'blockedValues is missing or empty');
			}
			return stackTop.blockedValues.shift();
		},

	};
	
	return Object.preventExtensions(Section);
});
