describe("property indexing", function() {
	'use strict';
	describe("sequential indices", function() {
		describe("for strings", function() {
			it("'1st', '2nd', etc. access the indexed characters", function() {
				expect('(print: "𐌎ed"\'s 1st)').markupToPrint("𐌎");
				expect('(print: "𐌎ed"\'s 2nd)').markupToPrint("e");
				expect('(print: "𐌎ed"\'s 3rd)').markupToPrint("d");
			});
			it("are case-insensitive", function() {
				expect('(print: "𐌎ed"\'s 1sT)').markupToPrint("𐌎");
				expect('(print: "𐌎ed"\'s 2Nd)').markupToPrint("e");
				expect('(print: "𐌎ed"\'s 3RD)').markupToPrint("d");
				expect('(print: "𐌎ed"\'S 2nd)').markupToPrint("e");
			});
			it("can't be substrings", function() {
				expect('(print: "𐌎ed"\'s 1stt)').markupToError();
				expect('(print: "𐌎ed"\'s my2nd)').markupToError();
			});
			it("ignores the exact ordinal used", function() {
				expect('(print: "𐌎ed"\'s 1th)').markupToPrint("𐌎");
				expect('(print: "𐌎ed"\'s 2rd)').markupToPrint("e");
				expect('(print: "𐌎ed"\'s 3st)').markupToPrint("d");
			});
			it("'last', '2ndlast', etc. accesses the right-indexed characters", function() {
				expect('(print: "𐌎ed"\'s 3rdlast)').markupToPrint("𐌎");
				expect('(print: "𐌎ed"\'s 2ndlast)').markupToPrint("e");
				expect('(print: "𐌎ed"\'s last)').markupToPrint("d");
			});
			it("overshot indexes error", function() {
				expect('(print: "𐌎ed"\'s 9th)').markupToError();
				expect('(print: "𐌎ed"\'s 5thlast)').markupToError();
			});
			it("'1stto2ndlast', '2ndlastto5th', etc. accesses a continuous subset", function() {
				expect('(print: "𐌎ed"\'s 1stto2ndlast)').markupToPrint("𐌎e");
				expect('(print: "𐌎ed"\'s 1stto2nd)').markupToPrint("𐌎e");
				expect('(print: "𐌎ed"\'s 3rdlastto2nd)').markupToPrint("𐌎e");
				expect('(print: "𐌎ed"\'s lastto3rdlast)').markupToPrint("𐌎ed");
				expect('(print: "𐌎ed"\'s lasttolast)').markupToPrint("d");
			});
			it("continuous subsets do not error if they overshoot", function() {
				expect('(print: "𐌎ed"\'s 1stto5th)').markupToPrint("𐌎ed");
				expect('(print: "𐌎ed"\'s 1stto10th)').markupToPrint("𐌎ed");
				expect('(print: "𐌎ed"\'s 5thlasttolast)').markupToPrint("𐌎ed");
				expect('(print: "𐌎ed"\'s 10thlasttolast)').markupToPrint("𐌎ed");
			});
			it("'length' accesses the string's length", function() {
				expect('(print: "𐌎ed"\'s length)').markupToPrint("3");
				expect('(print: ""\'s length)').markupToPrint("0");
				expect('(print: "𐌎bcdefghijklmnopqrstuvwxyz"\'s length)').markupToPrint("26");
			});
			it("can be used as a right-hand-side of (set:)", function() {
				expect('(set: $a to "𐌎bc"\'s 1st)$a').markupToPrint("𐌎");
				expect('(set: $a to "𐌎bc"\'s last)$a').markupToPrint("c");
				expect('(set: $a to "𐌎bc"\'s length)$a').markupToPrint("3");
			});
			it("prints an error if the index is out of bounds", function() {
				expect('(print: "𐌎"\'s 2nd)').markupToError();
				expect('(print: "𐌎ed"\'s 4th)').markupToError();
			});
			it("can be used with 'it', as 'its'", function() {
				expect('(set:$s to "𐌎")(set: $s to its 1st)$s').markupToPrint('𐌎');
				expect('(set:$s to "𐌎ed")(set: $s to its length)$s').markupToPrint('3');
			});
			it("can be chained (worthlessly)", function() {
				expect('(print: "𐌎old"\'s last\'s 1st)').markupToPrint('d');
			});
			it("can be assigned to", function() {
				expect('(set: $a to "𐌎old")(set: $a\'s last to "A")$a').markupToPrint('𐌎olA');
			});
		});
		describe("for arrays", function() {
			it("'1st', '2nd', etc. access the indexed elements", function() {
				expect('(print: (a:"R","e","d")\'s 1st)').markupToPrint("R");
				expect('(print: (a:"R","e","d")\'s 2nd)').markupToPrint("e");
				expect('(print: (a:"R","e","d")\'s 3rd)').markupToPrint("d");
			});
			it("ignores the exact ordinal used", function() {
				expect('(print: (a:"R","e","d")\'s 1th)').markupToPrint("R");
				expect('(print: (a:"R","e","d")\'s 2rd)').markupToPrint("e");
				expect('(print: (a:"R","e","d")\'s 3st)').markupToPrint("d");
			});
			it("'last', '2ndlast', etc. accesses the right-indexed characters", function() {
				expect('(print: (a:"R","e","d")\'s 3rdlast)').markupToPrint("R");
				expect('(print: (a:"R","e","d")\'s 2ndlast)').markupToPrint("e");
				expect('(print: (a:"R","e","d")\'s last)').markupToPrint("d");
			});
			it("overshot indexes error", function() {
				expect('(print: (a:"R","e","d")\'s 9th)').markupToError();
				expect('(print: (a:"R","e","d")\'s 5thlast)').markupToError();
			});
			it("'1stto2ndlast', '2ndlastto5th', etc. accesses a continuous subset", function() {
				expect('(print: (a:"R","e","d")\'s 1stto2ndlast)').markupToPrint("R,e");
				expect('(print: (a:"R","e","d")\'s 1stto2nd)').markupToPrint("R,e");
				expect('(print: (a:"R","e","d")\'s 3rdlastto2nd)').markupToPrint("R,e");
				expect('(print: (a:"R","e","d")\'s lastto1st)').markupToPrint("R,e,d");
				expect('(print: (a:"R","e","d")\'s 1stto1st)').markupToPrint("R");
			});
			it("continuous subsets do not error if they pass bounds", function() {
				expect('(print: (a:"R","e","d")\'s 1stto5th)').markupToPrint("R,e,d");
				expect('(print: (a:"R","e","d")\'s 1stto10th)').markupToPrint("R,e,d");
				expect('(print: (a:"R","e","d")\'s 5thlasttolast)').markupToPrint("R,e,d");
				expect('(print: (a:"R","e","d")\'s 10thlasttolast)').markupToPrint("R,e,d");
			});
			it("'length' accesses the array's length", function() {
				expect('(print: (a:1,1,1)\'s length)').markupToPrint("3");
				expect('(print: (a:)\'s length)').markupToPrint("0");
				expect('(print: (a:6,5,4,6,5,6)\'s length)').markupToPrint("6");
			});
			it("can be used as a right-hand-side of (set:)", function() {
				expect('(set: $a to (a:"a")\'s 1st)$a').markupToPrint("a");
				expect('(set: $a to (a:"c")\'s last)$a').markupToPrint("c");
				expect('(set: $a to (a:1,2,3)\'s length)$a').markupToPrint("3");
			});
			it("can be used as a left-hand-side of (set:)", function() {
				runPassage("(set: $a to (a:1,2,3))");
				expect('(set: $a\'s 1st to 2)$a').markupToPrint("2,2,3");
				expect('(set: $a\'s last to 2)$a').markupToPrint("2,2,2");
				expect('(set: $a\'s last to 2)$a').markupToPrint("2,2,2");
			});
			it("can't (set:) the 'length', though", function() {
				expect('(set: $a to (a:1,2,3))(set: $a\'s length to 2)').markupToError();
			});
			it("prints an error if the index is out of bounds", function() {
				expect('(print: (a:)\'s 1st)').markupToError();
				expect('(print: (a:1,2,3)\'s 4th)').markupToError();
			});
			it("can be used with 'it', as 'its'", function() {
				expect('(set:$a to (a:7,8))(set: $a to its 1st)$a').markupToPrint('7');
				expect('(set:$a to (a:1,1,1))(set: $a to its length)$a').markupToPrint('3');
			});
			it("can be chained", function() {
				expect('(print: (a:(a:"W"))\'s 1st\'s 1st)').markupToPrint("W");
			});
			it("can be assigned to", function() {
				expect('(set:$a to (a:1,2))(set: $a\'s last to "A")$a').markupToPrint('1,A');
			});
		});
		it("cannot be used with booleans", function() {
			expect('(print: false\'s 1st)').markupToError();
			expect('(print: true\'s last)').markupToError();
			expect('(set:$a to false)(set: $a\'s 1st to 1)').markupToError();
			expect('(set:$a to true)(set: $a\'s last to 1)').markupToError();
		});
		it("cannot be used with numbers", function() {
			expect('(print: 2\'s 1st)').markupToError();
			expect('(print: -0.1\'s last)').markupToError();
			expect('(set:$a to 2)(set: $a\'s 1st to 1)').markupToError();
			expect('(set:$a to -0.1)(set: $a\'s last to 1)').markupToError();
		});
		it("cannot be used with colours", function() {
			expect('(print: white\'s 1st)').markupToError();
			expect('(print: white\'s last)').markupToError();
		});
		it("can be used as names in datamaps", function() {
			expect('(print: (datamap: "Sword", "Steel")\'s 1st)').markupToError();
			expect('(print: (datamap: "Sword", "Steel")\'s last)').markupToError();
			expect('(set:$a to (datamap: "Sword", "Steel"))(set: $a\'s 1st to 1)').not.markupToError();
			expect('(set:$a to (datamap: "Sword", "Steel"))(set: $a\'s last to 1)').not.markupToError();
		});
		it("cannot be used with datasets", function() {
			expect('(print: (dataset: 2,3)\'s 1st)').markupToError();
			expect('(print: (dataset: 2,3)\'s last)').markupToError();
			expect('(set:$a to (dataset: 2,3))(set: $a\'s 1st to 1)').markupToError();
			expect('(set:$a to (dataset: 2,3))(set: $a\'s last to 1)').markupToError();
		});
		describe("for hook references", function() {
			it("'1st', '2nd', etc. produce hook references of just the hook at that position", function() {
				expect('|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a\'s 3rd)[2]').markupToPrint("1121");
			});
			it("'1stto2ndlast', '2ndlastto5th', etc. produce a continuous subset", function() {
				expect('|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a\'s 1stto2ndlast)[2]').markupToPrint("2221");
				expect('|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a\'s 2ndto3rd)[2]').markupToPrint("1221");
				expect('|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a\'s lastto2nd)[2]').markupToPrint("1222");
				expect('|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a\'s 2ndlastto3rdlast)[2]').markupToPrint("1221");
			});
			it("indexed hook references can be concatenated", function() {
				expect('|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a\'s 2nd + ?a\'s 4th)[2]').markupToPrint("1212");
				expect('|a>[1]|a>[1]|b>[1]|a>[1](replace: ?a\'s 2nd + ?b)[2]').markupToPrint("1221");
				expect('|a>[1]|a>[1]|b>[1]|a>[1](replace: ?a\'s 1stto2nd + ?b)[2]').markupToPrint("2221");
			});
			it("cannot be assigned to", function() {
				expect("|a>[](set:$a's 1st to (a:1,2))").markupToError();
			});
		});
	});
	describe("string indices", function() {
		describe("for datamaps", function() {
			it("access the keyed properties", function() {
				expect('(print: (datamap:"A",1)\'s A)').markupToPrint('1');
			});
			it("can contain astral characters", function() {
				expect('(print: (datamap:"𐌎ed",1)\'s 𐌎ed)').markupToPrint("1");
			});
			it("prints an error if the key is not present", function() {
				expect('(print: (datamap:"A",1)\'s B)').markupToError();
			});
			it("can be used as a right-hand-side of (set:)", function() {
				expect('(set: $a to (datamap:"A",1)\'s A)$a').markupToPrint("1");
				expect('(set: $a to (datamap:"C",2)\'s C)$a').markupToPrint("2");
			});
			it("can be used as a left-hand-side of (set:)", function() {
				runPassage("(set: $d to (datamap:'A',1))");
				expect('(set: $d\'s A to 2)(print:$d\'s A)').markupToPrint("2");
				runPassage('(set: $d\'s A to (datamap:"B",2))');
				expect('(set: $d\'s A\'s B to 4)(print:$d\'s A\'s B)').markupToPrint("4");
			});
			it("can be used with 'it', as 'its'", function() {
				expect('(set:$d to (datamap:"A",7))(set: $d to its A)$d').markupToPrint('7');
			});
			it("can be chained", function() {
				expect('(print: (datamap:"W",(datamap:"W",1))\'s W\'s W)').markupToPrint("1");
			});
			it("can't be used if the datamap already contains a different-typed similar key", function() {
				runPassage("(set: $d to (datamap:1,5,'2',4))");
				expect('(set: $d\'s 2 to 7)').markupToError();
				expect('(set: $d\'s "1" to 6)').markupToError();
			});
		});
		[
			["strings", '"AB"'],
			["arrays", "(a:2,4)"],
			["datasets", "(ds:2,4)"]
		].forEach(function(arr) {
			it("only 'length', 'any' and 'all' can be used with " + arr[0], function() {
				expect('(set: $s to ' + arr[1] + ')(print: $s\'s length)').markupToPrint('2');
				expect('(set: $s to ' + arr[1] + ')(print: $s\'s thing)').markupToError();
				expect('(set: $s to ' + arr[1] + ')(print: $s\'s any is 0)').not.markupToError();
				expect('(set: $s to ' + arr[1] + ')(print: $s\'s all is 0)').not.markupToError();
			});
		});
		it("cannot be used with booleans", function() {
			expect('(print: false\'s a)').markupToError();
			expect('(print: true\'s a)').markupToError();
			expect('(set:$a to false)(set: $a\'s a to 1)').markupToError();
			expect('(set:$a to true)(set: $a\'s a to 1)').markupToError();
		});
		it("cannot be used with numbers", function() {
			expect('(print: 2\'s a)').markupToError();
			expect('(print: -0.1\'s a)').markupToError();
			expect('(set:$a to 2)(set: $a\'s a to 1)').markupToError();
			expect('(set:$a to -0.1)(set: $a\'s a to 1)').markupToError();
		});
		describe("for hook references", function() {
			describe("'chars'", function() {
				it("selects all of the non-whitespace chars in a hook", function() {
					expect('|a>[foo 𐌎ar baz](replace: ?a\'s chars)[1]').markupToPrint("111 111 111");
					expect('|a>[foobarbaz](replace: ?a\'s chars\'s 1st)[F]').markupToPrint("Foobarbaz");
					expect('|a>[foo[𐌎ar]<b|baz](enchant: ?a\'s chars,(text-style:"outline"))(enchant: ?b\'s chars\'s 1st,(background:blue))').not.markupToError();
					expect('|a>[foo](replace: ?a\'s chars\'s 1st\'s chars\'s chars\'s chars)[1]').markupToPrint("1oo");
				});
				it("works with (hover-style:)", function(done) {
					var a = runPassage('|a>[foobarbaz](enchant: ?a\'s chars,(hover-style:(background:white)))').find('tw-hook tw-enchantment:nth-child(4)');
					a.mouseenter();
					setTimeout(function() {
						expect(a).toHaveBackgroundColour("#ffffff");
						done();
					},20);
				});
				it("works with bidi text", function() {
					// The ! should appear to the left in the rendered passage.
					expect('|a>["ٱٹ!‏"](enchant: ?a\'s chars, (background:green))').markupToPrint('"ٱٹ!‏"');
				});
				it("doesn't create <tw-pseudo-hook>s", function() {
					expect(runPassage('foo\n[bar]<a|\n(enchant:?passage\'s chars\'s 1st, (text-colour:#333))').find('tw-pseudo-hook').length).toBe(0);
				});
			});
			describe("'links'", function() {
				it("selects all of the links in a hook", function() {
					createPassage("qux","qux");
					expect('|a>[foo[[qux<-bar]]baz](replace: ?a\'s links)[1]').markupToPrint("foo1baz");
					expect('|a>[foobarbaz](replace: ?a\'s links)[1]').markupToPrint("foobarbaz");
					expect('|a>[[[foo->qux]]bar[[qux<-baz]]](replace: ?a\'s links\'s 1st)[F]').markupToPrint("Fbarbaz");
					expect('|a>[foobarbaz](replace: ?a\'s links)[1]').markupToPrint("foobarbaz");
				});
				it("selects the hook itself if it's a link", function() {
					expect('(link:"foo")|a>[bar](replace: ?a\'s links)[baz]').markupToPrint("baz");
				});
				it("doesn't create <tw-pseudo-hook>s", function() {
					expect(runPassage('foo\n[[bar]]\n(enchant:?passage\'s links\'s 1st, (text-colour:#333))').find('tw-pseudo-hook').length).toBe(0);
				});
			});
			describe("'lines'", function() {
				it("selects all of the lines in a hook", function(done) {
					expect('foo\nbar\nbaz\n(replace: ?passage\'s lines)[1]').markupToPrint("1\n1\n1\n");
					expect('foo\nbar\nbaz\n(replace: ?passage\'s lines\'s 2nd)[1]').markupToPrint("foo\n1\nbaz\n");
					expect('foo\n[bar\nbaz]<1|qux\n(replace: ?passage\'s lines\'s 2nd)[1]').markupToPrint("foo\n1\nbazqux\n");
					expect('foo\n[bar\nbaz]<1|qux\n(replace: ?passage\'s lines\'s 3nd)[1]').markupToPrint("foo\nbar\n1\n");

					var a = runPassage('foo\nbar\n(enchant:?passage\'s lines, (text-colour:#333))').find('tw-enchantment');
					setTimeout(function(){
						expect(a).toHaveColour("#333333");
						done();
					},20);
				});
				it("works with only one line", function(done) {
					var a = runPassage('(enchant:?passage\'s lines, (text-style:"shadow"))I just want to say hello to you').find('tw-enchantment');
					setTimeout(function(){
						expect(a.attr('style')).toMatch(/text-shadow/);
						done();
					},20);
				});
				it("works with (hover-style:)", function(done) {
					var a = runPassage('|a>[foo\nbar\nbaz](enchant: ?a\'s lines,(hover-style:(background:white)))').find('tw-hook tw-enchantment');
					a.mouseenter();
					setTimeout(function() {
						expect(a).toHaveBackgroundColour("#ffffff");
						done();
					},20);
				});
				it("doesn't create <tw-pseudo-hook>s", function() {
					expect(runPassage('foo\nbar\n(enchant:?passage\'s lines\'s 1st, (text-colour:#333))').find('tw-pseudo-hook').length).toBe(0);
				});
			});
			it("no other indices can be used", function() {
				expect('|a>[]|a>[](print: ?a\'s length)').markupToError();
				expect('|a>[]|a>[](print: ?a\'s thing)').markupToError();
				expect('|a>[]|a>[](set: ?a\'s thing to 4)').markupToError();
				expect('|a>[]|a>[](set: ?a\'s length to 4)').markupToError();
			});
		});
		describe("for colours", function() {
			it("'r', 'g', 'b' etc. produce the colour's RGB components in the range 0 to 255", function() {
				expect('(print: red\'s r)').markupToPrint("230");
				expect('(print: red\'s g)').markupToPrint("25");
				expect('(print: red\'s b)').markupToPrint("25");
			});
			it("'h', 's', 'l' etc. produce the colour's HSL components in the range 0 to 1", function() {
				expect('(print: red\'s h)').markupToPrint("0");
				expect('(print: (floor:red\'s s * 1000))').markupToPrint("803");
				expect('(print: red\'s l)').markupToPrint("0.5");
			});
			it("'a' produces the colour's alpha in the range 0 to 1", function() {
				expect('(print: (rgba:0,50,50,0.2)\'s a)').markupToPrint("0.2");
				expect('(print: red\'s a)').markupToPrint("1");
			});
			it("'lch' produces a datamap of the colour's LCH values", function() {
				expect('(print: (rgba:0,50,50,0.2)\'s lch is a datamap)').markupToPrint("true");
				expect('(print: (lch:0.7,80,50,0.2)\'s lch\'s l)').markupToPrint("0.7");
				expect('(print: (lch:0.7,80,50,0.2)\'s lch\'s c)').markupToPrint("80");
				expect('(print: (lch:0.7,80,50,0.2)\'s lch\'s h)').markupToPrint("50");
			});
			it("no other values are present", function() {
				expect("(print:red's create)").markupToError();
				expect("(print:red's toHexString)").markupToError();
			});
			it("cannot be assigned to", function() {
				expect("(set:red's r to 2)").markupToError();
			});
		});
		describe("for gradients", function() {
			it("'angle' produces the gradient's angle", function() {
				expect("(print:(gradient:12,0,black,1,white)'s angle)").markupToPrint("12");
				expect("(print:(gradient:102,0,black,1,white)'s angle)").markupToPrint("102");
				expect("(print:(gradient:345,0,black,1,white)'s angle)").markupToPrint("345");
			});
			it("'stops' returns a sorted array of stops", function() {
				expect("(print: (gradient:0,0.7,black,0.2,white)\'s stops\'s length)").markupToPrint("2");
				expect("(print: (gradient:0,0.7,black,0.2,white)\'s stops\'s 1st's percent)").markupToPrint("0.2");
				expect("(print: (gradient:0,0.2,black,0.7,white)\'s stops\'s last's percent)").markupToPrint("0.7");
				expect("(print: (gradient:0,0.7,black,0.2,white)\'s stops\'s last's colour is black)").markupToPrint("true");
			});
			it("no other values are present", function() {
				expect("(print:(gradient:0,0,black,1,white)'s create)").markupToError();
			});
			it("cannot be assigned to", function() {
				expect("(set:(gradient:0,0,black,1,white)'s angle to 2)").markupToError();
				expect("(set:(gradient:0,0,black,1,white)'s stops to (a:))").markupToError();
			});
			it("deep-modifying stops produces an error", function() {
				expect(
					"(set:$foo to (gradient:0,0,black,1,white))(set:$foo's stops's 1st's colour to blue)"
				).markupToError();
			});
		});
	});
	describe("belonging indices", function() {
		it("can be used with strings", function() {
			expect('(print: 1st of "𐌎ed")').markupToPrint("𐌎");
			expect('(print: length of 1st of "𐌎ed")').markupToPrint("1");
		});
		it("can be used with arrays", function() {
			expect('(print: 1st of (a:"R",2))').markupToPrint("R");
			expect('(print: 1st of 1st of (a:(a:"R")))').markupToPrint("R");
		});
		it("can be used with datamaps", function() {
			expect('(print: 𐌎ed of (datamap:"𐌎ed",7))').markupToPrint("7");
		});
		it("can be used with 'it'", function() {
			expect('(set:$a to (a:7,8))(set: $a to 1st of it)$a').markupToPrint('7');
		});
		it("won't conflict with possessive indices", function() {
			expect('(print: length of "Red"\'s 1st)').markupToPrint("1");
			expect('(print: 1st of 1st of (a:(a:"Red"),(a:"Blue"))\'s last)').markupToPrint("B");
		});
		it("won't conflict with 'its' indices", function() {
			expect('(set:$a to (a:(a:7,8),(a:9,0)))(set: $a to 2nd of its 1st)$a').markupToPrint("8");
		});
		[
			["strings", '"AB"'],
			["arrays", "(a:2,4)"],
			["datasets", "(ds:2,4)"]
		].forEach(function(arr) {
			it("only 'length', 'any' and 'all' can be used with " + arr[0], function() {
				expect('(set: $s to ' + arr[1] + ')(print: length of $s)').markupToPrint('2');
				expect('(set: $s to ' + arr[1] + ')(print: thing of $s)').markupToError();
				expect('(set: $s to ' + arr[1] + ')(print: any of $s is 0)').not.markupToError();
				expect('(set: $s to ' + arr[1] + ')(print: all of $s is 0)').not.markupToError();
			});
		});
		it("cannot be used with booleans", function() {
			expect('(print: 1st of false)').markupToError();
			expect('(print: 1st of true)').markupToError();
			expect('(set:$a to false)(set: 1st of $a to 1)').markupToError();
			expect('(set:$a to true)(set: 1st of $a to 1)').markupToError();
		});
		it("cannot be used with numbers", function() {
			expect('(print: 1st of 2)').markupToError();
			expect('(print: 1st of -0.1)').markupToError();
			expect('(set:$a to 2)(set: 1st of $a to 1)').markupToError();
			expect('(set:$a to -0.1)(set: 1st of $a to 1)').markupToError();
		});
	});
	describe("the possessive operators", function() {
		it("perform property accesses with full expressions", function() {
			expect('(print: (a:7)\'s (2 - 1))').markupToPrint('7');
			expect('(print: (a:7)\'s (either:1))').markupToPrint('7');
		});
		it("can be chained", function (){
			expect("(print: (a:'Red')\'s (2 - 1)'s 1st)").markupToPrint("R");
			expect("(print: (a:'Red')\'s (2 - 1)'s (2 - 1))").markupToPrint("R");
		});
		it("can be used with 'it' and 'its'", function (){
			expect("(set: $a to (a:3,4))(set: $a to its (2))$a").markupToPrint("4");
		});
		it("does not require numbers to be bracketed", function (){
			expect("(print: (a:6,12)'s 1)").markupToPrint("6");
		});
		it("has low precedence", function (){
			expect("(print: (a:6,12)'s (1) + 1)").markupToPrint("7");
		});
		it("are case-insensitive", function (){
			expect("(print: (a:6,12)'S (1))").markupToPrint("6");
		});
		it("can have other 'it' accesses nested in it", function (){
			expect("(set: $a to (a:3,4))(set: $a to (its (2)) of 'Blue')$a").markupToPrint("e");
		});
		it("produces an error when given a boolean, datamap, or other invalid type", function (){
			expect("(print: (a:6,12)'s false)").markupToError();
			expect("(print: (a:6,12)'s (datamap:'A','1'))").markupToError();
			expect("(print: (a:6,12)'s (dataset:'A'))").markupToError();
			expect("(print: (a:6,12)'s (text-style:'bold'))").markupToError();
		});
		describe("for datamaps", function() {
			it("access the keyed properties", function() {
				expect('(print: (datamap:"A",1)\'s ("A"))').markupToPrint('1');
				expect('(print: (datamap:-1,1)\'s (-1))').markupToPrint('1');
			});
			it("prints an error if the key is not present", function() {
				expect('(print: (datamap:"A",1)\'s ("B"))').markupToError();
			});
			it("can be used in assignments", function (){
				expect("(set: $d to (datamap:'A',2))(set: $d\'s ('A') to 4)(print:$d's A)").markupToPrint("4");
			});
			it("allows numeric keys", function() {
				expect('(print: (datamap:1,7)\'s (1))').markupToPrint('7');
			});
			it("can't be used if the datamap already contains a different-typed similar key", function() {
				runPassage("(set: $d to (datamap:1,5,'2',4))");
				expect('(set: $d\'s 2 to 7)').markupToError();
				expect('(set: $d\'s "1" to 6)').markupToError();
			});
			describe("with an array key", function() {
				it("evaluates to an array of keyed properties", function() {
					expect('(print: (datamap:"A",1,"B",2)\'s (a:"A","B"))').markupToPrint('1,2');
					expect('(print: (datamap:"A",1,"B",2)\'s (a:"A","B") is an array)').markupToPrint('true');
				});
				it("can be chained", function() {
					expect('(print: (datamap:"A",1,"B",2)\'s (a:"A","B")\'s 1st)').markupToPrint('1');
				});
				it("can be used in assignments", function() {
					expect('(set: $a to (datamap:"A",1,"B",2))(set: $a\'s (a:"A","B") to (a:"C","D"))(print:$a\'s "A" + $a\'s "B")').markupToPrint('CD');
				});
			});
		});
		describe("for arrays", function() {
			it("can be used in assignments", function (){
				expect("(set: $a to (a:1,2))(set: $a\'s (1) to 2)$a").markupToPrint("2,2");
				expect("(set: $a to (a:(a:1)))(set: $a\'s 1st\'s 1st to 2)$a").markupToPrint("2");
			});
			it("must have numbers in range on the right side, or 'length', 'any' or 'all'", function (){
				expect("(print: (a:'Red','Blue')\'s '1')").markupToError();
				expect("(print: (a:'Red')\'s ('13'\'s 1st))").markupToError();
				expect("(print: (a:'Red','Blue')'s 'length')").markupToPrint("2");
				expect("(print: (a:'Red','Blue')\'s 0)").markupToError();
				expect("(print: (a:'Red','Blue')\'s 9)").markupToError();
				expect("(print: (a:)\'s 1)").markupToError();
				expect("(print: (a:'Red','Blue')'s 'any' is 0)").not.markupToError();
				expect("(print: (a:'Red','Blue')'s 'all' is 0)").not.markupToError();
			});
			it("takes negative numeric expressions to obtain last, 2ndlast, etc", function() {
				expect('(print: (a:7)\'s (-1))').markupToPrint('7');
				expect('(print: (a:6,5,4)\'s (-2))').markupToPrint('5');
			});
			describe("with an array key", function() {
				it("evaluates to an array of positional properties", function() {
					expect('(print: (a:"Red","Blue")\'s (a:1,2))').markupToPrint('Red,Blue');
					expect('(print: (a:"Red","Blue")\'s (a:1,2) is an array)').markupToPrint('true');
				});
				it("can be chained", function() {
					expect('(print: (a:"Red","Blue")\'s (a:1,2)\'s 1st)').markupToPrint('Red');
					expect('(print: (a:"Red","Blue")\'s (a:1,2)\'s (a:1,2))').markupToPrint('Red,Blue');
				});
				it("can be used in assignments", function() {
					expect('(set: $a to (a:7,8))(set: $a\'s (a:1,2) to (a:3,9))$a').markupToPrint('3,9');
				});
				it("cannot be used to set arbitrary names", function() {
					expect('(set: $a to (a:7,8))(set: $a\'s (a:1,"garply") to (a:3,9))$a').markupToError();
				});
				it("cannot be used to set 'length'", function() {
					expect('(set: $a to (a:7,8))(set: $a\'s (a:1,"length") to (a:3,9))$a').markupToError();
				});
				it("can also be chained in assignments", function() {
					expect('(set: $a to (a:7,8))(set: $a\'s (a:1,2)\'s (a:1,2) to (a:3,9))$a').markupToPrint('3,9');
				});
			});
		});
		describe("for strings", function() {
			it("must have numbers in range on the right side, or 'length', 'any' or 'all'", function (){
				expect("(print: \"𐌎ed\"'s (1))").markupToPrint("𐌎");
				expect("(print: \"𐌎ed\"'s 'length')").markupToPrint("3");
				expect("(print: '𐌎ed''s '1')").markupToError();
				expect("(print: '𐌎lue''s ('13''s 1st))").markupToError();
				expect("(print: \"𐌎ed\"'s 0)").markupToError();
				expect("(print: \"𐌎ed\"'s 9)").markupToError();
				expect("(print: \"\"'s 1)").markupToError();
				expect("(print: \"𐌎ed\"'s 'length')").markupToPrint("3");
				expect("(print: \"𐌎ed\"'s 'any' is 0)").not.markupToError();
				expect("(print: \"𐌎ed\"'s 'all' is 0)").not.markupToError();
			});
			it("takes negative numeric expressions to obtain last, 2ndlast, etc", function() {
				expect('(print: "A𐌎B"\'s (-1))').markupToPrint('B');
				expect('(print: "A𐌎B"\'s (-2))').markupToPrint('𐌎');
			});
			it("can be used with single-quoted strings", function (){
				expect("(print: '𐌎ed''s (1))").markupToPrint("𐌎");
			});
			it("can be used in assignments", function (){
				expect("(set: $a to '𐌎ed''s (1))$a").markupToPrint("𐌎");
			});
			describe("with an array key", function() {
				it("evaluates to a substring", function() {
					expect('(print: "𐌎ed"\'s (a:1,2))').markupToPrint('𐌎e');
					expect('(print: "𐌎ed"\'s (a:3,1))').markupToPrint('d𐌎');
				});
				it("can be chained", function() {
					expect('(print: "Red"\'s (a:1,2)\'s 1st)').markupToPrint('R');
					expect('(print: "Red"\'s (a:1,2)\'s (a:1,2))').markupToPrint('Re');
					expect('(print: "Gardyloo"\'s (a:6,5,4)\'s (a:3,1))').markupToPrint('dl');
				});
				it("can be used in assignments", function() {
					expect('(set: $a to "𐌎old")(set: $a\'s (a:2,3) to "ar")$a').markupToPrint('𐌎ard');
					expect('(set: $a to "𐌎old")(set: $a\'s (a:3,2) to "ar")$a').markupToPrint('𐌎rad');
					expect('(set: $a to "o𐌎o")(set: $a\'s (a:3,1,3,1) to "abcd")$a').markupToPrint('d𐌎c');
				});
				it("cannot be used to set arbitrary names", function() {
					expect('(set: $a to "𐌎old")(set: $a\'s (a:1,"garply") to "ar")$a').markupToError();
				});
				it("cannot be used to set 'length', 'any' or 'all'", function() {
					expect('(set: $a to "𐌎old")(set: $a\'s (a:1,"length") to "ar")$a').markupToError();
					expect('(set: $a to "𐌎old")(set: $a\'s (a:1,"any") to "ar")$a').markupToError();
					expect('(set: $a to "𐌎old")(set: $a\'s (a:1,"all") to "ar")$a').markupToError();
				});
				it("can also be chained in assignments", function() {
					expect('(set: $a to "𐌎old")(set: $a\'s (a:2,3)\'s (a:1,2) to "ar")$a').markupToPrint('𐌎ard');
					expect('(set: $a to "𐌎old")(set: $a\'s (a:3,2)\'s (a:1,2) to "ar")$a').markupToPrint('𐌎rad');
				});
			});
		});
		describe("for colours", function() {
			it("'r', 'g', 'b' etc. produce the colour's RGB components in the range 0 to 255", function() {
				expect('(print: red\'s "r")').markupToPrint("230");
				expect('(print: red\'s "g")').markupToPrint("25");
				expect('(print: red\'s "b")').markupToPrint("25");
			});
			it("'h', 's', 'l' etc. produce the colour's HSL components in the range 0 to 1", function() {
				expect('(print: red\'s "h")').markupToPrint("0");
				expect('(print: (floor:red\'s "s" * 1000))').markupToPrint("803");
				expect('(print: red\'s "l")').markupToPrint("0.5");
			});
			it("no other values are present", function() {
				expect("(print:red's 'create')").markupToError();
				expect("(print:red's 'toRGBAString')").markupToError();
			});
			it("cannot be assigned to", function() {
				expect('(set:red\'s "r" to 2)').markupToError();
			});
		});
		describe("for gradients", function() {
			it("'angle' produces the gradient's angle", function() {
				expect("(print:(gradient:12,0,black,1,white)'s 'angle')").markupToPrint("12");
				expect("(print:(gradient:102,0,black,1,white)'s 'angle')").markupToPrint("102");
				expect("(print:(gradient:345,0,black,1,white)'s 'angle')").markupToPrint("345");
			});
			it("'stops' returns a sorted array of stops", function() {
				expect("(print: (gradient:0,0.7,black,0.2,white)'s ('stops')'s length)").markupToPrint("2");
				expect("(print: (gradient:0,0.7,black,0.2,white)'s ('stops')'s (1)'s 'percent')").markupToPrint("0.2");
				expect("(print: (gradient:0,0.2,black,0.7,white)\'s ('stops')'s (-1)'s 'percent')").markupToPrint("0.7");
				expect("(print: (gradient:0,0.7,black,0.2,white)\'s ('stops')'s (-1)'s 'colour' is black)").markupToPrint("true");
			});
			it("no other values are present", function() {
				expect("(print:(gradient:0,0,black,1,white)'s 'create')").markupToError();
			});
			it("cannot be assigned to", function() {
				expect("(set:(gradient:0,0,black,1,white)'s 'angle' to 2)").markupToError();
				expect("(set:(gradient:0,0,black,1,white)'s 'stops' to (a:))").markupToError();
			});
			it("deep-modifying stops produces an error", function() {
				expect(
					"(set:$foo to (gradient:0,0,black,1,white))(set:$foo's ('stops')'s (1)'s 'colour' to blue)"
				).markupToError();
			});
		});
		describe("for hook references", function() {
			it("must have numbers in range on the right side", function (){
				expect("|a>[1]|a>[1](replace: ?a's (1))[2]").markupToPrint('21');
				expect("|a>[]|a>[](print: ?a's 'length')").markupToError();
				expect("|a>[]|a>[](print: ?a's 'selector')").markupToError();
				expect("|a>[1]|a>[1](replace: ?a's '1')[2]").markupToError();
				expect("|a>[1]|a>[1](replace: ?a's ('13''s 1st))[2]").markupToError();
				expect("|a>[1]|a>[1](replace: ?a's 0)[2]").markupToError();
				// These don't error because hook refs are nullable
				expect("|a>[1]|a>[1](replace: ?a's 9)[2]").markupToPrint('11');
				expect("|a>[1]|a>[1](replace: ?b's 1)[2]").markupToPrint('11');
			});
			it("takes negative numeric expressions to obtain last, 2ndlast, etc", function() {
				expect("|a>[1]|a>[1](replace: ?a's (-1))[2]").markupToPrint('12');
				expect("|a>[1]|a>[1](replace: ?a's (-2))[2]").markupToPrint('21');
				expect("|a>[1]|a>[1](replace: ?a's (-4))[2]").markupToPrint('11');
			});
			it("can be chained", function() {
				expect("|a>[1]|a>[1](replace: ?a's 1st's 1st)[2]").markupToPrint('21');
				expect("|a>[1]|a>[1](replace: ?a's 2nd's 1st)[2]").markupToPrint('12');
				expect("|a>[1]|a>[1](replace: ?a's 2nd's 2nd)[2]").markupToPrint('11');
			});
			describe("with an array key", function() {
				it("evaluates to a subset", function() {
					expect("|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a's (a:1,4))[2]").markupToPrint('2112');
					expect("|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a's (a:1,3))[2]").markupToPrint('2121');
					expect("|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a's (a:1,3))[2]").markupToPrint('2121');
				});
				it("works with negative indices", function() {
					expect("|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a's (a:-1,-2))[2]").markupToPrint('1122');
					expect("|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a's (a:1,-2))[2]").markupToPrint('2121');
					expect("|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a's (a:-1,1))[2]").markupToPrint('2112');
				});
				it("can be chained", function() {
					expect("|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a's (a:1,4)'s 2nd)[2]").markupToPrint('1112');
					expect("|a>[1]|a>[1]|a>[1]|a>[1](replace: ?a's (a:1,2,4)'s (a:2,3))[2]").markupToPrint('1212');
				});
			});
		});
		it("cannot be used with booleans", function() {
			expect('(print: false\'s "1")').markupToError();
			expect('(print: true\'s "1")').markupToError();
			expect('(set:$a to false)(set: $a\'s "1" to 1)').markupToError();
			expect('(set:$a to true)(set: $a\'s "1" to 1)').markupToError();
		});
		it("cannot be used with numbers", function() {
			expect('(print: 2\'s "1")').markupToError();
			expect('(print: -0.1\'s "1")').markupToError();
			expect('(set:$a to 2)(set: $a\'s "1" to 1)').markupToError();
			expect('(set:$a to -0.1)(set: $a\'s "1" to 1)').markupToError();
		});
		xit("can be combined with normal indices", function() {
			expect("(print: (gradient:0,0.7,black,0.2,white)'s stops's 1st's 'percent')").markupToPrint("0.2");
		});
	});
	describe("the belonging operator", function() {
		it("performs property accesses with full expressions", function() {
			expect('(print: (2 - 1) of (a:7))').markupToPrint('7');
			expect('(print: ((either:1)) of (a:7))').markupToPrint('7');
		});
		it("can be chained", function (){
			expect('(set: $a to 1)(print: (2) of $a of (1) of (a:(a:"XL")))').markupToPrint('L');
			expect("(print: 1st of (a:'Red')\'s (2 - 1))").markupToPrint("R");
			expect("(print: (2 - 1) of (a:'Red')\'s (2 - 1))").markupToPrint("R");
		});
		it("has low precedence", function (){
			expect("(print: 1 + (1) of (a:6,12))").markupToPrint("7");
		});
		it("is case-insensitive", function (){
			expect("(print: (1) OF (a:6,12))").markupToPrint("6");
		});
		it("does not require numbers to be bracketed", function (){
			expect("(print: 1 of (a:6,12))").markupToPrint("6");
		});
		it("has lower precedence than the possessive operator", function (){
			expect("(print: (1) of (a:'Foo','Daa')'s 2nd)").markupToPrint("D");
		});
		it("can be used with 'it' and 'its'", function (){
			expect("(set: $a to (a:3,4))(set: $a to (2) of it)$a").markupToPrint("4");
		});
		it("can have other 'it' accesses nested in it", function (){
			expect("(set: $a to (a:3,4))(set: $a to ((2) of it) of 'Blue')$a").markupToPrint("e");
		});
		describe("for datamaps", function() {
			it("accesses the keyed properties", function() {
				expect('(print: "A" of (datamap:"A",1))').markupToPrint('1');
				expect('(print: (-1) of (datamap:-1,1))').markupToPrint('1');
			});
			it("prints an error if the key is not present", function() {
				expect('(print: "B" of (datamap:"A",1))').markupToError();
			});
			it("can be used in assignments", function (){
				expect("(set: $d to (datamap:'A',2))(set: 'A' of $d\ to 4)(print:$d's A)").markupToPrint("4");
			});
			it("allows numeric keys", function() {
				expect('(print: 1 of (datamap:1,2))').markupToPrint('2');
			});
		});
		describe("for arrays", function() {
			it("can be used in assignments", function (){
				expect("(set: $a to (a:1,2))(set: (1) of $a\ to 2)$a").markupToPrint("2,2");
				expect("(set: $a to (a:(a:1)))(set: (1) of (1) of $a\ to 2)$a").markupToPrint("2");
			});
			it("must have in-range numbers on the left side, or 'length', 'any' or 'all'", function (){
				expect("(print: 1 of (a:'Red','Blue'))").markupToPrint("Red");
				expect("(print: '1' of (a:'Red','Blue'))").markupToError();
				expect("(print: ('13'\'s 1st) of (a:'Red'))").markupToError();
				expect("(print: 'length' of (a:'Red'))").markupToPrint("1");
				expect("(print: 'any' of (a:'Red') is 0)").not.markupToError();
				expect("(print: 'all' of (a:'Red') is 0)").not.markupToError();
				expect("(print: 0 of (a:'Red'))").markupToError();
				expect("(print: 3 of (a:'Red'))").markupToError();
			});
		});
		describe("for strings", function() {
			it("must have in-range numbers on the left side, or 'length', 'any' or 'all'", function (){
				expect("(print: (1) of '𐌎ed')").markupToPrint("𐌎");
				expect("(print: 'length' of \"𐌎ed\")").markupToPrint("3");
				expect("(print: 'any' of 'Red' is 0)").not.markupToError();
				expect("(print: 'all' of 'Red' is 0)").not.markupToError();
				expect("(print: '1' of '𐌎ed')").markupToError();
				expect("(print: 0 of '𐌎ed')").markupToError();
				expect("(print: 9 of '𐌎ed')").markupToError();
				expect("(print: (1st of '13') of '𐌎lue')").markupToError();
			});
		});
	});
});
