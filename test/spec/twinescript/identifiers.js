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
		it("also refers to the variable of a 'where' lambda", function() {
			expect("(find: _a where it > 2, 1, 3, 6, 1)").markupToPrint("3,6");
			expect("(altered: _a via it + 1, 2,5)").markupToPrint("3,6");
		});
		it("can be used in a lambda when the variable name is missing", function() {
			expect("(find: where it > 2, 1, 3, 6, 1)").markupToPrint("3,6");
			expect("(altered: via it + 1, 2,5)").markupToPrint("3,6");
		});
	});
	describe("implicit 'it'", function () {
		it("is added for incomplete comparisons", function (){
			expect("(set:$red to 3)(print: $red > 2 and < 4)").markupToPrint("true");
			expect("(set:$red to 'egg')(print: $red contains 'g' and contains 'e')").markupToPrint("true");
			expect("(set:$red to 'egg')(set:$blue to 'g')(print: $blue is in $red and is in 'go')").markupToPrint("true");
		});
		it("isn't recognised inside text", function (){
			expect("(set:$red to window.sito)(set:$red to window.itx)(set:$red to window.sito)").not.markupToError();
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
		it("isn't recognised inside text", function (){
			expect("(set:$red to window.sits)(set:$red to window.itsx)(set:$red to window.sitss)").not.markupToError();
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
	describe("the 'time' identifier", function () {
		it("refers to the elapsed milliseconds since the passage was rendered", function (){
			expect("(print:time <= 20)").markupToPrint("true");
			expect("(set:$red to time)$red").not.markupToError();
		});
		it("works inside deferred hooks", function (done){
			var p = runPassage("(link:'Z')[(print: time >= 200 and time <= 300)]");
			setTimeout(function() {
				p.find('tw-link').click();
				setTimeout(function() {
					expect(p.text()).toBe('true');
					done();
				});
			}, 200);
		});
		it("works inside displayed passages", function (done){
			createPassage("(print:time >= 200 and time <= 300)", "grault");
			var p = runPassage("(link:'Z')[(display:'grault')]");
			setTimeout(function() {
				p.find('tw-link').click();
				setTimeout(function() {
					expect(p.text()).toBe('true');
					done();
				});
			}, 200);
		});
		it("is case-insensitive", function (){
			expect("(print: tIME)(print: timE)(print: tImE)").not.markupToError();
		});
		it("can't be used in an 'into' operation", function (){
			expect("(put:2 into $red)(put:$red into time)").markupToError();
		});
		it("can't be used as the subject of a 'to' operation", function (){
			expect("(set:time to 2)").markupToError();
		});
		it("isn't recognised inside text", function (){
			expect("(set:$red to window.xtime)(set:$red to window.timex)(set:$red to window.xtimex)").not.markupToError();
		});
		it("isn't recognised inside 'exit'", function (){
			expect("(print:exit)").not.markupToError();
		});
	});
	describe("the 'visits' identifier", function () {
		it("refers to the number of times this passage was visited, including the current time", function (){
			["foo","bar","baz","foo","bar","foo","baz"].forEach(function(e) {
				runPassage("", e);
			});
			expect(runPassage("(print: visits)","foo").text()).markupToPrint("4");
			expect(runPassage("(print: visits + 1)","baz").text()).markupToPrint("4");
			expect(runPassage("(print: visits is 1)","qux").text()).markupToPrint("true");
		});
		xit("works inside displayed passages, but only refers to the outer passage", function () {});
		it("is case-insensitive", function () {
			expect("(print: viSiTs)(print: VISITs)(print: VISITs)").not.markupToError();
		});
		it("can also be written as 'visit'", function () {
			expect("(print: viSiT)(print: VISIT)(print: vISIT)").not.markupToError();
			expect(runPassage("(print: visit is 1)","qux").text()).markupToPrint("true");
		});
		xit("can't be used in an 'into' operation", function () {});
		xit("can't be used as the subject of a 'to' operation", function () {});
		xit("isn't recognised inside text", function () {});
	});
	describe("the 'exits' identifier", function () {
		[['link','(link-reveal:"foo")'],
		['(link-show:)','(link-show:"foo",?bar)'],
		['passage link', '[[foo->grault]]'],
		['click enchantment','foo(click:"foo")','foo1'],
		['mouseover enchantment','foo(mouseover:"foo")', 'foo1']].forEach(function(e) {
			var name = e[0], code = e[1];
			it("counts the number of " + name + "s in the passage", function() {
				createPassage("", "grault");
				expect(code+"[](print:exits)").markupToPrint("foo1");
				expect(code+"[]"+code.replace(/foo/g,'bar')+"[](print:exits)").markupToPrint("foobar2");
				expect(code+"[]"+code.replace(/foo/g,'bar')+"[]"+code.replace(/foo/g,'baz')+"[](print:exits)").markupToPrint("foobarbaz3");
			});
		});
		it("is case-insensitive", function () {
			expect("(print: exitS)(print: EXIts)(print: exITS)").not.markupToError();
		});
		it("can also be written as 'exit'", function () {
			expect("(print: EXit)(print: EXIT)(print: exit)").not.markupToError();
			expect(runPassage("[[qux]](print: exit is 1)","qux").text()).markupToPrint("quxtrue");
		});
	});
});
