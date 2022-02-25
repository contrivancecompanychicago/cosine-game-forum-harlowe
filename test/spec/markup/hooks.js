describe("hooks", function () {
	'use strict';
	describe("anonymous hooks", function () {
		it("consist of text inside single square brackets, which become <tw-hook> elements", function (){
			runPassage("Hey[foo]Whoa!");
			expect($('tw-passage').find('tw-hook').text()).toBe("foo");
		});
		it("hooks can nest if they don't interfere with the link syntax", function (){
			runPassage("[foo[bar]]");
			expect($('tw-passage').find('tw-hook > tw-hook').text()).toBe("bar");
			runPassage("[[foo]bar]");
			expect($('tw-passage').find('tw-hook > tw-hook').text()).toBe("foo");
		});
		it("<tw-hook> elements have no name attributes", function (){
			runPassage("[foo]");
			expect($('tw-passage').find('tw-hook').is('[name]')).toBe(false);
		});
	});
	describe("named hooks", function () {
		it("consist of a |, a name, and a >, attached to a hook", function (){
			expect("|hook>[foo]").markupToPrint("foo");
		});
		it("may also alternatively have a mirrored nametag on the other side", function (){
			expect("[foo]<hook|").markupToPrint("foo");
		});
		it("names may not be empty", function (){
			expect("|>[foo]").markupToPrint("|>foo");
		});
		it("names may not contain whitespace", function (){
			expect("|hook >[foo]").markupToPrint("|hook >foo");
		});
		it("names may contain only underscores or numbers", function() {
			expect("|2_>[foo]").markupToPrint("foo");
			expect("|_2>[foo]").markupToPrint("foo");
			expect("|_>[foo]").markupToPrint("foo");
			expect("|2>[foo]").markupToPrint("foo");
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
		it("names are insensitive", function() {
			var p = runPassage("[foo]<GRAULT| ");
			expect(p.find('tw-hook').attr('name')).toBe('grault');
			p = runPassage("[foo]<_gra_u-lt| ");
			expect(p.find('tw-hook').attr('name')).toBe('grault');
		});
	});
	describe("changer macro attached hooks", function () {
		it("consist of a macro, then a hook", function (){
			expect("(if:true)[foo]").markupToPrint("foo");
		});
		it("will simply print the value if the macro isn't a changer or boolean", function (){
			expect("(either:'A')[Hey]").markupToPrint('AHey');
			expect("(either:1)[Hey]").markupToPrint('1Hey');
			expect("(a:)[Hey]").markupToPrint('Hey');
			expect("(datamap:)[Hey]").markupToPrint('Hey');
			expect("(dataset:)[Hey]").markupToPrint('Hey');
			expect("(set:$x to 1)[Hey]").not.markupToError(); // The (set:) command doesn't attach
			expect("(either:(if:true))[Hey]").not.markupToError();
		});
		it("may have any amount of whitespace between the macro and the hook", function (){
			expect("(if:true) [foo]").markupToPrint("foo");
			expect("(if:true)\n[foo]").markupToPrint("foo");
			expect("(if:true) \n \n [foo]").markupToPrint("foo");
		});
		it("may have a nametag on the left side", function (){
			expect("(if:true)|hook>[foo]").not.markupToError();
		});
		it("may have a mirrored nametag on the right side", function (){
			expect("(if:true)[foo]<hook|").not.markupToError();
		});
		it("will error if the hook has no closing bracket", function (){
			expect("(if:true)[(if:true)[Good golly]", 2).markupToError();
		});
		it("can chain changers with +", function (){
			expect("(text-color:#639)+(text-style:'bold')[foo]").markupToPrint("foo");
		});
		it("can chain changers with any amount of whitespace around the +", function (){
			expect("(text-color:#639)  +  (text-style:'bold')    [foo]").markupToPrint("foo");
			expect("(text-color:#639)\n+(text-style:'bold')\n[foo]").markupToPrint("foo");
		});
		it("won't initiate chains with non-changer values", function (){
			expect("(either:7)+(text-style:'bold')[foo]").markupToPrint("7+foo");
		});
		it("will error when chaining with non-changers", function (){
			expect("(text-style:'bold')+(either:7,8)+(text-style:'italic')[foo]").markupToError();
		});
	});
	describe("changer variable attached hooks", function () {
		beforeEach(function(){
			runPassage('(set: $foo to (if:true))');
		});
		it("consist of a variable, then a hook", function (){
			expect("$foo[foo]").markupToPrint("foo");
		});
		it("will simply print the variable if it doesn't contain a changer or boolean", function (){
			runPassage('(set: $str to "A")'
				+ '(set: $num to 2)'
				+ '(set: $arr to (a:))'
				+ '(set: $dm to (datamap:))'
				+ '(set: $ds to (dataset:))');
			expect("$str[Hey]").markupToPrint('AHey');
			expect("$num[Hey]").markupToPrint('2Hey');
			expect("$arr[Hey]").markupToPrint('Hey');
			expect("$dm[Hey]").markupToPrint('Hey');
			expect("$ds[Hey]").markupToPrint('Hey');
		});
		it("may have any amount of whitespace between the variable and the hook", function (){
			expect("$foo [foo]").markupToPrint("foo");
			expect("$foo\n[foo]").markupToPrint("foo");
			expect("$foo \n \n [foo]").markupToPrint("foo");
		});
		it("may have a nametag on the left side", function (){
			expect("$foo|hook>[foo]").not.markupToError();
		});
		it("may have a mirrored nametag on the right side", function (){
			expect("$foo[foo]<hook|").not.markupToError();
		});
		it("will error if the hook has no closing bracket", function (){
			expect("$foo[$foo[Good golly]", 2).markupToError();
		});
		it("can chain changers", function (){
			runPassage("(set: $bar to (text-color:#639))(set: $baz to (text-style:'bold'))");
			expect("$bar+$baz[foo]").markupToPrint("foo");
		});
		it("can chain changers with any amount of whitespace", function (){
			runPassage("(set: $bar to (text-color:#639))(set: $baz to (text-style:'bold'))");
			expect("$bar  \n+  $baz    [foo]").markupToPrint("foo");
			expect("$bar  +\n  $baz    [foo]").markupToPrint("foo");
		});
		it("won't initiate chains with non-changer values", function (){
			runPassage("(set: $bar to 7)(set: $baz to (text-style:'bold'))");
			expect("$bar+$baz[foo]").markupToPrint("7+foo");
		});
		it("will error when chaining with non-changers", function (){
			runPassage("(set: $bar to 7)(set: $baz to (text-style:'bold'))");
			expect("$bar+$baz+$bar[foo]").markupToError();
		});
	});
	describe("hidden named hooks", function () {
		it("are named hooks with the square bracket replaced with a parenthesis", function (){
			runPassage("|hook)[foo]");
			expect($('tw-story').find('tw-hook').attr('name')).toBe('hook');
			runPassage("[foo](hook|");
			expect($('tw-story').find('tw-hook').attr('name')).toBe('hook');
		});
		it("are hidden when the passage initially renders", function (){
			expect("[foo](hook|").markupToPrint("");
		});
		it("are not revealed if (if:) is attached", function (){
			expect("(if:true)[foo](hook|").markupToPrint("");
		});
		it("are not revealed if true is attached", function (){
			expect("(set:$a to true)$a[foo](hook|").markupToPrint("");
		});
	});
	describe("unclosed hooks", function () {
		it("consist of [ followed by any number of =", function (){
			[1,2,3,5,9].forEach(function(i) {
				runPassage("foo[" + ("=".repeat(i)) + "bar");
				expect($('tw-passage').find('tw-hook').text()).toBe("bar");
			});
		});
		it("all text following it, until the end of the containing hook, is enclosed in the hook", function (){
			runPassage("foo[==bar");
			expect($('tw-passage').find('tw-hook').text()).toBe("bar");
			runPassage("foo[[==bar]baz");
			expect($('tw-passage').find('tw-hook > tw-hook').text()).toBe("bar");
			runPassage("[foo[==bar]baz");
			expect($('tw-passage').find('tw-hook > tw-hook').text()).toBe("bar");
		});
		it("work with changers", function (){
			expect("[foo(if:false)[==bar]baz").markupToPrint("foobaz");
		});
		it("work with the named hook syntax", function (){
			runPassage("foo|grault>[==barbaz");
			expect($('tw-passage').find('tw-hook').attr('name')).toBe('grault');
			expect("foo[|grault>[==barbaz](replace:?grault)[qux]").markupToPrint("fooqux");
		});
		it("work with the hidden named hook syntax", function (){
			expect("foo|foo)[==barbaz").markupToPrint("foo");
			expect("foo[|foo)[==bar]baz").markupToPrint("foobaz");
		});
		it("<tw-hook> elements have no name attributes", function (){
			runPassage("[==foo");
			expect($('tw-passage').find('tw-hook').is('[name]')).toBe(false);
		});
		it("affects headers and footers", function (){
			createPassage('A[==','H1',['header']);
			createPassage('B[==','H2',['header'], true);
			createPassage('E[==','F2',['footer'], true);
			createPassage('D[==','F1',['footer'], true);
			var p = runPassage('C[==','',[], true);
			expect(p.find('tw-include[name="H1"] > tw-hook > tw-include[name="H2"] > tw-hook > tw-hook > tw-include[name="F1"] > tw-hook > tw-include[name="F2"] > tw-hook').length).toBe(1);
		});
	});
});
