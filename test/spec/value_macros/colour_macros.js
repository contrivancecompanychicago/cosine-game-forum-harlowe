describe("colour macros", function() {
	'use strict';

	function expectColourToBe(str, colour) {
		expect(runPassage("(print:" + str + ")").find('tw-colour')).toHaveBackgroundColour(colour);
	}
	describe("the (rgb:) macro", function() {
		it("takes three whole numbers between 0 and 255 inclusive", function() {
			expect("(rgb: 1)").markupToError();
			expect("(rgb: 1,1)").markupToError();
			expect("(rgb: 12, 12, 12.1)").markupToError();
			expect("(rgb: 1, 300, 1)").markupToError();
		});
		it("produces a colour using the three numbers", function() {
			expectColourToBe("(rgb:255,0,255)", "#FF00FF");
			expectColourToBe("(rgb:47,25,12)", "#2F190C");
		});
	});
	describe("the (hsl:) macro", function() {
		it("takes fractional S and L values between 0 and 1 inclusive", function() {
			expect("(hsl: 1)").markupToError();
			expect("(hsl: 1,1)").markupToError();
			expect("(hsl: 1,1,1.2)").markupToError();
			expect("(hsl: 1,-1,0)").markupToError();
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
		it("produces a colour using the three numbers", function() {
			expectColourToBe("(hsl:30,0.5,0.9)", "#F2E5D8");
			expectColourToBe("(hsl:270,0.1,0.5)", "#7F728C");
		});
	});
});
