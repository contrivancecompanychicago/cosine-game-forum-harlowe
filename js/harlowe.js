/*
	This require.config call must be in here, so that local testing of Harlowe
	can be conducted without having to recompile harlowe.min.js.
*/
require.config({
	paths: {
		// External libraries
		jquery:                       '../node_modules/jquery/dist/jquery',
		almond:                       '../node_modules/almond/almond',
		"es6-shim":                   '../node_modules/es6-shim/es6-shim',
		"requestAnimationFrame":      '../node_modules/requestanimationframe/app/requestAnimationFrame',
		jqueryplugins:                'utils/jqueryplugins',
		
		markup:                       './markup/markup',
		lexer:                        './markup/lexer',
		patterns:                     './markup/patterns',
	},
	deps: [
		'jquery',
		'es6-shim',
		'jqueryplugins',
	],
});
require(['jquery', 'debugmode', 'renderer', 'state', 'engine', 'passages', 'utils/selectors', 'macros',
	'macrolib/values', 'macrolib/commands', 'macrolib/datastructures', 'macrolib/stylechangers', 'macrolib/enchantments', 'macrolib/links',
	'repl'],
		($, DebugMode, Renderer, State, Engine, Passages, Selectors) => {
	"use strict";
	/*
		Harlowe, the default story format for Twine 2.
		
		This module contains only code which initialises the document and the game.
	*/
	/*d:
		Appendix: Syntax comparison with SugarCube 1

		[SugarCube 1](http://www.motoslave.net/sugarcube/1/), one of the other story formats included in Twine 2, uses different markup and syntax to Harlowe.
		Additionally, its offered features and design philosophy also differ. This table offers a *very rough guide* to some of the major differences.
		(Note that a feature which is "not offered" may still be possible to implement by the addition of story CSS or JavaScript, or a combination of
		other extant features.)

		| Markup or syntax feature | Harlowe example | SugarCube 1 example
		|---
		|**Special passages**
		| Startup passages | "startup" tagged passages | "StoryInit" passage
		| Pre-render passages | "header" tagged passages | "PassageReady" passage (not printed)
		| Post-render passages | "footer" tagged passages | "PassageDone" passage (not printed)
		| Story sidebar modification | Not offered | "StoryMenu" passage
		| Debug-only passages | "debug-header", "debug-footer" and "debug-startup" tagged passages | Not offered
		|**Styling markup**
		| Aligner markup | `==><=`~ | Not offered
		| Strikethrough markup | `I'm <s>not</s> a bomb` | `I'm ~~not~~ a bomb`~
		| Underline markup | `Do <u>what</u>` | `Do __what__?`~
		| Subscript markup | `H<sub>2</sub>O` | `H~~2~~O`~
		| Highlight markup | `<mark>battalions</mark>` | `@@battalions@@`~
		| Verbatim markup | ``` `Text` ``` | `"""Text"""`~
		| Other styles | `(text-style:"outline")[Outlined text]` | Not offered
		| Coloured text | `(text-colour:fuchsia)[Fuchsia text]` | `@@color:fuchsia;Fuchsia text@@`~
		| Custom text styles | `(css:"border: 1px solid black")[Some text]` | `@@border:1px solid black;Some text@@`~
		| Adding and saving styles | `(set: $x to (text-color:fuchsia) + (font: "Skia")) $x[Some text]` | Not offered
		|**White-space control**
		| Escaped line break | `\` at start or end of line | `\` at end of line
		| Collapsing whitespace markup | `{Some text}` | Not offered
		| "No &lt;br>" macro | Not offered | `<<nobr>>Text<</nobr>>`~
		| "Silently" macro | Not offered | `<<silently>>Text<</silently>>`~
		|**Image and link markup**
		| Images | `<img src="http://example.org/image.png">` | `[img[http://example.org/image.png]]`~
		| Image links | `(link: '<img src="http://example.org/image.png">')[(goto:"Tower")]` | `[img[http://example.org/image.png][Tower]]`~
		| Setter links | `(link: "Text")[(set: $x to 1)(goto: "Passage")]` | `[[Text->Link][$x to 1]]`~
		| Image setter links | `(link: '<img src="http://example.org/image.png">')[(set: $x to 1)(goto:"Tower")]` | `[img[http://example.org/image.png][Tower][$x to 1]]`~
		|**Multimedia macros**
		| Audio macros | Not offered | `<<audio rumble_loop play>>`~ etc.
		|**Operators**
		| "Loosely equals" operators | Not offered | `0 eq false`~,<br>`3 neq " 2"`~
		| "Strictly does not equal" operator | `3 is not "3"` | `3 isnot "3"`~
		| Inequality operators | `3 > 2`,<br>`3 >= 3`,<br>`2 < 3`,<br>`2 <= 3` | `3 gt 2`~,<br>`3 gte 3`~,<br>`2 lt 3`~,<br>`2 lte 3`~
		| "Is variable defined" operator | Not offered | `def $lunchpack`~
		| "Contains" operation for arrays | `$arr contains "Pink"`,<br>`$arr's (a:3, -1) contains "Pink"`~ | `$arr.contains("pink")`~,<br>`$arr.contains("pink", 3)`~
		| "Contains all" operation for arrays | Not offered | `$arr.containsAll("pink", "green")`~,<br>`$arr.containsAll($arr2)`~
		| "Contains any" operation for arrays | Not offered | `$arr.containsAny("pink", "green")`~,<br>`$arr.containsAny($arr2)`~
		| "Count" operation | `(count: $arr, "Frog")` | `$arr.count("Frog")`~
		| Increment/decrement | `$a to it + 1`,<br>`$a to it - 1` | `$a++`~<br>`$a--`~
		| Spread operator | `...$arr` | Not offered
		|**Data model**
		| Passing | All data passed by value: arrays, datamaps and such are deep-cloned when (set:). | Objects passed by reference; all primitives passed by value.
		| Type coercion | Operators and macros do not coerce types. | Standard JavaScript coercion.
		|**Element access**
		| Array element access | `$arr's 1st`,<br>`$arr's ($index)` (where `$index` is 1-based) | `$arr[0]`~<br>`$arr[$index]`~ (where `$index`~ is 0-based)
		| Last array element access | `$arr's last`,<br>`$arr's (-$index)` (where `$index` is 1-based) | `$arr[$arr.length-1]`~,<br>`$arr[$arr.length-$index-1]`~ (where `$index`~ is 0-based)
		| Array slicing | `$arr's (a:1,4))` | `$arr.slice(0,3)`~
		|**Randomness**
		| "Either" macro/function | `(either: 1, 1, 3, 4)` | `either(1, 1, 3, 4)`~
		| Random whole numbers | `(random: 1, 4)` | `random(1, 4)`~
		| Random floating-point numbers | Not offered | `randomFloat(1, 4)`~
		| Random array elements | `(either: ...$arr's (a:1,4))` | `$arr.random(0,3)`~
		| PRNG seeding | Not offered | `History.initPRNG("abadidea")`~
		| "Shuffled" macro/function | `(shuffled: $...arr)` | `$arr.shuffle()`~ (alters `$arr`~)
		|**Game state**
		| "Time" identifier/function | `time` | `time()`~
		| Number of turns elapsed | `(history: )'s length` | `turns()`~
		| Current passage's name | `(passage: )'s name` | `passage()`~
		| Previous passage's name | `(history: )'s last` | `previous()`~
		| Current passage's tags | `(passage: )'s tags` | `tags()`~
		| Times a passage is visited | `(count: (history: ), "Passage")` | `visited("Passage")`~
		| Times a tag is visited | Not offered | `visitedTags("forest")`~
		|**Basic macros**
		| "Print" macro | `(print: $var)` | `<<print $var>>`~
		| "Set" macro | `(set: $x to 2)` | `<<set $x to 2>>`~
		| "Unset" macro | Not offered | `<<unset $x>>`~
		| "Remember" macro | Not offered | `<<remember $x = 1>>`~
		| "Run" macro | Not offered | `<<run alert("Hi")>>`~
		| Inline Javascript | `<script>document.title = "Huh?"</script>`| `<<script>>document.title = "Huh?"<</script>>`~
		| "Display" macro | `(display: "Duel")`, `<div>(display: "Duel")</div>` | `<<display "Duel">>`~,<br>`<<display "Duel" "div">>`~
		| "If" macro | `(if: $armed)[well-armed]` | `<<if $armed>>well-armed<</if>>`~
		| "For" macro | Not offered | `<<for $i to 0; $i lt $dogs.length; $i++>> <<print $dogs[i]>> <</for>>`~
		|**Data value macros**
		| Converting to string | `(text: $num)` | `$num + ""`~
		| Converting to number | `(num: $str)` | `+$str`~
		| Creating arrays | `(a: 1, 2, 5)` | `[1,2,5]`~
		| Maths macros | `(sin: 90)` etc. | `Math.sin(90)`~ etc.
		|**Navigation macros**
		| "Choice" macro | Not offered | `<<choice [[Place egg in basket->Basket]]>>`~
		| "Actions" macro | Not offered | `<<actions [[Talk to Ms Gine]] [[Talk to Ms Holk]]>>`~
		| "Go to" macro | `(goto: "Cloister")`| `<<goto "Cloister">>`~
		| "Return" macro | `(link:"Go back")[(goto: (history: )'s last)]`,<br>`(link:"Go back")[(goto: (history: )'s 3rdlast)]` | `<<return "Go back">>`~,<br>`<<return "Go back" go 3>>`~
		| "Back" macro | Not offered | `<<back "Go back">>`~
		|**UI element macros**
		| "Click/Link" macro | `(link: "Grab")[You grabbed it]` | `<<click "Grab">>You grabbed it<</click>>`~
		| "Mouseover" macro | `∣p>[A bubble] (mouseover-replace: ?p)[Pop!]` | Not offered
		| "Mouseout" macro | `∣p>[A bubble] (mouseout-replace: ?p)[Pop!]` | Not offered
		| "Checkbox" macro | Not offered | `<<checkbox "$Vegan" true false>>`~
		| "Radio Button" macro | Not offered | `<<radiobutton "$Hat" "beanie">>`~
		| "Text Area" macro | Not offered | `<<textarea "$Bio" "Your biography here">>`~
		| "Textbox" macro | Not offered | `<<textbox "$Name" "Enter username">>`~
		| DOM class macros | Not offered | `<<toggleclass ".tree" "summer">>`~<br>`<<addclass ".tree" "leaves">>`~<br>`<<removeclass ".tree" "nest">>`~
		|**Revision macros**
		| "Append" macro | `∣p>[grand piano] (append: ?p)[ (lid open)]` | `<span class='p'>grand piano</span> <<append ".p">> (lid open)<</append>>`~
		| "Prepend" macro | `∣c>[casket] (prepend: ?c)[open ]` | `<span class='c'>casket</span> <<prepend ".c">>open <</prepend>>`~
		| "Replace" macro | `∣g>[green gem] (replace: ?g)[worthless glass]` | `<span class='g'>gem</span> <<replace ".g">>worthless glass<</replace>>`~
		| Append/prepend/replace arbitrary text | `grand piano (append: "grand piano")[ (lid open)]` | Not offered
		|**Structured programming**
		| Custom macros | Not offered | `<<widget "myMacro">> <<print $args[0]>> <</widget>>`~ etc.
		|**Game saving**
		| Saving and loading macros/functions | `(savegame: "Slot 1")`,<br>`(saved-games: ) contains "Slot 1"` and<br>`(loadgame: "Slot 1")` | `SaveSystem.save(2)`~,<br>`SaveSystem.has(2)`~ and<br>`SaveSystem.load(2)`~
		| Built-in save menu | Not offered | "Save" sidebar menu
	*/
	
	// Used to execute custom scripts outside of main()'s scope.
	function _eval(text) {
		return eval(text + '');
	}
	
	/*
		Sets up event handlers for specific Twine elements. This should only be called
		once at setup.
	*/
	let installHandlers = () => {
		const html = $(document.documentElement);
		
		/*
			This gives interactable elements that should have keyboard access (via possessing
			a tabindex property) some basic keyboard accessibility, by making their
			enter-key event trigger their click event.
		*/
		html.on('keydown', function(event) {
			if (event.which === 13 && event.target.getAttribute('tabindex') === "0") {
				$(event.target).trigger('click');
			}
		});
		
		// If the debug option is on, add the debugger.
		if (Engine.options.debug) {
			DebugMode();
		}
		installHandlers = null;
	};

	/*
		When an uncaught error occurs, then display an alert box once, notifying the author.
		This installs a window.onerror method, but we must be careful not to clobber any existing
		onerror method.
	*/
	((oldOnError) => {
		window.onerror = function (message, _, __, ___, error) {
			/*
				This convoluted line retrieves the error stack, if it exists, and pretty-prints it with
				URL references (in brackets) removed. If it doesn't exist, the message is used instead.
			*/
			const stack = (error && error.stack && ("\n" + error.stack.replace(/\([^\)]+\)/g,'') + "\n")) || ("(" + message + ")\n");
			alert("Sorry to interrupt, but this page's code has got itself in a mess. "
				+ stack
				+ "(This is probably due to a bug in the Harlowe game engine.)");
			/*
				Having produced that once-off message, we now restore the page's previous onerror, and invoke it.
			*/
			window.onerror = oldOnError;
			if (typeof oldOnError === "function") {
				oldOnError(...arguments);
			}
		};
	})(window.onerror);
	
	/*
		This is the main function which starts up the entire program.
	*/
	$(() => {
		const header = $(Selectors.storyData);

		if (header.length === 0) {
			return;
		}

		// Load options from attribute into story object

		const options = header.attr('options');

		if (options) {
			options.split(/\s/).forEach((b) => {
				Renderer.options[b] = Engine.options[b] = true;
			});
		}
		let startPassage = header.attr('startnode');

		/*
			The IFID is currently only used with the saving macros.
		*/
		Renderer.options.ifid = Engine.options.ifid = header.attr('ifid');
		
		// If there's no set start passage, find the passage with the
		// lowest passage ID, and use that.
		if (!startPassage) {
			startPassage = [].reduce.call($(Selectors.passageData), (id, el) => {
				const pid = el.getAttribute('pid');
				return (pid < id ? pid : id);
			}, Infinity);
		}
		startPassage = $(Selectors.passageData + "[pid=" + startPassage + "]").attr('name');

		// Init game engine

		installHandlers();
		
		// Execute the custom scripts
		
		$(Selectors.script).each(function(i) {
			try {
				_eval($(this).html());
			} catch (e) {
				// TODO: Something more graceful - an 'error passage', perhaps?
				alert("There is a problem with this story's script (#" + (i + 1) + "):\n\n" + e.message);
			}
		});
		
		// Apply the stylesheets
		
		$(Selectors.stylesheet).each(function(i) {
			// In the future, pre-processing may occur.
			$(document.head).append('<style data-title="Story stylesheet ' + (i + 1) + '">' + $(this).html());
		});
		
		// Load the hash if it's present
		if (window.location.hash && !window.location.hash.includes("stories")) {
			if (State.load(window.location.hash)) {
				Engine.showPassage(State.passage);
				return;
			}
		}
		// Show first passage!
		Engine.goToPassage(startPassage);
	});
});
