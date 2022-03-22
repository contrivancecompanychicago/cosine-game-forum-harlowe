describe("primitive value macros", function() {
	'use strict';
	describe("the (number:) macro", function() {
		it("accepts exactly 1 string argument", function() {
			expect("(number:)").markupToError();
			expect("(number:'1')").markupToPrint('1');
			expect("(number:'1','1')").markupToError();
		});
		it("converts string arguments to a number", function() {
			expect("(number: '2.' + '5')").markupToPrint("2.5");
		});
		it("shows an error if it does not succeed", function() {
			expect("(number: 'Dogs')").markupToError();
		});
		it("is aliased as (num:)", function() {
			expect("(num: '2')").markupToPrint("2");
		});
	});
	describe("the (text:) macro", function() {
		it("accepts 0 or more arguments of any primitive type", function() {
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 0; i < 10; i += 1) {
					expect("(text:" + (e + ",").repeat(i) + ")").not.markupToError();
				}
			});
			expect("|a>[](text: ?a)").markupToError();
		});
		it("converts number arguments to a string", function() {
			expect("(text: 2)").markupToPrint("2");
		});
		it("converts boolean arguments to a string", function() {
			expect("(text: 3 is 4)").markupToPrint("false");
		});
		it("joins string arguments", function() {
			expect("(text: 'gar', 'ply')").markupToPrint("garply");
		});
		it("refuses object arguments", function() {
			expect("(text: (text-style:'shadow'))").markupToError();
			expect("(text: (datamap:))").markupToError();
		});
		it("is aliased as (string:)", function() {
			expect("(string: 2)").markupToPrint("2");
		});
		it("is aliased as (str:)", function() {
			expect("(str: 2)").markupToPrint("2");
		});
		it("converts code hooks to strings", function() {
			expect("(str: [barbaz])").markupToPrint("barbaz");
			expect("(print:(str: [barbaz]) is a string)").markupToPrint("true");
		});
	});
	describe("the (random:) macro", function() {
		it("accepts 1 or 2 whole numbers", function() {
			expect("(random:)").markupToError();
			["0.1", "'X'", "true"].forEach(function(e) {
				expect("(random:" + e + ")").markupToError();
				expect("(random:" + e + ",1)").markupToError();
				expect("(random:1," + e + ")").markupToError();
			});
			expect("(random:1,1,1)").markupToError();
			expect("(random:1,1)").not.markupToError();
			expect("(random:1)").not.markupToError();
		});
		it("returns a random number between each value, inclusive", function() {
			for(var j = 0; j < 5; j += 1) {
				for(var k = 1; k < 6; k += 1) {
					var val = +runPassage("(random:" + j + "," + k + ")").text();
					expect(val).not.toBeLessThan(Math.min(j,k));
					expect(val).not.toBeGreaterThan(Math.max(j,k));
				}
			}
		});
	});
	describe("the (cond:) macro", function() {
		it("accepts pairs of booleans and values, as well as one final value", function() {
			expect("(cond:)").markupToError();
			expect("(cond:true)").markupToError();
			["0.1", "'X'", "true"].forEach(function(e) {
				for(var i = 1; i < 10; i += 1) {
					expect("(cond:" + ("false,"+e+",").repeat(i).slice(0,-1) + ")").markupToError();
					expect("(cond:" + ("false,"+e+",").repeat(i) + ",0)").not.markupToError();
				}
			});
		});
		it("returns the first value whose paired boolean is true, or the final value if none are true", function() {
			expect("(cond:false,2,false,3,true,4,5)").markupToPrint('4');
			expect("(cond:false,2,false,3,false,4,5)").markupToPrint('5');
			expect("(cond:true,2,true,3,true,4,5)").markupToPrint('2');
			expect("(cond:false,2,3)").markupToPrint('3');
			expect("(cond:true,2,3)").markupToPrint('2');
		});
	});
	describe("the (nth:) macro", function() {
		it("accepts a positive integer, plus one or more other values", function() {
			expect("(nth: 1)").markupToError();
			expect("(nth: true, 1)").markupToError();
			expect("(nth: 1.5, 1)").markupToError();
			expect("(nth: -1, 1)").markupToError();
			["1", "'X'", "true"].forEach(function(e) {
				for(var i = 2; i < 10; i += 1) {
					expect("(nth: 1," + (e+",").repeat(i) + ")").not.markupToError();
				}
			});
		});
		it("returns the nth value in the sequence, looping when it exceeds the number of values", function() {
			expect("(nth: 1, 'foo', 'bar', 'baz', 'qux')").markupToPrint('foo');
			expect("(nth: 2, 'foo', 'bar', 'baz', 'qux')").markupToPrint('bar');
			expect("(nth: 3, 'foo', 'bar', 'baz', 'qux')").markupToPrint('baz');
			expect("(nth: 5, 'foo', 'bar', 'baz', 'qux', 'garply')").markupToPrint('garply');
		});
		it("loops when it exceeds the number of values given", function() {
			expect("(nth: 5, 'foo', 'bar', 'baz', 'qux')").markupToPrint('foo');
			expect("(nth: 9, 'foo', 'bar', 'baz', 'qux')").markupToPrint('foo');
			expect("(nth: 11, 'foo', 'bar', 'baz', 'qux')").markupToPrint('baz');
		});
	});
	describe("the maths macros", function() {
		[
			["min","(min: 2, -5, 2, 7, 0.1)",       "-5"],
			["max","(max: 2, -5, 2, 7, 0.1)",        "7"],
			["abs","(abs: -4)",                      "4"],
			["sign","(sign: -4)",                   "-1"],
			["sin","(sin: 3.14159265 / 2)",          "1"],
			["cos","(cos: 3.14159265)",             "-1"],
			["tan","(round:(tan: 3.14159265 / 4))",  "1"],
			["floor","(floor: 1.99)",                "1"],
			["trunc","(trunc: -3.9) + (trunc:3.9) * 10",  "27"],
			["round","(round: 1.5)",                 "2"],
			["ceil","(ceil: 1.1)",                   "2"],
			["pow","(pow: 2, 8)",                  "256"],
			["exp","(round:(exp: 6))",             "403"],
			["sqrt","(sqrt: 25)",                    "5"],
			["log","(log: (exp:5))",                 "5"],
			["log10","(log10: 100)",                 "2"],
			["log2","(log2: 256)",                   "8"],
		].forEach(function(p){
			var name = p[0], code = p[1], res = p[2];
			it("(" + name + ":) produces values as documented", function() {
				expect("(print: " + code + " + 0)").markupToPrint(res);
			});
		});
	});
	describe("the (substring:) macro", function() {
		it("accepts 1 string argument, then two number arguments", function() {
			expect("(substring:)").markupToError();
			expect("(substring: '1')").markupToError();
			expect("(substring: 'red', 1.1, 2)").markupToError();
			expect("(substring: '𐌎ed', 1, 2)").markupToPrint('𐌎e');
		});
		it("returns the substring specified by the two 1-indexed start and end indices", function() {
			expect("(substring: 'ga𐌎ply', 2, 4)").markupToPrint("a𐌎p");
		});
		it("reverses the indices if the second exceeds the first", function() {
			expect("(substring: 'garply', 4, 2)").markupToPrint("arp");
		});
		it("accepts negative indices", function() {
			expect("(substring: 'ga𐌎ply', 2, -1)").markupToPrint("a𐌎ply");
			expect("(substring: 'ga𐌎ply', -2, 1)").markupToPrint("ga𐌎pl");
			expect("(substring: 'ga𐌎ply', -1, -3)").markupToPrint("ply");
		});
		it("refuses zero indices", function() {
			expect("(substring: 'garply', 0, 2)").markupToError();
		});
	});
	['lower','upper'].forEach(function(level, i) {
		describe("the (" + level + "case:) macro", function() {
			it("accepts 1 string argument", function() {
				expect("(" + level + "case:)").markupToError();
				expect("(" + level + "case: 1)").markupToError();
				expect("(" + level + "case: 'a')").not.markupToError();
				expect("(" + level + "case: 'red', 'blue')").markupToError();
			});
			it("returns the " + level + "case version of the string", function() {
				expect("(" + level + "case: '𐌎mêlÉE')").markupToPrint(i === 0 ? "𐌎mêlée" : "𐌎MÊLÉE");
			});
		});
		describe("the (" + level + "first:) macro", function() {
			it("accepts 1 string argument", function() {
				expect("(" + level + "first:)").markupToError();
				expect("(" + level + "first: 1)").markupToError();
				expect("(" + level + "first: 'a')").not.markupToError();
				expect("(" + level + "first: 'red', 'blue')").markupToError();
			});
			it("returns the string with the first non-whitespace character in " + level + "case", function() {
				expect("(" + level + "first: ' mell')").markupToPrint(i === 0 ? " mell" : " Mell");
				expect("(" + level + "first: ' Mell')").markupToPrint(i === 0 ? " mell" : " Mell");
			});
			it("doesn't affect strings whose first non-whitespace character is uncased", function() {
				expect("(" + level + "first: '2d')(" + level + "first: '𐌎d')").markupToPrint("2d𐌎d");
				expect("(" + level + "first: ' 2d')(" + level + "first: ' 𐌎d')").markupToPrint(" 2d 𐌎d");
			});
		});
	});
	describe("the (words:) macro", function() {
		it("accepts 1 string argument", function() {
			expect("(words:)").markupToError();
			expect("(words: 1)").markupToError();
			expect("(words: 'a')").not.markupToError();
			expect("(words: 'red', 'blue')").markupToError();
		});
		it("returns an array of words in the string, split by whitespace", function() {
			expect("(words: ' good  -gre𐌎t\n\texcellent: ')").markupToPrint("good,-gre𐌎t,excellent:");
		});
		it("returns a blank array if the string contains only whitespace", function() {
			expect("(print: (words: ' \n\t')'s length)").markupToPrint("0");
		});
		it("returns an array containing the original string, if the string contains no whitespace", function() {
			expect("(print: (words: 'Golly')'s 1st is 'Golly')").markupToPrint('true');
		});
	});
	describe("the (joined:) macro", function() {
		it("accepts any number of strings", function() {
			expect("(joined:)").markupToError();
			expect("(joined: 1)").markupToError();
			expect("(joined: 'a')").not.markupToError();
			expect("(joined: 'red', 'blue')").not.markupToError();
			expect("(joined: 'red', 'blue', 'foo', 'bar', 'baz')").not.markupToError();
		});
		it("joins each of the strings after the first, using the first as a separator", function() {
			expect("(joined:'  ', 'A', 'B', 'C')").markupToPrint("A  B  C");
		});
		it("returns an empty string if only one string is given", function() {
			expect("(joined:' ')").markupToPrint("");
		});
	});
	describe("the (plural:) macro", function() {
		it("accepts 1 integer, and 2 or 1 non-empty strings", function() {
			expect("(plural:)").markupToError();
			expect("(plural:1)").markupToError();
			expect("(plural:1,1)").markupToError();
			expect("(plural:'A')").markupToError();
			expect("(plural:'A',2)").markupToError();
			expect("(plural:1,true)").markupToError();
			expect("(plural:1.1,'X')").markupToError();
			expect("(plural:2,'A')").not.markupToError();
			expect("(plural:2,'A','B')").not.markupToError();
			expect('(plural:0,"")').markupToError();
			expect('(plural:0,"","")').markupToError();
		});
		it("returns a string comprising the number, a space, and the string, pluralised if the number isn't 1 or -1", function() {
			expect('(plural:0,"elf")').markupToPrint("0 elfs");
			expect('(plural:1,"elf")').markupToPrint("1 elf");
			expect('(plural:-1,"elf")').markupToPrint("-1 elf");
			expect('(plural:56,"elf")').markupToPrint("56 elfs");
		});
		it("uses the second string as the plural if given", function() {
			expect('(plural:0,"elf","elves")').markupToPrint("0 elves");
			expect('(plural:1,"elf","elves")').markupToPrint("1 elf");
			expect('(plural:2,"elf","elves")').markupToPrint("2 elves");
		});
	});
	describe("the (string-repeated:) macro", function() {
		it("accepts 1 integer and 1 string", function() {
			expect("(string-repeated:)").markupToError();
			expect("(string-repeated:1)").markupToError();
			expect("(string-repeated:1,1)").markupToError();
			expect("(string-repeated:'A')").markupToError();
			expect("(string-repeated:'A',2)").markupToError();
			expect("(string-repeated:1,true)").markupToError();
			expect("(string-repeated:1.1,'X')").markupToError();
		});
		it("returns the passed string repeated the given number of times", function() {
			runPassage("(set: $a to (string-repeated:4,'garply'))");
			expect("(print: $a)").markupToPrint("garplygarplygarplygarply");
			runPassage("(set: $b to (string-repeated:8,'x'))");
			expect("(print: $b)").markupToPrint("xxxxxxxx");
		});
		it("produces an error if the number is smaller than 0", function() {
			expect("(string-repeated:-2,'grault'))").markupToError();
			expect("(string-repeated:0,'grault'))").not.markupToError();
		});
		it("produces an error if the string is empty", function() {
			expect("(string-repeated:2,'')").markupToError();
		});
	});
	describe("the (string-reversed:) macro", function() {
		it("accepts 1 string argument", function() {
			expect("(string-reversed:)").markupToError();
			expect("(string-reversed: 1)").markupToError();
			expect("(string-reversed: 'a')").not.markupToError();
			expect("(string-reversed: 'red', 'blue')").markupToError();
		});
		it("returns the string, reversed", function() {
			expect("(print: (string-reversed:' good  -gre𐌎t\n\texcellent: '))").markupToPrint(" :tnellecxe\t\nt𐌎erg-  doog ");
		});
		it("is also known as (str-reversed:)", function() {
			expect("(print: (str-reversed:'BCD'))").markupToPrint("DCB");
		});
	});
	describe("the (string-nth:) macro", function() {
		it("accepts 1 integer", function() {
			expect("(string-nth:)").markupToError();
			expect("(string-nth: 1.1)").markupToError();
			expect("(string-nth: 'a')").markupToError();
			expect("(string-nth: 1,1)").markupToError();
		});
		it("returns the English ordinal string for that number", function() {
			Array.from(Array(20)).forEach(function(_,i) {
				i -= 10;
				var lastDigit = (+i + '').slice(-1);
				expect("(print: (string-nth:" + i + "))").markupToPrint(i + (
					lastDigit === "1" ? "st" :
					lastDigit === "2" ? "nd" :
					lastDigit === "3" ? "rd" : "th"));
			});
		});
		it("is also known as (str-nth:)", function() {
			expect("(print: (str-nth:45))").markupToPrint("45th");
		});
	});
	describe("the (digit-format:) macro", function() {
		it("accepts 1 string and 1 number", function() {
			expect("(digit-format:)").markupToError();
			expect("(digit-format: 1.1)").markupToError();
			expect("(digit-format: 'a')").markupToError();
			expect("(digit-format: 1,1)").markupToError();
			expect("(digit-format: '',1)(digit-format: '',-0.001)").not.markupToError();
		});
		it("stringifies the number according to the specified format", function() {
			expect('(digitformat: "###.###", -1/2)').markupToPrint("-.5");
			expect('(digitformat: "###.###", -1234.5678)').markupToPrint("-234.567");
			expect('(digitformat: "##0.00", -1/2)').markupToPrint("-0.50");
			expect('(digitformat: "##0.00", 0.96)').markupToPrint("0.96");
			expect('(digitformat: "###,###", 155500)').markupToPrint("155,500");
			expect('(digitformat: "### ###.", 500000)').markupToPrint("500 000");
			expect('(digitformat: "000", 5.1)').markupToPrint("005");
			expect('(digitformat: "###.###,", 1255.5)').markupToPrint("1.255");
			expect('(digitformat: ".##,###", 1255.5)').markupToPrint("55,5");
			expect('(digitformat: "##,##,###", 2576881)').markupToPrint("25,76,881");
		});
		it("errors if given a number over 999999999999999999999", function() {
			expect("(print: (digit-format:'#',999999999999999999999+1))").markupToError();
		});
	});
});
