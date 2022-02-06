describe("debugging macros", function() {
	'use strict';
	beforeEach(function() {
		Utils.options.debug = true;
	});
	afterEach(function() {
		Utils.options.debug = false;
	});
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
		it("alters the (history:) macro, adding its strings to the start", function() {
			runPassage("(mock-visits:'qux','qux','qux','grault')");
			expect('(history:)').markupToPrint('qux,qux,qux,grault,test');
		});
		it("alters the (visited:) macro", function() {
			createPassage('BEEP','grault');
			createPassage('BOOP','qux');
			runPassage("(mock-visits:'qux','qux','qux','grault')");
			expect('(print:(visited:"grault"))').markupToPrint('true');
			expect('(print:(visited:where its source is "BOOP"))').markupToPrint('true');
		});
	});
	describe("the (mock-turns:) macro", function() {
		beforeEach(function() {
			runPassage("");
			runPassage("");
			runPassage("");
		});
		it("takes a non-negative integer", function() {
			expect("(mock-turns:)").markupToError();
			expect("(mock-turns:'bar')").markupToError();
			expect("(mock-turns:0.1)").markupToError();
			expect("(mock-turns:1)").not.markupToError();
			expect("(mock-turns:0)").not.markupToError();
			expect("(mock-turns:2,2)").markupToError();
		});
		// Can't test that it only works in debug mode, unfortunately.
		it("alters the 'turns' keyword to mock additional turns", function() {
			runPassage("(mock-turns:15)");
			expect("(print:turns)").markupToPrint('20');
		});
		it("each successive (mock-turns:) call overrides the last", function(done) {
			expect("(mock-turns:15)(print:turns)").markupToPrint('19');
			expect(runPassage("(mock-turns:1)(print:turns)",'garply').find(":last-child").text()).toBe('6');
			Engine.goBack();
			setTimeout(function(){
				expect($('tw-passage > :last-child').text()).toBe('19');
				done();
			},80);
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
			expect(runPassage("(assert:45)").find('tw-error').text()).not.toContain("(assert:45)");
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
	describe("the (debug:) macro", function() {
		beforeEach(function() {
			$('tw-debugger').detach();
			Utils.options.debug = false;
		});
		afterAll(function() {
			if (location.search.indexOf("spec=") === -1) {
				Utils.options.debug = false;
			}
		});

		it("takes nothing", function() {
			expect("(debug:3)").markupToError();
			expect("(debug:)").not.markupToError();
		});
		it("produces a command that opens the debug mode panel", function() {
			expect($('tw-debugger').length).toBe(0);
			expect("(print:(Debug:) is a command)").markupToPrint('true');
			runPassage('(Debug:)');
			expect($('tw-debugger').length).toBe(1);
		});
		it("reopens the debug mode panel if debug mode is closed", function(done) {
			expect($('tw-debugger').length).toBe(0);
			runPassage('(Debug:)');
			expect($('tw-debugger').length).toBe(1);
			$('tw-debugger button.close').click();
			setTimeout(function(){
				expect($('tw-debugger').length).toBe(0);
				runPassage('(Debug:)');
				expect($('tw-debugger').length).toBe(1);
				done();
			},80);
		});
	});
});
