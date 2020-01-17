/*
	This require.config call must be in here, so that local testing of Harlowe
	can be conducted without having to recompile harlowe.min.js.
*/
"use strict";
require.config({
	paths: {
		// External libraries
		jquery:                       '../node_modules/jquery/dist/jquery',
		almond:                       '../node_modules/almond/almond',
		"es6-shim":                   '../node_modules/es6-shim/es6-shim',
		"requestAnimationFrame":      '../node_modules/requestanimationframe/app/requestAnimationFrame',
		jqueryplugins:                'utils/jqueryplugins',
		
		markup:                       './markup/markup',
		lexer:                        './markup/lexer',
		patterns:                     './markup/patterns',
	},
	deps: [
		'jquery',
		'es6-shim',
		'jqueryplugins',
	],
});
require(['jquery', 'debugmode', 'renderer', 'state', 'engine', 'passages', 'utils', 'utils/selectors', 'utils/dialog', 'macros',
	'macrolib/values', 'macrolib/commands', 'macrolib/datastructures', 'macrolib/stylechangers', 'macrolib/enchantments', 'macrolib/metadata',
	'macrolib/links', 'repl'],
		($, DebugMode, Renderer, State, Engine, Passages, Utils, Selectors, Dialog) => {
	/*
		Harlowe, the default story format for Twine 2.
		
		This module contains only code which initialises the document and the game.
	*/
	
	// Used to execute custom scripts outside of main()'s scope.
	function __HarloweEval(text) {
		return eval(text + '');
	}
	
	/*
		Sets up event handlers for specific Twine elements. This should only be called
		once at setup.
	*/
	let installHandlers = () => {
		const html = $(document.documentElement);
		
		/*
			This gives interactable elements that should have keyboard access (via possessing
			a tabindex property) some basic keyboard accessibility, by making their
			enter-key event trigger their click event.
		*/
		html.on('keydown', function(event) {
			if (event.which === 13 && event.target.getAttribute('tabindex') === "0") {
				$(event.target).trigger('click');
			}
		});
		
		// If the debug option is on, add the debugger.
		if (Engine.options.debug) {
			DebugMode();
		}
		installHandlers = null;
	};


	/*
		This function pretty-prints JS errors using Harlowe markup, for display in the two error dialogs below.
	*/
	function printJSError(error) {
		let ret = (error.name + ": " + error.message);
		if (error.stack) {
			const stack = error.stack.split('\n');
			/*
				Exclude the part of the error stack that follows "__HarloweEval" (the name of the eval wrapper function above)
				as these contain Harlowe engine code rather than user script code.
			*/
			const index = stack.findIndex(line => line.includes("__HarloweEval"));
			/*
				Print the full stack, removing URL references (in brackets) such as those in Chrome stacks.
			*/
			ret += ("\n" + stack.slice(0, index).join('\n').replace(/\([^\)]+\)/g,''));
		}
		/*
			The stack is shown in monospace, in a limited-size frame that shouldn't push the OK link off the dialog box.
		*/
		return "<div style='font-family:monospace;overflow-y:scroll;max-height:30vh'>```" + ret + "```</div>";
	}

	/*
		When an uncaught error occurs, then display an alert box once, notifying the author.
		This installs a window.onerror method, but we must be careful not to clobber any existing
		onerror method.
	*/
	((oldOnError) => {
		window.onerror = function (message, _, __, ___, e) {
			/*
				First, to ensure this function only fires once, we restore the previous onError function.
			*/
			window.onerror = oldOnError;
			/*
				This dialog, and the one further down, doesn't - can't - block passage control flow, so it can appear over other dialogs and lets
				the passage animate beneath it. This is just a slightly awkward inconsistency for a dialog box that shouldn't appear in normal situations.
				Additionally, this is affixed to the parent of the <tw-story> so that it isn't easily removed without being seen by the player.
			*/
			Utils.storyElement.parent().append(Dialog({
				message: "Sorry to interrupt, but this page's code has got itself in a mess.\n\n"
					+ printJSError(e)
					+ "\n(This is probably due to a bug in the Harlowe game engine.)"
			}));
			/*
				Having produced that once-off message, we now invoke the previous onError function.
			*/
			if (typeof oldOnError === "function") {
				oldOnError(...arguments);
			}
		};
	})(window.onerror);
	
	/*
		This is the main function which starts up the entire program.
	*/
	Utils.onStartup(() => {
		const header = $(Selectors.storyData);

		if (header.length === 0) {
			return;
		}

		// Load options from attribute into story object
		const options = header.attr('options');

		if (options) {
			options.split(/\s/).forEach((b) => {
				Renderer.options[b] = Engine.options[b] = true;
			});
		}
		let startPassage = header.attr('startnode');

		/*
			The IFID is currently only used with the saving macros.
		*/
		Renderer.options.ifid = Engine.options.ifid = header.attr('ifid');
		
		// If there's no set start passage, find the passage with the
		// lowest passage ID, and use that.
		if (!startPassage) {
			startPassage = [].reduce.call($(Selectors.passageData), (id, el) => {
				const pid = el.getAttribute('pid');
				return (pid < id ? pid : id);
			}, Infinity);
		}
		startPassage = $(Selectors.passageData + "[pid=" + startPassage + "]").attr('name');

		// Init game engine
		installHandlers();
		
		// Execute the custom scripts
		let scriptError = false;
		$(Selectors.script).each(function(i) {
			try {
				__HarloweEval($(this).html());
			} catch (e) {
				// Only show the first script error, leaving the rest suppressed.
				if (!scriptError) {
					scriptError = true;
					Utils.storyElement.parent().append(Dialog("There is a problem with this story's " + Utils.nth(i + 1) + " script:\n\n" + printJSError(e), undefined, () => {}));
				}
			}
		});
		
		// Apply the stylesheets
		$(Selectors.stylesheet).each(function(i) {
			// In the future, pre-processing may occur.
			$(document.head).append('<style data-title="Story stylesheet ' + (i + 1) + '">' + $(this).html());
		});
		
		// Load the sessionStorage if it's present (and we're not testing)
		const sessionData = !Engine.options.debug && State.hasSessionStorage && sessionStorage.getItem("Saved Session");
		if (sessionData) {
			// If deserialisation fails (i.e. it returned an Error instead of true),
			// it means the sessionData is invalid. Just ignore it - it's only temporary data.
			if (State.deserialise(sessionData) === true) {
				// This is copied from (load-game:).
				Engine.showPassage(State.passage, false /* stretchtext value */);
				return;
			}
		}

		// Show the first passage!
		Engine.goToPassage(startPassage);
	});
});
