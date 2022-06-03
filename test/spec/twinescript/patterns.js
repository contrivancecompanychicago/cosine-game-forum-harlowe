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
		['" "','whitespace',undefined],
		['whitespace','datatype',undefined],
		['(_a where _a is 2)','lambda',undefined,'no structural equality'],
		['(macro:[(output:1)])','macro',undefined,'no structural equality'],
		['(gradient:90,0,red,1,white)','gradient'],
		['(print:2)',"command",undefined],
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
				if ((name === "datatype" && op.includes("match")) || (name.startsWith("str") && e[0] === '" "')) {
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
				it("matches spread " + type1 + " datatypes inside arrays to any number of " + type1 + "s in the same position", function() {
					// Spread -> Value
					expect("(print: (a: ..." + type1 + ") "+name+" (a:" + value + "))").markupToPrint(pTrue);
					if (type1 === "whitespace") {
						expect("(print: (a: ..." + type1 + ") "+name+" (a:' \n '))").markupToPrint(pFalse);
						expect("(print: (a: ..." + type1 + ") "+name+" (a:' ',' \n '))").markupToPrint(pFalse);
					}
					expect("(print: (a: ..." + type1 + ") "+name+" (a:" + value + "," + value + "))").markupToPrint(pTrue);
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
			expect("(set: $a to '  ' is a ...whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to '  ' is a (p:...whitespace))(print:$a)").markupToPrint("true");
			expect("(set: $a to \"        .\" is a (p:...whitespace))(print:$a)").markupToPrint("false");
			expect("(set: $a to 0 is a whitespace)(print:$a)").markupToPrint("false");
			expect("(set: $a to '\t\t\n' is a (p:...whitespace))(print:$a)").markupToPrint("true");
			expect("(set: $a to (str-repeated:5,' ') is a (p:...whitespace))(print:$a)").markupToPrint("true");
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
			expect("(set: $a to 'EűG2' is a ...alnum)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'EűG2' is a (p:...alnum))(print:$a)").markupToPrint("true");
			expect("(set: $a to \"E-G\" is a (p:...alnum))(print:$a)").markupToPrint("false");
			expect("(set: $a to 'EűG2' is a (p:...alphanumeric))(print:$a)").markupToPrint("true");
			expect("(set: $a to 'EűG2\n' is a (p:...alphanumeric))(print:$a)").markupToPrint("false");
		});
		it("'digit' matches digit characters", function() {
			expect("(set: $a to '' is a digit)(print:$a)").markupToPrint("false");
			expect("(set: $a to \"EGG\" is a digit)(print:$a)").markupToPrint("false");
			expect("(set: $a to '2' is a digit)(print:$a)").markupToPrint("true");
			expect("(set: $a to '1234567890' is a digit)(print:$a)").markupToPrint("false");
			expect("(set: $a to '1234567890' is a ...digit)(print:$a)").markupToPrint("false");
			expect("(set: $a to '1234567890' is a (p:...digit))(print:$a)").markupToPrint("true");
			expect("(set: $a to '2\n' is a digit)(print:$a)").markupToPrint("false");
		});
		it("'uppercase', 'lowercase' or 'anycase' matches single cased characters", function() {
			expect("(set: $a to '' is a uppercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'Ӝ' is a uppercase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӝ' is a lowercase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӜEAR' is a uppercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӝear' is a lowercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӜEAR' is a ...uppercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӝear' is a ...lowercase)(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӜEAR' is a (p:...uppercase))(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӝear' is a (p:...lowercase))(print:$a)").markupToPrint("true");
			expect("(set: $a to 'ӜEAr' is a (p:...uppercase))(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӝeaR' is a (p:...lowercase))(print:$a)").markupToPrint("false");
			expect("(set: $a to 'ӝ' is a anycase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'Ӝ' is a anycase)(print:$a)").markupToPrint("true");
			expect("(set: $a to 'Ӝӝӝ' is a (p:...anycase))(print:$a)").markupToPrint("true");
			expect("(set: $a to '2' is a anycase)(print:$a)").markupToPrint("false");
		});
		it("'linebreak' or 'newline' matches line breaks", function() {
			['linebreak','newline'].forEach(function(e){
				expect("(set: $a to '\\r\\n' is a "+e+")(print:$a)").markupToPrint("true");
				expect("(set: $a to '\\n' is a "+e+")(print:$a)").markupToPrint("true");
				expect("(set: $a to '\\r' is a "+e+")(print:$a)").markupToPrint("true");
				expect("(set: $a to last of 'Red\n' is a "+e+")(print:$a)").markupToPrint("true");
				expect("(set: $a to '' is a "+e+")(print:$a)").markupToPrint("false");
			});
			expect("(print:linebreak is newline)").markupToPrint("true");
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
			['anycase','a'],
			['anycase','A'],
			['digit','3'],
			['whitespace',' '],
			['linebreak','\n']
		];
		function basicTest(name, arg, canBeUsedAlone, canContainTypedVars) {
			if (arguments.length < 4) {
				canContainTypedVars = true;
			}
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
			if (!canContainTypedVars) {
				it("can't contain typed vars", function() {
					expect("(print: (" + name + ":(p:" + arg + ")-type _a) matches 'red blue green')").markupToError();
				});
			}
			else {
				it("can't contain typed vars with the same name", function() {
					expect("(print: (" + name + ":alnum-type _a, alnum-type _b, alnum-type _a) matches 'red blue green')").markupToError();
				});
			}
			if (name === 'p' || name === 'p-not-before' || name === 'p-start' || name === 'p-end') {
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
				expect("(print: (p:'\\red*') matches '\\red*')").markupToPrint('true');
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
		describe("(p-start:)", function() {
			basicTest("p-start");
			it("matches strings matching the sequence", function() {
				expect("(print: (pstart:'red','blue') matches 'redblue')").markupToPrint('true');
				expect("(print: (pstart:'\\red*') matches '\\red*')").markupToPrint('true');
				expect("(print: (pstart:'red','blue') does not match 'xredxblue' and it does not match 'xredbluex' and it does not match 'redbluexx')").markupToPrint('true');
			});
			it("when used with (str-find:), only matches the start of strings", function() {
				expect("(v6m-source:(str-find: (pstart:'red', digit), 'red1 red3 red5'))").markupToPrint('(a:"red1")');
			});
			it("when used with (str-replaced:), only matches the start of strings", function() {
				expect("(print:(str-replaced: (pstart:'red', digit), 'blue', 'red1 red3 red5'))").markupToPrint('blue red3 red5');
			});
			it("when used with (trimmed:), only matches the start of strings", function() {
				expect("(print:(trimmed: (pstart:'red', digit), 'red1 red3 red5'))").markupToPrint(' red3 red5');
			});
		});
		describe("(p-end:)", function() {
			basicTest("p-start");
			it("matches strings matching the sequence", function() {
				expect("(print: (pend:'red','blue') matches 'redblue')").markupToPrint('true');
				expect("(print: (pend:'\\red*') matches '\\red*')").markupToPrint('true');
				expect("(print: (pend:'red','blue') does not match 'xredxblue' and it does not match 'xredbluex' and it does not match 'redbluexx')").markupToPrint('true');
			});
			it("when used with (str-find:), only matches the end of strings", function() {
				expect("(v6m-source:(str-find: (pend:'red', digit), 'red1 red3 red5'))").markupToPrint('(a:"red5")');
			});
			it("when used with (str-replaced:), only matches the end of strings", function() {
				expect("(print:(str-replaced: (pend:'red', digit), 'blue', 'red1 red3 red5'))").markupToPrint('red1 red3 blue');
			});
			it("when used with (trimmed:), only matches the end of strings", function() {
				expect("(print:(trimmed: (pend:'red', digit), 'red1 red3 red5'))").markupToPrint('red1 red3 ');
			});
		});
		describe("(p-many:)", function() {
			basicTest("p-many", 'whitespace,"green"');
			it("matches strings matching the sequence, repeated any positive number of times", function() {
				expect("(print: (pmany:'r','b') matches 'rbrbrbrb' and 'rbrb' and 'rb')").markupToPrint('true');
				expect("(print: (pmany:'r','b') matches '')").markupToPrint('false');
				expect("(print: (pmany:'r','b') does not match 'r' and it does not match 'redrb' and it does not match '')").markupToPrint('true');
			});
			it("takes optional min and max numbers limiting the number of matches, including zero", function() {
				expect("(print: (pmany:2, 'r','b') matches 'rbrb' and it does not match 'rb' and it matches 'rbrbrbrb')").markupToPrint('true');
				expect("(print: (pmany:2,4, 'r','b') matches 'rbrbrb' and it does not match 'rb' and it matches 'rbrbrbrb' and it does not match 'rbrbrbrbrb')").markupToPrint('true');
				expect("(print: (p:'g',(p-many:0,whitespace,'r'),'b') matches 'g r r r r r rb' and 'g rb' and 'gb')").markupToPrint('true');
				expect("(print: (pmany:0,'r','b') matches '')").markupToPrint('true');
			});
			it("errors if the numbers are negative, or if the max number is smaller than the min number", function() {
				expect("(print: (pmany:-2, 'r','b'))").markupToError();
				expect("(print: (pmany:4,3, 'r','b'))").markupToError();
			});
			it("when used in (p:), it matches the sequence for the greatest possible number of repetitions", function() {
				expect("(print: (p:'g',(p-many:whitespace,'r'),'b') matches 'g r r r r r rb')").markupToPrint('true');
			});
			it("can't contain typed vars if the min number is 0", function() {
				expect("(print: (p-many:0, (p:'Red')-type _a) matches 'red blue green')").markupToError();
			});
		});
		describe("(p-either:)", function() {
			basicTest("p-either", '(p:whitespace,"green")', true, false);
			it("matches strings matching any of the arguments", function() {
				expect("(print: (p-either:'red','blue') matches 'red' and 'blue')").markupToPrint('true');
				expect("(print: (p-either:'red','blue') does not match 'blu' and it does not match 'reb')").markupToPrint('true');
			});
		});
		describe("(p-opt:)", function() {
			basicTest("p-opt", '" green"', true, false);
			it("matches the sequence, or the empty string", function() {
				expect("(print: (popt:'r','b') matches '' and 'rb')").markupToPrint('true');
				expect("(print: (popt:'r','b') does not match 'r' and it does not match 'rbrb')").markupToPrint('true');
			});
			it("when used in (p:), it matches an optional occurrence of the sequence", function() {
				expect("(print: (p:'red',(p-opt:whitespace,'blue'),'green') matches 'red bluegreen' and 'redgreen')").markupToPrint('true');
				expect("(print: (p:'red',(p-opt:whitespace,'blue'),'green') does not match 'red blackgreen')").markupToPrint('true');
			});
		});
		describe("(p-ins:)", function() {
			basicTest("p-ins", 'whitespace, "GrEEn"');
			it("matches the sequence case-insensitively", function() {
				expect("(print: (p-ins:'R','b') matches 'rb' and 'RB' and 'Rb')").markupToPrint('true');
				expect("(print: (p-ins:'Put',whitespace,'it into the coffin.') matches 'PUT IT INTO THE COFFIN.')").markupToPrint('true');
				expect("(print: (p-ins:'Ӝӝ') matches 'ӝӝ' and 'ӜӜ')").markupToPrint('true');
				expect("(print: (p-ins:'r','b') does not match 'rR' and it does not match '')").markupToPrint('true');
			});
			it("works with the other pattern macros", function() {
				expect("(print: (p-ins:(p-many:2,5,'ӝ')) matches 'ӝӝӜ' and 'ӜӜӜ')").markupToPrint('true');
				expect("(print: (p-ins:(p-either:'A','ӝ')) matches 'Ӝ' and 'a')").markupToPrint('true');
				expect("(print: (p-ins:(p-opt:'ӝ')) matches 'Ӝ' and '')").markupToPrint('true');
			});
			it("works with exotic datatypes", function() {
				expect("(print: (p-ins:'A',digit,'E') matches 'a0e' and 'A4E')").markupToPrint('true');
				expect("(print: (p-ins:'A',...alnum,'E') matches 'a0e' and 'A4E')").markupToPrint('true');
				expect("(print: (p-ins:'A',uppercase,'E') matches 'abe' and 'ABE')").markupToPrint('true');
				expect("(print: (p-ins:'A',lowercase,'E') matches 'aBe' and 'AbE')").markupToPrint('true');
			});
		});
		describe("(p-not:)", function() {
			it("accepts multiple single-character strings or string datatypes", function() {
				['alphanumeric','lowercase','uppercase','whitespace'].forEach(function(type) {
					expect("(print: (p-not:" + type + "))").not.markupToError();
					expect("(print: (p-not:" + type + ",'w','S','b'))").not.markupToError();
				});
				expect("(print: (p-not:...'aeiouy'))").not.markupToError();
				expect("(print: (p-not:num))").markupToError();
				expect("(print: (p-not:...num))").markupToError();
				expect("(print: (p-not:str))").markupToError();
				expect("(print: (p-not:(p:'a')))").markupToError();
				expect("(print: (p-not:))").markupToError();
			});
			it("when used in (p:), it matches any character that doesn't match the given patterns", function() {
				expect("(print: (p:'red',(p-not:...'1234'),string) matches 'red5' and 'red6green' and 'red7')").markupToPrint('true');
				expect("(print: (p:'red',(p-not:...'1234'),string) does not match 'red3')").markupToPrint('true');
				expect("(print: (p:'red',(p-not:digit),string) does not match 'red3')").markupToPrint('true');
				expect("(print: (p:'red',(p-not:digit),string) does not match 'red6green')").markupToPrint('true');
			});
		});
		describe("(p-not-before:)", function() {
			basicTest("p-not-before", '""', false, false);
			it("matches the empty string", function() {
				expect("(print: (pnotbefore:'r','b') matches '') (print: (pnotbefore:'r','b') does not match 'r' and it does not match 'b')").markupToPrint('true true');
			});
			it("when used in (p:), matches the empty string, unless the sequence follows", function() {
				expect("(print: (p:'red',(pnotbefore:whitespace,'blue'),str) matches 'redgreen' and it matches 'redblue' and it matches 'red blu')").markupToPrint('true');
				expect("(print: (p:'red',(pnotbefore:whitespace,'blue'),str) does not match 'red bluegreen' and it does not match 'red blue')").markupToPrint('true');
				expect('(print: (p-many:(p-either:(p: "0", (p-not-before:"0")), (p:"1", (p-not-before:"1")), whitespace)) matches "0 0 01 10101 101")').markupToPrint('true');
				expect('(print: (p-many:(p-either:(p: "0", (p-not-before:"0")), (p:"1", (p-not-before:"1")), whitespace)) does not match "0 0 01 10101 110")').markupToPrint('true');
			});
		});
		describe("(p-before:)", function() {
			it("matches the empty string", function() {
				expect("(print: (p:(pbefore:'r'),'r') matches 'r') (print: (pbefore:'r','b') does not match 'r' and it does not match 'b')").markupToPrint('true true');
			});
			it("when used in (p:), matches the empty string if the sequence follows", function() {
				expect("(print: (p:'red',(pbefore:whitespace,'blue'),str) matches 'red blue' and it does not match 'redblue' and it does not match 'red')").markupToPrint('true');
				expect('(print: (p-many:(p-either:(p: digit, (p-before: whitespace)), whitespace)) matches " 2  2 1 4 1 " and it does not match " 22 ")').markupToPrint('true');
			});
		});
	});
	describe("(datatype:)", function() {
		it("takes most kinds of data, and produces a datatype that matches it", function() {
			typesAndValues.filter(function(e) {
				return e[1] !== "whitespace";
			}).forEach(function(e) {
				expect("(print:(datatype:" + e[0] + ") is " + e[1] + ")").markupToPrint("true");
			});
		});
		it("errors if given data that has no matching type", function() {
			expect("(print:(datatype:?hook))").markupToError();
		});
	});
	describe("the (datapattern:) macro", function() {
		it("takes most kinds of data, and produces a datatype that matches it", function() {
			typesAndValues.filter(function(e) {
				return e[1] !== "array" && e[1] !== "datamap" && e[1] !== "whitespace";
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
		});
	});
	describe("the (split:) macro", function() {
		describe("when given a plain string", function() {
			it("splits the data string into an array of substrings between matches", function() {
				expect('(print:(split:"E","ABECDEFGEH"))').markupToPrint("AB,CD,FG,H");
				expect('(print:(split:"E","EEEAEEE"))').markupToPrint(",,,A,,");
				expect('(print:(split:"E","ABCDE") is an array)').markupToPrint("true");
			});
			it("splits the data string into every character if an empty string was given", function() {
				expect('(print:(split:"","ABCDE"))').markupToPrint("A,B,C,D,E");
			});
		});
		describe("when given a built-in string datatype", function() {
			it("splits the data string into an array of substrings between matches", function() {
				expect('(print:(split:whitespace,"AB CD FG H"))').markupToPrint("AB,CD,FG,H");
				expect('(print:(split:alnum,"-+A+-B"))').markupToPrint("-+,+-");
			});
			it("errors if a non-string datatype is given", function() {
				expect('(print:(split:int,"AB CD FG H"))').markupToError();
				expect('(print:(split:dataset,"AB CD FG H"))').markupToError();
			});
			it("returns nothing if the datatype covers the whole string", function() {
				expect('(print:(split:string,"AB CD FG H"))').markupToPrint("");
				expect('(print:(split:...alnum,"ABCDE"))').markupToPrint("");
			});
		});
		describe("when given a string pattern", function() {
			it("splits the data string into an array of substrings between matches", function() {
				expect("(print:(split: (p:'#'), 'abe#ced#bee') is (a:'abe','ced','bee'))").markupToPrint('true');
				expect('(print:(split:(p-many:(p-either:".",whitespace)),"AB  CD   FG.H"))').markupToPrint("AB,CD,FG,H");
				expect('(print:(split:(p-ins:"e"),"ABECDEFGEH"))').markupToPrint("AB,CD,FG,H");
				expect("(print:(split:(p-not:...'abcde'), 'abe4ced2bee') is (a:'abe','ced','bee'))").markupToPrint('true');
				expect("(print:(split:(p-not:alnum), 'abe+ced+bee') is (a:'abe','ced','bee'))").markupToPrint('true');
			});
			it("returns nothing if the pattern covers the whole string", function() {
				expect('(print:(split:(p:"AB", alnum, "DE"),"ABCDE"))').markupToPrint("");
			});
			it("errors if given a pattern containing TypedVars", function() {
				expect('(split: (p:digit-type _a, "B"), "foo")').markupToError();
			});
			it("avoids infinite regress", function() {
				expect("(splitted: (p-many:0,alnum), 'R&B')").not.markupToError();
				expect("(splitted: (p-many:0,alnum), '&')").not.markupToError();
			});
		});
		it("returns the entire string if there are no matches", function() {
			expect('(print:(split:"J","ABECDEFGEH"))').markupToPrint("ABECDEFGEH");
			expect('(print:(split:"J","") is (a:""))').markupToPrint("true");
		});
		it("is also known as (splitted:)", function() {
			expect('(print:(splitted:"E","ABECDEFGEH"))').markupToPrint("AB,CD,FG,H");
		});
	});
	describe("the (trimmed:) macro", function() {
		it("accepts an optional string or string pattern, and a string", function() {
			expect("(trimmed: )").markupToError();
			expect("(trimmed: 1)").markupToError();
			expect("(trimmed: 'a')").not.markupToError();
			expect("(trimmed: digit, 'blue')").not.markupToError();
			expect("(trimmed: (p-either:'G','b'), 'blue')").not.markupToError();
		});
		it("removes matches from the start and end of the string", function() {
			expect('(trimmed:(p-either:".",whitespace),"... ... Boo.")').markupToPrint("Boo");
			expect('(trimmed:digit,"john22177")').markupToPrint("john");
		});
		it("returns an empty string if the pattern covers the whole string", function() {
			expect('(print: "" is (trimmed:(p:"AB", alnum, "DE"),"ABCDE"))').markupToPrint("true");
		});
		it("if no pattern is given, it defaults to removing whitespace", function() {
			expect('(trimmed: "     foo \n\n\n")').markupToPrint("foo");
		});
		it("errors if given a pattern containing TypedVars", function() {
			expect('(trimmed: (p:digit-type _a, "B"), "foo")').markupToError();
		});
		it("avoids infinite regress", function() {
			expect("(trimmed: (p-many:0,alnum), 'R&B')").not.markupToError();
			expect("(trimmed: (p-many:0,alnum), '&')").not.markupToError();
		});
	});
	describe("the (str-find:) macro", function() {
		it("accepts a string pattern, and a string", function() {
			expect("(str-find: )").markupToError();
			expect("(str-find: 1)").markupToError();
			expect("(str-find: 'a')").markupToError();
			expect("(str-find: alnum)").markupToError();
			expect("(str-find: 'a', 'b')").markupToError();
			expect("(str-find: alnum, 'b')").not.markupToError();
			expect("(str-find: (p:'a'), 'b')").not.markupToError();
			expect("(str-find: int, 'b')").markupToError();
		});
		it("produces an array of all occurrences of the pattern in that string", function() {
			expect('(v6m-source:(str-find: (p:"Mr. ", ...alnum), "Mr. Smith, Mr. Schmitt, and Mr. Smithers"))').markupToPrint('(a:"Mr. Smith","Mr. Schmitt","Mr. Smithers")');
			expect("(v6m-source:(str-find: (p:'G',alnum,'D'), 'GADGEDGUD'))").markupToPrint('(a:"GAD","GED","GUD")');
			expect("(v6m-source:(str-find: (p: alnum,'D'), 'GADGEDGUD'))").markupToPrint('(a:"AD","ED","UD")');
			expect("(v6m-source:(str-find: (p-either: 'G','D'), 'GADGEDGUD'))").markupToPrint('(a:"G","D","G","D","G","D")');
			expect("(v6m-source:(str-find: (p: alnum,'D'), 'foo'))").markupToPrint('(a:)');
		});
		it("matches are non-overlapping", function() {
			expect('(v6m-source:(str-find: (p:anycase,digit,anycase,digit), "A2A3A4"))').markupToPrint('(a:"A2A3")');
		});
		it("when typedvars are used, produces an array of datamaps whose values correspond to each typedvar, plus the full match", function() {
			expect("(v6m-source:(str-find: (p: (p-many:digit)-type _a, '%'), '40% 2% 118%'))").markupToPrint('(a:(dm:"a","40","match","40%"),(dm:"a","2","match","2%"),(dm:"a","118","match","118%"))');
			expect("(v6m-source:(str-find: (p: digit-type _a, anycase-type _b, digit-type _c), '5A2'))").markupToPrint('(a:(dm:"a","5","b","A","c","2","match","5A2"))');
			expect("(v6m-source:(str-find: (p: digit-type _a, (p-opt:anycase)-type _b, digit-type _c), '52'))").markupToPrint('(a:(dm:"a","5","b","","c","2","match","52"))');
		});
		it("errors if given a pattern containing TypedVars that aren't plain temp variables with no property accesses", function() {
			expect('(str-find: (p:digit-type $a, "B"), "foo")').markupToError();
			expect('(str-find: (p:digit-type _a\'s 1st, "B"), "foo")').markupToError();
			expect('(str-find: (p:digit-type $a\'s 1st, "B"), "foo")').markupToError();
		});
		it("errors if the pattern repeats TypedVar names", function() {
			expect('(str-find: (p:digit-type _a, digit-type _a), "121")').markupToError();
		});
		it("errors if a _match TypedVar was given", function() {
			expect('(str-find: (p:digit-type _a, digit-type _match), "121")').markupToError();
		});
		it("avoids infinite regress", function() {
			expect("(str-find: (p-many:0,alnum), 'R&B')").not.markupToError();
			expect("(str-find: (p-many:0,alnum), '&')").not.markupToError();
		});
	});

	describe("the (str-replaced:) macro", function() {
		it("accepts an optional non-negative integer, a string or string pattern, a string or lambda, and a string", function() {
			expect("(str-replaced: )").markupToError();
			expect("(str-replaced: 1)").markupToError();
			expect("(str-replaced: 'a', 'b', 'ab')").not.markupToError();
			expect("(str-replaced: 'a', via 'b', 'ab')").not.markupToError();
			expect("(str-replaced: alnum, 'b', 'ab')").not.markupToError();
			expect("(str-replaced: (p:'a'), 'b', 'ab')").not.markupToError();
			expect("(str-replaced: alnum, via 'b', 'ab')").not.markupToError();
			expect("(str-replaced: (p:'a'), via 'b', 'ab')").not.markupToError();
			expect("(str-replaced: 2, 'a', 'b', 'ab')").not.markupToError();
			expect("(str-replaced: 2, 'a', via 'b', 'ab')").not.markupToError();
			expect("(str-replaced: 2, alnum, 'b', 'ab')").not.markupToError();
			expect("(str-replaced: 2, (p:'a'), 'b', 'ab')").not.markupToError();
			expect("(str-replaced: 2, alnum, via 'b', 'ab')").not.markupToError();
			expect("(str-replaced: 2, (p:'a'), via 'b', 'ab')").not.markupToError();
			expect("(str-replaced: 'a', 'b', via 'ab')").markupToError();
			expect("(str-replaced: 'a', via 'b', via 'ab')").markupToError();
			expect("(str-replaced: alnum, 'b', via 'ab')").markupToError();
			expect("(str-replaced: (p:'a'), 'b', via 'ab')").markupToError();
			expect("(str-replaced: alnum, via 'b', via 'ab')").markupToError();
			expect("(str-replaced: (p:'a'), via 'b', via 'ab')").markupToError();
			expect("(str-replaced: 2, via 'a', 'b', 'ab')").markupToError();
			expect("(str-replaced: 2, via 'a', via 'b', 'ab')").markupToError();
			expect("(str-replaced: alnum, alnum, 'b', 'ab')").markupToError();
			expect("(str-replaced: alnum, alnum, via 'b', 'ab')").markupToError();
			expect("(str-replaced: 2, 'a', 'b')").markupToError();
			expect("(str-replaced: 2, alnum, 'b')").markupToError();
			expect("(str-replaced: 2, via 'a', 'b')").markupToError();
			expect("(str-replaced: 'a', where true via 'b', 'ab')").markupToError();
			expect("(str-replaced: 'a', via _a + 'a', 'ab')").markupToError();
			expect("(str-replaced: int, 'b', 'ab')").markupToError();
			expect("(str-replaced: 2.1, 'a', 'b', 'ab')").markupToError();
			expect("(str-replaced: -2, 'a', 'b', 'ab')").markupToError();
		});
		it("when given a string replacement, replaces each match with the given string", function() {
			expect('(str-replaced: "http://", "https://", "http://www.com")').markupToPrint("https://www.com");
			expect('(str-replaced: "a", "b", "bananas")').markupToPrint("bbnbnbs");
			expect('(str-replaced: (p-many:"an"), "b", "bananas")').markupToPrint("bbas");
			expect('(str-replaced: digit, "b", "ace4u2a")').markupToPrint("acebuba");
		});
		describe("when given a lambda replacement", function() {
			it("replaces each match using the lambda", function() {
				expect("(str-replaced: '-A', via '2', ' -A- ')").markupToPrint(" 2- ");
				expect("(str-replaced: alnum, via '2', ' -A- ')").markupToPrint(" -2- ");
			});
			it("'it' equals the current match", function() {
				expect("(str-replaced: alnum, via (lowercase:it), ' -A- ')").markupToPrint(" -a- ");
				expect("(str-replaced: (p:alnum,':'), via it + ')', 'BE:E:EEP')").markupToPrint("BE:)E:)EEP");
			});
			it("'pos' equals the number of the current match", function() {
				expect("(str-replaced: alnum, via (str:pos*2), 'BRED')").markupToPrint("2468");
			});
			it("typed variables in the pattern are accessible in the lambda", function() {
				expect('(str-replaced: (p: (p-many:digit)-type _a, "%"), via _a + " percent", "5% 10%")').markupToPrint("5 percent 10 percent");
				expect('(str-replaced: (p: (p-opt:"8")-type _a, "0", digit-type _b), via _b + (str:length of _a), "80506")').markupToPrint("5160");
			});
			it("temp variables in the passage are accessible in the lambda, and don't override typed variables in the pattern", function() {
				expect('(set:_a to "W", _b to "X")(str-replaced: (p: alnum-type _a, "0"), via _a + _b, "203040")').markupToPrint("2X3X4X");
			});
			it("errors if given a pattern containing TypedVars that aren't plain temp variables with no property accesses", function() {
				expect('(str-replaced: (p:digit-type $a, "B"), "AB", "foo")').markupToError();
				expect('(str-replaced: (p:digit-type _a\'s 1st, "B"), "AB", "foo")').markupToError();
				expect('(str-replaced: (p:digit-type $a\'s 1st, "B"), "AB", "foo")').markupToError();
			});
		});
		it("errors if the pattern repeats TypedVar names", function() {
			expect('(str-replaced: (p:digit-type _a, digit-type _a), "W", "121")').markupToError();
		});
		it("matches are non-overlapping", function() {
			expect('(str-replaced: "ABAB", "W", "ABABAB")').markupToPrint("WAB");
		});
		it("if the optional number is provided, only performs a limited number of replacements", function() {
			expect('(str-replaced: 2, digit, "W", "12345")').markupToPrint("WW345");
			expect('(str-replaced: 0, alnum, "W", "ABECDEFGEH")').markupToPrint("ABECDEFGEH");
		});
		it("returns the entire string if there are no matches", function() {
			expect('(str-replaced: "ABAB", "W", "ABECDEFGEH")').markupToPrint("ABECDEFGEH");
			expect('(str-replaced: "", "W", "ABECDEFGEH")').markupToPrint("ABECDEFGEH");
			expect('(str-replaced: (p:whitespace,digit), "W", "ABECDEFGEH")').markupToPrint("ABECDEFGEH");
		});
		it("is also known as (replaced:)", function() {
			expect('(replaced: "http://", "https://", "http://www.com")').markupToPrint("https://www.com");
		});
		it("avoids infinite regress", function() {
			expect("(str-replaced: (p-many:0,alnum), 'X', 'R&B')").not.markupToError();
			expect("(str-replaced: (p-many:0,alnum), 'X', '&')").not.markupToError();
		});
	});
	describe("the (unpack:) macro", function() {
		describe("when given an array pattern assignment request", function() {
			it("sets the variable in the pattern to their matching values", function() {
				[
					["(a:$a)", "(a:2)"],
					["(a:$c, $b, $a)", "(a:0,1,2)"],
					["(a:num-type $a)", "(a:2)"],
					["(a:5,num,num,num-type $a,num)","(a:5,4,3,2,1)"],
					["(a:(a:num,num-type $a),num)","(a:(a:1,2),3)"],
				].forEach(function(arr) {
					expect("(unpack: "+arr[1]+" into "+arr[0]+")$a").markupToPrint("2");
					expect("(unpack: "+arr[1]+" into "+arr[0].replace(/\$/g,'_')+")_a").markupToPrint("2");
				});
			});
			it("can set multiple variables at once", function() {
				expect("(unpack: (a:2,3) into (a:num-type $a, num-type $b))$a $b").markupToPrint("2 3");
				expect("(unpack: (a:2,3) into (a:$a, $b))$a $b").markupToPrint("2 3");
				expect("(unpack: (a:2,3,(a:4)) into (a:num,num-type $c, (a:num-type _d)))$c _d").markupToPrint("3 4");
			});
			it("works with spread datatypes", function() {
				expect("(unpack: (a:1,3,5,6) into (a:...odd, even-type $a))$a").markupToPrint('6');
				expect("(unpack: (a:1,3,5,6) into (a:...odd-type $c))$c").markupToPrint('1,3,5');
				expect("(unpack: (a:1,3,5,6) into (a:...odd-type $d,...even-type $e))$d $e").markupToPrint('1,3,5 6');
			});
			it("does not alter the value of 'it'", function() {
				expect("(set:$c to 'foo')" +
					"(unpack: (a:2,it) into (a:num-type $red, num-type $blue))$red $blue").markupToPrint("2 0");
			});
			it("can be used to exchange variables", function() {
				runPassage("(unpack: (a:2,3,4) into (a:num-type $a, num-type $b, num-type $c))");
				expect("(unpack: (a:$c,$b,$a) into (a:num-type $a, num-type $b, num-type $c))$a $b $c").markupToPrint("4 3 2");
			});
			it("errors if the pattern doesn't match", function() {
				expect("(unpack: (a:6,4,3,2,1) into (a:5,num,num,num-type $a,num))$a").markupToError();
				expect("(unpack: (a:5,4,'3',2,1) into (a:5,num,num,num-type $a,num))$a").markupToError();
				expect("(unpack: (a:5,4) into (a:num-type $a,num,num))$a").markupToError();
				expect("(unpack: (a:(a:1),3) into (a:(a:num,num-type $a),num))$a").markupToError();
			});
			it("doesn't error if the source structure has more values than the pattern", function() {
				expect("(unpack: (a:5,4,3,2,1) into (a:num-type $a))$a").markupToPrint("5");
			});
		});
		describe("when given a datamap pattern assignment request", function() {
			it("sets the typed variable in the pattern to their matching values", function() {
				[
					["(dm:'foo',num-type $a)", "(dm:'foo',2)"],
					["(dm:'foo',5,'bar',num-type $a,'baz',3)","(dm:'foo',5,'baz',3,'bar',2)"],
					["(dm:'foo',5,'bar',(dm:'foo',num-type $a))","(dm:'foo',5,'bar',(dm:'foo',2))"],
				].forEach(function(arr) {
					expect("(unpack: "+arr[1]+" into "+arr[0]+")$a").markupToPrint("2");
				});
			});
			it("can set multiple variables at once", function() {
				expect("(unpack: (dm:'foo',2,'bar',3) into (dm:'foo',num-type $a,'bar',num-type $b) )$a $b").markupToPrint("2 3");
				expect("(unpack: (dm:'baz',3,'qux',(dm:'foo', 4)) into (dm:'baz',num-type $c,'qux',(dm:'foo',num-type _d)))$c _d").markupToPrint("3 4");
			});
			it("works with (move:)", function() {
				expect("(set:$c to (dm:'foo',3,'bar',2))" +
					"(move: $c into (dm:'foo',num-type $blue,'bar',num-type $red))$red $blue").markupToPrint("2 3");
				expect("(print:$c contains 'foo')").markupToPrint("false");
			});
			it("does not alter the value of 'it'", function() {
				expect("(set:$c to 'foo')" +
					"(unpack:(dm:'foo',2,'bar',it) into (dm:'foo',num-type $red,'bar',num-type $blue) )$red $blue").markupToPrint("2 0");
			});
			it("errors if the pattern doesn't match", function() {
				expect("(unpack: (dm:'foo',2,'baz',3) into (dm:'foo',num-type $a,'bar',num-type $b))").markupToError();
				expect("(unpack: (dm:'foo',2,'baz',3) into (dm:'foo',num-type $a,'bar',str-type $b))").markupToError();
				expect("(unpack: (dm:'foo',4,'bar',1) into (dm:'foo',2,'bar',num-type $b))").markupToError();
			});
			it("doesn't error if the source structure has more values than the pattern", function() {
				expect("(unpack: (dm:'foo',5,'qux',4,'baz',3) into (dm:'foo',num-type $a))$a").markupToPrint("5");
			});
		});
		describe("when given a string pattern assignment request", function() {
			it("sets the variable in the pattern to their matching values", function() {
				[
					["(p:'baz', str-type _a)", "'bazfoo'"],
					["(p:(p:'f',(p-many:'o'))-type _a)", "'foo'"],
					["(p:(p-either:'baz','qux'),str-type _a)","'quxfoo'"],
					["(p:(p-either:'baz','qux'),str-type _a)","'bazfoo'"],
				].forEach(function(arr) {
					expect("(unpack: "+arr[1]+" into "+arr[0]+")_a").markupToPrint("foo");
				});
			});
			it("can set multiple variables at once", function() {
				expect("(unpack: 'foo bar 2' into (p: (p-many:alnum)-type $a, whitespace, (p-many:alnum)-type $b, whitespace, alnum-type $c) )$a $b $c").markupToPrint("foo bar 2");
				expect("(unpack: 'foo bar 2' into (p: (p-many:alnum)-type $a, whitespace, (p-many:alnum)-type $b, (p:whitespace, alnum-type $c)))$a $b $c").markupToPrint("foo bar 2");
			});
			it("works with spread datatypes", function() {
				expect("(unpack: '$12800' into (p: '$', ...digit-type $a))$a").markupToPrint('12800');
				expect("(unpack: 'A-800' into (p: alnum-type $b, '-', ...digit))$b").markupToPrint('A');
			});
			it("works with (p-opt:)", function() {
				expect("(unpack: 'xyz' into (p: 'x', (p-opt:'y')-type _a, 'z'))_a").markupToPrint("y");
				expect("(unpack: 'xz' into (p: 'x', (p-opt:'y')-type _a, 'z'))_a").markupToPrint("");
			});
			it("works with (p-many:)", function() {
				expect("(unpack: 'xyyyz' into (p: 'x', (p-many:alnum)-type _a, 'z'))_a").markupToPrint('yyy');
			});
			it("works with (p-ins:)", function() {
				expect("(unpack: 'xyyyz' into (p-ins: 'x', (p-opt: 'YYY')-type _a, 'z'))_a").markupToPrint('yyy');
				expect("(unpack: 'xyyyz' into (p-ins: 'x', (p-many: 'Y')-type _a, 'z'))_a").markupToPrint('yyy');
				expect("(unpack: 'xyyyz' into (p-ins: 'x', ...uppercase-type _a, 'z'))_a").markupToPrint('yyy');
			});
			it("works with nested typed vars", function() {
				expect("(unpack: 'xyyyz' into (p: 'x', (p:alnum-type _a,'yy')-type _b, 'z'))_a _b").markupToPrint('y yyy');
			});
			it("can't use typed vars inside optional patterns", function() {
				expect("(unpack: 'xyyyz' into (p: 'x', (p-many:alnum-type _a), 'z'))_a").markupToError();
				expect("(unpack: 'xabcz' into (p: 'x', (p-many:alnum-type _a), 'z'))_a").markupToError();
				expect("(unpack: 'xyz' into (p: 'x', (p-opt:alnum-type _a), 'z'))_a").markupToError();
				expect("(unpack: 'xz' into (p: 'x', (p-opt:alnum-type _a), 'z'))_a").markupToError();
				expect("(unpack: 'xz' into (p: 'x', (p-many:0,alnum-type _a), 'z'))_a").markupToError();
				expect("(unpack: 'x-z' into (p: 'x', (p-either:'-',alnum-type _a), 'z'))_a").markupToError();
			});
			it("errors if nothing in the pattern matches", function() {
				expect("(unpack: 121 into (p:'baz', str-type _a))").markupToError();
				expect("(unpack: 'foobar' into (p:'baz', str-type _a))").markupToError();
			});
			it("errors if multiple vars in the pattern have the same name", function() {
				expect("(unpack: 'bazbarbaz' into (p:'baz', alnum-type _a, str-type _a))").markupToError();
				expect("(unpack: 'bazbarbaz' into (p:'baz', alnum-type _a, alnum-type _a))").markupToError();
			});
		});
	});
});
