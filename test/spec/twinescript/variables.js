describe("variables", function() {
	'use strict';
	describe("the (set:) macro", function() {
		it("requires one or more assignment requests", function() {
			expect("(set: 1)").markupToError();
			expect("(set: 'A')").markupToError();
			expect("(set: false)").markupToError();
			expect("(set: $a)").markupToError();
			expect("(set:)").markupToError();
			expect("(set: $a to 1)").not.markupToError();
			expect("(set: $a to 1, $b to 2)").not.markupToError();
			expect("(set: $a to 1, 2)").markupToError();
			expect("(set: $a into $b)").markupToError();
		});
		it("when given a variable assignment request, sets the variable to a value", function() {
			expect("(set: $a to 1)$a").markupToPrint("1");
		});
		it("can set variables to values in other variables", function() {
			expect("(set: $b to 1)(set: $a to $b)$a").markupToPrint("1");
			expect("(set: $b to 1)(set: $a to $b + 1)$a").markupToPrint("2");
			expect("(set: $b to 1)(set: $c to 1)(set: $a to (either:$b,$c))$a").markupToPrint("1");
			expect("(set: $b to 1)(set: $c to 1)(set: $a to (either:$b,$c)+1)$a").markupToPrint("2");
		});
		it("can set a lot of variables", function() {
			expect(Object.keys($).reduce(function(a, e, i) {
				return a + "(set: $" + e + " to " +
					(i % 3 === 0 ? '"' + String.fromCodePoint(i/3+0x1D4D0) + '"'
					: i % 3 === 1 ? 'false'
					: (Math.random()*1000|1)) + ")";
			}, "")).not.markupToError();
		});
		it("when given multiple requests, performs them in order", function() {
			expect("(set: $a to 2, $b to 3, $c to 4, $d to $b)$d $c $a").markupToPrint("3 4 2");
		});
		it("can name a variable using astral characters", function() {
			expect("(set: $A𐌎B to 1)(print: $A𐌎B)").markupToPrint("1");
		});
		it("runs on evaluation, but can't be assigned or used as a value", function() {
			expect("(print: (set: $a to 1))").markupToError();
			expect("(print: (a:(set: $b to 2)))").markupToError();
			expect("(print: $a + $b)").markupToPrint("3");
		});
		it("cannot assign to a hook reference", function() {
			expect("|a>[Gee] |a>[Wow](set: ?a to '//Golly//')").markupToError();
			expect("|a>[Gee] |a>[Wow](set: ?a to false)").markupToError();
			expect("|a>[Gee] |a>[Wow](set: ?a to (a:1,2,3))").markupToError();
		});
		it("cannot assign a hook reference to a variable", function() {
			expect("|a>[Gee] |a>[Wow](set: $a to ?a)(click:$a)[]").markupToError();
			expect("|a>[Gee] |a>[Wow](set: $a to ?a's 1st)(click:$a)[]").markupToError();
		});
		it("assignment requests can't be assigned", function() {
			expect("(set: $wordy to ($wordy to 2)) ").markupToError();
			expect("(set: $wordy to (a: $wordy to 2)) ").markupToError();
		});
		it("doesn't pollute past turns", function() {
			runPassage("(set: $a to 1)","one");
			runPassage("(set: $a to 2)","two");
			Engine.goBack();
			expect("(print: $a)").markupToPrint("1");
		});
		it("doesn't pollute past turns, even when deeply modifying arrays", function() {
			runPassage("(set: $a to (a:(a:1),1))","one");
			runPassage("(set: $a's 1st's 1st to 2)","two");
			runPassage("(set: $a's 1st's 1st to 3)","three");
			Engine.goBack();
			expect("(print: $a)").markupToPrint("2,1");

			runPassage("(set:$deep to (a:(a:1),1))(set: $a to $deep)","one");
			runPassage("(set:$a's 1st's 1st to 2)","two");
			Engine.goBack();
			expect("(print: $deep)").markupToPrint("1,1");
		});
		it("doesn't pollute past turns, even when deeply modifying datamaps", function() {
			runPassage("(set: $dm to (dm:'a',(dm:'a',1)))","one");
			runPassage("(set: $dm's a's a to 2)","two");
			runPassage("(set: $dm's a's a to 3)","three");
			Engine.goBack();
			expect("(print: $dm's a's a)").markupToPrint("2");

			runPassage("(set:$deep to (dm:'a',(dm:'a',1)))(set: $dm to $deep)","one");
			runPassage("(set:$dm's a's a to 2)","two");
			Engine.goBack();
			expect("(print: $deep's a's a)").markupToPrint("1");
		});
		it("doesn't pollute past turns, even when deeply modifying datasets", function() {
			runPassage("(set:$deep to (ds:(dm:'a',1)))(set: $ds to $deep)","one");
			runPassage("(set:(a:...$ds)'s 1st's a to 2)","two");
			Engine.goBack();
			expect("(print: (a:...$ds)'s 1st's a)").markupToPrint("1");
		});
		it("can't mutate an unassigned collection", function() {
			expect("(set: (a:2)'s 1st to 1)").markupToError();
			expect("(set: \"red\"'s 1st to \"r\")").markupToError();
			expect("(set: (datamap:)'s 'E' to 1)").markupToError();
		});
		describe("when given typed variables", function() {
			it("restricts the variable to the given data type", function() {
				expect("(set: num-type $a to 1)$a").markupToPrint("1");
				expect("(set: str-type $b to 'e')$b").markupToPrint("e");
				expect("(set: num-type $c to 1)(set: num-type $c to 2)$c").markupToPrint("2");
				expect("(set: num-type $d to 1)(set: $d to 'e')").markupToError();
			});
			it("when given 'const', the variable can't be reassigned", function() {
				['1','true','(a:)','""','(size:1)','(each _a)','red'].forEach(function(e) {
					expect("(set: const-type $a to "+e+")").not.markupToError();
					expect("(set: $a to "+e+")").markupToError();
					clearState();
				});
				expect("(set: const-type $a to (a:2))").not.markupToError();
				expect("(set: $a's 1st to 3)").markupToError();
			});
			it("can restrict existing variables", function() {
				runPassage("(set: $a to 1)");
				expect("(set: num-type $a to 2)$a").markupToPrint("2");
			});
			it("restricts the variable across turns", function() {
				runPassage("(set: num-type $a to 1)");
				expect("(set: $a to 2)$a").markupToPrint("2");
				expect("(set: str-type $a to 'e')").markupToError();
			});
			it("doesn't pollute past turns", function() {
				runPassage("(set: $a to 0)",'A');
				runPassage("(set: $a to 1)(set:$c to 1)",'B');
				runPassage("(set: num-type $a to 2)(set:$d to 1)",'C');
				Engine.goBack();
				expect("(set: str-type $a to 'A')$a").markupToPrint("A");
			});
			it("can restrict temp variables", function() {
				runPassage("(set: num-type _a to 1)");
				expect("(set: num-type _a to 2)").not.markupToError();
				expect("(set: num-type _a to 2)(set: _a to 'e')").markupToError();
				expect("(set: num-type _a to 2)[(set:str-type _b to 'e')](set:num-type _b to 2)").not.markupToError();
				expect("(set: _a to 2)[(set:str-type _a to 'e')](set:num-type _a to 4)").not.markupToError();
			});
			it("currently can't type-restrict property accesses", function() {
				runPassage("(set: array-type $a to (a:3))");
				runPassage("(set: $a's 1st to 4')");
				expect("(set: num-type $a's 1st to 2)").markupToError();
			});
			it("works with spread typed variables", function() {
				expect("(set: ...num-type $a to 2)$a").markupToPrint('2');
				expect("(set: ...whitespace-type $b to '    ')$b").markupToPrint('    ');
				expect("(set: (a:...num)-type $z to (a:0,1,2))$z").markupToPrint('0,1,2');
				expect("(set: (a:...odd, even-type $y)-type $e to (a:1,3,5,6))$e $y").markupToPrint('1,3,5,6 6');
				expect("(set: ...digit-type $h to '0041')$h").markupToPrint('0041');
				expect("(set: ...(p: ':', digit)-type $c to ':4:5:6')$c").markupToPrint(':4:5:6');
			});
		});
		it("errors if given unpacking patterns", function() {
			expect("(set: (a:num-type $a, num-type $b) to (a:2,3))$a $b").markupToError();
		});
		it("datamap patterns can't be (set:) as data", function() {
			expect("(set: $a to  (dm:'foo',num-type $a))$a").markupToError();
		});
		it("array patterns can't be (set:) as data", function() {
			expect("(set: $a to (a:num-type $a))$a").markupToError();
		});
		xit("string patterns can't be (set:) as data", function() {
			expect("(set: $a to  (p:'foo',digit-type $a))$a").markupToError();
		});
	});
	describe("the (put:) macro", function() {
		//TODO: Add more of the above tests.
		it("can't mutate an unassigned collection", function() {
			expect("(put: 1 into (a:2)'s 1st)").markupToError();
			expect("(put: \"r\" into \"red\"'s 1st)").markupToError();
			expect("(put: 1 into (datamap:)'s 'E')").markupToError();
		});
		it("works with typed variables", function() {
			expect("(put: 1 into num-type $a)$a").markupToPrint("1");
		});
		it("errors if given unpacking patterns", function() {
			expect("(put: (a:2,3) into (a:num-type $a, num-type $b))$a $b").markupToError();
		});
	});
	describe("bare variables in passage text", function() {
		it("for numbers, prints the number", function() {
			runPassage("(set:$x to 0.125)");
			expect("$x").markupToPrint("0.125");
			runPassage("(set:$y to 0)");
			expect("$y").markupToPrint("0");
		});
		it("for strings, renders the string", function() {
			runPassage("(set:$x to '//italic//')");
			expect("$x").markupToPrint("italic");
			runPassage("(set:$y to '')");
			expect("$y").markupToPrint("");
		});
		it("for booleans, renders nothing", function() {
			runPassage("(set:$x to true)");
			expect("$x").markupToPrint("");
			runPassage("(set:$y to false)");
			expect("$y").markupToPrint("");
		});
		it("for arrays, prints the array", function() {
			runPassage("(set:$x to (a:1,2))");
			expect("$x").markupToPrint("1,2");
			runPassage("(set:$y to (a:))");
			expect("$y").markupToPrint("");
		});
		it("names cannot contain just underscores or numbers", function() {
			expect("$_").markupToPrint("$_");
			expect("$2").markupToPrint("$2");
			expect("$2_").markupToPrint("$2_");
			expect("$_2").markupToPrint("$_2");
		});
	});
});
