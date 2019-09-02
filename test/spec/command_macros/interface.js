describe("interface macros", function(){
	'use strict';
	describe("the (cycling-link:) macro", function(){
		it("accepts one optional bound variable, and two or more strings", function() {
			expect("(print:(cycling-link:))").markupToError();
			expect("(print:(cycling-link:''))").markupToError();
			expect("(print:(cycling-link:'baz'))").markupToError();
			expect("(print:(cycling-link:2))").markupToError();
			expect("(print:(cycling-link:false))").markupToError();
			expect("(print:(cycling-link:bind $foo))").markupToError();
			expect("(print:(cycling-link:'baz', 'baz'))").not.markupToError();
			expect("(print:(cycling-link:'baz', 'baz', 'qux'))").not.markupToError();
			expect("(print:(cycling-link:bind $foo, 'baz'))").markupToError();
			expect("(print:(cycling-link:bind $foo, 'baz', 'qux'))").not.markupToError();
		});
		it("when clicked, it cycles to the next string and remains clickable", function() {
			var p = runPassage("(cycling-link:'bar','baz','qux')");
			expect(p.find('tw-link').text()).toBe('bar');
			p.find('tw-link').click();
			expect(p.find('tw-link').text()).toBe('baz');
			p.find('tw-link').click();
			expect(p.find('tw-link').text()).toBe('qux');
			p.find('tw-link').click();
			expect(p.find('tw-link').text()).toBe('bar');
			p.find('tw-link').click();
			expect(p.find('tw-link').text()).toBe('baz');
			p.find('tw-link').click();
			expect(p.find('tw-link').text()).toBe('qux');
		});
		it("works with (transition:)", function() {
			runPassage("foo","foo");
			var p = runPassage("(t8n:'slideleft')(cycling-link:'bar','baz','qux')");
			expect(p.find('tw-link').text()).toBe('bar');
			p.find('tw-link').click();
			expect(p.find('tw-transition-container[data-t8n="slideleft"]').length).toBe(1);
		});
		it("works with string enchantment", function(done) {
			var p = runPassage("(cycling-link:'foobar','bazfoo','fooqux')(enchant:'foo',(background:white))");
			setTimeout(function() {
				expect(p.find('tw-link').text()).toBe('foobar');
				expect(p.find('tw-enchantment').text()).toBe('foo');
				expect(p.find('tw-enchantment')).toHaveBackgroundColour('#ffffff');
				p.find('tw-link').click();
				setTimeout(function() {
					expect(p.find('tw-enchantment')).toHaveBackgroundColour('#ffffff');
					expect(p.find('tw-enchantment').text()).toBe('foo');
					done();
				}, 20);
			}, 20);
		});
		it("works with string replacement", function(done) {
			var p = runPassage("(cycling-link:bind $bar,'foobar','bazfoo','fooqux')(replace:'foo')[qux]");
			setTimeout(function() {
				expect(p.find('tw-link').text()).toBe('quxbar');
				expect("$bar").markupToPrint('foobar');
				p = runPassage("(cycling-link:bind $bar,'foobar','bazfoo','fooqux')(replace:'foo')[qux]");
				p.find('tw-link').click();
				setTimeout(function() {
					expect(p.find('tw-link').text()).toBe('bazfoo');
					expect("$bar").markupToPrint('bazfoo');
					done();
				}, 20);
			}, 20);
		});
		it("executes each label every time it appears", function() {
			var p = runPassage("(set:$foo to 'bar')(cycling-link:'(print:$foo)','(set:$foo to \"baz\")qux')");
			expect(p.find('tw-link').text()).toBe('bar');
			p.find('tw-link').click();
			expect(p.find('tw-link').text()).toBe('qux');
			p.find('tw-link').click();
			expect(p.find('tw-link').text()).toBe('baz');
		});
		it("can't begin with an empty string", function() {
			expect("(cycling-link:'','baz')").markupToError();
		});
		it("upon reaching an empty string, the link disappears", function() {
			var p = runPassage("(cycling-link:'bar','baz','')");
			expect(p.find('tw-link').text()).toBe('bar');
			p.find('tw-link').click();
			expect(p.find('tw-link').text()).toBe('baz');
			p.find('tw-link').click();
			expect(p.find('tw-link').length).toBe(0);
		});
		it("will be replaced with markup error messages if they're encountered", function() {
			var p = runPassage("(cycling-link:'bar','(print: 2 + true)')");
			expect(p.find('tw-link').text()).toBe('bar');
			p.find('tw-link').click();
			expect(p.find('tw-error').length).toBe(1);
		});
		describe("when given a bound variable", function() {
			it("when clicked, sets the variable to the string label", function() {
				var p = runPassage("(cycling-link: bind $foo, 'bar','baz', 'qux')");
				expect("$foo").markupToPrint('bar');

				p = runPassage("(cycling-link: bind $foo, 'bar','baz', 'qux')");
				p.find('tw-link').click();
				expect("$foo").markupToPrint('baz');

				p = runPassage("(cycling-link: bind $foo, 'bar','baz', 'qux')");
				p.find('tw-link').click();
				p.find('tw-link').click();
				expect("$foo").markupToPrint('qux');
			});
			it("works with temp variables", function(done) {
				var p = runPassage("(cycling-link: bind _foo, 'bar', 'baz', 'qux')(event: when _foo is 'qux')[quux]");
				p.find('tw-link').click();
				p.find('tw-link').click();
				setTimeout(function(){
					expect(p.text()).toBe("quxquux");
					done();
				},20);
			});
			it("works when saved in another passage", function() {
				runPassage("(set:_bar to 'qux')(set:$foo to (cycling-link:'_bar','foo'))");
				expect('(set:_bar to "baz")$foo').markupToPrint("baz");
			});
			it("errors if the bind is invalid", function() {
				expect("(set:$foo to 1)(cycling-link: bind $foo's 1st, 'bar','baz', 'qux')").markupToError();
			});
			it("errors if the bind is no longer valid when it cycles", function() {
				var p = runPassage("(set:$foo to (a:))(cycling-link: bind $foo's 1st, 'bar','baz','qux')(set:$foo to 2)");
				p.find('tw-link').click();
				expect(p.find('tw-error').length).toBe(1);

				p = runPassage("(set:$foo to (dm:'garply',2))(cycling-link: bind $foo's 'garply', 'bar','baz','qux')(set:$foo to (a:))");
				p.find('tw-link').click();
				expect(p.find('tw-error').length).toBe(1);

				// The error message for this one, while existent, is extremely poor.
				p = runPassage("(set:$foo to (a:))(cycling-link: bind $foo's 1st, 'bar','baz','qux')(set:$foo to (dm:'garply',2))");
				p.find('tw-link').click();
				expect(p.find('tw-error').length).toBe(1);

				p = runPassage("(set:$foo to (a:(a:)))(cycling-link: bind $foo's 1st's 1st, 'bar','baz','qux')(set:$foo's 1st to (dm:'garply',2))");
				p.find('tw-link').click();
				expect(p.find('tw-error').length).toBe(1);
			});
		});
	});
	describe("the (dropdown:) macro", function() {
		it("accepts one bound variable, and two or more strings", function() {
			expect("(print:(dropdown:))").markupToError();
			expect("(print:(dropdown:''))").markupToError();
			expect("(print:(dropdown:'baz'))").markupToError();
			expect("(print:(dropdown:2))").markupToError();
			expect("(print:(dropdown:false))").markupToError();
			expect("(print:(dropdown:bind $foo))").markupToError();
			expect("(print:(dropdown:'baz', 'baz'))").markupToError();
			expect("(print:(dropdown:bind $foo, 'baz'))").markupToError();
			expect("(print:(dropdown:bind $foo, 'baz', 'qux'))").not.markupToError();
		});
		it("creates a <select> element with each string as an <option>", function() {
			var p = runPassage("(dropdown: bind $foo, 'bar','baz','qux')(event: when $foo is 'qux')[quux]");
			expect(p.find('select').length).toBe(1);
			expect(p.find('select option').length).toBe(3);
		});
		it("blank strings become horizontal separators", function() {
			var p = runPassage("(dropdown: bind $foo, 'bar','','qux')");
			expect(p.find('select option[disabled]').length).toBe(1);
			expect(p.find('select option[disabled]').text()).toBe('─'.repeat(3));
		});
		it("separators are as long as the longest label", function() {
			var p = runPassage("(dropdown: bind $foo, 'bar','','くりかえす')");
			expect(p.find('select option[disabled]').text()).toBe('─'.repeat(5));
		});
		it("when changed, sets the variable to the string label", function(done) {
			var p = runPassage("(dropdown: bind $foo, 'bar','baz', 'qux')");
			expect("$foo").markupToPrint('bar');

			p = runPassage("(dropdown: bind $foo, 'bar','baz', 'qux')");
			p.find('select').val('baz').change();
			setTimeout(function() {
				expect(p.text()).toBe('barbazqux');
				expect("$foo").markupToPrint('baz');

				p = runPassage("(dropdown: bind $foo, 'bar','baz', 'qux')");
				p.find('select').val('qux').change();
				setTimeout(function() {
					expect("$foo").markupToPrint('qux');
					done();
				});
			});
		});
		it("works with (link-replace:)", function(done) {
			var p = runPassage("(dropdown: bind $bar, '1', '2', '3')|baz>[$bar](link-repeat:'foo')[(replace: ?baz)[$bar]]");
			p.find('select').val('2').change();
			p.find('tw-link').click();
			setTimeout(function() {
				expect(p.text()).toBe("1232foo");
				done();
			},300);
		});
		it("isn't interfered with by string enchantment", function(done) {
			var p = runPassage("(dropdown:bind $bar,'foobar','bazfoo','fooqux')(enchant:'foo',(background:white))");
			setTimeout(function() {
				expect(p.find('select').val()).toBe('foobar');
				p.find('select').val('bazfoo').change();
				setTimeout(function() {
					expect(p.find('select').val()).toBe('bazfoo');
					done();
				}, 20);
			}, 20);
		});
		it("works with string replacement", function(done) {
			var p = runPassage("(dropdown:bind $bar,'foobar','bazfoo','fooqux')(replace:'foo')[qux]");
			setTimeout(function() {
				expect(p.find('select').val()).toBe('quxbar');
				// This differs from (cycling-link:)
				expect("$bar").markupToPrint('foobar');
				p = runPassage("(dropdown:bind $bar,'foobar','bazfoo','fooqux')(replace:'foo')[qux]");
				p.find('select').val('bazqux').change();
				setTimeout(function() {
					expect(p.find('select').val()).toBe('bazqux');
					expect("$bar").markupToPrint('bazqux');
					done();
				}, 20);
			}, 20);
		});
		it("errors if the first or last labels are empty", function() {
			expect("(dropdown: bind $foo, '','baz','qux')").markupToError();
			expect("(dropdown: bind $foo, 'foo','baz','')").markupToError();
			expect("(dropdown: bind $foo, '','baz','')").markupToError();
		});
		it("has the correct text colour", function(done) {
			var p = runPassage("(dropdown: bind $foo, 'bar','','くりかえす')");
			setTimeout(function() {
				expect(p.find('select').css('color')).toMatch(/(?:#FFF(?:FFF)?|rgb\(\s*255,\s*255,\s*255\s*\))/);
				p = runPassage("(enchant: ?passage, (background:'#0000FF')+(text-color:'#800000'))(dropdown: bind $foo, 'bar','','くりかえす')");
				setTimeout(function() {
					expect(p.find('select').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
					done();
				});
			});
		});
		it("has the correct background colour", function(done) {
			var p = runPassage("(enchant: ?passage, (background:'#0000FF')+(text-color:'#800000'))(dropdown: bind $foo, 'bar','','くりかえす')");
			setTimeout(function() {
				expect(p.find('select').css('background-color')).toMatch(/transparent|^\w+a\(.+?,\s*0\s*\)$/);
				done();
			});
		});
		it("has the correct font", function(done) {
			var p = runPassage("(enchant: ?passage, (font:'fantasy'))(dropdown: bind $foo, 'bar','','くりかえす')");
			setTimeout(function() {
				expect(p.find('select').css('font-family')).toBe('fantasy');
				done();
			});
		});
	});
});
