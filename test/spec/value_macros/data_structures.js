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
		it("accepts 2 integers", function() {
			expect("(range:)").markupToError();
			expect("(range:1)").markupToError();
			expect("(range:1,3)").not.markupToError();
			expect("(range:1,3,4)").markupToError();
			expect("(range:1.1,3)").markupToError();
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
	describe("the (repeated:) macro", function() {
		it("accepts 1 integer and 1 or more arguments of any type", function() {
			expect("(repeated:)").markupToError();
			expect("(repeated:1)").markupToError();
			expect("(repeated:'A')").markupToError();
			expect("(repeated:'A',2)").markupToError();
			expect("(repeated:1.1,2)").markupToError();
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 1; i < 10; i += 1) {
					expect("(repeated: 1, " + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("returns an array containing the arguments repeated the given number of times", function() {
			runPassage("(set: $a to (repeated:4,1,2,3,4))");
			expect("(print: $a)").markupToPrint("1,2,3,4,1,2,3,4,1,2,3,4,1,2,3,4");
			runPassage("(set: $b to (repeated:8,1))");
			expect("(print: $b)").markupToPrint("1,1,1,1,1,1,1,1");
		});
		it("produces an error if the number is smaller than 0", function() {
			expect("(repeated:-2,1,2,3,4))").markupToError();
			expect("(repeated:0,1,2,3,4))").not.markupToError();
		});
	});
	describe("the (interlaced:) macro", function() {
		it("accepts 2+ arrays", function() {
			expect("(interlaced:)").markupToError();
			expect("(interlaced:1)").markupToError();
			expect("(interlaced:1,2)").markupToError();
			expect("(interlaced:(a:1),(a:2)").not.markupToError();
			expect("(interlaced:(a:1),(a:2),(a:1),(a:2)").not.markupToError();
		});
		it("returns an array containing the arrays interleaved", function() {
			expect("(interlaced:(a:1,2),(a:'A','B'),(a:0,0))").markupToPrint("1,A,0,2,B,0");
		});
		it("returns an array sized to the smallest passed array", function() {
			expect("(interlaced:(a:1,2),(a:'A','B','C','D'))").markupToPrint("1,A,2,B");
			expect("(interlaced:(a:),(a:'A','B','C','D'))").markupToPrint("");
		});
	});
	describe("the (subarray:) macro", function() {
		it("accepts 1 array argument, then two integer arguments", function() {
			expect("(subarray:)").markupToError();
			expect("(subarray: (a:'1'))").markupToError();
			expect("(subarray: (a:6,7), 1, 2)").markupToPrint('6,7');
			expect("(subarray: (a:'1'), 1.2, 3)").markupToError();
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
		it("refuses zero indices", function() {
			expect("(subarray: (a:8,7,6,5,4), 0, 2)").markupToError();
		});
		it("doesn't pass contained data by reference", function() {
			expect("(set:$a to (a:1,2,3))"
				+"(set:$b to (subarray: (a:$a), 1, 1))"
				+"(set:$b's 1st's 1st to 4)$a").markupToPrint("1,2,3");
		});
	});
	describe("the (shuffled:) macro", function() {
		it("accepts 0 or more arguments of any type", function() {
			expect("(shuffled:)").not.markupToError();
			expect("(shuffled:1)").not.markupToError();
			["1", "'X'", "true","empty","via its 1st","red"].forEach(function(e) {
				for(var i = 2; i < 10; i += 1) {
					expect("(shuffled:" + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("returns an array containing the arguments", function() {
			expect("(print:(shuffled:) is an array)").markupToPrint("true");
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
				expect("(print: (shuffled:...(range:1,99)) is not (shuffled:...(range:1,99)))").markupToPrint("true");
			}
		});
		it("doesn't pass contained data by reference", function() {
			expect("(set:$a to (a:1,2,3))"
				+"(set:$b to (shuffled: $a, $a))"
				+"(set:$b's 1st's 1st to 4)$a").markupToPrint("1,2,3");
		});
	});
	describe("the (reversed:) macro", function() {
		it("accepts zero or more arguments of any type", function() {
			expect("(reversed:)").not.markupToError();
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 2; i < 10; i += 1) {
					expect("(reversed: " + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("returns an array containing the arguments in reverse order", function() {
			expect("(print:(reversed:) is an array)").markupToPrint("true");
			runPassage("(set: $a to (reversed:1,2,3,5,'foo'))");
			expect("(print: $a)").markupToPrint("foo,5,3,2,1");
		});
		it("doesn't pass contained data by reference", function() {
			expect("(set:$a to (a:1,2,3))"
				+"(set:$b to (reversed: $a, $a))"
				+"(set:$b's 1st's 1st to 4)$a").markupToPrint("1,2,3");
		});
	});
	describe("the (rotated:) macro", function() {
		it("accepts 1 integer and 0 or more arguments of any type", function() {
			expect("(rotated:)").markupToError();
			expect("(rotated:1)").not.markupToError();
			expect("(rotated:1,2)").not.markupToError();
			expect("(rotated:1.5,2,3)").markupToError();
			["1", "'X'", "true","empty","via its 1st","red"].forEach(function(e) {
				for(var i = 2; i < 10; i += 1) {
					expect("(rotated: 1, " + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("returns an array containing arguments 1+, rotated by the number", function() {
			expect("(print:(rotated:1) is an array)").markupToPrint("true");
			runPassage("(set: $a to (rotated:1,1,2,3,4))");
			expect("(print: $a)").markupToPrint("4,1,2,3");
			runPassage("(set: $a to (rotated:-2,1,2,3,4))");
			expect("(print: $a)").markupToPrint("3,4,1,2");
			expect("(rotated:5,1,2,3,4)").markupToPrint("4,1,2,3");
			expect("(rotated:9,1,2,3,4)").markupToPrint("4,1,2,3");
			expect("(rotated:-5,1,2,3,4)").markupToPrint("2,3,4,1");
			expect("(rotated:-9,1,2,3,4)").markupToPrint("2,3,4,1");
		});
		it("produces an error if the number is 0", function() {
			expect("(rotated:0,1,2,3,4))").markupToError();
		});
		it("doesn't pass contained data by reference", function() {
			expect("(set:$a to (a:1,2,3))"
				+"(set:$b to (rotated: 1, $a, $a))"
				+"(set:$b's 1st's 1st to 4)$a").markupToPrint("1,2,3");
		});
	});
	describe("the (rotated-to:) macro", function() {
		it("accepts 1 lambda and 2 or more arguments of any type", function() {
			expect("(rotated-to:)").markupToError();
			expect("(rotated-to: where it is 2)").markupToError();
			expect("(rotated-to: where it is 2, 1)").markupToError();
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 2; i < 10; i += 1) {
					expect("(rotated-to: where it is " + e + ", " + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("returns an array containing arguments 1+, rotated to the first value that satisfies the lambda", function() {
			runPassage("(set: $a to (rotated-to:where it > 3,1,2,3,4))");
			expect("(print: $a)").markupToPrint("4,1,2,3");
			runPassage("(set: $a to (rotated-to:where it is 3,1,2,3,4))");
			expect("(print: $a)").markupToPrint("3,4,1,2");
		});
		it("produces an error if the lambda doesn't match any items", function() {
			expect("(rotated: where it is 5,1,2,3,4))").markupToError();
		});
	});
	describe("the (sorted:) macro", function() {
		it("accepts an optional 'via' lambda, plus 0 or more number or string arguments", function() {
			expect("(sorted:)").not.markupToError();
			expect("(sorted: 'A')").not.markupToError();
			expect("(sorted: 3)").not.markupToError();
			expect("(sorted: via it, 3)").not.markupToError();
			expect("(sorted: (a:2))").markupToError();
			expect("(sorted: via its 1st, (a:2))").not.markupToError();
			for(var i = 2; i < 10; i += 1) {
				expect("(sorted:" + ("'X',").repeat(i) + ")").not.markupToError();
				expect("(sorted:" + ("61,").repeat(i) + ")").not.markupToError();
			}
		});
		it("returns an array of the items, sorted in natural-sort order", function() {
			expect("(print:(sorted:) is an array)").markupToPrint("true");
			expect("(sorted:'D1','E','e','É','D11','D2','F',1,' 1',2)").markupToPrint("1, 1,2,D1,D2,D11,e,E,É,F");
			expect("(sorted:'Foo', 'Bar', 'Baz', 'foo', 'bar', 'baz')").markupToPrint("bar,Bar,baz,Baz,foo,Foo");
		});
		it("doesn't coerce the types", function() {
			expect("(print: (sorted:2,11,1)'s 2nd + 3)").markupToPrint("5");
			expect("(print: (sorted:'A','D','B','C')'s 2nd + 'OO')").markupToPrint("BOO");
		});
		it("when given an optional 'via' lambda, sorts the values using the lambda", function() {
			expect("(sorted:via (str:it)'s length,'garply',2,200,2000)").markupToPrint("2,200,2000,garply");
			expect('(sorted: via its length * -1, "Gus", "Arthur", "William")').markupToPrint("William,Arthur,Gus");
			expect('(sorted: via its last, "Gus", "Arthur", "William")').markupToPrint("William,Arthur,Gus");
			expect("(print:(sorted: via its h, orange, red, blue, yellow)'s 1st is red)").markupToPrint('true');
		});
		it("lambda sorts are stable", function() {
			expect("(sorted:via its 1st, 'Bob', 'Alice', 'Blake', 'Bella', 'Bertrude')").markupToPrint("Alice,Bob,Blake,Bella,Bertrude");
			expect("(sorted:via (str:it)'s 1st, 10,12,11,14,13,16)").markupToPrint("10,12,11,14,13,16");
			expect("(sorted:via its 1st, ...(sorted:via its last, (a:1,2),(a:1,5),(a:2,6),(a:1,1),(a:2,4),(a:1,7),(a:2,9),(a:1,8)))").markupToPrint("1,1,1,2,1,5,1,7,1,8,2,4,2,6,2,9");
		});
		it("errors if the first value is a lambda but not a 'via' lambda", function() {
			expect("(sorted:where it > 0,1,2)").markupToError();
		});
		it("errors if the 'via' lambda doesn't produce a number or string", function() {
			expect("(sorted:via (a:it),1,2)").markupToError();
		});
	});
	describe("the (unique:) macro", function() {
		it("accepts 0 or more arguments of any type", function() {
			for(var i = 0; i < 10; i+= 1) {
				expect("(unique:" + ["1", "'X'", "true","empty","via its 1st","red"].slice(0,i) + ")").not.markupToError();
			}
		});
		it("returns an array containing the arguments, in order, skipping repeats after their first occurrence", function() {
			expect("(verbatim-source:(unique: (a:2), 2, (a:2), 3, 2))").markupToPrint("(a:(a:2),2,3)");
			expect("(unique:1,1,2,1,1,3,1,3)").markupToPrint("1,2,3");
			expect("(print:(unique:) is an array)").markupToPrint("true");
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
		it("is aliased as (dm-names:) and (datamap-names:)", function() {
			expect("(print: (datanames:(dm:'D1',1,'E',2)) is (datamapnames:(dm:'D1',1,'E',2)))").markupToPrint("true");
			expect("(print: (datanames:(dm:'D1',1,'E',2)) is (dm-names:(dm:'D1',1,'E',2)))").markupToPrint("true");
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
		it("doesn't pass data by reference", function() {
			expect("(set:$a to (a:1,2,3))"
				+"(set:$b to (datavalues: (datamap: 'a', $a)))"
				+"(set:$b's 1st's 1st to 4)$a").markupToPrint("1,2,3");
		});
		it("is aliased as (dm-values:) and (datamap-values:)", function() {
			expect("(print: (datavalues:(dm:'D1',1,'E',2)) is (dm-values:(dm:'D1',1,'E',2)))").markupToPrint("true");
			expect("(print: (datavalues:(dm:'D1',1,'E',2)) is (datamap-values:(dm:'D1',1,'E',2)))").markupToPrint("true");
		});
	});
	describe("the (dm-entries:) macro", function() {
		it("accepts 1 datamap", function() {
			expect("(dm-entries:)").markupToError();
			expect("(dm-entries: (datamap:'1','1'))").not.markupToError();
			expect("(dm-entries: (datamap:'1','1'), (datamap:'2','1'))").markupToError();
		});
		it("returns an array containing datamaps of the name/value pairs in the datamap", function() {
			runPassage("(set: $a to (datamap:'A', 'Food', 'B', 7))");
			expect("(print: (dm-entries:$a)'s 1st's name)").markupToPrint("A");
			expect("(print: (dm-entries:$a)'s 1st's value)").markupToPrint("Food");
			expect("(print: (dm-entries:$a)'s 2nd's name)").markupToPrint("B");
			expect("(print: (dm-entries:$a)'s 2nd's value)").markupToPrint("7");
			expect("(print: (datanames:(dmentries:$a)'s 2nd))").markupToPrint("name,value");
			expect("(print: (dmentries:(datamap:))'s length)").markupToPrint("0");
		});
		it("returns the pairs in their names's natural-sort order", function() {
			runPassage("(set: $a to (datamap:'D1',1,'E',2,'e',3,'É',4,'D11',5,'D2',6,'F',7))");
			expect("(altered: _entry via _entry's name, ...(dmentries: $a))").markupToPrint("D1,D2,D11,e,E,É,F");
		});
		it("doesn't pass data by reference", function() {
			expect("(set:$a to (a:1,2,3))"
				+"(set:$b to (dmentries: (datamap: 'a', $a)))"
				+"(set:$b's 1st's value's 1st to 4)$a").markupToPrint("1,2,3");
		});
		it("is aliased as (data-entries:) and (datamap-entries:)", function() {
			expect("(print: (dataentries:(dm:'D1',1,'E',2)) is (dm-entries:(dm:'D1',1,'E',2)))").markupToPrint("true");
			expect("(print: (dataentries:(dm:'D1',1,'E',2)) is (datamap-entries:(dm:'D1',1,'E',2)))").markupToPrint("true");
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
			expect("(print: (datamap:25, 'foo')'s '25')").markupToError();
			expect("(print: (datamap:'25', 'foo')'s 25)").markupToError();
		});
		it("can't use two identical keys in the same macro call", function() {
			expect("(datamap:1,(a:),1,(a:))").markupToError();
			expect("(datamap:'A',(a:),'A',(a:))").markupToError();
		});
		it("is aliased as (dm:)", function() {
			expect("(print:(dm:'X',5) is (datamap:'X',5))").markupToPrint('true');
		});
		it("can be printed with (print:)", function() {
			var td = Array.from(runPassage("(print:(datamap:'A',1,'B',2))").find('table td')).map(function(e) { return $(e).text(); });
			expect(td.join(',')).toBe('A,1,B,2');
		});
		it("doesn't pass data by reference", function() {
			expect("(set:$a to (a:1,2,3))"
				+"(set:$b to (datamap: 'a', $a))"
				+"(set:$b's a's 1st to 4)$a").markupToPrint("1,2,3");
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
		it("produces a dataset containing all of the unique items", function() {
			runPassage("(set: $set to (dataset:'s',true,(a:),1,(a:)))");
			expect("(print: $set contains true)").markupToPrint("true");
			expect("(print: $set contains (a:))").markupToPrint("true");
			expect("(print: $set contains 1)").markupToPrint("true");
			expect("(print: $set contains 's')").markupToPrint("true");
			expect("(print: $set contains '1')").markupToPrint("false");
		});
		it("compares objects by value when constructing", function() {
			expect("(set: $a to (a:))(set:$ds to (ds:$a,$a,$a))").not.markupToError();
			expect("(print:$ds's length)").markupToPrint('1');
		});
		it("when spread, returns the values in their natural-sort order", function() {
			runPassage("(set: $set to (dataset:'D1','E','É','D11','D2','F','E'))");
			expect("(print: (a:...$set))").markupToPrint("D1,D2,D11,E,É,F");
		});
		it("is aliased as (ds:)", function() {
			expect("(print:(ds:5) is (dataset:5))").markupToPrint('true');
		});
		it("doesn't pass data by reference", function() {
			expect("(set:$a to (a:1,2,3))"
				+"(set:$b to (dataset: $a))"
				+"(set:$a's 1st to 4)(print: $a is in $b)").markupToPrint("false");
		});
	});
	describe("the (permutations:) macro", function() {
		it("returns the permutations of the given input values", function() {
			expect('(print:(permutations: "☆", "♡", "∪") is (a:(a:"☆","♡","∪"),(a:"♡","☆","∪"),(a:"∪","☆","♡"),(a:"☆","∪","♡"),(a:"♡","∪","☆"),(a:"∪","♡","☆")))').markupToPrint('true');
			expect('(print:(permutations: (size:1.5)) is (a:(a:(size:1.5))))').markupToPrint('true');
		});
		it("returns an empty array when given no values", function() {
			expect('(print:(permutations:) is (a:))').markupToPrint('true');
		});
	});
	describe("the (count:) macro", function() {
		it("accepts 1 string or array argument, then arguments of any valid value", function() {
			expect("(count:)").markupToError();
			expect("(count: (a:'1'))").markupToError();
			expect("(count: 2, 2)").markupToError();
			expect("(count: '2', 2)").markupToError();
			expect("(count: (a:), 2,2,2,2,2,2)").not.markupToError();
			expect("(count: '2', 'a')").not.markupToError();
			expect("(count: (a:6,7), 1)").not.markupToError();
			expect("(count: (datamap:6,7), 1)").markupToError();
			expect("(count: (dataset:6,7), 1)").markupToError();
			expect("(count: 'ABRACADABRA', 'RA', 'B', 'C', (a:))").markupToError();
		});
		it("returns the number of occurrences of the value in the container", function() {
			expect("(count: 'AAAA', 'B')").markupToPrint('0');
			expect("(count: 'AAAA', 'A')").markupToPrint('4');
			expect("(count: 'AAAA', 'A', '')").markupToPrint('4');
			expect("(count: 'ABRACADABRA', 'RA', 'B', 'C', 'E')").markupToPrint('5');

			expect("(count: (a:6,7), 1)").markupToPrint('0');
			expect("(count: (a:6,7,6,6), 6)").markupToPrint('3');
		});
		it("counts string occurrences independently", function() {
			expect("(count: 'UGH', 'GH', 'H')").markupToPrint('2');
		});
		it("compares values by structural equality", function() {
			expect("(count: (a:(font:'Skia')), (font:'Skia'))").markupToPrint('1');
			expect("(count: (a:(a:2,3),(a:2,3)), (a:2,3))").markupToPrint('2');
		});
	});
	['source','verbatim-source'].forEach(function(e,i) {
		describe("the (" + e + ":) macro", function() {
			function sourceTest(val,result) {
				expect(i ? ("(verbatim-source:"+val+")") : ("(print:'`'+(source:"+val+")+'`')")).markupToPrint(result);
			}
			it("serialises basic types", function() {
				sourceTest("1.56+1","2.56");
				sourceTest("21s","21000");
				sourceTest("'fo' + 'obar'","\"foobar\"");
				sourceTest("not true","false");
			});
			it("serialises basic data structures, sorted if the structure isn't sequential", function() {
				sourceTest("(a:2,(a:5))","(a:2,(a:5))");
				sourceTest("(sorted:5,1,2,3,4)","(a:1,2,3,4,5)");
				sourceTest("(a:(a:...(a:2,3,4)))'s 1st","(a:2,3,4)");

				sourceTest("(dm:'foo',1,'bar',2)",'(dm:"bar",2,"foo",1)');
				sourceTest("(dm:)","(dm:)");

				sourceTest("(ds:5,1,2,3,4)","(ds:1,2,3,4,5)");
				sourceTest("(ds:)","(ds:)");
			});
			it("serialises changers and combined changers", function() {
				['(link:"foo")','(hidden:)','(text-indent:2)','(transition:"instant")','(if:true)',
					'(text-indent:2)+(css:"display:block;")','(transition:"instant")+(transition-delay:20)',
					'(replace:?foo\'s 1st)','(append:"bar")',"(prepend:?foo's last + ?bar's 3rdlast + ?baz's (a:2,5))",
					"(output:)"
				].forEach(function(e){ sourceTest(e,e); });
				sourceTest("(size:10)",'(text-size:10)');
			});
			it("serialises colours", function() {
				sourceTest("#ff0009",'(hsl:358,1,0.5)');
				sourceTest("(hsl:56,1,0.5,0.3)",'(hsl:56,1,0.5,0.3)');
				sourceTest("(lch:0.6,80,122)",'(lch:0.6,80,122)');
				[
					"red",
					"orange",
					"yellow",
					"lime",
					"green",
					"cyan",
					"blue",
					"navy",
					"purple",
					"magenta",
					"white",
					"black",
					"gray",
					"transparent",
				].forEach(function(name) {
					sourceTest(name,name);
				});
				sourceTest("aqua","cyan");
				sourceTest("fuchsia","magenta");
				sourceTest("grey","gray");
			});
			it("serialises gradients", function() {
				sourceTest("(gradient: 0, 0, black, 0.49, #ff0009, 0.5, white, 1, white)",'(gradient:0,0,black,0.49,(hsl:358,1,0.5),0.5,white,1,white)');
			});
			it("serialises code hooks", function() {
				sourceTest("[A**B**C]","[A**B**C]");
			});
			it("serialises commands", function() {
				['(cycling-link:bind $foo,"bar","baz")','(click-goto:"qux","test")',
					'(enchant:?foo,(transition:"instant")+(transition-delay:20))',
					'(show:(hooks-named:"foo baz"))',
				].forEach(function(e){ sourceTest(e,e); });
				runPassage("(set:$baz to 4)");
				sourceTest("(print:$baz)",'(print:4)');
				sourceTest('(sequence-link:2bind $foo,"bar","baz")','(seq-link:2bind $foo,"bar","baz")');
			});
			it("serialises custom macros", function() {
				sourceTest('(macro:boolean-type _ok,num-type _ng,[(output:(cond:_ok,_ng,1)])','(macro:bool-type _ok,num-type _ng,[(output:(cond:_ok,_ng,1)])');
				sourceTest('(macro:[])','(macro:[])');
			});
			it("serialises (partial:) macros", function() {
				sourceTest('(partial:"range",3)','(partial:"range",3)');
				sourceTest('(partial:"enchant",?hook,(text-colour:black))','(partial:"enchant",?hook,(text-colour:black))');
				runPassage('(set: $a to (macro:alnum-type _a,[(out-data:_a)]))');
				sourceTest('(partial:$a,"A")','(partial:(macro:alnum-type _a,[(out-data:_a)]),"A")');
			});
			it("serialises lambdas", function() {
				[
					'_item making _total via _total + (max: _item, 0)', '_item where _item\'s 1st is "A"', 'when $fuel > 8', '_item via _item + "s"', 'each _item'
				].forEach(function(e){ sourceTest(e,e); });
			});
			it("doesn't serialise errors", function() {
				expect('(' + e + ':"red"+2)').markupToError();
			});
			if (i === 0) {
				it("serialises changers and commands with optional arguments", function() {
					expect("(set: $a to (" + e + ": (seq-link:bind $foo,'A','B')))").not.markupToError();
					expect("(set: $a to (" + e + ": (seq-link:'A','B')))").not.markupToError();
					expect("(set: $a to (" + e + ": (box:'A')))").not.markupToError();
					expect("(set: $a to (" + e + ": (box:'A',1)))").not.markupToError();
					expect("(set: $a to (" + e + ": (linkgoto:'A')))").not.markupToError();
					expect("(set: $a to (" + e + ": (linkgoto:'A','B')))").not.markupToError();
				});
			}
			else {
				it("is aliased as (v6m-source:)", function() {
					expect("(print:(v6m-source:2) is (verbatim-source:2))").markupToPrint('true');
				});
			}
			it("can serialise custom macros' commands", function() {
				runPassage('(set:$a to (macro:any-type _a, any-type _b, [(output:)[]]))(set:$b to $a)(set:$c to $a)');
				sourceTest('($a:)','($a:)');
				sourceTest('($b:24,"A")','($b:24,"A")');
				sourceTest('($c:24,"A")','($c:24,"A")');
				sourceTest('($a:24,"A")','($a:24,"A")');
			});
		});
	});
});

