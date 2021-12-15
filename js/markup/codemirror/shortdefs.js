/*jshint strict:true*/
(function() {
	'use strict';
	/*
		This SHORTDEFS token is actually replaced with an object literal listing
		of the currently defined Harlowe macros at compile-time, from the metadata script.

		This is presented in a separate module so that the toolbar and tooltips can access it in addition
		to the syntax highlighter.
	*/
	const ShortDefs = "SHORTDEFS";
	// Loaded in TwineJS 2.3.
	if (this && this.loaded) {
		this.modules || (this.modules = {});
		this.modules.ShortDefs = ShortDefs;
	}
	// Loaded in HarloweDocs's preview pane or TwineJS 2.4.
	else {
		this.ShortDefs = ShortDefs;
	}
}.call(eval('this')));
