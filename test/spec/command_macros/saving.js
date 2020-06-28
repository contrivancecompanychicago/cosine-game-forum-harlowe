describe("save macros", function() {
	'use strict';
	
	function retrieveStoredState(itemName) {
		var storedItem = localStorage.getItem(itemName);
		
		expect(function() {
			storedItem = JSON.parse(storedItem);
		}).not.toThrow();
		expect(storedItem).not.toBe(null);
		return storedItem;
	}
	/*
		This should be identical to the internal function in macrolib/commands.js
	*/
	function storagePrefix(text) {
		return "(" + text + " " + Engine.options.ifid + ") ";
	}

	describe("the (savegame:) macro", function() {
		it("accepts 1 or 2 strings", function() {
			expect("(savegame:'1')").not.markupToError();
			expect("(savegame:'1','A')").not.markupToError();
			expect("(savegame:)").markupToError();
			expect("(savegame:2)").markupToError();
			expect("(savegame:true)").markupToError();
			expect("(savegame:'1','1','1')").markupToError();
		});
		it("saves the game in localStorage in JSON format", function() {
			runPassage("(set:$foo to 1)", "corge");
			expect("(savegame:'1','Filename')").not.markupToError();
			
			retrieveStoredState(storagePrefix('Saved Game') + "1");
		});
		it("can save collection variables", function() {
			runPassage(
				"(set:$arr to (a:2,4))" +
				"(set:$dm to (datamap:'HP',4))" +
				"(set:$ds to (dataset:2,4))",
				"corge"
			);
			expect("(savegame:'1')").not.markupToError();
		});
		it("can save changer command variables", function() {
			runPassage(
				"(set:$c1 to (font:'Skia'))" +
				"(set:$c2 to $c1 + (align:'==>'))" +
				"(set:$c3 to (a:$c2 + (if: true)))",
				"corge"
			);
			expect("(savegame:'1')").not.markupToError();
			runPassage(
				"(set:$c4 to (hover-style:(font:'Skia')))" +
				"(set:$c5 to $c4 + (align:'==>'))",
				"grault"
			);
			expect("(savegame:'1')").not.markupToError();
		});
		it("can save gradients", function() {
			runPassage("(set:$c1 to (gradient:90,0,white,1,black))");
			expect("(savegame:'1')").not.markupToError();
		});
		it("can save custom macros", function() {
			runPassage(
				"(set:$c1 to (macro: num-type _a, num-type _b, [(output:(max:_a,_b,200))]))"
			);
			expect("(savegame:'1')").not.markupToError();
		});
		it("works from the start of the game", function() {
			expect("(savegame:'1','Filename')", "qux").not.markupToError();
			
			retrieveStoredState(storagePrefix('Saved Game') + "1");
		});
		it("stores lots of data", function() {
			runPassage("(set:" + Array(200).join().split(',').map(function(_, e) {
				return "$V" + e + " to " + e;
			}) + ")");
			expect("(savegame:'1','Filename')").not.markupToError();
			
			retrieveStoredState(storagePrefix('Saved Game') + "1");
		});
		it("stores the save file's name", function() {
			runPassage("(set:$foo to 1)", "corge");
			expect("(savegame:'1','Quux')").not.markupToError();
			
			var storedItem = localStorage.getItem(storagePrefix('Saved Game Filename') + "1");
			expect(storedItem).toBe("Quux");
		});
		it("alters the (savedgames:) datamap", function() {
			expect("(print: (savedgames:) contains 'A')").markupToPrint('false');
			expect("(savegame:'A','Filename')").not.markupToError();
			expect("(print: (savedgames:)'s A)").markupToPrint('Filename');
		});
	});
	describe("the (loadgame:) macro", function() {
		it("accepts 1 string", function() {
			runPassage("(savegame:'1','Filename')");
			expect("(loadgame:)").markupToError();
			expect("(loadgame:2)").markupToError();
			expect("(loadgame:true)").markupToError();
			expect("(loadgame:'1','1')").markupToError();
		});
		it("loads a saved game, restoring the game history and navigating to the saved passage", function(done) {
			runPassage("uno", "uno");
			runPassage("dos(savegame:'1','Filename')", "dos");
			runPassage("tres", "tres");
			expect("cuatro(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect($("tw-passage").last().text()).toMatch("dos");
				expect("(history:)").markupToPrint("uno,dos");
				done();
			}, 20);
		});
		it("restores the saved game's variables", function(done) {
			runPassage("(set:$foo to 'egg')(set:$bar to 2)(set:$baz to true)", "uno");
			runPassage("(set:$bar to it + 2)(savegame:'1','Filename')", "dos");
			runPassage("(set:$bar to it + 2)(set:$foo to 'nut')", "tres");
			expect("(set:$bar to it + 2)(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$foo $bar (text: $baz)").markupToPrint("egg 4 true");
				done();
			}, 20);
		});
		it("restores the saved game's typed variables", function(done) {
			runPassage("(set:str-type $foo to 'A')", "uno");
			runPassage("(set:$foo to it+'B')(savegame:'1','Filename')", "dos");
			runPassage("(set:str-type $bar to 'C')", "tres");
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(set:num-type $bar to 2)").not.markupToError();
				expect("(set:num-type $foo to 2)").markupToError();
				done();
			}, 20);
		});
		it("can restore collection variables", function(done) {
			runPassage(
				"(set:$arr to (a:'egg'))" +
				"(set:$dm to (datamap:'HP',4))" +
				"(set:$ds to (dataset:2,4))" +
				"(savegame:'1')",
				"corge"
			);
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("$arr (text:$dm's HP) (text: $ds contains 4)").markupToPrint("egg 4 true");
				done();
			}, 20);
		});
		it("can restore changer command variables", function(done) {
			runPassage(
				"(set:$c1 to (text-style:'underline'))" +
				"(set:$c2 to (a: $c1 + (hook: 'luge')))");
			runPassage("(savegame:'1')");
			expect("(loadgame:'1')").not.markupToError();
			requestAnimationFrame(function() {
				var hook = runPassage("(either:$c2's 1st)[goop]").find('tw-hook');
				setTimeout(function() {
					expect(hook.css('text-decoration')).toBe('underline');
					expect(hook.attr('name')).toBe('luge');
					done();
				}, 20);
			});
		});
		it("can restore gradients", function(done) {
			runPassage("(set:$c1 to (gradient:90,0,white,1,black))");
			runPassage("(savegame:'1')");
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("(print:'`'+(source:$c1)+'`')").markupToPrint('(gradient:90,0,white,1,black)');
				done();
			}, 20);
		});
		it("can restore custom macros", function(done) {
			runPassage(
				"(set:$c1 to (macro: num-type _a, num-type _b, [(output:(max:_a,_b,200))]))"
				+ "(set:$c2 to (macro: num-type _a, str-type _b, [(output:(str:($c1:_a,150))+_b)]))"
			);
			expect("(savegame:'1')").not.markupToError();
			expect("(loadgame:'1')").not.markupToError();
			setTimeout(function() {
				expect("($c1:198,197)").markupToPrint('200');
				expect("($c1:298,297)").markupToPrint('298');
				expect("($c2:312,' bears')").markupToPrint('312 bears');
				done();
			},20);
		});
		it("produces a user-friendly prompt for deletion if the save data is invalid", function(done) {
			runPassage("uno", "uno");
			runPassage("dos", "dos");
			runPassage("(savegame:'1')", "tres");
			runPassage("quatro", "quatro");
			deletePassage('dos');
			var p = runPassage("(loadgame:'1')");
			expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(1);
			expect($("tw-dialog").find('tw-link').first().text()).toBe("OK");
			expect($("tw-dialog").find('tw-link').last().text()).toBe("Cancel");
			$("tw-dialog").find('tw-link').first().click();
			setTimeout(function() {
				expect($("tw-story").find("tw-backdrop > tw-dialog").length).toBe(0);
				done();
			},40);
			//TODO: Test that the save data is actually deleted.
		});
	});
});

