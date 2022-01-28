describe("save macros", function() {
	'use strict';
	
	function retrieveStoredState(itemName) {
		var storedItem = localStorage.getItem(itemName);
		
		expect(function() {
			storedItem = JSON.parse(storedItem);
		}).not.toThrow();
		expect(storedItem).not.toBe(null);
		return storedItem;
	}
	/*
		This should be identical to the internal function in macrolib/commands.js
	*/
	function storagePrefix(text) {
		return "(" + text + " " + Engine.options.ifid + ") ";
	}

	describe("the (savegame:) macro", function() {
		it("accepts 1 or 2 strings", function() {
			expect("(savegame:'1')").not.markupToError();
			expect("(savegame:'1','A')").not.markupToError();
			expect("(savegame:)").markupToError();
			expect("(savegame:2)").markupToError();
			expect("(savegame:true)").markupToError();
			expect("(savegame:'1','1','1')").markupToError();
		});
		it("saves the game in localStorage in JSON format", function() {
			runPassage("(set:$foo to 1)", "corge");
			expect("(savegame:'1','Filename')").not.markupToError();
			
			retrieveStoredState(storagePrefix('Saved Game') + "1");
		});
		it("can save collection variables", function() {
			runPassage(
				"(set:$arr to (a:2,4))" +
				"(set:$dm to (datamap:'HP',4))" +
				"(set:$ds to (dataset:2,4))",
				"corge"
			);
			expect("(savegame:'1')").not.markupToError();
		});
		it("can save changer command variables", function() {
			runPassage(
				"(set:$c1 to (font:'Skia'))" +
				"(set:$c2 to $c1 + (align:'==>'))" +
				"(set:$c3 to (a:$c2 + (if: true)))",
				"corge"
			);
			expect("(savegame:'1')").not.markupToError();
			runPassage(
				"(set:$c4 to (hover-style:(font:'Skia')))" +
				"(set:$c5 to $c4 + (align:'==>'))",
				"grault"
			);
			expect("(savegame:'1')").not.markupToError();
		});
		it("can save gradients", function() {
			runPassage("(set:$c1 to (gradient:90,0,white,1,black))");
			expect("(savegame:'1')").not.markupToError();
		});
		it("can save code hooks", function() {
			runPassage("(set:$c1 to [ABCDEFG])");
			expect("(savegame:'1')").not.markupToError();
		});
		it("can save custom macros", function() {
			runPassage(
				"(if:true)[(set:$c1 to (macro: num-type _a, num-type _b, [(output-data:(max:_a,_b,200))]))]"
			);
			expect("(savegame:'1')").not.markupToError();
		});
		it("works from the start of the game", function() {
			expect("(savegame:'1','Filename')", "qux").not.markupToError();
			
			retrieveStoredState(storagePrefix('Saved Game') + "1");
		});
		it("stores lots of data", function() {
			runPassage("(set:" + Array(5000).join().split(',').map(function(_, e) {
				return "$V" + e + " to " + e;
			}) + ")");
			expect("(savegame:'1','Filename')").not.markupToError();
			
			retrieveStoredState(storagePrefix('Saved Game') + "1");
		});
		it("stores lots of passages", function() {
			for(var i = 0; i < 5000; i += 1) {
				runPassage('', 'foo' + i);
			}
			expect("(savegame:'1','Filename')").not.markupToError();
			
			retrieveStoredState(storagePrefix('Saved Game') + "1");
		});
		it("stores the save file's name", function() {
			runPassage("(set:$foo to 1)", "corge");
			expect("(savegame:'1','Quux')").not.markupToError();
			
			var storedItem = localStorage.getItem(storagePrefix('Saved Game Filename') + "1");
			expect(storedItem).toBe("Quux");
		});
		it("alters the (savedgames:) datamap", function() {
			expect("(print: (savedgames:) contains 'A')").markupToPrint('false');
			expect("(savegame:'A','Filename')").not.markupToError();
			expect("(print: (savedgames:)'s A)").markupToPrint('Filename');
		});
	});
	describe("the (loadgame:) macro", function() {
		it("accepts 1 string", function() {
			runPassage("(savegame:'1','Filename')");
			expect("(loadgame:)").markupToError();
			expect("(loadgame:2)").markupToError();
			expect("(loadgame:true)").markupToError();
			expect("(loadgame:'1','1')").markupToError();
		});
		it("loads a saved game, restoring the game history and navigating to the saved passage", function(done) {
			runPassage("uno", "uno");
			runPassage("dos(savegame:'1','Filename')", "dos");
			runPassage("tres", "tres");
			expect("cuatro(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect($("tw-passage").last().text()).toMatch("dos");
				expect("(history:)").markupToPrint("uno,dos");
				done();
			}, 20);
		});
		it("restores the saved game's variables", function(done) {
			runPassage("(set:$foo to 'egg')(set:$bar to 2)(set:$baz to true)", "uno");
			runPassage("(set:$bar to it + 2)(savegame:'1','Filename')", "dos");
			runPassage("(set:$bar to it + 2)(set:$foo to 'nut')", "tres");
			expect("(set:$bar to it + 2)(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$foo $bar (text: $baz)").markupToPrint("egg 4 true");
				done();
			}, 20);
		});
		it("restores the saved game's typed variables", function(done) {
			runPassage("(set:str-type $foo to 'A')", "uno");
			runPassage("(set:$foo to it+'B')(savegame:'1','Filename')", "dos");
			runPassage("(set:str-type $bar to 'C')", "tres");
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(set:num-type $bar to 2)").not.markupToError();
				expect("(set:num-type $foo to 2)").markupToError();
				done();
			}, 20);
		});
		it("can restore collection variables", function(done) {
			runPassage(
				"(set:$arr to (a:'egg'))" +
				"(set:$dm to (datamap:'HP',4))" +
				"(set:$ds to (dataset:2,4))" +
				"(savegame:'1')",
				"corge"
			);
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr (text:$dm's HP) (text: $ds contains 4)").markupToPrint("egg 4 true");
				done();
			}, 20);
		});
		it("can restore changer command variables", function(done) {
			runPassage(
				"(set:$c1 to (text-style:'underline'))" +
				"(set:$c2 to (a: $c1 + (hook: 'luge')))", 'corge');
			runPassage("(savegame:'1')",'baz');
			expect("(loadgame:'1')").not.markupToError();
			requestAnimationFrame(function() {
				var hook = runPassage("(either:$c2's 1st)[goop]").find('tw-hook');
				setTimeout(function() {
					expect(hook.css('text-decoration')).toMatch(/^underline/);
					expect(hook.attr('name')).toBe('luge');
					done();
				}, 20);
			});
		});
		it("can restore gradients", function(done) {
			runPassage("(set:$c1 to (gradient:90,0,white,1,black))", 'corge');
			runPassage("(savegame:'1')",'baz');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:'`'+(source:$c1)+'`')").markupToPrint('(gradient:90,0,white,1,black)');
				done();
			}, 20);
		});
		it("can restore code hooks", function(done) {
			runPassage("(set:$c1 to [Foo bar baz])", 'corge');
			runPassage("(savegame:'1')",'baz');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:'`'+(source:$c1)+'`')").markupToPrint('[Foo bar baz]');
				done();
			}, 20);
		});
		it("can restore custom macros", function(done) {
			runPassage(
				"(set:$c1 to (macro: num-type _a, num-type _b, [(output-data:(max:_a,_b,200))]))"
				+ "(set:$c2 to (macro: num-type _a, str-type _b, [(output-data:(str:($c1:_a,150))+_b)]))"
				+ "(set:$c3 to (macro: [(output:)[foo bar]]))", 'corge'
			);
			runPassage("(savegame:'1')",'baz');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("($c1:198,197)").markupToPrint('200');
				expect("($c1:298,297)").markupToPrint('298');
				expect("($c2:312,' bears')").markupToPrint('312 bears');
				expect("($c3:)").markupToPrint('foo bar');
				done();
			}, 90);
		});
		it("can restore variables set in (display:)", function(done) {
			createPassage("(set:$arr to (a:'" + "E".repeat(30) + "'))", 'baz');
			runPassage("(display:'baz')(set:$gee to 2)", "corge");
			runPassage("(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr $gee").markupToPrint("E".repeat(30) + " 2");

				done();
			}, 90);
		});
		it("can restore variables set in code hooks", function(done) {
			runPassage("(set:$hook to [(set:$arr to (a:'" + "E".repeat(30) + "'))])", 'baz');
			runPassage("$hook", "corge");
			expect("$arr").markupToPrint("E".repeat(30));
			runPassage("(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint("E".repeat(30));
				done();
			}, 90);
		});
		it("can restore variables set in custom macros", function(done) {
			runPassage("(set:$macro to (macro:[(set:$arr to '"+ "E".repeat(30) + "')(out-data:'')]))", 'baz');
			runPassage("($macro:)", "corge");
			expect("$arr").markupToPrint("E".repeat(30));
			expect("(savegame:'1')").not.markupToError();
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint("E".repeat(30));
				done();
			}, 90);
		});
		it("can restore variables set in evaluated strings", function(done) {
			runPassage("(set:$str to '(' + 'set:$arr to (a:\\'" + "E".repeat(30) + "\\'))')", 'baz');
			runPassage("$str", "corge");
			expect("$arr").markupToPrint("E".repeat(30));
			runPassage("(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint("E".repeat(30));
				done();
			}, 90);
		});
		['header','footer'].forEach(function(name) {
			it("can restore variables set in "+name+" passages", function(done) {
				createPassage("(set:$arr to (a:'" + "E".repeat(30) + "'))", 'baz', [name]);
				runPassage("(set:$gee to 2)", "corge");
			runPassage("(savegame:'1')",'grault');
				expect("(loadgame:'1')").not.markupToError();
				setTimeout(function() {
					expect("$arr $gee").markupToPrint("E".repeat(30) + " 2");
					done();
				}, 90);
			});
		});
		it("can restore variables with impure values", function(done) {
			runPassage("(set:$a to 1)(set:$arr to (a:'" + "E".repeat(30) + "', $a))", 'baz');
			runPassage("(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint("E".repeat(30) + ",1");
				done();
			}, 90);
		});
		it("can restore variables with values generated by (random:)", function(done) {
			runPassage("(random:1,100)(random:1,100)(random:1,100)(set:$arr to (a:(random:1,100),(random:1,100),(random:1,100)))", 'baz');
			runPassage("(savegame:'1')",'grault');
			var t = runPassage("$arr").find('tw-expression').text();
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint(t);
				done();
			}, 90);
		});
		it("can restore variables with values generated by (either:)", function(done) {
			runPassage("(either:1,2)(either:1,2)(either:1,2)(set:$arr to (a:(either:1,2,3,4,5,6,7),(either:1,2,3,4,5,6,7),(either:1,2,3,4,5,6,7)))", 'baz');
			runPassage("(savegame:'1')",'grault');
			var t = runPassage("$arr").find('tw-expression').text();
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint(t);
				done();
			}, 90);
		});
		it("can restore variables with values generated by (shuffled:)", function(done) {
			runPassage("(either:1,2)(set:$arr to (shuffled:1,2,3,4,5,6,7,8,9,10))(either:1,2)", 'baz');
			runPassage("(savegame:'1')",'grault');
			var t = runPassage("$arr").find('tw-expression').text();
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint(t);
				done();
			}, 90);
		});
		it("can restore variables with values generated by the 'random' data name", function(done) {
			runPassage("(either:1,2)(set:$arr to (a:(range:1,1000)'s random,random of (range:1,1000),(range:1,1000)'s 'random','random' of (range:1,1000),(str-repeated:99,'A')))(either:1,2)", 'baz');
			runPassage("(savegame:'1')",'grault');
			var t = runPassage("$arr").find('tw-expression').text();
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint(t);
				done();
			}, 90);
		});
		it("can restore variables with values generated by blocking dialogs", function(done) {
			runPassage("(set:$arr to (a:(prompt:'foo','bar'),(prompt:'qux','baz'),'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'))", 'baz');
			$("tw-dialog tw-link").click();
			setTimeout(function() {
				$("tw-dialog tw-link").click();
				setTimeout(function() {
					runPassage("(savegame:'1')",'grault');
					expect("(loadgame:'1')").not.markupToError();
					setTimeout(function() {
						expect("$arr").markupToPrint('bar,baz,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
						done();
					}, 90);
				},90);
			},90);
		});
		it("can restore variables across multiple turns", function(done) {
			runPassage("(set:$arr to (a:'" + "E".repeat(30) + "'))", 'baz');
			runPassage("(set:$arr to (a:'" + "J".repeat(30) + "'))", 'qux');
			expect("$arr").markupToPrint("J".repeat(30));
			runPassage("(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr").markupToPrint("J".repeat(30));
				Engine.goBack();
				Engine.goBack();
				Engine.goBack();
				Engine.goBack();
				setTimeout(function() {
					expect("$arr").markupToPrint("E".repeat(30));
					done();
				}, 90);
			}, 90);
		});
		it("can restore variables multiple times", function(done) {
			runPassage("(set:$arr to (a:'" + "E".repeat(30) + "'), $foo to (font:'Roboto'))", 'baz');
			runPassage("(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				runPassage("(savegame:'1')",'grault');
				expect("(loadgame:'1')").not.markupToError();
				setTimeout(function() {
					expect("$arr").markupToPrint("E".repeat(30));
					expect("(verbatim-source:$foo)").markupToPrint("(font:\"Roboto\")");
					done();
				}, 90);
			}, 90);
		});
		it("can restore variables even after using (erase-past:)", function(done) {
			runPassage("(set:str-type $foo to 'A')", "uno");
			runPassage("(erase-past:-1)(set:$foo to it+'B')(savegame:'1','Filename')", "dos");
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(set:num-type $bar to 2)").not.markupToError();
				expect("(set:num-type $foo to 2)").markupToError();
				done();
			}, 20);
		});
		/*
			These aren't (move:)'s semantics in Harlowe 3.
		*/
		xit("can restore variable deletions caused by (move:)", function(done) {
			runPassage("(set:$e to 12)",'baz');
			runPassage("(move:$e into $f)(SAVEGAME:'1')",'qux');
			expect("(loadgame:'1')",'foo').not.markupToError();
			setTimeout(function() {
				expect("$e").markupToPrint('0');
				expect("$f").markupToPrint('12');
				runPassage("(set:$c to 12)",'bar');
				runPassage("(move:$c into $d)",'baz');
				runPassage("(SAVEGAME:'2')",'qux');
				expect("(loadgame:'2')",'foo').not.markupToError();
				setTimeout(function() {
					expect("$c").markupToPrint('0');
					expect("$d").markupToPrint('12');
					done();
				},90);
			},90);
		});
		it("doesn't disrupt (history:)'s cache", function(done) {
			runPassage("", 'baz');
			runPassage("", 'qux');
			runPassage("(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(history:)").markupToPrint('baz,qux,grault');
				done();
			}, 90);
		});
		it("doesn't disrupt (history:)'s cache even with (redirect:) uses", function(done) {
			createPassage("", 'corge');
			runPassage("", 'baz');
			runPassage("(redirect:'corge')", 'qux');
			setTimeout(function() {
				runPassage("(savegame:'1')",'grault');
				expect("(history:)").markupToPrint('baz,qux,corge,grault');
				expect("(loadgame:'1')").not.markupToError();
				setTimeout(function() {
					expect("(history:)").markupToPrint('baz,qux,corge,grault');
					done();
				}, 90);
			}, 90);
		});
		it("doesn't disrupt (history:)'s cache even after using (erase-past:)", function(done) {
			runPassage("", 'baz');
			runPassage("", 'qux');
			runPassage("(erase-past:2)(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(history:)").markupToPrint('baz,qux,grault');
				done();
			}, 90);
		});
		it("produces a user-friendly prompt for deletion if the save data is invalid", function(done) {
			runPassage("uno", "uno");
			runPassage("dos", "dos");
			runPassage("(savegame:'1')", "tres");
			runPassage("quatro", "quatro");
			deletePassage('dos');
			runPassage("(loadgame:'1')");
			setTimeout(function() {
				expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(1);
				expect($("tw-dialog").find('tw-link').first().text()).toBe("Yes");
				expect($("tw-dialog").find('tw-link').last().text()).toBe("No");
				$("tw-dialog").find('tw-link').first().click();
				setTimeout(function() {
					expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(0);
					done();
				},90);
			},90);
			//TODO: Test that the save data is actually deleted.
		});
		it("can restore mock visits", function(done) {
			runPassage("(mock-visits:'test','test','test')",'test');
			runPassage("(savegame:'1')",'bar');
			runPassage("(mock-visits:'bar')",'baz');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:visits)").markupToPrint('5'); // 3 mocks, 1 visit above, plus this passage
				done();
			},90);
		});
		it("can restore mock visits even after using (erase-past:)", function(done) {
			runPassage("(mock-visits:'test','test','test')",'test');
			runPassage("(erase-past:1)(savegame:'1')",'bar');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:visits)").markupToPrint('5'); // 3 mocks, 1 visit above, plus this passage
				done();
			},90);
		});
		it("can restore mock turns", function(done) {
			runPassage("(mock-turns:11)",'qux');
			runPassage("(savegame:'1')",'bar');
			expect("(mock-turns:0)(print:turns)").markupToPrint('3');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:turns)").markupToPrint('14'); // 3 mocks, 1 visit above, plus this passage
				done();
			},90);
		});
		it("can restore mock turns even after using (erase-past:)", function(done) {
			runPassage("(mock-turns:11)",'qux');
			runPassage("(erase-past:1)(savegame:'1')",'bar');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:turns)").markupToPrint('14'); // 3 mocks, 1 visit above, plus this passage
				done();
			},90);
		});
		it("can restore the PRNG seed", function(done) {
			runPassage("(seed:'AAA')(random:1,100000000)",'test');
			runPassage("(savegame:'1')",'bar');
			expect("(random:1,100000000)").markupToPrint('24547054');
			runPassage("(seed:'AB')",'baz');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(random:1,100000000)").markupToPrint('24547054');
				done();
			},90);
		});
		it("can restore the PRNG seed across many turns", function(done) {
			runPassage("(seed:'BAA')",'foo');
			expect(runPassage("**(random:1,100000000)**",'bar').find('strong').text()).toBe('97814911');
			expect(runPassage("**(random:1,100000000)**",'baz').find('strong').text()).toBe('64751555');
			expect(runPassage("**(random:1,100000000)**",'qux').find('strong').text()).toBe('84127778');
			runPassage("(savegame:'1')",'quux');
			runPassage("(random:1,2)",'garply');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				Engine.goBack();
				expect($('tw-passage strong').text()).toBe('84127778');
				Engine.goBack();
				expect($('tw-passage strong').text()).toBe('64751555');
				Engine.goBack();
				expect($('tw-passage strong').text()).toBe('97814911');
				done();
			},90);
		});
		it("can restore the PRNG seed even when it isn't set", function(done) {
			runPassage("**(random:1,100000000)**",'foo');
			var result = $('tw-passage strong').text();
			runPassage("(random:1,2)(random:1,2)(savegame:'1')(random:1,2)",'bar');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				Engine.goBack();
				Engine.goBack();
				expect($('tw-passage strong').text()).toBe(result);
				done();
			},90);
		});
		it("can restore the PRNG seed even after using (erase-past:)", function(done) {
			runPassage("(seed:'AAA')(random:1,100000000)",'test');
			runPassage("(erase-past:1)(savegame:'1')",'bar');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(random:1,100000000)").markupToPrint('24547054');
				done();
			},90);
		});
		it("can't create an infinite loop", function(done) {
			spyOn($,'noop');
			runPassage("<script>$.noop()</script>(savegame:'1')(loadgame:'1')");
			setTimeout(function() {
				expect($.noop).toHaveBeenCalledTimes(2);
				expect($('tw-passage tw-error').length).toBe(1);
				done();
			},120);
		});
	});
});

