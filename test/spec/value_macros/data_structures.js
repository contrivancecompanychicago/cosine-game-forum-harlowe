describe("data structure macros", function () {
	'use strict';
	describe("the (array:) macro", function() {
		it("accepts 0 or more arguments of any type", function() {
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expect("(array:" + (e + ",").repeat(i) + ")").markupToPrint(Array(i).fill(eval(e)) + '');
				}
			});
		});
		it("returns an array containing the arguments", function() {
			runPassage("(set: $a to (array:1,2,3,4,5))");
			expect("(print: $a's 1st > 0 and $a's 1st < 6)").markupToPrint("true");
			expect(
				"(print: 2 is in $a and 3 is in $a and 4 is in $a and 5 is in $a and 1 is in $a)"
			).markupToPrint(
				"true"
			);
		});
		it("is aliased as (a:)", function() {
			expect("(print:(a:5) is (array:5))").markupToPrint('true');
		});
	});
	describe("the (range:) macro", function() {
		it("accepts 2 numbers", function() {
			expect("(range:)").markupToError();
			expect("(range:1)").markupToError();
			expect("(range:1,3)").not.markupToError();
			expect("(range:1,3,4)").markupToError();
		});
		it("returns an array containing the integers between both numbers, inclusive", function() {
			expect("(print: (range:1,2))").markupToPrint("1,2");
			expect("(print: (range:3,6))").markupToPrint("3,4,5,6");
			expect("(print: (range:1,2)'s length)").markupToPrint("2");
			expect("(print: (range:3,6)'s length)").markupToPrint("4");
		});
		it("works even when the first number exceeds the second", function() {
			expect("(print: (range:2,1))").markupToPrint("1,2");
			expect("(print: (range:6,3))").markupToPrint("3,4,5,6");
		});
		it("works even when the numbers are both negative", function() {
			expect("(print: (range:-4,-2))").markupToPrint("-4,-3,-2");
			expect("(print: (range:-2,-4))").markupToPrint("-4,-3,-2");
			expect("(print: (range:2,-4))").markupToPrint("-4,-3,-2,-1,0,1,2");
		});
		it("works even when the numbers are equal", function() {
			expect("(print: (range:-4,-4))").markupToPrint("-4");
			expect("(print: (range:-4,-4)'s length)").markupToPrint("1");
		});
	});
	describe("the (subarray:) macro", function() {
		it("accepts 1 array argument, then two number arguments", function() {
			expect("(subarray:)").markupToError();
			expect("(subarray: (a:'1'))").markupToError();
			expect("(subarray: (a:6,7), 1, 2)").markupToPrint('6,7');
		});
		it("returns the subarray specified by the two 1-indexed start and end indices", function() {
			expect("(subarray: (a:8,7,6,5,4), 2, 4)").markupToPrint("7,6,5");
		});
		it("reverses the indices if the second exceeds the first", function() {
			expect("(subarray: (a:8,7,6,5,4), 4, 2)").markupToPrint("7,6,5");
		});
		it("accepts negative indices", function() {
			expect("(subarray: (a:8,7,6,5,4), 2, -1)").markupToPrint("7,6,5,4");
			expect("(subarray: (a:8,7,6,5,4), -2, 1)").markupToPrint("8,7,6,5");
			expect("(subarray: (a:8,7,6,5,4), -1, -3)").markupToPrint("6,5,4");
		});
		it("refuses zero and NaN indices", function() {
			expect("(subarray: (a:8,7,6,5,4), 0, 2)").markupToError();
			expect("(subarray: (a:8,7,6,5,4), 2, NaN)").markupToError();
		});
	});
	describe("the (shuffled:) macro", function() {
		it("accepts 2 or more arguments of any type", function() {
			expect("(shuffled:)").markupToError();
			expect("(shuffled:1)").markupToError();
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 2; i < 10; i += 1) {
					expect("(shuffled:" + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("returns an array containing the arguments", function() {
			runPassage("(set: $a to (shuffled:1,2,3,4,5))");
			expect("(print: $a's 1st > 0 and $a's 1st < 6)").markupToPrint("true");
			expect(
				"(print: 2 is in $a and 3 is in $a and 4 is in $a and 5 is in $a and 1 is in $a)"
			).markupToPrint(
				"true"
			);
		});
		it("shuffles the positions of the elements in the returned array", function() {
			expect("(print: (range:1,99) is (range:1,99))").markupToPrint("true");
			for(var i = 0; i < 10; i += 1) {
				expect("(print: (shuffled:(range:1,99)) is not (shuffled:(range:1,99)))").markupToPrint("true");
			}
		});
	});
	describe("the (rotated:) macro", function() {
		it("accepts 1 number and 2 or more arguments of any type", function() {
			expect("(rotated:)").markupToError();
			expect("(rotated:1)").markupToError();
			expect("(rotated:1,2)").markupToError();
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 2; i < 10; i += 1) {
					expect("(rotated: 1, " + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("returns an array containing arguments 1+, rotated by the number", function() {
			runPassage("(set: $a to (rotated:1,1,2,3,4))");
			expect("(print: $a)").markupToPrint("4,1,2,3");
		});
		it("produces an error if the number is greater than the quantity of items", function() {
			expect("(rotated:5,1,2,3,4))").markupToError();
		});
		it("produces an error if the number is 0", function() {
			expect("(rotated:0,1,2,3,4))").markupToError();
		});
	});
	describe("the (sorted:) macro", function() {
		it("accepts 2 or more string arguments", function() {
			expect("(sorted:)").markupToError();
			expect("(sorted: 'A')").markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(sorted:" + ("'X',").repeat(i) + ")").not.markupToError();
			}
		});
		it("returns an array of the items, sorted in natural-sort order", function() {
			expect("(sorted:'D1','E','e','É','D11','D2','F')").markupToPrint("D1,D2,D11,e,E,É,F");
		});
	});
	describe("the (datanames:) macro", function() {
		it("accepts 1 datamap", function() {
			expect("(datanames:)").markupToError();
			expect("(datanames: (datamap:'1','1'))").not.markupToError();
			expect("(datanames: (datamap:'1','1'), (datamap:'2','1'))").markupToError();
		});
		it("returns an array containing the names in the datamap, in original case", function() {
			runPassage("(set: $a to (datamap:'A',1,'b',2,'C',3))");
			expect("(print: (datanames:$a))").markupToPrint("A,b,C");
			expect("(print: (datanames:(datamap:)))").markupToPrint("");
		});
		it("returns the names in natural-sort order", function() {
			runPassage("(set: $a to (datamap:'D1',1,'E',2,'e',3,'É',4,'D11',5,'D2',6,'F',7))");
			expect("(print: (datanames:$a))").markupToPrint("D1,D2,D11,e,E,É,F");
		});
	});
	describe("the (datavalues:) macro", function() {
		it("accepts 1 datamap", function() {
			expect("(datavalues:)").markupToError();
			expect("(datavalues: (datamap:'1','1'))").not.markupToError();
			expect("(datavalues: (datamap:'1','1'), (datamap:'2','1'))").markupToError();
		});
		it("returns an array containing the values in the datamap", function() {
			runPassage("(set: $a to (datamap:'A', 'Food', 'B', 7, 'C', (a:1, 2, 'Hey')))");
			expect("(print: (datavalues:$a))").markupToPrint("Food,7,1,2,Hey");
			expect("(print: (datavalues:(datamap:)))").markupToPrint("");
		});
		it("returns the values in their names's natural-sort order", function() {
			runPassage("(set: $a to (datamap:'D1',1,'E',2,'e',3,'É',4,'D11',5,'D2',6,'F',7))");
			expect("(print: (datavalues:$a))").markupToPrint("1,6,5,3,2,4,7");
		});
	});
	describe("the (datamap:) macro", function() {
		it("accepts any even number and type of arguments, but requires strings or numbers in the odd positions", function() {
			expect("(datamap:'X',(a:))").not.markupToError();
			expect("(datamap:1,2,3,'B',4,true)").not.markupToError();
			expect("(datamap:2,3,4,5,6,7,8,9,10,11,12,13)").not.markupToError();
			expect("(datamap:(a:),1)").markupToError();
			expect("(datamap:1)").markupToError();
		});
		it("can't store a string key and a number key which are similar", function() {
			for(var i = -5; i < 5; i += 1) {
				expect("(datamap:" + i + ',(a:),"' + i + '",(a:)' + ")").markupToError();
			}
		});
		it("can't reference a string key and a number key which are similar, either", function() {
			expect("(print: (datamap:25, 'foo')'s '25'))").markupToError();
			expect("(print: (datamap:'25', 'foo')'s 25))").markupToError();
		});
		it("can't use two identical keys in the same macro call", function() {
			expect("(datamap:1,(a:),1,(a:))").markupToError();
			expect("(datamap:'A',(a:),'A',(a:))").markupToError();
		});
		it("is aliased as (dm:)", function() {
			expect("(print:(dm:'X',5) is (datamap:'X',5))").markupToPrint('true');
		});
	});
	describe("the (dataset:) macro", function() {
		it("accepts 0 or more arguments of any primitive type", function() {
			["1", "'X'", "true", "(a:)", "(font:'Skia')"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expect("(dataset:" + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("is aliased as (ds:)", function() {
			expect("(print:(ds:5) is (dataset:5))").markupToPrint('true');
		});
	});
	describe("the (count:) macro", function() {
		it("accepts 1 string or array argument, then an argument of any valid value", function() {
			expect("(count:)").markupToError();
			expect("(count: (a:'1'))").markupToError();
			expect("(count: 2, 2)").markupToError();
			expect("(count: '2', 2)").markupToError();
			expect("(count: '2', 'a')").not.markupToError();
			expect("(count: (a:6,7), 1)").not.markupToError();
			expect("(count: (datamap:6,7), 1)").markupToError();
			expect("(count: (dataset:6,7), 1)").markupToError();
		});
		it("returns the number of occurrences of the value in the container", function() {
			expect("(count: 'AAAA', 'B')").markupToPrint('0');
			expect("(count: 'AAAA', 'A')").markupToPrint('4');

			expect("(count: (a:6,7), 1)").markupToPrint('0');
			expect("(count: (a:6,7,6,6), 6)").markupToPrint('3');
		});
		it("compares values by structural equality", function() {
			expect("(count: (a:(font:'Skia')), (font:'Skia'))").markupToPrint('1');
			expect("(count: (a:(a:2,3),(a:2,3)), (a:2,3))").markupToPrint('2');
		});
	});
});

