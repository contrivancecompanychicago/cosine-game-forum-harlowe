"use strict";
define(['jquery', 'requestAnimationFrame', 'markup', 'utils/polyfills'],
($, requestAnimationFrame) => {

	const
		// These two are used by childrenProbablyInline (see below).
		usuallyBlockElements = (
			// The most common block HTML tags that would be used in passage source
			"audio,blockquote,canvas,div,h1,h2,h3,h4,h5,hr,ol,p,pre,table,ul,video,"
			// And the one(s) that Harlowe itself creates through its syntax
			+ "tw-align,tw-story,tw-passage"
		).split(','),
		
		usuallyInlineElements = (
			// The most common inline HTML tags that would be created from passage source
			"a,b,i,em,strong,sup,sub,abbr,acronym,s,strike,del,big,small,script,img,button,input,"
			// And the ones that Harlowe itself creates through its syntax.
			// Note that <tw-hook> and <tw-expression> aren't included.
			+ "tw-link,tw-broken-link,tw-verbatim,tw-collapsed,tw-error"
		).split(','),

		// Certain HTML elements cannot have their parents unwrapped: <audio>, for instance,
		// will break if it is ever detached from the DOM.
		nonDetachableElements = ["audio",],

		// These produce long RegExp strings of every lowercase/uppercase character, defined as "any character in
		// the Basic Multilingual Plane which doesn't round-trip through toUpperCase/toLowerCase".
		// Note that this is computed based on the player's locale, which is coincidentally consistent with (uppercase:),
		// (lowercase:), and the 'uppercase' and 'lowercase' datatypes.
		[anyUppercase, anyLowercase] = ["toLowerCase","toUpperCase"].map(name => "[" + Array.from(Array(0xDFFF)).map((_,i) => i)
			.filter(e => String.fromCharCode(e) !== String.fromCharCode(e)[name]())
			.map((e,i,a) => (e === a[i-1]+1 && e === a[i+1]-1) ? '-' : String.fromCharCode(e)).join('').replace(/\-+/g, '-') + "]");

	/*
		Hard-coded default time for transitions, in milliseconds.
	*/
	function defaultTransitionTime(transIndex) {
		return transIndex === "instant" ? 0 : 800;
	}

	let
		//A binding for the cached <tw-story> reference (see below).
		storyElement,
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
	function onTransitionComplete(el, delay, transitionSkip, endFn) {
		/*
			Each frame, reduce the delay, and potentially reduce it further if this
			transition can be skipped and an input is being held.
		*/
		let previousTimestamp = null, elapsedRealTime = 0;
		function animate(timestamp) {
			if (el[0].compareDocumentPosition(document) & 1) {
				delay = 0;
			}
			if (previousTimestamp) {
				delay -= (timestamp - previousTimestamp);
				elapsedRealTime += (timestamp - previousTimestamp);
			}
			previousTimestamp = timestamp;
			/*
				The test for whether a transition can be skipped is simply that any key is being held.
			*/
			if (transitionSkip > 0 && (keysHeldCount + buttonsHeldCount) > 0) {
				delay -= transitionSkip;
				el.css('animation-delay', ((Utils.cssTimeUnit(el.css('animation-delay')) || 0) - transitionSkip) + "ms");
			}
			if (delay <= 0) {
				endFn(elapsedRealTime);
			}
			else {
				requestAnimationFrame(animate);
			}
		}
		!delay ? animate() : requestAnimationFrame(animate);
	}

	/*
		A static class with helper methods used throughout Harlowe.
	*/
	Utils = {
		/*
			Locks a particular property of an object.
		*/
		lockProperty(obj, prop, value) {
			// Object.defineProperty does walk the prototype chain
			// when reading a property descriptor dict.
			const propDesc = Object.create({ configurable: 0, writable: 0 });
			value && (propDesc.value = value);
			Object.defineProperty(obj, prop, propDesc);
			return obj;
		},

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
			The following is an in-place Fisher–Yates shuffle.
		*/
		shuffled(...list) {
			return list.reduce((a,e,ind) => {
				// Obtain a random number from 0 to ind inclusive.
				const j = (Math.random()*(ind+1)) | 0;
				if (j === ind) {
					a.push(e);
				}
				else {
					a.push(a[j]);
					a[j] = e;
				}
				return a;
			},[]);
		},

		/*
			Matrix multiplication.
		*/
		matMul(m1, m2, ...rest) {
			if (rest.length > 0) {
				return Utils.matMul(Utils.matMul(m1, m2), ...rest);
			}
			else if (!m2) {
				return m1;
			}
			let result = [];
			for (let i = 0; i < m1.length; i++) {
				result[i] = [];
				for (let j = 0; j < m2[0].length; j++) {
					let sum = 0;
					for (let k = 0; k < m1[0].length; k++) {
						sum += m1[i][k] * m2[k][j];
					}
					result[i][j] = sum;
				}
			}
			return result;
		},

		/*
			String utilities
		*/

		/*
			Takes a string argument, expressed as a CSS time,
			and returns the time in milliseconds that it equals.

			If the string can't be parsed as a time, then this returns 0.
		*/
		cssTimeUnit(s) {
			s = s.toLowerCase();

			if (s.slice(-2) === "ms")
				return (+s.slice(0, -2)) || 0;
			if (s.slice(-1) === "s")
				return (+s.slice(0, -1)) * 1000 || 0;
			return 0;
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
		plural(num, noun) {
			return num + " " + noun + (num > 1 ? "s" : "");
		},

		/*
			A quick method for joining a string array with commas and "and".
		*/
		andList(array) {
			return array.length === 1 ? array[0]
				: (array.slice(0,-1).join(', ') + " and " + array[array.length-1]);
		},

		/*
			These two strings are modified copies of regex components from markup/patterns.js.
		*/
		// This includes all forms of Unicode 6 whitespace (including \n and \r) except Ogham space mark.
		realWhitespace: "[ \\n\\r\\f\\t\\v\\u00a0\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]",

		// This handles alphanumeric ranges not covered by \w. Doesn't include hyphens or underscores.
		anyRealLetter:  "[\\dA-Za-z\\u00c0-\\u00de\\u00df-\\u00ff\\u0150\\u0170\\u0151\\u0171\\uD800-\\uDFFF]",

		anyUppercase, anyLowercase,

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
			return (e + "").toLowerCase().replace(/-|_/g, "");
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
			
			This takes some shortcuts to avoid use of the costly $css() function as much as possible,
			hence, it can only "probably" say so.
			
			This is used to crudely determine whether to make a <tw-transition-container> inline or block,
			given that block children cannot inherit opacity from inline parents in Chrome (as of April 2015).
		*/
		childrenProbablyInline(jq) {
			/*
				This is used to store elements which daunted all of the easy tests,
				so that $css() can be run on them after the first loop has returned all-true.
			*/
			const unknown = [];
			return Array.prototype.every.call(jq.findAndFilter('*'), elem => {
				/*
					If it actually has "style=display:inline", "hidden", or "style=display:none"
					as an inline attribute, well, that makes life easy for us.
				*/
				if (elem.hidden || /none|inline/.test(elem.style.display)
						|| /display: (?!none|inline)/.test(elem.getAttribute('style'))) {
					return true;
				}
				/*
					If the children contain an element which is usually block,
					then *assume* it is and return false early.
				*/
				if (usuallyBlockElements.includes(elem.tagName.toLowerCase())
						/*
							If it has an inline style which is NOT none or inline,
							then go ahead and return false.
						*/
						|| /none|inline/.test(elem.style.display)
						|| /display: (?!none|inline)/.test(elem.getAttribute('style'))) {
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
			&& unknown.every(elem => /none|inline/.test(elem.style.display));
		},

		/*
			Replaces oldElem with newElem while transitioning between both.
		*/
		transitionReplace(oldElem, newElem, transIndex) {
			const closest = oldElem.closest('tw-hook');
			if (closest.length > 0) {
				oldElem = closest;
			}

			// Create a transition-main-container
			const container1 = $('<tw-transition-container>').css('position', 'relative');

			// Insert said container into the DOM (next to oldElem)
			container1.insertBefore(oldElem.first());

			let container2a;
			if (newElem) {
				// Create a transition-in-container
				container2a = $('<tw-transition-container>').appendTo(container1);

				// Insert new element
				newElem.appendTo(container2a);
			}

			// Create a transition-out-container
			// and insert it into the transition-main-container.
			const container2b = $('<tw-transition-container>').css('position', 'absolute')
				.prependTo(container1);

			// Insert the old element into the transition-out-container
			oldElem.detach().appendTo(container2b);

			// Transition-out the old element, removing it

			Utils.transitionOut(container2b, transIndex);

			// Transition-in the new element

			if (newElem) {
				Utils.transitionIn(container2a, transIndex, function () {
					// Remove container1 and container2a
					container2a.unwrap().children().first().unwrap();
				});
			}
		},

		/*
			Transition an element out.
		*/
		transitionOut(el, transIndex, transitionTime, transitionDelay = 0, transitionSkip = 0, expedite = 0, transitionOrigin = undefined) {
			/*
				Quick early exit.
			*/
			if (el.length === 0) {
				return;
			}
			transitionTime = transitionTime || defaultTransitionTime(transIndex);

			const childrenInline = Utils.childrenProbablyInline(el),
				/*
					If the element is not a tw-hook or tw-passage, we must
					wrap it in a temporary element first, which can thus be
					animated using CSS.
				*/
				mustWrap =
					el.length > 1 || !childrenInline ||
					!['tw-hook','tw-passage'].includes(el.tag());
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

			if (childrenInline) {
				/*
					If there are no element children of the container (only text), simply use 'inline'.
				*/
				el.css('display','inline' + (el.children().length ? '-block' : ''));
			}
			/*
				Each frame, reduce the delay, and potentially reduce it further if this
				transition can be skipped and an input is being held.
			*/
			onTransitionComplete(el, transitionTime + transitionDelay - expedite, transitionSkip, () => {
				/*
					As a transition-out, all that needs to be done at the end is remove the element.
				*/
				el.remove();
			});
		},

		/*
			Transition an element in.
		*/
		transitionIn(el, transIndex, transitionTime, transitionDelay = 0, transitionSkip = 0, expedite = 0, transitionOrigin = undefined) {
			/*
				Quick early exit.
			*/
			if (el.length === 0) {
				return;
			}
			transitionTime = transitionTime || defaultTransitionTime(transIndex);
			const childrenInline = Utils.childrenProbablyInline(el),
				/*
					If the element is not a tw-hook or tw-passage, we must
					wrap it in a temporary element first, which can thus be
					animated using CSS.
				*/
				mustWrap =
					el.length > 1 || !childrenInline ||
					!['tw-hook','tw-passage'].includes(el.tag());
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
			el.attr("data-t8n", transIndex).addClass("transition-in").css({
				'animation-duration': transitionTime + "ms",
				'animation-delay':   (transitionDelay - expedite) + "ms",
			});
			
			if (childrenInline) {
				/*
					If there are no element children of the container (only text), simply use 'inline'.
				*/
				el.css('display','inline' + (el.children().length ? '-block' : ''));
			}
			onTransitionComplete(el, transitionTime + transitionDelay - expedite, transitionSkip, (elapsedRealTime) => {
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
						child.css('animation-delay', (Utils.cssTimeUnit(child.css('animation-delay') || 0) - elapsedRealTime) + "ms");
					});
					el.contents().unwrap();
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
			Logging utilities
		*/

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
			Asserts that an object doesn't lack a necessary property.
			This and the next method provide some shape-checking
			to important functions.
		*/
		assertMustHave(object, props) {
			if (!window.console) {
				return;
			}
			for(let i = 0; i < props.length; i += 1) {
				if(!(props[i] in object)) {
					console.error("Assertion failed: object"
						+ " lacks property " + props[i]);
				}
			}
		},

		/*
			Asserts that an object has no property extensions.
		*/
		assertOnlyHas(object, props) {
			if (!window.console) {
				return;
			}
			for(let i in object) {
				if (!props.includes(i)) {
					console.error("Assertion failed: object"
						+ " had unexpected property '" + i + "'!");
				}
			}
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
			Constants
		*/

		/*
			This is used as a more semantic shortcut to the <tw-story> element.
		*/
		get storyElement() {
			return storyElement;
		},

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
