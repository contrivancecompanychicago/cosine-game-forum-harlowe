describe("debugging macros", function() {
	'use strict';
	describe("the (mock-visits:) macro", function() {
		beforeEach(function() {
			var t = "(print:visits)";
			createPassage(t, "grault");
			createPassage(t, "garply");
			createPassage(t, "qux");
		});
		it("takes any number of passage name strings", function() {
			expect("(mock-visits:)").markupToError();
			expect("(mock-visits:'bar')").markupToError();
			expect("(mock-visits:'bar','baz')").markupToError();
			expect("(mock-visits:'qux')").not.markupToError();
			expect("(mock-visits:'qux','bar')").markupToError();
			expect("(mock-visits:'qux','qux','qux')").not.markupToError();
			expect("(mock-visits:'qux','garply','grault','grault')").not.markupToError();
			expect("(mock-visits:'qux','garply','grault','foo')").markupToError();
		});
		// Can't test that it only works in debug mode, unfortunately.
		it("alters the 'visits' keyword to mock visits to each of the given passages", function() {
			runPassage("(mock-visits:'qux','qux','qux','grault')");
			var p = goToPassage("qux");
			expect(p.text()).toBe('4');
			p = goToPassage("garply");
			expect(p.text()).toBe('1');
			p = goToPassage("grault");
			expect(p.text()).toBe('2');
		});
		it("each successive (mock-visits:) call overrides the last", function() {
			runPassage("(mock-visits:'qux','qux','qux','grault')");
			var p = goToPassage("qux");
			expect(p.text()).toBe('4');
			runPassage("(mock-visits:'garply')");
			p = goToPassage("garply");
			expect(p.text()).toBe('2');
			Engine.goBack();
			Engine.goBack();
			expect($('tw-passage > :last-child').text()).toBe('4');
		});
		it("alters the (history:) keyword, adding its strings to the start", function() {
			runPassage("(mock-visits:'qux','qux','qux','grault')");
			expect('(history:)').markupToPrint('qux,qux,qux,grault,test');
		});
	});
	describe("the (assert:) macro", function() {
		it("takes a boolean", function() {
			expect("(assert:3<5)").not.markupToError();
			expect("(assert:6<8)").not.markupToError();
			expect("(assert:)").markupToError();
			expect("(assert:25)").markupToError();
		});
		it("if given false, it produces an error that shows the call's source", function() {
			expect(runPassage("(assert:3<1)").find('tw-error').text()).toContain("(assert:3<1)");
			expect(runPassage("(assert:45").find('tw-error').text()).not.toContain("(assert:45)");
		});
	});
	describe("the (assert-exists:) macro", function() {
		it("takes a string or hook name", function() {
			expect("(assert-exists:true)").markupToError();
			expect("(assert-exists:)").markupToError();
			expect("(assert-exists:25)").markupToError();
			expect("(assert-exists:?red)|red>[]").not.markupToError();
			expect("(assert-exists:'bess')bess").not.markupToError();
		});
		it("errors if the given hook does not exist in the passage", function() {
			expect("(assert-exists:?red)|red>[]").not.markupToError();
			expect("(assert-exists:'bess')bess").not.markupToError();
		});
	});
});
