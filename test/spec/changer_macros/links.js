describe("link macros", function() {
	'use strict';
	
	describe("(link-replace:)", function() {
		it("accepts exactly 1 non-empty string, plus an optional changer", function() {
			expect("(print:(link-replace:))").markupToError();
			expect("(print:(link-replace:''))").markupToError();
			expect("(print:(link-replace:'baz'))").not.markupToError();
			expect("(print:(link-replace:2))").markupToError();
			expect("(print:(link-replace:false))").markupToError();
			expect("(print:(link-replace:'baz', 'baz'))").markupToError();
			expect("(print:(link-replace:'baz', (b4r:'solid')))").not.markupToError();
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
		it("can render hooks in the markup in the link text", function() {
			var p = runPassage("(link-replace:'//(color:#668899)[foo]//')[]");
			expect(p.find('tw-link tw-hook')).toHaveColour("#668899");
		});
		it("when clicked, reveals the hook and removes itself", function() {
			var p = runPassage("(link-replace:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("B");
			expect("$c").markupToPrint("12");
		});
		it("works with temp variables", function() {
			var p = runPassage("(set:_a to 1)(link-replace:'A')[(print:_a)]");
			p.find('tw-link').click();
			expect(p.text()).toBe('1');
		});
		it("is aliased as (link:)", function() {
			var p = runPassage("(link:'A')[B(set:$c to 12)]");
			p.find('tw-link').click();
			expect(p.text()).toBe("B");
			expect("$c").markupToPrint("12");
		});
		it("can be concatenated", function() {
			var p = runPassage("(set: $x to (link:'a')+(link:'b'))$x[Hello]");
			expect(p.text()).toBe("a");
			p.find('tw-link').click();
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
		it("can be altered with the optional style changer", function(done) {
			var p = runPassage("(link:'mire', (text-rotate: 20))[]");
			setTimeout(function(){
				expect(p.find('tw-link').attr('style')).toMatch(/rotate\(20deg\)/);
				done();
			});
		});
		it("errors if the optional style changer contains a revision changer", function() {
			expect("(link:'mire', (append-with:'wow'))[]").markupToError();
		});
		it("suppresses all other changers attached to it, applying them only to the revealed text", function() {
			var p = runPassage("(link:'foo')+(color:#668899)[]");
			expect(p.find('tw-link')).not.toHaveColour("#668899");

			p = runPassage("(link:'foo')+(t8n:'dissolve')[garply2]");
			expect(p.text()).toBe('foo');
			p.find('tw-link').click();
			expect(p.text()).toBe("garply2");

			p = runPassage("(link:'foo2')+(append-with:'baz')[]");
			expect(p.find('tw-link').text()).toBe('foo2');
			p.find('tw-link').click();
			expect(p.text()).toBe("baz");

			p = runPassage("(link:'foo3')+(replace:?foo)[garply3]w|foo>[qux]");
			expect(p.text()).toBe('foo3wqux');
			p.find('tw-link').click();
			expect(p.text()).toBe("wgarply3");

			p = runPassage("(link:'foo4')+(if:false)[garply4]");
			expect(p.text()).toBe('foo4');
			p.find('tw-link').click();
			expect(p.text()).toBe("");

			p = runPassage("(link:'foo5')+(click:?foo)[garply]|foo>[qux]");
			expect(p.text()).toBe('foo5qux');
			p.find('tw-link').click();
			expect(p.text()).toBe("qux");
			p.find('.link').click();
			expect(p.text()).toBe("garplyqux");
		});
	});
	describe("(link-reveal:)", function() {
		it("accepts 1 non-empty string, plus an optional changer", function() {
			expect("(print:(link-reveal:))").markupToError();
			expect("(print:(link-reveal:''))").markupToError();
			expect("(print:(link-reveal:'baz'))").not.markupToError();
			expect("(print:(link-reveal:2))").markupToError();
			expect("(print:(link-reveal:false))").markupToError();
			expect("(print:(link-reveal:'baz', 'baz'))").markupToError();
			expect("(print:(link-reveal:'baz', (b4r:'solid')))").not.markupToError();
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
		it("can be altered with the optional style changer", function(done) {
			var p = runPassage("(link-reveal:'mire', (text-rotate: 20))[]");
			setTimeout(function(){
				expect(p.find('tw-link').attr('style')).toMatch(/rotate\(20deg\)/);
				done();
			});
		});
		it("errors if the optional style changer contains a revision changer", function() {
			expect("(link-reveal:'mire', (append-with:'wow'))[]").markupToError();
		});
	});
	["link-repeat","link-rerun"].forEach(function(name) {
		describe("("+name+":)", function() {
			it("accepts 1 non-empty string, plus an optional changer", function() {
				expect("(print:("+name+":)").markupToError();
				expect("(print:("+name+":''))").markupToError();
				expect("(print:("+name+":'baz'))").not.markupToError();
				expect("(print:("+name+":2))").markupToError();
				expect("(print:("+name+":false))").markupToError();
				expect("(print:("+name+":'baz', 'baz'))").markupToError();
				expect("(print:("+name+":'baz', (b4r:'solid')))").not.markupToError();
			});
			it("errors when placed in passage prose while not attached to a hook", function() {
				expect("("+name+":'A')").markupToError();
				expect("("+name+":'A')[]").not.markupToError();
			});
			it("when attached to a hook, creates a link", function() {
				var link = runPassage("("+name+":'A')[]").find('tw-link');
				expect(link.parent().is('tw-hook')).toBe(true);
				expect(link.tag()).toBe("tw-link");
			});
			it("when clicked, reveals the hook and leaves the link as-is", function() {
				var p = runPassage("("+name+":'A')[B(set:$c to 12)]");
				p.find('tw-link').click();
				expect(p.text()).toBe("AB");
				expect(p.find('tw-link').length).toBe(1);
				expect("$c").markupToPrint("12");
			});
			if (name === "link-repeat") {
				it("when clicked multiple times, the hook is appended", function() {
					var p = runPassage("(set:$c to 0)("+name+":'A')[B(set:$c to it + 12)]");
					p.find('tw-link').click().click().click();
					expect(p.text()).toBe("ABBB");
					expect("$c").markupToPrint("36");
				});
				it("works when enchanted", function() {
					var p = runPassage("(enchant:?link,(bg:blue))(set:$c to 0)("+name+":'A')[B(set:$c to it + 12)]");
					p.find('tw-link').click().click().click();
					expect(p.text()).toBe("ABBB");
					expect("$c").markupToPrint("36");
				});
			} else {
				it("when clicked multiple times, the hook is re-ran", function() {
					var p = runPassage("(set:$c to 0)("+name+":'A')[B(set:$c to it + 12)]");
					p.find('tw-link').click().click().click();
					expect(p.text()).toBe("AB");
					expect("$c").markupToPrint("36");
				});
				it("works when enchanted", function() {
					var p = runPassage("(enchant:?link,(bg:blue))(set:$c to 0)("+name+":'A')[B(set:$c to it + 12)]");
					p.find('tw-link').click().click().click();
					expect(p.text()).toBe("AB");
					expect("$c").markupToPrint("36");
				});
			}
			it("can be altered with the optional style changer", function(done) {
				var p = runPassage("("+name+":'mire', (text-rotate: 20))[]");
				setTimeout(function(){
					expect(p.find('tw-link').attr('style')).toMatch(/rotate\(20deg\)/);
					done();
				});
			});
			it("errors if the optional style changer contains a revision changer", function() {
				expect("("+name+":'mire', (append-with:'wow'))[]").markupToError();
			});
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
			it("can render hooks in the markup in the link text", function() {
				createPassage("","mire");
				var p = runPassage("("+name+":'//(color:#668899)[foo]//','//mire//')"+hook);
				expect(p.find('tw-link tw-hook')).toHaveColour("#668899");
			});
			it("won't interpret the passage name as markup if it exactly matches an existing passage", function() {
				createPassage("","*foo_bar*");
				var p = runPassage("("+name+":'*foo_bar*')"+hook);
				
				expect(p.find('tw-link').html()).toBe("<tw-verbatim>*foo_bar*</tw-verbatim>");
				if (!hook) {
					expect(p.find('tw-expression').data("linkPassageName")).toBe("*foo_bar*");
				}

				createPassage("","`````````baz`````````");
				p = runPassage("("+name+":'`````````baz`````````')"+hook);
				expect(p.find('tw-link').html()).toBe("<tw-verbatim>`````````baz`````````</tw-verbatim>");
				if (!hook) {
					expect(p.find('tw-expression').data("linkPassageName")).toBe("`````````baz`````````");
				}
			});
			it("will interpret the passage name as markup if the link is broken", function() {
				var link = runPassage("[[mi''r''e]]").find('tw-broken-link');
			
				expect(link.html()).toBe("mi<b>r</b>e");
			});
			it("can't have commands, changers or blockers in the passage name", function() {
				expect("("+name+":'(text-style:\"bold\")')"+hook).markupToError();
				expect("("+name+":'(print:\"foo\")')"+hook).markupToError();
				expect("("+name+":'(prompt:\"foo\",\"\")')"+hook).markupToError();
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
					},40);
				});
				it("can be altered with the optional style changer", function(done) {
					createPassage("<p>$foo</p>","mire");
					var p = runPassage("("+name+":'mire', (text-rotate: 20))[]");
					setTimeout(function(){
						expect(p.find('tw-link').attr('style')).toMatch(/rotate\(20deg\)/);
						done();
					});
				});
				it("errors if the optional style changer contains a revision changer", function() {
					expect("("+name+":'mire', (append-with:'wow'))[]").markupToError();
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
					},40);
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
		it("accepts 1 non-empty string, and 1 optional string", function() {
			expect("(link-undo:)").markupToError();
			expect("(link-undo:2)").markupToError();
			expect("(link-undo:'')").markupToError();
			expect("(link-undo:true)").markupToError();
			
			expect("(link-undo:'s')").not.markupToError();
			expect("(link-undo:'s','s')").not.markupToError();
			expect("(link-undo:'s','s','s')").markupToError();
		});
		it("displays the optional second string, or nothing, if undos aren't available", function(){
			clearState();
			expect("(link-undo:'Wow')").markupToPrint('');
			expect("(forget-undos:1)(link-undo:'Wow','foo **bar**')").markupToPrint('foo bar');
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
		it("changes its text if (forget-undos:) erases the entire past after it", function() {
			runPassage("","grault");
			runPassage("(link-undo:'mire','foo bar')(forget-undos:1)");
			expect($('tw-passage tw-link').length).toBe(0);
			expect($('tw-passage tw-expression').text()).toBe('foo bar');
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
		it("doesn't re-execute hooks hidden with (hide:)", function() {
			var p = runPassage('(set:$foo to "foo")|1>[(set:$foo to it + "bar")$foo](hide:?1)(link-show:"A",?1)');
			p.find('tw-link').click();
			expect(p.text()).toBe('foobarA');
		});
		it("works with temp variables", function() {
			var p = runPassage('[(set:_foo to 1)|3)[_foo]](link-show:"A",?3)');
			p.find('tw-link').click();
			expect(p.text()).toBe('1A');
			p = runPassage('(set:_foo to 1)|3)[_foo][(set:_foo to 2)(link-show:"A",?3)]');
			p.find('tw-link').click();
			expect(p.text()).toBe('2A');
		});
	});
	describe("(link-fullscreen:)", function() {
		it("accepts 2 or 3 non-empty strings", function() {
			expect("(link-fullscreen:)").markupToError();
			expect("(link-fullscreen:2)").markupToError();
			expect("(link-fullscreen:'')").markupToError();
			expect("(link-fullscreen:true)").markupToError();
			
			expect("(link-fullscreen:'s')").markupToError();
			expect("(link-fullscreen:'s','s')").not.markupToError();
			expect("(link-fullscreen:'s','s','s')").not.markupToError();
		});
		it("if fullscreen is available and not enabled, renders to a <tw-link> element containing the first link text", function() {
			var link = runPassage("(link-fullscreen:'mire','qux')").find('tw-link');
			expect(link.parent().is('tw-expression')).toBe(true);
			expect(link.tag()).toBe("tw-link");
			expect(link.text()).toBe("mire");
			expect(link.is("[fullscreen]")).toBe(true);
		});
		// More link text tests aren't really feasible at the moment...
		it("when clicked, toggles fullscreen mode on <html>", function() {
			spyOn(document.documentElement,'requestFullscreen');
			runPassage("(link-fullscreen:'mire','qux')").find('tw-link').click();
			expect(document.documentElement.requestFullscreen).toHaveBeenCalled();
		});
		it("renders markup in the link text", function() {
			var p = runPassage("(link-fullscreen:'//glower//','qux')");
			expect(p.find('i').text()).toBe("glower");
		});
		it("can be focused", function() {
			var link = runPassage("(link-fullscreen:'mire','qux')").find('tw-link');
			expect(link.attr("tabindex")).toBe("0");
		});
		it("can be altered with attached style changers", function(done) {
			var p = runPassage("(text-rotate: 20)(link-fullscreen:'mire','qux')");
			var expr = p.find('tw-expression:last-child');
			setTimeout(function() {
				expect(expr.attr('style')).toMatch(/rotate\(20deg\)/);
				done();
			});
		});
	});
});
