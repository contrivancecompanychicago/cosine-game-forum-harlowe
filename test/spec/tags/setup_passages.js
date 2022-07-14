describe("setup passages", function() {
	'use strict';
	beforeAll(function() {
		Utils.options.debug = true;
	});
	afterAll(function() {
		Utils.options.debug = false;
	});
	[false,true].forEach(function headerFooterTests(debug) {
		var header = debug ? "debug-header" : "header";
		var footer = debug ? "debug-footer" : "footer";
		var startup = debug ? "debug-startup" : "startup";
		
		describe("the '" + header + "' tag", function() {
			it("makes the passage's source run before any other passage is run", function() {
				createPassage("(set: $red to $red + 1)","header",[header]);
				expect("$red").markupToPrint("1");
				expect("$red").markupToPrint("2");
				expect("$red").markupToPrint("3");
			});
			it("prepends the passage's source to every passage at runtime", function() {
				createPassage("Gee","header",[header]);
				expect("wow").markupToPrint("Geewow");
			});
			it("creates proper <tw-include> elements", function() {
				createPassage("Gee","header",[header]);
				var p = runPassage("wow");
				expect(p.find('tw-include').text()).toBe("Gee");
				expect(p.text()).toBe("Geewow");
			});
			it("tagged passages run in alphabetical order", function() {
				createPassage("(set: $red to it + 'D')","header4",[header]);
				createPassage("(set: $red to it + 'B')","header2",[header]);
				createPassage("(set: $red to it + 'C')","header3",[header]);
				createPassage("(set: $red to 'A')","header1",[header]);
				expect("$red").markupToPrint("ABCD");
			});
			it("can be 'punched through' with unclosed markup", function() {
				createPassage("Gee[==gosh","header",[header]);
				var p = runPassage("wow",'bar');
				expect(p.find('tw-include').first().text()).toBe("Geegoshwow");
				createPassage("golly[==","header2",[header]);
				p = runPassage("whoa",'foo');
				expect(p.find('tw-include').first().text()).toBe("Geegoshgollywhoa");
			});
			it("affects hooks inside the passage", function() {
				createPassage("(click: ?red)[]","header",[header]);
				expect(runPassage("|red>[Hmm]","1").find('tw-enchantment').length).toBe(1);
			});
			it("won't lead to infinite regress if it is displayed itself", function() {
				createPassage("Hey","header",[header]);
				expect(goToPassage("header").text()).toBe("HeyHey");
			});
			if (debug) {
				it("tagged passages run after ordinary header passages", function() {
					createPassage("(set: $red to 'A')","setup2",["header"]);
					createPassage("(set: $red to $red + 'B')","setup1",[header]);
					expect("$red").markupToPrint("AB");
				});
			}
		});
		describe("the '" + footer + "' tag", function() {
			it("makes the passage's source run after any other passage is run", function() {
				createPassage("(set: $red to $red + 1)","footer",[footer]);
				expect("$red").markupToPrint("0");
				expect("$red").markupToPrint("1");
				expect("$red").markupToPrint("2");
			});
			it("appends the passage's source to every passage at runtime", function() {
				createPassage("gee","footer",[footer]);
				expect("Wow").markupToPrint("Wowgee");
			});
			it("creates proper <tw-include> elements", function() {
				createPassage("wow","footer",[footer]);
				var p = runPassage("Gee");
				expect(p.find('tw-include').text()).toBe("wow");
				expect(p.text()).toBe("Geewow");
			});
			it("tagged passages run in alphabetical order", function() {
				createPassage("(set: $red to it + 'D')","footer4",[footer]);
				createPassage("(set: $red to $red + 'B')","footer2",[footer]);
				createPassage("(set: $red to it + 'C')","footer3",[footer]);
				createPassage("(set: $red to 'A')","footer1",[footer]);
				runPassage('');
				expect("$red").markupToPrint("ABCD");
			});
			it("can be 'punched through' with unclosed markup", function() {
				createPassage("wow","footer2",[footer]);
				var p = runPassage("Gosh[=",'bar');
				expect(p.find('tw-hook tw-include').text()).toBe("wow");
				createPassage("gee[=","footer",[footer]);
				p = runPassage("Gosh[=",'bar');
				expect(p.find('tw-hook tw-include tw-include').text()).toBe("wow");
			});
			it("affects hooks inside the passage", function() {
				createPassage("(click: ?red)[]","footer",[footer]);
				expect(runPassage("|red>[Hmm]","1").find('tw-enchantment').length).toBe(1);
			});
			it("won't lead to infinite regress if it is displayed itself", function() {
				createPassage("Hey","footer",[footer]);
				expect(goToPassage("footer").text()).toBe("HeyHey");
			});
			if (debug) {
				it("tagged passages run after ordinary footer passages", function() {
					createPassage("(set: $red to 'A')","setup2",["footer"]);
					createPassage("(set: $red to $red + 'B')","setup1",[footer]);
					runPassage('');
					expect("$red").markupToPrint("AB");
				});
			}
		});
		describe("the '" + startup + "' tag", function() {
			it("makes the passage's source run before the very first passage is run", function() {
				createPassage("(set: $red to $red + 1)","setup",[startup]);
				expect("$red").markupToPrint("1");
				expect("$red").markupToPrint("1");
			});
			it("creates proper <tw-include> elements", function() {
				createPassage("Gee","setup",[startup]);
				var p = runPassage("wow");
				expect(p.find('tw-include').text()).toBe("Gee");
				expect(p.text()).toBe("Geewow");
			});
			it("tagged passages run in alphabetical order", function() {
				createPassage("(set: $red to 'A')","setup1",[startup]);
				createPassage("(set: $red to $red + 'B')","setup2",[startup]);
				expect("$red").markupToPrint("AB");
			});
			it("tagged passages run before header passages", function() {
				createPassage("(set: $red to 'A')","setup2",[startup]);
				createPassage("(set: $red to $red + 'B')","setup1",[header]);
				expect("$red").markupToPrint("AB");
			});
			it("affects hooks inside the passage", function() {
				createPassage("(click: ?red)[]","setup",[startup]);
				expect(runPassage("|red>[Hmm]","1").find('tw-enchantment').length).toBe(1);
			});
		});
	});
	it("run in the intended order", function() {
		createPassage("foo","A",['startup']);
		createPassage("bar","B",['debug-startup']);
		createPassage("baz","D",['debug-header']);
		createPassage("qux","C",['header']);
		createPassage("corge","E",['debug-footer']);
		createPassage("garply","F",['footer']);
		expect("grault").markupToPrint('foobarquxbazgraultgarplycorge');
	});
	it("work when empty", function() {
		createPassage("","A",['startup']);
		createPassage("","B",['debug-startup']);
		createPassage("","D",['debug-header']);
		createPassage("","C",['header']);
		createPassage("","E",['debug-footer']);
		createPassage("","F",['footer']);
		expect("grault").not.markupToError();
	});
});
