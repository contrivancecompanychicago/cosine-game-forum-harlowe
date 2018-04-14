describe("patterns", function() {
	'use strict';
	describe("type names", function() {
		it("are keywords matching the names of Harlowe data types", function() {
			["data", "array", "boolean", "changer", "colour",
			"color", "command", "dm", "datamap", "ds", "dataset", "hookname",
			"lambda", "number", "num", "string", "str", "vtov"].forEach(function(name) {
				expect("(print:" + name + ")").markupToPrint("[the " + name + " data type]");
			});
		});
		it("resist most operations", function() {
			expect("(print:num + str)").markupToError();
			expect("(print:num - str)").markupToError();
			expect("(print:num is in str)").markupToError();
			expect("(print:num contains str)").markupToError();
			expect("(print:num and str)").markupToError();
		});
		xit("setting a bare type name is an error", function() {
		});
	});
});
