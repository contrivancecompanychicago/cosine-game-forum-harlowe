describe("miscellaneous hook changer macros", function() {
	'use strict';
	describe("the (hook:) macro", function () {
		it("requires exactly 1 string argument", function() {
			expect("(print:(hook:))").markupToError();
			expect("(print:(hook:1))").markupToError();
			expect("(print:(hook:'A','B'))").markupToError();
			expect("(print:(hook:'A'))").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to a hook", function() {
			expect("(hook:'A')").markupToError();
			expect("(hook:'A')[]").not.markupToError();
		});
		it("errors when given an empty string", function() {
			expect("(hook:'')[]").markupToError();
		});
		it("gives a name to the hook", function (){
			runPassage("(hook:'grault')[foo]");
			expect($('tw-passage').find('tw-hook').attr('name')).toBe('grault');
		});
		it("is case-insensitive and dash-insensitive", function (){
			runPassage("(hook:'GR--AUL-T')[foo]");
			expect($('tw-passage').find('tw-hook').attr('name')).toBe('grault');
			expect("(print:(hook:'Abc') is (hook:'A_BC'))").markupToPrint('true');
		});
		it("works with (enchant:)", function(done) {
			expect('dolly(change:"dolly",(hook:"dolly"))(replace:?dolly)[horsie]').markupToPrint('horsie');
			var p = runPassage('(enchant:"dolly",(hook:"dolly"))dolly(click-replace:?dolly)[horsie]');
			setTimeout(function() {
				p.find('.enchantment-link').click();
				expect(p.text()).toBe('horsie');
				done();
			});
		});
	});
	describe("the (verbatim:) macro", function() {
		it("takes no values", function() {
			expect("(print:(verbatim:))").not.markupToError();
			expect("(print:(verbatim:1))").markupToError();
			expect("(print:(verbatim:'A','B'))").markupToError();
			expect("(print:(verbatim:'A'))").markupToError();
		});
		it("is aliased as (v6m:)", function() {
			expect("(print:(verbatim:) is (v6m:))").markupToPrint('true');
		});
		it("when attached to a hook, prints that hook's source verbatim", function() {
			expect("(verbatim:)[$foo]").markupToPrint('$foo');
		});
		it("when attached to a command, prints that hook's source verbatim", function() {
			expect("(verbatim:)(print:'$foo')").markupToPrint('$foo');
			expect("(verbatim:)(print:(source:(a:)))").markupToPrint('(a:)');
		});
		it("preserves newlines, and creates <tw-consecutive-br>s appropriately", function() {
			expect(runPassage("(v6m:)[A \n B \n C]").find('br').length).toBe(2);
			expect(runPassage("(v6m:)[A\n\n\nB]").find('tw-consecutive-br').length).toBe(2);
		});
	});
});
