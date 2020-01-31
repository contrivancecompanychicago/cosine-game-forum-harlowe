#Harlowe - the default [Twine 2](https://github.com/klembot/twinejs) story format.

Documentation is at http://twine2.neocities.org/. See below for compilation instructions.

###3.2.0 changes (unreleased):

####Bugfixes

 * Fixed a long-standing bug where continuous ranges for arrays, such as `(a: 1,2)'s 4thlasttolast`, wouldn't work correctly. (What that example should do is provide the entire array.)
 * Fixed a long-standing bug where `(click: ?Passage)` and `(click: ?Sidebar)` just flat-out didn't work at all.
 * Fixed a bug where the default CSS for `(click: ?Page)` (a blue border around the page) wasn't visible. (Now, an `::after` pseudo-element is created for the enchantment, so that the border displays above all the page content.)
 * Now, `(mouseover:)` and `(mouseout:)` should work correctly with ?Page, ?Passage, and ?Sidebar.
 * Fixed a bug where `(for:)` would emit infinite loop errors if 50 or more elements were given to it.

####Alterations

 * The behaviour for multiple `(click:)` macros affecting the same hook (such as in `|A>[B] (click: ?A)[1] (click: ?A)[2]`) has changed to be slightly more intuitive: formerly, as you clicked the hook, the last `(click:)` would activate first (so, `[2]` then `[1]`). Now, they activate from first to last. This also applies to `(mouseover:)` and `(mouseout:)`.
 * Now, the text input box in `(prompt:)` is auto-focused when the dialog appears, allowing the player to type into it without having to click it.
 * Now, pressing Return or Enter in a `(prompt:)` text input box should submit the text, as if "OK" was clicked.
 * The default CSS for `(mouseover:)` and `(mouseout:)` (a dotted gray border and translucent cyan border, respectively) has been brightened slightly to be more visible.
 * Reworded the error message produced by trying to get an array element that's outside the array's length (such as `(a: 1,2)'s 5th`).

####Additions

 * Added some new macros, `(storylet:)` and `(open-storylets:)`, to support "storylets", an alternative way to link between groups of passages that's preferable for writing non-linear "episodic" interactive fiction. Instead of writing direct links between each episode, you instead write a requirement at the start of each episode, specifying (using a 'when' lambda) when would be the best time to let the player visit the passages. An example is `(storylet: when $season is "spring")`. Then, when you want the player to go to an episode, you use macros like `(open-storylets:)` to get a list of which storylet passages are available right now, and create links or other structures from there.
 * Added a `(metadata:)` macro, which, when placed in a passage, adds values to the `(passage:)` datamap for that passage, allowing you to store any arbitrary data on it for your own use. This takes the same values as `(dm:)` - string names and data values in alternation.
 * Added a debug mode panel listing which storylet passages are currently available, and their 'where' lambdas. This panel is only visible if you have `(storylet:)` macros in your story.

###3.1.0 changes:

####Bugfixes

 * Fixed a bug where the CSS that makes sequences of consecutive line breaks cumulatively smaller in height was incorrectly being applied to non-consecutive `<br>`s that only had plain text between them - for instance, single line breaks separating words or phrases with no other formatting, or line breaks in the verbatim markup.
 * `(alert:)`, `(confirm:)` and `(prompt:)` no longer error when playing in certain browser environments, including testing within certain versions of the desktop Twine app itself. (For more details, see "Alterations".)
   * Additionally, user script error messages (and Harlowe crash messages) should now successfully appear in those environments as well.
 * Fixed a bug where header and footer tagged passages were not being transcluded in alphabetical order (instead using passage creation order) on recent versions of Chrome.
   * Additionally, header and footer tagged passages are now sorted in the "natural sort" order used by `(sorted:)`, so that, for instance, a header passage named "10" appears after a header passage named "2".
 * Fixed a long-standing bug where `(append:)` and `(prepend:)`, when given multiple target hooks or strings, wouldn't perform the appends or prepends in a single pass - `A(append:"A","B")[B]` would produce `ABB` instead of `AB`, against intuition.
 * Fixed a bug where using an external temp variable as a property inside a lambda (such as `_foo` in `where _foo of $bar contains it`) wouldn't work.
 * Fixed a bug where the error message for giving `(event:)` the wrong type of lambda was incorrectly worded.
 * Fixed a bug where using the sidebar's "redo" button wouldn't cause the debug panel's "Turns" dropdown to update.
 * Fixed a bug where the debug mode's variables button's label sometimes had the wrong number on it.
 * Fixed a bug where an error given to the spread `...` syntax, such as `(a: ...(a:2/0))`, wouldn't be displayed, instead producing an unrelated error.
 * Fixed a bug where an error in the passage name given to `(passage:)`, such as `(passage: (str:1/0))`, wouldn't be displayed, instead producing an unrelated error.
 * Fixed a long-standing bug in `(substring:)` where negative indices wouldn't work correctly if the string contained any Unicode "astral plane" characters (any characters not in the Basic Multilingual Plane).
 * Fixed a bug where lambdas weren't being printed correctly (for example, as `a "via ... " lambda`) in certain error messages.
 * Fixed a bug where certain `(text-style:)` changers, specifically 'outline', 'shadow', 'blur', 'blurrier', 'emboss' and 'smear', often didn't work when added to `(text-color:)` changers, and vice-versa.
 * Fixed a bug where using `(show:)` to reveal a hidden hook more than once (that is, to reveal a hook already revealed) would cause its code and prose to be run and shown more than once, behaving similarly to `(link-repeat:)`.
 * Fixed a limitation where certain commands (including `(show:)`, `(cycling-link:)`, `(enchant:)`, `(click-goto:)`, `(mouseover-goto:)`, `(mouseout-goto:)` and `(link-show:)`) wouldn't correctly interact with temp. variables or hook names after being `(set:)` into a variable in one passage and then used in another (although there's not very much utility in doing this).
 * Fixed a bug where the debug view notification messages for `(set:)`, `(move:)` and `(put:)` (that tell you what value the variable now contains) were not being produced.

####Alterations

 * As you know, passage links can contain markup like `[[$passageVar]]`, and that markup is evaluated as if it were an expression to determine the correct passage name. But formerly, if there really was a passage whose named lined up exactly with the markup (in this example, a passage whose name literally was "$passageVar") then it wasn't (easily) possible to link to it. This is now changed, so Harlowe will always prioritise exact matches first, and these passages can be successfully linked to.
 * Furthermore, if a link's passage name is an exact match to a passage, then the markup inside that passage name will now be ignored. For instance, `[[//Bleah//]]` will, if it links to a passage, be rendered as "//Bleah//" instead of "Bleah" in italics, and `[[board_shorts]]` will no longer be considered to have a temp variable named `_shorts` inside it.
 * The aforementioned rules for passage names in links now apply to `(link-reveal-goto:)` links as well as normal `(link-goto:)` links.
 * `(alert:)`, `(confirm:)` and `(prompt:)` have been reimplemented from the ground up as pure HTML dialogs, instead of using the browser built-in `alert()`, `confirm()` and `prompt()` Javascript functions. This brings a few big changes: they now, by default, follow the colour scheme of Harlowe (black text on white, with links for buttons), can be affected by user CSS, and should appear and behave the same on every platform. However, they should still have the *exact same semantics* as their former versions: passage rendering and code execution should still halt while the dialogs are on-screen, links, `(mouseover:)` and `(mouseout:)` elements should not be interactable while they're on-screen, `(live:)` and `(event:)` macros shouldn't fire when they're on-screen, and `(confirm:)` and `(prompt:)` should still display their dialogs at evaluation time (i.e. when a macro expression containing them is rendered). Do report any bugs or behaviour that doesn't correspond to this description.
 * `(prompt:)` has additionally been changed, such that clicking "Cancel" now makes it evaluate to the default value (the second string passed to it) regardless of the contents of the text area. Formerly, it evaluated to `""` (an empty string). This isn't to be considered a compatibility break, as it's already and still possible for an empty string to be returned by emptying the text area and clicking "OK".
 * `(rgba:)` and `(rgb:)`, as well as `(hsla:)` and `(hsl:)` have been merged - the "a" version is now the alias of the other, and the fourth "alpha" value is optional for both. This should have no effect on existing code that uses these macros.
 * Now, `(history:)` can be given an optional "where" lambda to provide only passage names whose passages match the lambda. The lambda is given the same passage datamaps which are returned by `(passage:)`. `(history: where its tags contains "Forest")` is essentially a shorthand for `(find: where (passage: it)'s tags contains "Forest", ...(history:))`.
 * The debug view colours for various macros have been updated to recognise more macro names.
 * Raw `<textarea>` tags will no longer have their contained text converted to HTML elements as if it was Harlowe syntax.
 * Now, using `(enchant:)` to enchant the `(text-colour:)` of ?Page or ?Passage will no longer override the text-colour of links - only by enchanting the enclosing hooks, or the ?Link hook, can change their non-hover colour.
 * The default CSS for `<pre>` elements now has a smaller `line-height`.
 * When a Javascript error in a story's user script is thrown, the stack trace in the resulting dialog is now more concise, no longer printing Harlowe engine stack frames.

####Additions

#####Coding

 * Added a `visits` identifier (aliased as `visit`) to join `it` and `time`. It equals the number of times the current passage was visited, including this visit. The purpose of this identifier is to make it easier to replicate the Twine 1 `<<once>>` macro, which only displayed text on the first visit to a passage, and whose absence was a long-standing weakness in Harlowe. Previously, it could be replicated using the rather cumbersome `(if: (passage:)'s name is not in (history:))`, but now, it can be replicated using `(if: visits is 1)`, which expresses the intent much better and approaches the original's brevity. Furthermore, it makes it much easier to specify hooks to display on third, fourth, or even-numbered visits, using `(if: visits is 3)`, `(if: visits % 2 is 0)` and so forth. The reason this is an identifier and not a macro (like `(passage:)`) is because I want identifiers to be used for small, "volatile" information that's specific only to the current context, such as `it` and `time`. (`(history:)`, in retrospect, could have been an identifier.)
 * Also added an `exits` identifier (aliased as `exit`), which equals the number of "exit" elements in the passage (links, `(mouseover:)` or `(mouseout:)` elements).
 * Added the special hookname properties, "chars", "lines", and "links", which can be used to select special kinds of structures inside hooks.
   * `?hook's chars` selects each individual character within a hook, as if they were wrapped in hooks themselves. This is meant to revive the memorable `.char`-selecting CSS functionality in Twine 1, and can, in particular, be used with `(enchant:)` and `(hover-style:)`.
   * `?hook's lines` selects individual lines of text within a hook. A line is any run of text or code between line breaks (or the passage's start and end) - a word-wrapped paragraph of prose is considered a single "line" as a result.
   * `?hook's links` selects hyperlinks, similar to `?Link`, but only within the given hook.
 * Now, you can create consecutive subsets of arrays, strings and hooknames by writing two positions, such as `1st` and `3rd`, and joining them together with `to`, and using that as a data name - `$arr's 1stto3rd` is the same as `$arr's (a:1,2,3)`, and `"Jelly"'s 3rdlasttolast` is "lly". This is a more readable alternative to using arrays of positions. Note that, as with `2nd` etc., these are case-insensitive, so you can write these using the capitalisation `3rdlastToLast` if you wish. (Note that this isn't intended to replace subsets whose ranges are defined by variables, such as in `$a's (range:$p1, $p2)`.)

#####Macros

 * Added `(cond:)`, a macro similar to `(if:)` but which conditionally chooses between two data values, rather than hooks. `(cond: visits is 1, "Strange", "Familiar")` is "Strange" on the first visit and "Familiar" afterward. Since it's not a changer, you can use it in expressions within other macros freely. Additionally, you can add further conditions - `(cond: $gender is "masc", "god", $gender is "femme", "goddess", $gender is "pan", "goddex", "deity")` - to choose among several values precisely.
 * Added `(nth:)`, a macro that takes a sequence of values and chooses one at a given position, similar to the `'s` or `of` indexing syntax for arrays. `(nth: 2, $mary, $edith, $gwen)` is the same as `(a: $mary, $edith, $gwen)'s 2nd`. It serves as a more readable alternative to the indexing syntax in certain situations, such as using it with `visit` in cases like `(nth: visit, "hissing", "whirring", "clanking")`.
 * Added `(more:)`, a convenient shorthand for `(event: when exits is 0)`. When there are no more exits, it will run and display even "more" prose. Loosely inspired by the Ink language's "gather" syntax, its main purpose is to be used alongside `(link:)`, as a shortcut for putting `(show:)` inside it - `(link:"Duck")[It swims on the lake.(show:?next)] |next)[It dives underwater.]` can be rewritten as `(link:"Duck")[It swims on the lake.] (more:)[It dives underwater.]`.
 * Added a `(passages:)` macro, which returns an array containing the `(passage:)` datamaps for every passage in the game, but also can be given a "where" lambda to filter that array.
 * Added a gradient data type, a `(gradient:)` macro, and a `gradient` datatype name. This can be used to quickly create special images called gradients, which are smooth linear fades between various colours. These are implemented using CSS `linear-gradient`s, and the `(gradient:)` macro has similar syntax to it. Currently, these can only be used with `(background:)`.

#####Markup

 * Added "unclosed hook" markup: `[==` (`[` followed by any number of `=`, similar to the aligner markup) is an opening bracket that automatically closes when the passage or enclosing hook ends, so you don't need to include the closing bracket yourself. This is inspired by the `<<continue>>` custom macro I wrote for Twine 1 (not to be confused with SugarCube's macro of the same name), and is designed for convenient use with changers that you may want to apply to the entire remainder of the passage, such as `(link:)`, `(event:)`, `(t8n:)` and such. `(link: "Next.")[=` replicates the behaviour of `<<continue "Next.">>` easily.

#####Debug Mode

 * Added a new toggleale pane to the debug mode panel, "Source", which displays the current passage's source code. This is designed to supplement the "debug view" option, which shows the passage's current state, by letting you compare it to the original code. This pane currently has no syntax highlighting, such as that used in the Twine editor.
 * Added another toggleable pane, "Errors", which displays a record of every error that has been displayed in the story, so far, up to a limit of 500. This should be of assistance when dealing with errors inside `(live:)` hooks, or other hooks whose content appears and disappears abruptly.
 * The debug mode variables pane now lists the contents of datamaps, arrays and datasets, as separate rows.
 * Colours in the variables pane now have a colour swatch in their listing.

###3.0.2 changes:

####Bugfixes

 * Fixed a startup bug that potentially caused `(dropdown:)` menus to stop affecting their bound variables for the rest of the game.
 * Now, `(alert:)`, `(prompt:)` and `(confirm:)` produce errors if they are used in a browser that doesn't support Javascript's `prompt()`, `alert()` or `confirm()` functions, instead of crashing the page.
 * Fixed the `(str:)` macro alias added in 3.0.0 mysteriously not actually having been added.

###3.0.1 changes:

####Bugfixes

 * Fixed a bug where the SessionStorage state-preserving system introduced in 3.0.0 would interfere with the "Test story starting here" feature in the Twine editor.

####Alterations:

 * If the `(loadgame:)` macro encounters an error while loading save data (such as, a passage it refers to no longer exists in this version of the story) then a polite dialog box (a simple JavaScript `prompt()`) will appear suggesting that the save data might be outdated, and asking the reader whether or not the save data should be deleted.

###3.0.0 changes:

####Bugfixes

 * Fixed a bug where the story crashes on startup if the page's URL contains a hash identifier that doesn't have "stories" in it (such as in `story.html#what`).
 * Fixed a bug where the story crashes on startup if, for some reason, localStorage exists but cannot be accessed.
 * Fixed a bug where same-precedence arithmetic operators (`+` and `-`, or `/` and `*`) had incorrect associativity (so, `3 - 5 + 2` was interpreted as `3 - (5 + 2)` instead of `(3 - 5) + 2`).
 * Temp variables finally work correctly with changers that defer a hook until some event occurs, like `(link:)`, `(click:)` and such. Now, you can reference temp variables inside the hook, such as in `(link:"Read")[It reads: _engraving]`, just as you can with other kinds of changers.
 * Fixed a bug where supplying multiple shortened `is` or `is not` comparisons, in a form such as `$a is $b and $c`, would produce an incorrect result.
 * Fixed a bug where the Debug View's `(set:)` messages were worded incorrectly when setting global variables.
 * A more useful error message is given if you write a link with no passage name (such as `[[Go->]]`).
 * Fixed a bug where you could + a changer, a hookname, or a colour to any arbitrary command, like a `(goto:)` command.
 * Fixed a bug where having a `(for:)` macro's lambda's `where` clause return something other than a boolean, such as in `(for: each _a where 127)[]`, wouldn't produce an error message.
 * Fixed a bug where `contains` would wrongly error if used to check if an empty string `""` contained anything.

####Alterations

 * Now, when playing, the current game session will attempt to preserve itself across browser reloads and back-forward navigation using browser SessionStorage. This means that reloading the page (without closing the window or tab) should also automatically reload the player's position in the story, as if by `(load-game:)`. This does not apply when using `(reload:)`, however, which always returns the story to the beginning. If an error occurs while loading this data (such as, a passage it refers to no longer exists in this version of the story) then it will be silently ignored.
 * The `(replace:)`, `(append:)` and `(prepend:)` macros now no longer target any hooks or text that haven't been rendered yet - so, `(replace: "cool")[hot] cool water` won't work because the `(replace:)` runs before "cool water" has rendered, but `cool water (replace: "cool")[hot]` and something like `(link: "heat")[(replace: "cool")[hot]] cool water` will. This finally normalises what was formerly very inconsistent behaviour across these three macros - `(replace:)` couldn't target forthcoming hooks but could target later text, and `(append:)` and `(prepend:)` would do the others' behaviour on forthcoming hooks.
 * The `(text:)` macro now has another alias, `(str:)`. This alias will now be the preferred name for this macro in the documentation, mainly due to the arrival of other string macros that begin with "str-", and additionally to avoid semantic conflict with the various "text-" changer macros like `(text-style:)`.
 * To more clearly separate the concepts of "printing data" and "running commands" in Harlowe, the `(print:)` macro will no longer run commands passed to it (that is, `(print:(go-to:"Foo"))` and `(go-to:"Foo")` will no longer do the same thing - the former will just print out a descriptive string, as if printing out a changer). Commands can now only be run by placing them directly in the passage (either as plain calls, inside variables, or wrapped in strings that (print:) receives).
 * Passage links no longer have a `passage-name` attribute indicating which passage they lead to, which the player could inspect using developer tools.
 * If links' text contains an error message (for instance, in the case of `(link-replace:"(print:2+true"))[]`), then the link can no longer be clicked (so that the error message can be expanded).
 * Error messages should now explain in slightly more detail what kind of lambda a macro requires (`"a "where ..." lambda"`, for instance).
 * Now, a `(transition:)` added to `(link:)`s, `(click:)`s, `(mouseover:)`s and other such macros will no longer cause the links or other elements to use the named transition themselves - instead, it will only be applied to the attached hook when it is made to appear.
 * `(show:)` will no longer produce an error if it tries to show a hook that's already visible, for consistency with other macros that accept hooknames, like `(click:)`. (Actually, it never did this in the first place, due to a bug.)
 * The "undo" and "redo" buttons in the story's sidebar are now brighter by default.
 * Various lambda macros that accept multiple values - namely `(for:)`, `(all-pass:)`, `(some-pass:)`, `(none-pass:)`, `(find:)`, and `(altered:)` - no longer error if no values are given after the lambda - for instance, `(for: each _a, ...$arr)[]` now no longer errors if `$arr` contains 0 elements.
 * Syntax highlighting: Tweaked a few colours to be more readable in dark mode, and removed the "smart quote" skewing to signify matching pairs of quote marks (as it was interfering with the cursor position sometimes).

####Additions

#####Datatypes

 * Added `is a` and `is an` operators, which can be used to determine what datatype a variable or piece of data is - `$message is a string` is true if the variable is a string. The datatype names are `number` or `num`, `string` or `str`, `boolean`, `array`, `datamap` or `dm`, `dataset` or `ds`, `command`, `changer`, and `color` or `colour`.
 * Added a `matches` operator, which functions similarly to `is a`, but can also be used to check if a data structure's shape resembles a pattern - a similar data structure with datatype names as "holes" in it. `(a: 2, 3) matches (a: num, num)` checks that the first array contains exactly two numbers. `(dm: "Faction", str) matches (dm: "Faction", "Slugbikers")` checks that the second datamap contains only one name with a string value. Nested patterns - `(a: (a: num), num, num)` - are also usable.
 * Added a `bind` operator, which is used to "bind" variables to certain interaction macros, like `(cycling-link:)`, described below.

#####Macros

 * You can now attach changers to command macros, including `(print:)`, `(display:)` and `(link-goto:)`, as well as regular passage links. This allows you to style them without needing to wrap them in a separate hook. (A subset of commands, like `(enchant:)` and `(stop:)`, still can't have changers attached, however.)
 * Added `(transition-depart:)` and `(transition-arrive:)` (aliases `(t8n-depart:)` and `(t8n-arrive:)`), macros which, along with an optional `(t8n-time:)`, allow you to finally change the passage transition used by links, by just attaching them to the front: `(t8n-depart:"dissolve")[[Think it over]]` will create a link that, when clicked, goes to the "Think it over" passage and fades out the current passage using a dissolve transition. These can be used in tandem for a number of interesting effects: `(t8n-depart:"dissolve")+(t8n-arrive:"pulse")[[That memory...]]` will work as expected. You can also use these with `(link-goto:)`, `(link-undo:)`, and work with `(enchant: ?Link)` too.
 * The following transitions have been added:
   * "instant", which makes the transitioning entity instantly appear or disappear. (Try placing `(enchant:?Link, (t8n-arrive:"instant"))` in your header passages for snappy transitions throughout the story.)
   * "rumble", which shakes the transitioning entity vertically as it appears or disappears (similar to `(text-style: "rumble")`).
   * "slide-up", "slide-down", "slide-left" and "slide-right", which slide the transitioning entity in or out from offscreen.
   * "flicker", which coarsely flickers the transitioning entity as it appears or disappears, reminiscent of flickering fluorescent lights.
 * Added `(cycling-link:)`, a popular interaction macro from Twine 1. Clicking a cycling link changes its text to the next string in the given list, and can optionally set a variable to that same string. An example usage is `(cycling-link: bind $flower, "rose", "violet", "daffodil")`. This can use an attached `(t8n:)` to transition each string in as it's clicked. (I'd meant to include for a very long time, but it needed several other features in this update to fully meet the UX standards of Harlowe.)
 * Added `(dropdown:)`, an interaction macro similar to `(cycling-link:)` that creates a dropdown `<select>` menu instead, and binds a variable to whichever string is currently selected.
 * Added a string-specific shorthand of `(repeated:)` called `(str-repeated:)` (and aliased as `(string-repeated:)`). `(str: ...(repeated: 14, "-+*+"))` is the same as `(str-repeated: 14, "-+*+")`.
 * Added `(reversed:)`, a macro which constructs an array with the given elements in reverse order, and `(str-reversed:)`, a shorthand that reverses a single string's characters. (Prior to now, you could accomplish this with `(folded: _e making _a via (a: _e) + _a, (a:), ...$arr)`, but this offers a far easier formulation.)
 * Added `(click-goto:)`, `(mouseover-goto:)` and `(mouseout-goto:)`, which are combinations of `(click:)`, `(mouseover:)` and `(mouseout:)` with `(goto:)`, similar to `(link-goto:)`.
 * Added `(link-reveal-goto:)`, a combination of `(link-reveal:)` and `(go-to:)` that lets you run commands like `(set:)` before going to another passage. An example usage is `(link-reveal-goto: "Link text", "Passage name")[(set: $x to 1)]`.
 * Added `(link-show:)`, a link which, when clicked, shows the given hidden hooks, as if by `(show:)`. Just like `(show:)`, it can also have changers attached to it.
 * Added `(event:)`, a changer similar to `(live:)` which live-renders the hook only once, and only when the given lambda, which is run every 20ms, produces true. It accepts a "when" lambda, which is just a version of "where" that's grammaticaly appropriate for `(event:)`.

###2.1.0 changes:

####Bugfixes

 * Now, using `(enchant:)` to change the `(text-colour:)` of `?Link` (normal links) will correctly override the default CSS link colour.
 * Fixed a bug where the alternative macro spellings `(text-color:)` and `(color:)` were displayed as erroneous in the editor.
 * Now, `(enchant:)` correctly displays an error when the changer provided to it includes a `(replace:)`, `(append:)` or `(prepend:)` command.
 * Re-fixed the bug where `(pow:)` only accepted 1 value instead of 2, and also fixed `(sqrt:)` and the `(log:)` variants, which weren't working at all.
 * Fixed a parsing bug where `5*3-2`, without whitespace around the minus sign, would break the order of operations.

####Alterations

 * Changed the `~~` markup to produce a strikethrough style using an `<s>` element, instead of a censor-bar style using a `<del>` element. The censor-bar style, which was used in all previous versions but not ever properly documented, was bugged to always be black even if the text colour was not black. It can be replicated in stories by simply using a `(background-colour:)` macro (preferably set to a variable) in its place.
 * Removed the default `line-height` CSS for `<h1>` and other header elements, because it was causing problems with line-wrapped headers.

####Additions

#####Debug Mode

 * Added a button to hide/show the variables pane at will.
 * Reduced the maximum CSS height of the variables pane from 90vh (90% of the window's height) to 40vh.
 * Gave variable rows a flex-shrink of 0, which I'm told prevents rows from contracting to unreadability when the pane requires scrolling.
 * The variables pane should now also list temporary variables, and their locations. This currently only lists those that have been explicitly (set:) or (put:), and ignores those that are created inside (for:) loops.

###2.0.1 changes:

####Bugfixes

 * Fixed a bug where `(enchant:)` applied to ?Page couldn't override CSS properties for `<tw-story>` (including the default background colour and colour).
 * Fixed a Passage Editor display bug where the left margin obscured the first letter of lines.

###2.0.0 changes:

####Bugfixes

 * Fixed a bug where comparing a value with an error (such as `2 is (3 + 'X')`) would suppress the error.
 * Fixed a bug where subtracting non-subtractable values (such as booleans) wouldn't produce an error, instead implicitly converting the values to numbers, and potentially producing the Javascript value `NaN`.
 * Fixed a bug where subtracting arrays and datasets wouldn't correctly compare contained data structures - for instance, `(a:(a:1)) - (a:(a:1))` wouldn't work correctly.
 * Fixed a bug where the `(dataset:)` macro, and adding datasets, wouldn't correctly compare data structures - for instance, `(dataset: (a:),(a:))` would contain both identical arrays, as would `(dataset: (a:)) + (dataset: (a:))`.
   * Additionally fixed a bug where data structures were stored in datasets by reference, allowing two variables to reference (and remotely alter) the same data.
 * Fixed a bug where using `(move:)` to move a subarray or substring (such as `(move: $a's (a:2,3) to $b))` wouldn't work.
 * Fixed a bug where using `(set:)` to set a substring, when the given array of positions contained "length" (such as `(set: $a's (a:1,"length")) to "foo")`), wouldn't produce an error.
 * Fixed a bug where the `(count:)` macro would give the wrong result when the data to count (the second value) was an empty string.
 * Now, a `(print:)` command that contains a command will only execute the contained command if itself is actually displayed in the passage - the code `(set: $x to (print:(goto:'X')))` would formerly perform the (goto:) immediately, even though the (print:) was never displayed.
 * Now, datasets contained in other datasets should be printed correctly, listing their contents.
 * `(alert:)`, `(open-url:)`, `(reload:)` and `(goto-url:)` now correctly return command values rather than the non-Harlowe value `undefined` (or, for `(open-url:)` a Javascript Window object). This means that `(alert:)`'s' time of execution changes relative to `(prompt:)` and `(confirm:)` - `(set: $x to (prompt:"X"))` will display a JS dialog immediately, but `(set: $x to (alert:"X"))` will not - although this is conceptually reasonable given that `(prompt:)` and `(confirm:)` are essentially "input" commands obtaining data from the player, and `(alert:)` is strictly an "output" command.
 * Now, line breaks between raw HTML `<table>`, `<tr>`, `<tbody>`, `<thead>` and `<tfoot>` elements are no longer converted into erroneous `<br>` elements, which are moved to just above the table. Thus, one can write or paste multi-line `<table>` markup with fewer problems arising.
 * Fixed bugs where various macros (`(subarray:)`, `(shuffled:)`, `(rotated:)`, `(datavalues:)`, `(datamap:)`, `(dataset:)`) would end up passing nested data structures by reference (which shouldn't be allowed in Harlowe code). For instance, if you did `(set:$b to (rotated: 1, 0, $a))`, where $a is an array, then modifying values inside $b's 1st would also modify $a.
 * Fixed a bug where setting custom values in a datamap returned by `(passage:)` would save the data in all subsequent identical `(passage:)` datamaps. (For instance, `(set: (passage:'A')'s foo to 1))` would cause all future datamaps produced by `(passage:'A')` to have a "foo" data name containing 1.) The `(passage:)` macro, or any other built-in macros' return values, are NOT intended as data storage (and, furthermore, are not saved by `(savegame:)` etc).
 * Fixed the bug where a `(goto:)` command inside a hook would prevent subsequent commands inside the hook from running, but subsequent commands outside it would still continue - for instance, `(if:true)[(go-to:'flunk')](set:$a to 2)` would still cause the `(set:)` command to run.
 * Fixed the bug where `(current-time:)` wouldn't pad the minutes value with a leading 0 when necessary.
 * Fixed the bug where referring to a variable multiple times within a single `(set:)` command, like `(set: $a to 1, $b to $a)`, wouldn't work as expected.
 * The "pulse" transition (provided by `(transition:)`) now gives its attached hook the `display:inline-block` CSS property for the duration of the transition. This fixes a bug where block HTML elements inside such hooks would interfere with the transition animation.
 * Revision changers (`(replace:)`, `(append:)`, `(prepend:)`) that use hook names can now work when they're stored in a variable and used in a different passage. So, running `(set: $x to (replace:?1))` in one passage and `$x[Hey]` in the next will work as expected.
 * Differing revision changers can be added together - `(append: ?name) + (prepend: ?title)`, for instance, no longer produces a changer which only prepends to both hooks.
 * Fixed various mistakes or vaguaries in numerous error messages.

####Alterations

#####Removed behaviour

 * In order to simplify the purpose of hook names such as `?room`, you can no longer convert them to strings, `(set:)` their value, `(set:)` another variable to them, or use them bare in passage text. The `(replace:)` macro, among others, should be used to achieve most of these effects.
 * Using `contains` and `is in` on numbers and booleans (such as `12 contains 12`) will now produce an error. Formerly, doing so would test whether the number equalled the other value. (The rationale for this was that, since the statement `"a" contains "a"` is the same as `"a" is "a"`, then so should it be for numbers and booleans, which arguably "contain" only themselves. However, this seems to be masking certain kinds of errors when incorrect or uninitialised variables or properties were used).
 * Now, various macros (`(range:)`, `(subarray:)`, `(substring:)`, `(rotated:)` etc.) which require integers (positive or negative whole numbers) will produce errors if they are given fractional numbers.
 * It is now an error to alter data structures that aren't in variables - such as `(set: (a:)'s 1st to 1)` or `(set: (passage:)'s name to "X")` - because doing so accomplishes nothing.
 * Attaching invalid values to hooks, such as `(either:"String")[text]`, `(a:2,3,4)[text]` or `(set: $x to 1) $x[text]`, will now result in an error instead of printing both the value and the hook's contents.
 * Writing a URL in brackets, like `(http://...)`, will no longer be considered an invalid macro call. (To be precise, neither will any macro whose `:` is immediately followed by a `/`, so other protocol URLs are also capable of being written.)

#####Markup

 * Now, if you write `[text]` by itself, it will be treated as a hook, albeit with no name (it cannot be referenced like `?this`) and no attached changer commands. This, I believe, simplfies what square brackets "mean" in passage prose. Incidentally, temporary variables (see below) can be `(set:)` inside nameless unattached hooks without leaking out, so they do have some semantic meaning.
 * Now, you can attach changer macros to nametagged hooks: `(if: true) |moths>[Several moths!]`, for instance, is now valid. However, as with all hooks, trying to attach plain data, such as a number or an array, will cause an error.
 * Hook-attached macros may now have whitespace and line breaks between them and their hooks. This means that `(if: $x)  [text]` and such are now syntactically acceptable - the whitespace is removed, and the macro is treated as if directly attached. (This means that, if after a macro call you have plain passage text that resembles a hook, you'll have to use the verbatim markup to keep it from being interpreted as such.)

#####Code

 * Now, when given expressions such as `$a < 4 and 5`, where `and` or `or` joins a non-boolean value with a comparison operation (`>`, `<=`, `is`, `contains`, etc.), Harlowe will now infer that you meant to write `$a < 4 and it < 5`, and treat the expression as that, instead of producing an error. This also applies to expressions like `$a and $b < 5`, which is inferred to be `5 > $a and it > $b`. This is a somewhat risky addition, but removes a common pitfall for new authors in writing expressions. (Observe that the above change does not apply when `and` or `or` joins a boolean - expressions like `$a < 4 and $visitedBasement`, where the latter variable contains a boolean, will continue to work as usual.)
   * However, this is forbidden with `is not`, because the meaning of expressions like `$a is not 4 and 5`, or `$a is not 4 or 5` is ambiguous in English, and thus error-prone. So, you'll have to write `$a is not 4 and is not 5` as usual.
 * Now, when working with non-positive numbers as computed indexes (such as `$array's (-1)`), Harlowe no longer uses `0` for `last`, `-1` for `2ndlast`, and so forth - instead, `-1` means `last`, `-2` means `2ndlast`, and using `0` produces an error. (So, `"Red"'s (-1)` produces "d", not "e".)
 * Now, you can optionally put 'is' at the start of inequality operators - you can write `$a is < 3` as a more readable alternative to `$a < 3`. Also, `$a is not > 3` can be written as well, which negates the operator (making it behave like `$a is <= 3`).
 * Now, trying to use the following words as operators will result in an error message telling you what the correct operator is: `=>`, `=<`, `gte`, `lte`, `gt`, `lt`, `eq`, `isnot`, `neq`, `are`, `x`.
 * Passage links can now be used as values inside macros - `(set: $x to [[Go down->Cellar]])` is now valid. You may recall that passage links are treated as equivalent to `(link-goto:)` macro calls. As such, `(set: $x to [[Go down->Cellar]])` is treated as identical to `(set: $x to (link-goto:"Go down","Cellar"))`.
 * Revision macros such as `(replace:)`, `(append:)` and `(prepend:)` can now accept multiple values: `(replace:?ape, ?hen)`, for instance, can affect both hooks equally, and `(replace:'red', 'green')` can affect occurrences of either string.
 * Now, adding two `(append:)` or `(prepend:)` macros which target the same hook, such as `(append:?elf) + (append:?elf)`, no longer creates a changer that appends/prepends to that same hook twice.
 * Hook names, even added together, can now be recognised as the same by the `is` operator if they target the same hooks (including sub-elements).
 * The `(move:)` macro now accepts multiple `into` values, like `(put:)`.
 * The `(count:)` macro now accepts multiple data values, and will count the total occurences of every value. For instance, `(count: "AMAZE", "A", "Z")` produces 3.
 * Now, `debug-header` tagged passages are run after `header` tagged passages in debug mode, for consistency with the order of `debug-startup` and `startup`.
 * Link macros like `(link-replace:)` will now produce an error when given an empty string.

#####HTML/CSS

 * The default Harlowe colour scheme is now white text on black, in keeping with SugarCube and Sugarcane, rather than black text on white. The light colour scheme can be reinstated by putting `(enchant: ?page, (text-colour:black)+(background:white))` in a passage with the `header` tag.
 * The `<tw-story>` element is now kept inside whatever element originally enclosed it, instead of being moved to inside `<html>`.
 * Now, the default CSS applies the default Harlowe `font` (Georgia) to the `<tw-story>` element instead of `html` - so, to override it, write CSS `font` properties for `tw-story` (which is what most custom CSS should be altering now) instead of `html` or `body`.
 * Fixed a bug where the "Story stylesheet" `<style>` element was attached between `<head>` and `<body>`. This should have had no obvious effects in any browser, but was untidy anyway.
 * Altered the CSS of `<tw-story>` to use vertical padding instead of vertical margins, and increased the line-height slightly.
 * Altered the CSS of `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>` and `<h6>` elements to have a slightly lower margin-top.
 * Now, `<tw-passage>` elements (that is, passages' HTML elements) have a `tags` attribute containing all of the passage's tags in a space-separated list. This allows such elements to be styled using author CSS, or selected using author Javascript, in a manner similar to Twine 1.4 (but using the `[tags~= ]` selector instead of `[data-tags~= ]`).
 * Removed the CSS directives that reduce the font size based on the player's device width, because this functionality seems to be non-obvious to users, and can interfere with custom CSS in an unpleasant way.
 * Now, hooks and expressions which contain nothing (due to, for instance, having a false `(if:)` attached) will now have `display:none`, so that styling specific to their borders, etc. won't still be visible.

####Additions

#####Markup

 * Added column markup, which is, like aligner markup, a special single-line token indicating that the subsequent text should be separated into columns. They consist of a number of `|` marks, indicating the size of the column relative to the other columns, and a number of `=` marks surrounding it, indicating the size of the column's margins in CSS "em" units (which are about the width of a capital M). Separate each column's text with tokens like `|===` and `==||`, and end them with a final `|==|` token to return to normal page layout.
 * Now, it's possible to attach multiple changers to a single hook by joining them with `+`, even outside of a macro - `(text-style:'bold')+(align:'==>')+$robotFont[Text]` will apply `(text-style:'bold')`, `(align:'==>')` and the changer in the variable $robotFont, as if they had been added together in a single variable. Again, you can put whitespace between them – `(text-style:'bold') + (align:'==>') + $robotFont  [Text]` is equally valid, and causes the whitespace between each changer and the hook itself to be discarded.
 * Now, you can make hooks which are hidden when the passage is initially displayed, to be revealed when a macro (see below) is run. Simply replace the `<` and `>` symbol with a `(` or `)`. For example: `|h)[This hook is hidden]`. (You can think of this as being visually similar to comic speech balloons vs. thought balloons.) This is an alternative to the revision macros, and can be used in situations where the readability of the passage prose is improved by having hidden hooks alongside visible text, rather than separate `(replace:)` hooks. (Of course, the revision macros are still useful in a variety of other situations, including `header` passages.)

#####Code

 * Arrays, strings and datasets now have special data names, `any`, and `all`, which can be used with comparison operators like `contains`, `is` and `<=` to compare every value inside them. For instance, you can now write `(a:1,2,3) contains all of (a:2,3)`, or `any of (a:3,2) <= 2`, or `"Fox" contains any of "aeiou"` (all of which are true). You can't use them anywhere else, though - `(set: all of $a to true)` is an error (and wouldn't be too useful anyway).
 * Now, certain hard-coded hook names will also select elements of the HTML page, letting you style the page using enchantment macros. `?page` selects the page element (to be precise, the `<tw-story>`), `?passage` selects the passage element (to be precise, the `<tw-passage>`), `?sidebar` selects the passage's sidebar containing undo/redo icons (`<tw-sidebar>`), and `?link` selects any links in the passage. (Note that if you use these names for yourself, such as `|passage>[]`, then they will, of course, be included in the selection.)
 * Added temporary variables, a special kind of variable that only exists inside the passage or hook in which they're `(set:)`. Outside of the passage or hook, they disappear. Simply use `_` instead of `$` as the sigil for variables - write `(set: _a to 2)`, `(if: _a > 1)`, etc. Their main purpose is to allow you to make "reusable" Twine code - code which can be pasted into any story, without accidentally overwriting any variables that the story has used. (For instance, suppose you had some code which uses the variable `$a` for some quick computation, but you pasted it into a story that already used `$a` for something else in another passage. If you use a temporary variable `_a` instead, this problem won't occur.)
   * Also note that temp variables that are `(set:)` inside hooks won't affect same-named temp variables outside them: `(set: _a to 1) |hook>[(set: _a to 2)]` will make `_a` be 2 inside the hook, but remain as 1 outside of it.
 * Lambdas are a new data type - they are, essentially, user-created functions. You can just think of them as "data converters" - reusable instructions that convert values into different values, filter them, or join multiple values together. They use temporary variables (which only exist inside the lambda) to hold values while computing them, and this is shown in their syntax. An example is `_a where _a > 2`, which filters out data that's smaller than 2, or `_name via "a " + _name`, which converts values by adding 1 to them. Various new macros use these to easily apply the same conversion to sequences of data.
 * Colour values now have read-only data names: `r`, `g` and `b` produce the red, green and blue components of the colour (from 0 to 255), and `h`, `s` and `l` produce, in order, the hue (in degrees), and the saturation and lightness percentages (from 0 to 1).
 * You can now access sub-elements in hook names, as if they were an array: `(click: ?red's 1st)` will only affect the first such named hook in the passage, for instance, and you can also specify an array of positions, like `?red's (a:1,3,5)`. Unlike arrays, though, you can't access their `length`, nor can you spread them with `...`.
 * You can now add hook names together to affect both at the same time: `(click: ?red + ?blue's 1st)` will affect all hooks tagged `<red|`, as well as the first hook tagged `<blue|`.

#####Macros

 * Added `(undo:)`, a command similar to `(go-to:)` which performs the same function as the undo button in the default sidebar. Use it as an alternative to `(go-to: (history:)'s last)` which forgets the current turn as well as going back.
   * Also added a link shorthand of the above, `(link-undo:)`, which is used similarly to `(link-goto:)`.
 * Added `(for:)`, a command that repeats the attached hook, using a lambda to set a temporary variable to a different value on each repeat. It uses "where" lambdas, and accepts the "each" shorthand for `where true`, which accepts every value. `(for: each _item, ...$array) [You have the _item]` prints "You have the " and the item, for each item in `$array`.
 * Added `(find:)`, which uses a lambda to filter a sequence of values, and place the results in an array. For instance, `(find: _item where _item's 1st is "A", "Arrow", "Shield", "Axe", "Wand")` produces the array `(a: "Arrow", "Axe")`. (This macro is similar to Javascript's `filter()` array method.)
 * Added `(altered:)`, which takes a lambda as its first value, and any number of other values, and uses the lambda to convert the values, placing the results in an array. For instance, `(altered: _material via _material + " Sword", "Iron", "Wood", "Bronze", "Plastic")` will create an array `(a:"Iron Sword", "Wood Sword", "Bronze Sword", "Plastic Sword")`. (This macro is similar to Javascript's `map()` array method.)
 * Added `(all-pass:)`, `(some-pass:)` and `(none-pass:)`, which check if the given values match the lambda, and return `true` or `false`. `(all-pass: _a where _a > 2, 1, 3, 5)` produces `false`, `(some-pass: _a where _a > 2, 1, 3, 5)` produces `true`, and `(none-pass: _a where _a > 2, 1, 3, 5)` produces `false`.
 * Added `(folded:)`, which is used to combine many values into one (a "total"), using a lambda that has a `making` clause. `(folded: _a making _total via _total + "." + _a, "E", "a", "s", "y")` will first set `_total` to "E", then progressively add ".a", ".s", and ".y" to it, thus producing the resulting string, "E.a.s.y".
 * Added `(show:)`, a command to show a hidden named hook (see above). `(show: ?secret)` will show all hidden hooks named `|secret)`. This can also be used to reveal named hooks hidden with `(if:)`, `(else-if:)`, `(else:)` and `(unless:)`.
 * Added `(hidden:)`, which is equivalent to `(if:false)`, and can be used to produce a changer to hide its attached hook.
 * Added the aliases `(dm:)` and `(ds:)` for `(datamap:)` and `(dataset:)`, respectively.
 * Added `(lowercase:)` and `(uppercase:)`, which take a string and convert it to all-lowercase or all-uppercase, as well as `(lowerfirst:)` and `(upperfirst:)`, which only convert the first non-whitespace character in the string and leave the rest untouched.
 * Added `(words:)`, which takes a string and produces an array of the words (that is, the sequences of non-whitespace characters) in it. For instance, `(words: "2 big one's")` produces `(a: "2", "big", "one's")`.
 * Added `(repeated:)`, which creates an array containing the passed values repeated a given number of times. `(repeated: 3, 1,2,0)` produces `(a: 1,2,0,1,2,0,1,2,0)`.
 * Added `(interlaced:)`, which interweaves the values of passed-in arrays. `(interlaced: (a: 'A','B','C','D'),(a: 1,2,3))` is the same as `(a: 'A',1,'B',2,'C',3)`. (For functional programmers, this is just a flat zip.) This can be useful alongside the `(datamap:)` macro.
 * Added `(rgb:)`, `(rgba:)`, `(hsl:)` and `(hsla:)`, which produce colour values, similar to the CSS colour functions. `(rgb:252,180,0)` produces the colour #fcb400, and `(hsl:150,0.2,0.6)` produces the colour #84ad99.
 * Added `(dataentries:)`, which complements `(datanames:)` and `(datavalues:)` by producing, from a datamap, an array of the datamap's name-value pairs. Each pair is a datamap with "name" and "value" data, which can be examined using the lambda macros.
 * Added `(hover-style:)`, which, when given a style-altering changer, like `(hover-style:(text-color:green))`, makes its style only apply when the hook or expression is hovered over with the mouse pointer, and removed when hovering off.
 * Now, you can specify `"none"` as a `(text-style:)` and produce a changer which, when added to other `(text-style:)` combined changers, removes their styles.

###1.2.4 changes:

####Bugfixes

 * `(random:)` now no longer incorrectly errors when given a single whole number instead of two.
 * `(alert:)`, `(open-url:)`, `(reload:)` and `(goto-url:)` now return empty strings rather than the non-Harlowe value `undefined` (or, for `(open-url:)` a Javascript Window object). This differs slightly from 2.0, which returns more useful command values.
 * Additionally, backported the following fixes from 2.0.0:
   * Fixed a bug where comparing a value with an error (such as `2 is (3 + 'X')`) would suppress the error.
   * Fixed a bug where subtracting non-subtractable values (such as booleans) wouldn't produce an error, instead implicitly converting the values to numbers, and potentially producing the Javascript value `NaN`.
   * Fixed the bug where `(current-time:)` wouldn't pad the minutes value with a leading 0 when necessary, and '12' was printed as '0'.

###1.2.3 changes:

####Bugfixes

 * Fixed a bug where the "outline" `(textstyle:)` option didn't have the correct text colour when no background colour was present, making it appear solid black.
 * Fixed a bug where changer commands couldn't be added together more than once without the possibility of some of the added commands being lost.
 * Fixed a bug where `(pow:)` only accepted 1 value instead of 2, and, moreover, that it could return the Javascript value `NaN`, which Harlowe macros shouldn't be able to return.
 * Fixed a bug where the verbatim markup couldn't enclose a `]` inside a hook, a `}` inside the collapsing markup, or any of the formatting markup's closing tokens immediately after an opening token.
 * Fixed a bug where the Javascript in the resulting HTML files contained the Unicode non-character U+FFFE, causing encoding problems when the file is hosted on some older servers.

####Alterations

 * Now, setting changer commands into variables no longer prevents the `(save-game:)` command from working.

###1.2.2 changes:

####Bugfixes

 * Fixed a bug where the `(textstyle:)` options "shudder", "rumble" and "fade-in-out", as well as all of `(transition:)`'s options, didn't work at all.
 * Fixed a long-standing bug where `(mouseover:)` affected elements didn't have a visual indicator that they could be moused-over (a dotted underline).
 * Fixed the `(move:)` macro corrupting past turns (breaking the in-game undo functionality) when it deletes array or datamap items.
 * Fixed the `<===` (left-align) markup token erasing the next syntactic structure to follow it.
 * Fixed a bug where attempting to print datamaps using `(print:)` produced a Javascript error.
 * Fixed a long-standing bug where spreading `...` datasets did not, in fact, arrange their values in sort order, but instead in parameter order.
 * Fixed a long-standing bug where a string containing an unmatched `)` inside a macro would abruptly terminate the macro.

####Alterations

 * Giving an empty string to a macro that affects or alters all occurrences of the string in the passage text, such as `(replace:)` or `(click:)`, will now result in an error (because it otherwise won't affect any part of the passage).

###1.2.1 changes:

####Bugfix

 * Fixed a bug where `(if:)`, `(unless:)` and `(else-if:)` wouldn't correctly interact with subsequent `(else-if:)` and `(else:)` macro calls, breaking them. (Usage with boolean-valued macros such as `(either:)` was not affected.)

###1.2.0 changes:

####Bugfixes

 * Fixed a bug where links created by `(click:)` not having a tabindex, and thus not being selectable with the tab key (a big issue for players who can't use the mouse).
 * Fixed a bug where `(align: "<==")` couldn't be used at all, even inside another aligned hook.
 * Fixed a bug where errors for using changer macros (such as `(link:)`) detached from a hook were not appearing.
 * Fixed a bug where `(align:)` commands didn't have structural equality with each other - `(align:"==>")` didn't equal another `(align:"==>")`.
 * Fixed `(move:)`'s inability to delete items from arrays.
 * `(move: ?a into $a)` will now, after copying their text into `$a`, clear the contents of all `?a` hooks.

####Alterations

 * It is now an error to use `(set:)` or `(put:)` macros, as well as `to` constructs, in expression position: `(set: $a to (set: $b to 1))` is now an error, as is `(set: $a to ($b to 1))`.
 * Now, setting a markup string to a `?hookSet` will cause that markup to be rendered in the hookset, instead of being used as raw text. For instance, `(set: ?hookSet to "//Golly//")` will put "*Golly*" into the hookset, instead of "//Golly//".
    * Also, it is now an error to set a `?hookSet` to a non-string.
 * `(if:)`/`(unless:)`/`(elseif:)`/`(else:)` now evaluate to changer commands, rather than booleans. This means, among other things, that you can now compose them with other changers: `(set: $a to (text-style: "bold") + (if: $audible is true))`, for instance, will create a style that is bold, and also only appears if the $audible variable had, at that time, been true. (Note: Changing the $audible variable afterward will not change the effect of the `$a` style.)

####Additions

 * Now, authors can supply an array of property names to the "'s" and "of" property syntax to obtain a "slice" of the container. For instance, `(a: 'A','B','C')'s (a: 1,2)` will evaluate to a subarray of the first array, containing just 'A' and 'B'.
    * As well as creating subarrays, you can also get a slice of the values in a datamap - in effect, a subarray of the datamap's datavalues. You can do `(datamap:'Hat','Beret','Shoe','Clog','Sock','Long')'s (a: 'Hat','Sock')` to obtain an array `(a: 'Beret','Long')`.
    * Additionally, you can obtain characters from a string - "abcde"'s (a: 2,4) becomes the string "bd". Note that for convenience, slices of strings are also strings, not arrays of characters.
    * Combined with the `(range:)` macro, this essentially obsoletes the `(subarray:)` and `(substring:)` macros. However, those will remain for compatibility reasons for now.
 * `(link-reveal:)` is similar to `(link:)` except that the link text remains in the passage after it's been clicked - a desirable use-case which is now available. The code `(link-reveal:"Sin")[cerity]` features a link that, when clicked, makes the text become `Sincerity`. Note that this currently necessitates that the attached hook always appear after the link element in the text, due to how the attaching syntax works.
 * `(link-repeat:)` is similar to the above as well, but allows the link to be clicked multiple times, rerunning the markup and code within.
 * Also added `(link-replace:)` as an identical alias of the current `(link:)` macro, indicating how it differs from the others.

###1.1.1 changes:

####Bugfixes

 * Fixed a bug where hand-coded `<audio>` elements inside transitioning-in passage elements (including the passage itself) would, when the transition concluded, be briefly detached from the DOM, and thus stop playing.
 * Now, save files should be properly namespaced with each story's unique IFID - stories in the same domain will no longer share save files.
 * Fixed a bug where `(live:)` macros would run one iteration too many when their attached hook triggered a `(goto:)`. Now, `(live:)` macros will always stop once their passage is removed from the DOM.
 * Fixed a bug where `<` and a number, followed by `>`, was interpreted as a HTML tag. In reality, HTML tag names can never begin with numbers.
 * Fixed a bug where backslash-escapes in string literals stopped working (so `"The \"End\""` again produces the string `The "End"`). I don't really like this old method of escaping characters, because it hinders readability and isn't particularly scalable - but I let it be usable in 1.0.1, so it must persist until at least version 2.0.0.
 * Fixed a bug, related to the above, where the link syntax would break if the link text contained double-quote marks - such as `[["Stop her!"->Pursue]]`.

###1.1.0 changes:

####Bugfixes

 * Fixed a bug where the arithmetic operators had the wrong precedence (all using left-to-right).
 * Fixed a somewhat long-standing bug where certain passage elements were improperly given transition attributes during rendering.
 * Fixed a bug where lines of text immediately after bulleted and numbered lists would be mysteriously erased.
 * Now, the `0. ` marker for the numbered list syntax must have at least one space after the `.`. Formerly zero spaces were permitted, causing `0.15` etc. to become a numbered list.
 * Fixed a bug in the heading syntax which caused it to be present in the middle of lines rather than just the beginning.
 * Now, if text markup potentially creates empty HTML elements, these elements are not created.
 * Fixed nested list items in both kinds of list markup. Formerly, writing nested lists (with either bullets or numbers) wouldn't work at all.
 * Fixed a bug where the collapsed syntax wouldn't work for runs of just whitespace.
 * Also, explicit `<br>`s are now generated inside the verbatim syntax, fixing a minor browser issue where the text, when copied, would lack line breaks.
 * Changed the previous scrolling fix so that, in non-stretchtext settings, the page scrolls to the top of the `<tw-story>`'s parent element (which is usually, but not always, `<body>`) instead of `<html>`.
 * Fixed a bug where the (move:) macro didn't work on data structures with compiled properties (i.e. arrays).
 * Now, the error message for NaN computations (such as `(log10: 0)`) is more correct.
 * Now, if `(number:)` fails to convert, it prints an error instead of returning NaN.
 * Now, the error message for incorrect array properties is a bit clearer.
 * Fixed a bug where objects such as `(print:)` commands could be `+`'d (e.g. `(set: $x to (print: "A") + (print: "B"))`), with unfavourable results.
 * `(substring:)` and `(subarray:)` now properly treat negative indices: you can use them in both positions, and in any order. Also, they now display an error if 0 or NaN is given as an index.
 * Fixed a bug where the `2ndlast`, `3rdlast` etc. sequence properties didn't work at all.
 * Fixed a bug where datamaps would not be considered equal by `is`, `is in` or `contains` if they had the same key/value pairs but in a different order. From now on, datamaps should be considered unordered.
 * Fixed the scroll-to-top functionality not working on some versions of Chrome.
 * Now, if the `<tw-storydata>` element has an incorrect startnode attribute, the `<tw-passagedata>` with the lowest pid will be used. This fixes a rare bug with compiled stories.
 * Fixed a `(goto:)` crash caused by having a `(goto:)` in plain passage source instead of inside a hook.
 * Optimised the TwineMarkup lexer a bit, improving passage render times.
 * Now, the style changer commands do not wrap arbitrary HTML around the hooks' elements, but by altering the `<tw-hook>`'s style attribute. This produces flatter DOM trees (admittedly not that big a deal) and has made several macros' behaviour more flexible (for instance, (text-style:"shadow") now properly uses the colour of the text instead of defaulting to black).
 * Now, during every `(set:)` operation on a Harlowe collection such as a datamap or array, the entire collection is cloned and reassigned to that particular moment's variables. Thus, the collection can be rolled back when the undo button is pressed.
 * Fixed some bugs where "its" would sometimes be incorrectly parsed as "it" plus the text "s".
 * Fixed a bug where enchantment event handlers (such as those for `(click:)`) could potentially fail to load.
 * Fixed a bug where the verbatim syntax (backticks) didn't preserve spaces at the front and end of it.

####Alterations

 * Altered the collapsing whitespace syntax (`{` and `}`)'s handling of whitespace considerably.
    * Now, whitespace between multiple invisible elements, like `(set:)` macro calls, should be removed outright and not allowed to accumulate.
    * It can be safely nested inside itself.
    * It will also no longer collapse whitespace inside macros' strings, or HTML tags' attributes.
 * Harlowe strings are now Unicode-aware. Due to JavaScript's use of UCS-2 for string indexing, Unicode astral plane characters (used for most non-Latin scripts) are represented as 2 characters instead of a single character. This issue is now fixed in Harlowe: strings with Unicode astral characters will now have correct indexing, length, and `(substring:)` behaviour.
 * Positional property indices are now case-insensitive - `1ST` is the same as `1st`.
 * `(if:)` now only works when given a boolean - if you had written `(if: $var)` and `$var` is a number or string, you must write `$var is not 0` or `$var's length > 0` instead.
 * `(text:)` now only works on strings, numbers, booleans and arrays, because the other datatypes cannot meaningfully be transformed into text.
 * Now, you can't use the `and`, `or` and `not` operators on non-boolean values (such as `(if: ($a > 4) and 3)`). So, one must explicitly convert said values to boolean using `is not 0` and such instead of assuming it's boolean.
 * Now, division operators (`/` and `%`) will produce an error if used to divide by zero.
 * Reordered the precedence of `contains` - it should now be higher than `is`, so that e.g. `(print: "ABC" contains "A" is true)` should now work as expected.
 * Now, giving a datamap to `(print:)` will cause that macro to print out the datamap in a rough HTML `<table>` structure, showing each name and value. This is a superior alternative to just printing "[object Object]".
 * Now, variables and barename properties (as in `$var's property`) must have one non-numeral in their name. This means that, for instance, `$100` is no longer regarded as a valid variable name, but `$100m` still is.
 * It is now an error if a `(datamap:)` call uses the same key twice: `(datamap: 2, "foo", 2, "bar")` cannot map both "foo" and "bar" to the number 2.
 * Now, datamaps may have numbers as data names: `(datamap: 1, "A")` is now accepted. However, due to their differing types, the number `1` and the string `"1"` are treated as separate names.
   * To waylay confusion, you are not permitted to use a number as a name and then try to use its string equivalent on the same map. For instance, `(datamap: 2, "foo", "2", "bar")` produces an error, as does `(print: (datamap: 2, "foo")'s '2'))`
 * HTML-style comments `<!--` and `-->` can now be nested, unlike in actual HTML.
 * The heading syntax no longer removes trailing `#` characters, or trims terminating whitespace. This brings it more into line with the bulleted and numbered list syntax.
 * Changed `(textstyle:)` and `(transition:)` to produce errors when given incorrect style or transition names.

####New Features

 * Added computed property indexing syntax. Properties on collections can now be accessed via a variant of the possessive syntax: `$a's (expression)`.
    * Using this syntax, you can supply numbers as 1-indexed indices to arrays and strings. So, `"Red"'s $i`, where `$i` is 1, would be the same as `"Red"'s 1st`. Note, however, that if `$i` was the string `"1st"`, it would also work too - but not if it was just the string `"1"`.
 * Links and buttons in compiled stories should now be accessible via the keyboard's Tab and Enter keys. `<tw-link>`, `<tw-icon>` and other clickable elements now have a tabindex attribute, and Harlowe sets up an event handler that allows them to behave as if clicked when the Enter key is pressed.
 * Added 'error explanations', curt sentences which crudely explain the type of error it is, which are visible as fold-downs on each error message.
 * Harlowe now supports single trailing commas in macro calls. `(a: 1, 2,)` is treated the same as `(a: 1,2)`. This is in keeping with JS, which allows trailing commas in array and object literals (but not calls, currently).
 * Added `of` property indexing as a counterpart to possessive(`x's y`) indexing.
    * Now, you can alternatively write `last of $a` instead of `$a's last`, or `passages of $style` instead of `$style's passages`. This is intended to provide a little more flexibility in phrasing/naming collection variables - although whether it succeeds is in question.
    * This syntax should also work with computed indexing (`(1 + 2) of $a`) and `it` indexing (`1st of it`).
 * Added `(savegame:)` and `(loadgame:)`.
    * `(savegame:)` saves the game session's state to the browser's local storage. It takes 2 values: a slot name string (you'll usually just use a string like "A" or "B") and a filename (something descriptive of the current game's state). Example usage: `(savegame: "A", "Beneath the castle catacombs")`.
    * `(savegame:)` currently has a significant **limitation**: it will fail if the story's variables are ever `(set:)` to values which aren't strings, numbers, booleans, arrays, datamaps or datasets. If, for instance, you put a changer command in a variable, like `(set: $fancytext to (font:"Arnold Bocklin"))`, `(savegame:)` would no longer work. I must apologise for this, and hope to eliminate this problem in future versions.
    * `(savegame:)` evaluates to a boolean `true` if it succeeds and `false` if it fails (because the browser's local storage is disabled for some reason). You should write something like `(if: (savegame:"A","At the crossroads") is false)[The game could not be saved!]` to provide the reader with an apology if `(savegame:)` fails.
    * `(loadgame:)` takes one value - a slot name such as that provided to `(savegame:)` - and loads a game from that slot, replacing the current game session entirely. Think of it as a `(goto:)` - if it succeeds, the passage is immediately exited.
    * `(savedgames:)` provides a datamap mapping the names of full save slots to the names of save files contained within. The expression `(savedgames:) contains "Slot name"` will be `true` if that slot name is currently used. The filename of a file in a slot can be displayed thus: `(print: (savedgames:)'s "Slot name")`.
 * `<script>` tags in passage text will now run. However, their behaviour is not well-defined yet - it's unclear even to me what sort of DOM they would have access to.
 * `<style>` tags in passage text can now be used without needing to escape their contents with the verbatim syntax (backticks).
 * Added `(passage:)` - similar to the Twine 1 function, it gives information about the current passage. A datamap, to be precise, containing a `name` string, a `source` string, and a `tags` array of strings. `(print: (passage:)'s name)` prints the name, and so forth.
    * But, providing a string to `(passage:)` will provide information about the passage with that name - `(passage: "Estuary")` provides a datamap of information about the Estuary passage, or an error if it doesn't exist.
 * Added `(css:)` as a 'low-level' solution for styling elements, which is essentially the same as a raw HTML `<span style='...'>` tag, but can be combined with other changer commands. I feel obliged to offer this to provide some CSS-familiar users some access to higher functionality, even though it's not intended for general use in place of `(text-style:)` or whatever.
 * Added `(align:)`, a macro form of the aligner syntax. It accepts a string containing an ASCII arrow of the same type that makes up the syntax ('==>', '=><==', etc). 
 * Added special behaviour for passages tagged with `footer`, `header` or `startup`: their code will be *automatically* `(display:)`ed at the start or end of passages, allowing you to set up code actions (like `(click: ?switch)` etc.) or give passages a textual header. `header` passages are prepended to every passage, `footer` passages are appended; `startup` passages are only prepended to the first passage in the game.
    * Also added debug mode versions of these tags: `debug-header`, `debug-footer` and `debug-startup` are only active during debug mode.
 * Reinstated the Twine 1 escaped line ending syntax: ending a line with `\` will cause it and the line break to be removed.
    * Also, an extra variant has been added: *beginning* a line with `\` will cause it and the previous line break to be removed. The main purpose of this addition is to let you begin multi-line hooks with `[\` and end them with `\]`, letting them fully occupy their own lines.
 * Added `(shuffled:)`, which is identical to `(array:)`, except that it places the provided items in a random order. (You can shuffle an existing array by using the spread syntax, `(shuffled: ...$arr)`, of course.  To avoid errors where the spread syntax is not given, `(shuffled:)` requires two or more arguments.)
 * Added `(sorted:)`, which is similar to `(array:)`, except that it requires string elements, and orders the strings in alphanumeric sort order, rather than the order in which they were provided.
    * Note that this is not strict ASCII order: "A2" is sorted before "A11", and "é" is sorted before "f". However, it still uses English locale comparisons (for instance, in Swedish "ä" is sorted after "z", whereas in English and German it comes before "b"). A means of changing the locale should be provided in the future.
 * Added `(rotated:)`, which takes a number, followed by several values, and rotates the values' positions by the number. For instance, `(rotated: 1, 'Bug','Egg','Bog')` produces the array `(a:'Bog','Bug','Egg')`. Think of it as moving each item to its current position plus the number (so, say, the item in 1st goes to 1 + 1 = 2nd). Its main purpose is to transform arrays, which can be provided using the spread `...` syntax.
 * Added `(datanames:)`, which takes a single datamap, and returns an array containing all of the datamap's names, alphabetised.
 * Added `(datavalues:)`, which takes a single datamap, and returns an array containing all of the datamap's values, alphabetised by their names were.
 * It is now an error to begin a tagged hook (such as `(if:$a)[`) and not have a matching closing `]`.

###1.0.1 changes:

####Bugfixes

* The story stylesheet and Javascript should now be functioning again.
* Fixed a bug where `(display:)`ed passage code wasn't unescaped from its HTML source.
* Fixed a bug preventing pseudo-hooks (strings) being used with macros like `(click:)`. The bug prevented the author from, for instance, writing `(click: "text")` to apply a click macro to every instance of the given text.
* Fixed a bug where string literal escaping (e.g. `'Carl\'s Fate'`) simply didn't work.
* Fixed a bug where quotes can't be used inside the link syntax - `[["Hello"]]` etc. now works again.
* Fixed a markup ambiguity between the link syntax and the hook syntax. This problem primarily broke links nested in hooks, such as `[[[link]]]<tag|`.
* Fixed `(reload:)` and `(gotoURL:)`, which previously errored regardless of input.
* Fixed a bug where assigning from a hookset to a variable, such as `(set: $r to ?l)`, didn't work right.
* Fixed a bug where `(else-if:)` didn't work correctly with successive `(else:)`s.
* Fixed a bug where `<tw-expression>`s' js attrs were incorrectly being unescaped twice, thus causing macro invocations with `<` symbols in it to break.
* Fixed a bug preventing the browser window from scrolling to the top on passage entry.
* Fixed a bug where the header syntax didn't work on the first line of a passage.

####Alterations

* Characters in rendered passages are no longer individually wrapped in `<tw-char>` elements, due to it breaking RTL text. This means CSS that styles individual characters currently cannot be used.
* Eliminated the ability to use property reference outside of macros - you can no longer do `$var's 1st`, etc. in plain passage text, without wrapping a `(print:)` around it.
* You can no longer attach text named properties to arrays using property syntax (e.g. `(set: $a's Garply to "grault")`). Only `1st`, `2ndlast`, etc. are allowed.
* Altered `is`, `is in` and `contains` to use compare-by-value. Now, instead of using JS's compare-by-reference semantics, Harlowe compares containers by value - that is, by checking if their contents are identical. This brings them into alignment with the copy-by-value semantics used by `(set:)` and such.

####New Features

* Added the ability to property-reference arbitrary values, not just variables. This means that you can now use `(history:)'s last`, or `"Red"'s 1st` as expressions, without having to put the entity in a variable first.

###Compilation

Harlowe is a story format file, called `format.js`, which is used by Twine 2. The Twine 2 program bundles this format with authored story code and assets to produce standalone HTML games.

Use these commands to build Harlowe:

* `make`: As the JS files can be run directly in a browser without compilation (as is used by the test suite), this only lints the JS source files and builds the CSS file using `make css`.
* `make jshint`: Lints the JS source files.
* `make css`: Builds the CSS file, `build/harlowe-css.css`, from the Sass sources. This is an intermediate build product whose contents are included in the final `format.js` file. **You need Ruby Sass installed, via the command `gem install sass`, prior to using this.** This is because node-sass doesn't work on my computer for some reason.
* `make docs`: Builds the official documentation file, `dist/harloweDocs.html`, deriving macro and markup definitions from specially-marked comments in the JS files.
* `make format`: Builds the Harlowe `format.js` file.
* `make all`: Builds the Harlowe `format.js` file, the documentation, and an example file, `dist/exampleOutput.html`, which is a standalone game that displays "Success!" when run, to confirm that the story format is capable of being bundled by Twine 2 correctly.
* `make clean`: Deletes the `build` and `dist` directories and their contents.
* `make dirs`: Produces empty `build` and `dist` directories, which usually shouldn't be necessary.
