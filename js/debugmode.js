"use strict";
define(['jquery', 'utils', 'state', 'internaltypes/varref', 'internaltypes/twineerror', 'utils/operationutils', 'engine', 'passages', 'section'],
($, {escape,nth,storyElement}, State, VarRef, TwineError, {objectName, is, isObject, toSource}, Engine, Passages, Section) => (initialError, code) => {
	/*
		Debug Mode

		When you test a Harlowe story using the "Test Story" option, debug mode is enabled. This mode adds a pane to the bottom of
		the page, which contains a few tools to examine your story, the current state, and how the macros in the current passage are
		behaving.

		This module exports a single function which, when run, performs all of the Debug Mode setup.
	*/
	const root = $(document.documentElement);
	const debugElement = $(`<tw-debugger>
		<div class='panel panel-variables panel-variables-empty'>
			<div class='panel-variables-table'></div>
			<div class='panel-variables-bottom'>
				<button class='panel-variables-copy'>Copy $ variables as (set:) call</button>
				<input class='clipboard' type="text" style='opacity:0;pointer-events:none;position:absolute;'></input>
			</div>
		</div>
		<div class='panel panel-errors' hidden><table></table></div>
		<div class='panel panel-source' hidden></div>
		<div class='panel panel-storylets' hidden></div>
		<div class='tabs'>
		<button class='tab tab-variables enabled'>0 Variables</button> <button class='tab tab-errors'>0 Errors</button> <button class='tab tab-source'>Source</button>
		<button class='tab tab-storylets' hidden>0 Storylets</button>
		</div>
		Turns: <select class='turns' disabled></select><button class='show-invisibles'>Debug View</button>
		</tw-debugger>`);

	/*
		Set up the showInvisibles button, which toggles debug mode CSS (showing <tw-expression> elements and such)
		when clicked. It uses the class 'debug-mode' on <tw-story> to reveal it.
	*/
	const showInvisibles = debugElement.find('.show-invisibles');
	showInvisibles.click(() => {
		root.toggleClass('debug-mode');
		showInvisibles.toggleClass('enabled');
	});
	/*
		Additionally, set up the tabs and panes.
	*/
	['variables', 'source', 'errors', 'storylets'].forEach((name)=> {
		const tab   = debugElement.find('.tab-'   + name);
		const panel = debugElement.find('.panel-' + name);
		tab.click(() => {
			tab.toggleClass('enabled');
			debugElement.find('.tab:not(.tab-' + name + ')').removeClass('enabled');
			debugElement.find('.panel').attr('hidden','');
			if (tab.is('.enabled')) {
				panel.removeAttr("hidden");
			}
		});
	});

	/*
		Set up the turn dropdown, which provides a menu of turns in the state and permits the user
		to travel to any of them at will.
	*/
	const turnsDropdown = debugElement.find('.turns');
	/*
		Add the dropdown entries if debug mode was enabled partway through the story.
	*/
	State.timelinePassageNames().forEach((passageName, i) => {
		turnsDropdown.append("<option value=" + i + ">"
			+ (i+1) + ": " + passageName
			+ "</option>");
	});
	turnsDropdown.val(State.pastLength);
	/*
		The turns dropdown should be disabled only if one or less turns is in the State history.
	*/
	if (State.pastLength > 0) {
		turnsDropdown.removeAttr('disabled');
	}
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
		In order for the turnsDropdown view to reflect the state data, these event handlers
		must be installed on State, to be called whenever the current moment changes.

		'forward' is fired when navigating to a new passage, or redoing a move. This
		simply adds a turn to the end of the menu.
	*/
	State.on('forward', (passageName, isFastForward = false) => {
		const i = State.pastLength;
		if (i > 1) {
			/*
				The turns dropdown should be disabled only if one or less turns is
				in the State history.
			*/
			turnsDropdown.removeAttr('disabled');
		}
		/*
			If we're not fast forwarding through the redo cache, then we're replacing
			it outright. Remove all <option> elements after this one.
		*/
		if (!isFastForward) {
			turnsDropdown.children().each((index, e) => {
				if (index >= i) {
					$(e).remove();
				}
			});
			/*
				Create the new <option> element and select it.
			*/
			turnsDropdown
				.append("<option value=" + i + ">"
					+ (i+1) + ": " + passageName
					+ "</option>")
				.val(i);
		}
		else {
			/*
				Select the new <option>.
			*/
			turnsDropdown.find('[selected]').removeAttr('selected');
			turnsDropdown.val(i);
		}
	})
	/*
		'back' is fired when undoing a move. This removes the final turn from the menu.
	*/
	.on('back', () => {
		/*
			As above, disable if only one turn remains in the timeline.
		*/
		if (State.pastLength <= 1) {
			turnsDropdown.attr('disabled');
		}
		/*
			Deselect the current selected <option>.
		*/
		turnsDropdown.find('[selected]').removeAttr('selected');
		/*
			Select the new last element.
		*/
		turnsDropdown.val(State.pastLength);
	})
	/*
		'load' is fired when saved games are deserialised. This replaces the
		entire menu. Immediately after, 'forward' is also fired, so we don't
		need to set the val() here.
	*/
	.on('load', (timeline) => {
		turnsDropdown.empty();
		/*
			As above, disable only if one turn remains in the timeline.
		*/
		turnsDropdown[timeline.length <= 1 ? 'attr' : 'removeAttr']('disabled');

		timeline.forEach((turn, i) =>
			turnsDropdown.append("<option value=" + i + ">"
				+ (i+1) + ": " + turn.passage
				+ "</option>"
			)
		);
	});

	const variablesTable = debugElement.find('.panel-variables-table');
	/*
		Update the number of variables on the showVariables button.
	*/
	function updateVariablesTab() {
		const children = variablesTable.children();
		debugElement.find('.tab-variables').text(`${children.length} Variable${children.length !== 1 ? 's' : ''}`);
		/*
			Also toggle the .panel-variables-empty class if there are no variables.
		*/
		variablesTable.parent()[(children.length > 0 ? 'remove' : 'add') + 'Class']('panel-variables-empty');
	}
	/*
		Here, we set up the variables table.

		This function is responsible for creating the inner DOM structure of the
		variablesTable and updating it, one row at a time.
	*/
	function updateVariables(name, path, value, tempScope) {
		/*
			Obtain the row which needs to be updated. If it doesn't exist,
			create it below.
		*/
		let row = variablesTable.children('[data-name="' + escape(name + '') + '"][data-path="' + escape(path + '') + '"]');
		/*
			The debug name used defers to the TwineScript_DebugName if it exists,
			and falls back to the objectName if not. Note that the TwineScript_DebugName can contain HTML structures
			(such as a <tw-colour> for colours) but the objectName could contain user-inputted data, so only the latter is escaped.
		*/
		const val = isObject(value) && value.TwineScript_DebugName ? value.TwineScript_DebugName() : escape(objectName(value));
		if (!row.length) {
			/*
				To provide easy comparisons for the refresh() method below,
				store the name and value of the row as data attributes of its element.
			*/
			row = $('<div class="variable-row" data-name="' + escape(name + '')
				+ '" data-path="' + escape(path + '')
				+ '" data-value="' + val +'"></div>').appendTo(variablesTable);
		}
		/*
			Single variables, like $peas, should be displayed with no trail, as "peas".
			Deep object properties, like $arr's 1st's 1st, should be displayed with a trail
			consisting of "arr's 1st's", and the name changed to "1st".
			(Note that the prefix of $ or _ is added using CSS ::before.)
		*/
		let trail = '';
		if (path.length) {
			trail = path.reduce((a,e) => a + e + "'s ", '');
		}
		/*
			Source code for objects can be viewed with a folddown button.
		*/
		const tooLong = val.length > 48 && !value.TwineScript_DebugName;
		const folddown = typeof value === "object" || tooLong;
		/*
			If the value is greater than 36 characters, truncate it.
		*/
		const truncVal = (tooLong ? val.slice(0,48) + "…" : val);
		/*
			Create the <span>s for the variable's name and value.
		*/
		row.empty().append(
			"<span class='variable-name " + (trail ? '' : tempScope ? "temporary" : "global") + "'>"
			+ (trail ? "<span class='variable-path " + (tempScope ? "temporary" : "global") + "'>" + escape(trail) + "</span> " : '')
			+ escape(name + '')
			+ (tempScope ? ("<span class='temporary-variable-scope'>" + tempScope + "</span>") : "") +
			"</span><span class='variable-value'>" + truncVal + "</span><span class='variable-buttons'>"
				+ (folddown ? "<tw-folddown tabindex=0>(source:)</tw-folddown>" : '')
				+ "</span>"
			+ (folddown ? "<div class='variable-contents' style='display:none'>" + escape(toSource(value)) + "</div>" : "")
		)
		/*
			Data structure entries are indented by their depth in the structure, to a maximum of 5 levels deep.
		*/
		.css('padding-left', Math.min(5,path.length)+'em')
		/*
			This append should cause the variablesTable to always sort data structure contents after the structure itself.
		*/
		.appendTo(variablesTable);

		updateVariablesTab();

		/*
			To display each entry inside an array, map or set, directly below the
			row for their container structure, a simple recursive call to updateVariables()
			should be sufficient.
		*/
		if (Array.isArray(value)) {
			value.forEach((elem,i) => updateVariables(nth(i+1), path.concat(name), elem, tempScope));
		}
		else if (value instanceof Map) {
			[...value].forEach(([key,elem]) => updateVariables(key, path.concat(name), elem, tempScope));
		}
		else if (value instanceof Set) {
			/*
				Sets don't have keys. So, using "???" for every entry is what we're forced to do
				to keep this display consistent with the others.
			*/
			[...value].forEach((elem) => updateVariables("???", path.concat(name), elem, tempScope));
		}
	}
	/*
		Set up the "Copy all as (set:)" button.
	*/
	const inputElem = debugElement.find('.clipboard');
	root.on('click', '.panel-variables-copy', () => {
		let variableToValue = [];
		for (let name in State.variables) {
			if (!name.startsWith('TwineScript')) {
				variableToValue.push(
					"$" + name + " to " + toSource(State.variables[name])
				);
			}
		}
		inputElem.val("(set:" + variableToValue + ")")[0].select();
		document.execCommand('copy');
	});

	const storyletsTable = debugElement.find('.panel-storylets');
	/*
		 A Section must be passed to Passages.getStorylets() in refresh(), so we need to generate one.
		 This is created at startup and cached here;
	*/
	const storyletSection = Section.create(storyElement);
	/*
		Unlike variables, storylet rows don't need to be added or removed (instead just having their
		data-open value changed) so we can create them all just once, here.
	*/
	Passages.allStorylets().forEach(map => {
		const name = escape(map.get('name') + '');
		$('<div class="storylet-row storylet-closed" data-name="' + name
			+ '"></div>')
			/*
				Create the <span>s for the storylet's name and lambda.
			*/
			.append(
				"<span class='storylet-name'>" + name
				+ "</span><span class='storylet-lambda'>" + map.storyletSource + "</span>"
			)
			.appendTo(storyletsTable);
	});
	/*
		Unlike variables, storylet rows don't need to be added or removed, so this code is much simpler.
	*/
	function updateStorylets() {
		let children = storyletsTable.children();
		if (!children.length) {
			return;
		}
		/*
			Get a list of just the currently active storylets, using the cached dummy section from above.
			This can also produce a TwineError if one of the storylet lambdas erred.
		*/
		const storylets = Passages.getStorylets(storyletSection);
		let open = 0;
		const error = TwineError.containsError(storylets);
		/*
			The list is then used to re-colour each storylet row based on its inclusion or absence.
		*/
		children.each((_,e) => {
			e = $(e);
			/*
				If the list was indeed an error, simply close and mark every storylet row,
				because storylet-listing macros currently won't work.
			*/
			if (error) {
				e.addClass('storylet-closed storylet-error');
				return;
			}
			const name = e.attr('data-name');
			const isOpen = storylets.some(map => map.get('name') === name);
			/*
				Alter the class to match its open state, and take a tally of open storylets for use by the tab's text.
			*/
			e[isOpen ? 'removeClass' : 'addClass']('storylet-closed').removeClass('storylet-error');
			open += isOpen;
		});
		debugElement.find('.tab-storylets').text(`${open} Storylet${open !== 1 ? 's' : ''}`)
			/*
				Only reveal the Storylet tab on the UI when the first storylet refresh has occurred,
				as it's not useful for most stories.
			*/
			.removeAttr('hidden');
	}

	/*
		This function, called as a State event handler, synchronises the variablesTable
		and storyletsTable with the entire variable state at the present.
	*/
	function refresh() {
		const updated = [];
		/*
			Refresh the variables pane.
			For performance purposes, we try to avoid removing and re-creating
			unchanged variables. So, we first loop through each variable-row and
			check if its value needs to be updated or removed.
		*/
		variablesTable.children().each((_,e) => {
			e = $(e);
			const name = e.attr('data-name'),
				path = e.attr('data-path'),
				value  = e.attr('data-value');
			/*
				Skip rows with a path, because those are recursively refreshed when their containing
				structure is refreshed.
			*/
			if (path) {
				return;
			}
			/*
				"TwineScript" values, of course, must not be displayed.
			*/
			if (name.startsWith('TwineScript')) {
				return;
			}
			if (name in State.variables) {
				/*
					If the variable's value is different to that in State.variables,
					update it. Either way, add it to the "updated" list.
				*/
				updated.push(name);
				if (!is(State.variables[name],value)) {
					updateVariables(name, [], State.variables[name]);
				}
			}
			else {
				e.remove();
			}
			/*
				Since refresh() is called when the turn begins, no temporary variables should be
				instantiated yet, so we don't need to explicitly go through various scopes to
				find them.
			*/
		});
		updateVariablesTab();
		/*
			Now, add new variables that may not be present here, using the preceding
			"updated" list.
		*/
		for (let name in State.variables) {
			if (!name.startsWith('TwineScript') && !updated.includes(name)) {
				updateVariables(name, [], State.variables[name]);
			}
		}

		updateStorylets();

		/*
			Refresh the source pane.
		*/
		debugElement.find('.panel-source').text(Passages.get(State.passage).get('source'));
	}
	/*
		Having defined those functions, we register them as event handlers now.
	*/
	State.on('forward', refresh).on('back', refresh);

	State.on('load', () => $('.panel-variables-table').empty());

	VarRef.on('set', (obj, name, value) => {
		/*
			For a deep data structure (set:), VarRef.on will fire set callbacks for every object in the
			chain: $a's b's c's d to 1 will produce 'set' callbacks for c, b, a and State.variables.
			We only care about State.variables, the root.
		*/
		if (obj === State.variables || obj.TwineScript_VariableStore) {
			updateVariables(name, [], value, obj === State.variables ? "" : obj.TwineScript_VariableStoreName);
			updateStorylets();
		}
	})
	/*
		Deleting a row doesn't require its own function, but it does assume certain things
		about the variablesTable (such as, each row has a data-name attribute.)
	*/
	.on('delete', (obj, name) => {
		if (obj === State.variables) {
			variablesTable.find('[data-name="' + name + '"]:not(.temporary)').remove();
		}
	});

	const onError = (error, code) => {
		/*
			To ensure functional column widths, the .panel-errors pane contains a <table>.
		*/
		const row = $('<tr class="error-row">'
			+ '<td class="error-passage">' + State.passage + '</td>'
			+ '<td class="error-message">' + error.message + '</td>'
			+ '</tr>');
		/*
			Give the .error-message element the same mouseover title as the original rendered errors.
		*/
		row.find('.error-message').attr('title', code);
		/*
			Emergency: if 500+ errors would be present in the table, remove the top one so that the error DOM
			doesn't become too overloaded. Then, insert the row.
		*/
		const table = debugElement.find('.panel-errors table');
		const childRowCount = table.children().length + 1;
		if (childRowCount > 500) {
			table.children(':first-child').remove();
		}
		table.append(row);
		debugElement.find('.tab-errors').text(`${childRowCount} Error${childRowCount !== 1 ? 's' : ''}`);
	};
	TwineError.on('error', onError);
	/*
		If an error prompted Debug Mode to be enabled, add it to the pane, and also refresh the other panes.
	*/
	if (initialError) {
		onError(initialError, code);
		refresh();
	}

	/*
		Finally, append the debug mode element to the <body>.
	*/
	$(document.body).append(debugElement);
});
