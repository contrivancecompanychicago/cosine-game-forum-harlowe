describe("enchantment macros", function () {
	'use strict';
	describe("(enchant:)", function() {
		it("accepts a changer command, followed by either a string or a hook reference", function() {
			expect("(print:(enchant:(font:'Skia'),?foo))").not.markupToError();
			expect("(print:(enchant:(font:'Skia'),'baz'))").not.markupToError();

			expect("(print:(enchant:?foo))").markupToError();
			expect("(print:(enchant:(font:'Skia')))").markupToError();
			expect("(print:(enchant:'baz'))").markupToError();
			expect("(print:(enchant:'baz',(font:'Skia')))").markupToError();
		});
	});
	describe("enchanting <tw-story>", function() {
		it("wraps the <tw-story> in a <tw-enchantment>", function(done) {
			runPassage("(enchant:(text-style:'bold'),'<tw-story>')");
			setTimeout(function() {
				var enchantment = $('tw-story').parent();
				expect(enchantment.is('tw-enchantment')).toBe(true);
				expect(enchantment.attr('style')).toMatch(/font-weight: \s*bold/);
				done();
			});
		});
		it("the <tw-enchantment> is removed when changing passages", function(done) {
			runPassage("(enchant:(text-style:'bold'),'<tw-story>')");
			setTimeout(function() {
				var enchantment = $('tw-story').parent();
				expect($('tw-story').parent().is('tw-enchantment')).toBe(true);
				expect(enchantment.attr('style')).toMatch(/font-weight: \s*bold/);

				runPassage("");
				setTimeout(function() {
					enchantment = $('tw-story').parent();
					expect(enchantment.is('tw-enchantment')).toBe(false);
					done();
				});
			});
		});
	});
	describe("enchanting <tw-passage>", function() {
		it("wraps the current <tw-passage> in a <tw-enchantment>", function() {
			runPassage("(enchant:(background:'#000'),'<tw-passage>')");
			var enchantment = $('tw-passage').parent();
			expect(enchantment.is('tw-enchantment')).toBe(true);
		});
	});
});
