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
		jqueryplugins:                'utils/jqueryplugins',
		
		markup:                       './markup/markup',
		lexer:                        './markup/lexer',
		patterns:                     './markup/patterns',
	},
	deps: [
		'es6-shim',
		'jqueryplugins',
	],
});
require(['jquery', 'debugmode/mode', 'renderer', 'state', 'section', 'engine', 'passages', 'utils', 'utils/renderutils', 'internaltypes/varscope', 'internaltypes/twineerror', 'macros',
	'macrolib/values', 'macrolib/commands', 'macrolib/datastructures', 'macrolib/stylechangers', 'macrolib/enchantments', 'macrolib/metadata', 'macrolib/patterns',
	'macrolib/links', 'macrolib/custommacros', 'repl'],
		($, DebugMode, Renderer, State, Section, Engine, Passages, Utils, {dialog}, VarScope, TwineError) => {
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
		// Otherwise, add the callback to enable Debug Mode as soon as the first error occurs.
		else {
			TwineError.on('error', (error, code) => !$('tw-debugger').length && DebugMode(error, code));
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
			Utils.storyElement.parent().append(dialog({
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
		const header = $('tw-storydata');

		if (header.length === 0) {
			// TODO: Maybe some sort of error?
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
			startPassage = [].reduce.call($('tw-passagedata'), (id, el) => {
				const pid = el.getAttribute('pid');
				return (pid < id ? pid : id);
			}, Infinity);
		}
		startPassage = $("tw-passagedata[pid='" + startPassage + "']").attr('name');

		// Init game engine
		installHandlers();
		
		// Execute the custom scripts
		let scriptError = false;
		$("[role=script]").each(function(i) {
			try {
				__HarloweEval($(this).html());
			} catch (e) {
				// Only show the first script error, leaving the rest suppressed.
				if (!scriptError) {
					scriptError = true;
					dialog({
						parent: Utils.storyElement.parent(),
						message:"There is a problem with this story's " + Utils.nth(i + 1) + " script:\n\n" + printJSError(e),
					});
				}
			}
		});
		
		// Apply the stylesheets
		$("[role=stylesheet]").each(function(i) {
			// In the future, pre-processing may occur.
			$(document.head).append('<style data-title="Story stylesheet ' + (i + 1) + '">' + $(this).html());
		});

		// Set up the passage metadata
		const tempSection = Section.create();
		/*
			This is necessary in order for State to recompile custom macros containing typed variables as parameters.
			These are recompiled into VarRefs, even though they aren't actually references to temp variables, but definitions.
		*/
		tempSection.stack = [{tempVariables:Object.create(VarScope)}];

		const metadataErrors = Passages.loadMetadata(tempSection);
		if (metadataErrors.length) {
			const d = dialog({
				parent: Utils.storyElement.parent(),
				message: "These errors occurred when running the `(metadata:)` macro calls in this story's passages:<p></p>",
			});
			// Because these TwineErrors have their 'source' property modified to list their actual source, render() doesn't need an argument.
			metadataErrors.forEach(error => d.find('p').append(error.render('')));
		}
		
		// Load the sessionStorage if it's present (and we're not testing)
		const sessionData = !Engine.options.debug && State.hasSessionStorage && sessionStorage.getItem("Saved Session");
		if (sessionData) {
			// If deserialisation fails (i.e. it returned an Error instead of true),
			// it means the sessionData is invalid. Just ignore it - it's only temporary data.
			if (State.deserialise(tempSection, sessionData) === true) {
				// This is copied from (load-game:).
				Engine.showPassage(State.passage, false /* stretchtext value */);
				return;
			}
		}

		// Show the first passage!
		Engine.goToPassage(startPassage);
	});
});
