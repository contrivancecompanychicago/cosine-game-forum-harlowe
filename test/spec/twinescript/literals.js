describe("twinescript literals", function() {
	'use strict';
	describe("numbers", function() {
		it("can consist of positive and negative integers", function() {
			expect("(print: 1234567890)").markupToPrint("1234567890");
			expect("(print: -1234567890)").markupToPrint("-1234567890");
			expect("(print: 00012)").markupToPrint("12");
			expect("(print: -00012)").markupToPrint("-12");
		});
		it("can consist of decimal fractions (with leading 0s omitted)", function() {
			expect("(print: .120)").markupToPrint("0.12");
			expect("(print: -.120)").markupToPrint("-0.12");
			expect("(print: 00.120)").markupToPrint("0.12");
			expect("(print: -00.120)").markupToPrint("-0.12");
			expect("(print: 1.000)").markupToPrint("1");
			expect("(print: -1.000)").markupToPrint("-1");
		});
		it("can consist of scientific notation", function() {
			expect("(print: 1e3)").markupToPrint("1000");
			expect("(print: 01e03)").markupToPrint("1000");
			expect("(print: 1e-03)").markupToPrint("0.001");
			expect("(print: 1.1e03)").markupToPrint("1100");
			expect("(print: 1.1e-03)").markupToPrint("0.0011");
		});
		it("can consist of CSS time values", function() {
			expect("(print: 0s)").markupToPrint("0");
			expect("(print: 0ms)").markupToPrint("0");
			expect("(print: 1ms)").markupToPrint("1");
			expect("(print: 1s)").markupToPrint("1000");
			expect("(print: 10ms)").markupToPrint("10");
			expect("(print: 10s)").markupToPrint("10000");
			expect("(print: 1.7ms)").markupToPrint("1.7");
			expect("(print: 1.7s)").markupToPrint("1700");
			expect("(print: -5ms)").markupToPrint("-5");
			expect("(print: -5s)").markupToPrint("-5000");
			expect("(print: 5 ms)").markupToError();
			expect("(print: 5 s)").markupToError();
		});
		it("negative numbers aren't interpreted as subtractions", function() {
			expect("(print: 5 * -1)").markupToPrint("-5");
			expect("(print: 5 * - 1)").markupToPrint("-5");
			expect("(print: --5)").markupToPrint("5");
			expect("(print: --5-5)").markupToPrint("0");
			expect("(print: (a:2)'s (-1))").markupToPrint("2");
		});
	});
	describe("booleans", function() {
		it("consist of true or false, case-insensitive", function() {
			expect("(print: true)").markupToPrint("true");
			expect("(print: false)").markupToPrint("false");
			expect("(print: True)").markupToPrint("true");
			expect("(print: False)").markupToPrint("false");
			expect("(print: TRUE)").markupToPrint("true");
			expect("(print: FALSE)").markupToPrint("false");
		});
	});
	describe("strings", function() {
		it("can consist of zero or more characters enclosed in single-quotes", function() {
			expect("(print: 'Red')").markupToPrint("Red");
			expect("A(print: '')B").markupToPrint("AB");
		});
		it("can consist of zero or more characters enclosed in double-quotes", function() {
			expect('(print: "Red")').markupToPrint("Red");
			expect('A(print: "")B').markupToPrint("AB");
		});
		it("can contain line breaks", function() {
			expect('(print: "A\nB")').markupToPrint("A\nB");
			expect("(print: 'A\nB')").markupToPrint("A\nB");
		});
		it("can contain opening hook markup", function() {
			expect('(print: "[" + \'[\')').markupToPrint("[[");
		});
		it("can contain C-style backslash escapes", function() {
			expect('(print: "A\\B")').markupToPrint("AB");
			expect("(print: 'A\\B')").markupToPrint("AB");
			expect('(print: "A\\"B")').markupToPrint("A\"B");
			expect("(print: 'A\\'B')").markupToPrint("A'B");
			expect('(print:"\\xFE")').markupToPrint("þ");
			expect('(print:"\\u00FE")').markupToPrint("þ");
		});
		it("can contain close-brackets", function() {
			expect('(print: ")")').markupToPrint(")");
		});
		it("don't error if they contain legacy octal escapes", function() {
			expect('(print: "\\022 \\\\022 \\\\\\022")').markupToPrint("022 \\022 \\\\022");
		});
	});
	function expectColourToBe(str, colour) {
		expect(runPassage("(print:" + str + ")").find('tw-colour')).toHaveBackgroundColour(colour);
	}
	describe("RGB colours", function() {
		it("can consist of three case-insensitive hexadecimal digits preceded by #", function() {
			expectColourToBe("#000", "#000000");
			expectColourToBe("#103", "#110033");
			expectColourToBe("#fAb", "#FFAABB");
			expect("(print: #g00)").markupToError();
		});
		it("can consist of six case-insensitive hexadecimal digits preceded by #", function() {
			expectColourToBe("#000000", "#000000");
			expectColourToBe("#100009", "#100009");
			expectColourToBe("#abcDEf", "#ABCDEF");
			expect("(print: #bcdefg)").markupToError();
		});
		it("can only be six or three digits long", function() {
			expect("(print: #12)").markupToError();
			expect("(print: #1234)").markupToError();
			expect("(print: #12345)").markupToError();
			expect("(print: #1234567)").markupToError();
		});
	});
	describe("Harlowe colours", function() {
		it("consist of special case-insensitive keywords", function() {
			/*
				This should be the same mapping as in markup/markup.js
			*/
			var mapping = {
				"red"    : "e61919",
				"orange" : "e68019",
				"yellow" : "e5e619",
				"lime"   : "80e619",
				"green"  : "19e619",
				"cyan"   : "19e5e6",
				"aqua"   : "19e5e6",
				"blue"   : "197fe6",
				"navy"   : "1919e6",
				"purple" : "7f19e6",
				"fuchsia": "e619e5",
				"magenta": "e619e5",
				"white"  : "ffffff",
				"black"  : "000000",
				"gray"   : "888888",
				"grey"   : "888888",
			};
			Object.keys(mapping).forEach(function(colour) {
				expectColourToBe(colour, "#" + mapping[colour]);
				expectColourToBe(colour.toUpperCase(), "#" + mapping[colour]);
			});
			expect(runPassage("(print:transparent)").find('tw-colour')).toHaveBackgroundColour('rgba(0,0,0,0)');
		});
	});
	describe("code hooks", function() {
		it("can consist of zero or more characters enclosed in a hook", function() {
			expect("(print:[Foo\nBar])").markupToPrint("Foo\nBar");
			expect("(print:[Foo\nBar] is a codehook)").markupToPrint("true");
		});
		it("does not allow C-style backslash escapes", function() {
			expect('(print:[A\\B])').markupToPrint("A\\B");
			expect("(print:[A\\B])").markupToPrint("A\\B");
		});
		it("can contain markup", function() {
			expect("(print:[(print:['Baz'])(link:'Foo')[Bar]])").markupToPrint("'Baz'Foo");
		});
	});
});
