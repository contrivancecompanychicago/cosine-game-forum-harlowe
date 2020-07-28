'use strict';

const fs = require('fs');
const unescape = require('lodash.unescape');
const escape = require('lodash.escape');
function insensitiveName(e) {
	return e.toLowerCase().replace(/-|_/g, "");
}

/*
	This generates end-user Harlowe macro and syntax documentation (in Markup).
*/
const metadata = require('./metadata');
const macros = metadata.Macro.shortDefs();
const validMacros = Object.keys(macros).reduce((a,e)=>{
	const macro = macros[e];
	[macro.name, ...macro.aka].forEach(name => a[insensitiveName(name)] = macro);
	return a;
}, {});

let outputFile = "";
let navElement = "<nav><img src='icon.svg' width=96 height=96></img>";
/*
	Obtain the version
*/
const {version} = JSON.parse(fs.readFileSync('package.json'));
navElement += `<div class=nav_version><p>Harlowe ${version} manual</p>
<p><a href="/1.html">1.2.4</a> | <a href="/2.html">2.1.0</a> | <b>${version}</b></p>
</div>`;

let currentCategory;

Object.keys(metadata).map(e => metadata[e]).forEach(e=>{
	outputFile += `\n<h1 id=section_${e.defCode}>${e.defName}</h1>\n`;
	navElement += `<h5>${e.defName}</h5><ul class=list_${e.defCode}>`;

	const [out, nav] = e.output();
	outputFile += out;
	navElement += nav + "</ul>"
});

/*
	Output the MD docs as an intermediate product.
*/
fs.writeFileSync('dist/harloweDocs.md',outputFile);
/*
	Convert to HTML with Marked
*/
outputFile = require('marked')(outputFile);

/*
	Add animations from animations.scss.
*/
let animations = require('child_process').execSync("sass --style compressed --scss ./scss/animations.scss");
/*
	Find the <code> elements and syntax-highlight their contents.
*/
const {modes} = require('../js/markup/lexer.js');
const {lex} = require('../js/markup/markup.js');
// These are used to determine what lexing mode to use for code blocks.
const sectionMarkupStart = outputFile.search('<h1 id="section_markup">');
const sectionMarkupEnd   = outputFile.slice(sectionMarkupStart + 5).search('<h1 ') + sectionMarkupStart + 5;

outputFile = outputFile.replace(/<code>([^<]+)<\/code>(~?)/g, ({length}, code, noStyle, offset) => {
	if (noStyle) {
		return `<code>${code}</code>`;
	}
	function makeCSSClasses(pos) {
		return root.pathAt(pos + root.start).reduce((str,token) => {
			// Don't highlight tokens inside strings.
			if (token.type === "string") {
				str = '';
			}
			str += (str.length ? ' ' : '') + 'cm-harlowe-3-' + token.type;
			if (token.type === "macroName") {
				const name = insensitiveName(token.text.slice(0,-1));
				if (validMacros.hasOwnProperty(name)) {
					str += "-" + validMacros[insensitiveName(token.text.slice(0,-1))].returnType.toLowerCase();
				}
			}
			return str;
		},'');
	}
	code = unescape(code);
	let ret = '', root, lastPos = 0, modeStart;
	// If the offset is inside the "Passage markup" section, OR is followed by a </pre>, use the normal mode.
	// Otherwise, use the macro mode.
	if (offset > sectionMarkupEnd && !outputFile.slice(offset + length).startsWith("</pre>")) {
		modeStart = 'macro';
	}
	root = lex(code, 0, modeStart);
	root.everyLeaf(token => {
		while (token.start - root.start > lastPos) {
			ret += `<span class="${makeCSSClasses(lastPos)}">${escape(code[lastPos])}</span>`;
			lastPos += 1;
		}
		ret += `<span class="${makeCSSClasses(token.start)}">${escape(token.text)}</span>`;
		lastPos = token.end - root.start;
	});
	while (code.length > lastPos) {
		ret += `<span class="${makeCSSClasses(lastPos)}">${escape(code[lastPos])}</span>`;
		lastPos += 1;
	}
	return `<code>${ret}</code>`;
});
/*
	Append CSS and HTML header tags
*/
outputFile = `<!doctype html><title>Harlowe ${version} manual</title><meta charset=utf8><style>
/* Normalisation CSS */
html { font-size:110%; font-weight:lighter; background:white; font-family:Georgia, "Times New Roman", Times, serif; line-height:1.5; margin:0 30vw 4em 22vw !important; color:black; }
@media screen and (max-width: 1200px) { html { margin:0 12vw 4em 12vw  !important; } }
@media screen and (max-width: 800px) { html { margin:0 6vw 4em 6vw !important; } }
p { margin-top:1em; }
strong,b { font-weight: bold; }
a { color:HSL(202, 70%, 35%); }
a:hover, a:focus, a:active { color:#22516d; }
table:not(.datamap):not(.panel-rows) { background:#fafafa; border-bottom:1px solid #ccc; border-collapse:collapse; border-right:1px solid #ccc; border-spacing:0; font-size:1em; width:100%; }
table:not(.datamap):not(.panel-rows) tr { border-top:1px solid #ccc; }
table:not(.datamap):not(.panel-rows) tr:nth-child(2n),thead { background:#eee; }
table:not(.datamap):not(.panel-rows) th,table:not(.datamap):not(.panel-rows) td { border-left:1px solid #ccc; padding:4px; text-align:left; }
tfoot { background:#e3e3e3; }
body>:not(#preview) h1,body>:not(#preview) h2,body>:not(#preview) h3,body>:not(#preview) h4,body>:not(#preview) h5,body>:not(#preview) h6 { border-bottom:solid 1px #ddd; font-weight:400; line-height:1em; margin:0; padding-top:1rem; }
body>:not(#preview) h4,body>:not(#preview) h5,body>:not(#preview) h6 { font-weight:700; }
body>:not(#preview) h1 { font-size:2.5em; }
body>:not(#preview) h2 { font-size:2em; }
body>:not(#preview) h3 { font-size:1.5em; }
body>:not(#preview) h4 { font-size:1.2em; }
body>:not(#preview) h5 { font-size:1em; }
body>:not(#preview) h6 { font-size:.9em; }
body>:not(#preview) h1,body>:not(#preview) h2 { padding-top:2rem; padding-bottom:5px; }

/* Nav bar */
nav { position:fixed; width:15vw; max-width: 20vw; top:2.5vh;left:2.5vw; bottom:5vh; overflow-y:scroll; border:1px solid #888; padding:1rem; margin-bottom:2em; font-size:90% }
nav ul { list-style-type: none; margin: 0em; padding: 0em; }
nav img { display:block; margin: 0 auto;}
.nav_version { text-align:center }
@media screen and (max-width: 1200px) { nav { display:none; } }

/* Night mode */
#nightBar { position: fixed; top:0%;right:12vw; border:1px solid #888; border-radius:0.2rem}
#night, #day { padding: 0.5rem 1rem; display:inline-block; cursor:pointer }
html.night #night { background: #444 }
html:not(.night) #day { background: #ccc }
/* This flips the colours for most article elements, but flips them back if they have an explicit background. */
html.night main, html.night nav, html.night main [style*=background] { filter: invert() hue-rotate(180deg); }
html.night { background-color:black; }

/* Main styles */
.def_title { background:linear-gradient(180deg,white,white 70%,silver); border-bottom:1px solid silver; padding-bottom:5px; }
.macro_signature { opacity:0.75 }
.nav_macro_return_type { opacity:0.5; float:right; }
.nav_macro_sig { display: none; font-style:italic; opacity:0.5; }
a:hover > .nav_macro_sig { display: inline; }
@media screen and (max-width: 1400px) { .nav_macro_return_type { display:none; } }
@media screen and (max-width: 1600px) { .nav_macro_return_type { font-size:80% } }
.nav_macro_aka { opacity: 0.75; font-size:90%; color:#3B8BBA; margin-left: 0.5em; font-style: italic; }
.nav_macro_aka::before { content: "also known as "; opacity: 0.75; }
aside { font-style:italic; font-size:80%; }

/* Code blocks */
code { background:#FFF; border:1px solid #888; color:#000; display:block; padding:12px; overflow-x: scroll; }

/* Inline code */
pre { display:inline; }
.previewButton { background:inherit; color:inherit; cursor:pointer; position:absolute; right: 0px; bottom: 0px; padding:0.1rem 0.3rem; border-top:1px solid #888; border-left:1px solid #888; }
.previewButton::after { content:"▶"; }
.previewButton:hover { background: #ccc }
:not(pre) > code { background:hsla(0,0%,100%,0.75); border:1px dotted #888; display:inline; padding:1px; white-space:pre-wrap; font-size:1rem; }
table:not(.datamap) :not(pre) > code { white-space: pre-wrap; }
/* Heading links */
.heading_link::before { content: "§"; display:inline-block; margin-left:-25px; padding-right:10px; color:black; font-weight:100; visibility:hidden; text-decoration:none; }
:hover > .heading_link::before { visibility:visible; }

/* Preview */
#preview { display:none; z-index:21; position: fixed; width: 25vw; height:45vh; right:2vw; top: 10vh; overflow-y:scroll; border: 1px double #888; font-size:16px; transition: width 0.8s; }
@media screen and (max-width: 1200px) { #preview, .previewButton, #previewCode, #fullPreviewBar { display:none !important; } }
html:not(.night) #preview tw-story { background-color:white; color:black }
#previewCode { display:none; z-index:20; position:fixed; width:25vw; height:30vh; right: 2vw; bottom: 10vh; overflow:scroll; border: 1px double #888; transition: width 0.8s; }
.CodeMirror { height: 100% !important; width:100% !important; background-color:white; }
.previewCodeButton { font-size:200%; padding: 0.2rem 0.9rem; }
html.night .previewCodeButton { color:white; }
#preview tw-debugger { position: absolute; padding: 0; min-height: 0; box-sizing:border-box; border-top:none; min-width: 80%; }
#preview .panel-variables-empty { display:none; }
#preview .panel-variables { border-top: solid black 2px; border-bottom: none; }

/* Kludge for the (text-style:) macro */
t-s::before { content: 'Example text'; }

/* Fullscreen preview */
#fullPreviewBar { position:fixed; right: 27vw; top: 10vh; height: 80vh; width: 16px; cursor:pointer; background: hsla(0,0%,50%,0.25); border-left: solid 1px hsla(0,0%,0%,0.25); transition: right 0.8s; }
#fullPreviewBar:hover { background: hsla(0,0%,50%,0.5); border-left: solid 1px hsla(0,0%,0%,0.5); }
html.fullPreview main, html.fullPreview nav { opacity: 0.05; }
html.fullPreview #preview, html.fullPreview #previewCode { width:95vw; }
html.fullPreview #fullPreviewBar { right: 97vw; }

/* Animations */
${animations}
</style>
${navElement}</ul></nav>
<div id="nightBar"><span id="day">☀️</span><span id="night"/>🌙</span></div>
<div id="preview"><tw-story><noscript><tw-noscript>JavaScript needs to be enabled to use this code sample preview pane.</tw-noscript></noscript></tw-story>
<tw-storydata startnode=1 options="debug"><tw-passagedata pid=1 name=Test>&lt;==>\nClick on ▶ on code samples in this documentation to preview the resulting Twine passage here!
</tw-passagedata></tw-storydata>
<script role="script" type="twine/javascript">
window.previewPassage = function(text) {
	State.reset();
	Passages.clear();
	Passages.set("Test", Passages.create($('<div name="Test" tags="">').text(text)));
	Engine.goToPassage("Test");
};
/* Debug Mode variables panel transplant */
let vars = $('tw-debugger .panel-variables');
$('tw-debugger').appendTo('#preview').empty().append(vars);
</script>
</div>
<div id=previewCode><textarea>
Or, type some Harlowe code in this text area, and click ▶ to see it render.

\\(set: _style to (text-style:"buoy"), $word to "this")(enchant:$word, _style)\\

This panel ↓ will show any variables that are set by the code.
</textarea><div class="previewButton previewCodeButton" title="Run this Harlowe code."></div></div>
<div id=fullPreviewBar></div>
<main>${outputFile}
<p><small>This manual was generated at: ${new Date}</small></p>
</main>
/* Preview */
<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.50.2/codemirror.min.js"></script>
<link rel=stylesheet href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.50.2/codemirror.min.css">
<style>
	/* TwineJS's dark theme for CodeMirror */
	.theme-dark .CodeMirror {color: #e0e0e0; background: hsl(0, 0%, 14.9%); }
	.theme-dark div.CodeMirror-selected {background: #4d4d4c !important;}
	.theme-dark .CodeMirror-gutters {background: #1d1f21; border-right: 0px;}
	.theme-dark .CodeMirror-linenumber {color: #969896;}
	.theme-dark .CodeMirror-cursor {border-left: 1px solid #b4b7b4 !important;}
	.theme-dark .CodeMirror-matchingbracket { text-decoration: underline; color: white !important;}
</style>
<style>${fs.readFileSync('build/harlowe-css.css')}</style><script>${fs.readFileSync('build/harlowe-min.js') + fs.readFileSync('build/twinemarkup-min.js')}</script>
<script>{
$('#preview, #previewCode').show();
let html = $('html');
/* CodeMirror setup and Harlowe mode monkeying */
let cm = CodeMirror.modes['harlowe-3'].cm = CodeMirror.fromTextArea(previewCode.firstChild, { mode: null, lineWrapping:true });
html.on('click', '.previewCodeButton', function(e) { previewPassage(cm.doc.getValue())});
try { cm.setOption('mode','harlowe-3'); } catch(e) {}

/* Night Mode and Preview Buttons */
html.on('click', '#night', function() { html.addClass('night'); $('#previewCode').addClass('theme-dark'); })
    .on('click', '#day',   function() { html.removeClass('night'); $('#previewCode').removeClass('theme-dark'); })
    .on('click', '#fullPreviewBar', function() {
        html.addClass('fullPreview')
            .on('click.previewOff', function(e) {
                if (!(e.target.compareDocumentPosition(document) & 1) && !$(e.target).parents('#previewCode, #preview').length) { html.removeClass('fullPreview').off('.previewOff') }
            });
    })
    .on('click', '.previewButton:not(.previewCodeButton)', function(e) { previewPassage(e.target.parentNode.textContent.replace(/\\u200B/g,'')); });
$('pre > code').append("<div class='previewButton' title='Run this Harlowe code.'></div>");
}</script>
`;
/*
	Done
*/
fs.writeFileSync("dist/harloweDocs.html", outputFile);

