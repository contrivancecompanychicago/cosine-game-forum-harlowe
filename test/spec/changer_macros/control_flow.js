describe("control flow macros", function() {
	'use strict';
	describe("the (if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expect("(if:)[]").markupToError();
			expect("(if:true)[]").not.markupToError();
			expect("(if:'1')[]").markupToError();
		});
		it("returns a command that shows/hides the attached hook based on the provided boolean", function() {
			expect("(if:false)[Gosh]").markupToPrint('');
			expect("(if:true)[Gosh]").markupToPrint('Gosh');
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(if:true)").markupToError();
		});
		it("can be composed with itself", function() {
			expect("(set: $a to (if: true) + (if:true))$a[Gee]").markupToPrint("Gee");
			expect("(set: $a to (if: false) + (if:true))$a[Gee]").markupToPrint("");
		});
		it("has structural equality", function() {
			expect("(print: (if: true) is (if:true))").markupToPrint("true");
			expect("(print: (if: true) is not (if:false))").markupToPrint("true");
		});
		it("can be composed with other style macros", function() {
			expect("(set: $a to (if: true) + (text-style:'bold'))$a[Gee]").markupToPrint("Gee");
			expect("(set: $a to (if: false) + (text-style:'bold'))$a[Gee]").markupToPrint("");
		});
	});
	describe("the (unless:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expect("(unless:)[]").markupToError();
			expect("(unless:true)[]").not.markupToError();
			expect("(unless:'1')[]").markupToError();
		});
		it("behaves as the inverse of (if:)", function() {
			expect("(unless:false)[Gosh]").markupToPrint('Gosh');
			expect("(unless:true)[Gosh]").markupToPrint('');
		});
		it("can be composed with itself", function() {
			expect("(set: $a to (unless: false) + (unless:false))$a[Gee]").markupToPrint("Gee");
			expect("(set: $a to (unless: true) + (unless:false))$a[Gee]").markupToPrint("");
		});
		it("has structural equality", function() {
			expect("(print: (unless: true) is (unless:true))").markupToPrint("true");
			expect("(print: (unless: true) is not (unless:false))").markupToPrint("true");
		});
		it("can be composed with other style macros", function() {
			expect("(set: $a to (unless: false) + (text-style:'bold'))$a[Gee]").markupToPrint("Gee");
			expect("(set: $a to (unless: true) + (text-style:'bold'))$a[Gee]").markupToPrint("");
		});
	});
	describe("the (else-if:) macro", function() {
		it("accepts exactly 1 boolean argument", function() {
			expect("(else-if:)[]").markupToError();
			expect("(else-if:'1')[]").markupToError();
		});
		it("must occur after a conditionally displayed hook", function() {
			expect("(else-if:false)[]").markupToError();
			expect("(either:true)[](else-if:true)[]").not.markupToError();
			expect("(either:false)[](else-if:true)[]").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(if:true)[](else-if:true)").markupToError();
		});
		it("hides the hook if the preceding hook was displayed, otherwise acts like (if:)", function() {
			expect("(either:false)[Wow](else-if:true)[Gee]").markupToPrint('Gee');
			expect("(either:false)[Wow](else-if:false)[Gee]").markupToPrint('');
			expect("(either:true)[Wow](else-if:true)[Gee]").markupToPrint('Wow');
			expect("(if:false)[Wow](else-if:true)[Gee]").markupToPrint('Gee');
			expect("(if:false)[Wow](else-if:false)[Gee]").markupToPrint('');
			expect("(if:true)[Wow](else-if:true)[Gee]").markupToPrint('Wow');
		});
		it("works even when nested", function() {
			expect("(either:true)[(either:false)[Wow](else-if:true)[Gee]](else-if:true)[Gosh]").markupToPrint('Gee');
			expect("(either:true)[(either:true)[Wow](else-if:true)[Gee]](else-if:true)[Gosh]").markupToPrint('Wow');
		});
	});
	describe("the (else:) macro", function() {
		it("accepts exactly 0 arguments", function() {
			expect("(if:false)[](else:true)[]").markupToError();
			expect("(if:false)[](else:'1')[]").markupToError();
		});
		it("must occur after a conditionally displayed hook", function() {
			expect("(else:)[]").markupToError();
			expect("(either:true)[](else:)[]").not.markupToError();
			expect("(either:false)[](else:)[]").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(if:true)[](else:)").markupToError();
		});
		it("hides the hook if the preceding hook was displayed, otherwise shows it", function() {
			expect("(either:false)[Wow](else:)[Gee]").markupToPrint('Gee');
			expect("(either:true)[Wow](else:)[Gee]").markupToPrint('Wow');
			expect("(if:false)[Wow](else:)[Gee]").markupToPrint('Gee');
			expect("(if:true)[Wow](else:)[Gee]").markupToPrint('Wow');
			expect("(if:false)[Wow](else-if:true)[Gee](else:)[Aww]").markupToPrint('Gee');
			expect("(if:false)[Wow](else-if:false)[Gee](else:)[Aww]").markupToPrint('Aww');
			expect("(if:true)[Wow](else-if:true)[Gee](else:)[Aww]").markupToPrint('Wow');
		});
		it("works even when nested", function() {
			expect("(either:true)[(either:false)[Wow](else:)[Gee]](else:)[Gosh]").markupToPrint('Gee');
			expect("(either:true)[(either:true)[Wow](else:)[Gee]](else:)[Gosh]").markupToPrint('Wow');
		});
	});
	it("in debug mode, the <tw-expression> has the 'false' class when the hook is hidden", function() {
		expect(runPassage("(if:false)[Gosh]").find('tw-expression').attr('class')).toMatch(/\bfalse\b/);
	});
});
