"use strict";
define('utils/jqueryplugins', ['jquery'], ($) => {
	
	$.prototype.extend({
		/*
			popAttr: returns an attribute while removing it. Accepts only 1 argument.
		*/
		popAttr(attr) {
			const ret = this.attr(attr);
			this.removeAttr(attr);
			return ret;
		},
		/*
			popData: return data while removing it. Accepts only 1 argument.
		*/
		popData(name) {
			const ret = this.data(name);
			this.removeData(name);
			return ret;
		},
		/*
			tag: returns the **lowercase** tag name of the first matched element.
			This is only a getter.
		*/
		tag() {
			return this[0] && this[0].tagName && this[0].tagName.toLowerCase();
		},
		/*
			This slightly complicated procedure is necessary to select all
			descendent text nodes.
			This returns a sorted Array, not a jQuery.
		*/
		textNodes(selector = '*') {
			/*
				Base case: this collection contains a single text node.
			*/
			if (this.length === 1 && this[0] && this[0].nodeType === Node.TEXT_NODE) {
				return [this[0]];
			}
			/*
				First, create an array containing all descendent and contents nodes
				which are text nodes.
			*/
			return this.get().concat(this.contents().get(), this.find(selector).contents().get()).filter(function(e,i,a) {
				return e?.nodeType === Node.TEXT_NODE && a.indexOf(e) === i;
			})
			/*
				We must sort the returned array using compareDocumentPosition.
			*/
			.sort((left, right) => (left.compareDocumentPosition(right)) & 2 ? 1 : -1);
		},

		/*
			Quick utility function that calls .filter(q).add(q).find(q),
			which is similar to just .find() but includes the top element
			if it also matches.
		*/
		findAndFilter(selector) {
			const lowerElements = this.find(selector);
			const topElements = this.filter(selector);
			return (!topElements.length ? lowerElements : lowerElements.add(topElements));
		},
	});
});
