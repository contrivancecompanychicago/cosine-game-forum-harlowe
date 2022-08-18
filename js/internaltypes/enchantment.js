"use strict";
define('internaltypes/enchantment', ['jquery', 'utils', 'internaltypes/changedescriptor', 'datatypes/changercommand', 'utils/operationutils', 'internaltypes/twineerror', 'utils/renderutils'],
($, Utils, ChangeDescriptor, ChangerCommand, {objectName,toSource}, TwineError, {collapse}) => {
	/*
		Enchantments are special styling that is applied to selected elements of a
		passage by a macro. Enchantments are registered with a Section by pushing
		them onto the Section's "enchantments" array, whereupon the Section will
		automatically run updateEnchantments() whenever its DOM is permuted.
	*/

	const Enchantment = {
		/*
			Creates an Enchantment based on the given descriptor object.
			The descriptor should have {scope, attr, data} properties.

			The scope is shared with both enchantData methods:
			disenchant removes the <tw-enchantment> elements
			set on the scope, and enchantScope creates an updated
			scope to enchant.
		*/
		create(descriptor) {
			/*
				Enchantment descriptors should only have 'scope', 'localHook', 'section', 'attr', 'data', 'changer', 'functions', 'lambda' and 'name'
				properties.
			*/
			return Object.assign(Object.create(this), {
				/*
					A store for the <tw-enchantment> wrappers created by enchantScope.
					
					This is a case of a jQuery object being used as a data structure rather
					than as a query result set. Search function calls for DOM elements 'contained' in
					these enchantments is more succinct using jQuery than using a plain Array or Set.
				*/
				enchantments: $(),
			}, descriptor);
		},
		/*
			This method enchants the scope, applying the macro's enchantment's
			classes to the matched elements.
		*/
		enchantScope() {
			const {attr, data, functions, section} = this;
			let {scope, localHook, lambda} = this;
			/*
				Create an array to temporarily store a fresh set of <tw-enchantment>s.
				For performance reasons, this is not a jQuery that gets .add()ed to,
				but it is converted to one at the end.
			*/
			let enchantmentsArr = [];
			
			/*
				Now, enchant each selected word or hook within the scope.
			*/
			let pos = 0;
			scope.forEach(section, (e, i) => {
				/*
					The localHook is a restriction created by (enchant-in:) or its ilk, limiting the given scope even further.
					It is either a HookSet (when used with (enchant:)) or a jQuery (when attached to a hook)
				*/
				if (localHook) {
					localHook = localHook.jquery ? localHook : localHook.hooks(section);

					/*
						If the localHook is INSIDE this scope, use the contained localHook instead.
					*/
					const containedLocalHook = e.find(localHook);
					if (containedLocalHook.length) {
						e = containedLocalHook;
					}
					/*
						Otherwise, if the localHook does not contain the scope, don't do anything.
					*/
					else if (!localHook.has(e[0]).length) {
						return;
					}
				}
				/*
					Empty hooks should not be enchanted, as they are invisible (by CSS) in Harlowe.
					The 'source' check ('source' being an array or string) is for hooks later in the passage which haven't finished being rendered.
					(NOTE: Obviously, the hook ought to still be considered "empty" if its 'source' has only comments, etc.,
					but for now (March 2022) this bug is left to roam free.)
				*/
				if (e.is(':empty') && (!e.data('source') || !e.data('source').length)) {
					return;
				}
				pos += 1;
				/*
					Lambdas are given to enchantments exclusively through (enchant:). They override any
					other changers (which shouldn't be on here anyway) and instead call the author-supplied
					lambda with each part of the scope as a separate hook to sculpt a specific changer for that hook.
				*/
				let changer;
				if (lambda) {
					changer = lambda.apply(section, { loop: scope.TwineScript_GetProperty(i), pos });
					if (TwineError.containsError(changer)) {
						e.replaceWith(changer.render());
						lambda = changer = null;
					}
					else if (!ChangerCommand.isPrototypeOf(changer)) {
						e.replaceWith(TwineError.create("macrocall",
							`The lambda "${toSource(lambda)}" must return a changer, not ${objectName(changer)}.`
						).render());
						lambda = changer = null;
					}
					else if (!changer.canEnchant) {
						/*
							Since (enchant:) was given a lambda, and since lambdas can reference variables, it's not possible
							to type-check this lambda until runtime, upon which the original <tw-expression> for the enchantment is long gone.
							So, instead, the first item in the scope to produce an error gets replaced by it, and the rest of the scope is ignored.
						*/
						e.replaceWith(TwineError.create("macrocall",
								`The lambda "${toSource(lambda)}" can't be or include a revision, enchantment, or interaction changer like (replace:), (click:), or (link:).`
							).render());
						lambda = changer = null;
					}
				} else {
					changer = this.changer;
				}
				/*
					Decide if this enchantment needs a <tw-enchantment> wrapping. Usually it does,
					but for transition-only enchantments, the <tw-transition-container> serves as
					the wrapping itself. The condition for it being transition-only is:
					no attr, no data, and the changer only contains transition-related properties.
				*/
				const noWrapping = (!attr && !data && (!changer || changer.summary().every(c => c.startsWith('transition'))));
				/*
					Create a fresh <tw-enchantment> if it is indeed necessary, and wrap the elements in it.
				*/
				const wrapping = noWrapping ? e : e.wrap("<tw-enchantment>").parent();
				/*
					Apply the attr, data and functions now.
				*/
				if (attr) {
					wrapping.attr(attr);
				}
				if (data) {
					wrapping.data(data);
				}
				if (functions) {
					functions.forEach(fn => fn(wrapping));
				}
				if (changer) {
					const cd = ChangeDescriptor.create({section, target:wrapping });
					changer.run(cd);
					cd.update();
					/*
						CSS kludge for <tw-story>: when style properties are written on its enclosing <tw-enchantment>,
						add "inherit" CSS for those same properties on <tw-story> itself, so that it won't override
						it with its own default CSS.
					*/
					if (e.is(Utils.storyElement)) {
						const enchantedProperties = Object.keys(Object.assign({},...cd.styles));
						e.css(enchantedProperties.reduce((a,e)=>{
							/*
								Backgrounds can be "inherited" through the simple means of
								making them visible through the page element. This allows both
								background-image and background-color to be "inherited".
							*/
							if (e === "background-color" || e === "background-image") {
								a['background-color'] = 'transparent';
								a['background-image'] = 'none';
								/*
									The other one of these properties must be added to enchantedProperties, so that
									it is removed later.
								*/
								enchantedProperties.push(`background-${e === "background-color" ? 'image' : 'color'}`);
							}
							else {
								a[e] = "inherit";
							}
							return a;
						},{}));
						/*
							Store the list of enchanted properties as data on this wrapping,
							so that they can be removed later.
						*/
						wrapping.data({enchantedProperties});
					}
					/*
						Another CSS kludge for <tw-story>: normally, a <tw-passage>'s placement onscreen is controlled by
						the <tw-story>'s horizontal padding. In order for (box:) to work with ?passage, that padding needs to be removed
						and replaced with the <tw-passage>'s (box:) margins.
					*/
					else if (e.is('tw-passage')) {
						if (cd.styles.some(style => "margin-left" in style || "margin" in style || "margin-right" in style)) {
							const pl = 'padding-left', pr = 'padding-right';
							Utils.storyElement.css(pl, '0px').css(pr, '0px');
							/*
								Leveraging the kludge above is very convenient.
							*/
							wrapping.data({enchantedProperties: [pl, pr]});
						}
					}
				}

				/*
					This brief CSS kludge allows a <tw-enchantment> wrapping <tw-story>
					to not restrict the <tw-story>'s width and height.
					It must be performed now because the aforementioned .attr() call
					may entirely alter the style attribute.
				*/
				if (e.is(Utils.storyElement)) {
					/*
						Don't use 'width' or 'height' in case the page is taller than the browser window (i.e. <body>).
					*/
					wrapping.css({ 'min-width': '100%', 'min-height': '100%' });
				}
				/*
					If the wrapping has been given a (collapse:) changer, whose influence is signaled
					with [collapsing=true], then collapse the whitespace within.
				*/
				if (wrapping.attr('collapsing') === 'true') {
					/*
						Remove all contained [collapsing=false] attributes - (enchant:) applies ongoing
						collapsing, rather than a one-off transformation, so it should always
						supercede individual hooks' collapsing semantics.
					*/
					wrapping.find('[collapsing=false]').each(function() { $(this).removeAttr('collapsing'); });
					collapse(wrapping);
				}
				/*
					Store the wrapping in the enchantments list (but only if it's a real <tw-enchantment> wrapping).
				*/
				if (!noWrapping) {
					enchantmentsArr.push(wrapping);
				}
			});
			/*
				Replace this enchantment's enchanted elements jQuery with a new one.
			*/
			this.enchantments = $(enchantmentsArr);
		},
		/*
			This method removes the enchantment wrappers installed by enchantScope().
			This is called by Section whenever the scope's DOM may have been changed,
			so that enchantScope() can then select the newly selected regions.
		*/
		disenchant() {
			/*
				Clear all existing <tw-enchantment> wrapper elements placed by
				the previous call to enchantScope().
			*/
			this.enchantments.each((_,e) => {
				e = $(e);
				const c = e.contents();
				c.unwrap();
				/*
					Undo the preceding CSS "inherit" kludge for <tw-story>.
				*/
				const enchantedProperties = e.data('enchantedProperties');
				if (enchantedProperties) {
					/*
						An identical line to this appears in Engine.showPassage().
					*/
					Utils.storyElement.css(enchantedProperties.reduce((a,e)=>(a[e] = "",a),{}));
				}
			});
		},

	};
	return Object.freeze(Enchantment);
});
