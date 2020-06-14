describe("lambdas", function() {
	'use strict';
	it("consist of an optional temporary variable (with an optional 'each'), and clauses starting with 'making', 'where', 'when', 'via' or 'with'", function() {
		expect("(print: _a where 2)").not.markupToError();
		expect("(print: _a making _b)").not.markupToError();
		expect("(print: _a via _a)").not.markupToError();
		expect("(print: _a with _b)").not.markupToError();
		expect("(print: each _a)").not.markupToError();
		expect("(print: each _a where 2)").not.markupToError();
		expect("(print: each _a making _b)").not.markupToError();
		expect("(print: each _a via _a)").not.markupToError();
		expect("(print: each _a with _b)").not.markupToError();
		expect("(print: where 2)").not.markupToError();
		expect("(print: when 2)").not.markupToError();
		expect("(print: making _B)").not.markupToError();
		expect("(print: via _A)").not.markupToError();
		expect("(print: with _B)").not.markupToError();
	});
	it("cannot have 'each' without the temporary variable", function() {
		expect("(print: each where true)").markupToError();
	});
	it("can be nested", function() {
		expect("(print: _a via (_b where c))").not.markupToError();
	});
	it("'making' and 'with' clauses must have temporary variables following", function() {
		expect("(print: _a making (_a + 1))").markupToError();
		expect("(print: _a with (_a + 1))").markupToError();
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
		expect("(print: _a with _a)").markupToError();
		expect("(print: _a making _a)").markupToError();
		expect("(print: _a making _b with _b)").markupToError();
	});
	it("clauses can be in any order", function() {
		expect("(print: _a with _b making _c via _c + _b where _a > 2)").not.markupToError();
		expect("(print: _a making _c with _b where _a > 2 via _c + _b)").not.markupToError();
		expect("(print: _a via _c + _b with _b making _c where _a > 2)").not.markupToError();
		expect("(print: _a where _a > 2 making _c via _c + _b with _b)").not.markupToError();
	});
	//TODO: cannot have unused params
});
describe("lambda macros", function() {
	'use strict';
	describe("the (altered:) macro", function() {
		it("accepts a 'via' lambda, plus zero or more other values", function() {
			expect("(altered:)").markupToError();
			expect("(altered:1)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(altered: _a via _a*2," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(altered: each _a, 2)").markupToError();
			expect("(altered: _a where _a*2, 2)").markupToError();
			expect("(altered: _a with _b via _a*_b*2, 2)").markupToError();
			expect("(altered: _a making _b via _a*_b*2, 2)").markupToError();
			expect("(altered: _a via _a*2 with _b, 2)").markupToError();
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
			expect("(find:_a with _b where _a is _b,2)").markupToError();
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
			expect("(all-pass:_a with _b where _a is _b,2)").markupToError();
			expect("(all-pass:_a making _b where true,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing true if all produced true", function() {
			expect("(print: (all-pass: _a where _a>2, 3,5,7))").markupToPrint("true");
			expect("(print: (all-pass: _a where _a>2, 1,2,3,4,5))").markupToPrint("false");
			expect("(set: $a to 3)(print: (all-pass: _a where _a < $a, 1,2))").markupToPrint("true");
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
			expect("(some-pass:_a with _b where _a is _b,2)").markupToError();
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
			expect("(none-pass:_a with _b where _a is _b,2)").markupToError();
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
			//expect("(print: (folded: _a making _total via _total + it, 2, 4, 7))").markupToError();
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(folded: _a making _total via _a + _total, 2, '4', 7)").markupToError();
		});
		it("doesn't affect temporary variables outside it", function() {
			expect("(set: _a to 1)(set: _b to 2)(folded: _a making _b via _a + _b, 3, 4, 7) _a _b").markupToPrint("14 1 2");
		});
	});
});
