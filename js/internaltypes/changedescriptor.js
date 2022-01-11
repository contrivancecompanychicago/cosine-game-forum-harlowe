"use strict";
define(['jquery', 'utils', 'renderer', 'datatypes/hookset'], ($, {impossible, transitionIn}, {exec}, HookSet) => {
	const {assign,keys,create,seal} = Object;
	/*
		When a new Section (generally a hook or expression) is about to be rendered,
		a ChangeDescriptor is created and fed into all of the ChangerCommands which are
		attached to the Section. They mutate the ChangeDescriptor, and the result describes
		all of the changes that must be made to the Section on rendering.
	*/

	/*
		A quick helper function which converts "verbatim" hooks' source into text nodes, EXCEPT newlines, which become raw <br>s
		or <tw-consecutive-br>s. Returns an array designed for use with $().
	*/
	const verbatim = (source) =>
		(typeof source === "string" ? source : source.map(e => e.text).join('')).split(/\n/g).reduce((a,e,i,{length}) =>
			// Even though this can result in the final array having a terminating false, $() will trim it out automatically.
			a.concat(document.createTextNode(e), i !== length - 1 && document.createElement(e.length ? 'br' : 'tw-consecutive-br')), []);

	const ChangeDescriptor = {
		
		// A ChangeDescriptor is a TwineScript internal object with the following values:
		
		// {String} source            The hook's source (either an array of lexed tokens, or a string), which can be finagled before it is run.
		source:            "",

		// {Array} appendSource       Used by (append-with:), these are {source,append} objects to apply to the source at render time.
		appendSource:      null,
		
		// {Boolean} enabled          Whether or not this code is enabled. (Disabled code won't be used until something enables it).
		enabled:          true,

		// {Array} [enablers]         Used by (link:) and its ilk, these are {descriptor, changer} objects used to create and style the link element that
		//                            delays the displays of this hook. Each enabler should create an element that removes the CD from this array when activated.
		enablers:          null,

		// {Boolean} verbatim         Whether to render the source at all, or display it verbatim.
		verbatim:         false,
		
		// {jQuery|HookSet} target    Where to render the source, if not the hookElement.
		target:           null,
		
		// {String} append            Which jQuery method name to append the source to the dest with. Empty if the descriptor is merely enchanting text.
		append:           "",

		// [newTargets]               Alternative targets (which are {target,append} objects) to use instead of the original.
		newTargets:       null,
		
		// {String} [transition]      Which built-in transition to use.
		transition:       "",
		
		// {Number} [transitionTime]  The duration of the transition, in ms, or null if the default speed should be used.
		transitionTime:   null,

		// {Boolean} [transitionDeferred]  Whether or not the transition given above should not be used, but saved for an interaction element
		//                                 that reuses this ChangeDescriptor, such as a (link:). This replaces the transition with "instant"
		//                                 but leaves the "transition" value untouched.
		transitionDeferred: false,

		// {Number} [transitionDelay]     The duration, in ms, to delay the start of the transition.
		transitionDelay:   0,

		// {Number} [transitionSkip]  If a keyboard key or mouse button is held down, skip this many milliseconds in the transition.
		transitionSkip:   0,

		// {Function|String} [transitionOrigin] A jQuery .css()-compatible property that makes a "transform-origin" value for this element as it transitions.
		transitionOrigin: null,

		// {Object} [loopVars]        An object of {temp variable : values array} pairs, which the source should loop over.
		//                            Used only by (for:)
		loopVars:         null,
		
		// {Array} [styles]           A set of CSS styles to apply inline to the hook's element.
		styles:           null,
		
		// {Array} [attr]             Array of objects of attributes to apply to the <tw-expression> using $.fn.attr().
		//                            Some attributes' values can be functions that reference existing values. Therefore,
		//                            rather than a single object, this must be an array of objects.
		//                            Used by (hook:) and (css:).
		attr:             null,
		
		// {Object} [data]            Data to attach to the <tw-hook> (NOT the <tw-expression>) using $.fn.data().
		//                            Used only by (link:), (live:) and (event:).
		data:             null,

		// {Object} [innerEnchantments] Functions which add enchantments that are specific to the hook.
		//                              Because of a circular dependency, they call addEnchantment themselves. Used only by (enchant-in:) and its ilk.
		innerEnchantments:  null,
		
		// {Object} [section]         A Section that 'owns' this ChangeDescriptor.
		section:          null,

		// {Number} timestamp         Used by certain time-specific characteristics of this descriptor (currently, just transitions).
		timestamp:           0,

		// {Boolean} output           Used by (out:), it prevents the attached hook from being run inside the custom macro (rather than outside).
		output:            false,
		
		/*
			This method produces a short list of properties this descriptor has, which were altered by the changers
			run against it (or supplied to it at creation).
			It's used by (hover-style:) to ensure that the changers it receives only affect styles.
		*/
		summary() {
			return [
				"source", "appendSource", "enabled", "verbatim", "target", "append", "newTargets",
				"transition", "transitionTime", "transitionDeferred", "transitionDelay",
				"transitionSkip", "transitionOrigin", "innerEnchantments", "enablers", "output",
			]
			.filter(e => this.hasOwnProperty(e))
			.concat([
				this.attr.length && "attr",
				this.styles.length && "styles",
				keys(this.loopVars).length && "loopVars",
				keys(this.data).length && "data",
			].filter(Boolean));
		},

		/*
			This creates an inheriting ChangeDescriptor, and is basically
			another shorthand for the old create-assign pattern.
			ChangeDescriptors can delegate to earlier descriptors if need be.
			Passed-in properties can be added to the descriptor, and a single
			(presumably composed) ChangerCommand as well.
		*/
		create(properties, changer) {
			/*
				Of course, we can't inherit array contents from the prototype chain,
				so we have to copy the arrays.
			*/
			const ret = assign(create(this), {
					attr:          !this.attr ? []   : this.attr.slice(),
					styles:        !this.styles ? [] : this.styles.slice(),
					loopVars:      this.loopVars || {},
					data:          this.data     || {},
				}, properties);
			/*
				If a ChangerCommand was passed in, run it.
			*/
			if (changer) {
				changer.run(ret);
			}
			return ret;
		},
		
		/*
			This method applies the style/attribute/data entries of this descriptor
			to the target HTML element.
		*/
		update() {
			const {section, newTargets, transition, transitionDeferred, append} = this;
			let {target} = this;
			/*
				If this is an enabler descriptor (such as created by (link:)) it's possible the target property was a method deferring the retrieval
				of the actual target, as a necessity for being attached to commands like (icon-undo:). Resolve that method now.
			*/
			if (typeof target === "function") {
				target = target();
			}
			
			/*
				This loop iterates over every DOM element that the target
				ultimately includes.
			*/
			const forEachTarget = (elem) => {
				/*
					Apply the style attributes to the element.
				*/
				if (Array.isArray(this.styles) && this.styles.length > 0) {
					/*
						Some styles can be applied right away - these are string properties
						of the styles objects (for instance, "condense" is {"letter-spacing": "-0.08em"}).
						Others depend on the pre-existing CSS to calculate their values (for instance,
						"blurrier" converts the dominant text colour into a text shadow colour,
						changing the text itself to transparent.) These must be applied afterward,
						as they depend on probing the current styles with .css().
					*/
					const [independent, dependent] = this.styles.reduce((a, style) => {
						/*
							Dependent styles are function properties of the styles objects,
							and this loop sifts through to separate them from independent styles.
						*/
						keys(style).forEach(k => {
							const v = style[k];
							a[+(typeof v === "function")].push({[k]:v});
						});
						return a;
					}, [[],[]]);
					/*
						Now, the independent CSS can be applied immediately.
					*/
					independent.forEach(e => elem.css(e));
					/*
						If the user has complicated story CSS, it's not possible
						to determine the computed CSS of an element until it's connected to the
						DOM. So, now this .css call is deferred for 1 frame, which should
						(._.) be enough time for it to become attached.
					*/
					setTimeout(() => {
						dependent.forEach(e => elem.css(e));
					});
				}
				/*
					If HTML attributes were included in the changeDescriptor, apply them now.
				*/
				if (this.attr) {
					this.attr.forEach(e => elem.attr(e));
				}
				/*
					Same with jQuery data (such as functions to call in event of, say, clicking).
				*/
				if (this.data) {
					elem.data(this.data);
				}
			};

			/*
				forEachTarget should be run on every target element, be there a set or a single one.
				As in render(), the newTargets should be used instead of the original if present.
			*/
			if (Array.isArray(newTargets) && newTargets.length) {
				target = newTargets.map(t => t.target);
			}

			if (Array.isArray(target)) {
				for (let i = 0; i < target.length; i += 1) {
					HookSet.isPrototypeOf(target[i]) ? target[i].forEach(section, forEachTarget) :
						/*
							It's OK for length>1 jQuery collections to be treated as single
							elements here, because the methods called on them (data(), attr(), css())
							work regardless of number of contained elements.
						*/
						forEachTarget(target[i]);
				}
			} else {
				HookSet.isPrototypeOf(target) ? target.forEach(section, forEachTarget) : forEachTarget(target);
			}

			/*
				If this isn't a descriptor that's appending/replacing code, a new transition has
				been installed on this existing hook.
				Transition it using this descriptor's given transition, if it wasn't deferred (i.e. behind a link).
			*/
			if (transition && !transitionDeferred && !append) {
				/*
					Hooks should only animate if they're appearing in the passage for the first time. To determine
					this, find the nearest parent with a timestamp (installed by render() below) and compare that
					to the current time.
				*/
				let stamped = target, ts;
				do {
					ts = stamped.data('timestamp');
					(!ts) && (stamped = stamped.parent());
				}
				while (!ts && stamped.length);
				transitionIn(target, transition, this.transitionTime, this.transitionDelay, this.transitionSkip,
					/*
						This delta expedites the animation - if it's expedited past its natural end,
						it's as if it isn't re-animated (which it shouldn't).
					*/
					ts ? Date.now() - ts : 0,
					this.transitionOrigin
				);
			}
		},
		
		/*
			This method renders TwineMarkup, executing the expressions
			within. The expressions only have visibility within this passage.
			
			@return {jQuery} The rendered passage DOM.
		*/
		render() {
			const
				{source, transition, transitionTime, transitionDeferred, enabled, enablers, data, section, newTargets, innerEnchantments, appendSource, output} = this;
			let
				{target, target:oldTarget, append} = this;

			/*
				If this is an enabler descriptor (such as created by (link:)) it's possible the target property was a method deferring the retrieval
				of the actual target, as a necessity for being attached to commands like (icon-undo:). Resolve that method now.
			*/
			if (typeof target === "function") {
				target = target();
			}

			if (!append) {
				impossible("ChangeDescriptor.render", "This doesn't have an 'append' method chosen.");
				return $();
			}

			/*
				If this is an (out:) changer, don't run this at all yet. (Wait until this CD has been outputted from the custom macro,
				whereupon this boolean is set to false).
			*/
			if (output) {
				return $();
			}

			/*
				Overriding all other aspects of this CD are the enablers, which create alternative elements in this CD's place. This overrides even (if:).
			*/
			if (enablers && enablers.length) {
				const {descriptor, changer} = enablers[0];
				const createdElement = descriptor.render();
				/*
					Enablers come with a changer to apply directly to the newly-rendered link element. This is applied
					using the following slightly crude construction, similar to how Enchantment enchants a scope.
				*/
				if (changer) {
					const cd = ChangeDescriptor.create({ section, target:createdElement });
					changer.run(cd);
					cd.update();
				}
				return createdElement;
			}

			/*
				If this isn't enabled, nothing needs to be rendered. However,
				the source needs to be saved in case the (show:) or (rerun:) macro is used on this.
				We store it as "originalSource" in every element's jQuery data store.
			*/
			if (!enabled || (target.attr('hidden') !== undefined)) {
				/*
					You may wonder if this should use the descriptor's 'innerSource', which is used by
					(link:) to store the "inner" source behind the link's <tw-link> source. What should
					happen is that when the hidden hook is shown, the link's <tw-link> is shown, which then
					remains clickable and able to reveal the innerSource.

					Also, this should not use newTargets, as a construction of the form "(hide:)(replace:?b)|a>[]"
					followed by (show:?a) should result in ?a appearing, instead of nothing happening. (And
					(show:?b) shouldn't do anything, either.)
				*/
				ChangeDescriptor.create({target,
					/*
						In the hidden hook, preserve HTML attributes (which includes 'name') but exclude 'style'.
					*/
					attr: this.attr.filter(e => !('style' in e)),
					data: assign({}, data, {originalSource:source, hidden:true})}).update();
				return $();
			}

			/*
				newTargets are targets specified by revision macros (such as ?foo in (replace:?foo))
				which should be used instead of the original.
			*/
			if (Array.isArray(newTargets) && newTargets.length) {
				target = newTargets;
			}
			/*
				If there's no target (after modifying newTargets), something incorrect has transpired.
			*/
			if (!target) {
				impossible("ChangeDescriptor.render",
					"ChangeDescriptor has source but not a target!");
				return $();
			}
			/*
				For "collection" targets (a HookSet, newTarget array, or a length>1 jQuery), each target must be rendered separately,
				by performing recursive render() calls. Then, return a jQuery containing every created element,
				so that consumers like Section.renderInto() can modify all of their <tw-expressions>, etc.
			*/
			let dom = $();
			[].concat(target)
				// If the target is a jQuery, it's either just a normal ChangeDescriptor targeting a single hook, or
				// a recursive call of the below collection rendering loop. If so, don't keep recursing.
				.filter(target => !(target.jquery))
				// Henceforth, all elements in this array are either HookSets, or NewTarget objects (containing HookSets).
				// Convert both of these types to the same type of object: a pair of { elements, append };
				.map(target => {
					let append_ = append, before;
					// Is it a newTarget object? If so, unwrap it to access the HookSet within,
					// as well as its "append" and "before" constraints.
					if (target.target && target.append) {
						({append:append_, before} = target);
						target = target.target;
					}
					return {
						// The following is the only call to HookSet.hooks() in Harlowe.
						elements: target.hooks(section, oldTarget)
							.filter(function() {
								/*
									"before" should only be true if this newTarget was created by
									(replace:), (append:) or (prepend:).
									These macros are scoped to only target hooks and text that
									has already rendered - earlier in the passage or section to
									this changed hook (i.e. the element in oldTarget).
								*/
								return !(before
									/*
										Of course, we should only prevent targeting elements that *haven't rendered yet*.
										There isn't a very idiomatic way of determining this, but assuming that it's
										A: detached from the DOM,
									*/
									&& this.compareDocumentPosition(document) & 1
									/*
										and B: later in the node tree, seems a safe enough assumption.
									*/
									&& this.compareDocumentPosition(oldTarget[0]) & 2);
							}),
						append:append_,
					};
				},[])
				// Now, iterate over all of them.
				.forEach(({elements, append}) => {
					elements.each((_,elem) => {
						elem = $(elem);
						/*
							Generate a new descriptor which has the same properties
							(rather, delegates to the old one via the prototype chain)
							but has just this hook/word as its target.
							Then, render using that descriptor.
						*/
						dom = dom.add(this.create({ target: elem, append, newTargets:null }).render());
						/*
							The above call to .hooks() potentially created <tw-pseudo-hook> elements. If this is one
							of them, remove it.
						*/
						elem.filter('tw-pseudo-hook').contents().unwrap();
					});
				});
			/*
				Return the compiled DOM, or return an empty set if the target is a collection
				and the above loop didn't produce anything.
			*/
			if (dom.length || Array.isArray(target) || HookSet.isPrototypeOf(target)) {
				return dom;
			}
			/*
				Henceforth, the target is a single jQuery.
			*/

			/*
				Check to see that the given jQuery method in the descriptor
				actually exists, and potentially tweak the name if it does not.
			*/
			if (!(append in target)) {
				/*
					(replace:) should actually replace the interior of the hook with the
					content, not replace the hook itself (which is what .replaceWith() does).
					So, we need to do .empty() beforehand, then change the method to "append"
					(though "prepend" will work too).
				*/
				if (append === "replace") {
					/*
						There's one exception to the above, however - if the target is a text node
						(such as in (enchant:?hook's chars)) then replaceWith is fine.
					*/
					if (target[0] instanceof Text) {
						append = "replaceWith";
					}
					else {
						target.empty();
						append = "append";
					}
				}
				/*
					If I wished to add a variant of (replace:) that did remove the entire
					hook, then I'd change append to "replaceWith".
				*/
				else {
					impossible("ChangeDescriptor.render", "The target doesn't have a '" + append + "' method.");
					return $();
				}
			}
			/*
				Two more tweaks to the jQuery method name are needed for text nodes,
				in addition to the above.
			*/
			if (target[0] instanceof Text) {
				if (append === "append") {
					append = "after";
				}
				if (append === "prepend") {
					append = "before";
				}
			}
			/*
				Render the TwineMarkup source into a HTML DOM structure.
				
				You may notice that the design of this and renderInto() means
				that, when a HookSet has multiple targets, each target has
				its own distinct rendering of the same TwineMarkup.
				
				(Note: source may be '' if the descriptor's append method is "remove".
				In which case, let it be an empty set.)
				
				Notice also that the entire expression is wrapped in $():
				a jQuery must be returned by this method, and $(false)
				conveniently evaluates to $(). Otherwise, it converts the
				array returned by $.parseHTML into a jQuery (unless, of course,
				this has been changed with (verbatim:))
				
				This has to be run as close to insertion as possible because of
				the possibility of <script> elements being present - 
				$.parseHTML executes scripts immediately on encountering them (if
				the third arg is true) and it wouldn't do to execute them and then
				early-exit from this method.
			*/
			
			dom = $(source &&
				(this.verbatim ? verbatim(source) : exec(source)));

			/*
				If the source has any addenda, compile that separately and insert it into the DOM structure.
				Note that by compiling it separately, partial structures in one addenda can't contaminate the original source.
			*/
			if (Array.isArray(appendSource)) {
				appendSource.forEach(({source, append}) => {
					const addenda = $(this.verbatim ? verbatim(source) : exec(source));
					if (append === "append") {
						dom = dom.add(addenda);
					}
					else if (append === "prepend") {
						dom = addenda.add(dom);
					}
					else {
						dom = addenda;
					}
				});
			}

			/*
				Now, insert the DOM structure into the target element.
				
				Here are the reasons why the DOM must be connected to the target before the
				expressions are evaluated:
				
				* Various Twine macros perform DOM operations on this pre-inserted jQuery set of
				rendered elements, but assume that all the elements have a parent item, so that e.g.
				.insertBefore() can be performed on them.
				
				* Also, and perhaps more saliently, the next block uses .find() to select
				<tw-macro> elements etc., which assumes that the jQuery object has a single
				container element at its "root level".
				
				* Finally, sensor macros' interval functions deactivate themselves if the
				section is disconnected from Utils.storyElement, and if they initially
				run without being connected, they will immediately deactivate.
			*/
			target[append](
				// As mentioned above, dom may be empty if append is "remove".
				dom.length ? dom : undefined
			);
			/*
				This timestamp is used exclusively for transition enchantments, to determine whether
				to re-animate the hook enchanted by it.
			*/
			target.data('timestamp', Date.now());
			/*
				Apply the style/data/attr attributes to the target element.
			*/
			this.update();
			
			/*
				Transition it using this descriptor's given transition, if it wasn't deferred
				Note that this.update() won't perform transitionIn because append must be non-falsy here.
			*/
			if (transition && !transitionDeferred) {
				transitionIn(
					/*
						There's a slight problem: when we want to replace the
						target, we don't need to apply a transition to every
						element, so we just transition the target itself.
						
						But, when we're *appending* to the target, we don't want
						the existing material in it to be transitioned, so
						then we must resort to transitioning every element.
						
						This is #awkward, I know...
					*/
					append === "replace" ? target : dom,
					transition, transitionTime, this.transitionDelay, this.transitionSkip,
					// expedite should always be 0 for changeDescriptors that have their render() called, but,
					// for consistency...
					this.expedite,
					this.transitionOrigin
				);
			}

			/*
				After everything else is done, inner (enchant-in:) enchantments are created here.
			*/
			if (innerEnchantments) {
				innerEnchantments.map(fn => fn(target)).forEach(ench => section.addEnchantment(ench));
			}
			
			return dom;
		}
	};
	
	return seal(ChangeDescriptor);
});
