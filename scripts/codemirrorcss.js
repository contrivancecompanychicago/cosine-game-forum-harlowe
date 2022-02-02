/*
	This is used by  any Harlowe build product that has a CodeMirror syntax highlighter in it.
*/
const versionClass = 'cm-harlowe-3-';
const {execSync} = require('child_process'),
	{CSS} = require('../js/utils/typecolours'),
	toolbarStyles = (execSync('sass ./scripts/toolbar.css --style compressed') + '').replace(/\ufeff/,''),
	animations = (execSync('sass ./scss/animations.scss --style compressed') + '').replace(/\ufeff/,'').replace(/@keyframes /g, "@keyframes harlowe-3-");

	module.exports =
		/*
			In Twine 2.4+, always put "non-prose" code in monospace.
		*/
		`.${versionClass}root:not([class^='${versionClass}text']):not([class^='${versionClass}verbatim']) { font-family:var(--font-monospaced); }` +
		// The cursor token highlight should ignore the most common tokens, unwrapped text tokens.
		`.${versionClass}cursor:not([class^='${versionClass}text ${versionClass}root']) { border-bottom: 2px solid darkgray; }` +

		".CodeMirror {padding: 0 !important}" +
		// The line number bullets (see the lineNumbers option, above), are a bit too dark by default.
		".CodeMirror-linenumber {color: hsla(0,0%,80%,1.0);}" +
		// Also, the gutters sometimes encroach on the text area for some reason.
		".CodeMirror-gutters {left: 0px !important;}" + CSS + animations + toolbarStyles;
