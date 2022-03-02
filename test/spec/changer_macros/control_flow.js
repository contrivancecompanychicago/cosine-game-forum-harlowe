describe("control flow macros", function() {
	'use strict';
	describe("the (if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expect("(if:)[]").markupToError();
			expect("(if:true)[]").not.markupToError();
			expect("(if:'1')[]").markupToError();
		});
		it("returns a command that shows/hides the attached hook based on the provided boolean", function() {
			expect("(if:false)[Gosh]").markupToPrint('');
			expect("(if:true)[Gosh]").markupToPrint('Gosh');
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(if:true)").markupToError();
		});
		it("can be composed with itself", function() {
			expect("(set: $a to (if: true) + (if:true))$a[Gee]").markupToPrint("Gee");
			expect("(set: $a to (if: false) + (if:true))$a[Gee]").markupToPrint("");
		});
		it("has structural equality", function() {
			expect("(print: (if: true) is (if:true))").markupToPrint("true");
			expect("(print: (if: true) is not (if:false))").markupToPrint("true");
		});
		it("can be composed with other style macros", function() {
			expect("(set: $a to (if: true) + (text-style:'bold'))$a[Gee]").markupToPrint("Gee");
			expect("(set: $a to (if: false) + (text-style:'bold'))$a[Gee]").markupToPrint("");
		});
		it("won't keep styling visible if it disables the hook", function() {
			var dominantTextColour = $('tw-story').css('color');
			var p = runPassage("(set: $a to (if: true) + (css:'border:2px solid red'))$a[Gee]").find('tw-hook');
			expect(p.css('border-top-color')).toMatch(/#FF0000|rgb\(\s*255,\s*0,\s*0\s*\)/);
			p = runPassage("(set: $a to (if: false) + (css:'border:2px solid red'))$a[Gee]").find('tw-hook');
			expect(p.css('border-top-color')).toBe(dominantTextColour);
		});
	});
	describe("the (unless:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expect("(unless:)[]").markupToError();
			expect("(unless:true)[]").not.markupToError();
			expect("(unless:'1')[]").markupToError();
		});
		it("behaves as the inverse of (if:)", function() {
			expect("(unless:false)[Gosh]").markupToPrint('Gosh');
			expect("(unless:true)[Gosh]").markupToPrint('');
		});
		it("can be composed with itself", function() {
			expect("(set: $a to (unless: false) + (unless:false))$a[Gee]").markupToPrint("Gee");
			expect("(set: $a to (unless: true) + (unless:false))$a[Gee]").markupToPrint("");
		});
		it("has structural equality", function() {
			expect("(print: (unless: true) is (unless:true))").markupToPrint("true");
			expect("(print: (unless: true) is not (unless:false))").markupToPrint("true");
		});
		it("can be composed with other style macros", function() {
			expect("(set: $a to (unless: false) + (text-style:'bold'))$a[Gee]").markupToPrint("Gee");
			expect("(set: $a to (unless: true) + (text-style:'bold'))$a[Gee]").markupToPrint("");
		});
	});
	describe("the (else-if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expect("(else-if:)[]").markupToError();
			expect("(else-if:'1')[]").markupToError();
		});
		it("must occur after a conditionally displayed hook", function() {
			expect("(else-if:false)[]").markupToError();
			expect("(either:true)[](else-if:true)[]").not.markupToError();
			expect("(either:false)[](else-if:true)[]").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(if:true)[](else-if:true)").markupToError();
		});
		it("hides the hook if the preceding hook was displayed, otherwise acts like (if:)", function() {
			expect("(either:false)[Wow](else-if:true)[Gee]").markupToPrint('Gee');
			expect("(either:false)[Wow](else-if:false)[Gee]").markupToPrint('');
			expect("(either:true)[Wow](else-if:true)[Gee]").markupToPrint('Wow');
			expect("(if:false)[Wow](else-if:true)[Gee]").markupToPrint('Gee');
			expect("(if:false)[Wow](else-if:false)[Gee]").markupToPrint('');
			expect("(if:true)[Wow](else-if:true)[Gee]").markupToPrint('Wow');
		});
		it("works even when nested", function() {
			expect("(either:true)[(either:false)[Wow](else-if:true)[Gee]](else-if:true)[Gosh]").markupToPrint('Gee');
			expect("(either:true)[(either:true)[Wow](else-if:true)[Gee]](else-if:true)[Gosh]").markupToPrint('Wow');
		});
	});
	describe("the (else:) macro", function() {
		it("accepts exactly 0 arguments", function() {
			expect("(if:false)[](else:true)[]").markupToError();
			expect("(if:false)[](else:'1')[]").markupToError();
		});
		it("must occur after a conditionally displayed hook", function() {
			expect("(else:)[]").markupToError();
			expect("(either:true)[](else:)[]").not.markupToError();
			expect("(either:false)[](else:)[]").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(if:true)[](else:)").markupToError();
		});
		it("hides the hook if the preceding hook was displayed, otherwise shows it", function() {
			expect("(either:false)[Wow](else:)[Gee]").markupToPrint('Gee');
			expect("(either:true)[Wow](else:)[Gee]").markupToPrint('Wow');
			expect("(if:false)[Wow](else:)[Gee]").markupToPrint('Gee');
			expect("(if:true)[Wow](else:)[Gee]").markupToPrint('Wow');
			expect("(if:false)[Wow](else-if:true)[Gee](else:)[Aww]").markupToPrint('Gee');
			expect("(if:false)[Wow](else-if:false)[Gee](else:)[Aww]").markupToPrint('Aww');
			expect("(if:true)[Wow](else-if:true)[Gee](else:)[Aww]").markupToPrint('Wow');
		});
		it("works even when nested", function() {
			expect("(either:true)[(either:false)[Wow](else:)[Gee]](else:)[Gosh]").markupToPrint('Gee');
			expect("(either:true)[(either:true)[Wow](else:)[Gee]](else:)[Gosh]").markupToPrint('Wow');
		});
	});
	describe("the (hidden:) macro", function() {
		it("takes no arguments", function() {
			expect('(hidden:1)').markupToError();
			expect('(hidden:"Red")').markupToError();
			expect('(hidden:?1)[]<1|').markupToError();
		});
		it("hides hooks it is attached to", function() {
			expect('(hidden:)|3>[Red]White').markupToPrint('White');
			expect('(set: $a to (hidden:))$a[Red]White').markupToPrint('White');
		});
		it("can be composed with other style macros", function() {
			expect("(set: $a to (hidden:) + (text-style:'bold'))$a[Gee]").markupToPrint("");
		});
		it("can be composed with (hook:)", function() {
			expect("(set: $a to (hidden:) + (hook:'foo'))$a[Bar](show:?foo)").markupToPrint("Bar");
		});
	});
	describe("the (show:) macro", function() {
		it("accepts 1 or more hooknames", function() {
			expect("(print:(show:))").markupToError();
			expect("(print:(show:2))").markupToError();
			expect("(print:(show:''))").markupToError();
			expect("(print:(show:'s'))").markupToError();
			expect("(print:(show:true))").markupToError();
			expect("(print:(show:?foo))").not.markupToError();
			expect("(print:(show:?foo, ?bar, ?baz, ?qux))").not.markupToError();
		});
		it("reveals hidden named hooks", function() {
			expect('|3)[Red](show:?3)').markupToPrint('Red');
			var p = runPassage('|3)[Red](link:"A")[(show:?3)]');
			expect(p.text()).toBe('A');
			p.find('tw-link').click();
			expect(p.text()).toBe('Red');
		});
		[
			['(hidden:)', '(hidden:)'],
			['(if:)',     '(if:false)'],
			['(unless:)', '(unless:true)'],
			['(else-if:)','(if:true)[](else-if:true)'],
			['(else:)',   '(if:true)[](else:)'],
			['booleans', '(set:$x to false)$x'],
		].forEach(function(arr) {
			var name = arr[0], code = arr[1];
			it("reveals hooks hidden with " + name, function() {
				expect(code + '|3>[Red](show:?3)').markupToPrint('Red');
				var p = runPassage(code + '|3>[Red](link:"A")[(show:?3)]');
				expect(p.text()).toBe('A');
				p.find('tw-link').click();
				expect(p.text()).toBe('Red');
			});
		});
		it("reveals specific same-named hooks", function() {
			expect('|3)[Red]|3)[Blue]|3)[Green](show:?3\'s 1st)').markupToPrint('Red');
			expect('|3)[Red]|3)[Blue]|3)[Green](show:?3\'s 2nd)').markupToPrint('Blue');
			expect('|3)[Red]|3)[Blue]|3)[Green](show:?3\'s last)').markupToPrint('Green');
			expect('|3)[Red]|3)[Blue]|3)[Green](show:?3\'s last, ?3\'s 1st)').markupToPrint('RedGreen');
		});
		it("does nothing if the hook is already visible", function() {
			expect('|3>[Red](show:?3)').markupToPrint("Red");
			expect('|3>[Red]|3)[Blue](show:?3)').markupToPrint("RedBlue");
		});
		it("errors if given ?page", function() {
			expect("(show:?page)").markupToError();
			expect("(show:?page's 1st)").markupToError();
			expect("(show:?foo + ?page's 1st)").markupToError();
			expect("(show:(?foo + ?page)'s 1st)").markupToError();
		});
		it("can't reveal a hook twice", function() {
			expect('|3)[Red](show:?3)(show:?3)').markupToPrint("Red");
			expect('(set:$r to 10)|3)[(set:$r to it+10)$r](show:?3)(show:?3)(show:?3)').markupToPrint("20");
		});
		it("doesn't re-execute hooks hidden with (hide:)", function() {
			var p = runPassage('(set:$foo to "foo")|1>[(set:$foo to it + "bar")$foo](hide:?1)(show:?1)');
			expect(p.text()).toBe('foobar');
		});
		it("works when saved in another passage", function() {
			runPassage("(set:$foo to (show:?3))");
			expect('|3)[Red]$foo').markupToPrint("Red");
		});
		it("works with temp variables", function() {
			expect('[(set:_foo to 1)|3)[_foo]](show:?3)').markupToPrint('1');
			expect('(set:_foo to 1)|3)[_foo][(set:_foo to 2)(show:?3)]').markupToPrint('2');
		});
	});
	describe("the (hide:) macro", function() {
		it("accepts 1 or more hooknames", function() {
			expect("(print:(hide:))").markupToError();
			expect("(print:(hide:2))").markupToError();
			expect("(print:(hide:''))").markupToError();
			expect("(print:(hide:'s'))").markupToError();
			expect("(print:(hide:true))").markupToError();
			expect("(print:(hide:?foo))").not.markupToError();
			expect("(print:(hide:?foo, ?bar, ?baz, ?qux))").not.markupToError();
		});
		it("hides visible hooks", function() {
			expect('|3>[Red](hide:?3)').markupToPrint('');
			var p = runPassage('|3>[Red](link-reveal:"A")[(hide:?3)]');
			expect(p.text()).toBe('RedA');
			p.find('tw-link').click();
			expect(p.text()).toBe('A');
		});
		it("errors if given ?page", function() {
			expect("(hide:?page)").markupToError();
			expect("(hide:?page's 1st)").markupToError();
			expect("(hide:?foo + ?page's 1st)").markupToError();
			expect("(hide:(?foo + ?page)'s 1st)").markupToError();
		});
		it("hides specific same-named hooks", function() {
			expect('|3>[Red]|3>[Blue]|3>[Green](hide:?3\'s 1st)').markupToPrint('BlueGreen');
			expect('|3>[Red]|3>[Blue]|3>[Green](hide:?3\'s 2nd)').markupToPrint('RedGreen');
			expect('|3>[Red]|3>[Blue]|3>[Green](hide:?3\'s last)').markupToPrint('RedBlue');
			expect('|3>[Red]|3>[Blue]|3>[Green](hide:?3\'s last, ?3\'s 1st)').markupToPrint('Blue');
		});
		it("does nothing if the hook is already hidden", function() {
			expect('|3)[Red](hide:?3)').markupToPrint("");
			expect('|3>[Red](hide:?3)(hide:?3)').markupToPrint("");
		});
		it("works when saved in another passage", function() {
			runPassage("(set:$foo to (hide:?3))");
			expect('|3>[Red]$foo').markupToPrint("");
		});
	});
	describe("the (rerun:) macro", function() {
		it("accepts 1 or more hooknames", function() {
			expect("(print:(rerun:))").markupToError();
			expect("(print:(rerun:2))").markupToError();
			expect("(print:(rerun:''))").markupToError();
			expect("(print:(rerun:'s'))").markupToError();
			expect("(print:(rerun:true))").markupToError();
			expect("(print:(rerun:?foo))").not.markupToError();
			expect("(print:(rerun:?foo, ?bar, ?baz, ?qux))").not.markupToError();
		});
		it("reruns shown hooks, executing the contained macros again", function() {
			expect('(set:$foo to 1)|3>[(set:$foo to it+1)](rerun:?3)$foo').markupToPrint('3');
		});
		it("reverts hooks to their original code", function() {
			expect('|3>[Garply](replace:?3)[Grault](rerun:?3)').markupToPrint('Garply');
		});
		it("errors if it would cause an infinite loop", function() {
			expect("|1>[(rerun:?2)]|2>[(rerun:?1)]").markupToError();
		});
		it("errors if given ?page", function() {
			expect("(rerun:?page)").markupToError();
			expect("(rerun:?page's 1st)").markupToError();
			expect("(rerun:?foo + ?page's 1st)").markupToError();
			expect("(rerun:(?foo + ?page)'s 1st)").markupToError();
		});
		it("works with ?passage without erasing the ?sidebar", function() {
			runPassage("(set:$b to 0)");
			runPassage("(set:$a to 10)(set:$b to it + $a)(if:$b < 20)[(rerun:?passage)]<b>$b</b>");
			expect($('tw-passage b').text()).toBe("20");
			expect($('tw-passage tw-sidebar').length).toBe(1);
		});
		it("doesn't work on hidden hooks", function() {
			expect('(set:$foo to 1)|3)[(set:$foo to it+1)](rerun:?3)$foo').markupToPrint('1');
		});
		it("works when saved in another passage", function() {
			runPassage("(set:$bar to (rerun:?3))");
			expect('(set:$foo to 1)|3>[(set:$foo to it+1)]$bar$foo').markupToPrint("3");
		});
		it("works with temp variables", function() {
			expect('[(set:_foo to 1)|3>[_foo]](rerun:?3)').markupToPrint('1');
			expect('(set:_foo to 1)|3>[_foo][(set:_foo to 2)(rerun:?3)]').markupToPrint('2');
		});
		it("works with temp variables when rerunning itself", function() {
			expect('(set:_foo to 1)|3>[_foo(if:_foo < 2)[(set:_foo to it + 1)(rerun:?3)]]').markupToPrint('2');
		});
	});
	describe("in debug mode, the <tw-expression> has the 'false' class when the hook is hidden", function() {
		it("by (if:)", function() {
			expect(runPassage("(if:false)[Gosh]").find('tw-expression').attr('class')).toMatch(/\bfalse\b/);
		});
		it("but not by (hidden:)", function() {
			expect(runPassage("(hidden:)[Gosh]").find('tw-expression').attr('class')).not.toMatch(/\bfalse\b/);
		});
	});
	describe("the (for:) macro", function() {
		it("accepts a 'where' or 'each' lambda, plus zero or more other values", function() {
			expect("(for:)[]").markupToError();
			expect("(for:1)[]").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(for: _a where true," + "2,".repeat(i) + ")[]").not.markupToError();
			}
			expect("(for: each _a)[]").not.markupToError();
			expect("(for: _a via true,2)[]").markupToError();
			expect("(for:_a making _b where true,2)[]").markupToError();
			expect("(for: _a where _a*2, 1)[]").markupToError();
		});
		it("errors if the 'where' lambda doesn't name the temp variable", function() {
			expect("(for: where it > 2, 1,2,3)[]").markupToError();
		});
		it("errors if the lambda has a typed variable that doesn't match the values", function() {
			expect("(for: each str-type _a, 1,2,3)[]").markupToError();
			expect("(for: each num-type _a, 1,2,'e')[]").markupToError();
		});
		it("renders the attached hook's code once for each value", function() {
			expect("(for: each _a, 1)[A]").markupToPrint("A");
			expect("(for: each _a, 1, 2)[A]").markupToPrint("AA");
			expect("(for: each _a, 1, 2, 3)[A]").markupToPrint("AAA");
			expect("(set:$a to 0)(for: each _a, 1)[(set: $a to it+1)]$a").markupToPrint("1");
			expect("(set:$a to 0)(for: each _a, 1,2)[(set: $a to it+1)]$a").markupToPrint("2");
			expect("(set:$a to 0)(for: each _a, 1,2,3)[(set: $a to it+1)]$a").markupToPrint("3");
		});
		it("is also known as (loop:)", function() {
			expect("(loop: each _a, 1,2,3)[A]").markupToPrint("AAA");
		});
		it("uses the 'where' clause to determine which values to iterate over", function() {
			expect("(for: _a where _a > 4, 1,2,3,4)[A]").markupToPrint("");
			expect("(for: _a where _a > 3, 1,2,3,4)[A]").markupToPrint("A");
			expect("(for: _a where _a > 2, 1,2,3,4)[A]").markupToPrint("AA");
		});
		it("sets the temporary variable for each loop", function() {
			expect("(for: each _a, 1,2,3)[_a]").markupToPrint("123");
			expect("(set:_a to 0)(for: each _a, 1,2,3)[_a(set:_a to 4)_a]_a").markupToPrint("1424340");
		});
		it("can be composed with other style macros", function() {
			expect("(set: $a to (for: each _a, 1,2,3) + (text-style:'bold'))$a[Gee]").markupToPrint("GeeGeeGee");
			expect("(set: $a to (if: false) + (for: each _a, 1,2,3))$a[Gee]").markupToPrint("");
		});
		it("can be applied to commands", function() {
			expect("(for: each _a, 1,2,3)(print:'Gee')").markupToPrint("GeeGeeGee");
		});
		it("can be composed with itself", function() {
			expect("(set: $a to (for: each _a, 1,2,3) + (for: each _b, 4,5,6))$a[_a _b ]").markupToPrint("1 4 2 5 3 6 ");
			expect("(set: $a to (for: each _a, 1,2) + (for: each _b, 4,5,6))$a[_a _b ]").markupToPrint("1 4 2 5 ");
			expect("(set: $a to (for: _a where _a > 3, 1,2) + (for: each _b, 4,5,6))$a[_a _b ]").markupToPrint("");
		});
		it("can loop over 50 times", function() {
			expect("(for: each _b, ...(range: 1,50))[x]").markupToPrint("x".repeat('50'));
			expect("(for: each _b, ...(range: 1,50))[_b]").markupToPrint(Array.from(Array(50)).reduce(function(a,_,i) { return ""+a+(i+1); }, ''));
		});
		it("will still error if an iteration causes an infinite loop", function() {
			createPassage("(for: each _b, ...(range: 1,50))[(if:_b is 15)[(display:'qux')]]", "qux");
			expect("(display:'qux')").markupToError();
			createPassage("(for: each _b, ...(range: 1,50))[(if:_b is 50)[(display:'quux')]]", "quux");
			expect("(display:'quux')").markupToError();
		});
	});
	['true','false'].forEach(function(name) {
		describe("the (test-"+name+":) macro", function() {
			['2,5,7','','"",where it is 2','(hidden:),even','?foo, ?bar, ?baz, ?qux','false','bind $a'].forEach(function(val) {
				it("accepts any amount of data", function() {
					expect("(print:(test-"+name+":"+val+"))").not.markupToError();
				});
				it("always " + (name === 'true' ? 'show' : 'hide') + "s the hook", function() {
					expect("(test-"+name+":"+val+")[baz]").markupToPrint(name === 'true' ? 'baz' : '');
				});
			});
		});
	});
});
