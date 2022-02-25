"use strict";
define(['jquery', 'markup', 'utils/polyfills'],
($) => {

	const
		{fromCharCode} = String,
		// These two are used by childrenProbablyInline (see below).
		usuallyBlockElements = (
			// The most common block HTML tags that would be used in passage source.
			"audio,blockquote,canvas,div,h1,h2,h3,h4,h5,hr,ol,p,pre,table,ul,video,"
			// And the one(s) that Harlowe itself creates through its syntax.
			// <tw-consecutive-br> and <tw-dialog> are deliberately not included.
			+ "tw-align,tw-story,tw-passage,tw-sidebar,tw-columns,tw-column,tw-meter"
		).split(','),
		
		usuallyInlineElements = (
			// The most common inline HTML tags that would be created from passage source
			"a,b,i,em,strong,sup,sub,abbr,acronym,s,strike,del,big,small,script,img,button,input,"
			// And the ones that Harlowe itself creates through its syntax.
			// Note that <tw-hook> and <tw-expression> aren't included.
			+ "tw-link,tw-broken-link,tw-verbatim,tw-collapsed,tw-error,tw-colour,tw-icon"
		).split(','),

		// Certain HTML elements cannot have their parents unwrapped: <audio>, for instance,
		// will break if it is ever detached from the DOM.
		nonDetachableElements = ["audio",],

		// These produce long RegExp strings of every lowercase/uppercase/caseSensitive character, defined as "any character in
		// the Basic Multilingual Plane which doesn't round-trip through toUpperCase/toLowerCase".
		// Note that this is computed based on the player's locale, which is coincidentally consistent with (uppercase:),
		// (lowercase:), and the 'uppercase' and 'lowercase' datatypes.
		[anyUppercase, anyLowercase, anyCasedLetter] = [
			e => fromCharCode(e) !== fromCharCode(e).toLowerCase(),
			e => fromCharCode(e) !== fromCharCode(e).toUpperCase(),
			e => fromCharCode(e).toLowerCase() !== fromCharCode(e).toUpperCase(),
		].map(filter => "[" + Array.from(Array(0xDFFF)).map((_,i) => i)
			.filter(filter)
			.map((e,i,a) => (e === a[i-1]+1 && e === a[i+1]-1) ? '-' : fromCharCode(e)).join('').replace(/\-+/g, '-') + "]");

	/*
		Hard-coded default time for transitions, in milliseconds.
	*/
	function defaultTransitionTime(transIndex) {
		return transIndex === "instant" ? 0 : 800;
	}

	/*
		Takes a string argument, expressed as a CSS time,
		and returns the time in milliseconds that it equals.

		If the string can't be parsed as a time, then this returns 0.
	*/
	function cssTimeUnit(s) {
		s = s.toLowerCase();

		if (s.slice(-2) === "ms")
			return (+s.slice(0, -2)) || 0;
		if (s.slice(-1) === "s")
			return (+s.slice(0, -1)) * 1000 || 0;
		return 0;
	}

	let
		//A binding for the cached <tw-story> reference (see below).
		storyElement,
		//A binding for story options (which are already visible in the DOM).
		options = {},
		/*
			An array of functions to run only after page load. This is set to null
			once page load has completed, causing onStartup() to just run the passed function
			immediately.
		*/
		startupCallbacks = [],
		/*
			A map of held-down keyboard keys, and a count of how many keys are held down concurrently.
			For back-compatibility's sake, this uses jQuery "which" codes instead of "key" event codes.
		*/
		keysHeld = {},
		keysHeldCount = 0,
		/*
			And, the same for mouse buttons.
		*/
		buttonsHeld = {},
		buttonsHeldCount = 0,
		/*
			Finally, mouse coordinates.
		*/
		mouseCoords = {};

	let Utils;
	/*
		This simple event keeps both of the aformentioned sets of maps and counts live.
	*/
	$(document.documentElement).on('keydown keyup mousedown mouseup', ({key, button, type}) => {
		const down = type.includes("down"),
			map = key ? keysHeld : buttonsHeld,
			/*
				Keys are indexed by insensitiveName, as this allows keys to be referenced by authors
				without keeping track of capitalisation, or whether Shift is being held.
				There are no specified utility key names which collide under this.
			*/
			which = (key && Utils.insensitiveName(key)) || button;
		if (map[which] && !down) {
			key ? (keysHeldCount = Math.max(keysHeldCount - 1, 0)) : (buttonsHeldCount = Math.max(buttonsHeldCount - 1, 0));
		}
		else if (!map[which] && down) {
			key ? (keysHeldCount += 1) : (buttonsHeldCount += 1);
		}
		map[which] = down;
	})
	.on('mousemove', ({pageX, pageY}) => {
		mouseCoords.x = pageX;
		mouseCoords.y = pageY;
	});

	/*
		A convenience function for transitionIn and transitionOut, which calls a function
		when a transition is complete, and also potentially accelerates the end
		of the transition if it can be skipped and an input is being held.
	*/
	function onTransitionComplete(el, time, delay, transitionSkip, endFn) {
		/*
			Each frame, reduce the duration, and potentially reduce it further if this
			transition can be skipped and an input is being held.
		*/
		let previousTimestamp = null, elapsedRealTime = 0, duration = time + delay;
		function animate(timestamp) {
			if (el[0].compareDocumentPosition(document) & 1) {
				duration = 0;
			}
			if (previousTimestamp) {
				duration -= (timestamp - previousTimestamp);
				elapsedRealTime += (timestamp - previousTimestamp);
			}
			previousTimestamp = timestamp;
			/*
				The test for whether a transition can be skipped is simply that any key is being held.
			*/
			if (transitionSkip > 0 && (keysHeldCount + buttonsHeldCount) > 0) {
				duration -= transitionSkip;
				el.css('animation-delay', ((cssTimeUnit(el.css('animation-delay')) || 0) - transitionSkip) + "ms");
			}
			if (duration <= 0) {
				endFn(elapsedRealTime);
			}
			else {
				requestAnimationFrame(animate);
			}
			/*
				If the remaining duration exceeds the initial delay (that is, if it's currently eating into the "time" interval rather than
				the "delay" interval), remove the 'visibility:hidden' guard.
			*/
			if (duration <= time) {
				el.css('visibility', '');
			}
		}
		!duration ? animate() : requestAnimationFrame(animate);
	}

	const underscoresAndHyphens = /-|_/g;

	/*
		A static class with helper methods used throughout Harlowe.
	*/
	Utils = {
		/*
			Returns an array of every permutation of the given sequence.
		*/
		permutations(...list) {
			const {length} = list,
				result = [[...list]],
				c = Array(length).fill(0);
			let i = 1, k, p;

			while (i < length) {
				if (c[i] < i) {
					k = i % 2 && c[i];
					p = list[i];
					list[i] = list[k];
					list[k] = p;
					++c[i];
					i = 1;
					result.push([...list]);
				} else {
					c[i] = 0;
					++i;
				}
			}
			return result;
		},

		/*
			A quick method for turning a number into an "nth" string.
		*/
		nth(num) {
			const lastDigit = (+num + '').slice(-1);
			return num + (
				lastDigit === "1" ? "st" :
				lastDigit === "2" ? "nd" :
				lastDigit === "3" ? "rd" : "th");
		},

		/*
			A quick method for adding an 's' to the end of a string
			that comes in the form "[num] [noun]". Used exclusively for
			error messages.
		*/
		plural(num, noun, plural) {
			return num + " " + (Math.abs(num) !== 1 ? (plural ? plural : noun + "s") : noun);
		},

		/*
			A quick method for joining a string array with commas and "and".
		*/
		andList(array) {
			return array.length <= 1 ? array[0]
				: (array.slice(0,-1).join(', ') + " and " + array[array.length-1]);
		},

		/*
			These two strings are modified copies of regex components from markup/patterns.js.
		*/
		// This includes all forms of Unicode 6 whitespace (including \n and \r) except Ogham space mark.
		realWhitespace: "[ \\n\\r\\f\\t\\v\\u00a0\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]",

		// This handles alphanumeric ranges not covered by \w. Doesn't include hyphens or underscores.
		anyRealLetter:  "[\\dA-Za-z\\u00c0-\\u00de\\u00df-\\u00ff\\u0150\\u0170\\u0151\\u0171\\uD800-\\uDFFF]",

		anyUppercase, anyLowercase, anyCasedLetter,
		anyNewline: "(?:\\n|\\r|\\r\\n)",

		/*
			HTML utilities
		*/

		/*
			Unescape HTML entities.
		*/
		unescape(text) {
			return text.replace(/&(?:amp|lt|gt|quot|nbsp|zwnj|#39|#96);/g,
				e => ({
					'&amp;'  : '&',
					'&gt;'   : '>',
					'&lt;'   : '<',
					'&quot;' : '"',
					'&#39;'  : "'",
					"&nbsp;" : String.fromCharCode(160),
					"&zwnj;" : String.fromCharCode(8204)
				}[e])
			);
		},

		/*
			HTML-escape a string.
		*/
		escape(text) {
			return text.replace(/[&><"']/g,
				e => ({
					'&' : '&amp;',
					'>' : '&gt;',
					'<' : '&lt;',
					'"' : '&quot;',
					"'" : '&#39;',
				}[e])
			);
		},

		/*
			Some names (namely macro names) are case-insensitive, AND dash-insensitive.
			This method converts such names to all-lowercase and lacking
			underscores and hyphens.
		*/
		insensitiveName(e) {
			return (e + "").toLowerCase().replace(underscoresAndHyphens, "");
		},

		/*
			Input utilities
		*/

		/*
			Provides access to the keysHeld map, which tracks keyboard input.
		*/
		allKeysDown: (...keys) => keys.every(key => keysHeld[key]),
		someKeysDown: (...keys) => keys.some(key => keysHeld[key]),

		/*
			Provides access to the buttonsHeld map, which tracks button input.
		*/
		buttonsDown: (...buttons) => buttons.every(b => buttonsHeld[b]),

		anyInputDown: () => keysHeldCount + buttonsHeldCount > 0,

		/*
			Provides very direct access to mouseCoords.
		*/
		mouseCoords,
		
		/*
			Element utilities
		*/

		/*
			Determines the colours of an element (both colour and backgroundColour) by
			scanning all of its parent elements, ignoring transparency.
			Used only by command macros and style changer macros.
		*/
		parentColours(elem) {
			const ret = { colour: null, backgroundColour: null };
			/*
				Browsers represent the colour "transparent" as either "transparent",
				hsla(n, n, n, 0) or rgba(n, n, n, 0).
			*/
			const transparent = /^\w+a\(.+?,\s*0\s*\)$|^transparent$/;
			/*
				To correctly identify the colours of this element, iterate
				upward through all the elements containing it.
			*/
			for (; elem.length && elem[0] !== document; elem = elem.parent()) {
				if (!ret.backgroundColour) {
					const colour = elem.css('background-color');
					if (!colour.match(transparent)) {
						ret.backgroundColour = colour;
					}
				}
				if (!ret.colour) {
					const colour = elem.css('color');
					if (!colour.match(transparent)) {
						ret.colour = colour;
					}
				}
				if (ret.colour && ret.backgroundColour) {
					return ret;
				}
			}
			/*
				If there's no colour anywhere, assume this is a completely unstyled document.
			*/
			return { colour: "#fff", backgroundColour: "#000" };
		},

		/*
			childrenProbablyInline: returns true if the matched elements probably only contain elements that
			are of the 'inline' or 'none' CSS display type.
			
			This takes some shortcuts to avoid use of the costly getComputedStyle() function as much as possible,
			hence, it can only "probably" say so.
			
			This is used to crudely determine whether to make a <tw-transition-container> inline or block,
			given that block children cannot inherit opacity from inline parents in Chrome (as of April 2015).

			Used only in style changer macros, and here.
		*/
		childrenProbablyInline(jq) {
			/*
				This is used to store elements which daunted all of the easy tests,
				so that $css() can be run on them after the first loop has returned all-true.
			*/
			const unknown = [];
			return [].every.call(jq.findAndFilter('*'), elem => {
				/*
					If it actually has "style=display:inline", "hidden", or "style=display:none"
					as an inline attribute, well, that makes life easy for us.
				*/
				if (elem.hidden || /none|inline/.test(elem.style.display)
						|| /display: (none|inline)/.test(elem.getAttribute('style'))) {
					return true;
				}
				/*
					If the children contain an element which is usually block,
					then *assume* it is and return false early.
				*/
				if (usuallyBlockElements.includes(elem.tagName.toLowerCase())
						/*
							If it has an attribute style which is verifiably block (NOT none, inline, unset or inherit),
							then go ahead and return false.
						*/
						|| /display: (?!none|inline|inherit|unset)/.test(elem.getAttribute('style'))) {
					return false;
				}
				/*
					If the child's tag name is that of an element which is
					usually inline, then *assume* it is and return true early.
				*/
				if (usuallyInlineElements.includes(elem.tagName.toLowerCase())) {
					return true;
				}
				/*
					For all else, we fall back to the slow case.
				*/
				unknown.push(elem);
				return true;
			})
			&& unknown.every(a => window.getComputedStyle(a).display.includes('inline'));
		},

		/*
			Transition an element out.
			Used only by Engine?
		*/
		transitionOut(el, transIndex, transitionTime, transitionDelay = 0, transitionSkip = 0, expedite = 0, transitionOrigin = undefined) {
			/*
				Quick early exit.
			*/
			if (el.length === 0) {
				return;
			}
			transitionTime = transitionTime || defaultTransitionTime(transIndex);

			/*
				If the element is not a tw-hook, tw-passage or tw-expression, we must
				wrap it in a temporary element first, which can thus be
				animated using CSS.
			*/
			const mustWrap = el.length > 1 || !Utils.childrenProbablyInline(el) || !['tw-hook','tw-passage','tw-expression'].includes(el.tag());
			/*
				As mentioned above, we must, in some cases, wrap the nodes in containers.
			*/
			if (mustWrap) {
				el = el.wrapAll('<tw-transition-container>').parent();
			}
			/*
				Now, apply the transition.
				The transitionOrigin must be applied before the rest of the attributeds, as it may
				be a function.
			*/
			if (transitionOrigin) {
				el.css('transform-origin', transitionOrigin);
			}
			el.attr("data-t8n", transIndex).addClass("transition-out").css({
				'animation-duration': transitionTime + "ms",
				'animation-delay':   (transitionDelay - expedite) + "ms",
			});

			/*
				To give newly-created sections time to render and apply changers, such as (box:) to hooks,
				this code, which gives the transition element the correct display property, is crudely placed in a delayed timeout.
			*/
			requestAnimationFrame(() => {
				/*
					Special case: due to <tw-backdrop> having display:flex, getComputedStyle() will always report 'display:block' for
					each child element of it, even if it's a <tw-dialog>. So, ignore childrenProbablyInline() and simply assume that block positioning mustn't be applied.
					Note that the other two elements that have display:flex, <tw-story> and <tw-columns>, don't have this concern due to their children
					being part of usuallyBlockElements.
				*/
				if (Utils.childrenProbablyInline(el)) {
					el.css('display','inline');
				}
				/*
					Special case: due to <tw-backdrop> and <tw-story> having display:flex, getComputedStyle() will always report 'display:block' for
					each child element of it, even though flex elements are positioned differently and don't need width:100%.
				*/
				else if (!el.parent().is('tw-backdrop,tw-story')) {
					/*
						Both of these are necessary for overriding "display:inline-block" for certain transitions,
						including those that use transform.
						setAttribute() must be used to add "!important".
					*/
					el[0].setAttribute('style', el[0].getAttribute('style') + "display:block !important;width:100%");
				}
			});
			onTransitionComplete(el, transitionTime, transitionDelay - expedite, transitionSkip, () => {
				/*
					As a transition-out, all that needs to be done at the end is remove the element.
				*/
				el.remove();
			});
		},

		/*
			Transition an element in.
			Used only by ChangeDescriptor.
		*/
		transitionIn(el, transIndex, transitionTime, transitionDelay = 0, transitionSkip = 0, expedite = 0, transitionOrigin = undefined) {
			/*
				Quick early exit.
			*/
			if (el.length === 0) {
				return;
			}
			transitionTime = transitionTime || defaultTransitionTime(transIndex);
			/*
				If the element is not a tw-hook, tw-passage or tw-expression, we must
				wrap it in a temporary element first, which can thus be
				animated using CSS.
			*/
			const mustWrap = el.length > 1 || !Utils.childrenProbablyInline(el) || !['tw-hook','tw-passage','tw-expression'].includes(el.tag());
			/*
				As mentioned above, we must, in some cases, wrap the nodes in containers.
			*/
			if (mustWrap) {
				el = el.wrapAll('<tw-transition-container>').parent();
			}
			/*
				Now, apply the transition.
				The transitionOrigin must be applied before the rest of the attributes, as it may
				be a function.
			*/
			if (transitionOrigin) {
				el.css('transform-origin', transitionOrigin);
			}
			el.attr("data-t8n", transIndex).addClass("transition-in").css(Object.assign({
				'animation-duration': transitionTime + "ms",
				'animation-delay':   (transitionDelay - expedite) + "ms",
			},
			/*
				For delayed animations, initially hide the transitioning element using visiblity:hidden.
				onTransitionComplete will then remove this at the correct time.
			*/
			(transitionDelay - expedite) ? { visibility: 'hidden' } : {}));

			/*
				To give newly-created sections time to render and apply changers, such as (box:) to hooks,
				this code, which gives the transition element the correct display property, is crudely placed in a delayed timeout.
			*/
			requestAnimationFrame(() => {
				if (Utils.childrenProbablyInline(el)) {
					el.css('display','inline');
				}
				/*
					Special case: due to <tw-backdrop> and <tw-story> having display:flex, getComputedStyle() will always report 'display:block' for
					each child element of it, even though flex elements are positioned differently and don't need width:100%.
				*/
				else if (!el.parent().is('tw-backdrop,tw-story')) {
					/*
						Both of these are necessary for overriding "display:inline-block" for certain transitions,
						including those that use transform.
						setAttribute() must be used to add "!important".
					*/
					el[0].setAttribute('style', el[0].getAttribute('style') + "display:block !important;width:100%");
				}
			});

			onTransitionComplete(el, transitionTime, transitionDelay - expedite, transitionSkip, (elapsedRealTime) => {
				/*
					Unwrap the wrapping... unless it contains a non-unwrappable element,
					in which case the wrapping must just have its attributes removed.
				*/
				const detachable = el.filter(nonDetachableElements.join(",")).length === 0;
				if (mustWrap && detachable) {
					/*
						Nested transitioning elements restart their animations when they're momentarily
						detached from the DOM by unwrap().
						For each nested transition, such as <tw-transition-container>,
						take their existing animation delay and decrease it by the delay.
						(Negative delays expedite the animation conveniently.)
					*/
					el.find('tw-transition-container').each((_,child) => {
						child = $(child);
						child.css('animation-delay', (cssTimeUnit(child.css('animation-delay') || 0) - elapsedRealTime) + "ms");
					});
					/*
						Because detaching elements (using unwrap()) resets the scroll positions of an element,
						which the (scroll:) macro could have changed, there's nothing for it but to save and restore
						these scroll positions ourselves.
					*/
					const scrolledElems = [];
					const allElems = el.find('*');
					for(let i = 0; i < allElems.length; i += 1) {
						const child = allElems[i];
						if (child.scrollTop !== 0 || child.scrollLeft !== 0) {
							scrolledElems.push([child, child.scrollLeft, child.scrollTop]);
						}
					}
					/*
						Now, unwrap, and restore the scroll positions.
					*/
					el.contents().unwrap();
					for (let [elem, scrollLeft, scrollTop] of scrolledElems) {
						elem.scrollLeft = scrollLeft;
						elem.scrollTop = scrollTop;
					}
				}
				/*
					Otherwise, remove the transition attributes.
				*/
				else {
					el.removeClass("transition-in").removeAttr("data-t8n");
				}
			});
		},

		/*
			A simple debouncing function that causes a function's call to only run 300ms after the last time it was called.
			If batching is enabled, arguments from repeated calls are batched together.
			Recursion (which would cause the function to enqueue itself) is disabled by default.
		*/
		debounce(fn, { batch = false, recur = false } = {}) {
			let animFrameID, args = [], lastInvokeTime = 0, suppress = false;
			const maybeRun = () => {
				if (Date.now() - lastInvokeTime > 300) {
					animFrameID = 0;
					suppress = !recur;
					if (batch) {
						fn(args);
						args = [];
					}
					else {
						fn(...args);
					}
					suppress = false;
				}
				else {
					animFrameID = requestAnimationFrame(maybeRun);
				}
			};
			return function() {
				if (suppress) {
					return;
				}
				lastInvokeTime = Date.now();
				/*
					Batching slowly builds a buffer of arguments objects, whereas
					non-batching simply throws away all but the last one.
				*/
				if (batch) {
					args.push(arguments);
				} else {
					args = arguments;
				}
				if (animFrameID) {
					cancelAnimationFrame(animFrameID);
				}
				animFrameID = requestAnimationFrame(maybeRun);
			};
		},

		/*
			Internal error logging function. Currently a wrapper for console.error.
			This should be used for engine errors beyond the story author's control.

			@param {String} Name of the calling method.
			@param {String} Message to log.
		*/

		impossible(where, data) {
			if (!window.console) {
				return;
			}
			console.error(where + "(): " + data);
		},

		/*
			Other modules which need to run startup initialisers involving the <tw-story> element
			can register them with Utils, so that they're run only on starting up.
		*/
		onStartup(fn) {
			if (startupCallbacks) {
				startupCallbacks.push(fn);
			}
			else fn();
		},

		/*
			This is used as a more semantic shortcut to the <tw-story> element.
		*/
		get storyElement() {
			return storyElement;
		},

		options
	};
	
	/*
		The reference to the <tw-story> should be set at startup, so that it can be
		used even when it is disconnected from the DOM (which occurs when a new
		passage is being rendered into it).
	*/
	$(() => {
		storyElement = $('tw-story');
		// Run all the callbacks registered in startupCallbacks by other modules.
		startupCallbacks.forEach(e => e());
		// Release startupCallbacks, causing onStartup() to no longer register functions,
		// instead just calling them immediately.
		startupCallbacks = null;
	});

	return Object.freeze(Utils);
});
