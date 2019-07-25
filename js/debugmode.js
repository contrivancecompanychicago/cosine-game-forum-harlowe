"use strict";
define(['jquery', 'utils', 'state', 'internaltypes/varref', 'internaltypes/twineerror', 'utils/operationutils', 'engine', 'passages'],
($, Utils, State, VarRef, TwineError, {objectName, typeName, is, isObject}, Engine, Passages) => () => {
	/*
		Debug Mode

		When you test a Harlowe story using the "Test Story" option, debug mode is enabled. This mode adds a pane to the bottom of
		the page, which contains a few tools to examine your story, the current state, and how the macros in the current passage are
		behaving.

		This module exports a single function which, when run, performs all of the Debug Mode setup.
	*/
	const debugElement = $(`<tw-debugger>
		<div class='panel panel-variables'></div>
		<div class='panel panel-errors' hidden><table></table></div>
		<div class='panel panel-source' hidden></div>
		<div class='tabs'>
		<button class='tab tab-variables enabled'>0 Variables</button> <button class='tab tab-source'>Source</button> <button class='tab tab-errors'>0 Errors</button>
		</div>
		Turns: <select class='turns' disabled></select><button class='show-invisibles'>Debug View</button></tw-debugger>`);

	/*
		Set up the showInvisibles button, which toggles debug mode CSS (showing <tw-expression> elements and such)
		when clicked. It uses the class 'debug-mode' on <tw-story> to reveal it.
	*/
	const showInvisibles = debugElement.find('.show-invisibles');
	showInvisibles.click(() => {
		$(document.documentElement).toggleClass('debug-mode');
		showInvisibles.toggleClass('enabled');
	});
	/*
		Additionally, set up the tabs and panes.
	*/
	['variables', 'source', 'errors'].forEach((name)=> {
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

	const variablesTable = debugElement.find('.panel-variables');
	/*
		Update the number of variables on the showVariables button.
	*/
	function updateVariablesTabName() {
		const children = variablesTable.children();
		debugElement.find('.tab-variables').text(`${children.length} Variable${children.length !== 1 ? 's' : ''}`);
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
		let row = variablesTable.children('[data-name="' + Utils.escape(name + '') + '"][data-path="' + Utils.escape(path + '') + '"]');
		/*
			The debug name used defers to the TwineScript_DebugName if it exists,
			and falls back to the objectName if not. Note that the TwineScript_DebugName can contain HTML structures
			(such as a <tw-colour> for colours) but the objectName could contain user-inputted data, so only the latter is escaped.
		*/
		const val = isObject(value) && value.TwineScript_DebugName ? value.TwineScript_DebugName() : Utils.escape(objectName(value));
		if (!row.length) {
			/*
				To provide easy comparisons for the refresh() method below,
				store the name and value of the row as data attributes of its element.
			*/
			row = $('<div class="variable-row" data-name="' + Utils.escape(name + '')
				+ '" data-path="' + Utils.escape(path + '')
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
			Create the <span>s for the variable's name and value.
		*/
		row.empty().append(
			"<span class='variable-name " + (trail ? '' : tempScope ? "temporary" : "global") + "'>"
			+ (trail ? "<span class='variable-path " + (tempScope ? "temporary" : "global") + "'>" + Utils.escape(trail) + "</span> " : '')
			+ Utils.escape(name + '')
			+ (tempScope ? ("<span class='temporary-variable-scope'>" + tempScope + "</span>") : "") +
			"</span><span class='variable-value'>" + val + "</span>"
		)
		/*
			Data structure entries are indented by their depth in the structure, to a maximum of 5 levels deep.
		*/
		.css('padding-left',Math.min(5,path.length)+'em')
		/*
			This append should cause the variablesTable to always sort data structure contents after the structure itself.
		*/
		.appendTo(variablesTable);

		updateVariablesTabName();

		/*
			To display each entry inside an array, map or set, directly below the
			row for their container structure, a simple recursive call to updateVariables()
			should be sufficient.
		*/
		if (Array.isArray(value)) {
			value.forEach((elem,i) => updateVariables(Utils.nth(i+1), path.concat(name), elem, tempScope));
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
		This function, called as a State event handler, synchronises the variablesTable
		with the entire variable state at the present.
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
				updateVariablesTabName();
			}
			/*
				Since refresh() is called when the turn begins, no temporary variables should be
				instantiated yet, so we don't need to explicitly go through various scopes to
				find them.
			*/
		});
		/*
			Now, add new variables that may not be present here, using the preceding
			"updated" list.
		*/
		for (let name in State.variables) {
			if (!name.startsWith('TwineScript') && !updated.includes(name)) {
				updateVariables(name, [], State.variables[name]);
			}
		}
		/*
			Refresh the source pane.
		*/
		debugElement.find('.panel-source').text(Passages.get(State.passage).get('source'));
	}
	/*
		Having defined those functions, we register them as event handlers now.
	*/
	State.on('forward', refresh).on('back', refresh);

	State.on('load', () => $('.panel-variables').empty());

	VarRef.on('set', (obj, name, value) => {
		/*
			For a deep data structure (set:), VarRef.on will fire set callbacks for every object in the
			chain: $a's b's c's d to 1 will produce 'set' callbacks for c, b, a and State.variables.
			We only care about State.variables, the root.
		*/
		if (obj === State.variables || obj.TwineScript_VariableStore) {
			updateVariables(name, [], value, obj === State.variables ? "" : obj.TwineScript_VariableStoreName);
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

	TwineError.on('error', (error, code) => {
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
	});

	/*
		Finally, append the debug mode element to the <body>.
	*/
	$(document.body).append(debugElement);
});
