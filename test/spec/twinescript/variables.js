describe("twinescript variables", function() {
	'use strict';
	describe("the (set:) macro", function() {
		it("requires one or more assignment requests", function() {
			expect("(set: 1)").markupToError();
			expect("(set: 'A')").markupToError();
			expect("(set: false)").markupToError();
			expect("(set: $a)").markupToError();
			expect("(set:)").markupToError();
			expect("(set: $a to 1)").not.markupToError();
			expect("(set: $a to 1, $b to 2)").not.markupToError();
			expect("(set: $a to 1, 2)").markupToError();
			expect("(set: $a into $b)").markupToError();
		});
		it("when given a variable assignment request, sets the variable to a value", function() {
			expect("(set: $a to 1)$a").markupToPrint("1");
		});
		it("when given multiple requests, performs them in order", function() {
			expect("(set: $a to 2, $b to 3, $c to 4, $d to $b)$d $c $a").markupToPrint("3 4 2");
		});
		it("can name a variable using astral characters", function() {
			expect("(set: $A𐌎B to 1)(print: $A𐌎B)").markupToPrint("1");
		});
		it("runs on evaluation, but can't be assigned or used as a value", function() {
			expect("(print: (set: $a to 1))").markupToError();
			expect("(print: (a:(set: $b to 2)))").markupToError();
			expect("(print: $a + $b)").markupToPrint("3");
		});
		it("when given a hook/string assignment request, fills the hook with the contents, as twinemarkup", function() {
			expect("|a>[Gee] |a>[Wow](set: ?a to '//Golly//')").markupToPrint("Golly Golly");
		});
		it("errors when a hook is assigned a non-string value", function() {
			expect("|a>[Gee] |a>[Wow](set: ?a to false)").markupToError();
			expect("|a>[Gee] |a>[Wow](set: ?a to (a:1,2,3))").markupToError();
		});
		it("assignment requests can't be assigned", function() {
			expect("(set: $wordy to ($wordy to 2)) ").markupToError();
			expect("(set: $wordy to (a: $wordy to 2)) ").markupToError();
		});
		it("doesn't pollute past turns", function() {
			runPassage("(set: $a to 1)","one");
			runPassage("(set: $a to 2)","two");
			Engine.goBack();
			expect("(print: $a)").markupToPrint("1");
		});
		it("doesn't pollute past turns, even when deeply modifying data structures", function() {
			runPassage("(set: $a to (a:(a:1),1))","one");
			runPassage("(set: $a's 1st's 1st to 2)","two");
			runPassage("(set: $a's 1st's 1st to 3)","three");
			Engine.goBack();
			expect("(print: $a)").markupToPrint("2,1");
		});
	});
	describe("bare variables in passage text", function() {
		it("for numbers, prints the number", function() {
			runPassage("(set:$x to 0.125)");
			expect("$x").markupToPrint("0.125");
			runPassage("(set:$y to 0)");
			expect("$y").markupToPrint("0");
		});
		it("for strings, renders the string", function() {
			runPassage("(set:$x to '//italic//')");
			expect("$x").markupToPrint("italic");
			runPassage("(set:$y to '')");
			expect("$y").markupToPrint("");
		});
		it("for booleans, renders nothing", function() {
			runPassage("(set:$x to true)");
			expect("$x").markupToPrint("");
			runPassage("(set:$y to false)");
			expect("$y").markupToPrint("");
		});
		it("for arrays, prints the array", function() {
			runPassage("(set:$x to (a:1,2))");
			expect("$x").markupToPrint("1,2");
			runPassage("(set:$y to (a:))");
			expect("$y").markupToPrint("");
		});
	});
});
