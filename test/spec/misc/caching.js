describe("passage caching", function() {
	'use strict';
	
	it("stores passage trees that have recently been visited", function() {
		createPassage("**foo1**","foo1",[],true);
		goToPassage("foo1");
		Passages.get('foo1').set('source', "**bar**");
		goToPassage("foo1");
		expect($('tw-passage strong').text()).toBe("foo1");
	});
	it("empties them from the cache if they haven't been visited in 16 turns", function() {
		createPassage("**foo1**","foo1",[],true);
		goToPassage("foo1");
		Passages.get('foo1').set('source', "**bar**");
		for(var i = 2; i < 18; i+=1) {
			runPassage("**foo"+i+"**","foo"+i,[],true);
		}
		goToPassage("foo1");
		expect($('tw-passage strong').text()).toBe("bar");
	});
	it("never empties header or footer passages", function() {
		createPassage("**foo**","foo",['header'],true);
		runPassage('',"bar",[],true);
		Passages.get('foo').set('source',"**bar**");
		expect($('tw-passage strong').text()).toBe("foo");
		for(var i = 2; i < 35; i+=1) {
			runPassage("","foo"+i,[],true);
		}
		goToPassage("bar");
		expect($('tw-passage strong').text()).toBe("foo");
	});
	it("doesn't interfere with passage display", function() {
		for(var i = 0; i < 20; i+=1) {
			createPassage("**foo"+i+"**","foo"+i,[],true);
		}
		goToPassage("foo1");
		expect($('tw-passage strong').text()).toBe("foo1");
		goToPassage("foo2");
		expect($('tw-passage strong').text()).toBe("foo2");
		goToPassage("foo3");
		expect($('tw-passage strong').text()).toBe("foo3");
		goToPassage("foo1");
		expect($('tw-passage strong').text()).toBe("foo1");
		goToPassage("foo3");
		expect($('tw-passage strong').text()).toBe("foo3");
	});
	it("doesn't interfere with the (display:) macro", function() {
		for(var i = 0; i < 20; i+=1) {
			createPassage("**foo"+i+"**","foo"+i,[],true);
		}
		expect(runPassage('(display:"foo1")').text()).toBe("foo1");
		expect(runPassage('(display:"foo2")').text()).toBe("foo2");
		expect(runPassage('(display:"foo3")').text()).toBe("foo3");
		expect(runPassage('(display:"foo1")').text()).toBe("foo1");
	});
});
