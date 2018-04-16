describe("patterns", function() {
	'use strict';
	var datatypes = ["array", "boolean", "changer", "colour",
		"color", "command", "dm", "datamap", "ds", "dataset",
		"number", "num", "string", "str"];

	var typesAndValues = [
		[2,"number","num"],
		["'X'","string","str"],
		['(a:)',"array"],
		['true',"boolean"],
		['(dm:)',"datamap","dm"],
		['(ds:)','dataset',"ds"],
		['red','colour','color']
	];
	describe("datatypes", function() {
		it("are keywords matching permitted storable values", function() {
			datatypes.forEach(function(name) {
			var name2 = (
				name === "dm" ? "datamap" :
				name === "ds" ? "dataset" :
				name === "num" ? "number" :
				name === "str" ? "string" :
				name === "color" ? "colour" :
				name
			);
				expect("(print:" + name +")").markupToPrint("[the " + name2 + " datatype]");
			});
		});
		it("resist most operations", function() {
			expect("(print:num + str)").markupToError();
			expect("(print:num - str)").markupToError();
			expect("(print:num is in str)").markupToError();
			expect("(print:num contains str)").markupToError();
			expect("(print:num and str)").markupToError();
		});
	});
	function isATest(op) {
		typesAndValues.forEach(function(e) {
			datatypes.forEach(function(name) {
				expect("(print:" + e[0] + " " + op + " " + name + ")")
					.markupToPrint(((op !== "is not a") === (name === e[1] || name === e[2])) + '');
			});
		});
	}
	describe("the 'is a' operator", function() {
		it("checks if the left side is an instance of the right type", function() {
			isATest("is a");
		});
		it("can also be written as 'is an'", function() {
			isATest("is an");
		});
		it("can be negated using the form 'is not a'", function() {
			isATest("is not a");
		});
		it("errors when the right side is not a datatype", function() {
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
	describe("the 'matches' operator", function() {
		it("when given data that doesn't contain datatypes, behaves like 'is'", function() {
			expect("(print: 2 matches 2)").markupToPrint("true");
			expect("(print: '2' matches '2')").markupToPrint("true");
			expect("(print: 2 matches '2')").markupToPrint("false");
			expect("(print: 1 matches true)").markupToPrint("false");
			expect("(print: (a:2,3,4) matches (a:2,3,4))").markupToPrint("true");
			expect("(print: (a:2,3,4) matches (a:2,3,5))").markupToPrint("false");
			expect("(print: (datamap:'a',2,'b',4) matches (datamap:'b',4,'a',2))").markupToPrint("true");
			expect("(print: (datamap:'a',2,'b',4) matches (datamap:'b',4,'a',3))").markupToPrint("false");
			expect("(print: (dataset:2,3,4) matches (dataset:2,3,4))").markupToPrint("true");
			expect("(print: (dataset:2,3,4) matches (dataset:2,3,4,5))").markupToPrint("false");
		});
		it("when given single datatypes, behaves like 'is a'", function() {
			isATest("matches");
		});
		typesAndValues.forEach(function(e) {
			var value = e[0], type1 = e[1], type2 = e[2] || type1;

			it("matches the " + type1 + " datatype inside arrays to a " + type1 + " in the same position", function() {
				expect("(print: (a:" + type1 + ") matches (a:" + value + "))").markupToPrint("true");
				expect("(print: (a:" + [type2,value,type1] + ") matches (a:" + [value,value,value] + "))").markupToPrint("true");
				expect("(print: (a:(a:(a:" + type2 + "))) matches (a:(a:(a:" + value + "))))").markupToPrint("true");

				expect("(print: (a:" + type2 + ") matches (a:))").markupToPrint("false");
				expect("(print: (a:" + type1 + ") matches (a:(a:" + value + ")))").markupToPrint((type1 === "array")+'');
				expect("(print: (a:" + type1 + ",3," + type1 + ") matches (a:3,2,4))").markupToPrint("false");
				expect("(print: " + type1 + " matches " + type1 + ")").markupToPrint("false");
			});
			it("matches the " + type1 + " datatype inside datamaps to a " + type1 + " in the same position", function() {
				expect("(print: (dm: 'A', " + type1 + ") matches (dm: 'A', " + value + "))").markupToPrint("true");
				expect("(print: (dm: " + ['"A"',type1,'"B"',type2,'"C"',"(a:" + type1 + ")"] +
					") matches (dm:" + ['"A"',value,'"B"',value,'"C"',"(a:" + value + ")"] + "))").markupToPrint("true");
			});
			xit("matches the " + type1 + " datatype inside datasets to a " + type1 + " regardless of position", function() {
				expect("(print: (ds:" + [type1,'"X"',false] + ") matches (ds:" + ['"X"',false,value] + "))").markupToPrint("true");
			});
		});
	});
});
