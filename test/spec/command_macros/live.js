describe("live macros", function() {
	'use strict';

	// TODO: Add (live:) macro tests
	describe("the (event:) macro", function() {
		it("requires a 'when' lambda", function() {
			expect("(event:)[]").markupToError();
			expect("(event:1)[]").markupToError();
			expect("(event: each _a,2)[]").markupToError();
			expect("(event:_a via true,2)[]").markupToError();
			expect("(event:_a with _b where _a is _b,2)[]").markupToError();
			expect("(event:_a making _b where true,2)[]").markupToError();
			expect("(event: when $a > 2)[]").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(event: when $a > 2)").markupToError();
		});
		it("doesn't immediately display the hook", function() {
			expect("(event:when $a is 2)[baz]").not.markupToPrint('baz');
		});
		it("displays the attached hook only when the lambda's condition becomes true", function(done) {
			var p = runPassage("(event: when $a is 2)[bar](link:'foo')[(set:$a to 2)]");
			expect(p.text()).toBe("foo");
			p.find('tw-link').click();
			setTimeout(function() {
				expect(p.text()).toBe("bar");
				done();
			},20);
		});
		xit("works with temp variables in the hook", function(done) {
			var p = runPassage("(link:'foo')[(set:$a to 2, _b to 'bar')](event: when $a is 2)[_b]");
			expect(p.text()).toBe("foo");
			p.find('tw-link').click();
			setTimeout(function() {
				expect(p.text()).toBe("bar");
				done();
			},20);
		});
		it("works with temp variables in the lambda", function(done) {
			var p = runPassage("(event: when _a is 2)[bar](link:'foo')[(set:_a to 2)]");
			expect(p.text()).toBe("foo");
			p.find('tw-link').click();
			setTimeout(function() {
				expect(p.text()).toBe("bar");
				done();
			},20);
		});
		it("currently can't attach to bare commands", function() {
			expect("(event: when $a is 2)(print:$a)(link:'foo')[(set:$a to 2)]").markupToError();
		});
		it("only renders the hook once", function(done) {
			var p = runPassage("(set:$b to 'qux')(event: when $a is 2)[(set:$a to 0)$b](link:'foo')[(set:$a to 2)(link:'bar')[(set:$b to 'baz')(set:$a to 2)quux]]");
			expect(p.text()).toBe("foo");
			p.find('tw-link').click();
			setTimeout(function() {
				p.find('tw-link').click();
				setTimeout(function() {
					expect(p.text()).toBe("quxquux");
					done();
				},20);
			},20);
		});
	});
});
