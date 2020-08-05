describe("patterns", function() {
	'use strict';
	// Only the basic datatypes should be represented here.
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
				// This needs to correspond with a similar statement in datatype.js
				var name2 = (
					name === "datamap"  ? "dm" :
					name === "dataset"  ? "ds" :
					name === "number"   ? "num" :
					name === "string"   ? "str" :
					name === "color"    ? "colour" :
					name === "boolean"  ? "bool" :
					name === "alphanumeric" ? "alnum" :
					name === "integer"  ? "int" :
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
				it("matches spread " + type1 + " datatype inside arrays to any number of " + type1 + "s in the same position", function() {
					// Spread -> Value
					expect("(print: (a: ..." + type1 + ") "+name+" (a:" + value + "))").markupToPrint(pTrue);
					expect("(print: (a: ..." + type1 + ") "+name+" (a:" + Array(7).fill(value) + "))").markupToPrint(pTrue);
					expect("(print: (a: ..." + type1 + ") "+name+" (a:(size:1)))").markupToPrint(pFalse);
					expect("(print: (a: ..." + type1 + ") "+name+" (a:(size:1)," + value + "))").markupToPrint(pFalse);
					// Value -> Spread
					expect("(print: (a: " + value + ") "+name+" (a: ..." + type1 + "))").markupToPrint(pTrue);
					expect("(print: (a: " + Array(7).fill(value) + ") "+name+" (a: ..." + type1 + "))").markupToPrint(pTrue);
					// Spread -> Spread
					expect("(print: (a: ..." + type1 + ") "+name+" (a:..." + type1 + "))").markupToPrint(pTrue);
					// Spread, Value, -> Spreads, Value
					expect("(print: (a: ..." + type1 + ",(size:1)) "+name+" (a:..." + type1 + ",..." + type1 + ",(size:1)))").markupToPrint(pTrue);
					// Spreads -> Values
					expect("(print: (a: ..." + type1 + ", ...changer, ..." + type1 + ") "+name+" (a:" + Array(2).fill(value) + ",(size:1)," + Array(4).fill(value) + "))").markupToPrint(pTrue);
					// Spread, Values -> Values, Spread
					if (type1 !== "datatype") {
						expect("(print: (a: ..." + type1 + ", (size:1), (size:1)) "+name+" (a:" + Array(6).fill(value) + ",...changer))").markupToPrint(pTrue);
					}
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
		it("'whitespace' matches only single whitespace", function() {
			expect("(set: $a to '' is a whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to ' ' is a whitespace)(print:$a)").markupToPrint("true");
			expect("(set: $a to '  ' is a whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to '  ' is a ...whitespace)(print:$a)").markupToPrint("true");
			expect("(set: $a to \"        .\" is a ...whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to 0 is a whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to '\t\t\n' is a ...whitespace)(print:$a)").markupToPrint("true");
			expect("(set: $a to (str-repeated:5,' ') is a ...whitespace)(print:$a)").markupToPrint("true");
		});
		it("'integer' or 'int' matches integers", function() {
			expect("(set: $a to 2.1 is a integer)(print:$a)").markupToPrint("false");
			expect("(set: $a to \"2\" is a integer)(print:$a)").markupToPrint("false");
			expect("(set: $a to 2 is a integer)(print:$a)").markupToPrint("true");
			expect("(set: $a to 2 is a int)(print:$a)").markupToPrint("true");
			expect("(set: $a to -10002 is a int)(print:$a)").markupToPrint("true");
			expect("(set: $a to -10002.1 is a int)(print:$a)").markupToPrint("false");
		});
		it("'alphanumeric' or 'alnum' matches single alphanumeric characters", function() {
			expect("(set: $a to '' is a alnum)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'EűG2' is a alnum)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'EűG2' is a ...alnum)(print:$a)").markupToPrint("true");
			expect("(set: $a to \"E-G\" is a ...alnum)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'EűG2' is a ...alphanumeric)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'EűG2\n' is a ...alphanumeric)(print:$a)").markupToPrint("false");
		});
		it("'digit' matches digit characters", function() {
			expect("(set: $a to '' is a digit)(print:$a)").markupToPrint("false");
			expect("(set: $a to \"EGG\" is a digit)(print:$a)").markupToPrint("false");
			expect("(set: $a to '2' is a digit)(print:$a)").markupToPrint("true");
			expect("(set: $a to '1234567890' is a digit)(print:$a)").markupToPrint("false");
			expect("(set: $a to '1234567890' is a ...digit)(print:$a)").markupToPrint("true");
			expect("(set: $a to '2\n' is a digit)(print:$a)").markupToPrint("false");
		});
		it("'uppercase' or 'lowercase' matches single cased characters", function() {
			expect("(set: $a to '' is a uppercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'Ӝ' is a uppercase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӝ' is a lowercase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӜEAR' is a uppercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӝear' is a lowercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӜEAR' is a ...uppercase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӝear' is a ...lowercase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӜEAr' is a ...uppercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӝeaR' is a ...lowercase)(print:$a)").markupToPrint("false");
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
	describe("string pattern macros", function() {
		var stringTypes = [
			['uppercase','A'],
			['lowercase','a'],
			['digit','3'],
			['whitespace',' '],
			['newline','\n']
		];
		function basicTest(name, arg, canBeUsedAlone) {
			if (arguments.length < 3) {
				canBeUsedAlone = true;
			}
			it("accepts multiple strings or string datatypes", function() {
				['alphanumeric','lowercase','uppercase','whitespace','str'].forEach(function(type) {
					expect("(print: (" + name + ":" + type + "))").not.markupToError();
					expect("(print: (" + name + ":" + type + ",'2','2','2'))").not.markupToError();
				});
				expect("(print: (" + name + ":num))").markupToError();
				expect("(print: (" + name + ":'2'))").not.markupToError();
				expect("(print: (" + name + ":(p:'foo','bar'),(p:'baz','qux')))").not.markupToError();
				expect("(print: (" + name + ":2))").markupToError();
				expect("(print: (" + name + ":))").markupToError();
			});
			if (name === 'p') {
				return;
			}
			it("works inside (p:)", function() {
				expect("(print: (p:'red',whitespace,'blue',(" + name + ":" + arg + ")) matches 'red blue green')").markupToPrint('true');
			});
			if (!canBeUsedAlone) {
				it("can't be used alone", function() {
					expect("(print: (" + name + ":" + arg + ") matches 'red blue green')").markupToError();
				});
			}
		}
		describe("(p:)", function() {
			basicTest("p");
			it("matches strings matching the sequence", function() {
				expect("(print: (p:'red','blue') matches 'redblue')").markupToPrint('true');
				expect("(print: (p:'red','blue') does not match 'xredxblue' and it does not match 'xredbluex' and it does not match 'redbluexx')").markupToPrint('true');
			});
			it("works with the string datatypes", function() {
				expect("(print: (p:string,'red','blue',string) matches 'redblue' and 'xredbluex' and 'xxredblue' and 'redbluexx')").markupToPrint('true');
				stringTypes.forEach(function(e) {
					expect("(print: (p:" + e[0] + ",'red','blue'," + e[0] + ") matches '" + e[1] + "redblue" + e[1] + "')").markupToPrint('true');
				});
			});
			it("works with spread string datatype", function() {
				stringTypes.forEach(function(e) {
					expect("(print: (p:..." + e[0] + ",'red','blue',..." + e[0] + ") matches '" + e[1].repeat(3) + "redblue" + e[1].repeat(6) + "')").markupToPrint('true');
				});
			});
		});
		describe("(p-many:)", function() {
			basicTest("p-many", 'whitespace,"green"');
			it("matches strings matching the sequence, repeated any positive number of times", function() {
				expect("(print: (pmany:'r','b') matches 'rbrbrbrb' and 'rbrb' and 'rb')").markupToPrint('true');
				expect("(print: (pmany:'r','b') does not match 'r' and it does not match 'redrb' and it does not match '')").markupToPrint('true');
			});
			it("takes optional min and max numbers limiting the number of matches, including zero", function() {
				expect("(print: (pmany:2, 'r','b') matches 'rbrb' and it does not match 'rb' and it matches 'rbrbrbrb')").markupToPrint('true');
				expect("(print: (pmany:2,4, 'r','b') matches 'rbrbrb' and it does not match 'rb' and it matches 'rbrbrbrb' and it does not match 'rbrbrbrbrb')").markupToPrint('true');
				expect("(print: (p:'g',(p-many:0,whitespace,'r'),'b') matches 'g r r r r r rb' and 'g rb' and 'gb')").markupToPrint('true');
			});
			it("errors if the numbers are negative, or if the max number is smaller than the min number", function() {
				expect("(print: (pmany:-2, 'r','b'))").markupToError();
				expect("(print: (pmany:4,3, 'r','b'))").markupToError();
			});
			it("when used in (p:), it matches the sequence for the greatest possible number of repetitions", function() {
				expect("(print: (p:'g',(p-many:whitespace,'r'),'b') matches 'g r r r r r rb')").markupToPrint('true');
			});
		});
		describe("(p-either:)", function() {
			basicTest("p-either", '(p:whitespace,"green")');
			it("matches strings matching any of the arguments", function() {
				expect("(print: (p-either:'red','blue') matches 'red' and 'blue')").markupToPrint('true');
				expect("(print: (p-either:'red','blue') does not match 'blu' and it does not match 'reb')").markupToPrint('true');
			});
		});
		describe("(p-opt:)", function() {
			basicTest("p-opt", '" green"');
			it("matches the sequence, or the empty string", function() {
				expect("(print: (popt:'r','b') matches '' and 'rb')").markupToPrint('true');
				expect("(print: (popt:'r','b') does not match 'r' and it does not match 'rbrb')").markupToPrint('true');
			});
			it("when used in (p:), it matches an optional occurrence of the sequence", function() {
				expect("(print: (p:'red',(p-opt:whitespace,'blue'),'green') matches 'red bluegreen' and 'redgreen')").markupToPrint('true');
				expect("(print: (p:'red',(p-opt:whitespace,'blue'),'green') does not match 'red blackgreen')").markupToPrint('true');
			});
		});
		/*describe("(p-not-before:)", function() {
			basicTest("p-not-before", '"black"),(p:" green"', false);
			it("when used in (p:), it matches if the sequence does not appear at that spot", function() {
				expect("(print: (p:'red',(p-not-before:whitespace,'blue'),string) matches 'redblue green' and 'redgreen' and 'red')").markupToPrint('true');
				expect("(print: (p:'red',(p-not-before:whitespace,'blue'),string) does not match 'red bluegreen')").markupToPrint('true');
			});
		});*/
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
	describe("the (datapattern:) macro", function() {
		it("takes most kinds of data, and produces a datatype that matches it", function() {
			typesAndValues.filter(function(e) {
				return e[1] !== "array" && e[1] !== "datamap";
			}).forEach(function(e) {
				expect("(print:(datapattern:" + e[0] + ") is " + e[1] + ")").markupToPrint("true");
			});
		});
		it("when given an array, it converts each value into its datapattern", function() {
			expect("(verbatim-print:(source:(datapattern:(a:2,(a:'4'),true))))").markupToPrint("(a:num,(a:str),bool)");
			expect("(verbatim-print:(source:(datapattern:(a:(ds:)))))").markupToPrint("(a:ds)");
		});
		it("when given a datamap, it converts each value into its datapattern", function() {
			expect("(verbatim-print:(source:(datapattern:(dm:'foo',2,'qux',(dm:'bar','4'),'baz',true))))").markupToPrint('(dm:"baz",bool,"foo",num,"qux",(dm:"bar",str))');
		});
		it("errors if given data that has no matching type", function() {
			expect("(print:(datapattern:?hook))").markupToError();
			expect("(print:(datapattern:[foobar]))").markupToError();
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
			it("array patterns can't be (set:) as data", function() {
				expect("(set: $a to  (a:num-type $a))$a").markupToError();
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
			it("datamap patterns can't be (set:) as data", function() {
				expect("(set: $a to  (dm:'foo',num-type $a))$a").markupToError();
			});
		});
		describe("when given a string pattern assignment request", function() {
			it("sets the variable in the pattern to their matching values", function() {
				[
					["(p:'baz', str-type _a)", "'bazfoo'"],
					["(p:'f',(p-many:'o'))-type _a", "'foo'"],
					["(p:(p-either:'baz','qux'),str-type _a)","'quxfoo'"],
					["(p:(p-either:'baz','qux'),str-type _a)","'bazfoo'"],
				].forEach(function(arr) {
					expect("(set: "+arr[0]+" to "+arr[1]+")_a").markupToPrint("foo");
					expect("(put: "+arr[1]+" into "+arr[0]+")_a").markupToPrint("foo");
				});
			});
			it("can set multiple variables at once", function() {
				expect("(set: (p: (p-many:alnum)-type $a, whitespace, (p-many:alnum)-type $b, whitespace, alnum-type $c) to 'foo bar 2')$a $b $c").markupToPrint("foo bar 2");
				expect("(set: (p: (p-many:alnum)-type $a, whitespace, (p-many:alnum)-type $b, (p:whitespace, alnum-type $c)) to 'foo bar 2')$a $b $c").markupToPrint("foo bar 2");
			});
			it("works with spread datatypes", function() {
				expect("(set: ...digit-type $z to '0041')$z").markupToPrint('0041');
				expect("(set: (p: '$', ...digit-type $a) to '$12800')$a").markupToPrint('12800');
				expect("(set: (p: alnum-type $b, '-', ...digit) to 'A-800')$b").markupToPrint('A');
				expect("(set: ...(p: ':', digit)-type $c to ':4:5:6')$c").markupToPrint(':4:5:6');
			});
			it("works with (p-opt:)", function() {
				expect("(set: (p: 'x', (p-opt:'y')-type _a, 'z') to 'xyz')_a").markupToPrint("y");
				expect("(set: (p: 'x', (p-opt:'y')-type _a, 'z') to 'xz')_a").markupToPrint("");
			});
			it("works with (p-many:)", function() {
				expect("(set: (p: 'x', (p-many:alnum)-type _a, 'z') to 'xyyyz')_a").markupToPrint('yyy');
			});
			it("works with nested typed vars", function() {
				expect("(set: (p: 'x', (p:alnum-type _a,'yy')-type _b, 'z') to 'xyyyz')_a _b").markupToPrint('y yyy');
			});
			it("can't use typed vars inside optional patterns", function() {
				expect("(set: (p: 'x', (p-many:alnum-type _a), 'z') to 'xyyyz')_a").markupToError();
				expect("(set: (p: 'x', (p-many:alnum-type _a), 'z') to 'xabcz')_a").markupToError();
				expect("(set: (p: 'x', (p-opt:alnum-type _a), 'z') to 'xyz')_a").markupToError();
				expect("(set: (p: 'x', (p-opt:alnum-type _a), 'z') to 'xz')_a").markupToError();
				expect("(set: (p: 'x', (p-many:0,alnum-type _a), 'z') to 'xz')_a").markupToError();
				expect("(set: (p: 'x', (p-either:'-',alnum-type _a), 'z') to 'x-z')_a").markupToError();
			});
			it("errors if nothing in the pattern matches", function() {
				expect("(set: (p:'baz', str-type _a) to 121)").markupToError();
				expect("(set: (p:'baz', str-type _a) to 'foobar')").markupToError();
			});
			xit("string patterns can't be (set:) as data", function() {
				expect("(set: $a to  (p:'foo',digit-type $a))$a").markupToError();
			});
		});
	});
});
