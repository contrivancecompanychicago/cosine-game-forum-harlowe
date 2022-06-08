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
				expect("[A]<foo|("+name+":?foo,(append:?baz))").markupToError();
			});
			it("errors when the 'via' lambda returns a non-changer or a revision command", function() {
				expect("[A]<foo|("+name+":?foo, via 2)").markupToError();
				expect("[A]<foo|("+name+":?foo, via (append:?baz))").markupToError();
			});
			it("doesn't error when given (link:) changers", function() {
				expect("[A]<foo|("+name+":?foo, (link:'bar'))").not.markupToError();
			});
			it("doesn't error when given (click:) changers", function() {
				expect("[A]<foo|("+name+":?foo, (click:'bar'))").not.markupToError();
			});
			it("doesn't affect empty hooks", function() {
				var p = runPassage("("+name+":?foo, (link:'bar'))[]<foo|",'garply');
				expect(p.find('tw-enchantment').length).toBe(0);
			});
			if (name === "change") {
				it("doesn't affect transitioning-out passages", function() {
					createPassage("("+name+":?foo, (click:'bar'))",'garply');
					var p = runPassage('[A]<foo| (t8n-depart:"dissolve")[[garply]]');
					p.find('tw-link').click();
					expect($('tw-enchantment').length).toBe(0);
				});
				it("only changes hooks earlier than it", function() {
					var p = runPassage("[A]<foo|(change:?foo,(color:'#800000'))[A]<foo|");
					expect(p.find('tw-hook:first-child').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				});
			} else {
				it("enchants hooks everywhere", function() {
					var p = runPassage("[A]<foo|(enchant:?foo,(color:'#800000'))[A]<foo|");
					expect(p.find('tw-hook:first-child').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
					expect(p.find('tw-hook:last-child').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				});
				it("changes hooks when they're added to the passage", function() {
					var p = runPassage("[A]<foo|(enchant:?foo,(color:'#800000'))(link:'X')[ [A]<foo|]");
					expect(p.find('tw-hook:first-child').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
					p.find('tw-link').click();
					expect(p.find(':last-child > tw-hook').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				});
			}
			it("if given a lambda, uses it to produce a changer for each target", function() {
				var p = runPassage("[baz]<foo|[baz]<bar|("+name+":?foo+?bar, via (size: pos*2))");
				expect(p.find('tw-enchantment:first-of-type').attr('style')).toMatch(/size:\s*48px/);
				expect(p.find('tw-enchantment:last-of-type').attr('style')).toMatch(/size:\s*96px/);
			});
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
			var p = runPassage("(enchant-in:?foo,(color:'#800000'))[|foo>[A](link:'X')[ [A]<foo|]]");
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
				// ?Page enchantments affecting the background cause <tw-story> to gain a transparent background.
				expect($('tw-story').css('background-color')).toMatch(/(?:transparent|rgba?\(\s*0,\s*0,\s*0,\s*0\))/);
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
	describe("(link-style:)", function() {
		it("accepts a changer command or a 'via' lambda", function() {
			expect("(print:(link-style:(font:'Skia')))").not.markupToError();
			expect("(print:(link-style:via (font:'Skia')))").not.markupToError();
			expect("(print:(link-style:?foo))").markupToError();
			expect("(print:(link-style:(font:'Skia'), 'baz'))").markupToError();
			expect("(print:(link-style: where (font:'Skia')))").markupToError();
		});
		it("enchants all of the links in a hook", function() {
			createPassage("qux","qux");
			runPassage('(link-style: (color:#800000))[ [[qux<-bar]] (link:"qux")[ [[qux<-bar]] ] ]');
			expect($($('tw-link')[0]).css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
			expect($($('tw-link')[1]).css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
			$($('tw-link')[1]).click();
			expect($($('tw-link')[1]).css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
		it("enchants the hook itself if it's a link", function() {
			createPassage("qux","qux");
			runPassage('(link-style: (color:#800000))[[qux<-bar]]');
			expect($('tw-link').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
		it("doesn't create <tw-pseudo-hook>s", function() {
			expect(runPassage('(link-style: (color:#800000))[[qux<-bar]]').find('tw-pseudo-hook').length).toBe(0);
		});
		it("works with (enchant:)", function() {
			runPassage('(enchant:?passage,(link-style: (color:#800000)))[[test<-bar]]');
			expect($('tw-link').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
		it("does not work with (enchant:) when used in a lambda", function() {
			runPassage('(enchant:?passage, via (link-style: (color:#800000)))[[test<-bar]]');
			expect($('tw-link').css('color')).not.toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
	});
	describe("(line-style:)", function() {
		it("accepts a changer command or a 'via' lambda", function() {
			expect("(print:(line-style:(font:'Skia')))").not.markupToError();
			expect("(print:(line-style:via (font:'Skia')))").not.markupToError();
			expect("(print:(line-style:?foo))").markupToError();
			expect("(print:(line-style:(font:'Skia'), 'baz'))").markupToError();
			expect("(print:(line-style: where (font:'Skia')))").markupToError();
		});
		it("enchants all of the lines in a hook", function() {
			var p = runPassage('(line-style:(text-colour:#333))[foo\n[|a>[bar]]quux\nbaz(link:"qux")[garply\ncorge]]');
			var a = p.find('tw-enchantment');
			expect($(a[0])).toHaveColour("#333333");
			expect($(a[1])).toHaveColour("#333333");
			expect($(a[2])).toHaveColour("#333333");
			// Extra check for the link
			a.find('tw-link').click();
			expect($(p.find('tw-enchantment')[3]).text()).toBe('garply');
			expect($(p.find('tw-enchantment')[3])).toHaveColour("#333333");
			expect($(p.find('tw-enchantment')[4]).text()).toBe('corge');
		});
		it("works with only one line", function(done) {
			var a = runPassage('(line-style:(text-style:"shadow"))[=I just want to say hello to you');
			setTimeout(function(){
				expect(a.find('tw-enchantment').attr('style')).toMatch(/text-shadow/);
				done();
			},20);
		});
		it("works with half a line", function(done) {
			var a = runPassage('I just want (line-style:(text-style:"shadow"))[=to say hello to you');
			setTimeout(function(){
				expect(a.find('tw-enchantment').attr('style')).toMatch(/text-shadow/);
				expect(a.find('tw-enchantment').text()).toBe('to say hello to you');
				done();
			},20);
		});
		it("works with (hover-style:)", function(done) {
			var a = runPassage('(line-style:(hover-style:(background:white)))[foo\nbar\nbaz]').find('tw-hook tw-enchantment');
			a.mouseenter();
			setTimeout(function() {
				expect(a).toHaveBackgroundColour("#ffffff");
				done();
			},20);
		});
		it("doesn't create <tw-pseudo-hook>s", function() {
			expect(runPassage('(line-style: (text-colour:#333))[=foo\nbar\n').find('tw-pseudo-hook').length).toBe(0);
		});
		it("works with (enchant:)", function() {
			runPassage('(enchant:?passage,(line-style: (color:#800000)))\ngooball');
			expect($('tw-passage tw-enchantment').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
		it("does not work with (enchant:) when used in a lambda", function() {
			runPassage('(enchant:?passage, via (line-style: (color:#800000)))\ngooball');
			expect($('tw-passage tw-enchantment').css('color')).not.toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
	});
	describe("(char-style:)", function() {
		it("accepts a changer command or a 'via' lambda", function() {
			expect("(print:(char-style:(font:'Skia')))").not.markupToError();
			expect("(print:(char-style:via (font:'Skia')))").not.markupToError();
			expect("(print:(char-style:?foo))").markupToError();
			expect("(print:(char-style:(font:'Skia'), 'baz'))").markupToError();
			expect("(print:(char-style: where (font:'Skia')))").markupToError();
		});
		it("selects all of the non-whitespace chars in a hook", function() {
			var p = runPassage('(char-style:(text-style:"outline"))[foo[𐌎ar]<b| baz]');
			expect(p.find('tw-enchantment').length).toBe(9);
			expect($(p.find('tw-enchantment').get(3)).text()).toBe('𐌎');
		});
		it("works with (hover-style:)", function(done) {
			var a = runPassage('(char-style:(hover-style:(background:white)))[foobarbaz]').find('tw-hook tw-enchantment:nth-child(4)');
			expect(a.text()).toBe('b');
			a.mouseenter();
			setTimeout(function() {
				expect(a).toHaveBackgroundColour("#ffffff");
				done();
			},20);
		});
		it("works with bidi text", function() {
			// The ! should appear to the left in the rendered passage.
			expect('(char-style:(background:green))["ٱٹ!‏"]').markupToPrint('"ٱٹ!‏"');
		});
		it("'pos' equals the number of the char in the passage", function() {
			var p = runPassage('(char-style:via (bg:(hsl:pos*8,0.5,0.5)))[ABCD]');
			expect(p.find('tw-enchantment:first-child')).toHaveBackgroundColour('#bf503f');
			expect(p.find('tw-enchantment:last-child')).toHaveBackgroundColour('#bf833f');
		});
		it("'pos' is unique for each hook", function() {
			var p = runPassage('(char-style:via (bg:(hsl:pos*8,0.5,0.5)))[ABCD] (char-style:via (bg:(hsl:pos*8,0.5,0.5)))[ABCD]');
			expect(p.find('tw-hook:first-of-type tw-enchantment:first-child')).toHaveBackgroundColour('#bf503f');
			expect(p.find('tw-hook:first-of-type tw-enchantment:last-child')).toHaveBackgroundColour('#bf833f');
			expect(p.find('tw-hook:last-of-type tw-enchantment:first-child')).toHaveBackgroundColour('#bf503f');
			expect(p.find('tw-hook:last-of-type tw-enchantment:last-child')).toHaveBackgroundColour('#bf833f');
		});
		it("doesn't create <tw-pseudo-hook>s", function() {
			expect(runPassage('(char-style:(background:green))[=foo\n[bar]<a|\n').find('tw-pseudo-hook').length).toBe(0);
		});
		it("works with (enchant:)", function() {
			runPassage('(enchant:?passage,(char-style: (color:#800000)))\ng');
			expect($('tw-passage tw-enchantment').css('color')).toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
		it("does not work with (enchant:) when used in a lambda", function() {
			runPassage('(enchant:?passage, via (char-style: (color:#800000)))\ng');
			expect($('tw-passage tw-enchantment').css('color')).not.toMatch(/(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
		});
	});
});
