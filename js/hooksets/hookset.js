define(['hookutils', 'jquery'],function(HookUtils, $) {
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
	
	/*
		This private function allows a specific jQuery method to be called
		on the collection of matched hooks in the HookSet.
	*/
	function jQueryCall(methodName /*variadic*/) {
		/*
			hooks is a jQuery collection of every <tw-hook> in the Section
			which matches this HookSet's selector string.
			
			This is re-evaluated during every jQueryCall, so that it's always
			up-to-date with the DOM.
		*/
		var args = Array.from(arguments).slice(1),
			hooks = this.section.$(
				HookUtils.hookToSelector(
					this.selector.slice(1) /* slice off the hook sigil */
				)
			);
		return methodName in hooks && hooks[methodName].apply(hooks, args);
	}
	
	var HookSet = Object.freeze({
		
		/**
			An Array forEach-styled iteration function. The given function is
			called on every <tw-hook> in the section DOM 
			
			This is currently just used by Section.renderInto, to iterate over each
			word and render it individually.
			
			@method forEach
			@param {Function} fn The callback, which is passed the following:
				{jQuery} The <tw-hook> element to manipulate.
		*/
		forEach: function(fn) {
			return jQueryCall.call(this, "each", function() {
				fn($(this));
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
		text: function() {
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
		TwineScript_ToString: function() {
			return this.text();
		},
		
		/**
			TwineScript_ObjectName is used for error messages.
		*/
		get TwineScript_ObjectName() {
			return this.selector + " (a hook reference)";
		},
		
		/**
			TwineScript_Assignee is used when this object is an lvalue
			in an AssignmentRequest.
		*/
		get TwineScript_Assignee() {},
		set TwineScript_Assignee(value) {
			return jQueryCall.call(this, "text", value);
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
		create: function(section, hookSelector) {
			var ret = Object.create(this);
			ret.section = section;
			ret.selector = hookSelector;
			return Object.freeze(ret);
		},
	});
	return HookSet;
});
