describe("live macros", function() {
	'use strict';

	// TODO: Add (live:) macro tests
	describe("the (event:) macro", function() {
		it("requires a 'when' lambda", function() {
			expect("(event:)[]").markupToError();
			expect("(event:1)[]").markupToError();
			expect("(event: each _a,2)[]").markupToError();
			expect("(event:_a via true,2)[]").markupToError();
			expect("(event:_a making _b where true,2)[]").markupToError();
			expect("(event: when $a > 2)[]").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(event: when $a > 2)").markupToError();
		});
		it("doesn't immediately display the hook", function(done) {
			var p = runPassage("(event:when $a is 2)[baz]");
			setTimeout(function() {
				expect(p.text()).not.toBe('baz');
				done();
			},20);
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
		it("works with temp variables in the hook", function(done) {
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
		it("works with style changers", function(done) {
			var p = runPassage("(text-color:'#fadaba')+(event: when $a is 2)[Wow](link:'foo')[(set:$a to 2)]");
			expect(p.text()).toBe("foo");
			p.find('tw-link').click();
			setTimeout(function() {
				expect(p.find('tw-hook')).toHaveColour('#fadaba');
				done();
			},20);
		});
		it("works with (transition:)", function(done) {
			var p = runPassage("(t8n:'pulse')+(t8n-time:12s)+(event: when $a is 2)[Wow](link:'foo')[(set:$a to 2)]");
			expect(p.text()).toBe("foo");
			p.find('tw-link').click();
			setTimeout(function() {
				expect($('tw-story .transition-in[data-t8n="pulse"]').length).toBe(1);
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
	describe("the (after:) macro", function() {
		it("requires a positive number, and an optional non-negative number", function() {
			expect("(after:)[]").markupToError();
			expect("(after:1)[]").not.markupToError();
			expect("(after:1,1)[]").not.markupToError();
			expect("(after:0)[]").markupToError();
			expect("(after:1,-0.1)[]").markupToError();
		});
		it("doesn't immediately display the hook", function(done) {
			var p = runPassage("(after: 12s)[baz]");
			setTimeout(function() {
				expect(p.text()).not.toBe('baz');
				done();
			},20);
		});
		it("displays the attached hook only when the given time has elapsed", function(done) {
			var p = runPassage("(after:30ms)[bar]");
			expect(p.text()).toBe("");
			setTimeout(function() {
				expect(p.text()).toBe("bar");
				done();
			},
			// Because Firefox randomly permutes setTimeout's timeout to avoid fingerprinting, the time has to be this generous.
			80);
		});
	});
	describe("the (after-error:) macro", function() {
		it("takes no values", function() {
			expect("(after-error:)[]").not.markupToError();
			expect("(after-error:1)[]").markupToError();
			expect("(after-error:1,1)[]").markupToError();
		});
		it("doesn't immediately display the hook", function(done) {
			var p = runPassage("(after-error:)[baz]");
			setTimeout(function() {
				expect(p.text()).not.toBe('baz');
				done();
			},20);
		});
		it("displays the attached hook only when an error occurs elsewhere", function(done) {
			var p = runPassage("(after-error:)[bar](link:'Yo')[(primt:2)]");
			p.find('tw-link').click();
			setTimeout(function() {
				expect(p.find('tw-hook:first-of-type').text()).toBe("bar");
				done();
			},
			// Because Firefox randomly permutes setTimeout's timeout to avoid fingerprinting, the time has to be this generous.
			80);
		});
	});
	describe("the (more:) macro", function() {
		it("takes no arguments", function() {
			expect("(more:)[]").not.markupToError();
			expect("(more:when visits is 2)[]").markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(more:)").markupToError();
		});
		[['link','(link-reveal:"foo")','tw-link','click'],
		['(link-show:)','(link-show:"foo",?bar)','tw-link','click'],
		['passage link', '(link-reveal:"f")[(replace:?a)[oo]][[[oo->test]]]<a|','tw-link','click'],
		['click enchantment','foo(click:"foo")','tw-enchantment','click'],
		['mouseover enchantment','foo(mouseover:"foo")', 'tw-enchantment', 'mouseover']].forEach(function(e) {
			var name = e[0], code = e[1], el = e[2], event = e[3];
			it("doesn't immediately display the hook if " + name + "s are in the passage", function(done) {
				var p = runPassage(code+"[](more:)[bar]");
				setTimeout(function() {
					expect(p.text()).toBe("foo");
					done();
				},20);
			});
			it("displays the hook once all " + name + "s are gone", function(done) {
				var p = runPassage(code+"[](more:)[bar]");
				expect(p.text()).toBe("foo");
				p.find(el).first()[event]();
				setTimeout(function() {
					expect(p.text()).toBe("foobar");
					done();
				},20);
			});
		});
		it("multiple (more:) hooks will appear in order and may block one another", function(done) {
			var p = runPassage("(link:'foo')[](more:)[qux](more:)[(link:'bar')[]]");
			p.find('tw-link').click();
			setTimeout(function() {
				expect(p.text()).toBe("quxbar");
				
				p = runPassage("(link:'foo')[](more:)[(link:'bar')[]](more:)[qux]");
				p.find('tw-link').click();
				setTimeout(function() {
					expect(p.text()).toBe("bar");
					done();
				},20);
			},20);
		});
	});
});
