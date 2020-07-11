describe("miscellaneous hook changer macros", function() {
	'use strict';
	describe("the (hook:) macro", function () {
		it("requires exactly 1 string argument", function() {
			expect("(print:(hook:))").markupToError();
			expect("(print:(hook:1))").markupToError();
			expect("(print:(hook:'A','B'))").markupToError();
			expect("(print:(hook:'A'))").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(hook:'A')").markupToError();
			expect("(hook:'A')[]").not.markupToError();
		});
		it("errors when given an empty string", function() {
			expect("(hook:'')[]").markupToError();
		});
		it("gives a name to the hook", function (){
			runPassage("(hook:'grault')[foo]");
			expect($('tw-passage').find('tw-hook').attr('name')).toBe('grault');
		});
	});
	describe("the (verbatim:) macro", function() {
		it("takes no values", function() {
			expect("(print:(verbatim:))").not.markupToError();
			expect("(print:(verbatim:1))").markupToError();
			expect("(print:(verbatim:'A','B'))").markupToError();
			expect("(print:(verbatim:'A'))").markupToError();
		});
		it("is aliased as (v6m:)", function() {
			expect("(print:(verbatim:) is (v6m:))").markupToPrint('true');
		});
		it("when attached to a hook, prints that hook's source verbatim", function() {
			expect("(verbatim:)[$foo]").markupToPrint('$foo');
		});
		it("when attached to a command, prints that hook's source verbatim", function() {
			expect("(verbatim:)(print:'$foo')").markupToPrint('$foo');
			expect("(verbatim:)(print:(source:(a:)))").markupToPrint('(a:)');
		});
	});
	describe("the (verbatim-print:) macro", function() {
		it("takes any one value", function() {
			expect("(verbatim-print:)").markupToError();
			expect("(verbatim-print:'A')").not.markupToError();
			expect("(verbatim-print:(css:''))").not.markupToError();
			expect("(verbatim-print:red)").not.markupToError();
		});
		it("is aliased as (v6m-print:)", function() {
			expect("(v6m-print:'$foo')").markupToPrint('$foo');
		});
		it("prints the given value verbatim", function() {
			expect("(verbatim-print:'$foo')").markupToPrint('$foo');
			expect("(set:$foo to '**bar**')(verbatim-print:$foo)").markupToPrint('**bar**');
		});
	});
});
