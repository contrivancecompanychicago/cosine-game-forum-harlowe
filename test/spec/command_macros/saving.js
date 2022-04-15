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
		return "(" + text + " 107370AE-1D5A-4A33-A52C-D1180BA69750) ";
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
		it("can save collection variables changed over multiple turns", function() {
			runPassage("(set:$longStr to (str-repeated:30,'1'))(set:$arr to (a:(dm:'HP',1,'XP',(str-repeated:40,'0'),'TP',(str-repeated:40,'1')),(dm:'HP',1,'TP',(str-repeated:40,'2'),'XP',(str-repeated:40,'0'))))",'foo');
			runPassage("(set:$arr's 1st's HP to it + 1)                         (set:$arr's 2nd's MP to 20)",'bar');
			runPassage("(set:$arr's 1st's HP to it + 1)(set:$arr's 1st's MP to 30)",'baz');
			runPassage("(set:$arr's 1st's HP to it + 1)                         (set:$arr's 2nd's MP to 40)",'garply');
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
				"(set:$arr to (a:'egg'))(set:$arr's 1st to 'eggs')" +
				"(set:$dm to (datamap:'HP',4))" +
				"(set:$ds to (dataset:2,4))" +
				"(savegame:'1')",
				"corge"
			);
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr (text:$dm's HP) (text: $ds contains 4)").markupToPrint("eggs 4 true");
				done();
			}, 20);
		});
		it("can restore string variables changed over multiple turns", function(done) {
			runPassage("(set:$a to (str-repeated:30,'1'))",'foo');
			runPassage("(set:$a to it + (str-repeated:31,'2'))",'bar');
			runPassage("(set:$a to (str-repeated:32,'3') + it)",'baz');
			runPassage("(savegame:'1')",'quux');
			runPassage("(set:$a to '')",'qux');
			runPassage("(loadgame:'1')",'grault');
			setTimeout(function() {
				expect("(count:$a,'1') (count:$a,'2') (count:$a,'3') (print:$a's 1st + $a's last)").markupToPrint("30 31 32 32");
				done();
			}, 20);
		});
		it("can restore array variables changed over multiple turns", function(done) {
			runPassage("(set:$longStr to (str-repeated:30,'1'))(set:$arr to (a:(dm:'HP',1,'XP',(str-repeated:40,'0'),'TP',(str-repeated:40,'1')),(dm:'HP',1,'TP',(str-repeated:40,'2'),'XP',(str-repeated:40,'0'))))",'foo');
			runPassage("(set:$arr's 1st's HP to it + 1)                         (set:$arr's 2nd's MP to 20)",'bar');
			runPassage("(set:$arr's 1st's HP to it + 1)(set:$arr's 1st's MP to 30)",'baz');
			runPassage("(set:$arr's 1st's HP to it + 1)                         (set:$arr's 2nd's MP to 40) (set: $arr's 1st's XP to it + '7')",'garply');
			runPassage("(savegame:'1')",'quux');
			runPassage("(set:$arr to (a:))",'qux');
			runPassage("(loadgame:'1')",'grault');
			setTimeout(function() {
				expect("(print: $arr's 1st's HP) (print:$arr's 1st's MP) (print:$arr's 1st's TP) (print:$arr's 2nd's HP) (print:$arr's 2nd's MP) (print:$arr's 2nd's TP) (print:$arr's 1st's XP's last)").markupToPrint("4 30 " + '1'.repeat(40) + " 1 40 " + '2'.repeat(40) + " 7");
				done();
			}, 20);
		});
		it("can restore datamap variables changed over multiple turns", function(done) {
			runPassage("(set:$map to (dm:'A',(dm:'B',(dm:'C',(str-repeated:40,'1'),'c',(str-repeated:40,'2'))),'J',(ds:1,2)))",'foo2');
			runPassage("(set:$map's A to $map's A)(set:$map's D to (dm:'E', $map's A's B's C))",'bar2');
			runPassage("(set:$map's D's G to (str-repeated:40,'3'), $map's A's B's H to (str-repeated:40,'4'), $map's J to it + (ds:3,4,5,6,7,8,9,10,11,12,13))",'baz2');
			runPassage("(savegame:'2')",'quux2');
			runPassage("(set:$map to (dm:))",'qux2');
			runPassage("(loadgame:'2')",'grault2');
			setTimeout(function() {
				expect("(print: $map's A's B's C) (print: $map's D's E) (print: $map's A's B's H) (print: $map's D's G) (print: $map's J's length)").markupToPrint('1'.repeat(40) + " " + '1'.repeat(40) + " " + '4'.repeat(40) + " " + '3'.repeat(40) + " 13");
				done();
			}, 20);
		});
		it("can restore dataset variables changed over multiple turns", function(done) {
			runPassage("(set:$ds to (ds:(str-repeated:40,'1'),(str-repeated:40,'2')))(set:$ds2 to $ds, $ds3 to $ds, $ds4 to $ds)",'foo3');
			runPassage("(set: $ds to it + (ds:(str-repeated:40,'3')), $ds2 to it - (ds:(str-repeated:40,'1')), $ds3 to it - (ds:(str-repeated:40,'2')) + (ds:(str-repeated:40,'4')))",'quux3');
			runPassage("(savegame:'3')",'baz3');
			runPassage("(set:$ds to (ds:))",'qux3');
			runPassage("(loadgame:'3')",'grault3');
			setTimeout(function() {
				expect("(print: $ds) (print: $ds2) (print: $ds3)").markupToPrint('1'.repeat(40) + "," + '2'.repeat(40) + "," + '3'.repeat(40) + " " + '2'.repeat(40) + " " + '1'.repeat(40) + "," + '4'.repeat(40));
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
		it("can restore (partial:) custom macros", function(done) {
			runPassage(
				"(set:$c1 to (macro:num-type _a,num-type _b,[(output-data:(max:_a,_b,200))]))(set:$c2 to (partial:'range',3), $c3 to (partial:$c1,201))", 'corge'
			);
			runPassage("(savegame:'1')",'baz');
			runPassage("(set:$c1 to 4, $c2 to 5, $c3 to 6)",'qux');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("($c1:198,197)").markupToPrint('200');
				expect("(v6m-source:($c2:5))").markupToPrint('(a:3,4,5)');
				expect("($c3:312)").markupToPrint('312');
				expect("($c3:155)").markupToPrint('201');
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
		it("can restore variables and their state in previous turns", function(done) {
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
		it("can restore variables even after using (erase-undos:)", function(done) {
			runPassage("(set:str-type $foo to (str-repeated:40,'A'))(set:dm-type $baz to (dm:$foo,'1'))", "uno");
			runPassage("(set:$foo to it + 'C', $baz's B to 2)","tres");
			runPassage("(set:$foo to it + 'D', $baz's C to 2)","cuatro");
			runPassage("(erase-undos:-1)(set:$foo to it+'B')(savegame:'1','Filename')", "dos");
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$foo(print:$baz's C)").markupToPrint("A".repeat(40) + "CDB2");
				expect("(set:num-type $bar to 2)").not.markupToError();
				expect("(set:num-type $foo to 2)").markupToError();
				expect("$foo").markupToPrint("A".repeat(40) + "CDB");
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
		it("doesn't cause startup passages to re-run even after using (erase-undos:)", function(done) {
			runPassage("(Set:$foo to 76)", "foo1");
			createPassage("(Set:$foo to 51)", "foo2", ["startup"]);
			runPassage("(erase-undos:-1)(savegame:'1')",'grault');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$foo").not.markupToPrint("51");
				done();
			}, 90);
		});
		it("doesn't disrupt (history:)'s cache even after using (erase-undos:)", function(done) {
			createPassage("(redirect:'foo3')", "foo2");
			createPassage("(redirect:'foo4')", "foo3");
			createPassage("", "foo4");
			createPassage("", "foo8");
			runPassage("(redirect:'foo2')", "foo1");
			waitForGoto(function() {
				runPassage("", "foo5");
				runPassage("", "foo6");
				runPassage("(redirect:'foo8')", "foo7");
				waitForGoto(function() {
					runPassage("(erase-undos:2)(savegame:'1')",'grault');
					expect("(loadgame:'1')").not.markupToError();
					setTimeout(function() {
						expect("(history:)").markupToPrint('foo1,foo2,foo3,foo4,foo5,foo6,foo7,foo8,grault');
						done();
					}, 90);
				});
			});			
		});
		it("doesn't disrupt (history:)'s cache even after using (erase-visits:)", function(done) {
			createPassage("(redirect:'foo3')", "foo2");
			createPassage("(redirect:'foo4')", "foo3");
			createPassage("", "foo4");
			createPassage("", "foo8");
			runPassage("(redirect:'foo2')", "foo1");
			waitForGoto(function() {
				runPassage("", "foo5");
				runPassage("", "foo6");
				runPassage("(redirect:'foo8')", "foo7");
				waitForGoto(function() {
					runPassage("(erase-visits:2)(history:)", "foo9");
					expect($('tw-expression:last-child').text()).toBe('foo6,foo7,foo8');
					runPassage("(save-game:'1')",'baz');
					expect("(load-game:'1')").not.markupToError();
					setTimeout(function() {
						expect("(history:)").markupToPrint('foo6,foo7,foo8,foo9,baz');
						done();
					}, 90);
				});
			});
		});
		it("doesn't disrupt (history:)'s cache even after using (erase-visits:) with (erase-undos:)", function(done) {
			runPassage("", "foo0");
			createPassage("(redirect:'foo3')", "foo2");
			createPassage("(redirect:'foo4')", "foo3");
			createPassage("", "foo4");
			runPassage("(redirect:'foo2')", "foo1");
			setTimeout(function() {
				runPassage("(erase-visits:2)", "foo5");
				runPassage("", "foo6");
				runPassage("(erase-undos:-1)", "foo7");
				runPassage("(savegame:'1')", "foo8");
				expect("(loadgame:'1')").not.markupToError();
				setTimeout(function() {
					expect("(history:)").markupToPrint('foo5,foo6,foo7,foo8');
					done();
				}, 90);
			},90);
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
			Utils.options.debug = true;
			runPassage("(mock-visits:'test','test','test')",'test');
			runPassage("(savegame:'1')",'bar');
			runPassage("(mock-visits:'bar')",'baz');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:visits)").markupToPrint('5'); // 3 mocks, 1 visit above, plus this passage
				Utils.options.debug = false;
				done();
			},90);
		});
		it("can restore mock visits even after using (erase-undos:)", function(done) {
			Utils.options.debug = true;
			runPassage("(mock-visits:'test','test','test')",'test');
			runPassage("(erase-undos:1)(savegame:'1')",'bar');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:visits)").markupToPrint('5'); // 3 mocks, 1 visit above, plus this passage
				Utils.options.debug = false;
				done();
			},90);
		});
		it("can restore mock turns", function(done) {
			Utils.options.debug = true;
			runPassage("(mock-turns:11)",'qux');
			runPassage("(savegame:'1')",'bar');
			expect("(mock-turns:0)(print:turns)").markupToPrint('3');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:turns)").markupToPrint('14'); // 3 mocks, 1 visit above, plus this passage
				Utils.options.debug = false;
				done();
			},90);
		});
		it("can restore mock turns even after using (erase-undos:)", function(done) {
			Utils.options.debug = true;
			runPassage("(mock-turns:11)",'qux');
			runPassage("(erase-undos:1)(savegame:'1')",'bar');
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:turns)").markupToPrint('14'); // 3 mocks, 1 visit above, plus this passage
				Utils.options.debug = false;
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
		it("can restore the PRNG seed even after using (erase-undos:)", function(done) {
			runPassage("(seed:'AAA')(random:1,100000000)",'test');
			runPassage("(erase-undos:1)(savegame:'1')",'bar');
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

