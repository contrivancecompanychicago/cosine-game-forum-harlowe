"use strict";
define('passages', ['jquery', 'utils/naturalsort', 'utils', 'markup', 'internaltypes/twineerror'], ($, NaturalSort, {insensitiveName,unescape,onStartup,impossible}, Markup, TwineError) => {
	const {assign} = Object;
	/*
		Passages
		A userland registry of Passage objects.
		Passage objects are simple Maps exposing passage data to public scripts.
		They have their string content (the "source"), their tags in an array, and their name.
	*/

	/*
		For a tiny bit of efficiency, the quick regexp used in preprocess() is stored here.
		This uses Patterns rather than Lexer's rules because those compiled RegExps for macroFront
		and macroName can't be combined into a single RegExp.
	*/
	const macroRegExp = RegExp(Markup.Patterns.macroFront + Markup.Patterns.macroName, 'ig');
	/*
		When the game starts, each passage is scanned for metadata macros using this method. An object
		holding one macro call for each metadata macro name is returned.
	*/
	function preprocess(src,name) {
		/*
			Metadata macros contain lambdas and other data, which is extracted from the passage
			code and attached to the passage map itself during startup.
			These names are hard-coded.
		*/
		const metadataMacros = ["metadata","storylet","exclusivity","urgency"];
		/*
			Since lexing all the passages at bootup is potentially rather expensive, these quick and hacky RegExp tests are
			used to check whether preprocessing is necessary.
		*/
		if (!(
			/*
				This does a quick RegExp query for metadata macros, instead of lexing the entire source.
			*/
			(src.match(macroRegExp) || []).some(e => metadataMacros.some(f => insensitiveName(e.slice(1,-1)) === f ))
		)) {
			return {};
		}
		/*
			For each macro:
			if it's a metadata macro outside macro scope, get its call
			if it's a metadata macro inside macro scope, error
			if it's a non-metadata macro after a metadata macro outside macro scope, error
		*/
		let afterNonMetadataMacro = false;
		const metadata = {};
		Markup.lex(src,name).children.forEach(function outsideMacroFn(token) {
			if (token.type === "macro") {
				const name = insensitiveName(token.name);
				if (metadataMacros.some(f => name === f)) {
					/*
						If an error was already reported for this metadata name, don't replace it.
					*/
					if (TwineError.isPrototypeOf(metadata[name])) {
						return;
					}
					/*
						Metadata macros can't appear after non-metadata macros.
					*/
					if (afterNonMetadataMacro) {
						metadata[name] = TwineError.create("syntax", `The (${token.name}:) macro can't appear after non-metadata macros.`);
						return;
					}
					/*
						Having two metadata macros of the same kind is an error. If there was already a match, produce a TwineError about it
						and store it in that slot.
						Technically we don't need this, because Passage.loadMetadata() raises a separate error if two metadata macros
						override each other's data. But, this one is more incisively descriptive.
					*/
					if (metadata[name]) {
						metadata[name] = TwineError.create("syntax", `There is more than one (${token.name}:) macro.`);
						return;
					}
					metadata[name] = token;
				}
				else {
					afterNonMetadataMacro = true;
				}
				token.children.forEach(function nestedMacroFn(token) {
					const name = insensitiveName(token.name);
					if (token.type === "macro" && metadataMacros.some(f => name === f)) {
						metadata[name] = TwineError.create("syntax", `The (${token.name}:) macro can't be inside another macro.`);
					}
					else token.children.forEach(nestedMacroFn);
				});
			}
			else token.children.forEach(outsideMacroFn);
		});
		return metadata;
	}

	/*
		Pass a <tw-passagedata> element into this constructor,
		and a Passage datamap will be produced.
	*/
	function Passage(elem) {
		const name = elem.attr('name');
		const source = unescape(elem.html());
		/*
			Metadata macros (such as (storylet:)) need to be extracted and applied to the passage datamap itself.
			The source is exclusively used by error messages and Debug Mode.
		*/
		const metadata = preprocess(source,name);

		return assign(new Map([
			/*
				Passage objects have the following properties:
				source: the raw TwineMarkup source of the passage.
			*/
			["source", source],
			/*
				tags: an array of its tags, as strings.
			*/
			["tags", (elem.attr('tags') || "").split(/\s/) || []],
			/*
				name: its name.
			*/
			["name", name],
		]),{
			/*
				These must unfortunately be own-properties, as passages must inherit from
				Map rather than this object.
			*/
			TwineScript_TypeName: "a passage datamap",
			TwineScript_ObjectName: "a passage datamap",
			/*
				The following is a temporary store of metadata returned from Renderer.preprocess(),
				which is crunched during loadMetadata() and removed.
			*/
			metadata,
			/*
				This is used to cache the lexed syntax tree. However, to save memory, only header and footer passages
				have their tree permanently stored. The others use the limited cache below.
			*/
			tree: null
		});
	}

	/*
		Since new passages can't ever be created (as of Dec 2021), it's safe to cache tag lookups.
	*/
	let tagCache = Object.create(null);
	/*
		Cache of lexed passage trees, so that passages visited frequently aren't lexed repeatedly.
	*/
	let passageTreeCache = [];
	/*
		Cache of Passages.allStorylets(). This is used by Debug Mode. Unlike the above, an empty array
		is a valid final value, so the 'uninitialised' value is null.
	*/
	let storyletCache = null;
	
	const Passages = assign(new Map(), {
		TwineScript_ObjectName: "the Passages datamap",
		
		/*
			This method retrieves passages which have a given tag.
		*/
		getTagged(tag) {
			/*
				Use the tag cache, if it exists.
			*/
			if (tagCache[tag]) {
				return tagCache[tag];
			}

			const tagSorter = NaturalSort('en', p => p.get('name'));
			const ret = [];
			this.forEach((v) => {
				const tags = v instanceof Map && v.get('tags');
				if (Array.isArray(tags) && tags.includes(tag)) {
					ret.push(v);
				}
			});
			ret.sort(tagSorter);
			/*
				Cache this result, now that it's computed.
			*/
			tagCache[tag] = ret;
			return ret;
		},

		/*
			This is (currently) exclusively used by the Harlowe codebase test runner.
		*/
		clearTagCache() {
			tagCache = Object.create(null);
		},

		/*
			Overrides for clear() and delete() that wipe the caches. Note that only the test runner
			should call these.
		*/
		clear() {
			Map.prototype.clear.call(this);
			this.clearTagCache();
			this.clearTreeCache();
			this.clearStoryletCache();
		},

		delete() {
			Map.prototype.delete.call(this, ...arguments);
			this.clearTagCache();
			this.clearTreeCache();
			this.clearStoryletCache();
		},

		/*
			Retrieve a cached lexed code tree for this passage's source,
			or lex it here and now.
		*/
		getTree(name) {
			if (!this.has(name)) {
				impossible('Passages.getTree', 'No passage name?');
				return [];
			}
			/*
				'header' and 'footer' passages are stored in their own cache which is never emptied.
			*/
			const p = this.get(name);
			const tags = p.get('tags');
			if (tags.includes('header') || tags.includes('footer') || tags.includes('debug-header') || tags.includes('debug-footer')) {
				if (!p.tree) {
					p.tree = Markup.lex(p.get('source'), name);
				}
				return p.tree;
			}
			/*
				First, retrieve it from the cache if it exists for this name.
			*/
			for (let i = 0; i < passageTreeCache.length; i += 1) {
				if (passageTreeCache[i] && passageTreeCache[i].place === name) {
					/*
						In addition to finding the tree, move it to the front to make
						it quicker to find later. Since the cache's limit is only 16
						entries, it shouldn't be too costly to do this that often.
					*/
					const entry = passageTreeCache.splice(i, 1)[0];
					passageTreeCache.unshift(entry);
					return entry;
				}
			}
			/*
				Entries in the cache are ordered by most recent retrieval, then by name.
				Again, the small size of the cache means that this shouldn't be too costly.
			*/
			const entry = Markup.lex(p.get('source'), name);
			passageTreeCache.unshift(entry);
			/*
				This maximum cache size is hard-coded.
			*/
			if (passageTreeCache.length > 16) {
				passageTreeCache.pop();
			}
			return entry;
		},

		clearTreeCache() {
			passageTreeCache = [];
		},

		/*
			Storylet macros like (open-storylets:) query every passage's storylet condition code using this method.
			They may supply a lambda to filter the passages with, first.
			The results are sorted in the order expected by (open-storylets:).
		*/
		getStorylets(section, passagesLambda) {
			/*
				For each passage that matches the lambda:
				If it has an "available" lambda, run the lambda. If the lambda returned true, put it on the list.
			*/
			const passages = (passagesLambda ? passagesLambda.filter(section, [...Passages.values()]) : [...Passages.values()]);
			if (TwineError.containsError(passages)) {
				return passages;
			}
			const active = [];
			let highestExclusivity = -Infinity;
			/*
				Populate the result, or return the first error that appeared when evaluating a passage's lambda.
			*/
			const error = passages.reduce((error, p) => {
				if (error) {
					return error;
				}
				const storylet = p.get('storylet');
				if (storylet) {
					const available = section.speculate(storylet, p.get('name'), "a (storylet:) macro");
					if (TwineError.containsError(available)) {
						/*
							Alter the error's message to report the name of the passage from which it originated.
						*/
						available.message = "There's an error in the storylet passage \"" + p.get('name') + "\":\n" + available.message;
						/*
							The original source code of the lambda is used as the error's source, instead of that of
							the (open-storylets:) macro call.
						*/
						available.source = storylet.TwineScript_ToSource();
						return available;
					}
					if (available) {
						/*
							Record the highest exclusivity of this passage before adding it to the active storylets array,
							for use below.
						*/
						const excl = p.get('exclusivity');
						highestExclusivity = Math.max(highestExclusivity, typeof excl === "number" ? excl : 0);
						active.push(p);
					}
				}
			}, undefined);
			if (error) {
				return error;
			}
			/*
				Filter results using the exclusivity restriction.
				Note that passages with no "exclusivity" metadata are treated as exclusivity 0,
				meaning giving a passage negative exclusivity causes all other passages to exclude it.
			*/
			const natSort = NaturalSort('en');
			return active.filter(p => {
					let excl = p.get('exclusivity');
					excl = typeof excl === "number" ? excl : 0;
					return excl === highestExclusivity;
				})
				/*
					Sort first by urgency, then by name.
				*/
				.sort((a,b) => {
					let aUrgency = a.get('urgency'), bUrgency = b.get('urgency');
					aUrgency = typeof aUrgency === "number" ? aUrgency : 0;
					bUrgency = typeof bUrgency === "number" ? bUrgency : 0;
					if (aUrgency !== bUrgency) {
						return bUrgency - aUrgency;
					}
					return natSort(a.get('name'), b.get('name'));
				});
		},

		/*
			A quick getter that provides every passage with storylet code.
		*/
		allStorylets() {
			if (!storyletCache) {
				storyletCache = [...Passages.values()].filter(e => e.get('storylet'));
			}
			return storyletCache;
		},

		clearStoryletCache() {
			storyletCache = null;
		},

		/*
			This function finally executes the story's (metadata:) macros and installs the results on the Passages datamap.
			This should only ever be run once by Harlowe.js in an onStartup call, and passed a fully synthetic section.
			Obviously, it needs to run after all of the Passages have been created.
			Worryingly, the ONLY thing that enforces this is that Passages's Utils.onStartup() call happens before Harlowe's
			because Harlowe requires Passages, and Utils.onStartup uses a FIFO stack for the callbacks passed to it.
		*/
		loadMetadata(section) {
			const errors = [];
			/*
				This array stores all of the TwineErrors that resulted from attempting to execute the (metadata:) macros, which
				are then returned as the function's only output.
			*/
			Passages.forEach(p => {
				p.metadata && Object.keys(p.metadata).forEach((name) => {
					/*
						The storylet code is already an error in one situation: when the passage had multiple same-named metadata macro calls in it,
						forcing Renderer to create this error rather than return one call's code.
					*/
					if (TwineError.containsError(p.metadata[name])) {
						errors.push(p.metadata[name]);
						return;
					}
					const code = p.metadata[name];
					const result = section.speculate(code, p.get('name'), "a (" + name + ":) macro");
					const passageErrorOpener = "In \"" + p.get('name') + "\":\n";
					if (TwineError.containsError(result)) {
						/*
							As in getStorylets, the error's message is altered to list the passage name of origin, although
							tweaked to account for the leading description in the metadata error dialog.
						*/
						result.message = passageErrorOpener + result.message;
						result.source = code.text;
						errors.push(result);
						return;
					}
					/*
						When attaching metadata to the passage datamap, make sure that, for instance, (storylet:) and (metadata: "storylet")
						don't override each other.
						This also indirectly ensures "tags", "name" and "source" are protected data names.
					*/
					function installResult(k,v) {
						if (p.has(k)) {
							errors.push(TwineError.create('syntax', "This passage's datamap already has a '" + JSON.stringify(k) + "' data name."));
						}
						else {
							p.set(k,v);
						}
					}
					/*
						The (metadata:) macro emits a Map, whereas other properties like (storylet:) emit single values.
					*/
					(result instanceof Map ? result.forEach((v,k) => installResult(k,v)) : installResult(name, result));
				});
				/*
					Having dealt with the metadata, it's now safe to delete it from the passage.
				*/
				p.metadata = undefined;
			});
			return errors;
		},

		/*
			This provides more data-checking than the built-in "has()".
		*/
		hasValid(name) {
			const passageData = this.get(name);
			return passageData && (passageData instanceof Map) && passageData.has('source');
		},
		
		create: Passage,
	});
	
	/*
		Unfortunately, the DOM isn't visible until the page is loaded, so we can't
		read every <tw-passagedata> from the <tw-storydata> HTML and store them in Passages until then.
	*/
	onStartup(() => {
		$("tw-storydata > tw-passagedata").get().forEach(e => {
			e = $(e);
			Passages.set(e.attr('name'), new Passage(e));
		});
	});
	return Passages;
});
