describe("basic command macros", function() {
	'use strict';
	
	describe("the (print:) macro", function() {
		it("requires exactly 1 argument of any type", function() {
			expect("(print:)").markupToError();
			expect("(print:1,2)").markupToError();
		});
		it("prints the text equivalent of number expressions", function() {
			expect("(print:2+0)").markupToPrint("2");
		});
		it("prints the text equivalent of string expressions", function() {
			expect("(print: 'gar' + 'ply')").markupToPrint("garply");
		});
		it("prints twinemarkup in strings", function() {
			var expr = runPassage("(print: '//gar' + 'ply//')").find('tw-expression');

			expect(expr.text()).toBe("garply");
			expect(expr.children().is('i')).toBe(true);
		});
		it("prints the text equivalent of boolean expressions", function() {
			expect("(print: true)").markupToPrint("true");
		});
		it("prints the text equivalent of arrays", function() {
			expect("(print: (a: 2,4))").markupToPrint("2,4");
			expect("(print: (a: (a:2,4)))").markupToPrint("2,4");
		});
		it("prints the text equivalent of datasets", function() {
			expect("(print: (dataset: 2,4))").markupToPrint("2,4");
			expect("(print: (dataset: (dataset:2,4)))").markupToPrint("2,4");
		});
		it("can be printed with (print:)", function() {
			expect("(print:(print:'Golly molly'))").markupToPrint("[A (print:) command]");
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (print:1) + (print:1))").markupToError();
		});
		it("commands inside (print:) aren't executed", function() {
			spyOn(window,'open');
			runPassage("(set: $x to (print:(open-url:'http://example.org')))");
			expect(window.open).not.toHaveBeenCalled();
			expect("$x").markupToPrint("[A (open-url:) command]");
		});
		it("can be (set:) into a variable", function() {
			var expr = runPassage("(set: $x to (print:'//grault//'))$x").find('tw-expression:last-child');

			expect(expr.text()).toBe("grault");
			expect(expr.children().is('i')).toBe(true);
		});
		it("stores its expression in its PrintCommand", function() {
			expect('(set: $name to "Dracula")'
				+ '(set: $p to (print: "Count " + $name))'
				+ '(set: $name to "Alucard")'
				+ '$p'
			).markupToPrint("Count Dracula");
		});
		it("will error if an infinite regress is created", function() {
			expect("(set: $x to '$x')(print: $x)").markupToError();
		});
		it("can be altered with attached style changers", function(done) {
			var p = runPassage("(text-rotate: 20)(print: $x)");
			var expr = p.find('tw-expression:last-child');
			setTimeout(function() {
				expect(expr.attr('style')).toMatch(/rotate\(20deg\)/);
				done();
			});
		});
	});
	describe("the (display:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(display:)").markupToError();
			expect("(display: 1)").markupToError();
			expect("(display:'A','B')").markupToError();
		});
		it("when placed in a passage, prints out the markup of another passage", function() {
			createPassage("''Red''", "grault");
			var expr = runPassage("(display: 'grault')").find('tw-expression');

			expect(expr.text()).toBe("Red");
			expect(expr.children().is('b')).toBe(true);
		});
		it("macros in the displayed passage affect the host passage", function() {
			createPassage("(replace:'Big')[Small]", "grault");
			var expr = runPassage("Big(display: 'grault')");

			expect(expr.text()).toBe("Small");
		});
		it("can be printed with (print:)", function() {
			createPassage("Red", "grault");
			expect("(print:(display:'grault'))").markupToPrint("[A (display:) command]");
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (display:'grault') + (display:'grault'))").markupToError();
		});
		it("can be (set:) into a variable", function() {
			createPassage("''Red''", "grault");
			var expr = runPassage("(set: $x to (display:'grault'))$x").find('tw-expression:last-child');

			expect(expr.text()).toBe("Red");
			expect(expr.children().is('b')).toBe(true);
		});
		it("produces an error if the passage doesn't exist", function() {
			expect("(display: 'grault')").markupToError();
		});
		it("will error if an infinite regress is created", function() {
			createPassage("(display: 'grault')", "grault");
			expect("(display: 'grault')").markupToError();
		});
		it("can be altered with attached style changers", function(done) {
			createPassage("''Red''", "grault");
			var p = runPassage("(text-rotate: 20)(display:'grault')");
			var expr = p.find('tw-expression:last-child');
			setTimeout(function() {
				expect(expr.attr('style')).toMatch(/rotate\(20deg\)/);
				done();
			});
		});
	});
	describe("the (go-to:) macro", function() {
		
		function waitForGoto(callback) {
			setTimeout(function f() {
				if($('tw-passage:last-of-type tw-expression[name=go-to]').length > 0) {
					return setTimeout(f, 20);
				}
				callback();
			}, 20);
		}
		
		it("requires exactly 1 string argument", function() {
			expect("(go-to:)").markupToError();
			expect("(go-to: 1)").markupToError();
			expect("(go-to:'A','B')").markupToError();
		});
		it("when placed in a passage, navigates the player to another passage", function(done) {
			createPassage("''Red''", "croak");
			runPassage("(go-to: 'croak')");
			waitForGoto(function() {
				var expr = $('tw-passage:last-child').find('b');
				expect(expr.text()).toBe("Red");
				done();
			});
		});
		it("will count as a new turn in the session history", function(done) {
			createPassage("", "grault");
			runPassage("(go-to: 'grault')","garply");
			waitForGoto(function() {
				expect('(print:(history:))').markupToPrint('garply,grault');
				done();
			});
		});
		it("prevents macros after it from running", function(done) {
			createPassage("", "flunk");
			runPassage("(set:$a to 1)(go-to:'flunk')(set:$a to 2)");
			expect("$a").markupToPrint("1");
			waitForGoto(done);
		});
		it("prevents macros even outside of its home hook", function(done) {
			createPassage("", "flunk");
			runPassage("(set:$a to 1)(if:true)[(go-to:'flunk')](set:$a to 2)");
			expect("$a").markupToPrint("1");
			waitForGoto(done);
		});
		it("does not run until placed in passage text", function() {
			createPassage("''Red''", "croak");
			expect("(print:(go-to: 'croak'))").markupToPrint("[A (go-to:) command]");
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (go-to:'crepax') + (go-to:'crepax'))").markupToError();
		});
		it("can be (set:) into a variable", function(done) {
			createPassage("''Red''", "waldo");
			runPassage("(set: $x to (go-to:'waldo'))$x");
			waitForGoto(function() {
				var expr = $('tw-passage:last-child').find('b');
				expect(expr.text()).toBe("Red");
				done();
			});
		});
		it("produces an error if the passage doesn't exist", function() {
			expect("(go-to: 'freek')").markupToError();
		});
		it("transitions out the preceding <tw-passage> when stretchtext is off", function(done) {
			createPassage("''Red''", "waldo");
			runPassage("(set: $x to (go-to:'waldo'))$x");
			waitForGoto(function() {
				expect($('tw-passage').length).toBe(1);
				done();
			});
		});
	});
	describe("the (dialog:) macro", function() {
		it("requires many string arguments, and an optional bound variable", function() {
			expect("(dialog:)").markupToError();
			expect("(dialog:1)").markupToError();
			expect("(dialog:bind _a)").markupToError();
			expect("(dialog:'e')").not.markupToError();
			expect("(dialog:'e','f')").not.markupToError();
			expect("(dialog:'e','f','g','h','i','j')").not.markupToError();
			expect("(dialog:bind _a, 'e','f','g','h','i','j')").not.markupToError();
			expect("(dialog:bind _a, 'e')").not.markupToError();
		});
		it("is aliased as (alert:)", function() {
			expect("(print: (alert:'a') is (alert:'a'))").not.markupToError();
		});
		it("produces a command which creates a dialog with a backdrop, the given string, and an 'OK' close link", function(done) {
			runPassage("(dialog:'Gooball')");
			expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(1);
			expect($("tw-dialog").contents().first().text()).toBe("Gooball");
			expect($("tw-dialog").find('tw-link').text()).toBe("OK");
			$("tw-dialog").find('tw-link').click();
			setTimeout(function() {
				expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(0);
				done();
			},20);
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (dialog:'a') + (dialog:'b'))").markupToError();
		});
		it("can be (set:) into a variable", function() {
			runPassage("(set: $x to (dialog:'Gooball'))");
			expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(0);
			runPassage("$x");
			expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(1);
		});
		it("changes the links' text if link strings are given", function() {
			runPassage("(dialog:'baz','foo')");
			expect($("tw-dialog tw-link").last().text()).toBe("foo");
		});
		it("errors if a link string is blank", function() {
			expect("(dialog:'baz','')").markupToError();
			expect("(dialog:'baz','foo','','qux')").markupToError();
			expect("(dialog:bind _a, 'baz','foo','')").markupToError();
		});
		it("when given a bound variable, sets the variable to the clicked link text", function(done) {
			runPassage("(dialog:bind $x, 'Foo', 'Bar', 'Baz', 'Qux')");
			$($("tw-dialog").find('tw-link').get(-2)).click();
			setTimeout(function() {
				expect("$x").markupToPrint("Baz");
				done();
			},20);
		});
		it("when given a bound variable, errors if it's restricted to a non-string type", function(done) {
			runPassage("(set:num-type $x to 1)(dialog:bind $x, 'Foo')");
			$("tw-dialog").find('tw-link').click();
			setTimeout(function() {
				expect($("tw-story").find("tw-error:not(.javascript)").length).toBe(1);
				done();
			},20);
		});
		it("can have changers attached", function(done) {
			runPassage("(text-rotate:20)(dialog:'baz','foo')");
			setTimeout(function() {
				expect($('tw-dialog').attr('style')).toMatch(/rotate\(20deg\)/);
				done();
			},20);
		});
	});

	['prompt','confirm'].forEach(function(name, confirm) {
		describe("the (" + name + ":) macro", function() {
			var args = "'Gooball'" + (confirm ? "" : ",'foo'");
			if(confirm) {
				it("requires either 1, 2 or 3 string arguments", function() {
					expect("(confirm:)").markupToError();
					expect("(confirm:1)").markupToError();
					expect("(confirm:'e')").not.markupToError();
					expect("(confirm:'e','f')").not.markupToError();
					expect("(confirm:'e','f','g')").not.markupToError();
					expect("(confirm:'e','f','g','h')").markupToError();
				});
			} else {
				it("requires either 2, 3 or 4 string arguments", function() {
					expect("(prompt:)").markupToError();
					expect("(prompt:1)").markupToError();
					expect("(prompt:'e')").markupToError();
					expect("(prompt:'e','f')").not.markupToError();
					expect("(prompt:'e','f','g')").not.markupToError();
					expect("(prompt:'e','f','g','h')").not.markupToError();
					expect("(prompt:'e','f','g','h','i')").markupToError();
				});
			}
			it("produces a command which creates a dialog with a backdrop, the given string, an 'OK' close link, and a 'Cancel' close link", function(done) {
				runPassage("("+name+":" + args + ")");
				expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(1);
				expect($("tw-dialog").contents().first().text()).toBe("Gooball");
				expect($("tw-dialog tw-link").first().text()).toBe("OK");
				expect($("tw-dialog tw-link").last().text()).toBe("Cancel");
				$("tw-dialog tw-link").click();
				setTimeout(function() {
					expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(0);
					done();
				},20);
			});
			it("changes the links' text if optional strings are given", function() {
				runPassage("("+name+":" + args + ",'foo','bar')");
				expect($("tw-dialog tw-link").first().text()).toBe("bar");
				expect($("tw-dialog tw-link").last().text()).toBe("foo");
			});
			it("errors if the last optional string is blank", function() {
				expect("("+name+":" + args + ",'foo','')").markupToError();
			});
			if(!confirm) {
				it("evaluates to the text area's contents when 'OK' is clicked", function(done) {
					var p = runPassage("(prompt:'','Baz')");
					expect($("tw-dialog input[type=text]").val()).toBe('Baz');
					$("tw-dialog input[type=text]").val('Qux');
					$("tw-dialog tw-link").first().click();
					setTimeout(function() {
						expect(p.text()).toBe("Qux");
						done();
					},20);
				});
			}
			it("blocks control flow execution when the dialog is present", function(done) {
				var p = runPassage("|a>[foo]("+name+":"+args+")(replace:?a)[bar]");
				expect(p.text()).toBe("foo");
				$("tw-backdrop").remove();

				p = runPassage("(set:$foo to (either:("+name+":"+args+"), ("+name+":"+args+")))(set:$qux to 2)");
				$("tw-dialog tw-link").first().click();
				setTimeout(function() {
					$("tw-dialog tw-link").first().click();
					setTimeout(function() {
						expect("(print:$qux)").markupToPrint("2");
						done();
					},60);
				},20);
			});
			it("doesn't block control flow if it errors", function() {
				var p = runPassage("|a>[foo]("+name+":)(replace:?a)[bar]");
				expect(p.find('tw-hook').text()).toBe("foo");
				$("tw-backdrop").remove();
			});
			it("blocks link interaction when the dialog is present", function(done) {
				var p = runPassage("(link:'foo')[bar]("+name+":"+args+")");
				expect(p.text()).toBe("foo");
				p.find('tw-link').click();
				setTimeout(function() {
					expect(p.text()).toBe("foo");

					p = runPassage("foo(click:'foo')[baz]("+name+":"+args+")");
					expect(p.text()).toBe("foo");
					p.find('tw-enchantment').click();
					setTimeout(function() {
						expect(p.text()).toBe("foo");
						done();
					},20);
				},20);
			});
			it("blocks mouseover interaction when the dialog is present", function(done) {
				var p = runPassage("foo(mouseover:'foo')[bar]("+name+":"+args+")");
				expect(p.text()).toBe("foo");
				p.find('tw-link').mouseenter();
				setTimeout(function() {
					expect(p.text()).toBe("foo");
					done();
				},20);
			});
			if(confirm) {
				it("when 'OK' is clicked, evaluates to true", function(done) {
					runPassage("(set:$foo to (confirm:'Gooball'))");
					$("tw-dialog").find('tw-link').first().click();
					setTimeout(function() {
						expect("(print:$foo)").markupToPrint('true');
						done();
					},20);
				});
				it("when 'Cancel' is clicked, evaluates to false", function(done) {
					runPassage("(set:$foo to (confirm:'Gooball'))");
					$("tw-dialog").find('tw-link').last().click();
					setTimeout(function() {
						expect("(print:$foo)").markupToPrint('false');
						done();
					},20);
				});
			}
		});
	});
	describe("the (open-url:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(open-url:)").markupToError();
			expect("(open-url:1)").markupToError();
			expect("(open-url:'e','f')").markupToError();
		});
		it("produces a command which calls window.open and prints nothing", function() {
			spyOn(window,'open');
			var p = runPassage("foo(open-url:'http://example.org')bar");
			expect(p.text()).toBe("foobar");
			expect(window.open).toHaveBeenCalledWith('http://example.org','');
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (alert:'a') + (alert:'b'))").markupToError();
		});
		it("can be (set:) into a variable", function() {
			spyOn(window,'open');
			runPassage("(set: $x to (open-url:'http://example.org'))");
			expect(window.open).not.toHaveBeenCalled();
			runPassage("$x");
			expect(window.open).toHaveBeenCalledWith('http://example.org','');
		});
	});

	describe("the (reload:) macro", function() {
		// window.location.reload cannot be spied on, as it and window.location are non-configurable
		it("takes no arguments", function() {
			expect("(set: $x to (reload:1))").markupToError();
			expect("(set: $x to (reload:'e'))").markupToError();
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (reload:) + (reload:))").markupToError();
		});
		it("can be (set:) into a variable", function() {
			expect("(set: $x to (reload:))").not.markupToError();
		});
		it("can't be used in the first turn", function() {
			clearState();
			expect("(reload:)").markupToError();
		});
	});

	describe("the (goto-url:) macro", function() {
		// window.location.assign cannot be spied on, as it and window.location are non-configurable
		it("requires exactly 1 string argument", function() {
			expect("(set: $x to (goto-url:))").markupToError();
			expect("(set: $x to (goto-url:1))").markupToError();
			expect("(set: $x to (goto-url:'http://example.org','http://example.org'))").markupToError();
			expect("(set: $x to (goto-url:false))").markupToError();
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (goto-url:'http://example.org') + (goto-url:'http://example.org'))").markupToError();
		});
		it("can be (set:) into a variable", function() {
			expect("(set: $x to (goto-url:'http://example.org'))").not.markupToError();
		});
	});
	describe("the (undo:) macro", function() {

		function waitForUndo(callback) {
			setTimeout(function f() {
				if($('tw-passage:last-of-type tw-expression[name=undo]').length > 0) {
					return setTimeout(f, 20);
				}
				callback();
			}, 20);
		}

		it("takes no arguments", function() {
			expect("(set: $x to (undo:1))").markupToError();
			expect("(set: $x to (undo:'e'))").markupToError();
		});
		it("when run, undoes the current turn", function(done) {
			runPassage("(set: $a to 1)","one");
			runPassage("(set: $a to 2)(undo:)","two");
			waitForUndo(function() {
				expect("(print: $a) (print:(history:)'s length)").markupToPrint("1 1");
				done();
			});
		});
		it("errors when run in the first turn", function(){
			clearState();
			expect("(undo:)").markupToError();
		});
		it("prevents macros after it from running", function(done) {
			runPassage("");
			runPassage("(set:$a to 1)(undo:)(set:$a to 2)");
			expect("$a").markupToPrint("1");
			waitForUndo(done);
		});
		it("evaluates to a command object that can't be +'d", function() {
			expect("(print: (undo:) + (undo:))").markupToError();
		});
		it("can be (set:) into a variable", function(done) {
			runPassage("''Red''","one");
			runPassage("(set: $x to (undo:))$x");
			waitForUndo(function() {
				var expr = $('tw-passage:last-child').find('b');
				expect(expr.text()).toBe("Red");
				done();
			});
		});
	});
});
