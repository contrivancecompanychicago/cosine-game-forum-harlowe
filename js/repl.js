"use strict";
define(['utils', 'engine', 'markup', 'twinescript/compiler', 'twinescript/environ'], function(Utils, Engine, TwineMarkup, Compiler, Environ) {
	Utils.onStartup(() => setTimeout(() => {
		if (Engine.options.debug) {
			/*
				REPL
				These are debugging functions, used in the browser console to inspect the output of
				TwineMarkup and the Harlowe compiler.
			*/
			window.REPL = function(a) {
			  var r = Compiler(TwineMarkup.lex("(print:" + a + ")"));
			  console.log(r);
			  var result = Environ({}).eval(r);
			  return result.TwineScript_Run ? result.TwineScript_Run().source : result;
			};
			window.LEX = function(a) {
			  var r = TwineMarkup.lex(a);
			  return (r.length === 1 ? r[0] : r);
			};
		}
	}));
});
