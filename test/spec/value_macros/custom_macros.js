describe("custom macros", function() {
	'use strict';
	describe("(macro:)", function() {
		it("consist of an optional number of typed vars, followed by a code hook", function() {
			expect("(set: $e to (macro:[(output:2)]))").not.markupToError();
			expect("(set: $e to (macro:boolean-type _a))").markupToError();
			for(var i = 0; i <= 10; i+=1) {
				var a = Array(i+1).fill(undefined).map(function(_,i) { return "str-type _a" + i; });
				expect("(set: $e to (macro:" + a + ", [(output:2)]))").not.markupToError();
			}
		});
		it("typed vars can have expression datatypes", function() {
			expect("(set:$leonsKickassType to number)(set: $e to (macro:$leonsKickassType-type _a, (either:boolean,dm)-type _b, [(output:2)]))").not.markupToError();
		});
		it("typed vars must be temp variables", function() {
			expect("(set: $e to (macro:boolean-type $a))").markupToError();
		});
		it("typed vars can't be property accesses", function() {
			expect("(set: $e to (macro:boolean-type _a's 1st))").markupToError();
		});
		it("duplicate var names produces an error", function() {
			expect("(set: $e to (macro:boolean-type _a, boolean-type _a))").markupToError();
		});
		it("typed vars can only be spread as the last variable", function() {
			expect("(set: $e to (macro:str-type _a, ...str-type _b, num-type _c, [(output:1)]))").markupToError();
			expect("(set: $e to (macro:str-type _a, ...str-type _b, ...num-type _c, [(output:1)]))").markupToError();
			expect("(set: $e to (macro:...str-type _a, num-type _c, [(output:1)]))").markupToError();
		});
	});
	describe("calling", function() {
		beforeEach(function(){
			runPassage("(set: $m to (macro:num-type _e, [(output:_e+10)]))");
			runPassage("(set: $n to (macro:...num-type _e, [(output:_e)]))");
		});
		it("are called by writing a macro call with their variable in place of the name, and supplying arguments", function() {
			expect("($m:5)").markupToPrint("15");
			expect("(print:($m:5)+5)").markupToPrint("20");
			expect("(print:($m:10/5))").markupToPrint("12");
		});
		it("supplying the wrong number of arguments produces an error", function() {
			expect("($m:5,10)").markupToError();
			expect("($m:)").markupToError();
			expect("($m:1,2,3)").markupToError();
			expect("($n:1,2,3,4,5,6,7,8)").not.markupToError();
		});
		it("values given to spread parameters become arrays", function() {
			expect("(print:array matches ($n:1,2,3,4,5))").markupToPrint('true');
		});
		it("giving no values to spread parameters produces an empty array", function() {
			expect("(print:array matches ($n:))").markupToPrint('true');
		});
		it("supplying the wrong type of arguments produces an error", function() {
			expect("($m:'e')").markupToError();
			expect("($m:(dm:'e',1))").markupToError();
			expect("($m:true)").markupToError();
			expect("($n:1,2,3,4,5,'e',6)").markupToError();
		});
		it("variables are type-restricted", function() {
			expect("(set: $m to (macro:num-type _e, [(set:_e to true)(output:_e)]))($m:2)").markupToError();
			expect("(set:$g to (a:true), $m to (macro:num-type _e, [(move:$g's 1st into _e)(output:_e)]))($m:2)").markupToError();
		});
		it("errors inside the custom macro are propagated outward", function() {
			runPassage("(set: $o to (macro:num-type _e, [(output:_e*10)]))");
			expect("(set: $m to (macro:num-type _e, [(set:_g to _e+1)(output:_e+'f')]))($m:2)").markupToError();
			expect("(set: $n to (macro:num-type _e, [(set:_g to _e+1)(output:($m:($o:_e)))]))($n:2)").markupToError();
		});
		it("global variables can be accessed inside the code hook", function() {
			expect("(set:$foo to 'bar')(set: $m to (macro:[(output:$foo)]))($m:)").markupToPrint('bar');
		});
		it("external temp variables can't be accessed inside the code hook", function() {
			expect("(set: _foo to 2)(set: $m to (macro:[(output:_foo)]))($m:)").markupToError();
		});
	});
	describe("(output:)", function() {
		it("takes a single value of any kind", function() {
			["'a'","2","(a:)","true","(dm:)"].forEach(function(e) {
				expect("(set: $e to (macro:[(output:" + e + ")]))($e:)").not.markupToError();
			});
		});
		it("ceases macro execution after being called", function() {
			expect("(set: $foo to 'bar', $e to (macro:[(output:'')(set:$foo to 'baz')]))($e:)$foo").markupToPrint("bar");
			expect("(set: $e to (macro:[(output:'bar')(output:'baz')]))($e:)").markupToPrint("bar");
		});
		it("can't be used outside of a custom macro", function() {
			expect("(output:'baz')").markupToError();
			expect("(set: $e to (macro:[(output:(output:'baz'))]))($e:)").markupToError();
		});
	});
	describe("(output-hook:)", function() {
		it("takes no values, and returns a changer", function() {
			expect("(set: $e to (macro:[(output-hook:)[baz]]))($e:)").not.markupToError();
		});
		it("ceases macro execution after being attached", function() {
			expect("(set: $foo to 'bar', $qux to (output-hook:), $e to (macro:[$qux[](set:$foo to 'baz')]))($e:)$foo").markupToPrint("bar");
		});
		it("the containing custom macro returns a command which displays the hook", function() {
			expect("(set: $e to (macro:[(output-hook:)[baz]]))($e:)").markupToPrint("baz");
		});
		it("can be combined with other changers", function() {
			expect("(set: $e to (macro:[(link:'foo')+(output-hook:)[baz]]))($e:)").markupToPrint("foo");
		});
		it("temp variables in the hook retain their values", function() {
			expect("(set: $e to (macro:str-type _a,[(output-hook:)[(print:_a+'qux')]]))($e:'baz')").markupToPrint("bazqux");
			expect("($e:'baz')").markupToPrint("bazqux");
		});
	});
	describe("(error:)", function() {
		it("takes a string, and produces an error with the given message", function() {
			var s = "(set: $e to (macro:[(error:'foobarbazqux')]))($e:)";
			expect(s).markupToError();
			expect(runPassage(s).text()).toMatch(/foobarbazqux/);
		});
		it("ceases macro execution after being called", function() {
			runPassage("(set: $foo to 'bar', $e to (macro:[(error:'qux')(set:$foo to 'baz')]))($e:)");
			expect("$foo").markupToPrint("bar");
		});
		it("can't be used outside of a custom macro", function() {
			expect("(error:'foobarbazqux')").markupToError();
			expect(runPassage("(error:'foobarbazqux')").text()).not.toMatch(/foobarbazqux/);
		});
	});
});