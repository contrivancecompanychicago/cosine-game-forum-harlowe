"use strict";
define(['jquery', 'utils/naturalsort'], ($, NaturalSort) => {
	/*
		A simple debug panel + tab class, used to display Variables, Errors, and so forth, which can be live-updated
		whenever the game state changes.
	*/
	const Sort = NaturalSort();
	const Panel = Object.seal({
		/*
			rowWrite is a function which produces a new DOM structure representing the passed-in data, or freshens up
				an existing row if passed in
			rowCheck compares an existing DOM structure created by rowWrite to a given data row, to see if the
			former represents the latter.
			tabUpdate is an overridable function for updating the tab's name.
		*/
		create({className, rowWrite, rowCheck, rowSort, columnHead, tabName, tabNameCounter = true, tabUpdate}) {
			const panel = $(`<div class='panel panel-${className}' style='${this.defaultMaxHeight ? 'max-height:' + this.defaultMaxHeight + 'px' : ''}' hidden><div class="resizer-v"></div><table class='panel-rows'></table></div>`);
			const tab = $(`<button class='tab tab-${className}'>${tabNameCounter ? `0 ${tabName}s` : tabName}</button>`);
			tab.click(() => {
				tab.toggleClass('enabled');
				tab.parent().siblings('.panel').attr('hidden','');
				if (tab.is('.enabled')) {
					tab.siblings('.tab:not(.tab-' + className + ')').removeClass('enabled');
					panel.removeAttr("hidden");
				}
			});
			let ret;
			panel.on("click", "th", ({target}) => {
				target = $(target);
				let dir = target.attr('data-order');
				dir = dir === "desc" ? 'asc' : 'desc';
				ret.sort(target.attr('data-col'), dir);
				/*
					Clear the arrows from other columns except for the current column.
				*/
				panel.find('th[data-order]').removeAttr('data-order');
				target.attr('data-order', dir);
			});
			/*
				The default tab update function is to label it "2 Errors", etc.
			*/
			if (!tabUpdate) {
				tabUpdate = count => tab.text(tabNameCounter ? `${count} ${tabName}${count !== 1 ? 's' : ''}` : tabName);
			}
			ret = Object.assign(Object.create(this), {
				tabName,
				tab,
				panel,
				panelRows: panel.find('.panel-rows'),
				rowWrite,
				rowSort,
				rowCheck,
				columnHead,
				tabUpdate,
			});
			return ret;
		},
		sort(column, dir) {
			this.panelRows.children(':not(.panel-head, .panel-row-source)').get().sort((a,b) => {
				if (dir === "desc") {
					[a,b] = [b,a];
				}
				a = a.querySelector("." + column);
				b = b.querySelector("." + column);
				return (this.rowSort && this.rowSort(column, $(a), $(b))) || Sort(
					a.textContent,
					b.textContent
				);
			}).forEach(row => {
				const sourceRow = $(row).next('.panel-row-source').get();
				this.panelRows.append(row, sourceRow);
			});
		},
		update(data, count) {
			const {rowCheck, rowWrite, panelRows, columnHead, panel} = this;
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
				Update the tab.
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
			/*
				Optionally sort if sorting is enabled.
				If a header is set to sort by default, then that sort will occur now.
			*/
			const sort = panel.find('th[data-order]');
			if (sort.length) {
				this.sort(sort.attr('data-col'), sort.attr('data-order'));
			}
		},
		defaultMaxHeight: 300,
	});
	return Panel;
});