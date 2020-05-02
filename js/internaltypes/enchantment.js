"use strict";
define(['jquery', 'utils', 'internaltypes/changedescriptor', 'datatypes/changercommand', 'utils/operationutils', 'internaltypes/twineerror'], ($, Utils, ChangeDescriptor, ChangerCommand, {objectName}, TwineError) => {
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
			Utils.assertOnlyHas(descriptor, ['scope', 'section', 'attr', 'data', 'changer', 'functions', 'lambda']);

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
			let {scope, lambda} = this;
			/*
				Create an array to temporarily store a fresh set of <tw-enchantment>s.
				For performance reasons, this is not a jQuery that gets .add()ed to,
				but it is converted to one at the end.
			*/
			let enchantmentsArr = [];
			
			/*
				Now, enchant each selected word or hook within the scope.
			*/
			scope.forEach(section, (e, i) => {
				/*
					Create a fresh <tw-enchantment>, and wrap the elements in it.

					It's a little odd that the generated wrapper must be retrieved
					using a terminating .parent(), but oh well.
				*/
				const wrapping = e.wrap("<tw-enchantment>").parent();

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
				/*
					Lambdas are given to enchantments exclusively through (enchant:). They override any
					other changers (which shouldn't be on here anyway) and instead call the author-supplied
					lambda with each part of the scope as a separate hook to sculpt a specific changer for that hook.
				*/
				let changer;
				if (lambda) {
					changer = lambda.apply(section, { loop: scope.TwineScript_GetProperty(i), pos: i+1 });
					if (!ChangerCommand.isPrototypeOf(changer)) {
						e.replaceWith(TwineError.create("macrocall",
							"The 'via' lambda given to (enchant:) must return a changer, not " + objectName(changer) + "."
						).render(""));
						lambda = changer = null;
					}
					else {
						const summary = changer.summary();
						if (summary.includes('newTargets') || summary.includes('target')) {
							/*
								Since (enchant:) was given a lambda, and since lambdas can reference variables, it's not possible
								to type-check this lambda until runtime, upon which the original <tw-expression> for the enchantment is long gone.
								So, instead, the first item in the scope to produce an error gets replaced by it, and the rest of the scope is ignored.
							*/
							e.replaceWith(TwineError.create("macrocall",
								"The changer produced by the 'via' lambda given to (enchant:) can't include a revision command like (replace:) or (append:)."
							).render(""));
							lambda = changer = null;
						}
					}
				} else {
					changer = this.changer;
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
							a[e] = "inherit";
							return a;
						},{}));
						/*
							Store the list of enchanted properties as data on this wrapping,
							so that they can be removed later.
						*/
						wrapping.data({enchantedProperties});
					}
				}

				/*
					This brief CSS kludge allows a <tw-enchantment> wrapping <tw-story>
					to not restrict the <tw-story>'s width and height.
					It must be performed now because the aforementioned .attr() call
					may entirely alter the style attribute.
				*/
				if (e.is(Utils.storyElement)) {
					wrapping.css({ width: '100%', height: '100%' });
				}

				/*
					Store the wrapping in the enchantments list.
				*/
				enchantmentsArr.push(wrapping);
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
			this.enchantments.each(function() {
				const c = $(this).contents();
				c.unwrap();
				/*
					Undo the preceding CSS "inherit" kludge for <tw-story>.
				*/
				const enchantedProperties = $(this).data('enchantedProperties');
				if (enchantedProperties && c.has(Utils.storyElement)) {
					Utils.storyElement.css(enchantedProperties.reduce((a,e)=>(a[e] = "",a),{}));
				}
			});
		},

	};
	return Object.freeze(Enchantment);
});
