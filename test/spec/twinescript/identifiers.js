describe("identifiers", function () {
	'use strict';
	describe("the 'it' identifier", function () {
		it("refers to the left side of a recent comparison", function (){
			expect("(set:$red to 3)(print: $red > 2 and it < 4)").markupToPrint("true");
			expect("(set:$red to 3)(set:$blue to 6)(print: $red > 2 and $blue > 2 and it > 4)").markupToPrint("true");
			expect("(set:$red to 'egg')(print: $red contains 'g' and it contains 'e')").markupToPrint("true");
			expect("(set:$red to 'egg')(set:$blue to 'g')(print: $blue is in $red and it is in 'go')").markupToPrint("true");
		});
		it("is case-insensitive", function (){
			expect("(set:$red to 'Bee')(set:$red to IT + 's')(set:$red to iT + '!')$red").markupToPrint("Bees!");
		});
		it("also refers to the left side of a 'to' operation", function (){
			expect("(set:$red to 'Bee')(set:$red to it + 's')$red").markupToPrint("Bees");
		});
		it("can be used in sub-expressions", function (){
			expect("(put:'Bee' into $red)(set: $red to (substring: it, 2, 3))$red").markupToPrint("ee");
		});
		it("can't be used in an 'into' operation", function (){
			expect("(put:'Bee' into $red)(put:$red + 's' into it)").markupToError();
		});
		it("can't be used as the subject of a 'to' operation", function (){
			expect("(set:$red to 1)(set:it to it + 2)").markupToError();
		});
	});
	describe("implicit 'it'", function () {
		it("is added for incomplete comparisons", function (){
			expect("(set:$red to 3)(print: $red > 2 and < 4)").markupToPrint("true");
			expect("(set:$red to 'egg')(print: $red contains 'g' and contains 'e')").markupToPrint("true");
			expect("(set:$red to 'egg')(set:$blue to 'g')(print: $blue is in $red and is in 'go')").markupToPrint("true");
		});
	});
	describe("the 'its' property access syntax", function () {
		it("accesses properties from the left side of a recent comparison", function (){
			expect("(set:$red to 'egg')(print: $red is 'egg' and its length is 3)").markupToPrint("true");
		});
		it("is case-insensitive", function (){
			expect("(set:$red to 'egg')(print: $red is 'egg' and iTS length is 3)").markupToPrint("true");
		});
		it("also accesses properties from the left side of a 'to' operation", function (){
			expect("(set:$red to 'Bee')(set:$red to its 1st)$red").markupToPrint("B");
		});
		it("can have properties accessed from it", function (){
			expect("(set:$red to (a:'Bee'))(set:$red to its 1st's 1st)$red").markupToPrint("B");
		});
	});
	describe("the computed 'its' property access syntax", function () {
		it("accesses properties from the left side of a recent comparison", function (){
			expect("(set:$red to 'egg')(print: $red is 'egg' and its ('length') is 3)").markupToPrint("true");
		});
		it("also accesses properties from the left side of a 'to' operation", function (){
			expect("(set:$red to 'Bee')(set:$red to its (1))$red").markupToPrint("B");
		});
		it("can have properties accessed from it", function (){
			expect("(set:$red to (a:'Bee'))(set:$red to its (1)'s 1st)$red").markupToPrint("B");
			expect("(set:$red to (a:'Bee'))(set:$red to its (1)'s (1))$red").markupToPrint("B");
		});
	});
	//TODO: time
});
