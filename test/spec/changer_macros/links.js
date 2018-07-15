describe("link macros", function() {
	'use strict';
	
	describe("(link-replace:)", function() {
		it("accepts exactly 1 non-empty string", function() {
			expect("(print:(link-replace:))").markupToError();
			expect("(print:(link-replace:''))").markupToError();
			expect("(print:(link-replace:'baz'))").not.markupToError();
			expect("(print:(link-replace:2))").markupToError();
			expect("(print:(link-replace:false))").markupToError();
			expect("(print:(link-replace:'baz', 'baz'))").markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(link-replace:'A')").markupToError();
			expect("(link-replace:'A')[]").not.markupToError();
		});
		it("when attached to a hook, creates a link", function() {
			var link = runPassage("(link-replace:'A')[]").find('tw-link');
			expect(link.parent().is('tw-hook')).toBe(true);
			expect(link.tag()).toBe("tw-link");
		});
		it("when clicked, reveals the hook and removes itself", function() {
			var p = runPassage("(link-replace:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("B");
			expect("$c").markupToPrint("12");
		});
		it("is aliased as (link:)", function() {
			var p = runPassage("(link:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("B");
			expect("$c").markupToPrint("12");
		});
		it("can be concatenated", function() {
			var p = runPassage("(set: $x to (link:'a')+(link:'b'))$x[Hello]");
			expect(p.text()).toBe("b");
			p.find('tw-link').click();
			expect(p.text()).toBe("Hello");
		});
		it("can't be clicked if its text contains an error", function() {
			var p = runPassage("(link-replace:'(print:2+true)')[B]");
			expect(p.find('tw-link tw-error').length).toBe(1);
			p.find('tw-link').click();
			expect(p.text()).not.toBe("B");
		});
	});
	describe("(link-reveal:)", function() {
		it("accepts exactly 1 non-empty string", function() {
			expect("(print:(link-reveal:))").markupToError();
			expect("(print:(link-reveal:''))").markupToError();
			expect("(print:(link-reveal:'baz'))").not.markupToError();
			expect("(print:(link-reveal:2))").markupToError();
			expect("(print:(link-reveal:false))").markupToError();
			expect("(print:(link-reveal:'baz', 'baz'))").markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(link-reveal:'A')").markupToError();
			expect("(link-reveal:'A')[]").not.markupToError();
		});
		it("when attached to a hook, creates a link", function() {
			var link = runPassage("(link-reveal:'A')[]").find('tw-link');
			expect(link.parent().is('tw-hook')).toBe(true);
			expect(link.tag()).toBe("tw-link");
		});
		it("when clicked, reveals the hook and becomes plain text", function() {
			var p = runPassage("(link-reveal:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("AB");
			expect(p.find('tw-link').length).toBe(0);
			expect("$c").markupToPrint("12");
		});
	});
	describe("(link-repeat:)", function() {
		it("accepts exactly 1 non-empty string", function() {
			expect("(print:(link-repeat:))").markupToError();
			expect("(print:(link-repeat:''))").markupToError();
			expect("(print:(link-repeat:'baz'))").not.markupToError();
			expect("(print:(link-repeat:2))").markupToError();
			expect("(print:(link-repeat:false))").markupToError();
			expect("(print:(link-repeat:'baz', 'baz'))").markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(link-repeat:'A')").markupToError();
			expect("(link-repeat:'A')[]").not.markupToError();
		});
		it("when attached to a hook, creates a link", function() {
			var link = runPassage("(link-repeat:'A')[]").find('tw-link');
			expect(link.parent().is('tw-hook')).toBe(true);
			expect(link.tag()).toBe("tw-link");
		});
		it("when clicked, reveals the hook and leaves the link as-is", function() {
			var p = runPassage("(link-repeat:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("AB");
			expect(p.find('tw-link').length).toBe(1);
			expect("$c").markupToPrint("12");
		});
		it("the link can be clicked multiple times", function() {
			var p = runPassage("(set:$c to 0)(link-repeat:'A')[B(set:$c to it + 12)]");
			p.find('tw-link').click();
			p.find('tw-link').click();
			p.find('tw-link').click();
			expect("$c").markupToPrint("36");
		});
	});
	/*
		Though (link-goto:), (link-undo:) and (link-show:) are not changers, they are similar enough to the above in terms of API.
	*/
	['link-goto', 'link-reveal-goto'].forEach(function(name) {
		var hook = name === "link-reveal-goto" ? "[]" : "";

		describe("("+name+":)", function() {
			it("accepts 1 or 2 non-empty strings" + (hook && ", and attaches to a hook"), function() {
				expect("("+name+":)"+hook).markupToError();
				expect("("+name+":'')"+hook).markupToError();
				expect("("+name+":2)"+hook).markupToError();
				expect("("+name+":true)"+hook).markupToError();

				expect("("+name+":'s')"+hook).not.markupToError();
				expect("("+name+":'s','s')"+hook).not.markupToError();
				expect("("+name+":'s','s','s')"+hook).markupToError();

				if (hook) {
					expect("("+name+":'s','s')").markupToError();
				}
			});
			it("renders to a <tw-link> element if the linked passage exists", function() {
				createPassage("","mire");
				var link = runPassage("("+name+":'mire')"+hook).find('tw-link');
				
				expect(link.parent().is(hook ? 'tw-hook' : 'tw-expression')).toBe(true);
				expect(link.tag()).toBe("tw-link");
			});
			it("becomes a <tw-broken-link> if the linked passage is absent", function() {
				var link = runPassage("("+name+": 'mire')"+hook).find('tw-broken-link');
				
				expect(link.parent().is(hook ? 'tw-hook' : 'tw-expression')).toBe(true);
				expect(link.tag()).toBe("tw-broken-link");
				expect(link.html()).toBe("mire");
			});
			it("still becomes a <tw-broken-link> if its text contains an error", function() {
				var link = runPassage("(" + name + ":'(print:2+true)','mire')"+hook).find('tw-broken-link');
				
				expect(link.parent().is(hook ? 'tw-hook' : 'tw-expression')).toBe(true);
				expect(link.tag()).toBe("tw-broken-link");
			});
			it("renders markup in the link text, and ignores it for discerning the passage name", function() {
				createPassage("","mire");
				var p = runPassage("("+name+":'//glower//','//mire//')"+hook);
				expect(p.find('i').text()).toBe("glower");

				p = runPassage("("+name+":'//mire//')"+hook);
				expect(p.find('i').text()).toBe("mire");
			});
			if (hook) {
				it("runs the hook when clicked, before going to the passage", function() {
					createPassage("<p>$foo</p>","mire");
					var link = runPassage("(set:$foo to 'grault')("+name+":'mire')[(set:$foo to 'garply')]").find('tw-link');
					expect(link.length).toBe(1);
					link.click();
					expect($('tw-passage p').text()).toBe("garply");
				});
				// This probably also tests for contained (load-game:) interaction...
				it("contained (goto:)s go to that passage instead of the intended passage", function(done) {
					createPassage("<p>$foo</p>(set:$foo to 'baz')","mire");
					createPassage("<p>$foo</p>","mere");
					var link = runPassage("(set:$foo to 'bar')("+name+":'mire')[(goto:'mere')]").find('tw-link');
					link.click();
					setTimeout(function() {
						expect($('tw-passage p').text()).toBe("bar");
						done();
					});
				});
			}
			else {
				it("goes to the passage when clicked", function() {
					createPassage("<p>garply</p>","mire");
					var link = runPassage("("+name+":'mire')").find('tw-link');
					link.click();
					expect($('tw-passage p').text()).toBe("garply");
				});
				it("can be altered with attached style changers", function(done) {
					var p = runPassage("(text-rotate: 20)("+name+":'mire')");
					var expr = p.find('tw-expression:last-child');
					setTimeout(function() {
						expect(expr.attr('style')).toMatch(/rotate\(20deg\)/);
						done();
					});
				});
			}
			it("can be focused", function() {
				createPassage("","mire");
				var link = runPassage("("+name+":'mire')"+hook).find('tw-link');
				expect(link.attr("tabindex")).toBe("0");
			});
			it("behaves as if clicked when the enter key is pressed while it is focused", function() {
				createPassage("<p>garply</p>","mire");
				var link = runPassage("("+name+":'mire')"+hook).find('tw-link');
				link.trigger($.Event('keydown', { which: 13 }));
				expect($('tw-passage p').text()).toBe("garply");
			});
			it("can't be clicked if its text contains an error", function() {
				createPassage("<p>garply</p>","mire");
				var p = runPassage("(" + name + ":'(print:2+true)','mire')"+hook);
				expect(p.find('tw-link tw-error').length).toBe(1);
				p.find('tw-link').click();
				expect(p.text()).not.toBe("garply");
			});
		});
	});
	describe("(link-undo:)", function() {
		it("accepts exactly 1 non-empty string", function() {
			expect("(link-undo:)").markupToError();
			expect("(link-undo:2)").markupToError();
			expect("(link-undo:'')").markupToError();
			expect("(link-undo:true)").markupToError();
			
			expect("(link-undo:'s')").not.markupToError();
			expect("(link-undo:'s','s')").markupToError();
			expect("(link-undo:'s','s','s')").markupToError();
		});
		it("errors when run in the first turn", function(){
			clearState();
			expect("(link-undo:'x')").markupToError();
		});
		it("renders to a <tw-link> element containing the link text", function() {
			runPassage("","grault");
			var link = runPassage("(link-undo:'mire')").find('tw-link');
			
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.tag()).toBe("tw-link");
			expect(link.text()).toBe("mire");
			expect(link.is("[undo]")).toBe(true);
		});
		it("renders markup in the link text", function() {
			runPassage("","grault");
			var p = runPassage("(link-undo:'//glower//')");
			expect(p.find('i').text()).toBe("glower");
		});
		it("when clicked, undoes the current turn", function() {
			runPassage("(set: $a to 1)","one");
			runPassage("(set: $a to 2)(link-undo:'x')","two").find('tw-link').click();
			expect("(print: $a) (print:(history:)'s length)").markupToPrint("1 1");
		});
		it("can be focused", function() {
			runPassage("","grault");
			var link = runPassage("(link-undo:'mire')").find('tw-link');
			expect(link.attr("tabindex")).toBe("0");
		});
		it("can be altered with attached style changers", function(done) {
			runPassage("","grault");
			var p = runPassage("(text-rotate: 20)(link-undo:'mire')");
			var expr = p.find('tw-expression:last-child');
			setTimeout(function() {
				expect(expr.attr('style')).toMatch(/rotate\(20deg\)/);
				done();
			});
		});
		it("behaves as if clicked when the enter key is pressed while it is focused", function() {
			runPassage("<p>garply</p>","grault");
			var link = runPassage("(link-undo:'mire')","corge").find('tw-link');
			link.trigger($.Event('keydown', { which: 13 }));
			expect($('tw-passage p').text()).toBe("garply");
		});
	});
	describe("(link-show:)", function() {
		it("accepts 1 non-empty string and 1 or more hooknames", function() {
			expect("(link-show:)").markupToError();
			expect("(link-show:2)").markupToError();
			expect("(link-show:'')").markupToError();
			expect("(link-show:'s')").markupToError();
			expect("(link-show:true)").markupToError();
			
			expect("(link-show:'s',?foo)").not.markupToError();
			expect("(link-show:'s',?foo, ?bar, ?baz, ?qux)").not.markupToError();
			expect("(link-show:'s',?foo, 's')").markupToError();
		});
		it("when clicked, becomes plain text and reveals hidden named hooks", function() {
			var p = runPassage('|3)[Red](link-show:"A",?3)');
			expect(p.text()).toBe('A');
			p.find('tw-link').click();
			expect(p.text()).toBe('RedA');
			expect(p.find('tw-link').length).toBe(0);
		});
		[
			['(hidden:)', '(hidden:)'],
			['(if:)',     '(if:false)'],
			['(unless:)', '(unless:true)'],
			['(else-if:)','(if:true)[](else-if:true)'],
			['(else:)',   '(if:true)[](else:)'],
			['booleans',  '(set:$x to false)$x'],
		].forEach(function(arr) {
			var name = arr[0], code = arr[1];
			it("when clicked, reveals hooks hidden with " + name, function() {
				expect(code + '|3>[Red](show:?3)').markupToPrint('Red');
				var p = runPassage(code + '|3>[Red](link-show:"A",?3)');
				expect(p.text()).toBe('A');
				p.find('tw-link').click();
				expect(p.text()).toBe('RedA');
			});
		});
		it("when clicked, reveals specific same-named hooks", function() {
			var p = runPassage('|3)[Red]|3)[Blue]|3)[Green](link-show:"A",?3\'s last, ?3\'s 1st)');
			p.find('tw-link').click();
			expect(p.text()).toBe('RedGreenA');
		});
	});
});
