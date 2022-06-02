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
			errors = createPassage("(set: $b to 1)(story-let: when $b is 1)", "grault");
			expect(errors.length).not.toBe(0);
			errors = createPassage("(story-let: when $b is (a:))", "grault");
			expect(errors.length).toBe(0);
			errors = createPassage("(set: $b to 1)(story-let: when $b is 1)", "grault");
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
	describe("the (link-storylet:) macro", function() {
		it("accepts optional link text, plus a non-zero whole number or a 'where' lambda, plus optional unavailable text", function() {
			expect("(link-storylet: 'ears')").markupToError();
			expect("(link-storylet:)").markupToError();
			expect("(link-storylet: 0)").markupToError();
			expect("(link-storylet: 2.1)").markupToError();
			expect("(link-storylet: 2)").not.markupToError();
			expect("(link-storylet: -1)").not.markupToError();
			expect("(link-storylet: 'ears', 2)").not.markupToError();
			expect("(link-storylet: 'ears', where its tags contains 'e')").not.markupToError();
			expect("(link-storylet: 'ears', 2, where its tags contains 'e')").markupToError();
			expect("(link-storylet: 'ears', where its tags contains 'e', 'foo')").not.markupToError();
			expect("(link-storylet: 'ears', 2, 'bar')").not.markupToError();
		});
		it("given an index n, creates a link to the nth open storylet, using the same order as (open-storylets:)", function() {
			createPassage("**foobarbaz(Story-let: when  true is true)**", "grault");
			createPassage("|a>[(storylet: when  $a is 1)]", "garply");
			createPassage("(storylet: when  true is false)", "corge");
			createPassage("(storylet: when  $a is > 1)", "quux");
			runPassage("(set: $a to 1)");
			expect("(link-storylet:1) (link-storylet:2)").markupToPrint("garply grault");
			runPassage("(set: $a to 2)");
			expect("(link-storylet:1) (link-storylet:2)").markupToPrint("grault quux");
		});
		it("given an index n, links to the nth (open-storylets:) result", function() {
			createPassage("**foobarbaz(Story-let: when $a is 1)**", "grault");
			createPassage("|a>[(storylet: when $a is 1)]", "garply");
			createPassage("(storylet: when $a is > 1)", "corge");
			createPassage("(storylet: when $a is > 1)", "quux");
			expect("(set:$a to 1)(link-storylet: 2)").markupToPrint('grault');
			expect("(set:$a to 2)(link-storylet: 2)").markupToPrint('quux');
		});
		it("if the index n is negative, links to the nthlast (open-storylets:) result", function() {
			createPassage("**foobarbaz(Story-let: when $a > 1)**", "grault");
			createPassage("|a>[(storylet: when $a > 1)]", "garply");
			createPassage("(storylet: when $a is > 1)", "corge");
			createPassage("(storylet: when $a is > 1)", "quux");
			expect("(set:$a to 2)(link-storylet: -1) (link-storylet: -2)").markupToPrint('quux grault');
		});
		it("given a 'where' lambda, creates a link to the first (open-storylets:) result to match the condition", function() {
			createPassage("**foobarbaz(Story-let: when $a is 1)**", "grault");
			createPassage("|a>[(storylet: when $a is 1)]", "garply");
			createPassage("(storylet: when $a is > 1)", "corge");
			createPassage("(storylet: when $a is > 1)", "quux");
			expect("(set:$a to 1)(link-storylet: where its name contains 't')").markupToPrint('grault');
			expect("(set:$a to 2)(link-storylet: where its name contains 'x')").markupToPrint('quux');
		});
		it("if there are no matches, prints the unavailable text, if given, or nothing", function() {
			createPassage("(storylet: when $a is > 1)", "corge");
			createPassage("(storylet: when $a is > 1)", "quux");
			expect("(set:$a to 1)(link-storylet: 2)").markupToPrint('');
			expect("(set:$a to 2)(link-storylet: where its name is 'qux')").markupToPrint('');
			var p = runPassage("(set:$a to 1)(link-storylet: 2, 'foobaz')");
			expect(p.text()).toBe('foobaz');
			expect(p.find('tw-link').length).toBe(0);
			p = runPassage("(set:$a to 2)(link-storylet: where its name is 'qux', 'foobaz')");
			expect(p.text()).toBe('foobaz');
			expect(p.find('tw-link').length).toBe(0);
		});
		it("uses the optional string as the link text instead of the passage name", function() {
			createPassage("(storylet: when $a is > 1)", "corge");
			createPassage("(storylet: when $a is > 1)", "quux");
			expect("(set:$a to 2)(link-storylet: 'foo', 1)").markupToPrint('foo');
			expect("(link-storylet: 'bar', where its name contains 'x')").markupToPrint('bar');
		});
		it("errors at runtime if a lambda causes an error", function() {
			createPassage("(storylet: when $a is 3 + 'r')", "grault");
			expect("(link-storylet:1)").markupToError();
			createPassage("(storylet: when it is 2)", "grault");
			expect("(link-storylet:1)").markupToError();
		});
	});
	describe("the (open-storylets:) macro", function() {
		it("returns a sorted array of passages with (storylet:) in their prose, whose lambda returns true", function() {
			createPassage("**foobarbaz(Story-let: when  true is true)**", "grault");
			createPassage("|a>[(storylet: when  $a is 1)]", "garply");
			createPassage("(storylet: when  true is false)", "corge");
			createPassage("(storylet: when  $a is > 1)", "quux");
			runPassage("(set: $a to 1)");
			expect("(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("garply grault ");
			runPassage("(set: $a to 2)");
			expect("(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("grault quux ");
		});
		it("uses an optional 'where' lambda to restrict the returned storylets", function() {
			createPassage("**foobarbaz(Story-let: when $a is 1)**", "grault");
			createPassage("|a>[(storylet: when $a is 1)]", "garply");
			createPassage("(storylet: when $a is > 1)", "corge");
			createPassage("(storylet: when $a is > 1)", "quux");
			expect("(set:$a to 1)(print:(open-storylets: where its name contains 't')'s 1st's name)").markupToPrint('grault');
			expect("(set:$a to 2)(print:(open-storylets: where its name contains 'x')'s 1st's name)").markupToPrint('quux');
		});
		it("errors at runtime if a lambda causes an error", function() {
			createPassage("(storylet: when $a is 3 + 'r')", "grault");
			expect("(open-storylets:)").markupToError();
			createPassage("(storylet: when it is 2)", "grault");
			expect("(open-storylets:)").markupToError();
		});
		it("sorts passages with a greater 'urgency' metadata number higher", function() {
			createPassage("(storylet: when true)(urgency:2)", "grault");
			createPassage("(storylet: when true)", "garply");
			createPassage("(storylet: when true)(urgency:-1)", "aldo");
			expect("(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("grault garply aldo ");
		});
		it("only includes passages with the highest 'exclusivity' metadata number", function() {
			createPassage("(storylet: when $a is 1)(exclusivity:2)", "grault");
			createPassage("(storylet: when $a is 1)(exclusivity:2)", "qux");
			createPassage("(storylet: when $a or $b is 1)", "garply");
			createPassage("(storylet: when $a or $b or $c is 1)(exclusivity:-1)", "aldo");
			createPassage("(storylet: when $a or $b or $c is 1)(exclusivity:-2)", "walter");
			expect("(set:$a to 1)(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("grault qux ");
			expect("(set:$a to 0, $b to 1)(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("garply ");
			expect("(set:$b to 0, $c to 1)(for: each _a, ...(open-storylets:))[(print:_a's name) ]").markupToPrint("aldo ");
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
		it("accepts valid dataname and datavalue pairs", function() {
			expect("(metadata: 'foo')").markupToError();
			expect("(metadata: 'foo', 1, 'bar')").markupToError();
			expect("(metadata: true, 1)").markupToError();
			expect("(metadata: 'foo', 1, 'bar', 2)").not.markupToError();
		});
		it("displays nothing in passages when run", function() {
			expect("(metadata: 'foo', 1, 'bar', 2)").markupToPrint('');
		});
		it("adds the given values to that passage's (passage:) datamap", function() {
			createPassage("(metadata: 'foo', 12, 'bar', 24)", "grault");
			expect("(print: 'foo' of (passage:'grault'))").markupToPrint("12");
		});
	});
	['urgency','exclusivity'].forEach(function(name) {
		describe("the (" + name + ":) macro", function() {
			it("accepts only numbers", function() {
				expect("(" + name + ": 'foo')").markupToError();
				expect("(" + name + ": true)").markupToError();
				expect("(" + name + ": (a:))").markupToError();
				expect("(" + name + ": 2)").not.markupToError();
			});
			it("displays nothing in passages when run", function() {
				expect("(" + name + ": 2)").markupToPrint('');
			});
			it("adds the given number to that passage's (passage:) datamap as the '" + name + "' data value", function() {
				createPassage("(" + name + ": 12)", "grault");
				expect("(print: '" + name + "' of (passage:'grault'))").markupToPrint("12");
			});
		});
	});
});
