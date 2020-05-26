"use strict";
define(['jquery', 'renderer'], function($, Renderer) {
	/*
		This is used to create dialogs for the (prompt:), (confirm:) and (alert:) macros, as well as
		the warning dialog for (loadgame:). This may be expanded in the future to offer more author-facing
		customisability.
	*/
	function dialogElement({message = '', defaultValue, cancelCallback = $.noop, confirmCallback, cancelButton = "Cancel", confirmButton = "OK"}) {
		const ret = $(Renderer.exec("<tw-backdrop><tw-dialog>"
			+ '<div style="text-align:center;margin:0 auto">\n'
			/*
				The defaultValue denotes that it should have a text input element, and provide
				the element's final contents to the confirmCallback.
			*/
			+ ((defaultValue || defaultValue === "") ?
				"<input type=text style='display:block'></input>\n" : "")
			+ '</div><div style="text-align:right">'
			/*
				The confirmCallback is used to differentiate (prompt:) from (confirm:). Its presence
				causes a second "Cancel" link to appear next to "OK".
			*/
			+ (confirmCallback ?
				"<span style='width:75%;margin-right:1em'><tw-link tabindex=0>" + confirmButton + "</tw-link></span>"
					+ "<span style='width:25%;margin-left:1em'><tw-link tabindex=0>" + cancelButton + "</tw-link></span>"
				: "<tw-link tabindex=0>" + confirmButton + "</tw-link>")
			+ "</div></tw-dialog></tw-backdrop>"));
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
