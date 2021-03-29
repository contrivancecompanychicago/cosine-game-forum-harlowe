describe("macro calls", function() {
	'use strict';
	it("consist of a (, the name, a :, arguments, and )", function() {
		expect("(a:)").markupToPrint("");
		expect("(a:1)").markupToPrint("1");
		expect("(a:1,1)").markupToPrint("1,1");

		expect("(a 1,1)").markupToPrint("(a 1,1)");
		expect("(a:1,1").markupToPrint("(a:1,1");
	});
	it("can have whitespace between the :, each argument, and )", function() {
		expect("(a: \n )").markupToPrint("");
		expect("(a:\n1 )").markupToPrint("1");
		expect("(a:\n 1\n ,\n 1\n )").markupToPrint("1,1");
		expect("(a:\n\t1\n\t,\n\t1\n\t)").markupToPrint("1,1");
		expect("(print:2\nis 2)").markupToPrint("true");
	});
	it("cannot have whitespace between the name and :", function() {
		expect("(a : )").markupToPrint("(a : )");
	});
	it("cannot have whitespace between the ( and name", function() {
		expect("( a: )").markupToPrint("( a: )");
	});
	it("cannot have a forward slash following the :", function() {
		expect("(http://example.org)").markupToPrint("(http://example.org)");
	});
	it("can have a trailing , after the final argument", function() {
		expect("(a:\n 1\n ,\n 1\n, )").markupToPrint("1,1");
	});
	describe("changer macro combining", function() {
		it("consists of a macro, a +, and another macro", function() {
			expect("(text-style:'bold')+(text-style:'bold')[]").not.markupToError();
		});
		it("can be combined with itself any number of times", function() {
			expect("(text-style:'bold')" + "+(text-style:'bold')".repeat(10) + "[]").not.markupToError();
		});
		it("can be combined with variables holding changers", function() {
			runPassage("(set:$foo to (text-style:'bold'))");
			expect("(text-style:'bold')+$foo[]").not.markupToError();
			expect("$foo+(text-style:'bold')[]]").not.markupToError();
		});
		it("errors if the right macro is not a changer", function() {
			expect("(text-style:'bold')+(print:'foo')").markupToError();
		});
		it("errors if the + is missing", function() {
			expect("(text-style:'bold')(text-style:'bold')[]").markupToError();
		});
	});
});
