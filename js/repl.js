"use strict";
define(['utils', 'engine', 'markup', 'section'], function(Utils, Engine, Markup, Section) {
	Utils.onStartup(() => setTimeout(() => {
		if (Engine.options.debug) {
			/*
				REPL
				These are debugging functions, used in the browser console to inspect the output of
				TwineMarkup and the Harlowe compiler.
			*/
			window.REPL = function(a) {
				let r = Section.create().eval(Markup.lex("(print:" + a + ")"));
				return r.TwineScript_Run ? r.TwineScript_Run().source : r;
			};
			window.LEX = function(a) {
				let r = Markup.lex(a);
				return (r.length === 1 ? r[0] : r);
			};
		}
	}));
});
