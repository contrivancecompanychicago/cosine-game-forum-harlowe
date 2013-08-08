define(['jquery'], function($)
{
	"use strict";
	/*
		utils: Utility functions, constants, etc.
	*/
	
	var p = $('<p>');
	
	var utils = Object.freeze({

		// Make object properties non-deletable and non-writable.
		lockProperties: function(obj)
		{
			var i,
				keys = Object.keys(obj),
				propDesc = {};
				
			for (i = 0; i < keys.length; i++)
			{
				var prop = keys[i];
				
				propDesc[prop] = {
					enumerable: true,
					writable: false
				};
			}
			return Object.defineProperties(obj, propDesc);
		},

		// Clone - faster than $.extend()
		clone: function(obj) {
			var i, ret = Object.create(Object.getPrototypeOf(obj)),
				keys = Object.keys(obj),
				prop;
			for (i = 0; i<keys.length; i++) {
				prop = obj[keys[i]];
				ret[keys[i]] = $.isPlainObject(prop) ? utils.clone(prop) : prop;
			}
			return ret;
		},
		
		/*
			Get the type of a scope string or Twine-specific object.
			Returns a string.
			For strings, determines the type of scope selector used.
		*/
		type: function(val) {
			var u;
			if (!val)
			{
				return u+"";
			}
			if (typeof val === "object")
			{
				if (val.wordarray)
				{
					return "wordarray";
				}
				else if (val.jquery)
				{
					return "jquery";
				}
			}
			else if (typeof val === "string")
			{
				var r = /\$\("([^"]*)"\)|"((?:[^"\\]|\\.)*)"|(\w*)/.exec(val);
				if (r.length)
				{
					// jQuery selector $("...")
					if (r[1])
					{
						return "jquery string";
					}
					// Word selector "..."
					else if (r[2])
					{
						return "wordarray string";
					}
					// Hook
					else if (r[3])
					{
						return "hook string";
					}
				}
				return u+"";
			}
		},

		// For speed, convert common entities quickly, and convert others with jQuery.
		HTMLEntityConvert: function(text)
		{
			if (text.length <= 1)
			{
				return text;
			}
			switch(text)
			{
				case "&lt;": return '<';
				case "&gt;": return '>';
				case "&amp;": return '&';
				case "&quot;": return '"';
				default: return p.html(text).text();
			};
		},
		
		// Takes a string containing a character or HTML entity, and wraps it into a
		// <span> tag (converting the entity if it is one)
		charToSpan: function(c)
		{
			return "<span class='char' data-char='"
				+ utils.HTMLEntityConvert(c) + "'>"
				+ c + "</span>";
		},
		
		// Calls charToSpan() on the whole string.
		charSpanify: function(text)	{
			return text.replace(/&[#\w]+;|./g, utils.charToSpan);
		},
		
		// Selector for CharSpans
		charSpanSelector: "span.char, br"
	});
	return utils;
});