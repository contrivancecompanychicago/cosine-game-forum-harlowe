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
			it("can include numbers", function() {
				runPassage("(set: $d to (datamap:1,5))(set: $d's 2 to 4)");
				expect('(print: $d\'s 2)').markupToPrint("4");
			});
			it("can't be used if the datamap already contains a different-typed similar key", function() {
				runPassage("(set: $d to (datamap:1,5,'2',4))");
				expect('(set: $d\'s 2 to 7)').markupToError();
				expect('(set: $d\'s "1" to 6)').markupToError();
			});
		});
		it("only 'length' can be used with arrays", function() {
			expect('(set: $s to (a: 2,3))(print: $s\'s length)').markupToPrint('2');
			expect('(set: $s to (a: 2,3))(set: $s\'s thing to 4)').markupToError();
		});
		it("only 'length' can be used with datasets", function() {
			expect('(set: $s to (dataset: 2,3))(print: $s\'s length)').markupToPrint('2');
			expect('(set: $s to (dataset: 2,3))(set: $s\'s thing to 4)').markupToError();
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
			describe("with an array key", function() {
				it("evaluates to an array of keyed properties", function() {
					expect('(print: (datamap:"A",1,"B",2)\'s (a:"A","B"))').markupToPrint('1,2');
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
			it("must have numbers in range on the right side, or 'length'", function (){
				expect("(print: (a:'Red','Blue')\'s '1')").markupToError();
				expect("(print: (a:'Red')\'s ('13'\'s 1st))").markupToError();
				expect("(print: (a:'Red','Blue')'s 'length')").markupToPrint("2");
				expect("(print: (a:'Red','Blue')\'s 0)").markupToError();
				expect("(print: (a:'Red','Blue')\'s 9)").markupToError();
				expect("(print: (a:)\'s 1)").markupToError();
			});
			it("takes negative numeric expressions to obtain last, 2ndlast, etc", function() {
				expect('(print: (a:7)\'s (-1))').markupToPrint('7');
				expect('(print: (a:6,5,4)\'s (-2))').markupToPrint('5');
			});
			describe("with an array key", function() {
				it("evaluates to an array of positional properties", function() {
					expect('(print: (a:"Red","Blue")\'s (a:1,2))').markupToPrint('Red,Blue');
				});
				it("can be chained", function() {
					expect('(print: (a:"Red","Blue")\'s (a:1,2)\'s 1st)').markupToPrint('Red');
					expect('(print: (a:"Red","Blue")\'s (a:1,2)\'s (a:1,2))').markupToPrint('Red,Blue');
				});
				it("can be used in assignments", function() {
					expect('(set: $a to (a:7,8))(set: $a\'s (a:1,2) to (a:3,9))$a').markupToPrint('3,9');
				});
				it("can also be chained in assignments", function() {
					expect('(set: $a to (a:7,8))(set: $a\'s (a:1,2)\'s (a:1,2) to (a:3,9))$a').markupToPrint('3,9');
				});
			});
		});
		describe("for strings", function() {
			it("must have numbers in range on the right side, or 'length'", function (){
				expect("(print: \"𐌎ed\"'s (1))").markupToPrint("𐌎");
				expect("(print: \"𐌎ed\"'s 'length')").markupToPrint("3");
				expect("(print: '𐌎ed''s '1')").markupToError();
				expect("(print: '𐌎lue''s ('13''s 1st))").markupToError();
				expect("(print: \"𐌎ed\"'s 0)").markupToError();
				expect("(print: \"𐌎ed\"'s 9)").markupToError();
				expect("(print: \"\"'s 1)").markupToError();
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
				it("can also be chained in assignments", function() {
					expect('(set: $a to "𐌎old")(set: $a\'s (a:2,3)\'s (a:1,2) to "ar")$a').markupToPrint('𐌎ard');
					expect('(set: $a to "𐌎old")(set: $a\'s (a:3,2)\'s (a:1,2) to "ar")$a').markupToPrint('𐌎rad');
				});
			});
		});
	});
	describe("the belonging operator", function() {
		it("performs property accesses with full expressions", function() {
			expect('(print: (2 - 1) of (a:7))').markupToPrint('7');
			expect('(print: ((either:1)) of (a:7))').markupToPrint('7');
		});
		it("can be chained", function (){
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
			expect("(print: (1) of (a:'Foo','Daa')'s 1st)").markupToPrint("F");
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
			it("must have in-range numbers on the left side, or 'length'", function (){
				expect("(print: 1 of (a:'Red','Blue'))").markupToPrint("Red");
				expect("(print: '1' of (a:'Red','Blue'))").markupToError();
				expect("(print: ('13'\'s 1st) of (a:'Red'))").markupToError();
				expect("(print: 'length' of (a:'Red'))").markupToPrint("1");
				expect("(print: 0 of (a:'Red'))").markupToError();
				expect("(print: 3 of (a:'Red'))").markupToError();
			});
		});
		describe("for strings", function() {
			it("must have in-range numbers on the left side, or 'length'", function (){
				expect("(print: (1) of '𐌎ed')").markupToPrint("𐌎");
				expect("(print: 'length' of \"𐌎ed\")").markupToPrint("3");
				expect("(print: '1' of '𐌎ed')").markupToError();
				expect("(print: 0 of '𐌎ed')").markupToError();
				expect("(print: 9 of '𐌎ed')").markupToError();
				expect("(print: (1st of '13') of '𐌎lue')").markupToError();
			});
		});
	});
});
