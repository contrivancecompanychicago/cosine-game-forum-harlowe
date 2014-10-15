define(['jquery'], function($) {
	"use strict";
	$.prototype.extend({
		/*
			popAttr: returns an attribute while removing it. Accepts only 1 argument.
		*/
		popAttr: function(attr) {
			var ret = this.attr(attr);
			this.removeAttr(attr);
			return ret;
		},
		/*
			tag: returns the **lowercase** tag name of the first matched element.
			This is only a getter.
		*/
		tag: function() {
			return this[0] && this[0].tagName.toLowerCase();
		}
	});
});