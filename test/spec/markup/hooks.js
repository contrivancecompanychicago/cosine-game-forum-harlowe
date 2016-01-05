describe("hooks", function () {
	'use strict';
	describe("named hooks", function () {
		it("consist of a |, a name, and a >, attached to a hook", function (){
			expect("|hook>[foo]").markupToPrint("foo");
		});
		it("may also alternatively have a mirrored nametag on the other side", function (){
			expect("[foo]<hook|").markupToPrint("foo");
		});
		it("names may not contain whitespace", function (){
			expect("|hook >[foo]").markupToPrint("|hook >[foo]");
		});
		it("can be nested", function (){
			expect("[[Hello!]<b|]<a|").markupToPrint("Hello!");
			expect("[|b>[Hello!]]<a|").markupToPrint("Hello!");
			expect("|a>[|b>[Hello!]]").markupToPrint("Hello!");
			expect("|a>[[Hello!]<b|]").markupToPrint("Hello!");
		});
		it("become <tw-hook> elements", function (){
			runPassage("[foo]<hook|");
			expect($('tw-passage').find('tw-hook').text()).toBe('foo');
		});
		it("<tw-hook> elements have name attributes", function (){
			runPassage("[foo]<grault|");
			expect($('tw-passage').find('tw-hook').attr('name')).toBe('grault');
		});
	});
	describe("macro attached hooks", function () {
		it("consist of a macro, then a hook", function (){
			expect("(if:true)[foo]").markupToPrint("foo");
		});
		it("may have any amount of whitespace between the macro and the hook", function (){
			expect("(if:true) [foo]").markupToPrint("foo");
			expect("(if:true)\n[foo]").markupToPrint("foo");
			expect("(if:true) \n \n [foo]").markupToPrint("foo");
		});
		it("may not have a mirrored nametag on the other side", function (){
			expect("(if:true)[foo]<hook|", 2).markupToError();
		});
		it("will error if the hook has no closing bracket", function (){
			expect("(if:true)[(if:true)[Good golly]", 2).markupToError();
		});
		it("will error if the macro doesn't produce a changer command or boolean", function (){
			expect("(either:'A')[Hey]").markupToError();
			expect("(either:1)[Hey]").markupToError();
			expect("(a:)[Hey]").markupToError();
			expect("(datamap:)[Hey]").markupToError();
			expect("(dataset:)[Hey]").markupToError();
			expect("(set:$x to 1)[Hey]").markupToError();
		});
	});
});
