describe("colour macros", function() {
	'use strict';

	function expectColourToBe(str, colour) {
		expect(runPassage("(print:" + str + ")").find('tw-colour')).toHaveBackgroundColour(colour);
	}
	describe("the (rgb:) macro", function() {
		it("takes three numbers between 0 and 255 inclusive, and an optional fractional A value between 0 and 1 inclusive", function() {
			expect("(rgb: 1)").markupToError();
			expect("(rgb: 1,1)").markupToError();
			expect("(rgb: 1, 300, 1)").markupToError();
			expect("(rgb: 1, 300, 1, 2)").markupToError();
			expect("(rgb: 12, 12, 12.1)").not.markupToError();
		});
		it("produces a colour using the three numbers", function() {
			expectColourToBe("(rgb:255,0,255)", "#FF00FF");
			expectColourToBe("(rgb:47,25,12)", "#2F190C");
			expectColourToBe("(rgb:255,0,255,0.7)", "rgba(255,0,255,0.7)");
			expectColourToBe("(rgb:47.1,25,12,0.4)", "rgba(47.1,25,12,0.4)");
		});
		it("is aliased as (rgba:)", function() {
			expectColourToBe("(rgba:255,0,255)", "#FF00FF");
			expectColourToBe("(rgba:47,25,12)", "#2F190C");
			expectColourToBe("(rgba:255,0,255,0.7)", "rgba(255,0,255,0.7)");
			expectColourToBe("(rgba:47,25,12,0.4)", "rgba(47,25,12,0.4)");
		});
	});
	describe("the (hsl:) macro", function() {
		it("takes fractional S and L values between 0 and 1 inclusive, and an optional fractional A value between 0 and 1 inclusive", function() {
			expect("(hsl: 1)").markupToError();
			expect("(hsl: 1,1)").markupToError();
			expect("(hsl: 1,1,1.2)").markupToError();
			expect("(hsl: 1,-1,0)").markupToError();
			expect("(hsla: 1,1,1,2)").markupToError();
		});
		it("takes any kind of finite numeric H value", function() {
			expect("(hsl: 1,1,1)").not.markupToError();
			expect("(hsl: 900,1,1)").not.markupToError();
			expect("(hsl: -8,1,1)").not.markupToError();
			expect("(hsl: 1.00006,1,1)").not.markupToError();
		});
		it("fractional H values are rounded", function() {
			expect("(print:(hsl: 170, 1, 0.5)'s h)").markupToPrint("170");
			expect("(print:(hsl: 59.1, 1, 0.5)'s h)").markupToPrint("59");
			expect("(print:(hsl: 3.999, 1, 0.5)'s h)").markupToPrint("4");
		});
		it("produces a colour using the three numbers and alpha", function() {
			expectColourToBe("(hsl:30,0.5,0.9)", "#F2E5D8");
			expectColourToBe("(hsl:270,0.1,0.5)", "#7F728C");
			expectColourToBe("(hsl:30,0.5,0.9,0.4)", "rgba(242,229,216,0.4)");
			expectColourToBe("(hsl:270,0.1,0.5,0.7)", "rgba(127,114,140,0.7)");
		});
		it("is aliased as (hsla:)", function() {
			expectColourToBe("(hsla:30,0.5,0.9)", "#F2E5D8");
			expectColourToBe("(hsla:270,0.1,0.5)", "#7F728C");
			expectColourToBe("(hsla:30,0.5,0.9,0.4)", "rgba(242,229,216,0.4)");
			expectColourToBe("(hsla:270,0.1,0.5,0.7)", "rgba(127,114,140,0.7)");
		});
	});
	describe("the (complement:) macro", function() {
		it("takes a single colour", function() {
			expect("(complement: 1)").markupToError();
			expect("(complement: 'red')").markupToError();
			expect("(complement: red)").not.markupToError();
		});
		it("returns the colour rotated 180 degrees through the LCH circle", function() {
			expect("(print: (complement: (lch:0.9,40,120)) is (lch:0.9,40,300))").markupToPrint('true');
		});
		it("doesn't change the alpha", function() {
			expect("(print: (complement: (lch:0.9,40,120,0.15)) is (lch:0.9,40,300,0.15))").markupToPrint('true');
		});
	});
	describe("the (lch:) macro", function() {
		it("takes a fractional L value between 0 and 1 inclusive, a C value between 0 and 132, and an optional fractional A value between 0 and 1 inclusive", function() {
			expect("(lch: 1)").markupToError();
			expect("(lch: 1,1)").markupToError();
			expect("(lch: 2,40,1)").markupToError();
			expect("(lch: 1,140,1)").markupToError();
			expect("(lch: -1,40,1)").markupToError();
			expect("(lch: 1,-1,1)").markupToError();
		});
		it("takes any kind of finite numeric H value", function() {
			expect("(lch: 0.5,90,1)").not.markupToError();
			expect("(lch: 0.5,90,900)").not.markupToError();
			expect("(lch: 0.5,90,-8)").not.markupToError();
			expect("(lch: 0.5,90,1.00006)").not.markupToError();
		});
		it("fractional H values are rounded", function() {
			expect("(print:(lch: 0.5, 90, 170)'s lch's h)").markupToPrint("170");
			expect("(print:(lch: 0.5, 90, 59.1)'s lch's h)").markupToPrint("59");
			expect("(print:(lch: 0.5, 90, 3.999)'s lch's h)").markupToPrint("4");
		});
		it("produces a colour using the three numbers and alpha", function() {
			expectColourToBe("(lch:0.6,80,10)", "rgba(254,71,126,1)");
			expectColourToBe("(lch:0.6,80,10,0.61)", "rgba(254,71,126,0.61)");
		});
		it("can round-trip through (rgb:)", function() {
			runPassage("(set: _RGB to (rgb: 210.2195, 132.4104, 63.5196))"
			+ "(set: $RGBtoLCH to (lch: _RGB's lch's l, _RGB's lch's c, _RGB's lch's h))"
			+ "(set: $LCHtoRGB to (rgb: $RGBtoLCH's r, $RGBtoLCH's g, $RGBtoLCH's b))");
			expect("(print:$RGBtoLCH is $LCHtoRGB)").markupToPrint('true');
		});
		it("produces colours with valid rgb values", function() {
			expect("(rgb:(lch: 0.6, 80, 10)'s r, 1,1)").not.markupToError();
		});
		it("is aliased as (lcha:)", function() {
			expectColourToBe("(lcha:0.6,80,10,0.61)", "rgba(254,71,126,0.61)");
		});
	});
	describe("the (mix:) macro", function() {
		it("takes two pairs of percents and colours", function() {
			expect("(mix: 1)").markupToError();
			expect("(mix: red)").markupToError();
			expect("(mix: 1, red)").markupToError();
			expect("(mix: 1, red, 1, blue)").not.markupToError();
			expect("(mix: 1.1, red, 1, blue)").markupToError();
		});
		it("mixes the colours in the lch colourspace", function() {
			expectColourToBe("(mix: 0.5, red, 0.5, blue)", "rgba(208,51,178,1)");
			expectColourToBe("(mix: 0.5, white, 0.5, #00f)", "rgba(174,137,254,1)");
			expectColourToBe("(mix: 0.4, red, 0.1, white)", "rgba(243,92,68,0.5)");
			expectColourToBe("(mix: 0.5, blue, 0.5, #fff+transparent)","rgba(197,103,132,0.75)");
		});
	});
	describe("the (palette:) macro", function() {
		it("takes a valid palette type string, and a colour", function() {
			expect("(palette: 1)").markupToError();
			expect("(palette: 'red')").markupToError();
			expect("(palette: red)").markupToError();
			["mono","adjacent","triad"].forEach(function(e) {
				expect("(palette: '" +e+ "', red)").not.markupToError();
			});
		});
		it("returns an array of four colours, including the input colour", function() {
			expect("(print: (palette: 'mono', red) is an array)").markupToPrint('true');
			expect("(print: (palette: 'mono', red)'s length)").markupToPrint('4');
			expect("(print:(all-pass: _a where _a is a colour, ...(palette:'mono', red)))").markupToPrint('true');
		});
	});
	describe("the (gradient:) macro", function() {
		it("takes a degree number, followed by two or more pairs of percentages and colours", function() {
			expect("(gradient: 45)").markupToError();
			expect("(gradient: 45,0)").markupToError();
			expect("(gradient: 45,0,red)").markupToError();
			expect("(gradient: 45,0,red,0.25,white,1,green)").not.markupToError();
			expect("(gradient: -1,0,red)").markupToError();
			expect("(gradient: 45,0,'#ffffff',1,white)").markupToError();
			expect("(gradient: 45,0,white)").markupToError();
			expect("(gradient: 45,0,red,0.25,white,1.1,green)").markupToError();
			expect("(gradient: 45,0,red,-0.25,white,1,green)").markupToError();
		});
		it("takes any kind of finite numeric degree value", function() {
			expect("(gradient: 900,0,red,0.25,white,1,green)").not.markupToError();
			expect("(gradient: -0.1,0,red,0.25,white,1,green)").not.markupToError();
			expect("(gradient: 1.006,0,red,0.25,white,1,green)").not.markupToError();
		});
		it("produces a gradient using the given degree and colour stops", function() {
			expect(runPassage("(print:(gradient:45,0,(rgb:0,255,0),1,(rgb:0,0,0)))").find('tw-colour'))
				.toHaveBackgroundGradient(45, [{stop:0,colour:"#00FF00"},{stop:1,colour:"#000000"}]);

			expect(runPassage("(print:(gradient:105,"
				+"0,(rgb:0,255,0),"
				+"0.2,(rgb:0,0,0),"
				+"0.6,(rgb:0,0,255),"
				+"1,white,"
				+"))").find('tw-colour'))
				.toHaveBackgroundGradient(105, [
					{stop:0,colour:"#00FF00"},
					{stop:0.2,colour:"#000000"},
					{stop:0.6,colour:"#0000FF"},
					{stop:1,colour:"#FFFFFF"},
				]);

			expect(runPassage("(print:(gradient:90,"
				+"0,#bf3f3f,"
				+"0.2,#a5bf3f,"
				+"0.4,#3fbf72,"
				+"0.6,#3f72bf,"
				+"0.8,#a53fbf,"
				+"1,#bf3f3f,"
				+"))").find('tw-colour'))
				.toHaveBackgroundGradient(90, [
					{stop:0,colour:"#bf3f3f"},
					{stop:0.2,colour:"#a5bf3f"},
					{stop:0.4,colour:"#3fbf72"},
					{stop:0.6,colour:"#3f72bf"},
					{stop:0.8,colour:"#a53fbf"},
					{stop:1,colour:"#bf3f3f"},
				]);
		});
	});
});
