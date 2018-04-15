describe("patterns", function() {
	'use strict';
	var typenames = ["data", "array", "boolean", "changer", "colour",
		"color", "command", "dm", "datamap", "ds", "dataset", "hookname",
		"lambda", "number", "num", "string", "str"];
	describe("type names", function() {
		it("cannot be stored or printed", function() {
			expect("(set:$a to num)").markupToError();
			expect("(print:num)").markupToError();
		});
		it("resist most operations", function() {
			expect("(print:num + str)").markupToError();
			expect("(print:num - str)").markupToError();
			expect("(print:num is in str)").markupToError();
			expect("(print:num contains str)").markupToError();
			expect("(print:num and str)").markupToError();
		});
	});
	describe("the 'is a' operator", function() {
		function mainTest(op) {
			[
				[2,"number","num"],
				["'X'","string","str"],
				['(a:)',"array"],
				['true',"boolean"],
				['(dm:)',"datamap","dm"],
				['(ds:)','dataset',"ds"],
				['red','colour','color'],
				['(each _a)','lambda'],
				['?foo','hookset'],
				['number','typename']
			].forEach(function(e) {
				typenames.forEach(function(name) {
					expect("(print:" + e[0] + " " + op + " " + name + ")")
						.markupToPrint(((op !== "is not a") === (name === e[1] || name === e[2] || name === "data")) + '');
				});
			});
		}
		it("checks if the left side is an instance of the right type", function() {
			mainTest("is a");
		});
		it("can also be written as 'is an'", function() {
			mainTest("is an");
		});
		it("can be negated using the form 'is not a'", function() {
			mainTest("is not a");
		});
		it("errors when the right side is not a type name", function() {
			expect("(print: 2 is a 2)").markupToError();
			expect("(print: (a:) is a (a:))").markupToError();
			expect("(print: 'x' is a 'string')").markupToError();
		});
		it("has correct order of operations with 'to' and 'into'", function (){
			expect("(set: $a to 2 is a num)(print:$a)").markupToPrint("true");
			expect("(put: 2 is a num into $a)(print:$a)").markupToPrint("true");
			expect("(set: $a to 2 is a str)(print:$a)").markupToPrint("false");
			expect("(put: 2 is a str into $a)(print:$a)").markupToPrint("false");
		});
		it("can compare variables as the subject of 'to' and 'into'", function (){
			runPassage("(set:$a to 1)");
			expect("(set: $b to $a is a number)(print:$b)").markupToPrint("true");
			expect("(put: $a is a number into $b)(print:$b)").markupToPrint("true");
		});
		it("works with elisions", function () {
			expect("(print: 2 is a number or string)").markupToPrint("true");
			expect("(print: 2 is a str or array or color or num)").markupToPrint("true");
			expect("(print: 2 is a number and number)").markupToPrint("true");
			expect("(print: 2 is a number and true)").markupToPrint("true");
		});
		it("errors on ambiguous elisions", function () {
			expect("(print: 2 is not a number or string)").markupToError();
			expect("(print: 2 is not a number and string)").markupToError();
		});
	});
});
