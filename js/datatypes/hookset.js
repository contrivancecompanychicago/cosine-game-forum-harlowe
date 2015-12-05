define(['jquery', 'utils/hookutils'], ($, {hookToSelector}) => {
	"use strict";
	
	/**
		A HookSet is an object representing a "hook selection". Hooks in
		Twine passages can have identical titles, and both can therefore be
		selected by the same hook reference. This class represents
		these selections within a given Section.
		
		These are currently exclusively created by Section.selectHook.
		
		@class HookSet
		@static
	*/
	/*d:
		Hook data
		
		Named hooks can be referenced by certain specific macros by supplying their name, preceded with the `?` character.
		This is a "hook reference", and signifies that *all* hooks with the given name should be affected by the macro.
		For instance, `(click:?red)` will cause *all* hooks with a `<red|` or `|red>` nametag to be subject to the (click:)
		macro's behaviour.

		Other macros can currently interact with named hooks as well: a hook reference can be used in the (set:), (put:) and (move:)
		macros to change the source markup contained in them. `(set: ?red to "//Golly//")` will put the text "*Golly*" in *all*
		hooks with a `<red|` or `|red>` nametag, in a manner similar to using (replace:). Furthermore, you can (print:) hook references, which joins the text of all
		hooks with the same name together into a single string. All of the features in this paragraph, however, are **not** recommended, and
		**may** be removed in a future version of Harlowe.

		Note: if a hook reference does not apply to a single hook in the given passage (for instance, if you type `?rde` instead of
		`?red`) then no error will be produced. This is to allow macros such as (click:) to be placed in the `header` or `footer`
		passages, and thus easily affect hooks in every passage, even if individual passages lack the given hook name. Of course, it
		means that you'll have to be extra careful while typing hook references, as misspellings will not be easily identified
		by Harlowe itself.
	*/
	
	/*
		This private function returns a jQuery collection of every <tw-hook>
		in this HookSet's Section which matches this HookSet's selector string.
	*/
	function hooks() {
		return this.section.$(
			hookToSelector(
				this.selector.slice(1) /* slice off the hook sigil */
			)
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
		
		/**
			An Array forEach-styled iteration function. The given function is
			called on every <tw-hook> in the section DOM
			
			This is currently just used by Section.renderInto, to iterate over each
			word and render it individually.
			
			@method forEach
			@param {Function} fn The callback, which is passed the following:
				{jQuery} The <tw-hook> element to manipulate.
		*/
		forEach(fn) {
			return jQueryCall.call(this, "each", function(i) {
				fn($(this), i);
			});
		},
		
		/**
			Retrieves the text of the first (by which I mean, earliest in the
			passage) hook within this HookSet. Note that this does not retrieve
			formatting, macros or whatever in the hook - only visible text.
			
			This is currently just used by Section.runExpression, to print a
			hookRef in passage text.
			
			@method text
		*/
		text() {
			return jQueryCall.call(this, "text");
		},
		
		/**
			TwineScript_ToString is a function that TwineScript uses to
			determine if an object can be implicitly coerced to string.
			Since HookSets may appear in TwineScript code (via the HookSet
			expression), AND it's expected that you can add strings to it,
			this method is called upon.
			
			@method TwineScript_ToString
		*/
		TwineScript_ToString() {
			return this.text();
		},
		
		/**
			TwineScript_Print is used to determine how this expression prints when
			it reaches the top level of a passage.
			Much like ToString, it prints the first hook in this set.
		*/
		TwineScript_Print() {
			return this.text();
		},
		
		/**
			TwineScript_ObjectName and _TypeName are used for error messages.
		*/
		get TwineScript_ObjectName() {
			return this.selector + " (a hook reference)";
		},
		TwineScript_TypeName: "a hook reference (like ?this)",
		
		/**
			TwineScript_Assignee is used when this object is an lvalue
			in an AssignmentRequest. It's an accessor because it's
			accessed by Operations.get().
		*/
		set TwineScript_Assignee(value) {
			this.section.renderInto(value, hooks.call(this), { append: "replace"});
		},
		/*
			Note that the value is also retrieved when a bi-directional assignment
			occurs. In that instance, it should return itself. This is rather
			#awkward, though, as it betrays the meaning of "assignee"...
		*/
		get TwineScript_Assignee() {
			return this;
		},
		/**
			TwineScript_AssignValue is used when this object is an rvalue
			in an AssignmentRequest. Yes, (set: $grault to ?garply) only
			copies ?garply's present value into $grault, as if ?garply
			were a variable.
			Note that as a result, it's not possible to store
			a HookSet in a variable - which is good, as it carries with it
			a reference to its origin hook.
		*/
		TwineScript_AssignValue() {
			return jQueryCall.call(this, "text");
		},

		/**
			TwineScript_DeleteValue is called by VarRef.delete() whenever
			a property is deleted. In this case, the act of "deleting"
			a HookRef is akin to blanking it. Consider (move: ?a to $a),
			which one would expect to remove the value of ?a and put it in
			$a without otherwise clearing the ?a hooks from the DOM.
		*/
		TwineScript_DeleteValue(prop) {
			/*
				The property will be "TwineScript_Assignee" when
				a (move:) macro has caused this to be deleted.
				This is rather #awkward.
			*/
			if (prop === "TwineScript_Assignee") {
				jQueryCall.call(this, "text", "");
			}
		},
		
		/**
			Creates a new HookSet. It has a selector and a section
			which determine what hooks to select, and from where.
			
			There isn't much call to ever use a HookSet as a prototype
			(especially since it's frozen, rendering section and selector
			difficult to override) but it's still available anyway. Such
			is the porous, spongy nature of JS.)
			
			@method create
			@param {Section} section The section to use for DOM lookups.
			@param {String} hookSelector The selector string.
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
