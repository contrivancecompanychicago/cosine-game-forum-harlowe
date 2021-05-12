"use strict";
(function(){
	/*
		These CSS colours are used both by Debug Mode, the CodeMirror syntax highlighter, and the documentation
		compiler.
	*/
	const Colours = {
		boolean:     "color:hsla(0,0%,30%,1.0)",
		array:       "color:hsla(0,100%,30%,1.0)",
		dataset:     "color:hsla(30,100%,40%,1.0)",
		number:      "color:hsla(30,100%,30%,1.0)",
		datamap:     "color:hsla(60,100%,30%,1.0)",
		changer:     "color:hsla(90,100%,30%,1.0)",
		lambda:      "color:hsla(120,100%,40%,1.0)",
		hookName:    "color:hsla(160,100%,30%,1.0)",
		string:      "color:hsla(180,100%,30%,1.0)",
		identifier:  "color:hsla(200,80%,40%,1.0)",
		variable:    "color:hsla(200,100%,30%,1.0)",
		tempVariable:"color:hsla(200,70%,20%,1.0)",
		datatype:    "color:hsla(220,100%,30%,1.0)",
		colour:      "color:hsla(280,100%,30%,1.0)",
		macro:       "color:hsla(320,80%,30%,1.0)",
		twineLink:   "color:hsla(240,100%,20%,1.0)"
	};
	Colours.gradient = Colours.colour;
	Colours.command = Colours.twineLink;
	Colours.instant = Colours.metadata = Colours.any = Colours.customMacro = Colours.macro;

	if(typeof module === 'object') {
		module.exports = Colours;
	}
	else if(typeof define === 'function' && define.amd) {
		define([], () => Colours);
	}
}.call(this));
