"use strict";

/*
	Utils
	Utility functions, constants, etc.
*/

// Used by HTMLEntityConvert
var p = $('<p>');

/**
 A static class with helper methods used throughout Harlowe.

 @class Utils
*/

var Utils =
{
	/**
	 Make object properties immutable and impossible to delete,
	 without preventing the object from being extended.

	 @method lockProperties
	 @param {Object} obj		object to lock
	*/

	lockProperties: function (obj)
	{
		var i, prop,
			keys = Object.keys(obj),
			propDesc = {};
			
		for (i = 0; i < keys.length; i++)
		{
			prop = keys[i];
			
			propDesc[prop] =
			{
				configurable: 0,
				writable: 0
			};
		};

		return Object.defineProperties(obj, propDesc);
	},

	/**
	 Locks a particular property of an object.
	 Make object properties immutable and impossible to delete,
	 without preventing the object from being extended.

	 @method lockProperties
	 @param {Object} obj		object to lock
	*/
	
	lockProperty: function (obj, prop, value)
	{
		var propDesc = { configurable: 0, writable: 0 };
		value && (propDesc.value = value);
		Object.defineProperty(obj,prop, propDesc);
	},

	/**
	 A faster way to extend an object than $.extend({}, ...).

	 @method clone
	 @param {Object} obj	object to extend
	 @return {Object} cloned object
	*/

	clone: function (obj)
	{
		var i,
		    ret = Object.create(Object.getPrototypeOf(obj)),
			keys = Object.keys(obj),
			prop;

		for (i = 0; i<keys.length; i++)
		{
			prop = obj[keys[i]];
			ret[keys[i]] = $.isPlainObject(prop) ? Utils.clone(prop) : prop;
		}

		return ret;
	},
	
	/*
		String utilities
	*/
	
	/**
	 Returns whether a value is either a string or array.

	 @method stringOrArray
	 @param n	value to test
	 @return {Boolean}
	*/

	stringOrArray: function (n)
	{
		return (typeof n === "string" || Array.isArray(n));
	},

	/**
	 Splits a string. TODO: better explanation

	 @method splitUnquoted
	 @param {String} str		string to split
	 @param {String} split		separator, default single space
	 @return {Array} array of strings
	*/
	
	splitUnquoted: function(str, split)
	{
		return str.split(new RegExp((split || " ") + Utils.regexStrings.unquoted));
	},

	/**
	 Returns the type of a scope string or Twine-specific object.

	 @method scopeType
	 @param val		value to examine
	 @return {String} description
	*/

	scopeType: function(val)
	{
		var r;

		// Coerce empty string and null to undefined

		if (!val)
			return void 0 + "";
		else if (typeof val === "object")
		{
			if (val.wordarray)
				return "wordarray";
			else if (val.jquery)
				return "jquery";
		}
		else if (typeof val === "string")
		{
			r = /\$\("([^"]*)"\)|\$\('([^']*)'\)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\?(\w*)/.exec(val);

			if (r && r.length)
			{
				// jQuery selector $("..."), $('...')

				if (r[1] || r[2])
				{
					return "jquery string";
				}
				// Word selector "...", '...'
				else if (r[3] || r[4])
				{
					return "wordarray string";
				}
				// Hook ?...
				else if (r[5])
				{
					return "hook string";
				};
			}

			return void 0 + "";
		}
	},

	/**
	  For speed, convert common entities quickly, and convert others with jQuery.
	  This only works on a single entity, not a string full of them.

	  @method convertEntity
	  @param {String} text		text to convert
	  return {String} converted entity
	*/

	convertEntity: function (text)
	{
		if (text.length <= 1)
			return text;

		switch (text)
		{
			case "&lt;": return '<';
			case "&gt;": return '>';
			case "&amp;": return '&';
			case "&quot;": return '"';
			case "&#39;": return "'";
			case "&nbsp;": return String.fromCharCode(160);
			case "&zwnj;": return String.fromCharCode(8204);
			default: return p.html(text).text();
		}
	},

	/**
	 Convert a CSS class selector chain (".magic.link") into
	 a HTML classlist attribute (e.g. class="magic link").

	 @method classListToSelector
	 @param {String} list	chain to convert
	 @return {String} classlist string
	*/

	classListToSelector: function(c)
	{
		if (typeof c === "string")
		{
			return "." + c.replace(/ /g, ".");
		}
	},
	
	/**
	 Convert a HTML classlist attribute (e.g. class="magic link") into 
	 a CSS class selector chain (".magic.link").

	 @method classListToSelector
	 @param {String} list	chain to convert
	 @return {String} classlist string
	*/

	selectorToClassList: function (c)
	{
		if (typeof c === "string")
			return c.replace(/\./g, " ").trim();
	},
	
	/**
	 Convert a hook index string to a CSS selector.

	 @method hookToSelector
	 @param {String} list	chain to convert
	 @return {String} classlist string
	*/
	
	hookToSelector: function(c)
	{
		c = c.replace(/"/g, "&quot;");
		return '.hook[data-hook="' + c + '"]';
	},
	
	/**
	 Convert a hook index string into a jQuery object.

	 @method hookTojQuery
	 @param {String} c		hook index
	 @param {Element} top	
	 @return jQuery object
	*/

	hookTojQuery: function(c, top)
	{
		return Utils.$(Utils.hookToSelector(c.slice(1)), top)
	},
	
	/**
	 Convert "$('selector')" to a jQuery object.

	 @method jQueryStringTojQuery
	 @param {String} jQuery invocation
	 @return jQuery object
	*/

	jQueryStringTojQuery: function (word)
	{
		return $(word.replace(/^\$\(["']|["']\)$/, ''));
	},

	/**
	 Takes a string containing a character or HTML entity, and wraps it into a
	 <span> tag, converting the entity if it is one.

	 @method charToSpan
	 @param {String} chararctr
	*/

	charToSpan: function(c)
	{
		// FIXME: what does this do?

		var quot = (c === "&#39;" ? '"' : "'");

		return "<span class='char' data-char=" +
		       quot + Utils.convertEntity(c) + quot + ">" +
			   c + "</span>";
	},
	
	/**
	 Converts an entire string into individual characters, each enclosed
	 by a <span>.

	 @method charToSpan
	 @param {String} source string
	 @return {String} HTML source
	*/

	charSpanify: function (text)
	{
		return text.replace(/&[#\w]+;|./g, Utils.charToSpan);
	},

	/*
	 Takes a string argument, expressed as a CSS time,
	 and returns the time in milliseconds that it equals.
	 Or, when given an array, takes all valid strings contained
	 and returns an array of times in milliseconds.

	 If the string can't be parsed as a time, then this returns 0.

	 @method cssTimeUnit
	 @param s		either string, or array of strings
	 @return either single string or array of times	
	*/

	cssTimeUnit: function (s)
	{
		var ret;

		if (typeof s == "string")
		{
			s = s.toLowerCase();

			if (s.slice(-2) == "ms")
				return (+s.slice(0, -2)) || 0;
			if (s.slice(-1) == "s")
				return (+s.slice(0, -1)) * 1000 || 0;
		}
		else if (Array.isArray(s))
		{
			ret = [];
			s.forEach(function(e)
			{
				var time = Utils.cssTimeUnit(e);
				(time > 0 && ret.push(time));
			});

			return ret;
		}

		return 0;
	},
	
	/*
		Element utilities
	*/
	
	/**
	 Find the closest enclosing hook span(s) for the passed jQuery object, if any.

	 @method closestHookSpan
	 @param els 	jQuery object
	*/

	closestHookSpan: function (els)
	{
		var ret = elems.closest(".hook, .pseudo-hook");
		return (ret.length ? ret : elems);
	},
	
	/**
	 Replaces oldElem with newElem while transitioning between both.

	 @method transitionReplace
	 @param oldEl 			a jQuery object currently in the DOM or DOM structure
	 @param newEl			an unattached jQuery object to attach
	 @param transIndex		???
	*/

	transitionReplace: function(oldEl, newEl, transIndex)
	{
		var delay, container1, container2a, container2b;
		
		oldElem = Utils.closestHookSpan(oldElem);
		
		// Create a transition-main-container
		container1 = $('<span class="transition-main-container"/>');

		// Connect to DOM
		container1.insertBefore(oldElem.first());
		
		if (newElem)
		{
			// Create a transition-in-container
			container2a = $('<span class="transition-in-container"/>').appendTo(container1);

			// Insert new element
			newElem.appendTo(container2a);
		}
		
		// Create a transition-out-container
		// while inserting it into the transition-main-container.
		container2b = $('<span class="transition-out-container"/>').prependTo(container1);

		// Insert old element
		oldElem.detach().appendTo(container2b);
		
		// Transition-out the old element, removing it

		Utils.transitionOut(container2b, transIndex);

		// Transition-in the new element

		if (newElem)
		{
			Utils.transitionIn(container2a, transIndex, function()
			{
				// Remove container1 and container2a
				container2a.unwrap().children().first().unwrap();
			});
		}
	},

	/**
	 Transition an element out.
	
	 @method transitionOut
	 @param {Element} el			element to transition out
	 @param transIndex ???			
	 @param {Function} onComplete	function to call when completed
	*/

	transitionOut: function (el, transIndex, onComplete)
	{
		var delay;
		
		onComplete = onComplete || function(){ el.remove(); };
		el.attr("data-t8n", transIndex).addClass("transition-out");
		
		// Ideally I'd use this:
		//.one("animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd", function(){ oldElem.remove(); });
		// but in the event of CSS being off, these events won't trigger - whereas the below method will simply occur immedately.

		delay = Utils.cssTimeUnit(el.css("animation-duration")) + Utils.cssTimeUnit(el.css("animation-delay"));

		if (delay)
			window.setTimeout(onComplete);
		else
			onComplete();
	},
	
	/**
	 Transition an element in.
	
	 @method transitionIn
	 @param {Element} el			element to transition out
	 @param transIndex ???			
	 @param {Function} onComplete	function to call when completed
	*/

	transitionIn: function(el, transIndex, onComplete)
	{
		var delay;

		onComplete = onComplete || function(){ el.removeClass("transition-in"); };
		el.attr("data-t8n", transIndex).addClass("transition-in");
		delay = Utils.cssTimeUnit(el.css("animation-duration")) + Utils.cssTimeUnit(el.css("animation-delay"));

		if (delay)
			window.setTimeout(onComplete);
		else
			onComplete();
	},

	/**
	 Runs a jQuery selector, but ignores elements that are transitioning out.

	 @method $
	 @param str			jQuery selector
	 @param context		jQuery context
	*/
	
	$: function(str, context)
	{
		return $(str, context).not(".transition-out, .transition-out *");
	},
	
	/*
		Constants
	*/
	
	// Selector for CharSpans
	charSpanSelector: "span.char, br",
	
	// Default value for variables affected with <<set>>
	defaultValue: 0,
	
	// Story element
	storyElement: $('#story'),
	
	// Components for regexps

	regexStrings:
	{
		macroOpen: "&lt;&lt;",
		macroName: "[\\w\\-\\?\\!]+",
		notMacroClose: "(?:[^&]|&(?!gt;&gt;))*",
		macroClose: "&gt;&gt;",

		// Regex suffix that, when applied, causes the preceding match to only apply when not inside a quoted
		// string. This accounts for both quote styles and escaped quote characters.

		unquoted: "(?=(?:[^\"'\\\\]*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"))*[^'\"]*$)",
	}
};
