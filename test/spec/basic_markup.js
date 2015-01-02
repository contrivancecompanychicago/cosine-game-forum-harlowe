describe("basic twinemarkup syntax", function() {
	'use strict';

	describe("line breaks", function() {
		it("turn into <br> elements", function() {
			expectMarkupToBecome(
				"Hey\nhi\nhello",
				"Hey<br>hi<br>hello"
			);
		});
		it("become <br> elements even in the absence of other text", function() {
			expectMarkupToBecome(
				"\n".repeat(4),
				"<br>".repeat(4)
			);
		});
	});

	[
		{
			name:   "bold markup",
			markup: ["''","''"],
			html:   ["<b>","</b>"],
		},
		{
			name:   "italic markup",
			markup: ["//","//"],
			html:   ["<i>","</i>"],
		},
		{
			name:   "superscript markup",
			markup: ["^^","^^"],
			html:   ["<sup>","</sup>"],
		},
		{
			name:   "deletion markup",
			markup: ["~~","~~"],
			html:   ["<del>","</del>"],
		},
	]
	.forEach(function(e) {
		describe(e.name, function() {
			it("wraps text enclosed in " + e.markup.join(" and ") +
				" with " + e.html.join(" and ") + " elements.", function() {
			
				expectMarkupToBecome(
					"A " + e.markup.join(" B ") + " C",
					"A " + e.html  .join(" B ") + " C"
				);
			});
			it("spans multiple lines", function() {
		
				expectMarkupToBecome(
					"A " + e.markup.join(" B\n ")   + " C",
					"A " + e.html  .join(" B<br> ") + " C"
				);
			});
			/*
				I'll admit it: this test is a little silly.
			*/
			it("can be used to enclose one " + e.markup[0][0], function() {
				expectMarkupToBecome(
					"A " + e.markup.join(e.markup[0][0])   + " C",
					"A " + e.html  .join(e.markup[0][0])   + " C"
				);
			});
			it("can't be nested", function() {
				expectMarkupToBecome(
					"A " + e.markup.join(e.markup.join(" B "))   + " C",
					"A  B  C"
				);
			});
			it("is ignored if there's no closing pair", function() {
				expectMarkupToBecome(
					"A " + e.markup[0]   + " B",
					"A " + e.markup[0]   + " B"
				);
			});
		});
	});

	describe("nested markup", function() {
		it("exists", function() {
			expectMarkupToBecome(
				"''//bold italic//''.",
				"<b><i>bold italic</i></b>."
			);
		});
		it("won't work unless it's correctly nested", function() {
			expectMarkupToBecome(
				"//''error//''",
				"<i>''error</i>''"
			);
		});
	});

	describe("header markup", function() {
		[1,2,3,4,5,6].forEach(function(i) {
			it("wraps a line starting with " + "#".repeat(i) + " with a <h" + i + "> element", function() {
				expectMarkupToBecome(
					"#".repeat(i) + "A",
					"<h" + i + ">A</h" + i + ">"
				);
			});
		});
		it("won't work unless it's at the start of a line", function() {
			expectMarkupToBecome(
				"A B #C",
				"A B #C"
			);
		});
		it("consumes one (1) preceding line break ", function() {
			[1,2,3,4].forEach(function(i) {
				expectMarkupToBecome(
					"\n".repeat(i) + "#A",
					"<br>".repeat(i-1) + "<h1>A</h1>"
				);
			});
		});
		it("(unlike Markdown) permits whitespace between the start of the line and #", function() {
			expectMarkupToBecome(
				" \t#A",
				"<h1>A</h1>"
			);
		});
	});

	describe("bulleted lists", function() {
		it("wraps 1 or more adjacent lines starting with * (plus optional whitespace) in <ul><li>", function() {
			expectMarkupToBecome(
				"* A",
				"<ul><li>A</li></ul>"
			);
			expectMarkupToBecome(
				"* A\n* B",
				"<ul><li>A</li><li>B</li></ul>"
			);
		});
		it("won't work unless it's at the start of a line", function() {
			expectMarkupToBecome(
				"A B *C",
				"A B *C"
			);
		});
		it("(unlike Markdown) allows nested lists by the addition of more consecutive *'s", function() {
			expectMarkupToBecome(
				"* A\n** B\n** C\n* D",
				"<ul><li>A</li><ul><li>B</li><li>C</li></ul><li>D</li></ul>"
			);
			expectMarkupToBecome(
				"* A\n*** B\n*** C\n* D",
				"<ul><li>A</li><ul><ul><li>B</li><li>C</li></ul></ul><li>D</li></ul>"
			);
			expectMarkupToBecome(
				"*** A\n*** B",
				"<ul><ul><ul><li>A</li><li>B</li></ul></ul></ul>"
			);
			expectMarkupToBecome(
				"*** A\n* B\n*** C",
				"<ul><ul><ul><li>A</li></ul></ul><li>B</li><ul><ul><li>C</li></ul></ul></ul>"
			);
		});
		it("(unlike Markdown) permits whitespace between the start of the line and *", function() {
			expectMarkupToBecome(
				" \t* A",
				"<ul><li>A</li></ul>"
			);
		});
	});

	describe("numbered lists", function() {
		it("wraps 1 or more adjacent lines starting with 0. (plus optional whitespace) in <ul><li>", function() {
			expectMarkupToBecome(
				"0. A",
				"<ol><li>A</li></ol>"
			);
			expectMarkupToBecome(
				"0. A\n0. B",
				"<ol><li>A</li><li>B</li></ol>"
			);
		});
		it("won't work unless it's at the start of a line", function() {
			expectMarkupToBecome(
				"A B 0.C",
				"A B 0.C"
			);
		});
		it("(unlike Markdown) allows nested lists by the addition of more consecutive *'s", function() {
			expectMarkupToBecome(
				"0. A\n0.0. B\n0.0. C\n0. D",
				"<ol><li>A</li><ol><li>B</li><li>C</li></ol><li>D</li></ol>"
			);
			expectMarkupToBecome(
				"0. A\n0.0.0. B\n0.0.0. C\n0. D",
				"<ol><li>A</li><ol><ol><li>B</li><li>C</li></ol></ol><li>D</li></ol>"
			);
			expectMarkupToBecome(
				"0.0.0. A\n0.0.0. B",
				"<ol><ol><ol><li>A</li><li>B</li></ol></ol></ol>"
			);
			expectMarkupToBecome(
				"0.0.0. A\n0. B\n0.0.0. C",
				"<ol><ol><ol><li>A</li></ol></ol><li>B</li><ol><ol><li>C</li></ol></ol></ol>"
			);
		});
		it("(unlike Markdown) permits whitespace between the start of the line and 0.", function() {
			expectMarkupToBecome(
				" \t0. A",
				"<ol><li>A</li></ol>"
			);
		});
	});

	describe("horizontal rules", function() {
		it("turns 3 or more hyphens solely occupying a single line into a <hr>", function() {
			[3,4,5,8,16].forEach(function(i) {
				expectMarkupToBecome(
					"---".repeat(i),
					"<hr>"
				);
			});
		});
		it("won't work unless it's at the start of a line", function() {
			expectMarkupToBecome(
				"A ---",
				"A ---"
			);
		});
		it("consumes one (1) preceding line break ", function() {
			[1,2,3,4].forEach(function(i) {
				expectMarkupToBecome(
					"\n".repeat(i) + "---",
					"<br>".repeat(i-1) + "<hr>"
				);
			});
		});
		it("(unlike Markdown) permits whitespace between the start of the line and #", function() {
			expectMarkupToBecome(
				" \t---",
				"<hr>"
			);
		});
	});

	describe("HTML comments", function() {
		it("are removed from the rendered HTML", function() {
			[0,1,2].forEach(function(i) {
				expectMarkupToBecome(
					"A<!--" + "\n".repeat(i) + "-->B",
					"AB"
				);
			});
		});
		it("cannot be nested", function() {
			expectMarkupToBecome(
				"A<!--<!-- -->-->B",
				"A--&gt;B"
			);
		});
	});

	describe("verbatim syntax", function() {
		it("suppresses all other syntax between ` and `", function() {
			expectMarkupToBecome(
				"`A''B''//C//`",
				"A''B''//C//"
			);
		});
		it("spans multiple lines", function() {
			expectMarkupToBecome(
				"`A\n\n''B''`",
				"A<br><br>''B''"
			);
		});
		it("cannot be nested with just single `s", function() {
			expectMarkupToBecome(
				"`''A''`''B''`C",
				"''A''<b>B</b>`C"
			);
		});
		it("can enclose a single ` with additional ``s", function() {
			expectMarkupToBecome(
				"``''A''`''B''``C",
				"''A''`''B''C"
			);
		});
	});

	describe("collapsing whitespace syntax", function() {
		it("eliminates runs of whitespace between { and }", function() {
			expectMarkupToBecome(
				"{   \n   }",
				""
			);
		});
		it("leaves other syntax as is", function() {
			expectMarkupToBecome(
				"{   ''A''   }",
				"<b>A</b>"
			);
		});
		it("collapses runs of whitespace between non-whitespace down to a single space", function() {
			expectMarkupToBecome(
				"{   A   B   }",
				"A B"
			);
		});
	});
});