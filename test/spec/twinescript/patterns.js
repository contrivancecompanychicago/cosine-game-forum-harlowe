describe("patterns", function() {
	'use strict';
	var datatypes = ["array", "boolean", "changer", "colour", "gradient",
		"color", "command", "dm", "datamap", "ds", "dataset", "datatype",
		"number", "num", "string", "str"];

	var typesAndValues = [
		[2,"number","num"],
		["'X'","string","str"],
		['(a:)',"array"],
		['true',"boolean","bool"],
		['(dm:)',"datamap","dm"],
		['(ds:)','dataset',"ds"],
		['red','colour','color'],
		['whitespace','datatype',undefined],
		['(_a where _a is 2)','lambda',undefined,'no structural equality'],
		['(macro:[(output:1)])','macro',undefined,'no structural equality'],
		['(gradient:90,0,red,1,white)','gradient']
	];
	describe("datatypes", function() {
		it("are keywords matching permitted storable values", function() {
			datatypes.forEach(function(name) {
				var name2 = (
					name === "dm" ? "datamap" :
					name === "ds" ? "dataset" :
					name === "num" ? "number" :
					name === "str" ? "string" :
					name === "color" ? "colour" :
					name === "bool" ? "boolean" :
					name
				);
				expect("(print:" + name +")").markupToPrint("[the " + name2 + " datatype]");
			});
		});
		it("resist most operations", function() {
			expect("(print:num + str)").markupToError();
			expect("(print:num - str)").markupToError();
			expect("(print:num is in str)").markupToError();
			expect("(print:num contains str)").markupToError();
			expect("(print:num and str)").markupToError();
		});
	});
	function isATest(op) {
		typesAndValues.forEach(function(e) {
			datatypes.forEach(function(name) {
				if (name === "datatype" && op.includes("match")) {
					return;
				}
				// e[1] and e[2] are datatypes that e[0] is.
				// They don't fit, however, if the datatype is "datatype" and the operation is "matches"
				var matchingType = (name === e[1] || name === e[2]);

				expect("(print:" + e[0] + " " + op + " " + name + ")").markupToPrint((op.includes(" not ") !== matchingType) + '');
			});
		});
	}
	describe("the 'is a' operator", function() {
		it("checks if the left side is an instance of the right type", function() {
			isATest("is a");
		});
		it("can also be written as 'is an'", function() {
			isATest("is an");
		});
		it("can be negated using the form 'is not a' or 'is not an'", function() {
			isATest("is not a");
			isATest("is not an");
		});
		it("errors when the right side is not a datatype", function() {
			expect("(print: 2 is a 2)").markupToError();
			expect("(print: (a:) is a (a:))").markupToError();
			expect("(print: 'x' is a 'string')").markupToError();
		});
		it("has correct order of operations with 'to' and 'into'", function (){
			expect("(set: $a to 2 is a num)(print:$a)").markupToPrint("true");
			expect("(put: 2 is a num into $a)(print:$a)").markupToPrint("true");
			expect("(set: $a to 2 is a str)(print:$a)").markupToPrint("false");
			expect("(put: 2 is a str into $a)(print:$a)").markupToPrint("false");
		});
		it("can compare variables as the subject of 'to' and 'into'", function (){
			runPassage("(set:$a to 1)");
			expect("(set: $b to $a is a number)(print:$b)").markupToPrint("true");
			expect("(put: $a is a number into $b)(print:$b)").markupToPrint("true");
		});
		it("works with elisions", function () {
			expect("(print: 2 is a number or string)").markupToPrint("true");
			expect("(print: 2 is a str or array or color or num)").markupToPrint("true");
			expect("(print: 2 is a number and number)").markupToPrint("true");
			expect("(print: 2 is a number and true)").markupToPrint("true");
		});
		it("errors on ambiguous elisions", function () {
			expect("(print: 2 is not a number or string)").markupToError();
			expect("(print: 2 is not a number and string)").markupToError();
		});
	});
	['matches','does not match'].forEach(function(name, negative) {
		var pTrue = !negative+'';
		var pFalse = !!negative+'';
		describe("the '"+name+"' operator", function() {
			it("when given data that doesn't contain datatypes, behaves like 'is'", function() {
				expect("(print: 2 "+name+" 2)").markupToPrint(pTrue);
				expect("(print: '2' "+name+" '2')").markupToPrint(pTrue);
				expect("(print: 2 "+name+" '2')").markupToPrint(pFalse);
				expect("(print: 1 "+name+" true)").markupToPrint(pFalse);
				expect("(print: (a:2,3,4) "+name+" (a:2,3,4))").markupToPrint(pTrue);
				expect("(print: (a:2,3,4) "+name+" (a:2,3,5))").markupToPrint(pFalse);
				expect("(print: (datamap:'a',2,'b',4) "+name+" (datamap:'b',4,'a',2))").markupToPrint(pTrue);
				expect("(print: (datamap:'a',2,'b',4) "+name+" (datamap:'b',4,'a',3))").markupToPrint(pFalse);
				expect("(print: (dataset:2,3,4) "+name+" (dataset:2,3,4))").markupToPrint(pTrue);
				expect("(print: (dataset:2,3,4) "+name+" (dataset:2,3,4,5))").markupToPrint(pFalse);
			});
			it("when given single datatypes, behaves like 'is a'", function() {
				isATest(name);
			});
			typesAndValues.forEach(function(e) {
				var value = e[0], type1 = e[1], type2 = e[2] || type1;
				var structEq = e[3] !== 'no structural equality';

				it("matches the " + type1 + " datatype inside arrays to a " + type1 + " in the same position", function() {
					expect("(print: (a:" + type1 + ") "+name+" (a:" + value + "))").markupToPrint(pTrue);
					if (structEq && type1 !== "datatype") {
						expect("(print: (a:" + [type2,value,type1] + ") "+name+" (a:" + [value,value,value] + "))").markupToPrint(pTrue);
					}
					expect("(print: (a:(a:(a:" + type2 + "))) "+name+" (a:(a:(a:" + value + "))))").markupToPrint(pTrue);

					expect("(print: (a:" + type2 + ") "+name+" (a:))").markupToPrint(pFalse);
					expect("(print: (a:" + type1 + ") "+name+" (a:(a:" + value + ")))").markupToPrint(((type1 === "array") !== Boolean(negative))+'');
					expect("(print: (a:" + type1 + ",3," + type1 + ") "+name+" (a:3,2,4))").markupToPrint(pFalse);
				});
				it("matches the " + type1 + " datatype inside datamaps to a " + type1 + " in the same position", function() {
					expect("(print: (dm: 'A', " + type1 + ") "+name+" (dm: 'A', " + value + "))").markupToPrint(pTrue);
					expect("(print: (dm: " + ['"A"',type1,'"B"',type2,'"C"',"(a:" + type1 + ")"] +
						") "+name+" (dm:" + ['"A"',value,'"B"',value,'"C"',"(a:" + value + ")"] + "))").markupToPrint(pTrue);
				});
				it("matches the " + type1 + " datatype inside datasets to a " + type1 + " regardless of position", function() {
					expect("(print: (ds:" + [type1,'"Y"',false] + ") "+name+" (ds:" + ['"Y"',false,value] + "))").markupToPrint(pTrue);
				});
			});
		});
	});
	describe("exotic datatypes", function() {
		["'even' matches only even numbers", "'odd' matches only odd numbers"].forEach(function(e,i) {
			var name = ['even','odd'][i];
			it(e, function() {
				expect("(set: $a to 2 is a "+name+")(print:$a)").markupToPrint(!i+'');
				expect("(set: $a to 0 is a "+name+")(print:$a)").markupToPrint(!i+'');
				expect("(set: $a to -2.1 is a "+name+")(print:$a)").markupToPrint(!i+'');
				expect("(set: $a to -3 is a "+name+")(print:$a)").markupToPrint(!!i+'');
				expect("(set: $a to -3.9 is a "+name+")(print:$a)").markupToPrint(!!i+'');
			});
		});
		it("'whitespace' matches only whitespace", function() {
			expect("(set: $a to '' is a whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to \"        .\" is a whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to 0 is a whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to '\t\t\n' is a whitespace)(print:$a)").markupToPrint("true");
			expect("(set: $a to (str-repeated:5,' ') is a whitespace)(print:$a)").markupToPrint("true");
		});
		it("'integer' or 'int' matches integers", function() {
			expect("(set: $a to 2.1 is a integer)(print:$a)").markupToPrint("false");
			expect("(set: $a to \"2\" is a integer)(print:$a)").markupToPrint("false");
			expect("(set: $a to 2 is a integer)(print:$a)").markupToPrint("true");
			expect("(set: $a to 2 is a int)(print:$a)").markupToPrint("true");
			expect("(set: $a to -10002 is a int)(print:$a)").markupToPrint("true");
			expect("(set: $a to -10002.1 is a int)(print:$a)").markupToPrint("false");
		});
		it("'alphanumeric' or 'alnum' matches alphanumeric characters", function() {
			expect("(set: $a to '' is a alnum)(print:$a)").markupToPrint("false");
			expect("(set: $a to \"E-G\" is a alnum)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'EűG2' is a alnum)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'EűG2' is a alphanumeric)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'EűG2\n' is a alphanumeric)(print:$a)").markupToPrint("false");
		});
		it("'uppercase' or 'lowercase' matches cased characters", function() {
			expect("(set: $a to '' is a uppercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӜEAR' is a uppercase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӝear' is a lowercase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӜEAr' is a uppercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӝeaR' is a lowercase)(print:$a)").markupToPrint("false");
		});
		it("'newline' matches newlines", function() {
			expect("(set: $a to '\\r\\n' is a newline)(print:$a)").markupToPrint("true");
			expect("(set: $a to '\\n' is a newline)(print:$a)").markupToPrint("true");
			expect("(set: $a to '\\r' is a newline)(print:$a)").markupToPrint("true");
			expect("(set: $a to last of 'Red\n' is a newline)(print:$a)").markupToPrint("true");
			expect("(set: $a to '' is a newline)(print:$a)").markupToPrint("false");
		});
		it("'empty' matches only empty structures", function() {
			expect("(set: $a to (a:) is a empty)(print:$a)").markupToPrint("true");
			expect("(set: $a to (dm:) is a empty)(print:$a)").markupToPrint("true");
			expect("(set: $a to (ds:) is a empty)(print:$a)").markupToPrint("true");
			expect("(set: $a to '' is a empty)(print:$a)").markupToPrint("true");
			expect("(set: $a to (a:1) is a empty)(print:$a)").markupToPrint("false");
			expect("(set: $a to ' ' is a empty)(print:$a)").markupToPrint("false");
		});
	});
	describe("(datatype:)", function() {
		it("takes most kinds of data, and produces a datatype that matches it", function() {
			typesAndValues.forEach(function(e) {
				expect("(print:(datatype:" + e[0] + ") is " + e[1] + ")").markupToPrint("true");
			});
		});
		it("errors if given data that has no matching type", function() {
			expect("(print:(datatype:?hook))").markupToError();
			expect("(print:(datatype:[foobar]))").markupToError();
		});
	});
	describe("destructuring assignment", function() {
		describe("when given an array pattern assignment request", function() {
			it("sets the variable in the pattern to their matching values", function() {
				[
					["(a:$a)", "(a:2)"],
					["(a:num-type $a)", "(a:2)"],
					["(a:5,num,num,num-type $a,num)","(a:5,4,3,2,1)"],
					["(a:(a:num,num-type $a),num)","(a:(a:1,2),3)"],
				].forEach(function(arr) {
					expect("(set: "+arr[0]+" to "+arr[1]+")$a").markupToPrint("2");
					expect("(put: "+arr[1]+" into "+arr[0]+")$a").markupToPrint("2");
				});
			});
			it("can set multiple variables at once", function() {
				expect("(set: (a:num-type $a, num-type $b) to (a:2,3))$a $b").markupToPrint("2 3");
				expect("(set: (a:num,num-type $c, (a:num-type _d)) to (a:2,3,(a:4)))$c _d").markupToPrint("3 4");
			});
			it("works with (move:)", function() {
				expect("(set:$c to (a:1,2,3,4,5,6))" +
					"(move: $c into (a:1,num-type $red, num-type $blue))$red $blue").markupToPrint("2 3");
				expect("$c").markupToPrint("1,4,5,6");
			});
			it("does not alter the value of 'it'", function() {
				expect("(set:$c to 'foo')" +
					"(set: (a:num-type $red, num-type $blue) to (a:2,it))$red $blue").markupToPrint("2 0");
			});
			it("can be used to exchange variables", function() {
				runPassage("(set: (a:num-type $a, num-type $b, num-type $c) to (a:2,3,4))");
				expect("(set: (a:num-type $a, num-type $b, num-type $c) to (a:$c,$b,$a))$a $b $c").markupToPrint("4 3 2");
			});
			it("errors if the pattern doesn't match", function() {
				expect("(set: (a:5,num,num,num-type $a,num) to (a:6,4,3,2,1))$a").markupToError();
				expect("(set: (a:5,num,num,num-type $a,num) to (a:5,4,'3',2,1))$a").markupToError();
				expect("(set: (a:num-type $a,num,num) to (a:5,4))$a").markupToError();
				expect("(set: (a:(a:num,num-type $a),num) to (a:(a:1),3))$a").markupToError();
			});
			it("doesn't error if the source structure has more values than the pattern", function() {
				expect("(set: (a:num-type $a) to (a:5,4,3,2,1))$a").markupToPrint("5");
			});
		});
		describe("when given a datamap pattern assignment request", function() {
			it("sets the typed variable in the pattern to their matching values", function() {
				[
					["(dm:'foo',num-type $a)", "(dm:'foo',2)"],
					["(dm:'foo',5,'bar',num-type $a,'baz',3)","(dm:'foo',5,'baz',3,'bar',2)"],
					["(dm:'foo',5,'bar',(dm:'foo',num-type $a))","(dm:'foo',5,'bar',(dm:'foo',2))"],
				].forEach(function(arr) {
					expect("(set: "+arr[0]+" to "+arr[1]+")$a").markupToPrint("2");
					expect("(put: "+arr[1]+" into "+arr[0]+")$a").markupToPrint("2");
				});
			});
			it("can set multiple variables at once", function() {
				expect("(set: (dm:'foo',num-type $a,'bar',num-type $b) to (dm:'foo',2,'bar',3))$a $b").markupToPrint("2 3");
				expect("(set: (dm:'baz',num-type $c,'qux',(dm:'foo',num-type _d)) to (dm:'baz',3,'qux',(dm:'foo', 4)))$c _d").markupToPrint("3 4");
			});
			it("works with (move:)", function() {
				expect("(set:$c to (dm:'foo',3,'bar',2))" +
					"(move: $c into (dm:'foo',num-type $blue,'bar',num-type $red))$red $blue").markupToPrint("2 3");
				expect("(print:$c contains 'foo')").markupToPrint("false");
			});
			it("does not alter the value of 'it'", function() {
				expect("(set:$c to 'foo')" +
					"(set: (dm:'foo',num-type $red,'bar',num-type $blue) to (dm:'foo',2,'bar',it))$red $blue").markupToPrint("2 0");
			});
			it("errors if the pattern doesn't match", function() {
				expect("(set: (dm:'foo',num-type $a,'bar',num-type $b) to (dm:'foo',2,'baz',3))").markupToError();
				expect("(set: (dm:'foo',num-type $a,'bar',str-type $b) to (dm:'foo',2,'baz',3))").markupToError();
				expect("(set: (dm:'foo',2,'bar',num-type $b) to (dm:'foo',4,'bar',1))").markupToError();
			});
			it("doesn't error if the source structure has more values than the pattern", function() {
				expect("(set: (dm:'foo',num-type $a) to (dm:'foo',5,'qux',4,'baz',3))$a").markupToPrint("5");
			});
		});
	});
});
