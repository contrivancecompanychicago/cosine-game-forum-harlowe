describe("revision macros", function() {
	'use strict';
	['append','prepend'].forEach(function(name,index) {
		var append=!index;
		describe("("+name+":)", function() {
			it("accepts either 1 hookset or 1 string", function() {
				expect("(print:("+name+":?foo))").not.markupToError();
				expect("(print:("+name+":'baz'))").not.markupToError();

				expect("(print:("+name+":?foo, ?bar))").markupToError();
				expect("(print:("+name+":?foo, 'baz'))").markupToError();
				expect("(print:("+name+":'baz', 'baz'))").markupToError();
			});
			describe("given a single hook", function() {
				it(name+"s the attached hook's contents with that of the target hook", function() {
					var p = runPassage("[cool]<foo|("+name+":?foo)[hot]");
					expect(p.find('tw-hook[name=foo]').length).toBe(1);
					expect(p.text()).toBe(append?'coolhot':'hotcool');
				});
				xit("does not require the target hook to occur earlier than it", function() {
					var p = runPassage("("+name+":?foo)[hot][cool]<foo|");
					expect(p.find('tw-hook[name=foo]').length).toBe(1);
					expect(p.text()).toBe(append?'coolhot':'hotcool');
				});
				it("sequential "+name+"s occur in order", function() {
					var p = runPassage("[1]<foo|("+name+":?foo)[2]("+name+":?foo)[3]");
					expect(p.text()).toBe(append?'123':'321');
				});
				it("nested "+name+"s are triggered one by one", function() {
					var p = runPassage("[1]<foo|("+name+":?foo)[2("+name+":?foo)[3]]("+name+":?foo)[4]");
					expect(p.text()).toBe(append?'1234':'4321');
				});
				it("can be composed with other ("+name+":)s", function() {
					var p = runPassage("(set:$s to ("+name+":?foo) + ("+name+":?bar))|foo>[1][2]<bar|$s[0]");
					expect(p.text()).toBe(append?'1020':'0102');
				});
				xit("when stored, can work across passages", function() {
					runPassage("(set:$s to ("+name+":?bar))");
					var p = runPassage("[2]<bar|$s[0]");
					expect(p.text()).toBe(append?'20':'02');
				});
			});
			describe("given multiple same-named hooks", function() {
				it(name+"s to each selected hook", function() {
					var p = runPassage("[bu]<foo|[los]<foo|("+name+":?foo)[s]");
					expect(p.find('tw-hook[name=foo]').length).toBe(2);
					expect(p.text()).toBe(append?'busloss':'sbuslos');
				});
				it("recomputes the source within each target", function() {
					var p = runPassage("(set:$a to 0)|foo>[A][B]<foo|[C]<foo|("+name+":?foo)[(set:$a to it + 1)$a]");
					expect(p.text()).toBe(append?'A1B2C3':'1A2B3C');
				});
			});
			describe("given a string", function() {
				it(name+"s to every found string in the passage", function() {
					var p = runPassage("good good("+name+":'good')[lands]");
					expect(p.text()).toBe(append?'goodlands goodlands':'landsgood landsgood');
				});
				it("only affects occurrences in a single pass", function() {
					var p = runPassage("reded("+name+":'red')[ r]");
					expect(p.text()).toBe(append?'red red':' rreded');
				});
				it("affects occurrences after the macro instance", function() {
					var p = runPassage("("+name+":'red')[blue]red");
					expect(p.text()).toBe(append?'redblue':'bluered');
				});
				it("sequential "+name+"s occur one by one", function() {
					var p = runPassage("red("+name+":'red')[blue]("+name+": 'blue')[green]");
					expect(p.text()).toBe(append?'redbluegreen':'greenbluered');
				});
				it("can be composed with other ("+name+":)s", function() {
					runPassage("(set:$s to ("+name+":'1') + ("+name+":'2'))");
					var p = runPassage("12$s[0]");
					expect(p.text()).toBe(append?'1020':'0102');
				});
			});
		});
	});
	describe("(replace:)", function() {
		it("accepts either 1 hookset or 1 string", function() {
			expect("(print:(replace:?foo))").not.markupToError();
			expect("(print:(replace:'baz'))").not.markupToError();

			expect("(print:(replace:?foo, ?bar))").markupToError();
			expect("(print:(replace:?foo, 'baz'))").markupToError();
			expect("(print:(replace:'baz', 'baz'))").markupToError();
		});
		describe("given a single hook", function() {
			it("replaces the attached hook's contents with that of the target hook", function() {
				var p = runPassage("[cool]<foo|(replace:?foo)[hot]");
				expect(p.find('tw-hook[name=foo]').length).toBe(1);
				expect(p.text()).toBe('hot');
			});
			it("does not require the target hook to occur earlier than it #broken", function() {
				var p = runPassage("(replace:?foo)[hot][cool]<foo|");
				expect(p.find('tw-hook[name=foo]').length).toBe(1);
				expect(p.text()).toBe('hotcool'); // ????
			});
			it("sequential replacements occur in order", function() {
				var p = runPassage("[1]<foo|(replace:?foo)[2](replace:?foo)[3]");
				expect(p.text()).toBe('3');
			});
			it("nested replacements are triggered one by one", function() {
				var p = runPassage("[1]<foo|(replace:?foo)[2(replace:?foo)[3]](replace:?foo)[4]");
				expect(p.text()).toBe('4');
			});
		});
		describe("given multiple hooks", function() {
			it("replaces each selected hook", function() {
				var p = runPassage("[a]<foo|[b]<foo|(replace:?foo)[c]");
				expect(p.find('tw-hook[name=foo]').length).toBe(2);
				expect(p.text()).toBe('cc');
			});
			it("recomputes the source within each target", function() {
				var p = runPassage("(set:$a to 0)|foo>[A][B]<foo|[C]<foo|(replace:?foo)[(set:$a to it + 1)$a]");
				expect(p.text()).toBe('123');
			});
		});
		describe("given strings", function() {
			it("replaces every found string in the passage", function() {
				var p = runPassage("goodlands goodminton(replace:'good')[bad]");
				expect(p.text()).toBe('badlands badminton');
			});
			it("only affects occurrences in a single pass", function() {
				var p = runPassage("reded(replace:'red')[blue r]");
				expect(p.text()).toBe('blue red');
			});
			it("sequential replacements occur one by one", function() {
				var p = runPassage("red(replace:'red')[blue](replace: 'blue')[green]");
				expect(p.text()).toBe('green');
			});
			it("affects occurrences after the macro instance", function() {
				var p = runPassage("(replace:'red')[blue]red");
				expect(p.text()).toBe('blue');
			});
		});
	});
	xit("can be composed with each other", function() {
		runPassage("(set:$s to (append:'1') + (prepend:'2'))");
		var p = runPassage("12$s[0]");
		expect(p.text()).toBe('1002');
	});
});
