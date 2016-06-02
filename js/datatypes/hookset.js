define(['jquery', 'utils', 'utils/hookutils'], ($, Utils, {hookToSelector}) => {
	"use strict";
	
	/*
		A HookSet is an object representing a "hook selection". Hooks in
		Twine passages can have identical titles, and both can therefore be
		selected by the same hook reference. This class represents
		these selections within a given Section.
		
		These are currently exclusively created by Section.selectHook.
	*/
	/*d:
		HookName data
		
		A hook name is like a variable name, but with `?` replacing the `$` sigil. When given to a macro that accepts it,
		it signifies that *all* hooks with the given name should be affected by the macro.
		For instance, `(click: ?red)` will cause *all* hooks with a `<red|` or `|red>` nametag to be subject to the (click:)
		macro's behaviour.

		In earlier Harlowe versions, it was possible to also use hook names with (set:), (put:) and (move:) to modify the
		text of the hooks, but macros such as (replace:) should be used to accomplish this instead.

		If you only want some of the hooks with the given name to be affected, you can treat the hook name as a sort of read-only
		array: access its `1st` element (such as by `?red's 1st`) to only affect the first such named hook in the passage, access
		the `last` to affect the last, and so forth. (Even specifying an array of positions, like `?red's (a:1,3,5)`, will work.)

		If you need to, you cal also add hook names together to affect both at the same time: `(click: ?red + ?blue's 1st)` will
		affect all hooks tagged `<red|`, as well as the first hook tagged `<blue|`.

		Note: if a hook name does not apply to a single hook in the given passage (for instance, if you type `?rde` instead of
		`?red`) then no error will be produced. This is to allow macros such as (click:) to be placed in the `header` or `footer`
		passages, and thus easily affect hooks in every passage, even if individual passages lack the given hook name. Of course, it
		means that you'll have to be extra careful while typing the hook name, as misspellings will not be easily identified
		by Harlowe itself.
	*/
	
	/*
		Hooks are "live" in the sense that their selected hooks are re-computed on
		every operation performed on them.

		This private function returns a jQuery collection of every <tw-hook>
		in this HookSet's Section which matches this HookSet's selector string.
	*/
	function hooks() {
		let ret = $();

		/*
			First, take the elements from all the previous hooks that
			this was concatenated to. (For instance, [?a] + ?b's 1st)
		*/
		if (this.prev) {
			ret = ret.add(hooks.call(this.prev));
		}
		/*
			If this has a selector itself (such as ?a + [?b]'s 1st), add those elements
			(as restricted by the properties).
		*/
		/*
			The following function takes a jQuery set of elements and produces
			a reduce() function which extracts just the ones keyed to a given index
			(or array of indexes).
		*/
		const reducer = (elements, index) => {
			if (Array.isArray(index)) {
				return index.reduce((a,i) => a.add(elements.get(i)), $());
			}
			// Luckily, negatives indices work fine with $().get().
			return $(elements.get(index));
		};
		if (this.selector) {
			const ownElements = Utils.$(hookToSelector(this.selector), this.section.dom);
			if (this.properties.length) {
				ret = ret.add(this.properties.reduce(reducer, ownElements));
			}
			else {
				ret = ret.add(ownElements);
			}
		}
		/*
			Conversely, if this has a base, then we add those elements
			(as restricted by the properties).
		*/
		if (this.base) {
			ret = ret.add(this.properties.reduce(reducer, hooks.call(this.base)));
		}
		return ret;
	}

	/*
		This private function allows a specific jQuery method to be called
		on the collection of matched hooks in the HookSet.
	*/
	function jQueryCall(methodName, ...args) {
		const
			/*
				This is re-evaluated during every jQueryCall, so that it's always
				up-to-date with the DOM.
			*/
			myHooks = hooks.call(this);
		return methodName in myHooks && myHooks[methodName](...args);
	}
	
	const HookSet = Object.freeze({
		
		/*
			An Array forEach-styled iteration function. The given function is
			called on every <tw-hook> in the section DOM
			
			This is currently just used by Section.renderInto, to iterate over each
			word and render it individually.
			
			@param {Function} The callback, which is passed the following:
				{jQuery} The <tw-hook> element to manipulate.
		*/
		forEach(fn) {
			return jQueryCall.call(this, "each", function(i) {
				fn($(this), i);
			});
		},
		
		/*
			TwineScript_ObjectName and _TypeName are used for error messages.
		*/
		get TwineScript_ObjectName() {
			/*
				Let's not bother printing out this hookset's entire heritage
				if it's anything more than basic.
			*/
			if (this.properties.length > 0 || this.prev) {
				return "a complex hook reference";
			}
			return this.selector + " (a hook reference)";
		},

		TwineScript_TypeName: "a hook reference (like ?this)",

		/*
			HookSets can be concatenated in the same manner as ChangerCommands.
		*/
		"TwineScript_+"(other) {
			/*
				Make a copy of this HookSet to return.
			*/
			const clone = other.TwineScript_Clone();
			/*
				Attach this to the other, producing a chain of [this] -> [clone].
			*/
			clone.prev = this;
			return clone;
		},

		/*
			These are used by VarRef, under the assumption that this is a sequential object.
			Accessing 1st, 2nd, etc. for a HookSet will produce only the nth document-order
			element for that hookset.

			Note that index may actually be an array of indices, as created by "?a's (a:1,2,4)".
		*/
		TwineScript_GetElement(index) {
			return HookSet.create(this.section, undefined, this, [index], undefined);
		},

		// Like all sequential objects, HookSets have a length.
		get length() {
			return hooks.call(this).length;
		},

		TwineScript_Clone() {
			return HookSet.create(this.section, this.selector, this.base, this.properties, this.prev);
		},
		
		/*
			Creates a new HookSet, which contains the following:

			{Section} section: a section from which hook elements are selected.
			{String} selector: a hook name, such as "flank" for ?flank.
			{HookSet} base: an alternative to selector. A HookSet from which the properties
				are being extracted.
			{Array} properties: a set of properties to restrict the current set of hooks.
			{HookSet} prev: a hook which has been +'d with this one.

			Consider this diagram:

			[prev]    [selector] [properties]
			(?apple + ?banana's  2ndlast)'s 2ndlast
			[          base            ]   [properties]
		*/
		create(section, selector, base, properties = [], prev = undefined) {
			return Object.assign(Object.create(this), {
				section, selector, base, properties, prev
			});
		},
	});
	return HookSet;
});
