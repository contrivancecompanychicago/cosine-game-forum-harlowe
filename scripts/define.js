/*jshint strict:false*/
var require, define;
(function () {
	var budding = {}, ripe = {};
	require = function(name) {
		var bud = budding[name];
		if (bud) {
			ripe[name] = bud[1].apply(undefined, bud[0].map(require));
			budding[name] = undefined;
		}
		return ripe[name];
	};
	/*
		This only accepts the signatures (string, array, fn) or (fn).
	*/
	define = function(name, deps, fn) {
		if (typeof name === 'function') {
			return name();
		}
		budding[name] = [deps, fn];
	};
	// Signal for jQuery compat.
	define.amd=true;
}());
