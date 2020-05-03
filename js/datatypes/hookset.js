"use strict";
define(['jquery', 'utils', 'utils/selectors', 'markup'], ($, Utils, Selectors, {Patterns}) => {
	/*
		A HookSet is an object representing a "hook selection". Hooks in
		Twine passages can have identical titles, and both can therefore be
		selected by the same hook reference. This class represents
		these selections within a given Section.

		In addition to regular hook selections, there is also "pseudo-hooks".
		A "pseudo-hook" is section text selected using a search string, rather
		than a hook tag reference. A macro instantiation like...
			(remove: "cats")
		...would make a pseudo-hook that matches, or "hooks", every instance of
		the string "cats" in the passage. So, without needing to mark up
		that text with hook syntax, the author can still manipulate it intuitively.
		This is a powerful construct!
	*/

	/*d:
		HookName data
		
		A hook name is like a variable name, but with `?` replacing the `$` sigil. When given to a macro that accepts it,
		it signifies that *all* hooks with the given name should be affected by the macro.
		For instance, `(click: ?red)` will cause *all* hooks with a `<red|` or `|red>` nametag to be subject to the (click:)
		macro's behaviour.

		In earlier Harlowe versions, it was possible to also use hook names with (set:), (put:) and (move:) to modify the
		text of the hooks, but macros such as (replace:) should be used to accomplish this instead.

		If a hook name does not apply to a single hook in the given passage (for instance, if you type `?rde` instead of
		`?red`) then no error will be produced. This is to allow macros such as (click:) to be placed in the `header` or `footer`
		passages, and thus easily affect hooks in every passage, even if individual passages lack the given hook name. Of course, it
		means that you'll have to be extra careful while typing the hook name, as misspellings will not be easily identified
		by Harlowe itself.

		Built in hook names:

		There are four special built-in hook names, ?Page, ?Passage, ?Sidebar and ?Link, which, in addition to selecting named hooks,
		also affect parts of the page.

		* `?Page` selects the page element (to be precise, the `<tw-story>` element) and using it with the (background:) macro lets you
		change the background of the entire page.
		* `?Passage` affects just the element that contains the current passage's text (to be precise, the `<tw-passage>` element) and lets you,
		for instance, change the (text-colour:) or (font:) of all the text, or apply complex (css:) to it.
		* `?Sidebar` selects the passage's sidebar containing undo/redo icons (`<tw-sidebar>`). You can style it with styling macros, or use
		(replace:) or (append:) to insert your own text into it.
		* `?Link` selects all of the links (passage links, and those created by (link:) and other macros) in the passage.

		Data names:

		If you only want some of the hooks with the given name to be affected, you can treat the hook name as a sort of read-only
		array: specify just its `1st` element (such as by `?red's 1st`) to only affect the first such named hook in the passage, access
		the `last` to affect the last, and so forth. You can also specify multiple elements, using syntax like `1stto3rd`, to affect all of
		the elements between and including those positions. Even specifying an array of arbitrary positions, like `?red's (a:1,3,7)`, will work.
		Unlike arrays, though, you can't access their `length`, nor can you spread them with `...`.

		Moreover, a few special data names exist.
		* `chars` (as in `?title's chars`) selects each individual character inside the hook,
		as if it was in its own hook. This can be used for a variety of text effects - using (enchant:) with `?hook's chars's 1st` can be used to
		give a hook a styled "drop-cap" without having to explicitly style the leading character.
		* `lines` (as in `?passage's lines`) selects individual lines of text within a hook. A line is any run of text or code between line breaks
		(or the passage's start and end) - a word-wrapped paragraph of prose is thus considered a single "line" as a result.
		* `links` (as in `?body's links`) is similar in use to `?link`, but only selects links within the hook.

		**Warning:** using `chars` with (enchant:) may cause text-to-speech assistive programs to fail to read the enchanted
		passage correctly. If this would be unacceptable for you or your story, refrain from using `chars` with (enchant:).

		| Data name | Example | Meaning
		|---
		| `1st`,`2nd`,`last`, etc. | `?hook's last`, `1st of ?hook` | Only one hook with the given name, at a certain position in the passage relative to the rest (first with its name, last with its name, etc).
		| `1stto3rd`, `4thlastto2ndlast` etc. | `?hook's 2ndto5th` | Only hooks with this name, at a certain sequence of positions (such as the first, second and third for `1stto3rd`) relative to the rest.
		| `chars` | `?title's chars`, `chars of ?scream` | Each individual character within the hook, as if the characters were hooks in themselves.
		| `links` | `?body's links`, `links of ?aside` | Each link inside the hook.
		| `lines` | `?passage's lines`, `lines of ?passage` | Each span of continuous text, separated by line breaks, inside the passage.

		Operators:

		Unlike most forms of data, only one operator can be used with hook names.

		| Operator | Purpose | Example
		|---
		| `+` | Creates a hook name that, when given to macros, causes both of the added hooks to be affected by that macro. | `(click: ?red + ?blue's 1st)` affects all hooks tagged `red`, as well as the first hook tagged `blue`.
	*/

	/*
		A specific, simpler case for selecting substrings in text nodes: selecting
		every character individually (as well as full runs of whitespace).
	*/
	const realWhitespace = new RegExp(Utils.realWhitespace + "+");
	function textNodeToChars(node) {
		const chars = [...node.textContent];
		/*
			If it only has 1 character in it, don't enter the loop.
		*/
		if (chars.length === 1) {
			return [node];
		}
		/*
			Convert the textContent to an array of code points...
		*/
		return chars
			/*
			 ...but leaving runs of whitespace as-is.
			*/
			.reduce((a,e) => {
				if (e.match(realWhitespace) && a.length && a[a.length-1].match(realWhitespace)) {
					a[a.length-1] += e;
				}
				else {
					a.push(e);
				}
				return a;
			},[])
			.reduce((a,char) => {
				/*
					A gentle reminder: Text#splitText() returns the remainder of the split,
					leaving the split-off part as the mutated original node. So, this counterinuitive
					method body is the result.
				*/
				const orig = node;
				if (char.length < node.textContent.length) {
					node = node.splitText(char.length);
				}
				return a.concat(orig);
			},[]);
	}

	/*
		Retrieves a substring from a text node by slicing it into (at most 3) parts,
		specified by the inclusive start and non-inclusive end indices.
	*/
	function sliceNode(node, start, end) {
		/*
			We need to cache the length here, as the node is transformed
			by the subsequent splitText calls.
		*/
		const l = node.textContent.length;
		/*
			Of course, we can't omit simple range checks before going further.
		*/
		if (start >= l) {
			return;
		}
		/*
			Now, we do the first split, separating the start of the node
			from the start of the substring.
			(We skip this if the substring is at the start, as splitting
			will create a 0-char text node.)
		*/
		let newNode;
		const ret = [(newNode = (start === 0 ? node : node.splitText(start)))];
		if (end) {
			/*
				This function supports negative end indices, using the
				following quick conversion:
			*/
			if (end <= 0) {
				end = l - end;
			}
			/*
				If that conversion causes end to become equal to l, we
				don't bother (as it will create another 0-char text node).
			*/
			if (end < l) {
				/*
					Otherwise, the split will be performed.
					Note that this returns the rightmost portion of the split,
					i.e. from the end of the substring onwards.
				*/
				ret.push(newNode.splitText(end - start));
			}
		}
		return ret;
	}
	
	/*
		This complicated function takes an array of contiguous sequential
		text nodes, and a search string, and does the following:
		
		1. Finds all occurrences of the search string in the sequence,
		even where the string spans multiple text nodes,
		
		2. Splits the nodes along the occurrences of the string, and
		then returns these split-off nodes.
		
		The purpose of this is to allow transformations of exact
		textual matches within passage text, *regardless* of the
		actual DOM hierarchy which those matches bestride.
	*/
	function findTextInNodes(textNodes, searchString) {
		let
			/*
				examinedNodes holds the text nodes which are currently being
				scrutinised for any possibility of holding the search string.
			*/
			examinedNodes = [],
			/*
				examinedText holds the textContent of the entire set of
				examinedNodes, for easy comparison and inspection.
			*/
			examinedText = '',
			/*
				ret is the returned array of split-off text nodes.
			*/
			ret = [];
		
		/*
			First, if either search set is 0, return.
		*/
		if (!textNodes.length || !searchString) {
			return ret;
		}
		/*
			We progress through all of the text nodes.
		*/
		while(textNodes.length > 0) {
			/*
				Add the next text node to the set of those being examined.
			*/
			examinedNodes.push(textNodes[0]);
			examinedText += textNodes[0].textContent;
			textNodes.shift();
			
			/*
				Now, perform the examination: does this set of nodes contain the string?
			*/
			let index = examinedText.indexOf(searchString);
			/*
				If so, proceed to extract the substring.
			*/
			if (index > -1) {
				const remainingLength = examinedText.length - (index + searchString.length);
				/*
					First, remove all nodes which do not contain any
					part of the search string (as this algorithm scans left-to-right
					through nodes, these will always be in the left portion of the
					examinedNodes list).
				*/
				while(index >= examinedNodes[0].textContent.length) {
					index -= examinedNodes[0].textContent.length;
					examinedNodes.shift();
				}
				/*
					In the event that it was found within a single node,
					simply slice that node only.
				*/
				if (examinedNodes.length === 1) {
					const slices = sliceNode(examinedNodes[0], index, index + searchString.length);
					ret.push(slices[0]);
					// The extra slice at the end shall be examined
					// in the next recursion.
					if (slices[1]) {
						textNodes.unshift(slices[1]);
					}
					break;
				}
				/*
					We now push multiple components: a slice from the first examined node
					(which will extract the entire right side of the node):
				*/
				ret.push(sliceNode(
					examinedNodes[0],
					index,
					examinedNodes[0].length
				)
				/*
					(Since we're extracting the right side, there will be no 'end' slice
					returned by sliceNode. So, just use the first returned element.)
				*/
				[0]);
				/*
					Then, all of the nodes between first and last:
				*/
				ret.push(...examinedNodes.slice(1,-1));
				/*
					Then, a slice from the last examined node (which will extract
					the entire left side).
				*/
				const slices = sliceNode(
					examinedNodes[examinedNodes.length-1],
					0,
					examinedNodes[examinedNodes.length-1].textContent.length - remainingLength
				);
				ret.push(slices[0]);
				// The extra slice at the end shall be examined
				// in the next recursion.
				if (slices[1]) {
					textNodes.unshift(slices[1]);
				}
				// Finally, if any of the above were undefined, we remove them.
				ret = ret.filter(Boolean);
				break;
			}
		}
		/*
			The above only finds the first substring match. The further ones
			are obtained through this recursive call.
		*/
		return [ret, ...findTextInNodes(textNodes, searchString)];
	}

	/*
		Given a search string, this wraps all identified text nodes inside the given DOM
		with <tw-pseudo-hook> elements.
		Note this may permute the DOM by splitting text nodes that are a superstring
		of the search string.

		@param {String} searchString The passage text
		@param {jQuery} dom The DOM in which to search
		@return {jQuery} A jQuery set holding the nodes.
	*/
	function wrapTextNodes(searchString, dom) {
		const nodes = findTextInNodes(dom.textNodes(), searchString);
		let ret = $();
		nodes.forEach((e) => {
			ret = ret.add($(e).wrapAll('<tw-pseudo-hook>').parent());
		});
		return ret;
	}

	/*
		Convert a hook name string to a CSS selector.
		This includes the "built-in" names that target certain
		Harlowe elements: ?page, ?passage, ?sidebar, ?link.

		@param {String} chain to convert
		@return {String} classlist string
	*/
	function hookToSelector(c) {
		c = Utils.insensitiveName(c).replace(/\?/g, '').replace(/"/g, "&quot;");
		let ret = Selectors.hook+'[name="' + c + '"]';
		/*
			The built-in names work alongside user names: |page>[] will be
			selected alongside the <tw-story> element.
		*/
		ret += ({
			page: ", tw-story",
			passage: ", tw-passage",
			sidebar: ", tw-sidebar",
			link: ", tw-link, .enchantment-link",
		}[c]) || "";
		return ret;
	}

	/*
		Hooks are "live" in the sense that their selected hooks are re-computed on
		every operation performed on them.

		This private method returns a jQuery collection of every <tw-hook>
		in this HookSet's Section which matches this HookSet's selector string.
	*/
	function hooks({dom}) {
		let ret = $();

		/*
			First, take the elements from all the previous hooks that
			this was concatenated to. (For instance, [?a] + ?b's 1st)
		*/
		if (this.prev) {
			ret = ret.add(hooks.call(this.prev, {dom}));
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
			/*
				The index is an array in cases like "?a's (a:1,2,4)".
			*/
			if (Array.isArray(index)) {
				// Yes, jQuery's .get() can handle negative indices.
				return index.reduce((a,i) => a.add(elements.get(i)), $());
			}
			/*
				The index is an object in cases like "?a's 12thto3rdlast".
			*/
			else if (index && typeof index === "object" && "first" in index && "last" in index) {
				let {first, last} = index;
				const {length} = elements;
				if (first < 0) { first += length; }
				if (last < 0) { last += length; }
				
				/*
					Due to the surprisingly prohibitive cost of $().add(), these are gathered as
					an array first.
				*/
				let arr = [elements.get(first)];
				while (first !== last) {
					first += Math.sign(last - first);
					arr.push(elements.get(first));
				}
				return $(arr);
			}
			// TODO: "3n+1th" selectors
			else if (typeof index === "string") {
				/*
					"?hook's chars" selects the individual characters inside ?hook. Notice that
					textNodeToChars() splits up Text nodes whenever it's called, as with wrapTextNodes().

					Again, due to the cost of $().add(), this uses element arrays, and only converts to jQuery at the end.
				*/
				if (index === "chars") {
					let arr = [];
					for (let t of elements.textNodes()) {
						for (let c of textNodeToChars(t)) {
							arr.push(c);
						}
					}
					return $(arr);
				}
				/*
					"?hook's links" selects links within the ?hook.
					This selector should be in keeping with ?Link, above.
				*/
				if (index === "links") {
					return elements.find('tw-link, .enchantment-link');
				}
				if (index === "lines") {
					/*
						"Lines" excludes the sidebar, so that the "undo" and "redo" links aren't included.
					*/
					const brs = elements.findAndFilter('br:not(tw-sidebar *)').get();
					/*
						Place all of the elements into the current collection. When one is found that's after
						the current <br>, create a new collection.
						Again, due to the cost of $().add(), this uses element arrays, and only converts to jQuery at the end.
					*/
					const lines = [[]];
					elements.textNodes(":not(tw-sidebar):not(tw-sidebar *)").forEach(node => {
						if (node.compareDocumentPosition(brs[0]) & 2) {
							brs.shift();
							lines.push([]);
						}
						lines[lines.length-1] = lines[lines.length-1].concat(node);
					});
					return $(lines.map(e => $(e).wrapAll('<tw-pseudo-hook>').parent()[0]));
				}
			}
			// Luckily, negatives indices work fine with $().get().
			return $(elements.get(index));
		};
		if (this.selector) {
			let ownElements;
			/*
				If this is a pseudo-hook (search string) selector, we must gather text nodes.
			*/
			if (!this.selector.match("^" + Patterns.hookRef + "$")) {
				/*
					Note that wrapTextNodes currently won't target text directly inside <tw-story>,
					<tw-sidebar> and other <tw-passage>s.
				*/
				ownElements = wrapTextNodes(this.selector, dom);
			}
			else {
				ownElements = dom.add(dom.parentsUntil(Utils.storyElement.parent()))
					.findAndFilter(hookToSelector(this.selector));
			}
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
			ret = ret.add(this.properties.reduce(reducer, hooks.call(this.base, {dom})));
		}
		return ret;
	}

	/*
		This is used exclusively by TwineScript_is() to provide a crude string serialisation
		of all of a HookSet's relevant distinguishing properties, order-insensitive, which can
		be compared using ===. This takes advantage of the fact that all of these properties
		can be serialised to strings with little fuss.

		Note: this actually returns an array, so that it can recursively call itself. But, it's
		expected that consumers will convert it to a string.
	*/
	function hash(hookset) {
		if (!hookset) {
			return [];
		}
		const {selector, base, properties, prev} = hookset;
		// The hash of ?red + ?blue should equal that of ?blue + ?red. To do this,
		// the prev's hash and this hookset's hash is added to an array, which is then sorted and returned.
		return [JSON.stringify([Utils.insensitiveName(selector) || "", hash(base), [...properties].sort()]), ...hash(prev)].sort();
	}
	
	const HookSet = Object.freeze({
		
		/*
			An Array forEach-styled iteration function. The given function is
			called on every <tw-hook> in the section DOM
			
			This is currently just used by ChangeDescriptor.render and Enchantment.enchantScope,
			to iterate over each word and render it individually.
			
			@param {Section} The section the hooks should target.
			@param {Function} The callback, which is passed the following:
				{jQuery} The <tw-hook> element to manipulate.
		*/
		forEach(section, fn) {
			const ret = hooks.call(this, section).each(function(i) {
				fn($(this), i);
			});
			/*
				After calling hooks(), we must remove the <tw-pseudo-hook> elements.
				We don't normalize() the text nodes because that may rejoin various split chars
				that are also being operated on.
				Note that this needs .contents(), not .children(), because only the former grabs text nodes.
			*/
			section.dom.findAndFilter('tw-pseudo-hook').contents().unwrap();
			return ret;
		},

		/*
			Provides all of the hooks selected by this HookSet.
		*/
		hooks(section) {
			return hooks.call(this, section);
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
				return "a complex hook name";
			}
			return this.selector + " (a hook name)";
		},

		TwineScript_TypeName: "a hook name (like ?this)",
		/*
			HookSets cannot be assigned to variables.
		*/
		TwineScript_Unstorable: true,

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
			HookSets are identical if they have the same selector, base, properties (and if
			a property is a slice, it is order-sensitive) and prev.
		*/
		TwineScript_is(other) {
			return hash(this) + "" === hash(other) + "";
		},

		/*
			These are used by VarRef, under the assumption that this is a sequential object.
			Accessing 1st, 2nd, etc. for a HookSet will produce only the nth document-order
			element for that hookset.

			Note that the index may actually be one of the following data types instead of a single index:
			* An array of indices, as created by "?a's (a:1,2,4)". The order of this array must be preserved,
			so that "?a's (a:2,4)'s 2nd" works correctly.
			* A {first: Number, last:Number} object. This is created by "?a's 1stTo2ndlast" and such.
		*/
		TwineScript_GetProperty(prop) {
			return HookSet.create(undefined, this, [prop], undefined);
		},

		/*
			This single array determines the legal property names for HookSets.
		*/
		TwineScript_Properties: ['chars','links','lines'],

		// As of 19-08-2016, HookSets no longer have a length property, because calculating it requires
		// passing in a section, and it doesn't make much sense to ever do so.

		TwineScript_Clone() {
			return HookSet.create(this.selector, this.base, this.properties, this.prev);
		},
		
		/*
			Creates a new HookSet, which contains the following:

			{String} selector: a hook name, such as "?flank" for ?flank, or a bare search string.
			{HookSet} base: an alternative to selector. A HookSet from which the properties
				are being extracted.
			{Array} properties: a set of properties to restrict the current set of hooks.
			{HookSet} prev: a hook which has been +'d with this one.

			Consider this diagram:

			[prev]    [selector] [properties]
			(?apple + ?banana's  2ndlast)'s 2ndlast
			[          base            ]   [properties]
		*/
		create(selector, base, properties = [], prev = undefined) {
			return Object.assign(Object.create(this || HookSet), {
				selector, base, properties, prev
			});
		},

		/*
			This brief sugar method is only used in macrolib/enchantments.
		*/
		from(arg) {
			return HookSet.isPrototypeOf(arg) ? arg : HookSet.create(arg);
		},
	});
	return HookSet;
});
