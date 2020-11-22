describe("interface macros", function(){
	'use strict';
	["cycling-link","seq-link"].forEach(function(name, seq) {
		describe("the ("+name+":) macro", function(){
			it("accepts one optional bound variable, and two or more strings", function() {
				expect("(print:("+name+":))").markupToError();
				expect("(print:("+name+":''))").markupToError();
				expect("(print:("+name+":'baz'))").markupToError();
				expect("(print:("+name+":2))").markupToError();
				expect("(print:("+name+":false))").markupToError();
				expect("(print:("+name+":bind $foo))").markupToError();
				expect("(print:("+name+":'baz', 'baz'))").not.markupToError();
				expect("(print:("+name+":'baz', 'baz', 'qux'))").not.markupToError();
				expect("(print:("+name+":bind $foo, 'baz'))").markupToError();
				expect("(print:("+name+":bind $foo, 'baz', 'qux'))").not.markupToError();
			});
			if (seq) {
				it("when clicked, it cycles to the next string, eventually becoming plain text", function() {
					var p = runPassage("("+name+":'bar','baz','qux')");
					expect(p.find('tw-link').text()).toBe('bar');
					p.find('tw-link').click();
					expect(p.find('tw-link').text()).toBe('baz');
					p.find('tw-link').click();
					expect(p.find('tw-link').length).toBe(0);
					expect(p.text()).toBe('qux');
					p.click();
					expect(p.text()).toBe('qux');
				});
			}
			else {
				it("when clicked, it cycles to the next string and remains clickable", function() {
					var p = runPassage("("+name+":'bar','baz','qux')");
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
			}
			it("works with (transition:)", function() {
				runPassage("foo","foo");
				var p = runPassage("(t8n:'slideleft')("+name+":'bar','baz','qux')");
				expect(p.find('tw-link').text()).toBe('bar');
				p.find('tw-link').click();
				expect(p.find('tw-transition-container[data-t8n="slideleft"]').length).toBe(1);
			});
			it("works with string enchantment", function(done) {
				var p = runPassage("("+name+":'foobar','bazfoo','fooqux')(enchant:'foo',(background:white))");
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
				var p = runPassage("("+name+":bind $bar,'foobar','bazfoo','fooqux')(replace:'foo')[qux]");
				setTimeout(function() {
					expect(p.find('tw-link').text()).toBe('quxbar');
					expect("$bar").markupToPrint('foobar');
					p = runPassage("("+name+":bind $bar,'foobar','bazfoo','fooqux')(replace:'foo')[qux]");
					p.find('tw-link').click();
					setTimeout(function() {
						expect(p.find('tw-link').text()).toBe('bazfoo');
						expect("$bar").markupToPrint('bazfoo');
						done();
					}, 20);
				}, 20);
			});
			it("executes each label every time it appears", function() {
				var p = runPassage("(set:$foo to 'bar')("+name+":'(print:$foo)','(set:$foo to \"baz\")qux')");
				expect(p.text()).toBe('bar');
				p.find('tw-link').click();
				expect(p.text()).toBe('qux');
				if (!seq) {
					p.find('tw-link').click();
					expect(p.text()).toBe('baz');
				}
			});
			it("can't begin with an empty string", function() {
				expect("("+name+":'','baz')").markupToError();
			});
			it("upon reaching an empty string, the link disappears", function() {
				var p = runPassage("("+name+":'bar','baz','')");
				expect(p.find('tw-link').text()).toBe('bar');
				p.find('tw-link').click();
				expect(p.find('tw-link').text()).toBe('baz');
				p.find('tw-link').click();
				expect(p.find('tw-link').length).toBe(0);
			});
			it("will be replaced with markup error messages if they're encountered", function() {
				var p = runPassage("("+name+":'bar','(print: 2 + true)')");
				expect(p.find('tw-link').text()).toBe('bar');
				p.find('tw-link').click();
				expect(p.find('tw-error').length).toBe(1);
			});
			describe("when given a bound variable", function() {
				it("when clicked, sets the variable to the string label", function() {
					var p = runPassage("("+name+": bind $foo, 'bar','baz', 'qux')");
					expect("$foo").markupToPrint('bar');

					p = runPassage("("+name+": bind $foo, 'bar','baz', 'qux')");
					p.find('tw-link').click();
					expect("$foo").markupToPrint('baz');

					p = runPassage("("+name+": bind $foo, 'bar','baz', 'qux')");
					// It's a different <tw-link> each time.
					p.find('tw-link').click();
					p.find('tw-link').click();
					expect("$foo").markupToPrint('qux');

					if (!seq) {
						p = runPassage("("+name+": bind $foo, 'bar','baz', 'qux')");
						p.find('tw-link').click();
						p.find('tw-link').click();
						p.find('tw-link').click();
						expect("$foo").markupToPrint('bar');
					}
				});
				it("works with temp variables", function(done) {
					var p = runPassage("("+name+": bind _foo, 'bar', 'baz', 'qux')(event: when _foo is 'qux')[quux]");
					p.find('tw-link').click();
					p.find('tw-link').click();
					setTimeout(function(){
						expect(p.text()).toBe("quxquux");
						done();
					},20);
				});
				it("respects typed variables", function(done) {
					runPassage("(set: num-type $foo to 1)(set:_bar to 'qux')");
					expect("("+name+": bind $foo, 'bar', 'baz', 'qux')").markupToError();

					var p = runPassage("("+name+": bind $foo, 'bar', 'baz', 'qux')(set: num-type $foo to 1)");
					p.find('tw-link').click();
					setTimeout(function(){
						expect(p.find('tw-error:not(.javascript)').length).toBe(1);
						done();
					},20);
				});
				it("works when saved in another passage", function() {
					runPassage("(set:_bar to 'qux')(set:$foo to ("+name+":'_bar','foo'))");
					expect('(set:_bar to "baz")$foo').markupToPrint("baz");
				});
				describe("if it's a two-way bind", function() {
					it("rotates to match the variable if it matches a label", function(done) {
						var p = runPassage("(set:$foo to 'baz')("+name+": 2bind $foo, 'bar','baz', 'qux')");
						expect(p.text()).toBe('baz');
						p.find('tw-link').click();
						setTimeout(function(){
							expect(p.text()).toBe("qux");
							expect("$foo").markupToPrint("qux");
							done();
						},20);
					});
					it("updates whenever the variable changes", function(done) {
						var p = runPassage("(set:$foo to 'baz')("+name+": 2bind $foo, 'bar','baz', 'qux')(link:'X')[(set:$foo to 'bar')]");
						expect(p.find('tw-expression[name='+name+'] tw-link').text()).toBe('baz');
						p.find('tw-hook tw-link').click();
						setTimeout(function(){
							expect(p.find('tw-expression[name='+name+'] tw-link').text()).toBe("bar");
							done();
						},20);
					});
				});
				it("errors if the bind is invalid", function() {
					expect("(set:$foo to 1)("+name+": bind $foo's 1st, 'bar','baz', 'qux')").markupToError();
				});
				it("errors if the bind is no longer valid when it cycles", function() {
					var p = runPassage("(set:$foo to (a:))("+name+": bind $foo's 1st, 'bar','baz','qux')(set:$foo to 2)");
					p.find('tw-link').click();
					expect(p.find('tw-error').length).toBe(1);

					p = runPassage("(set:$foo to (dm:'garply',2))("+name+": bind $foo's 'garply', 'bar','baz','qux')(set:$foo to (a:))");
					p.find('tw-link').click();
					expect(p.find('tw-error').length).toBe(1);

					// The error message for this one, while existent, is extremely poor.
					p = runPassage("(set:$foo to (a:))("+name+": bind $foo's 1st, 'bar','baz','qux')(set:$foo to (dm:'garply',2))");
					p.find('tw-link').click();
					expect(p.find('tw-error').length).toBe(1);

					p = runPassage("(set:$foo to (a:(a:)))("+name+": bind $foo's 1st's 1st, 'bar','baz','qux')(set:$foo's 1st to (dm:'garply',2))");
					p.find('tw-link').click();
					expect(p.find('tw-error').length).toBe(1);
				});
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
		it("labels can't contain raw HTML", function() {
			expect("(dropdown: bind $foo, '<b></b></option>', 'foo')").markupToPrint("<b></b></option>foo");
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
		describe("when given a two-way bind", function() {
			it("rotates to match the variable", function(done) {
				var p = runPassage("(set:$foo to 'qux')(dropdown: 2bind $foo, 'bar','baz', 'qux')");
				expect(p.find('select').val()).toBe('qux');
				p.find('select').val('baz').change();
				setTimeout(function(){
					expect(p.find('select').val()).toBe("baz");
					expect("$foo").markupToPrint("baz");
					done();
				},20);
			});
			it("updates whenever the variable changes", function(done) {
				var p = runPassage("(set:$foo to 'baz')(dropdown: 2bind $foo, 'bar','baz', 'qux')(link:'X')[(set:$foo to 'bar')]");
				expect(p.find('select').val()).toBe('baz');
				p.find('tw-hook tw-link').click();
				setTimeout(function(){
					expect(p.find('select').val()).toBe("bar");
					done();
				},20);
			});
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
	["input-box","force-input-box"].forEach(function(name, force) {
		describe("the ("+name+":) macro", function() {
			if (!force) {
				it("accepts a sizing string, plus three optional values", function() {
					expect("("+name+":'XX==')").not.markupToError();
					expect("("+name+":bind _a,'XX==')").not.markupToError();
					expect("("+name+":'XX==',2)").not.markupToError();
					expect("("+name+":'XX==','Foo')").not.markupToError();
					expect("("+name+":bind _a,'XX==',2)").not.markupToError();
					expect("("+name+":bind _a,'XX==','Foo')").not.markupToError();
					expect("("+name+":bind _a,'XX==',2,'Foo')").not.markupToError();

					expect("("+name+":'Foo')").markupToError();
					expect("("+name+":bind _a, 'Foo')").markupToError();
					expect("("+name+":'XX==',2,2)").markupToError();
					expect("("+name+":'XX==','Foo','Bar')").markupToError();
					expect("("+name+":'XX==','Foo',2)").markupToError();
					expect("("+name+":bind _a,'XX==',2,2)").markupToError();
					expect("("+name+":bind _a,'XX==','Foo','Bar')").markupToError();
					expect("("+name+":bind _a)").markupToError();
					expect("("+name+":bind _a, 2)").markupToError();
					expect("("+name+":bind _a, 2,2)").markupToError();
				});
			}
			else {
				it("accepts a sizing string and text, plus an optional height number between", function() {
					expect("("+name+":'XX==')").markupToError();
					expect("("+name+":'Foo')").markupToError();
					expect("("+name+":bind _a,'XX==')").markupToError();
					expect("("+name+":'XX==',2)").markupToError();

					expect("("+name+":'XX==','Foo')").not.markupToError();
					expect("("+name+":'XX==',2,'Foo')").not.markupToError();
				});
			}
			it("errors if the height string isn't a positive integer", function() {
				expect("("+name+":bind _a,'X',2.1)").markupToError();
				expect("("+name+":bind _a,'X',0)").markupToError();
				expect("("+name+":bind _a,'X',-2)").markupToError();
			});
			it("creates a <textarea> element", function() {
				var p = runPassage("("+name+":\"XXX===\",3,'Foo')");
				expect(p.find('textarea').length).toBe(1);
			});
			if (!force) {
				it("fills the <textarea> with the given initial text", function() {
					var p = runPassage("("+name+":\"XXX===\",3,'Foo')");
					expect(p.find('textarea').val()).toBe("Foo");
				});
			}
			it("gives the hook the specified margins, width, and rows (if given), as well as display:block", function() {
				[
					['=XX=', 25, 50, 4],
					['X===', 0, 25, 1],
					['X===', 0, 25, ''],
					['==XXXXXXXX', 20, 80, 3],
				].forEach(function(a) {
					var code = a[0], marginLeft=a[1], width=a[2], height=a[3];

					var t = runPassage("("+name+":'" + code + "', " + height + ",'Foo')[]").find('textarea');
					var s = t.attr('style');
					expect(s).toMatch(RegExp("margin-left:\\s*"+marginLeft+"%"));
					expect(s).toMatch(RegExp("\\bwidth:\\s*"+width+"%"));
					if (!height) {
						expect(t.attr('rows')).not.toBe(height+'');
					}
					else {
						expect(t.attr('rows')).toBe(height+'');
					}
					expect(t.parent().attr('style')).toMatch(/display:\s*block/);
				});
			});
			if (!force) {
				it("if bound, sets the bound variable when the <textarea> is edited", function() {
					['bind','2bind'].forEach(function(e) {
						var t = runPassage("("+name+":"+e+" $foo, \"XXX===\",3,'Foo')").find('textarea');
						t.val('Bar').trigger('input');
						expect("$foo").markupToPrint("Bar");
						runPassage("(set:$foo to '')");
					});
				});
				it("errors if the bound variable can't contain booleans", function() {
					var p = runPassage('(set:num-type $foo to 2)('+name+':bind $foo,"XX=")');
					p.find('textarea').val('Bar').trigger('input');
					expect(p.find('tw-error:not(.javascript)').length).toBe(1);
				});
				it("if one-way-bound, sets the bound variable on entry", function() {
					runPassage("("+name+":bind $foo, \"XXX===\",3,'Foo')");
					expect("$foo").markupToPrint("Foo");
				});
				it("if two-way-bound, updates the <textarea> on entry", function() {
					runPassage("(set:$foo to 'Baz')");
					var t = runPassage("("+name+":2bind $foo, \"XXX===\",3,'Foo')").find('textarea');
					expect(t.val()).toBe('Baz');
				});
				it("if two-way-bound, updates the <textarea> when the variable updates", function(done) {
					var p = runPassage("("+name+":2bind $foo, \"XXX===\",3,'Foo')(link:'X')[(set:$foo to 'Baz')]");
					p.find('tw-hook tw-link').click();
					setTimeout(function(){
						expect(p.find('textarea').val()).toBe("Baz");
						done();
					},20);
				});
			}
			else {
				it("when text is input, its characters are changed to those of the provided string", function() {
					var t = runPassage("("+name+":bind $foo, \"XXX===\",3,'quxquuxcorge')").find('textarea');
					expect(t.val('foobar').trigger('input').val()).toBe('quxquu');
				});
				it("if one-way-bound, sets the bound variable when the <textarea> is edited", function() {
					var t = runPassage("("+name+":bind $foo, \"XXX===\",3,'quxquuxcorge')").find('textarea');
					t.val('Foo').trigger('input');
					expect("$foo").markupToPrint("qux");
				});
				it("if two-way-bound, updates the <textarea> and variable on entry", function() {
					runPassage("(set:$foo to 'Baz')");
					var t = runPassage("("+name+":2bind $foo, \"XXX===\",3,'quxquuxcorge')").find('textarea');
					expect(t.val()).toBe('qux');
					expect("$foo").markupToPrint("qux");
				});
				it("if two-way-bound, updates the <textarea> when the variable updates", function(done) {
					var p = runPassage("("+name+":2bind $foo, \"XXX===\",3,'quxquuxcorge')(link:'X')[(set:$foo to 'Baz')]");
					p.find('tw-hook tw-link').click();
					setTimeout(function(){
						expect(p.find('textarea').val()).toBe("qux");
						done();
					},20);
				});
			}
		});
	});
	[["Undo","↶"],["Redo","↷"],["Fullscreen","⛶"],["Reload","⟲"]].forEach(function(a) {
		var name = a[0], symbol = a[1];
		describe("the (icon-" + name.toLowerCase() + ":) macro", function() {
			it("accepts an optional one-character-long string, and an optional 2+ character-long string", function() {
				expect('(icon-' + name + ':)').not.markupToError();
				expect('(icon-' + name + ':"R")').not.markupToError();
				expect('(icon-' + name + ':"🀄")').not.markupToError();
				expect('(icon-' + name + ':"R","S")').markupToError();
				expect('(icon-' + name + ':2)').markupToError();

				expect('(icon-' + name + ':"R","Red")').not.markupToError();
				expect('(icon-' + name + ':"Red")').not.markupToError();
				expect('(icon-' + name + ':"Red","R")').not.markupToError();
			});
			it("creates a <tw-icon>", function() {
				expect(runPassage('(icon-' + name + ':)').find('tw-icon').length).toBe(1);
			});
			it("uses a certain default symbol", function() {
				expect(runPassage('(icon-' + name + ':)').find('tw-icon').text()).toBe(symbol);
			});
			it("uses the passed-in symbol, if given", function() {
				expect(runPassage('(icon-' + name + ':"R")').find('tw-icon').text()).toBe("R");
			});
			it("attaches a [data-label] attribute if a string with 2+ characters was given", function() {
				expect(runPassage('(icon-' + name + ':"garply")').find('tw-icon').attr('data-label')).toBe("garply");
				expect(runPassage('(icon-' + name + ':"garp\\\"ly")').find('tw-icon').attr('data-label')).toBe("garp\"ly");
				expect(runPassage('(icon-' + name + ':"**garply**")').find('tw-icon').attr('data-label')).toBe("**garply**");
			});
			it("does both if both strings are given", function() {
				var p = runPassage('(icon-' + name + ':"X","garply")');
				expect(p.find('tw-icon').attr('data-label')).toBe("garply");
				expect(p.find('tw-icon').text()).toBe("X");
				p = runPassage('(icon-' + name + ':"garply","X")');
				expect(p.find('tw-icon').attr('data-label')).toBe("garply");
				expect(p.find('tw-icon').text()).toBe("X");
			});
			it("works with (link:)", function() {
				expect('(link:"Hey")(icon-' + name + ':)').not.markupToError();
			});
			//TODO: Click tests
		});
	});
	describe("the (icon-counter:) macro", function() {
		it("accepts a bound numeric variable, a string label, and an optional other string", function() {
			expect('(icon-counter: "x")').markupToError();
			expect('(set:$x to 1)(icon-counter: bind $x)').markupToError();
			expect('(icon-counter: bind $x, "Y")').not.markupToError();
			expect('(set:$x to true)(icon-counter: bind $x, "Y")').markupToError();
			expect('(set:$x to 1)(icon-counter: bind $x, "Y","Z")').not.markupToError();
		});
		it("creates a <tw-icon> with a [data-label] attribute matching the passed-in string", function() {
			expect(runPassage('(set:$qux to 1)(icon-counter: bind $qux, "**garply**")').find('tw-icon[data-label="**garply**"]').length).toBe(1);
		});
		it("displays the text of the bound number variable, truncated", function() {
			expect(runPassage('(set:$foo to 51)(icon-counter:bind $foo,"baz")').find('tw-icon').text()).toBe("51");
			expect(runPassage('(set:$foo to 14.9)(icon-counter:bind $foo,"baz")').find('tw-icon').text()).toBe("14");
			expect(runPassage('(set:$foo to -91.1)(icon-counter:bind $foo,"baz")').find('tw-icon').text()).toBe("-91");
		});
		it("updates the text when the variable updates", function() {
			var p = runPassage('(set:$foo to 24)(icon-counter:bind $foo,"baz")(link:"X")[(set:$foo to 41)]');
			expect(p.find('tw-icon').text()).toBe("24");
			p.find('tw-link').click();
			expect(p.find('tw-icon').text()).toBe("41");
		});
		it("uses the optional string as the label when the bound variable is not 1 or -1", function() {
			var p = runPassage('(set:$foo to 24)(icon-counter:bind $foo,"baz","qux")(link:"X")[(set:$foo to 1)]');
			expect(p.find('tw-icon').attr('data-label')).toBe("qux");
			p.find('tw-link').click();
			expect(p.find('tw-icon').attr('data-label')).toBe("baz");
		});
		it("the <tw-icon> has opacity 1 by default", function() {
			expect(runPassage('(set:$qux to 1)(icon-counter: bind $qux, "**garply**")').find('tw-icon').css('opacity')).toBe('1');
		});
	});
	describe("the (checkbox:) macro", function() {
		it("accepts a bound boolean variable, and a string label", function() {
			expect('(checkbox: "x")').markupToError();
			expect('(set:$x to true)(checkbox: bind $x)').markupToError();
			expect('(checkbox: bind $x, "Y")').not.markupToError();
			expect('(set:$x to true)(checkbox: bind $x, "Y")').not.markupToError();
		});
		it("creates an <input> with a <label> with matching 'for' and 'id' attributes", function() {
			var p = runPassage('(checkbox:bind $foo, "bar")');
			expect(p.find('input[type=checkbox]').attr('id')).toBe(p.find('input[type=checkbox] + label').attr('for'));
		});
		it("when clicked, updates the bound variable", function() {
			var p = runPassage('(checkbox:bind $foo, "bar")');
			p.find('input').click();
			expect("(print:$foo)").markupToPrint("true");
			// The variable state resets to false if it isn't 2bind
			p = runPassage('(checkbox:bind $foo, "bar")');
			p.find('input').click();
			expect("(print:$foo)").markupToPrint("true");
		});
		it("errors if the bound variable can't contain booleans", function() {
			var p = runPassage('(set:num-type $foo to 2)(checkbox:bind $foo,"baz")');
			p.find('input[type=checkbox]').trigger('input');
			expect(p.find('tw-error:not(.javascript)').length).toBe(1);
		});
		it("if two-way bound, updates the checked state when the variable updates", function() {
			var p = runPassage('(set:$foo to true)(checkbox:2bind $foo,"baz")(link:"X")[(set:$foo to false)]');
			expect(p.find('input:checked').length).toBe(1);
			p.find('tw-link').click();
			expect(p.find('input:checked').length).toBe(0);
		});
	});
	describe("the (meter:) macro", function() {
		it("accepts a bound number variable, a positive number, a sizing string, an optional string label, and an optional colour or gradient", function() {
			expect("(meter:)").markupToError();
			expect("(meter: bind $foo)").markupToError();
			expect("(meter: bind $foo, 10)").markupToError();
			expect("(meter: bind $foo, '=X')").markupToError();
			expect("(meter: bind $foo, 10, '=X')").not.markupToError();
			expect("(meter: bind $foo, 10, '=X', 'Yo')").not.markupToError();
			expect("(meter: bind $foo, 10, '=X', red)").not.markupToError();
			expect("(meter: bind $foo, 10, '=X', (gradient:90,0,red,1,white))").not.markupToError();
			expect("(meter: bind $foo, 10, '=X', 'Yo', red)").not.markupToError();
			expect("(meter: bind $foo, -1, '=X', 'Yo', red)").markupToError();
		});
		it("creates a <tw-meter> with a background-size relative to the bound variable's value", function() {
			var p = runPassage("(set:$foo to 10)(meter: bind $foo, 100, '=X', 'Yo')");
			expect(p.find('tw-meter').css('background-size')).toBe('10%');
			p = runPassage("(set:$foo to 10)(meter: bind $foo, 200, '=X', 'Yo')");
			expect(p.find('tw-meter').css('background-size')).toBe('5%');
		});
		it("uses the given gradient or colour for the bar, ignoring the angle", function() {
			var p = runPassage("(set:$foo to 100)(meter: bind $foo, 100, '=X', (gradient:45,0,#ab1212,1,#ac6060))");
			expect(p.find('tw-meter')).toHaveBackgroundGradient(270, [
				{stop:0,colour:"#AB1212"},
				{stop:1,colour:"#AC6060"},
			]);
			p = runPassage("(set:$foo to 100)(meter: bind $foo, 100, 'X=', (gradient:45,0,white,1,black))");
			expect(p.find('tw-meter')).toHaveBackgroundGradient(90, [
				{stop:0,colour:"#FFFFFF"},
				{stop:1,colour:"#000000"},
			]);
			p = runPassage("(set:$foo to 100)(meter: bind $foo, 100, 'X=', #FADABC)");
			expect(p.find('tw-meter')).toHaveBackgroundGradient(90, [
				{stop:0,colour:"#FADABC"},
				{stop:1,colour:"#FADABC"},
			]);
		});
		it("scales the gradient based on how much of the bar is remaining", function() {
			var p = runPassage("(set:$foo to 50)(meter: bind $foo, 100, '=X', (gradient:45,0,#ab1212,1,#ac6060))");
			expect(p.find('tw-meter')).toHaveBackgroundGradient(270, [
				{stop:0,colour:"#AB1212"},
				{stop:2,colour:"#AC6060"},
			]);
		});
		/*
			TODO: center meter tests
		*/
		it("updates the bar when the variable updates", function() {
			var p = runPassage("(set:$foo to 10)(meter: bind $foo, 100, '=X', 'Yo')(link:'baz')[(set:$foo to 90)]");
			expect(p.find('tw-meter').css('background-size')).toBe('10%');
			p.find('tw-link').click();
			expect(p.find('tw-meter').css('background-size')).toBe('90%');
		});
		it("updates the text when the variable updates", function() {
			var p = runPassage("(set:$foo to 10)(meter: bind $foo, 100, '=X', 'FOO: $foo')(link:'baz')[(set:$foo to 90)]");
			expect(p.find('tw-meter').text()).toBe('FOO: 10');
			p.find('tw-link').click();
			expect(p.find('tw-meter').text()).toBe('FOO: 90');
		});
		it("gives the <tw-expression> the specified margins, width, and rows (if given), as well as display:block", function() {
			[
				['=XX=', 25, 50],
				['X===', 0, 25],
				['X===', 0, 25],
				['==XXXXXXXX', 20, 80],
			].forEach(function(a) {
				var code = a[0], marginLeft=a[1], width=a[2];

				var t = runPassage("(meter: bind $foo, 7, '" + code + "')").find('tw-expression[name=meter]');
				var s = t.attr('style');
				expect(s).toMatch(RegExp("margin-left:\\s*"+marginLeft+"%"));
				expect(s).toMatch(RegExp("\\bwidth:\\s*"+width+"%"));
				expect(s).toMatch(/display:\s*block/);
			});
		});
		it("aligns the text with the meter's alignment", function() {
			var p = runPassage("(set:$foo to 10)(meter: bind $foo, 100, '==X', 'Yo')");
			expect(p.find('tw-meter').css('text-align')).toBe('right');
			p = runPassage("(meter: bind $foo, 100, '=X==', 'Yo')");
			expect(p.find('tw-meter').css('text-align')).toBe('center');
		});
	});
});
