describe("lambdas", function() {
	'use strict';
	it("consist of 'each', params, 'to' or 'where', and a deferred computation", function() {
		expect("(print: each _a to 2)").not.markupToError();
		expect("(print: each _a where 2)").not.markupToError();
	});
	it("can have many params separated by commas", function() {
		expect("(print: each _a,_b,_c,_d,_e,_f,_g,_h,_i,_j,_k to _a+_b+_c+_d+_e+_f+_g+_h+_i+_j+_k)").not.markupToError();
	});
	it("can have one trailing comma in the params list", function() {
		expect("(print: each _a,_b, to _a+_b)").not.markupToError();
	});
	it("can be nested", function() {
		expect("(print: each _a to (each _b to _a+_b))").not.markupToError();
	});
	it("cannot have duplicate params", function() {
		expect("(print: each _a,_a, to _a+_b)").markupToError();
	});
	//TODO: cannot have unused params
});
describe("lambda macros", function() {
	'use strict';
	describe("the (converted:) macro", function() {
		it("accepts a one-parameter transformer lambda, plus one or more other values", function() {
			expect("(converted:)").markupToError();
			expect("(converted:1)").markupToError();
			expect("(converted:each _a to _a*2)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(converted:each _a to _a*2," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(converted:each _a where _a*2,2)").markupToError();
			expect("(converted:each _a,_b to _a*_b*2,2)").markupToError();
			expect("(converted:each _a,_b,_c to _a*_b*_c*2,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing an array", function() {
			expect("(print: (converted:each _a to _a*2, 1)'s 1st + 1)").markupToPrint("3");
			expect("(converted:each _a to _a*2, 1,2,3)").markupToPrint("2,4,6");
			expect("(set: $a to 3)(converted:each _a to _a*$a, 1,2,3)").markupToPrint("3,6,9");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(converted:each _a to _a*2, 1, 2, true, 4)").markupToError();
		});
	});
	describe("the (find:) macro", function() {
		it("accepts a one-parameter predicate lambda returning a boolean, plus one or more other values", function() {
			expect("(find:)").markupToError();
			expect("(find:1)").markupToError();
			expect("(find:each _a where _a*2)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(find:each _a where true," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(find:each _a to true,2)").markupToError();
			expect("(find:each _a,_b where _a is _b,2)").markupToError();
			expect("(find:each _a,_b,_c where _a is _b and _b is _c,2)").markupToError();
			expect("(find:each _a where 2,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing an array of those which produced true", function() {
			expect("(print: (find:each _a where _a>2, 1,3)'s 1st + 1)").markupToPrint("4");
			expect("(find:each _a where _a>2, 1,2,3,4,5)").markupToPrint("3,4,5");
			expect("(set: $a to 3)(find:each _a where _a < $a, 1,2,3)").markupToPrint("1,2");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(find:each _a where not _a, true, true, 6, true)").markupToError();
		});
	});
	describe("the (all-pass:) macro", function() {
		it("accepts a one-parameter predicate lambda returning a boolean, plus one or more other values", function() {
			expect("(all-pass:)").markupToError();
			expect("(all-pass:1)").markupToError();
			expect("(all-pass:each _a where _a*2)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(all-pass:each _a where true," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(all-pass:each _a to true,2)").markupToError();
			expect("(all-pass:each _a,_b where _a is _b,2)").markupToError();
			expect("(all-pass:each _a,_b,_c where _a is _b and _b is _c,2)").markupToError();
			expect("(all-pass:each _a where 2,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing true if all produced true", function() {
			expect("(print: (all-pass:each _a where _a>2, 3,5,7))").markupToPrint("true");
			expect("(print: (all-pass:each _a where _a>2, 1,2,3,4,5))").markupToPrint("false");
			expect("(set: $a to 3)(print: (all-pass:each _a where _a < $a, 1,2))").markupToPrint("true");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(all-pass:each _a where _a, true, true, 6, true)").markupToError();
		});
		it("iteration does not stop once a false value is produced", function() {
			expect("(all-pass:each _a where _a, true, false, 6, true)").markupToError();
		});
	});
	describe("the (some-pass:) macro", function() {
		it("accepts a one-parameter predicate lambda returning a boolean, plus one or more other values", function() {
			expect("(some-pass:)").markupToError();
			expect("(some-pass:1)").markupToError();
			expect("(some-pass:each _a where _a*2)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(some-pass:each _a where true," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(some-pass:each _a to true,2)").markupToError();
			expect("(some-pass:each _a,_b where _a is _b,2)").markupToError();
			expect("(some-pass:each _a,_b,_c where _a is _b and _b is _c,2)").markupToError();
			expect("(some-pass:each _a where 2,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing false if all produced false", function() {
			expect("(print: (some-pass:each _a where _a>12, 3,5,7))").markupToPrint("false");
			expect("(print: (some-pass:each _a where _a>2, 1,2,3,4,5))").markupToPrint("true");
			expect("(set: $a to 3)(print: (some-pass:each _a where _a < $a, 6,2))").markupToPrint("true");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(some-pass:each _a where _a, false, false, 6, false)").markupToError();
		});
		it("iteration does not stop once a true value is produced", function() {
			expect("(some-pass:each _a where _a, false, true, 6, false)").markupToError();
		});
	});
	describe("the (none-pass:) macro", function() {
		it("accepts a one-parameter predicate lambda returning a boolean, plus one or more other values", function() {
			expect("(none-pass:)").markupToError();
			expect("(none-pass:1)").markupToError();
			expect("(none-pass:each _a where _a*2)").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(none-pass:each _a where true," + "2,".repeat(i) + ")").not.markupToError();
			}
			expect("(none-pass:each _a to true,2)").markupToError();
			expect("(none-pass:each _a,_b where _a is _b,2)").markupToError();
			expect("(none-pass:each _a,_b,_c where _a is _b and _b is _c,2)").markupToError();
			expect("(none-pass:each _a where 2,2)").markupToError();
		});
		it("applies the lambda to each of its additional arguments, producing true if all produced false", function() {
			expect("(print: (none-pass:each _a where _a>12, 3,5,7))").markupToPrint("true");
			expect("(print: (none-pass:each _a where _a>2, 1,2,3,4,5))").markupToPrint("false");
			expect("(set: $a to 3)(print: (none-pass:each _a where _a < $a, 6,2))").markupToPrint("false");
		});
		it("if one iteration errors, the result is an error", function() {
			expect("(none-pass:each _a where _a, false, false, 6, false)").markupToError();
		});
		it("iteration does not stop once a true value is produced", function() {
			expect("(none-pass:each _a where _a, false, true, 6, false)").markupToError();
		});
	});
});
