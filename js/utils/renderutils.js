"use strict";
define(['jquery', 'utils', 'renderer'], function($, Utils, Renderer) {
	/*
		This is used to create dialogs for the (prompt:), (confirm:) and (alert:) macros, as well as
		the warning dialog for (loadgame:). This may be expanded in the future to offer more author-facing
		customisability.
	*/
	function dialog({section, parent = Utils.storyElement, cd, message = '', defaultValue, buttons = [{name:"OK", confirm:true, callback: Object}] } = {}) {
		const ret = $("<tw-backdrop><tw-dialog>"
			/*
				The defaultValue denotes that it should have a text input element, and provide
				the element's final contents to the confirmCallback.
			*/
			+ ((defaultValue || defaultValue === "") ?
				"<input type=text style='display:block;margin:0 auto'></input>\n" : "")
			+ '<tw-dialog-links>'
			/*
				The confirmCallback is used to differentiate (alert:) from (confirm:). Its presence
				causes a second "Cancel" link to appear next to "OK".
			*/
			+ (buttons.length
					? buttons.reduce((code, {name}, i) => code + "<tw-link style='margin:0 "
						+ (i === buttons.length-1 ? "0 0 0.5em" : i === 0 ? "0.5em 0 0" : '0.5em') + "' tabindex=0>" + name + "</tw-link>", '')
					: "<tw-link tabindex=0>" + buttons[0].name + "</tw-link>"
				)
			+ "</tw-dialog-links></tw-dialog></tw-backdrop>");
		const dialog = ret.find('tw-dialog');
		/*
			Sadly, this needs to be installed in the DOM now, so that certain transitions
			that alter transitionOrigin (namely "zoom") are able to read the mouse position accurately.
		*/
		parent.append(ret);
		/*
			The user-provided text is rendered separately from the rest of the dialog, so that injection bugs, such as
			inserting closing </tw-dialog> tags, are harder to bring about.
			The section being provided denotes that this is user-specified code (rather than in-engine error message code,
			such as in Harlowe.js).
		*/
		if (section) {
			section.renderInto(message, dialog, Object.assign({}, cd, {append:"prepend"}));
			/*
				The following is a rather unfortunate kludge: because the <tw-dialog> has already been rendered, a (t8n:)
				attached to the (dialog:) (hence, on the ChangeDescriptor) can't wrap it, despite intuitively seeming like it
				should. So, we forcibly extract the <tw-transition-container>
				and wrap the <tw-dialog> in it.
			*/
			const t8nContainer = cd && cd.transition && ret.find('tw-dialog > tw-transition-container');
			if (t8nContainer && t8nContainer.length) {
				t8nContainer.appendTo(ret).append(dialog.prepend(t8nContainer.contents().detach()));
			}
		}
		else {
			dialog.prepend(Renderer.exec(message));
		}

		/*
			The passed-in defaultValue string, if non-empty, is used as the input element's initial value.
		*/
		if (defaultValue) {
			const inputEl = ret.find('input').last();
			inputEl.val(defaultValue)
				// Pressing Enter should submit the given string.
				.on('keypress', ({which}) => {
					if (which === 13) {
						ret.remove();
						/*
							Find any button with the internal "confirm" boolean, and run its callback.
						*/
						buttons.filter(b => b.confirm).forEach(b => b.callback());
					}
				});
			// Regrettably, this arbitrary timeout seems to be the only reliable way to focus the <input>.
			setTimeout(() => inputEl.focus(), 100);
		}

		/*
			Finally, set up the callbacks. All of them remove the dialog from the DOM automatically,
			to save the consumer from having to do it.
		*/

		buttons.reverse().forEach((b, i) => {
			$(ret.find('tw-link').get(-i-1)).on('click', () => { ret.remove(); b.callback(); });
		});

		return ret;
	}


	const realWhitespace  = RegExp(Utils.realWhitespace + "+");
	const realWhitespaceG = RegExp(Utils.realWhitespace + "+", 'g');

	/*
		A specific, simpler case for selecting substrings in text nodes: selecting
		every character individually (as well as full runs of whitespace).
	*/
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
		This quick memoized feature test checks if the current platform supports Node#normalize().
	*/
	const supportsNormalize = (() => {
		let result;
		return () => {
			if (result !== undefined) {
				return result;
			}
			const p = $('<p>');
			/*
				If the method is absent, then...
			*/
			if (!p[0].normalize) {
				return (result = false);
			}
			/*
				There are two known normalize bugs: not normalising text ranges containing a hyphen,
				and not normalising blank text nodes. This attempts to discern both bugs.
			*/
			p.append(document.createTextNode("0-"),document.createTextNode("2"),document.createTextNode(""))
				[0].normalize();
			return (result = (p.contents().length === 1));
		};
	})();

	/*
		Both of these navigates up the tree to find the nearest text node outside this element,
		earlier or later in the document.
		These return an unwrapped Text node, not a jQuery.
	*/
	function prevParentTextNode(e) {
		const elem = e[0],
			parent = e.parent();
		/*
			Quit early if there's no parent or if the element is (or contains) <tw-story>.
		*/
		if (!parent.length || e.findAndFilter('tw-story').length)  {
			return null;
		}
		/*
			Get the parent's text nodes, and obtain only the last one which is
			earlier (or later, depending on positionBitmask) than this element.
		*/
		let textNodes = parent.textNodes().filter((e) => {
			const pos = e.compareDocumentPosition(elem);
			return pos & 4 && !(pos & 8);
		});
		textNodes = textNodes[textNodes.length-1];
		/*
			If no text nodes were found, look higher up the tree, to the grandparent.
		*/
		return !textNodes ? prevParentTextNode(parent) : textNodes;
	}
	
	function nextParentTextNode(e) {
		const elem = e[0],
			parent = e.parent();
		/*
			Quit early if there's no parent or if the element is (or contains) <tw-story>.
		*/
		if (!parent.length || e.findAndFilter('tw-story').length) {
			return null;
		}
		/*
			Get the parent's text nodes, and obtain only the last one which is
			earlier (or later, depending on positionBitmask) than this element.
		*/
		const textNodes = parent.textNodes().filter((e) => {
			const pos = e.compareDocumentPosition(elem);
			return pos & 2 && !(pos & 8);
		})[0];
		/*
			If no text nodes were found, look higher up the tree, to the grandparent.
		*/
		return !textNodes ? nextParentTextNode(parent) : textNodes;
	}

	/*
		Collapsing elements are either the rendered <tw-collapsed> elements, or
		elements given [collapsing=true] by a changer or enchantment.
	*/
	const collapsing = 'tw-collapsed,[collapsing=true]';
	/*
		<tw-collapsed> elements should collapse whitespace inside them in a specific manner - only
		single spaces between non-whitespace should remain.
		This function performs this transformation by modifying the text nodes of the passed-in element.
	*/
	function collapse(elem) {
		/*
			A .filter() callback which removes nodes inside a <tw-verbatim>,
			a replaced <tw-hook>, or a <tw-expression> element, unless it is also inside a
			<tw-collapsed> inside the <tw-expression>. Used to prevent text inside those
			elements from being truncated.
		*/
		function noVerbatim(e) {
			/*
				The (this || e) dealie is a kludge to support its use in a jQuery
				.filter() callback as well as a bare function.
			*/
			return $(this || e).parentsUntil(collapsing)
				.filter('tw-verbatim, tw-expression, '
					/*
						Also, remove nodes that have collapsing=false on their parent elements,
						which is currently (June 2015) only used to denote hooks whose contents were (replace:)d from
						outside the collapsing syntax - e.g. {[]<1|}(replace:?1)[Good  golly!]
					*/
					+ '[collapsing=false]')
				.length === 0;
		}
		/*
			We need to keep track of what the previous and next exterior text nodes are,
			but only if they were also inside a <tw-collapsed>.
		*/
		let beforeNode = prevParentTextNode(elem);
		if (!$(beforeNode).parents(collapsing).length) {
			beforeNode = null;
		}
		let afterNode = nextParentTextNode(elem);
		if (!$(afterNode).parents(collapsing).length) {
			afterNode = null;
		}
		/*
			- If the node contains <br>s or <tw-consecutive-br>s that aren't raw, replace with a single space.
		*/
		const br = 'br:not([data-raw]),tw-consecutive-br:not([data-raw])';
		elem.find(br).filter(noVerbatim).replaceWith(document.createTextNode(" "));
		/*
			To properly obtain the text nodes in elements in the top level of the collection after replacing them,
			simultaneously replace them in the DOM and in the collection.
		*/
		elem = $(elem.get().map(e => $(e).filter(noVerbatim).is(br) ? $(document.createTextNode(" ")).replaceAll(e)[0] : e ));
		/*
			Having done that, we can now work on the element's nodes without concern for modifying the set.
		*/
		const nodes = elem.textNodes();
		
		/*
			This is part of an uncomfortable #kludge used to determine whether to
			retain a final space at the end, by checking how much was trimmed from
			the finalNode and lastVisibleNode.
		*/
		let finalSpaces = 0;
		
		nodes.reduce((prevNode, node) => {
			/*
				- If the node is inside a <tw-verbatim> or <tw-expression>, regard it as a solid Text node
				that cannot be split or permuted. We do this by returning a new, disconnected text node,
				and using that as prevNode in the next iteration.
			*/
			if (!noVerbatim(node)) {
				return document.createTextNode("A");
			}
			/*
				- If the node contains runs of whitespace, reduce all runs to single spaces.
				(This reduces nodes containing only whitespace to just a single space.)
			*/
			node.textContent = node.textContent.replace(realWhitespaceG,' ');
			/*
				- If the node begins with a space and previous node ended with whitespace or is empty, trim left.
				(This causes nodes containing only whitespace to be emptied.)
			*/
			if (node.textContent[0] === " "
					&& (!prevNode || !prevNode.textContent || prevNode.textContent.search(/\s$/) >-1)) {
				node.textContent = node.textContent.slice(1);
			}
			return node;
		}, beforeNode);
		/*
			- Trim the rightmost nodes up to the nearest visible node.
			In the case of { <b>A </b><i> </i> }, there are 3 text nodes that need to be trimmed.
			This uses [].every to iterate up until a point.
		*/
		[...nodes].reverse().every((node) => {
			if (!noVerbatim(node)) {
				return false;
			}
			// If this is the last visible node, merely trim it right, and return false;
			if (!node.textContent.match(/^\s*$/)) {
				node.textContent = node.textContent.replace(/\s+$/, (substr) => {
					finalSpaces += substr.length;
					return '';
				});
				return false;
			}
			// Otherwise, trim it down to 0, and set finalSpaces
			else {
				finalSpaces += node.textContent.length;
				node.textContent = "";
				return true;
			}
		});
		/*
			- If the afterNode is present, and the previous step removed whitespace, reinsert a single space.
			In the case of {|1>[B ]C} and {|1>[''B'' ]C}, the space inside ?1 before "C" should be retained.
		*/
		if (finalSpaces > 0 && afterNode) {
			nodes[nodes.length-1].textContent += " ";
		}
		/*
			Now that we're done, normalise the nodes.
			(But, certain browsers' Node#normalize may not work,
			in which case, don't bother at all.)
		*/
		elem[0] && supportsNormalize() && elem[0].normalize();
	}

	/*
		A RegExp and parser for "geometry strings", strings of = signs and other characters which define
		geometric dimensions for a box-type element. Used by macros with "box" in their title.
	*/
	const geomStringRegExp = /^(=*)([^=]+)=*$/;
	function geomParse(str) {
		const length = str.length;
		const [matched, left, inner] = (geomStringRegExp.exec(str) || []);
		if (!matched) {
			return {marginLeft:0, size:0};
		}
		return {marginLeft: (left.length/length)*100, size: (inner.length/length)*100};
	}
	
	return Object.freeze({dialog, realWhitespace, textNodeToChars, findTextInNodes, collapse, geomStringRegExp, geomParse });
});
