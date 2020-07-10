"use strict";
define(['jquery', 'utils'], ($, Utils) => {
	const {impossible, escape} = Utils;
	/*
		TwineErrors are errors created by the TwineScript runtime. They are supplied with as much
		information as they can, in order to give the author sufficient assistance in
		understanding the error.
	*/

	/*
		Set up the fold-down buttons used here. These are also used in Debug Mode.
	*/
	$(document.documentElement).on('click', 'tw-folddown', ({target}) => {
		target = $(target);
		target.toggleClass('open');
		while(target && !target.next().length) {
			target = target.parent();
		}
		target && target.next().toggle();
	});
	
	/*
		This dictionary supplies explanations for the most typical error types.
	*/
	const errorExplanations = {
		syntax:        "The markup seems to contain a mistake.",
		saving:        "I tried to save or load the game, but I couldn't do it.",
		operation:     "I tried to perform an operation on some data, but the data's type was incorrect.",
		macrocall:     "I tried to use a macro, but its call wasn't written correctly.",
		datatype:      "I tried to use a macro, but was given the wrong type of data to it.",
		custommacro:   "I tried to use a custom macro, but its code hook had a mistake in it.",
		infinite:      "I almost ended up doing the same thing over and over, forever.",
		property:      "I tried to access a value in a string/array/datamap, but I couldn't find it.",
		unimplemented: "I currently don't have this particular feature. I'm sorry.",
		javascript:    "This error message was reported by your browser's Javascript engine. "
			+ "I don't understand it either, but it usually means that an expression was badly written.",
		propagated:    "This error occurred elsewhere in your story, but is being displayed here for your convenience.",
		user:          "This is a custom error created by (error:). It usually means you used a custom macro incorrectly.",
	},

	/*
		If other modules need certain events should occur when an error is rendered, such handlers can
		be registered here. Currently, only the "error" event handler is used, by Debug Mode.
	*/
	eventHandlers = {
		error: [],
		warning: [],
	},
	
	TwineError = {
		/*
			Normally, the type by itself suggests a rudimentary explanation from the above dict.
			But, a different explanation can be provided by the caller, if they choose.
		*/
		create(type, message, explanation, innerDOM) {
			if (!message || typeof message !== "string") {
				impossible("TwineError.create", "has a bad message string");
			}
			/*
				Whatever happens, there absolutely must be a valid explanation from either source.
			*/
			if(!(explanation || type in errorExplanations)) {
				impossible('TwineError.create','no error explanation given');
			}

			/*
				If it's not a user error, capitalise the message. This doesn't care about astral code points
				because error messages shouldn't directly begin with user data, to my knowledge.
			*/
			if (type !== "user") {
				message = message[0].toUpperCase() + message.slice(1);
			}

			return Object.assign(Object.create(this), {
				/*
					The type of the TwineError consists of one of the errorExplanations keys.
				*/
				type,
				message,
				explanation,
				/*
					This is used to provide alternative source code for the error, rather
					than the source of the <tw-expression> or <tw-macro> element. Currently
					only used for storylet errors (which involve code running outside its
					original passage).
				*/
				source: undefined,
				/*
					This is exclusively for propagated errors, allowing you to see into the
					hidden code hook from which the error transpired.
				*/
				innerDOM,
			});
		},
		
		/*
			This utility function converts a Javascript Error into a TwineError.
			This allows them to be render()ed by Section.
			
			Javascript error messages are presaged with a coffee cup (\u2615),
			to signify that the browser produced them and not Twine.
		*/
		fromError(error) {
			return TwineError.create("javascript", "\u2615 " + error.message);
		},
		
		/*
			In TwineScript, both the runtime (operations.js) and Javascript eval()
			of compiled code (by compiler.js) can throw errors. They should be treated
			as equivalent within the engine.
			
			If the arguments contain a native Error, this will return that error.
			Or, if it contains a TwineError, return that as well.
			This also recursively examines arrays' contents.
			
			Maybe in the future, there could be a way to concatenate multiple
			errors into a single "report"...
			
			@return {Error|TwineError|Boolean} The first error encountered, or false.
		*/
		containsError(...args) {
			return args.reduce(
				(last, e) => last ? last
					: e instanceof Error ? e
					: TwineError.isPrototypeOf(e) ? e
					: Array.isArray(e) ? TwineError.containsError(...e)
					: false,
				false
			);
		},
		
		/*
			Twine warnings are just errors with a special "warning" bit.
		*/
		createWarning(type, message) {
			return Object.assign(this.create(type, message), {
				warning: true,
			});
		},
		
		render(titleText) {
			/*
				The title text defaults to the error's Harlowe source code.
			*/
			titleText = titleText || this.source || "";
			const errorElement = $("<tw-error class='"
					+ (this.type === "javascript" ? "javascript ": "")
					+ (this.warning ? "warning" : "error")
					+ "' title='" + escape(titleText) + "'>" + escape(this.message) + "</tw-error>"),
				/*
					The explanation text element.
				*/
				explanationElement = $("<tw-error-explanation>")
					.text(this.explanation || errorExplanations[this.type])
					.hide(),
				/*
					The button to reveal the explanation consists of a rightward arrowhead
					(styled with SCSS) which becomes a downward arrow when opened.
				*/
				explanationButton = $("<tw-folddown tabindex=0>");
			
			/*
				If there's an inner DOM, create a button to show a dialog with that DOM displayed inside,
				so that it can be inspected.
				The button's text is controlled by a CSS "content" attribute for <tw-error-dom>.
			*/
			if (this.innerDOM) {
				$("<tw-open-button>").on('click', () => {
					/*
						Due to a circular dependency, RenderUtils sadly can't be used here.
						So, simply create a barebones dialog from pure DOM nodes.
					*/
					const dialog = $("<tw-backdrop><tw-dialog></tw-backdrop>");
					dialog.find('tw-dialog').prepend(
						this.innerDOM,
						$('<tw-link tabindex=0>OK</tw-link>').on('click', () => {
							/*
								The innerDOM needs to be explicitly detached because any errors inside
								will have their events removed by the .remove() of their parent.
							*/
							this.innerDOM.detach();
							dialog.remove();
						}).wrap('<tw-dialog-links>').parent()
					);
					/*
						This has to be a prepend, so that inner errors' dialogs cover the current dialog.
					*/
					Utils.storyElement.prepend(dialog);
				})
				.appendTo(errorElement);
			}
			errorElement.append(explanationButton).append(explanationElement);

			/*
				Storing this TwineError object on the element is currently only required for
				macros that evaluate TwineMarkup strings passed into them to examine their text content,
				such as (link-reveal-goto:).
			*/
			errorElement.data('TwineError', this);

			/*
				Fire any event handlers that were registered.
			*/
			eventHandlers.error.forEach(f => f(this, titleText));

			return errorElement;
		},

		/*
			This is used only by Debug Mode - it lets event handlers be registered and called when different Errors are rendered.
			Each function is passed the TwineError object itself.
		*/
		on(name, fn) {
			if (!(name in eventHandlers)) {
				impossible('TwineError.on', 'invalid event name');
				return;
			}
			if (typeof fn === "function" && !eventHandlers[name].includes(fn)) {
				eventHandlers[name].push(fn);
			}
			return TwineError;
		},

	};
	return TwineError;
});
