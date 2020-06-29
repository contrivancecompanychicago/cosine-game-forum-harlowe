describe("metadata macros", function() {
	'use strict';
	describe("the (storylet:) macro", function() {
		it("accepts a 'when' lambda", function() {
			expect("(storylet:)").markupToError();
			expect("(storylet: each _a)").markupToError();
			expect("(storylet: when  true is true)").not.markupToError();
			expect("(storylet: where true is true)").markupToError();
		});
		it("displays nothing in passages when run", function() {
			expect("(storylet: when true is true)").not.markupToError();
		});
		it("cannot be printed or stored", function() {
			expect("(print: (storylet: when true is true))").markupToError();
			expect("(set: $a to (storylet: when true is true))").markupToError();
		});
		it("doesn't error when storylet macros are misused", function() {
			expect("(storylet: when $a is true)(storylet: when $c is true)").not.markupToError();
			expect("(if:true)[(storylet: when $a is true)]").not.markupToError();
		});
		it("errors at startup when a passage's (storylet:) appeared after a non-metadata macro", function() {
			var errors;
			errors = createPassage("(set: $b to 1)(storylet: when $b is 1)", "grault");
			expect(errors.length).not.toBe(0);
			errors = createPassage("(storylet: when $b is (a:))", "grault");
			expect(errors.length).toBe(0);
			errors = createPassage("(set: $b to 1)(storylet: when $b is 1)", "grault");
			expect(errors.length).not.toBe(0);
		});
		it("errors at startup when a passage has two or more (storylet:) calls", function() {
			var errors = createPassage("(storylet: when $a is true)(storylet: when $c is true)", "grault");
			expect(errors.length).not.toBe(0);
		});
		it("errors at startup when a (storylet:) call overrides a (metadata:) call", function() {
			var errors = createPassage("(storylet: when $a is true)(metadata: 'storylet', when $c is true)", "grault");
			expect(errors.length).not.toBe(0);
		});
		it("errors at startup when it causes an error", function() {
			var errors;
			errors = createPassage("(storylet: where $a is true)", "grault");
			expect(errors.length).not.toBe(0);
		});
		it("the lambda is accessible on the (passage:) datamap", function() {
			createPassage("(storylet: when true)", "grault");
			expect("(source:(passages: where its name is 'grault')'s 1st's storylet)").markupToPrint("when true");
		});
	});
	describe("the (open-storylets:) macro", function() {
		it("returns a sorted array of passages with (storylet:) in their prose, whose lambda returns true", function() {
			createPassage("**foobarbaz(storylet: when  true is true)**", "grault");
			createPassage("|a>[(storylet: when  $a is 1)]", "garply");
			createPassage("(storylet: when  true is false)", "corge");
			createPassage("(storylet: when  $a is > 1)", "quux");
			runPassage("(set: $a to 1)");
			expect("(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("garply grault ");
			runPassage("(set: $a to 2)");
			expect("(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("grault quux ");
			runPassage("(link-repeat:'garply')[(set:$a to 'a')]\n(link-repeat:'quux')[(set:$a to 2)]");
		});
		it("errors at runtime if a lambda causes an error", function() {
			createPassage("(storylet: when $a is 3 + 'r')", "grault");
			expect("(open-storylets:)").markupToError();
			createPassage("(storylet: when it is 2)", "grault");
			expect("(open-storylets:)").markupToError();
		});
		describe("when evaluating (storylet:) lambdas", function() {
			it("'visits' refers to the containing passage itself", function() {
				createPassage("(storylet: when visits > 3)", "grault");
				createPassage("(storylet: when visits is 1)", "garply");
				goToPassage('grault');
				expect("(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("");
				goToPassage('grault');
				goToPassage('grault');
				goToPassage('grault');
				expect("(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("grault ");
			});
			it("temp variables can't be referenced", function() {
				createPassage("(storylet: when _b is 1)", "grault");
				expect("(set: _b to 1)(set: $a to (open-storylets:))").markupToError();
			});
			it("'exits' can't be referenced", function() {
				createPassage("(storylet: when exits is 1)", "grault");
				expect("(set: _b to 1)(set: $a to (open-storylets:))").markupToError();
			});
			it("'time' can't be referenced", function() {
				createPassage("(storylet: when time is 1)", "grault");
				expect("(set: _b to 1)(set: $a to (open-storylets:))").markupToError();
			});
			it("flow control blockers can't be used", function() {
				createPassage("(storylet: when (prompt: 'foo', 'bar') is 'baz')", "grault");
				expect("(set: _b to 1)(set: $a to (open-storylets:))").markupToError();
			});
		});
	});
	describe("the (metadata:) macro", function() {
		it("displays nothing in passages when run", function() {
			expect("(metadata: 'foo', 1, 'bar', 2)").markupToPrint('');
		});
		it("adds the given values to that passage's (passage:) datamap", function() {
			createPassage("(metadata: 'foo', 12, 'bar', 24)", "grault");
			expect("(print: 'foo' of (passage:'grault'))").markupToPrint("12");
		});
	});
});
