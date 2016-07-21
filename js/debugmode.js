/*jshint strict:false */
define(['jquery', 'utils', 'state', 'engine'],
($, Utils, State, Engine) => () => {
	'use strict';
	/*
		Debug Mode

		When you test a Harlowe story using the "Test Story" option, debug mode is enabled. This mode adds a pane to the bottom of
		the page, which contains a few tools to examine your story, the current state, and how the macros in the current passage are
		behaving.

		This module exports a single function which, when run, performs all of the Debug Mode setup.
	*/
	const debugElement = $("<tw-debugger>Turns: <select disabled></select><button class='show-invisibles'>&#9903; Debug View</button></tw-debugger>");

	/*
		Set up the showInvisibles button, which toggles debug mode CSS (showing <tw-expression> elements and such)
		when clicked. It uses the class 'debug-mode' on <tw-story> to reveal it.
	*/
	const showInvisibles = debugElement.find('.show-invisibles');
	showInvisibles.click(() => {
		$(document.documentElement).toggleClass('debug-mode');
	});

	/*
		Set up the turn dropdown, which provides a menu of turns in the state and permits the user
		to travel to any of them at will.
	*/
	const turnsDropdown = debugElement.find('select');
	turnsDropdown.change(({target:{value}}) => {
		/*
			Work out whether to travel back or forward by subtracting the
			value from the current State moment index.
		*/
		const travel = value - State.pastLength;
		if (travel !== 0) {
			State[travel < 0 ? "rewind" : "fastForward"](Math.abs(travel));
			Engine.showPassage(State.passage);
		}
	});
	/*
		In order for the turnsDropdown view to reflect the state data, this event handler
		must be installed on State, to be called whenever the current moment changes.
	*/
	State.onChange((turns, recentIndex) => {
		turnsDropdown.empty()
			/*
				The turns dropdown should be disabled only if one or less turns is
				in the State history.
			*/
			[turns.length <= 1 ? 'attr' : 'removeAttr']('disabled');
		turns.forEach((turn, i) =>
			turnsDropdown.append("<option value=" + i
				+ (recentIndex === i ? " selected" : "")
				+ ">"
				+ (i+1) + ": " + turn.passage
				+ "</option>"
			)
		);
	});

	/*
		Finally, append the debug mode element to the <body>.
	*/
	$(document.body).append(debugElement);
});
