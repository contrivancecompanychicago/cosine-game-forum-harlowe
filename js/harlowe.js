/*
	This require.config call must be in here, so that local testing of Harlowe
	can be conducted without having to recompile harlowe.min.js.
*/
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
require(['jquery', 'renderer', 'state', 'engine', 'passages', 'utils/selectors', 'macrolib', 'repl'],
		($, Renderer, State, Engine, Passages, Selectors) => {
	"use strict";
	/*
		Harlowe, the default story format for Twine 2.
		
		This module contains only code which initialises the document and the game.
	*/
	
	// Used to execute custom scripts outside of main()'s scope.
	function _eval(text) {
		return eval(text + '');
	}
	
	/*
		This helper removes various globals created by TwineJS before it initiates a test play.
	*/
	function testPlayCleanup() {
		["_", "Backbone", "Store", "Mn", "Marionette", "saveAs", "FastClick", "JSZip", "SVG", "requestAnimFrame", "UUID",
		"XDate", "CodeMirror", "ui", "nwui", "AppPref", "Passage", "StoryFormat", "Story", "AppPrefCollection", "PassageCollection",
		"StoryCollection", "StoryFormatCollection", "WelcomeView", "StoryItemView", "StoryListView", "PassageItemView",
		"StoryEditView", "TwineRouter", "TransRegion", "TwineApp", "app", "storyFormat"].forEach((name) => {
			// Some of these are defined non-configurable, but still writable, for some reason.
			try {
				delete window[name];
			} catch(e) {
				window[name] = undefined;
			}
		});
	}
	
	/*
		Sets up event handlers for specific Twine elements. This should only be called
		once at setup.
	*/
	let installHandlers = () => {
		const html = $(document.documentElement),
			debugHTML =
			"<tw-debugger><button class='show-invisibles'>&#9903; Debug View</button></tw-debugger>";
		
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
			$(document.body).append(debugHTML);
			$('.show-invisibles').click(() => {
				html.toggleClass('debug-mode').is(".debug-mode");
			});
		}
		installHandlers = null;
	};

	/*
		When an uncaught error occurs, then display an alert box once, notifying the author.
		This installs a window.onerror method, but we must be careful not to clobber any existing
		onerror method.
	*/
	((oldOnError) => {
		window.onerror = function (message, _, __, ___, error) {
			/*
				This convoluted line retrieves the error stack, if it exists, and pretty-prints it with
				URL references (in brackets) removed. If it doesn't exist, the message is used instead.
			*/
			const stack = (error && error.stack && ("\n" + error.stack.replace(/\([^\)]+\)/g,'') + "\n")) || ("(" + message + ")\n");
			alert("Sorry to interrupt, but this page's code has got itself in a mess. "
				+ stack
				+ "(This is probably due to a bug in the Twine game engine.)");
			/*
				Having produced that once-off message, we now restore the page's previous onerror, and invoke it.
			*/
			window.onerror = oldOnError;
			if (typeof oldOnError === "function") {
				oldOnError(...arguments);
			}
		};
	})(window.onerror);
	
	/*
		This is the main function which starts up the entire program.
	*/
	$(() => {
		const header = $(Selectors.storyData);

		if (header.length === 0) {
			return;
		}
		
		// If this is a test play, and globals created by TwineJS are present, delete them.
		
		if ("TwineApp" in window) {
			testPlayCleanup();
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
		
		$(Selectors.script).each(function(i) {
			try {
				_eval($(this).html());
			} catch (e) {
				// TODO: Something more graceful - an 'error passage', perhaps?
				alert("There is a problem with this story's script (#" + (i + 1) + "):\n\n" + e.message);
			}
		});
		
		// Apply the stylesheets
		
		$(Selectors.stylesheet).each(function(i) {
			// In the future, pre-processing may occur.
			$(document.head).append('<style data-title="Story stylesheet ' + (i + 1) + '">' + $(this).html());
		});
		
		// Load the hash if it's present
		if (window.location.hash && !window.location.hash.includes("stories")) {
			if (State.load(window.location.hash)) {
				Engine.showPassage(State.passage);
				return;
			}
		}
		// Show first passage!
		Engine.goToPassage(startPassage);
	});
});
