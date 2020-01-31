"use strict";
define(['jquery', 'utils/naturalsort', 'utils', 'utils/selectors', 'markup', 'renderer', 'internaltypes/twineerror'], ($, NaturalSort, {unescape,onStartup,insensitiveName}, Selectors, TwineMarkup, Renderer, TwineError) => {
	const {assign} = Object;
	/*
		Passages
		A userland registry of Passage objects.
		Passage objects are simple Maps exposing passage data to public scripts.
		They have their string content (the "source"), their tags in an array, and their name.
	*/

	/*
		Pass a <tw-passagedata> element into this constructor,
		and a Passage datamap will be produced.
	*/
	function Passage(elem) {
		const source = unescape(elem.html());
		/*
			Metadata macros (such as (storylet:)) need to be extracted and applied to the passage datamap itself.
			The source is exclusively used by error messages and Debug Mode.
		*/
		const {
			storylet, storyletSource,
			metadata, metadataSource,
		} = Renderer.preprocess(source);

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
			["name", elem.attr('name')],
		]),{
			/*
				These must unfortunately be own-properties, as passages must inherit from
				Map rather than this object.
			*/
			TwineScript_TypeName: "a passage datamap",
			TwineScript_ObjectName: "a passage datamap",
			/*
				The storylet code is attached in a manner inaccessible to user-side code.
				Note that when code such as (passages:) passes this map to user-side code,
				it should be a clone created by clone(), which would lack this own-property.
			*/
			storyletCode: storylet,
			storyletSource,
			metadataCode: metadata,
			metadataSource,
		});
	}
	
	const Passages = assign(new Map(), {
		TwineScript_ObjectName: "the Passages datamap",
		
		/*
			This method retrieves passages which have a given tag.
		*/
		getTagged(tag) {
			const tagSorter = NaturalSort('en', p => p.get('name'));
			const ret = [];
			this.forEach((v) => {
				const tags = v instanceof Map && v.get('tags');
				if (Array.isArray(tags) && tags.includes(tag)) {
					ret.push(v);
				}
			});
			return ret.sort(tagSorter);
		},

		/*
			Storylet macros like (open-storylets:) query every passage's storylet condition code using this method.
			They may supply a lambda to filter the passages with, first.
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
			const ret = [];
			/*
				Return the result, or the first error that appeared when evaluating a passage's lambda.
			*/
			return passages.reduce((error, p) => {
				if (error) {
					return error;
				}
				if (p.storyletCode) {
					/*
						The storylet code is already an error in one situation: when the passage had multiple (storylet:) macro calls in it,
						forcing Renderer to create this error rather than return one call's code.
					*/
					if (TwineError.containsError(p.storyletCode)) {
						return p.storyletCode;
					}
					const available = section.speculate(p.storyletCode, p.get('name'), "a (storylet:) macro");
					if (TwineError.containsError(available)) {
						/*
							Alter the error's message to report the name of the passage from which it originated.
						*/
						available.message = "There's an error in the storylet passage \"" + p.get('name') + "\":\n" + available.message;
						/*
							The original source code of the lambda is used as the error's source, instead of that of
							the (open-storylets:) macro call.
						*/
						available.source = p.storyletSource;
						return available;
					}
					if (available) {
						ret.push(p);
					}
				}
			}, undefined) || ret;
		},

		/*
			A quick getter that provides every passage with storylet code.
		*/
		allStorylets() {
			return [...Passages.values()].filter(e => e.storyletCode);
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
				if (p.metadataCode) {
					/*
						The storylet code is already an error in one situation: when the passage had multiple (storylet:) macro calls in it,
						forcing Renderer to create this error rather than return one call's code.
					*/
					if (TwineError.containsError(p.metadataCode)) {
						errors.push(p.metadataCode);
					}
					const metadata = section.speculate(p.metadataCode, p.get('name'), "a (metadata:) macro");
					if (TwineError.containsError(metadata)) {
						/*
							As in getStorylets, the error's message is altered to list the passage name of origin, although
							tweaked to account for the leading description in the metadata error dialog.
						*/
						metadata.message = "In \"" + p.get('name') + "\":\n" + metadata.message;
						metadata.source = p.metadataSource;
						errors.push(metadata);
						return;
					}
					metadata.forEach((v,k) => p.set(k,v));
				}
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
		Array.from($(Selectors.storyData + " > " + Selectors.passageData)).forEach(e => {
			e = $(e);
			Passages.set(e.attr('name'), new Passage(e));
		});
	});
	return Passages;
});
