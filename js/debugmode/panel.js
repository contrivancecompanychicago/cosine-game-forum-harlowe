"use strict";
define(['jquery'], ($) => {
	/*
		A simple debug panel + tab class, used to display Variables, Errors, and so forth, which can be live-updated
		whenever the game state changes.
	*/
	const Panel = Object.freeze({
		/*
			rowWrite is a function which produces a new DOM structure representing the passed-in data, or freshens up
				an existing row if passed in
			rowCheck compares an existing DOM structure created by rowWrite to a given data row, to see if the
			former represents the latter.
			tabUpdate is an overridable function for updating the tab's name.
		*/
		create({className, rowWrite, rowCheck, columnHead, tabName, tabUpdate}) {
			const panel = $(`<div class='panel panel-${className}' hidden><table class='panel-rows'></table></div>`);
			const tab = $(`<button class='tab tab-${className}'>0 ${tabName}s</button>`);
			tab.click(() => {
				tab.toggleClass('enabled');
				tab.parent().siblings('.panel').attr('hidden','');
				if (tab.is('.enabled')) {
					tab.siblings('.tab:not(.tab-' + className + ')').removeClass('enabled');
					panel.removeAttr("hidden");
				}
			});
			/*
				The default tab update function is to label it "2 Errors", etc.
			*/
			if (!tabUpdate) {
				tabUpdate = count => tab.text(`${count} ${tabName}${count !== 1 ? 's' : ''}`);
			}
			return Object.assign(Object.create(this), {
				tabName,
				tab,
				panel,
				panelRows: panel.find('.panel-rows'),
				rowWrite,
				rowCheck,
				columnHead,
				tabUpdate,
			});
		},
		update(data, count) {
			const {rowCheck, rowWrite, panelRows, columnHead} = this;
			const newRows = [];
			const children = panelRows.children();
			/*
				For each of the data rows, check if an existing row matches
				that data, using the specified rowCheck function. If so, replace
				it with a new row. Otherwise, insert the new row.
			*/
			data.forEach(d => {
				const existingRow = children.filter((_,e) => rowCheck(d,$(e)));
				const newRow = rowWrite(d, existingRow.length && existingRow);
				if (!existingRow.length) {
					panelRows.append(newRow);
				}
				newRows.push(...newRow.get());
			});
			/*
				Remove rows once their data is gone (but don't remove the table head).
			*/
			children.filter((_,e) => !newRows.includes(e) && !e.className.includes('panel-head')).remove();
			/*
				And finally, update the tab.
			*/
			this.tabUpdate(count);
			/*
				If the table has any rows in it, add the headers. Otherwise, remove them.
			*/
			if (count > 0 && !panelRows.find('.panel-head').length) {
				panelRows.prepend(columnHead());
			} else if (count === 0) {
				panelRows.find('.panel-head').remove();
			}
		},
	});
	return Panel;
});