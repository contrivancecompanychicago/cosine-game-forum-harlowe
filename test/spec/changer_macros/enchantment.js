describe("enchantment macros", function () {
	'use strict';
	["enchant","change"].forEach(function(name) {
		describe("("+name+":)", function() {
			it("accepts either a string or a hook reference, followed by a changer command or a 'via' lambda", function() {
				expect("(print:("+name+":?foo, (font:'Skia')))").not.markupToError();
				expect("(print:("+name+":'baz', (font:'Skia')))").not.markupToError();
				expect("(print:("+name+":?foo, via (font:'Skia')))").not.markupToError();
				expect("(print:("+name+":'baz', via (font:'Skia')))").not.markupToError();

				expect("(print:("+name+":?foo))").markupToError();
				expect("(print:("+name+":(font:'Skia')))").markupToError();
				expect("(print:("+name+":'baz'))").markupToError();
				expect("(print:("+name+":(font:'Skia'), 'baz'))").markupToError();
				expect("(print:("+name+":(font:'Skia'), where (font:'Skia')))").markupToError();
			});
			it("errors when the changer contains a revision command", function() {
				expect("[]<foo|("+name+":?foo,(append:?baz))").markupToError();
			});
			it("errors when the 'via' lambda returns a non-changer or a revision command", function() {
				expect("[]<foo|("+name+":?foo, via 2)").markupToError();
				expect("[]<foo|("+name+":?foo, via (append:?baz))").markupToError();
			});
			it("doesn't error when given (link:) changers", function() {
				expect("[]<foo|("+name+":?foo, (link:'bar'))").not.markupToError();
			});
			it("doesn't error when given (click:) changers", function() {
				expect("[]<foo|("+name+":?foo, (click:'bar'))").not.markupToError();
			});
			if (name === "change") {
				it("only changes hooks earlier than it", function() {
					var p = runPassage("[]<foo|(change:?foo,(color:'#800000'))[]<foo|");
					expect(p.find('tw-hook:first-child').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				});
			} else {
				it("enchants hooks everywhere", function() {
					var p = runPassage("[]<foo|(enchant:?foo,(color:'#800000'))[]<foo|");
					expect(p.find('tw-hook:first-child').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
					expect(p.find('tw-hook:last-child').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				});
				it("changes hooks when they're added to the passage", function() {
					var p = runPassage("[]<foo|(enchant:?foo,(color:'#800000'))(link:'X')[ []<foo|]");
					expect(p.find('tw-hook:first-child').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
					p.find('tw-link').click();
					expect(p.find(':last-child > tw-hook').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				});
			}
			//TODO: write more basic functionality tests comparable to (click:)'s
		});
	});
	describe("(enchant-in:)", function() {
		it("accepts either a string or a hook reference, followed by a changer command or a 'via' lambda", function() {
			expect("(print:(enchant-in:?foo, (font:'Skia')))").not.markupToError();
			expect("(print:(enchant-in:'baz', (font:'Skia')))").not.markupToError();
			expect("(print:(enchant-in:?foo, via (font:'Skia')))").not.markupToError();
			expect("(print:(enchant-in:'baz', via (font:'Skia')))").not.markupToError();

			expect("(print:(enchant-in:?foo))").markupToError();
			expect("(print:(enchant-in:(font:'Skia')))").markupToError();
			expect("(print:(enchant-in:'baz'))").markupToError();
			expect("(print:(enchant-in:(font:'Skia'), 'baz'))").markupToError();
			expect("(print:(enchant-in:(font:'Skia'), where (font:'Skia')))").markupToError();
		});
		it("errors when the changer contains a revision command", function() {
			expect("(enchant-in:?page's chars,(append:?baz))[A]").markupToError();
		});
		it("errors when the 'via' lambda returns a non-changer or a revision command", function() {
			expect("(enchant-in:?page's chars, via 2)[A]").markupToError();
			expect("(enchant-in:?page's chars, via (append:?baz))[A]").markupToError();
		});
		it("doesn't error when given (link:) changers", function() {
			expect("(enchant-in:?page's chars, (link:'bar'))[]").not.markupToError();
		});
		it("enchants hooks only inside the attached hook", function() {
			var p = runPassage("(enchant-in:?foo,(color:'#800000'))[[A]<foo|[B]<foo|][C]<foo|");
			expect($(p.find('tw-hook[name="foo"]').get(0)).css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
			expect($(p.find('tw-hook[name="foo"]').get(1)).css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
			expect($(p.find('tw-hook[name="foo"]').get(2)).css('color')).not.toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
		it("works with data names of hooks outside the attached hook", function() {
			expect(runPassage("(enchant-in:?page's chars, (text-style:'bold'))[BE]").find('tw-enchantment').length).toBe(2);
		});
		it("changes hooks when they're added to the attached hook", function() {
			var p = runPassage("(enchant-in:?foo,(color:'#800000'))[|foo>[](link:'X')[ []<foo|]]");
			expect($(p.find('tw-hook[name="foo"]').get(0)).css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
			p.find('tw-link').click();
			expect($(p.find('tw-hook[name="foo"]').get(1)).css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
		it("continues working after the attached hook is rerun with (rerun:)", function() {
			expect(runPassage("(enchant-in:?foo,(color:'#800000'))|B>[[A]<foo|](rerun:?B)").find('tw-hook[name="foo"]').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
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
	describe("enchanting ?link's visited", function() {
		it("wraps each <tw-link> that leads to a visited passage in a <tw-enchantment>", function(done) {
			createPassage("","qux");
			runPassage("","bar");
			runPassage("(enchant:?link's visited,(text-style:'italic'))[[Next->bar]] [[Prev->qux]]");
			setTimeout(function() {
				var enchantment = $($('tw-link')[0]).parent();
				expect(enchantment.is('tw-enchantment')).toBe(true);
				expect(enchantment.attr('style')).toMatch(/font-style: \s*italic/);

				enchantment = $($('tw-link')[1]).parent();
				expect(enchantment.is('tw-enchantment')).toBe(false);
				done();
			});
		});
		it("can override properties that <tw-link> inherits from CSS", function(done) {
			runPassage("","bar");
			runPassage("(enchant:?link's visited,(text-style:'mirror')+(color:'#800000'))[[Next->bar]]");
			setTimeout(function() {
				expect($('tw-link').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				done();
			},400);
		});
		it("works with (link-reveal-goto:)", function(done) {
			runPassage("","bar");
			runPassage("(enchant:?link's visited,(text-style:'italic'))(link-reveal-goto:'Next','bar')[]");
			setTimeout(function() {
				var enchantment = $($('tw-link')[0]).parent();
				expect(enchantment.is('tw-enchantment')).toBe(true);
				expect(enchantment.attr('style')).toMatch(/font-style: \s*italic/);
				done();
			});
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
