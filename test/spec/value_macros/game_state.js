describe("game state macros", function() {
	'use strict';
	describe("the (passage:) macro", function() {
		it("accepts 0 or 1 string arguments", function() {
			createPassage("Red","The Kitchen");
			expect("(passage:)").not.markupToError();
			expect("(passage:'The Kitchen')").not.markupToError();
			expect("(passage:'The Kitchen','The Kitchen')").markupToError();
		});
		it("when given nothing, returns the current passage as a datamap", function (){
			expect(runPassage("(print: (passage:)'s name)",'Gold').text() || '').toBe('Gold');
		});
		it("when given a string, returns the given story passage as a datamap", function (){
			createPassage("Red","The Kitchen");
			expect("(print: (passage: 'The Kitchen')'s source)").markupToPrint("Red");
		});
		it("errors if the passage is not present in the story", function (){
			expect("(print: (passage: 'The Kitchen'))").markupToError();
		});
		it("passage datamaps have tags", function (){
			createPassage("","The Kitchen", ["area"]);
			expect("(print: (passage: 'The Kitchen')'s tags contains 'area')").markupToPrint("true");
			expect("(set: $x to (passage: 'The Kitchen')'s tags contains 'area')(print:$x)").markupToPrint("true");
		});
		it("doesn't pass data by reference", function (){
			createPassage("","The Kitchen");
			expect("(set: $a to (passage:'The Kitchen'))"
				+ "(set: $b to (passage:'The Kitchen'))"
				+ "(set: $a's foobaz to 1)"
				+ "(print: $b contains 'foobaz')").markupToPrint("false");
		});
		it("proliferates errors", function (){
			expect("(passage: (str:2/0))").markupToError();
		});
	});
	describe("the (history:) macro", function() {
		it("accepts 0 or 1 'where' lambdas", function() {
			expect("(history:)").not.markupToError();
			expect("(history:'foo')").markupToError();
			expect("(history:where its tags is (A:))").not.markupToError();
			expect("(history:_p via _p + 1)").markupToError();
			expect("(history:when its tags is (A:))").markupToError();
		});
		it("returns an array of names of previously visited passages, excluding the current passage", function() {
			expect(runPassage("(history:)","foo").text()).toBe("");
			expect(runPassage("(history:)","bar").text()).toBe("foo");
			expect(runPassage("(history:)","baz").text()).toBe("foo,bar");
			expect(runPassage("(history:)","foo").text()).toBe("foo,bar,baz");
			expect(runPassage("(history:)","qux").text()).toBe("foo,bar,baz,foo");
			expect("(print:(history:) is an array)").markupToPrint("true");
		});
		it("when given a lambda, filters the array using the lambda", function() {
			expect(runPassage("(history:where its name is not 'bar')","foo").text()).toBe("");
			expect(runPassage("(history:where its name is not 'bar')","bar").text()).toBe("foo");
			expect(runPassage("(history:where its name is not 'bar')","baz").text()).toBe("foo");
			expect(runPassage("(history:where its name is not 'foo')","qux").text()).toBe("bar,baz");
		});
	});
	describe("the (passages:) macro", function() {
		it("accepts 0 or 1 'where' lambdas", function() {
			expect("(passages:)").not.markupToError();
			expect("(passages:'foo')").markupToError();
			expect("(passages:where its tags is (A:))").not.markupToError();
			expect("(passages:_p via _p + 1)").markupToError();
			expect("(passages:when its tags is (A:))").markupToError();
		});
		it("returns an array containing datamaps for each passage in the story, sorted by name", function() {
			createPassage("garply","foo");
			createPassage("grault","bar");
			createPassage("corge","baz");
			createPassage("quux","qux");
			// Each of these expect()s creates a "test" passage to run the code in.
			expect("(print: (altered: _p via _p's name, ...(passages:)))").markupToPrint("bar,baz,foo,qux,test");
			expect("(print: (altered: _p via _p's name, ...(passages: each _p where _p's name is not 'test')))").markupToPrint("bar,baz,foo,qux");
			expect("(print: (altered: _p via _p's source, ...(passages: each _p where _p's name is not 'test')))").markupToPrint("grault,corge,garply,quux");
		});
		it("when given a lambda, filters the array using the lambda", function() {
			createPassage("Fern","The Kitchen");
			createPassage("Ferns","The Garden");
			createPassage("","The Hall");
			expect("(print: (altered: _p via _p's name, ...(passages: _p where _p's source contains 'Fern' and _p's name is not 'test')))")
				.markupToPrint("The Garden,The Kitchen");
		});
		it("passage datamaps have tags", function (){
			createPassage("","The Kitchen", ["area"]);
			createPassage("","The Aviary", ["place"]);
			expect("(print: (passages: where its name is 'The Kitchen')'s 1st's tags contains 'area')").markupToPrint("true");
			expect("(print: (passages: where its name is 'The Kitchen')'s 1st's tags contains 'place')").markupToPrint("false");
			expect("(print: (passages: where its name is 'The Aviary')'s 1st's tags contains 'place')").markupToPrint("true");
		});
		it("returns an empty array if no passage matched the lambda", function() {
			expect("(print: (altered: _p via _p's name, ...(passages: each _p where _p's name is 'foo')))").markupToPrint("");
			expect("(print: (passages: where its name is 'foo')'s length)").markupToPrint("0");
		});
		it("proliferates errors", function (){
			expect("(passages: where its name is (str:2/0))").markupToError();
		});
		//TODO: More tests
	});
	describe("the (hooks-named:) macro", function() {
		it("takes a non-empty string", function() {
			expect("(show:(hooks-named:'2'))").not.markupToError();
			expect("(show:(hooks-named:))").markupToError();
			expect("(show:(hooks-named:''))").markupToError();
		});
		it("produces a usable hookname", function() {
			expect("|a>[bar](replace:(hooks-named:'a'))[foo]").markupToPrint('foo');
		});
	});
});
