describe("enchantment macros", function () {
	'use strict';
	describe("(enchant:)", function() {
		it("accepts either a string or a hook reference, followed by a changer command or a 'via' lambda", function() {
			expect("(print:(enchant:?foo, (font:'Skia')))").not.markupToError();
			expect("(print:(enchant:'baz', (font:'Skia')))").not.markupToError();
			expect("(print:(enchant:?foo, via (font:'Skia')))").not.markupToError();
			expect("(print:(enchant:'baz', via (font:'Skia')))").not.markupToError();

			expect("(print:(enchant:?foo))").markupToError();
			expect("(print:(enchant:(font:'Skia')))").markupToError();
			expect("(print:(enchant:'baz'))").markupToError();
			expect("(print:(enchant:(font:'Skia'), 'baz'))").markupToError();
			expect("(print:(enchant:(font:'Skia'), where (font:'Skia')))").markupToError();
		});
		it("errors when the changer contains a revision command", function() {
			expect("[]<foo|(enchant:?foo,(append:?baz))").markupToError();
		});
		it("errors when the 'via' lambda returns a non-changer or a revision command", function() {
			expect("[]<foo|(enchant:?foo, via 2)").markupToError();
			expect("[]<foo|(enchant:?foo, via (append:?baz))").markupToError();
		});
		//TODO: write more basic functionality tests comparable to (click:)'s
	});
	describe("enchanting ?Link", function() {
		it("wraps each <tw-link> in a <tw-enchantment>", function(done) {
			createPassage("","bar");
			runPassage("(enchant:?Link,(text-style:'italic'))[[Next->bar]]");
			setTimeout(function() {
				var enchantment = $('tw-link').parent();
				expect(enchantment.is('tw-enchantment')).toBe(true);
				expect(enchantment.attr('style')).toMatch(/font-style: \s*italic/);
				done();
			});
		});
		it("can override properties that <tw-link> inherits from CSS", function(done) {
			createPassage("","bar");
			runPassage("(enchant:?Link,(text-style:'mirror')+(color:'#800000'))[[Next->bar]]");
			setTimeout(function() {
				expect($('tw-link').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				done();
			},400);
		});
		it("enchants (link:) links", function(done) {
			var p = runPassage("(enchant:?Link,(text-style:'italic')+(color:'#800000'))(link:'foo')[bar]");
			setTimeout(function() {
				var enchantment = p.find('tw-link').parent();
				expect(enchantment.css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				expect(enchantment.css('font-style')).toMatch(/italic/);
				p.find('tw-link').click();
				expect(p.text()).toBe('bar');
				done();
			},400);
		});
		it("works in 'header' tagged passages", function(done) {
			createPassage("(enchant: ?Link, (text-style:'italic')+(color:'#800000'))","","header");
			var p = runPassage("(link:'foo')[bar]");
			setTimeout(function() {
				var enchantment = p.find('tw-link').parent();
				expect(enchantment.css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				expect(enchantment.css('font-style')).toMatch(/italic/);
				p.find('tw-link').click();
				expect(p.text()).toBe('bar');
				done();
			},400);
		});
		it("works with (link-reveal:) links", function(done) {
			var p = runPassage("(enchant: ?link, (text-colour: '#800000'))(link-reveal: \"foo\")[bar]");
			setTimeout(function() {
				var enchantment = p.find('tw-link').parent();
				expect(enchantment.css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				p.find('tw-link').click();
				expect(p.text()).toBe('foobar');
				done();
			},400);
		});
	});
	describe("enchanting ?Page", function() {
		it("wraps the ?Page in a <tw-enchantment>", function(done) {
			runPassage("(enchant:?Page,(text-style:'bold'))");
			setTimeout(function() {
				var enchantment = $('tw-story').parent();
				expect(enchantment.is('tw-enchantment')).toBe(true);
				expect(enchantment.attr('style')).toMatch(/font-weight: \s*bold/);
				done();
			});
		});
		it("the <tw-enchantment> is removed when changing passages", function(done) {
			runPassage("(enchant:?Page,(text-style:'bold'))");
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
		it("can override properties that <tw-story> inherits from CSS", function(done) {
			runPassage("(enchant:?Page,(color:'#800000')+(background:white))");
			setTimeout(function() {
				expect($('tw-story').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				expect($('tw-story').css('background-color')).toMatch(/(?:#ffffff|rgb\(\s*255,\s*255,\s*255\s*\))/);
				done();
			});
		});
		it("can't override links' colours", function(done) {
			runPassage("(enchant:?Page,(color:'#800000')+(background:white))");
			setTimeout(function() {
				expect($('tw-story').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				done();
			});
		});
		it("restores the overridden properties when changing passages", function(done) {
			runPassage("(enchant:?Page,(color:'#800000'))");
			setTimeout(function() {
				expect($('tw-story').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				
				runPassage("");
				setTimeout(function() {
					expect($('tw-story').css('color')).toMatch(/(?:#FFF(?:FFF)?|rgb\(\s*255,\s*255,\s*255\s*\))/);
					done();
				});
			});
		});
	});
	describe("enchanting ?Passage", function() {
		it("wraps the current ?Passage in a <tw-enchantment>", function() {
			runPassage("(enchant:?Passage,(background:'#000'))");
			var enchantment = $('tw-passage').parent();
			expect(enchantment.is('tw-enchantment')).toBe(true);
		});
	});
});
