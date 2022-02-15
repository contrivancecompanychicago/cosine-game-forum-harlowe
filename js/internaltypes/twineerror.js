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
		/*
			Special Debug only functionality:
			a folddown's effects can be lazy-loaded if it has a 'folddown' data property.
		*/
		const folddownEvent = target.popData('folddown');
		if (typeof folddownEvent === "function") {
			folddownEvent();
		}
		/*
			Find the "next" element and pop it open or shut.
		*/
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
		propagated:    "Click the 'Open' button to see the code hook as it was executed.",
		user:          "This is a custom error created by (error:). It usually means you used a custom macro incorrectly.",
		assertion:     "This command exists to provide a helpful error if a certain important condition wasn't true.",
		debugonly:     'This macro is not meant to be used outside of debugging your story.',
	},

	/*
		If other modules need certain events to occur when an error is rendered, such handlers can
		be registered here.
	*/
	eventHandlers = [];
	
	const TwineError = {
		TwineError: true,
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
				/*
					This is a hack for the benefit of just (assert:)'s errors.
				*/
				appendTitleText: false,
			});
		},

		/*
			If the arguments contains a TwineError, return it.
			This also recursively examines arrays' contents.
			
			Maybe in the future, there could be a way to concatenate multiple
			errors into a single "report"...
			
			@return {Error|TwineError|Boolean} The first error encountered, or false.
		*/
		containsError(/*variadic*/) {
			// Due to high usage, this is a simple for-loop over arguments.
			for (let i = 0; i < arguments.length; i += 1) {
				const e = arguments[i];
				if (TwineError.isPrototypeOf(e)) {
					return e;
				}
				if (Array.isArray(e)) {
					const f = TwineError.containsError.apply(TwineError, e);
					if (f) {
						return f;
					}
				}
			}
			return false;
		},
		
		/*
			Twine warnings are just errors with a special "warning" bit.
		*/
		createWarning(type, message) {
			return Object.assign(this.create(type, message), {
				warning: true,
			});
		},
		
		render(titleText, noEvents = false) {
			/*
				The title text defaults to the error's Harlowe source code.
			*/
			titleText = typeof titleText === "string" ? titleText : this.source || "";
			const errorElement = $("<tw-error class='"
					+ (this.warning ? "warning" : "error")
					+ "' title='" + escape(titleText) + "'>" + escape(
						this.message + (this.appendTitleText ? " " + titleText : "")
					) + "</tw-error>"),
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
				$("<tw-open-button label='Open'>").on('click', () => {
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
			if (!noEvents) {
				eventHandlers.forEach(f => f(this, titleText));
			}

			return errorElement;
		},

		/*
			This is used only by Debug Mode - it lets event handlers be registered and called when different Errors are rendered.
			Each function is passed the TwineError object itself.
		*/
		on(fn) {
			if (typeof fn === "function" && !eventHandlers.includes(fn)) {
				eventHandlers.push(fn);
			}
			return TwineError;
		},

	};
	return Object.preventExtensions(TwineError);
});
