"use strict";
define(['jquery', 'utils', 'state', 'internaltypes/varref', 'internaltypes/twineerror', 'utils/operationutils', 'engine', 'passages', 'section', 'debugmode/panel'],
($, {escape,nth,storyElement}, State, VarRef, TwineError, {objectName, is, isObject, toSource}, Engine, Passages, Section, Panel) => (initialError, code) => {
	/*
		Debug Mode

		When you test a Harlowe story using the "Test Story" option, debug mode is enabled. This mode adds a pane to the bottom of
		the page, which contains a few tools to examine your story, the current state, and how the macros in the current passage are
		behaving.

		This module exports a single function which, when run, performs all of the Debug Mode setup.
	*/
	const root = $(document.documentElement);
	const debugElement = $(`<tw-debugger>
		<div class='panel panel-errors' hidden><table></table></div>
		<div class='tabs'></div>
		Turns: <select class='turns' disabled></select><button class='show-invisibles'>Debug View</button><button class='show-dom'>DOM View</button>
		</tw-debugger>`);
	const debugTabs = debugElement.find('.tabs');
	const showDOM = debugElement.find('.show-dom');
	const showInvisibles = debugElement.find('.show-invisibles');
	const turnsDropdown = debugElement.find('.turns');
	/*
		Set up the "Debug View" button, which toggles debug mode CSS (showing <tw-expression> elements and such)
		when clicked. It uses the class 'debug-mode' on <tw-story> to reveal it.
	*/
	showInvisibles.click(() => {
		root.toggleClass('debug-mode').removeClass('dom-debug-mode');
		showInvisibles.toggleClass('enabled');
		showDOM.removeClass('enabled');
	});
	/*
		Set up the "DOM View" button, which is mutually exclusive with the Debug View.
	*/
	showDOM.click(() => {
		root.toggleClass('dom-debug-mode').removeClass('debug-mode');
		showDOM.toggleClass('enabled');
		showInvisibles.removeClass('enabled');
	});

	/*
		Set up the turn dropdown, which provides a menu of turns in the state and permits the user
		to travel to any of them at will.
	*/
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
		if (i >= 1) {
			/*
				The turns dropdown should be disabled only if one or less turns is
				in the State history after we move forward.
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

	/*
		Set up the
		----------
		Variables
		---------
		panel.
		Temp variables in single passages are stored in the following Set, which is cleared
		whenever passage navigation occurs, reflecting temp variables' actual semantics.
	*/
	let localTempVariables = new Set();
	const Variables = Panel.create({
		className: "variables", tabName: "Variable",
		rowAdd({name, path, value, tempScope, type}) {
			/*
				The debug name used defers to the TwineScript_DebugName if it exists,
				and falls back to the objectName if not. Note that the TwineScript_DebugName can contain HTML structures
				(such as a <tw-colour> for colours) but the objectName could contain user-inputted data, so only the latter is escaped.
			*/
			const val = isObject(value) && value.TwineScript_DebugName ? value.TwineScript_DebugName() : escape(objectName(value));
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
				Typed variables should have their type restriction listed.
			*/
			const typeName = type ? toSource(type) : '';
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
			return $('<div class="variable-row">')
				.attr('data-name', name).attr('data-path', path+'')
				/*
					Data structure entries are indented by their depth in the structure, to a maximum of 5 levels deep.
				*/
				.css('padding-left', Math.min(5,path.length)+'em')
				.append(
					"<span class='variable-name " + (trail ? '' : tempScope ? "temporary" : "global") + "'>"
					+ (typeName ? "<span class='variable-type'>" + typeName + '-type </span>' : '')
					+ (trail ? "<span class='variable-path " + (tempScope ? "temporary" : "global") + "'>" + escape(trail) + "</span> " : '')
					+ (tempScope ? "_" : "$") + escape(name + '')
					+ (tempScope ? ("<span class='temporary-variable-scope'>" + tempScope + "</span>") : "") +
					"</span><span class='variable-value'>" + truncVal + "</span><span class='panel-row-buttons'>"
						+ (folddown ? "<tw-folddown tabindex=0>(source:)</tw-folddown>" : '')
						+ "</span>"
					+ (folddown ? "<div class='panel-row-source' style='display:none'>" + escape(toSource(value)) + "</div>" : "")
				);
		},
		rowCheck({name, path}, row) {
			return row.attr('data-name') === name && row.attr('data-path') === (path+'');
		},
	});
	/*
		This event handler updates variables whenever the state is changed. Each row of data is either a global
		variable, or a temp variable stored in the localTempVariables set, above.
	*/
	function updateVariables() {
		const rows = [];
		const globals = State.variables;
		let count = rows.length;
		/*
			The following recursive function adds entries for each value inside arrays, maps, and sets.
		*/
		function recursiveUpdateVariables(row) {
			/*
				Note that in Harlowe, pass-by-reference and circular structures should be impossible to
				produce. However, just in case, here's a crude emergency exit.
			*/
			if (rows.length > 500) {
				return;
			}
			rows.push(row);
			const path = row.path.concat(row.name);
			const {value, tempScope} = row;
			if (Array.isArray(value)) {
				value.forEach((elem,i) =>
					recursiveUpdateVariables({name: nth(i+1), path, value:elem, tempScope})
				);
			}
			else if (value instanceof Map) {
				[...value].forEach(([key,elem]) =>
					recursiveUpdateVariables({name:key,       path, value:elem, tempScope})
				);
			}
			else if (value instanceof Set) {
				/*
					Sets don't have keys. So, using "???" for every entry is what we're forced to do
					to keep this display consistent with the others.
				*/
				[...value].forEach((elem) =>
					recursiveUpdateVariables({name:"???",     path, value:elem, tempScope})
				);
			}
		}
		for (let name in globals) {
			if (!name.startsWith('TwineScript')) {
				count += 1;
				recursiveUpdateVariables({name, path:[], value:globals[name], tempScope:'',
					type: globals.TwineScript_TypeDefs && globals.TwineScript_TypeDefs[name]
				});
			}
		}
		/*
			The order of variables is: global, then temp.
		*/
		rows.push(...localTempVariables);
		count += localTempVariables.size;
		Variables.update(rows, count);
		/*
			The following line is exclusively for the benefit of the documentation's live code preview
			pane, which displays variables but nothing else.
		*/
		Variables.panel[(count ? 'remove' : 'add') + 'Class']('panel-variables-empty');
	}
	VarRef.on('set', (obj, name, value) => {
		/*
			For a deep data structure (set:), VarRef.on will fire set callbacks for every object in the
			chain: $a's b's c's d to 1 will produce 'set' callbacks for c, b, a and State.variables.
			We only care about the root variable store.
		*/
		/*
			Since temp variables' variable stores are tied to sections and can't be easily accessed
			from here, add their variable rows on each set() rather than getting updateVariables() to do it.
		*/
		if (obj !== State.variables && obj.TwineScript_VariableStoreName) {
			const tempScope = obj.TwineScript_VariableStoreName;
			const type = obj.TwineScript_TypeDefs && obj.TwineScript_TypeDefs[name];
			/*
				If a local variable was altered rather than added, then simply update its value.
			*/
			const row = localTempVariables.has(row => row.name === name && row.tempScope === tempScope);
			if (!row) {
				localTempVariables.add({name, path:[], value, tempScope, type});
			}
			else {
				row.value = value;
			}
		}
		updateVariables();
	})
	.on('delete', updateVariables);

	Variables.panel.append(
		`<div class='panel-variables-bottom'>
			<button class='panel-variables-copy'>Copy $ variables as (set:) call</button>
			<input class='clipboard' type="text" style='opacity:0;pointer-events:none;position:absolute;'></input>
		</div>`
	);
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

	/*
		Set up the
		-------------
		Enchantments
		-------------
		panel. Enchantments can, irksomely, be added and removed at arbitrary times. However,
		they are fairly simple to fully describe - they have just a scope, and either a changer
		(for (enchant:)) or a name (for (click:) etc.).
	*/
	const Enchantments = Panel.create({
		className: "enchantments", tabName: "Enchantment",
		rowAdd(enchantment) {
			const {scope, changer, name} = enchantment;
			let val;
			if (changer) {
				val = escape(objectName(changer));
			}
			else {
				val = "<em>enchanted via (" + name + ":)</em>";
			}
			/*
				Create the <span>s for the variable's name and value.
			*/
			return $('<div class="enchantment-row">')
				.data('enchantment',enchantment)
				.append(
					"<span class='enchantment-name'>" + toSource(scope)
					+ "</span><span class='enchantment-value'>"
					+ val + "</span>"
					+ (changer ? "<span class='panel-row-buttons'>"
						+ "<tw-folddown tabindex=0>(source:)</tw-folddown>"
						+ "</span><div class='panel-row-source' style='display:none'>" + escape(toSource(changer))
					: "") + "</div>"
				);
		},
		rowCheck(enchantment, row) {
			return row.data('enchantment') === enchantment;
		},
	});
	function updateEnchantments(section) {
		Enchantments.update(section.enchantments, section.enchantments.length);
	}
	Section.on('add', updateEnchantments).on('remove', updateEnchantments);

	/*
		Set up the 
		----------
		Storylets
		---------
		panel.
		The number of possible storylets in a story is fixed at startup. Active storylets
		are determined by running their lambdas whenever State changes, using the following blank Section.
	*/
	const storyletSection = Section.create(storyElement);
	const Storylets = Panel.create({
		className: "storylets", tabName: "Storylet",
		rowAdd({name, active, storyletSource}) {

			return $(`<div class="storylet-row ${!active ? 'storylet-closed' : ''}">`)
				.attr('data-name', name)
				/*
					Create the <span>s for the storylet's name and lambda.
				*/
				.append(
					"<span class='storylet-name'>" + name
					+ "</span><span class='storylet-lambda'>" + storyletSource + "</span>"
				);
		},
		rowCheck({name}, row) {
			return row.attr('data-name') === escape(name + '');
		},
	});
	/*
		The Storylets tab is hidden if there are no Storylets.
	*/
	Storylets.tab.hide();
	function updateStorylets() {
		const activeStorylets = Passages.getStorylets(storyletSection);
		const error = (TwineError.containsError(activeStorylets));
		/*
			While I could cache Passages.allStorylets on startup, doing so interferes with
			the unit tests (which change the initialised storylets frequently, unlike actual
			Harlowe code).
		*/
		const allStorylets = Passages.allStorylets();
		Storylets.update(allStorylets.map(e => ({
			name: e.get('name'),
			storyletSource: e.get('storylet').TwineScript_ToSource(),
			active: !error && activeStorylets.some(map => map.get('name') === e.get('name')),
		})), error ? 0 : activeStorylets.length);
		/*
			If the list was indeed an error, simply close and mark every storylet row,
			because storylet-listing macros currently won't work.
		*/
		Storylets.panel[(error ? 'add' : 'remove') + 'Class']('storylet-error');
		if (allStorylets.length) {
			Storylets.tab.show();
		}
	}
	VarRef.on('set', updateStorylets).on('delete', updateStorylets);

	/*
		Set up the
		------
		Source
		------
		panel. This simply holds one "row" that's manually updated without using the same Panel
		update -> rowCheck -> rowAdd lifecycle as the other panels.
	*/
	const Source = Panel.create({
		className: "source", tabName: "Source",
		rowAdd: $.noop,
		rowCheck: $.noop,
		tabUpdate: $.noop,
	});
	/*
		The Source tab shouldn't read "1 Source", unlike the others.
	*/
	Source.tab.text('Source');

	/*
		Set up the
		------
		Errors
		------
		panel. Again, this doesn't use the same lifecycle as the other panels, but it does have
		multiple rows, which are still inserted manually.
	*/
	const Errors = Panel.create({
		className: "errors", tabName: "Error",
		rowAdd: $.noop,
		rowCheck: $.noop,
	});
	const onError = (error, code) => {
		/*
			Emergency: if 500+ errors would be present in the table, remove the top one so that the error DOM
			doesn't become too overloaded. Then, insert the row.
		*/
		if (Errors.panelRows.children().length > 500) {
			Errors.panelRows.children(':first-child').remove();
		}
		const elem = $('<div class="error-row">'
			+ '<span class="error-passage">' + State.passage + '</span>'
			+ '<span class="error-message">' + error.message + '</span>'
			+ '</div>');
		elem.find('.error-message').attr('title', code);
		Errors.panelRows.append(elem);
		Errors.tabUpdate(Errors.panelRows.children().length);
	};
	TwineError.on('error', onError);

	/*
		Place all the panel elements inside, in order.
	*/
	debugElement.prepend(Variables.panel, Enchantments.panel, Errors.panel, Storylets.panel, Source.panel);
	debugTabs.prepend(Variables.tab, Enchantments.tab, Errors.tab, Storylets.tab, Source.tab);

	function refresh() {
		localTempVariables = new Set();
		updateVariables();
		updateStorylets();
		Enchantments.panelRows.empty();
		Enchantments.tabUpdate(0);
		if (State.passage) {
			Source.panelRows.text(Passages.get(State.passage).get('source'));
		}
	}
	/*
		Having defined those functions, we register them as event handlers now.
	*/
	State.on('forward', refresh).on('back', refresh).on('load', refresh);

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
