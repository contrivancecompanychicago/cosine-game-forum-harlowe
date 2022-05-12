describe("lambdas", function() {
	'use strict';
	it("consist of an optional temporary or typed temp variable (with an optional 'each'), and clauses starting with 'making', 'where', 'when', or 'via'", function() {
		["_a","num-type _a"].forEach(function(a) {
			expect("(print: "+a+" where 2)").not.markupToError();
			expect("(print: "+a+" making _b)").not.markupToError();
			expect("(print: "+a+" via _a)").not.markupToError();
			expect("(print: each "+a+")").not.markupToError();
			expect("(print: each "+a+" where 2)").not.markupToError();
			expect("(print: each "+a+" making num-type _b)").not.markupToError();
			expect("(print: each "+a+" via _a)").not.markupToError();
		});
		expect("(print: where 2)").not.markupToError();
		expect("(print: when 2)").not.markupToError();
		expect("(print: making _B)").not.markupToError();
		expect("(print: via _A)").not.markupToError();

		expect("(print: each 2)").markupToError();
		expect("(print: 'e' where 2)").markupToError();
		expect("(print: (a:) making _B)").markupToError();
		expect("(print: 2 via _A)").markupToError();
	});
	it("cannot have 'each' without the temporary variable", function() {
		expect("(print: each where true)").markupToError();
	});
	it("can be nested", function() {
		expect("(print: _a via (_b where c))").not.markupToError();
	});
	it("'making' clauses must have temporary variables following", function() {
		expect("(print: _a making (_a + 1))").markupToError();
	});
	it("'where' and 'when' work with 'and'", function() {
		expect("(print: where $a > 4 and $b > 3)").not.markupToError();
		expect("(print: when $a > 4 and $b > 3)").not.markupToError();
	});
	it("'when' cannot have any other clauses", function() {
		expect("(print: when $a > 2 where $a > 4)").markupToError();
		expect("(print: when $a > 2 via $a + 1)").markupToError();
	});
	it("'when' cannot have the optional temp variable", function() {
		expect("(print: _a when _a > 2)").markupToError();
		expect("(print: each _a when _a > 2)").markupToError();
	});
	it("'when' cannot refer to 'it' (and this is checked at runtime)", function(done) {
		var p = runPassage("(event: when it > 2)[]");
		setTimeout(function() {
			expect(p.find('tw-error:not(.javascript)').length).toBe(1);
			done();
		},20);
	});
	it("cannot have duplicate variable names", function() {
		expect("(print: _a making _a)").markupToError();
	});
	it("clauses can be in any order", function() {
		expect("(print: _a making _c via _c where _a > 2)").not.markupToError();
		expect("(print: _a making _c where _a > 2 via _c)").not.markupToError();
		expect("(print: _a via _c making _c where _a > 2)").not.markupToError();
		expect("(print: _a where _a > 2 making _c via _c)").not.markupToError();
	});
	//TODO: cannot have unused params
});
describe("lambda macros", function() {
	'use strict';
	describe("the (altered:) macro", function() {
		it("accepts a 'via' or 'where via' lambda, plus zero or more other values", function() {
			expect("(altered:)").markupToError();
			expect("(altered:1)").markupToError();
			for(var i = 2; i < 8; i += 1) {
				expect("(altered: _a via _a*2," + "2,".repeat(i) + ")").not.markupToError();
				expect("(altered: _a via _a*2 where _a is a num," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(altered: each _a, 2)").markupToError();
			expect("(altered: _a where _a*2, 2)").markupToError();
			expect("(altered: _a making _b via _a*_b*2, 2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing an array", function() {
			expect("(print: (altered: _a via _a*2, 1)'s 1st + 1)").markupToPrint("3");
			expect("(altered: _a via _a*2, 1,2,3)").markupToPrint("2,4,6");
			expect("(set: $a to 3)(altered: _a via _a*$a, 1,2,3)").markupToPrint("3,6,9");
		});
		it("works on datamaps, datasets and colours", function() {
			expect("(altered: _a via _a's A, (dm: 'A', 4), (dm: 'A', 7))").markupToPrint("4,7");
			expect("(altered: _a via 'b' is in _a, (ds: 'b'), (ds:), (ds:3,'b'))").markupToPrint("true,false,true");
			expect("(altered: _a via _a's r, (rgb: 20,60,90), (rgba: 120,10,10,0.1))").markupToPrint("20,120");
		});
		it("if the optional 'where' lambda fails, leaves the value for that iteration unaltered", function() {
			expect("(altered: _a via _a*-1 where _a is an odd, 1,2,3,4,5)").markupToPrint("-1,2,-3,4,-5");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(altered: _a via _a*2, 1, 2, true, 4)").markupToError();
		});
		it("returns an empty array if no other values are given", function() {
			expect("(print: (altered: _a via _a*2) is (a:))").markupToPrint("true");
		});
		it("doesn't affect temporary variables outside it", function() {
			expect("(set: _a to 1)(altered: _a via _a*2, 5,6) _a").markupToPrint("10,12 1");
		});
		it("sets the 'it' identifier to the loop value", function() {
			expect("(print: (altered: _a via it*2, 1)'s 1st + 1)").markupToPrint("3");
		});
		it("'where' can't alter the 'it' value given to 'via'", function() {
			expect("(print: (altered: where it is an odd via it*2, 3,2))").markupToPrint("6,2");
		});
		it("errors if the optional datatype doesn't match", function() {
			expect("(print: (altered: str-type _a via it is not '2', 1))").markupToError();
		});
	});
	describe("the (find:) macro", function() {
		it("accepts a 'where' or 'each' lambda returning a boolean, plus zero or more other values", function() {
			expect("(find:)").markupToError();
			expect("(find:1)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(find: _a where true," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(find: each _a,2)").not.markupToError();
			expect("(find:_a via true,2)").markupToError();
			expect("(find:_a making _b where true,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing an array of those which produced true", function() {
			expect("(print: (find: _a where _a>2, 1,3)'s 1st + 1)").markupToPrint("4");
			expect("(find: _a where _a>2, 1,2,3,4,5)").markupToPrint("3,4,5");
			expect("(set: $a to 3)(find: _a where _a < $a, 1,2,3)").markupToPrint("1,2");
			expect("(set: $a to 3)(set:$b to 2)(find: _a where _a < $a and _a <= $b, 1,2,3,4)").markupToPrint("1,2");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(find: _a where not _a, true, true, 6, true)").markupToError();
		});
		it("returns an empty array if no other values are given", function() {
			expect("(print: (find: _a where _a*2 > 10) is (a:))").markupToPrint("true");
		});
		it("sets the 'it' identifier to the loop value", function() {
			expect("(print: (find: _a where it > 2, 1,3)'s 1st + 1)").markupToPrint("4");
			expect("(print: (find: _a where its length is 2, 'AE','AFE','E','AF','AG','A'))").markupToPrint("AE,AF,AG");
			expect("(print: (find: _a where 'A' is in it, 'AE','AFE','E','AF','AG','A'))").markupToPrint("AE,AFE,AF,AG,A");
		});
		it("errors if the optional datatype doesn't match", function() {
			expect("(print: (find: str-type _a where it is not '2', 1))").markupToError();
		});
	});
	describe("the (all-pass:) macro", function() {
		it("accepts a 'where'  or 'each' lambda, plus zero or more other values", function() {
			expect("(all-pass:)").markupToError();
			expect("(all-pass:1)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(all-pass: _a where true," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(all-pass: each _a, 1)").not.markupToError();
			expect("(all-pass: _a via true,2)").markupToError();
			expect("(all-pass:_a making _b where true,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing true if all produced true", function() {
			expect("(print: (all-pass: _a where _a>2, 3,5,7))").markupToPrint("true");
			expect("(print: (all-pass: _a where _a>2, 1,2,3,4,5))").markupToPrint("false");
			expect("(set: $a to 3)(print: (all-pass: _a where _a < $a, 1,2))").markupToPrint("true");
		});
		it("is aliased as (pass:)", function() {
			expect("(print: (pass: _a where _a>2, 3,5,7))").markupToPrint("true");
		});
		it("returns true if no other values are given", function() {
			expect("(print: (all-pass: _a where _a*2 > 10))").markupToPrint("true");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(all-pass: _a where _a, true, true, 6, true)").markupToError();
		});
		it("iteration does not stop once a false value is produced", function() {
			expect("(all-pass: _a where _a, true, false, 6, true)").markupToError();
		});
		it("works with variables outside the lambda", function() {
			expect('(set: $foo to "foo")'
				+'(set: $corge to (dm: "foo", (dm: "qux", (a:1,2,3,4,5))))'
				+'(set: $bar to (all-pass: _baz where "qux" of $foo of $corge contains _baz, 3,4,5))'
				+'(print: $bar)').markupToPrint('true');
		});
		it("works with temp variables outside the lambda", function() {
			expect('(set: _foo to "foo")'
				+'(set: $corge to (dm: "foo", (dm: "qux", (a:1,2,3,4,5))))'
				+'(set: $bar to (all-pass: _baz where "qux" of _foo of $corge contains _baz, 3,4,5))'
				+'(print: $bar)').markupToPrint('true');
		});
		it("errors if the optional datatype doesn't match", function() {
			expect("(print: (all-pass: str-type _a where it is not '2', 1))").markupToError();
		});
		it("temp variables are dynamically scoped", function() {
			runPassage('(set: _foo to "baz", $corge to (dm:"foo",(a:1,2,3,4,5)))(set:$lam to _baz where _foo of $corge contains _baz)');
			expect('(set: _foo to "foo")(set: $bar to (all-pass: $lam, 3,4,5))(print: $bar)').markupToPrint('true');
		});
	});
	describe("the (some-pass:) macro", function() {
		it("accepts a 'where' or 'each' lambda, plus zero or more other values", function() {
			expect("(some-pass:)").markupToError();
			expect("(some-pass:1)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(some-pass: _a where true," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(some-pass: each _a,1)").not.markupToError();
			expect("(some-pass: _a via true,2)").markupToError();
			expect("(some-pass:_a making _b where true,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing false if all produced false", function() {
			expect("(print: (some-pass: _a where _a>12, 3,5,7))").markupToPrint("false");
			expect("(print: (some-pass: _a where _a>2, 1,2,3,4,5))").markupToPrint("true");
			expect("(set: $a to 3)(print: (some-pass: _a where _a < $a, 6,2))").markupToPrint("true");
		});
		it("returns false if no other values are given", function() {
			expect("(print: (some-pass: _a where _a*2 > 10))").markupToPrint("false");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(some-pass: _a where _a, false, false, 6, false)").markupToError();
		});
		it("iteration does not stop once a true value is produced", function() {
			expect("(some-pass: _a where _a, false, true, 6, false)").markupToError();
		});
	});
	describe("the (none-pass:) macro", function() {
		it("accepts a 'where' or 'each' lambda, plus zero or more other values", function() {
			expect("(none-pass:)").markupToError();
			expect("(none-pass:1)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(none-pass: _a where true," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(none-pass: each _a,1)").not.markupToError();
			expect("(none-pass: _a via true,2)").markupToError();
			expect("(none-pass:_a making _b where true,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing true if all produced false", function() {
			expect("(print: (none-pass: _a where _a>12, 3,5,7))").markupToPrint("true");
			expect("(print: (none-pass: _a where _a>2, 1,2,3,4,5))").markupToPrint("false");
			expect("(set: $a to 3)(print: (none-pass: _a where _a < $a, 6,2))").markupToPrint("false");
		});
		it("returns true if no other values are given", function() {
			expect("(print: (none-pass: _a where _a*2 > 10))").markupToPrint("true");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(none-pass: _a where _a, false, false, 6, false)").markupToError();
		});
		it("iteration does not stop once a true value is produced", function() {
			expect("(none-pass: _a where _a, false, true, 6, false)").markupToError();
		});
	});
	describe("the (folded:) macro", function() {
		it("accepts a 'via', 'making', and (optional) 'where' lambda, plus one or more other values", function() {
			expect("(folded:)").markupToError();
			expect("(folded:1)").markupToError();
			expect("(folded: each _a, 1)").markupToError();
			expect("(folded: _a via _a * 2)").markupToError();
			expect("(folded: _a making _b)").markupToError();
			expect("(folded: _a via _a + _b making _b)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(folded: _a making _b via _a + _b," + "2,".repeat(i) + ")").not.markupToError();
				expect("(folded: _a where _a > 0 making _b via _a + _b," + "2,".repeat(i) + ")").not.markupToError();
			}
		});
		it("performs a fold using the lambda's additional arguments", function() {
			expect("(print: (folded: _a making _total via _a + _total, 2, 4, 7))").markupToPrint("13");
			expect("(print: (folded: _a making _total via _a + _total, '2','4','7'))").markupToPrint("742");
			expect("(print: (folded: _a making _total via (round:_a), 2.1))").markupToPrint("2.1");
		});
		it("uses the 'where' clause to filter out values", function() {
			expect("(print: (folded: _a making _total via _total + _a where _a > 2, 2, 4, 7))").markupToPrint("11");
			expect("(print: (folded: _a making _total via _total + _a, 2, 4, 7))").markupToPrint("13");
		});
		it("produces an error if 'it' is used", function() {
			expect("(print: (folded: _a making _total via _total + _a where it > 2, 2, 4, 7))").markupToError();
			expect("(print: (folded: _a making _total via _total + it, 2, 4, 7))").markupToError();
		});
		it("errors if the optional datatypes don't match", function() {
			expect("(print: (folded: str-type _a making str-type _total via _total + _a, 2, 4, 7))").markupToError();
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(folded: _a making _total via _a + _total, 2, '4', 7)").markupToError();
		});
		it("doesn't affect temporary variables outside it", function() {
			expect("(set: _a to 1)(set: _b to 2)(folded: _a making _b via _a + _b, 3, 4, 7) _a _b").markupToPrint("14 1 2");
		});
	});
	describe("the (dm-altered:) macro", function() {
		it("accepts a 'via' lambda, plus one datamap", function() {
			expect("(dm-altered:)").markupToError();
			expect("(dm-altered:via it + (a:))").markupToError();
			expect("(dm-altered:via it + (a:), (a:))").markupToError();
			expect("(dm-altered:via its value, (dm:))").not.markupToError();
		});
		it("returns the datamap modified by the 'via' lambda, which receives a 'name' and 'value' datamap for each pair", function() {
			expect("(set:_a to (dm-altered:where its name is not 'Pluck' via its value + 10, (dm: 'Caution', 2, 'Pluck', 5, 'Suspicion', 1)))(datanames:_a) (datavalues:_a)").markupToPrint('Caution,Pluck,Suspicion 12,5,11');
			expect("(set:_a to (dm-altered:via 1 where its value is an odd, (dm: 'A', 5, 'B', 2, 'C', 3, 'D', 7)))(datanames:_a) (datavalues:_a)").markupToPrint('A,B,C,D 1,2,1,1');
			expect("(set:_a to (dm-altered:via 2 where it is a datamap and (datanames:it) is (a:'name','value'), (dm: 'A', 5, 'B', 2, 'C', 3, 'D', 7)))(datanames:_a) (datavalues:_a)").markupToPrint('A,B,C,D 2,2,2,2');
		});
		it("if the datamap is empty, an empty datamap is returned", function() {
			expect("(print: (dm-altered:where its name is not 'Pluck' via its value + 10, (dm:)) is (dm:))").markupToPrint('true');
		});
		it("correctly propagates errors", function() {
			expect("(set:_a to (dm-altered:where its name is not 'Pluck' via its value + 10, (dm: 'Caution', 2, 'Pluck', 5, 'Suspicion', '1')))").markupToError();
		});
		it("is aliased as (datamap-altered:)", function() {
			expect("(set:_a to (datamap-altered:where its name is not 'Pluck' via its value + 10, (dm: 'Caution', 2, 'Pluck', 5, 'Suspicion', 1)))(datanames:_a) (datavalues:_a)").markupToPrint('Caution,Pluck,Suspicion 12,5,11');
		});
	});
});
