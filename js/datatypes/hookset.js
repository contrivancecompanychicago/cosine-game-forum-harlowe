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

		Note: if a hook name does not apply to a single hook in the given passage (for instance, if you type `?rde` instead of
		`?red`) then no error will be produced. This is to allow macros such as (click:) to be placed in the `header` or `footer`
		passages, and thus easily affect hooks in every passage, even if individual passages lack the given hook name. Of course, it
		means that you'll have to be extra careful while typing the hook name, as misspellings will not be easily identified
		by Harlowe itself.
	*/
	
	/*
		This private function returns a jQuery collection of every <tw-hook>
		in this HookSet's Section which matches this HookSet's selector string.
	*/
	function hooks() {
		return Utils.$(
			hookToSelector(
				this.selector.slice(1) /* slice off the hook sigil */
			),
			this.section.dom
		);
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
			return this.selector + " (a hook reference)";
		},
		TwineScript_TypeName: "a hook reference (like ?this)",
		
		/*
			Creates a new HookSet. It has a selector and a section
			which determine what hooks to select, and from where.
			
			There isn't much call to ever use a HookSet as a prototype
			(especially since it's frozen, rendering section and selector
			difficult to override) but it's still available anyway. Such
			is the porous, spongy nature of JS.)
			
			@param {Section} The section to use for DOM lookups.
			@param {String} The selector string.
		*/
		create(section, hookSelector) {
			const ret = Object.create(this);
			ret.section = section;
			ret.selector = hookSelector;
			return Object.freeze(ret);
		},
	});
	return HookSet;
});
