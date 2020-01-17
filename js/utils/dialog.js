"use strict";
define(['jquery', 'renderer'], function($, Renderer) {
	/*
		This is used to create dialogs for the (prompt:), (confirm:) and (alert:) macros, as well as
		the warning dialog for (loadgame:). This may be expanded in the future to offer more author-facing
		customisability.
	*/
	function dialogElement({message = '', defaultValue, cancelCallback, confirmCallback, cancelButton = "Cancel", confirmButton = "OK"}) {
		/*
			The element is generated by running this block of hardcoded Harlowe markup into the Renderer.
			While this has the elegance of leveraging existing Harlowe features, it does mean that the
			raw HTML elements end up with "false" [data-raw] attributes as a result. However, this isn't
			enough of an issue to want to counteract.
		*/
		const ret = $(Renderer.exec("<tw-backdrop><tw-dialog>"
			+ "\n"
			/*
				The defaultValue denotes that it should have a text input element, and provide
				the element's final contents to the confirmCallback.
			*/
			+ ((defaultValue || defaultValue === "") ?
				"=><=\n"
				+ "<input type=text></input>\n\n"
				+ "=><=\n" : "")
			+ "==>\n"
			/*
				The confirmCallback is used to differentiate (prompt:) from (confirm:). Its presence
				causes a second "Cancel" link to appear next to "OK".
			*/
			+ (confirmCallback ?
				"|||=\n<tw-link tabindex=0>" + confirmButton + "</tw-link>\n=|\n<tw-link tabindex=0>" + cancelButton + "</tw-link>"
				: "\n<tw-link tabindex=0>" + confirmButton + "</tw-link>")
			+ "</tw-dialog></tw-backdrop>"));
		/*
			The user-provided text is rendered separately from the rest of the dialog, so that injection bugs, such as
			inserting closing </tw-dialog> tags, are harder to bring about.
		*/
		ret.find('tw-dialog').prepend(Renderer.exec(message));

		/*
			The passed-in defaultValue string, if non-empty, is used as the input element's initial value.
		*/
		if (defaultValue) {
			ret.find('input').last().val(defaultValue)
				// Pressing Enter should submit the given string.
				.on('keypress', ({which}) => {
					if (which === 13) {
						ret.remove();
						confirmCallback ? confirmCallback(): cancelCallback();
					}
				});
		}

		/*
			Finally, set up the callbacks. All of them remove the dialog from the DOM automatically,
			to save the consumer from having to do it.
		*/
		ret.find('tw-link').last().on('click', () => { ret.remove(); cancelCallback(); });

		if (confirmCallback) {
			$(ret.find('tw-link').get(-2)).on('click', () => { ret.remove(); confirmCallback(); });
		}

		return ret;
	}

	return dialogElement;
});
