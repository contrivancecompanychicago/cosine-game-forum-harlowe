describe("browser sessions", function() {
	'use strict';
	
	function retrieveStoredStateString() {
		var storedItem = sessionStorage.getItem("Saved Session");
		
		expect(function() {
			JSON.parse(storedItem);
		}).not.toThrow();
		expect(storedItem).not.toBe(null);
		return storedItem;
	}
	it("are automatically saved to sessionStorage in JSON format", function() {
		runPassage("(set:$foo to 1)", "corge");
		runPassage("(set:$foo to it + 1)","garply");
		retrieveStoredStateString();
	});

	it("can be restored from sessionStorage", function(done) {
		runPassage("uno", "uno");
		runPassage("dos(set:$foo to 1)", "dos");
		runPassage("tres(set:$bar to (dm:'X',(font:'Skia')))", "tres");
		runPassage("cuatro(set:$foo to it + 1)","cuatro");

		deserialiseState(retrieveStoredStateString());
		setTimeout(function() {
			expect("(history:)").markupToPrint("uno,dos,tres,cuatro");
			expect("$foo").markupToPrint("2");
			expect("(print: $bar's X is (font:'Skia'))").markupToPrint("true");
			done();
		}, 20);
	});

	it("works after using (undo:)", function(done) {
		runPassage("uno", "uno");
		runPassage("dos(set:$foo to 1)", "dos");
		runPassage("tres(set:$bar to (dm:'X',(font:'Skia')))", "tres");
		runPassage("cuatro(set:$foo to it + 1)(undo:)","cuatro");

		setTimeout(function() {
			deserialiseState(retrieveStoredStateString());
			setTimeout(function() {
				expect("(history:)").markupToPrint("uno,dos,tres");
				expect("$foo").markupToPrint("1");
				expect("(print: $bar's X is (font:'Skia'))").markupToPrint("true");
				done();
			}, 20);
		}, 100);
	});

	// Currently I can't test whether invalid sessionStorage data results in being silently ignored in harlowe.js.

	afterAll(function() {
		sessionStorage.clear();
	});
});
