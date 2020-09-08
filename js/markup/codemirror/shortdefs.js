/*jshint strict:true*/
(function() {
	'use strict';
	/*
		This SHORTDEFS token is actually replaced with an object literal listing
		of the currently defined Harlowe macros at compile-time, from the metadata script.
	*/
	const ShortDefs = "SHORTDEFS";
	// Loaded in Twine.
	if (this && this.loaded) {
		this.modules || (this.modules = {});
		this.modules.ShortDefs = ShortDefs;
	}
	// Loaded in HarloweDocs's preview pane.
	else {
		this.ShortDefs = ShortDefs;
	}
}.call(eval('this')));
