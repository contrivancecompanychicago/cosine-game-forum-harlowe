describe("custom macros", function() {
	'use strict';
	describe("(macro:)", function() {
		it("consist of an optional number of typed vars, followed by a code hook", function() {
			expect("(set: $e to (macro:[(output-data:2)]))").not.markupToError();
			expect("(set: $e to (macro:boolean-type _a))").markupToError();
			for(var i = 0; i <= 10; i+=1) {
				var a = Array(i+1).fill(undefined).map(function(_,i) { return "str-type _a" + i; });
				expect("(set: $e to (macro:" + a + ", [(output-data:2)]))").not.markupToError();
			}
		});
		it("typed vars can have expression datatypes", function() {
			expect("(set:$leonsKickassType to number)(set: $e to (macro:$leonsKickassType-type _a, (either:boolean,dm)-type _b, [(output-data:2)]))").not.markupToError();
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
			expect("(set: $e to (macro:str-type _a, ...str-type _b, num-type _c, [(output-data:1)]))").markupToError();
			expect("(set: $e to (macro:str-type _a, ...str-type _b, ...num-type _c, [(output-data:1)]))").markupToError();
			expect("(set: $e to (macro:...str-type _a, num-type _c, [(output-data:1)]))").markupToError();
		});
	});
	describe("calling", function() {
		beforeEach(function(){
			runPassage("(set: $m to (macro:num-type _e, [(output-data:_e+10)]))");
			runPassage("(set: $n to (macro:...num-type _e, [(output-data:_e)]))");
			runPassage("(set: $o to (macro:...array-type _e, [(output-data:_e)]))");
		});
		it("are called by writing a macro call with their variable in place of the name, and supplying arguments", function() {
			expect("($m:5)").markupToPrint("15");
			expect("(print:($m:5)+5)").markupToPrint("20");
			expect("(print:($m:10/5))").markupToPrint("12");
			expect("(set: _n to (macro:...num-type _e, [(output-data:_e)]))(print:(_n:21))").markupToPrint("21");
		});
		it("supplying the wrong number of arguments produces an error", function() {
			expect("($m:5,10)").markupToError();
			expect("($m:)").markupToError();
			expect("($m:1,2,3)").markupToError();
			expect("($n:1,2,3,4,5,6,7,8)").not.markupToError();
		});
		it("calling a non-macro produces an error", function() {
			expect("(_n:)").markupToError();
			expect("($w:)").markupToError();
		});
		it("values given to spread parameters become arrays", function() {
			expect("(print:array matches ($n:1,2,3,4,5))").markupToPrint('true');
			expect("(print:(a:(a:1,2),(a:2,3)) is ($o:(a:1,2),(a:2,3)))").markupToPrint('true');
		});
		it("giving no values to spread parameters produces an empty array", function() {
			expect("(print:array matches ($n:))").markupToPrint('true');
			expect("(print:(a:) is ($o:))").markupToPrint('true');
		});
		it("supplying the wrong type of arguments produces an error", function() {
			expect("($m:'e')").markupToError();
			expect("($m:(dm:'e',1))").markupToError();
			expect("($m:true)").markupToError();
			expect("($n:1,2,3,4,5,'e',6)").markupToError();
		});
		it("variables are type-restricted", function() {
			expect("(set: $m to (macro:num-type _e, [(set:_e to true)(output-data:_e)]))($m:2)").markupToError();
			expect("(set:$g to (a:true), $m to (macro:num-type _e, [(move:$g's 1st into _e)(output-data:_e)]))($m:2)").markupToError();
		});
		it("errors inside the custom macro are propagated outward", function() {
			runPassage("(set: $o to (macro:num-type _e, [(output-data:_e*10)]))");
			expect("(set: $m to (macro:num-type _e, [(set:_g to _e+1)(output-data:_e+'f')]))($m:2)").markupToError();
			expect("(set: $n to (macro:num-type _e, [(set:_g to _e+1)(output-data:($m:($o:_e)))]))($n:2)").markupToError();
		});
		it("global variables can be accessed inside the code hook", function() {
			expect("(set:$foo to 'bar')(set: $m to (macro:[(output-data:$foo)]))($m:)").markupToPrint('bar');
		});
		it("external temp variables can't be accessed inside the code hook", function() {
			expect("(set: _foo to 2)(set: $m to (macro:[(output-data:_foo)]))($m:)").markupToError();
		});
	});
	describe("(output-data:)", function() {
		it("takes a single value of any kind", function() {
			["'a'","2","(a:)","true","(dm:)"].forEach(function(e) {
				expect("(set: $e to (macro:[(output-data:" + e + ")]))($e:)").not.markupToError();
			});
		});
		it("ceases macro execution after being called", function() {
			expect("(set: $foo to 'bar', $e to (macro:[(output-data:'')(set:$foo to 'baz')]))($e:)$foo").markupToPrint("bar");
			expect("(set: $e to (macro:[(output-data:'bar')(output-data:'baz')]))($e:)").markupToPrint("bar");
		});
		it("is aliased as (out-data:)", function() {
			expect("(set: $e to (macro:[(out-data:'bar')]))($e:)").markupToPrint("bar");
		});
		it("works inside an (if:)", function() {
			expect("(set: $e to (macro:[(if:true)[(output-data:'bar')]]))($e:)").markupToPrint("bar");
			expect("(set: $f to (macro:[($e:)(output-data:'bar')]))($f:)").markupToPrint("bar");
		});
		it("can't be used outside of a custom macro", function() {
			expect("(output-data:'baz')").markupToError();
			expect("(set: $e to (macro:[(output-data:(output-data:'baz'))]))($e:)").markupToError();
		});
	});
	describe("(output:)", function() {
		it("takes no values, and returns a changer", function() {
			expect("(set: $e to (macro:[(output:)[baz]]))($e:)").not.markupToError();
		});
		it("ceases macro execution after being attached", function() {
			expect("(set: $foo to 'bar', $qux to (output:), $e to (macro:[$qux[](set:$foo to 'baz')]))($e:)$foo").markupToPrint("bar");
		});
		it("the containing custom macro returns a command which displays the hook", function() {
			expect("(set: $e to (macro:[(output:)[baz]]))($e:)").markupToPrint("baz");
		});
		it("is aliased as (out:)", function() {
			expect("(set: $e to (macro:[(out:)[bar]]))($e:)").markupToPrint("bar");
		});
		it("can be combined with other changers", function() {
			expect("(set: $e to (macro:[(append-with:'foo')+(output:)[baz]]))($e:)").markupToPrint("bazfoo");
		});
		it("temp variables in the hook retain their values", function() {
			expect("(set: $e to (macro:str-type _a,[(output:)[(print:_a+'qux')]]))($e:'baz')").markupToPrint("bazqux");
			expect("(set: $e to (macro:str-type _a,[ [(output:)[(print:_a+'qux')]]]))($e:'baz')").markupToPrint("bazqux");
			expect("($e:'baz')").markupToPrint("bazqux");
		});
		it("output hooks run the intended number of times", function() {
			expect("(set: $foo to 0)(set:$myMacro to (macro:[(set:$foo to it + 1)(out:)[$foo]]))($myMacro:)").markupToPrint('1');
			expect("(set: $foo to 0)(set:$myMacro to (macro:[(out:)[(set:$foo to it + 1)$foo]]))($myMacro:)").markupToPrint('1');
		});
		it("custom commands aren't mutated by attached style changers", function(done) {
			var p = runPassage("(set:$a to (macro:[(out:)[Z]]))(set:$b to ($a:)) (text-rotate: 20)$b $b");
			var expr = p.find('tw-expression:nth-of-type(4)');
			setTimeout(function() {
				expect(expr.attr('style')).toMatch(/rotate\(20deg\)/);
				expr = p.find('tw-expression:nth-of-type(5)');
				expect(expr.attr('style')).not.toMatch(/rotate\(20deg\)/);
				done();
			});
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
	describe("(partial:)", function() {
		it("consist of a string or custom macro, followed by anything", function() {
			expect("(set: $e to (partial:))").markupToError();
			expect("(set: $e to (partial:2))").markupToError();
			expect("(set: $e to (partial:'a',1))").not.markupToError();
			expect("(set: $e to (partial:'dm'))").not.markupToError();
			expect("(set: $e to (partial:'dm',1,int,where it is 2))").not.markupToError();
			expect("(set: $e to (partial:(macro:str-type _a, [(out:)[_a]]),1,int,where it is 2))").not.markupToError();
			expect('(set: $e to (partial:"enchant",?hook,(text-colour:black)))').not.markupToError();
		});
		it("errors if the string isn't a valid built-in macro's insensitive name", function() {
			expect("(set: $e to (partial:'foobar'))").markupToError();
			expect("(set: $e to (partial:''))").markupToError();
			expect("(set: $e to (partial:'da-ta-map'))").not.markupToError();
			expect("(set: $e to (partial:'MOCKVISITS'))").not.markupToError();
		});
		it("errors if the string is a metadata macro name", function() {
			['metadata','storylet','urgency','exclusivity'].forEach(function(e) {
				expect("(set: $e to (partial:'" + e + "'))").markupToError();
				expect("(set: $e to (partial:'" + e + "'))").markupToError();
			});
		});
		it("produces a custom macro", function() {
			expect("(print:(partial:'display','Red') is a macro)").markupToPrint('true');
		});
		it("the custom macro, when called, calls the referred macro with the given arguments, plus additional free arguments", function() {
			expect("(set:_a to (partial:'a','foo'))(joined:'',...(_a:'bar'))").markupToPrint('foobar');
			expect("(set:_a to (partial:'str-nth'))(_a:3)").markupToPrint('3rd');
			expect("(set:_a to (partial:'a','foo','bar','baz','qux'))(joined:'',...(_a:'garply','grault'))").markupToPrint('foobarbazquxgarplygrault');
			expect("(set:_a to (partial:'max',2,5,7))(_a:3)(_a:9)(_a:6)(_a:8)").markupToPrint('7978');
			expect("(set: $zeroTo to (partial:'range', 3))(v6m-source:($zeroTo:10))").markupToPrint('(a:3,4,5,6,7,8,9,10)');
			expect(runPassage("(set:_a to (partial:'link','foo'))(_a:)[bar]").find('tw-link').text()).toBe('foo');

			runPassage("(set: $m to (macro:num-type _e, num-type _f, [(output-data:_e*_f)]))");
			expect("(set:_a to (partial:$m,5))(set:_b to (partial:_a,6))(_a:8) (_a:1) (_b:)").markupToPrint('40 5 30');
		});
		it("type signature errors are checked", function() {
			expect("(set:_a to (partial:'max','Red'))(_a:)").markupToError();
			expect("(set:_a to (partial:'max'))(_a:'Red')").markupToError();
			expect("(set:_a to (partial:'link','A')))(_a:'B')").markupToError();
			expect("(set:_a to (partial:'link','A',(font:'Roboto'))))(_a:'B')").markupToError();

			runPassage("(set: $m to (macro:num-type _e, num-type _f, [(output-data:_e*_f)]))");
			expect("($m: 'w')").markupToError();
			expect("(set:_a to (partial:$m,5))(_a:'foo')").markupToError();
			expect("(set:_a to (partial:$m,5))(set:_b to (partial:_a,6))(_b:7)").markupToError();
		});
		it("errors are propagated outward", function() {
			expect("(set:_a to (partial:'dialog','foo'))(_a:'','')").markupToError();
			expect("(set: $m to (macro:num-type _e, [(output-data: < 4)]))(set:_a to (partial:$m,5))(_a:)($m:5)").markupToError();
		});
	});
});