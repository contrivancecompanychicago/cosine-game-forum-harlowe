PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/zsh -o extended_glob

jshint_flags = --reporter scripts/jshintreporter.js

uglify_flags = -c --comments -m -b beautify=false,ascii_only=true

# This function accepts two comma-separated JS string expressions,
# and replaces every instance of the former in the stream with the latter.

node_replace = node -e '\
	var read = e => require("fs").readFileSync(e,"utf8").replace(/^\uFEFF/, ""); \
	with(process)\
		stdin.pipe(require("replacestream")($(1))).pipe(stdout)'

# Here are some of the replacements used.

source = "\"source\":\"\"", "\"source\":" + JSON.stringify(read("template.html"))
setup = "\"setup\":\"\"", "\"setup\": function(){" + read("build/twinemarkup-min.js") + "}"
hydrate = "\"hydrate\":\"\"", "\"hydrate\":" + JSON.stringify(read("build/twinemarkup-min.js"))
engine = "{{HARLOWE}}", JSON.stringify("<script title=\"Twine engine code\" data-main=\"harlowe\">" + read("build/harlowe-min.js") + "</script>\n").slice(1, -1)
css = "{{CSS}}", JSON.stringify("<style title=\"Twine CSS\">" + read("build/harlowe-css.css") + "</style>").slice(1, -1)

# Now, the rules.

# Since I can test in Firefox without compiling the ES6 files, default only compiles the CSS.

default: dirs css

css: build/harlowe-css.css
docs: build/harlowe-min.js build/twinemarkup-min.js css
	@node scripts/harlowedocs.js

format: dist/format.js

all: dirs dist/format.js docs dist/exampleOutput.html

clean:
	@-rm -f build/*
	@-rm -f dist/*
	@cp icon.svg dist/icon.svg

dirs:
	@-mkdir -p build dist

jshint:
	@jshint js --config js/.jshintrc $(jshint_flags)
	@jshint test/spec --config test/spec/.jshintrc $(jshint_flags)

build/harlowe-css.css: scss/*.scss
	@cat scss/*.scss \
	| sass --stdin --style compressed \
	> build/harlowe-css.css

# - 3 separate sed calls with -e due to multiline commands colliding with Make's backslash \
# - $$ escapes sed's $ inside Make
build/harlowe-min.js: js/*.js js/*/*.js
	@cat js/*.js js/*/*.js \
	| babel --no-babelrc \
	| uglifyjs $(uglify_flags) \
	| sed -e '1{h;s/.*/cat scripts\/define.min.js node_modules\/es6-shim\/es6-shim.min.js node_modules\/jquery\/dist\/jquery.min.js/ep;g}' \
	| sed -e '$$a ;require(\"harlowe\")}());' \
	| sed -e '1i (function(){"use strict";' \
	> build/harlowe-min.js

# Inject the definitions of valid macros, containing only the name/sig/returntype/aka
shortdefs = "\"SHORTDEFS\"", JSON.stringify(Object.entries(require("./scripts/metadata")).reduce((a, [k,v]) => Object.assign(a, v.shortDefs ? {[k]: v.shortDefs()} : {}), {}))
# Inject the pre-built CodeMirror CSS
codemirrorcss = "\"CODEMIRRORCSS\"", JSON.stringify(require("./scripts/codemirrorcss"))

# The cat order is a hard-coded dependency chain.
# This must have --keep-fnames because some function names are used to distinguish CodeMirror event handlers.
build/twinemarkup-min.js: js/markup/*.js js/markup/*/*.js
	@cat js/markup/(^markup).js js/markup/markup.js js/markup/codemirror/utils.js js/markup/codemirror/tooltips.js js/markup/codemirror/toolbarpanel.js js/markup/codemirror/toolbar.js js/markup/codemirror/mode.js \
	| $(call node_replace, $(shortdefs)) \
	| $(call node_replace, $(codemirrorcss)) \
	| babel --no-babelrc \
	| uglifyjs $(uglify_flags) --keep-fnames \
	| sed -e '$$a }).call(this);' \
	| sed -e '1i (function(){' \
	> build/twinemarkup-min.js

dist/format.js: build/harlowe-min.js build/twinemarkup-min.js css
	@cat format.js \
	| $(call node_replace, $(source)) \
	| $(call node_replace, $(setup)) \
	| $(call node_replace, $(hydrate)) \
	| $(call node_replace, $(engine)) \
	| $(call node_replace, $(css)) \
	> dist/format.js

examplestory = "{{STORY_DATA}}", read("exampleStory.html")
examplename = "{{STORY_NAME}}", "Example Output File"
engine_raw = "{{HARLOWE}}", "<script title=\"Twine engine code\" data-main=\"harlowe\">" + read("build/harlowe-min.js") + "</script>\n"
css_raw = "{{CSS}}", "<style title=\"Twine CSS\">" + read("build/harlowe-css.css") + "</style>"

dist/exampleOutput.html: build/harlowe-min.js css
	@cat template.html \
	| $(call node_replace, $(engine_raw)) \
	| $(call node_replace, $(css_raw)) \
	| $(call node_replace, $(examplestory)) \
	| $(call node_replace, $(examplename)) \
	> dist/exampleOutput.html

.PHONY : all dirs default jshint clean css docs
