# Harlowe - the default [Twine 2](https://github.com/klembot/twinejs) story format.

Documentation is at http://twine2.neocities.org/. See below for compilation instructions.

### 3.3.0 changes (unreleased):

#### Bugfixes

 * Fixed a long-standing bug where header passages caused aligner, column, heading, and horizontal rule markup to not work in the first line of any passage of the story.
 * Fixed a long-standing bug where "incomplete" markup in headers, the main passage, or footers could "punch through" and affect anything that came after. For instance, ending a header passage with `[` and placing an unmatched `]` in the main passage would erase the invisible boundary between the header and the main passage, causing things like section-based markup in the header (like aligners or columns) to affect the main passage, even though it shouldn't.
   * Note: for compatibility reasons, I have decided not to fix this same bug when unclosed hooks `[=` are used. So, unclosed hooks in headers, the main passage, or footers will still "punch through" to affect things that appear after. You may use this to re-create this bug's effects in 3.3.0. However, this will be fixed in 4.0.0.
 * Fixed a long-standing bug where hook transitions would often result in only the `<tw-hook>` element's contents being transitioned, not the element itself - and as a result, the hook's contents would be wrapped in a temporary element with `display:block` during the transition, causing a page judder when the transition completed and the element was removed.
 * Fixed a long-standing bug where it was possible to put Harlowe in an infinite loop using `(save-game:)` and `(load-game:)` unconditionally in the same passage.
 * Fixed a long-standing bug where temp variables created outside a live hook (a hook with `(live:)`, `(event:)`, `(more:)`, or `(after:)` attached) couldn't then be used inside it.
 * Most of the other changers, including `(t8n:)`, should now work correctly when combined with `(live:)`, `(event:)`, `(more:)`, or `(after:)`.
 * Fixed a long-standing bug where the string given to `(hook:)` was case-sensitive and dash-sensitive, even though hooks named by the tag markup (`<name|`) and referred to by the hook name syntax (`?name`) are case-insensitive and dash-insensitive.
 * Fixed a long-standing bug where a Javascript error would occur if a string contained `\0` followed by two digits (except 8 or 9).
 * Fixed a custom macro bug where any commands inside an `(output:)`-attached hook (such as `(output:)[(set:$a to it + 1)]`) would be run twice while being outputted. (Generally, you'd want to place those commands before the `(output:)` hook, though.)
 * Fixed a bug where using spread `...` to spread the individual characters of a string that contains astral plane Unicode characters (such as 𝐇) wouldn't work at all.
 * Fixed a bug where the `command` datatype didn't work at all.
 * Fixed a bug where `(output:)`-attached hooks nested inside multiple hooks (such as `(macro: str-type _s,[ [(output:)[_s]]])`) wouldn't have access to temp variables available outside of them (such as `_s` in that same example).
 * Fixed a bug where the `(unpack:)` macro wouldn't work at all unless the destination variables were expressed as typed variables (such as `num-type $a`).
 * Fixed a bug where `(folded:)` couldn't be provided with a lambda which had `where`, `via` and `making` clauses, where the `making` clause was between the `where` and `via` clauses.
 * Now, `(rerun:?passage)` will, as expected, re-run the entire passage's code instead of simply erasing it.
 * `each` lambdas are now called "each…" lambdas (instead of just "where…" lambdas) in the Debug Mode panel.
 * Fixed a bug where using `(append:?Link)` (or one of its relatives) to append text to a hook enchanted with `(click:)` wouldn't work correctly (the text would be placed next to the link instead of inside).
 * Fixed a bug where `(enchant:)`, `(click:)`, and other enchantment macros could enchant empty hooks such as `|A>[]` (wrapping them with `<tw-enchantment>` elements), even though Harlowe usually considers empty hooks to be nonexistent, and hides them with its default CSS.
   * Note: this means that, given constructions like `[]<A|` and `(click:?A)[]`, revision macros like `(append:?Link)` will no longer consider ?A (as long as it is empty) to be a link via the `(click:)`, and cannot append to it - you'll have to explicitly refer to it via `(append:?A)` instead.
 * Fixed a bug where chained `'s` syntax, like `$array's 1st's 2nd`, produced bad error messages when the deepest dataname (in that example, `1st`) wasn't present.
 * Fixed a bug where `'s` and `of` sometimes wouldn't be syntax-highlighted correctly.
 * Improved the behaviour of enchanting a hook's lines when those lines contain macros or links, sometimes causing those elements to be excluded from the enchantment, or falsely considered to be lines on their own.
 * Fixed a bug where `(replace:)` targeting `?passage's lines` (and similar such code) wouldn't replace the line that itself was on, unless some text was before it in the line.
 * The `it` identifier is now cleared (to the default value of 0) whenever the player changes passages.
 * Fixed a bug where using a custom macro in a `(storylet:)` lambda would cause Debug Mode to constantly reload the Storylets and Variables panels, hurting performance.
 * Fixed a bug where single errors would sometimes be listed multiple times in Debug Mode's error log.
 * `(mouseover:)` and `(mouseout:)` enchanted elements (including those enchanted using variants of those macros) now have a tabindex attribute as well.
 * Fixed a bug where scrollable elements in a passage would have their scroll position reset to the top left whenever the passage's or element's transition finished.
 * Fixed a bug where `(lch:)` and all lch-related colour conversions were slightly wrong, due to the conversion algorithm assuming linear-light sRGB instead of gamut sRGB.
 * Fixed a bug where colours created via `(lch:)` could sometimes have `r`, `g` or `b` datavalues higher than 255 or lower than 0.
 * Fixed a bug where `(background:)` didn't work when given a Harlowe colour with fractional `r`, `g`, or `b` datavalues.
 * Checkboxes created by `(checkbox:)` and related macros are better vertically aligned to their text labels.

#### Alterations

##### Performance

 * The low-level macro-running code has been heavily rewritten. Formerly, macro code was internally converted to a syntax tree during passage rendering, then compiled into a string of Javascript, which was then executed using the browser's `eval()` function. Now, the macro syntax tree is simply interpreted and executed as-is, without the intermediary step of assembling a string. This provides performance improvements to both macro and lambda execution, which is important for frequently-called lambda-using macros like `(event:)` and `(storylet:)`. (However, see "Compatibility" below for a caveat regarding this change.)
 * Improved performance of game saving after a very large number of turns have elapsed. This affects both `(save-game:)` and the automatic game state SessionStorage saving feature (introduced in 3.0.0).
 * Formerly, all global variables' contents were saved in game save files as pure Harlowe source code representation. Now, if a value in a variable is considered "pure", it will be saved as an index to the passage prose in which it was originally `(set:)` or `(put:)`, and will be reconstructed from that index when the game is loaded. This should save major localStorage space when a story has loads of stored strings and custom macros.
   * A variable is considered "pure" if its value was changed using a `(set:)` or `(put:)` that did not call any of the following macros or features: `(prompt:)`, `(confirm:)`, `(current-time:)`, `(current-date:)`, `(monthday:)`, `(weekday:)`, `(history:)`, `(passage:)`, `it`, `time`, `visits`, `exits`, or any other variable (*except* typed variable definitions, such as those given to `(macro:)`).
   * Note that code hooks *can* use these inside them and still have the entire hook be considered "pure", as a code hook is comparable to a string, and nothing inside it is called until it is used.
   * Also, number and boolean variables are short enough that saving them as a reference isn't necessary, so they won't be saved as indexes even if they are "pure".
   * Variables changed using `(unpack:)` or `2bind` currently aren't considered "pure".
   * As a consequence of this change, save files from older versions of your story are much more likely to become invalidated whenever you make minor changes to passage prose, so do take note of that.
 * As an additional save file optimisation, global variables holding arrays, datasets or datamaps, whose inner data values have only changed slightly compared to previous turns, will now be saved in a shorter form using the `it` identifier to refer to values which were unchanged. As an example, if a gloval variable contains `(a:(passage:'A1'),(passage:'A2'),(passage:'A3'))` (an array containing 3 large datamaps), and on a subsequent turn it is changed to `(a:(passage:'A2'),(passage:'A3'),"A string")`, then on that turn, it will be serialised as `(a:its 2nd,its 3rd,"A string")`.
   * This optimisation also applies to global variables holding long strings, as long as they have simply been appended or prepended to over multiple turns.
 * Slightly improved performance of changing passages in stories that contain a very large number of passages.
 * Slightly improved performance of rendering and re-rendering hooks.
 * Now, the most recent 16 visited passages (as well as all "header", "footer", "debug-header" and "debug-footer" tagged passages), have their source code's syntax trees cached, to save on rendering time if they're visited or shown by `(display:)` again within 16 turns.
 * `(live:)`, `(event:)` and `(after:)` macros now internally use requestAnimationFrame() instead of setTimeout().

##### Error Messages

 * As an added bonus from rewriting the macro-running code (see above), the "Javascript error message" has been completely removed, and a proper Harlowe error message will appear in all cases from now on. This eliminates various highly misleading error messages, such as `missing ] after element list`, and replaces them with something more understandable.
 * Various other error messages have had their wording altered to be a bit more specific.

##### Coding

 * Now, macros and variables in "changer position" (directly in front of a hook with only whitespace between) will no longer cause an error if they do not produce changers, booleans or commands. Instead, these values will be printed directly, as usual. This restriction was originally in Harlowe in order to protect against typos of variable names or macro names when intending to insert a changer. However, I've since decided that other error-prevention measures in the editor/syntax highlighter/Debug Mode ought to be used instead, given that this restriction tended to force authors to tediously wrap various expressions in `(print:)` calls to avoid them becoming attached.
 * Code hooks can now be stored in variables and printed in the passage. This means that instead of storing long strings containing large amounts of markup that doesn't get highlighted in the syntax highlighter, you can instead store code hooks. Using a code hook in this way also signals (to anyone reading the code) what its purpose is for (to be displayed in the passage).
 * `(dialog:)`, `(confirm:)`, `(prompt:)`, `(replace-with:)`, `(append-with:)` and `(prepend-with)` have been altered to permit code hooks in place of the message string value.
 * Also, code hooks can be converted into strings using `(str:)`.
 * `true` and `false` are now case-insensitive. This fixes an inconsistency between the syntax highlighter (which until now showed different-cased keywords like `TRUE` and `FALSE` as valid) as well as fixes an inconsistency with other keywords, such as datatypes (which were already case-insensitive, such as `INT`).
 * `(shuffled:)` and `(sorted:)` now accept 1 or 0 values without causing an error. This is to make it easier to sort or shuffle arrays (by spreading `...` them into these macros) without needing to care how many items the arrays contain.
 * `(sorted:)` may now accept any kind of data (not just strings and numbers) and may now be given an optional 'via' lambda, which is used to translate the values into strings or numbers, whereupon they are sorted *as if* they were those translated values. This can be used to sort values in a broad variety of ways. `(sorted: via its name, ...$creatures)` sorts the datamaps in the array stored in $creatures by their "name" values, for instance.
 * You may now give one or zero values after the rotation number to `(rotated:)` - for instance, `(rotated: 2, ...$arr)` will no longer make an error if $arr is empty.
   * Similarly, you may now give one value to `(rotated-to:)` after the lambda, instead of a minimum of two - however, if the given lambda doesn't match it, then an error will still result.
 * Instead of producing an error, `(undo:)` and `(link-undo:)` now take an optional second string, similar to `(link-storylet:)`, which is shown instead of the link if undos aren't available.
 * `(source:)`, `(v6m-source:)` and Debug Mode now represent built-in Harlowe colours (`yellow`, `blue` etc.) as their keywords, rather than a `(hsl:)` macro call.
 * It is now an error to give two or more typed variables with the same name inside a `(p:)` string pattern (used as an `(unpack:)` destination or in another such macro).
 * It is now an error to give `?page` to `(show:)`, `(hide:)`, or `(rerun:)`.
 * `(mouseover:)`, `(mouseout:)` and all other macros beginning with "mouse" are now deprecated. I've decided that having so many variations of (click:) and its relatives, differing only by interaction type, is a bit untidy and unnecessary. I've now created an `(action:)` macro (see below) which can given as a changer to the appropriate "click" macro to replicate these macros' effects.
 * The `any` data name (available on arrays as `any of (a:1,2)` and strings as `any of "ab"`) has been renamed to `some`, to avoid confusion with the `any` datatype and for naming consistency with `(some-pass:)`. `any` remains as a deprecated alias for compatibility, but is likely to be removed in a future version.

##### Compatibility

 * A minor (3.x) version increase usually shouldn't have significant incompatibilities with existing code, but there is something I must mention: arbitrary Javascript syntax embedded in Harlowe macro calls is no longer permitted, and will produce an error. This includes stuff like `(if: (document.title = "Wowie") is 1)[]` (which does nothing except change the window title to "Wowie") or writing `(set: $a = 1)` instead of `(set: $a to 1)`. This was a necessary sacrifice as a result of the aforementioned macro code rewrite. Since these were never part of the Harlowe language description, and were essentially undefined behaviour, I feel that it's fine to remove it in a "minor" version - however, this could inconvenience numerous people, which is why I'd avoided implementing this for so long. If you personally had been using this "feature" for purposes that Harlowe's macros can't fulfill, please post a [bug report](https://foss.heptapod.net/games/harlowe/-/issues) describing it, and I'll see what I can do about adding a macro or some other feature to support it.
   * Furthermore, as a result of the implementation of both this and `(seed:)` (see below), random macros will no longer produce different "rolls" when the player uses Undo to return to a previous turn - instead, the exact same roll that occurred on that turn will happen again. While this may be welcomed as a desired feature (in that it makes the Undo feature more intuitive in its behaviour), it may impact certain niche uses of these macros, so do take care.
 * Due to the change to `<script>` elements inside passages (below), the run time of `<script>` elements has been changed to line up with Harlowe macros and hooks. A `<script>` element's code will now run as soon as it appears in the passage, instead of waiting until after every other macro and expression has run (as it did in 3.2.0 and below). Because the run time of `<script>` elements was *also* never part of the Harlowe language description, I feel fine altering this as well, but if you were relying on that specific run time, consider wrapping your code in a `setTimeout` callback or a `$()` callback.

##### Debug Mode

 * Debug Mode's colour scheme is now white-on-black, to match Harlowe's default colour scheme. You may use the new options panel (see below) to change it back to white.
 * Very long lines in "(source:)" listings in the Variables panel should no longer push the other columns far offscreen.
 * Debug Mode no longer automatically, immediately enables itself whenever the first error of your story appears. Instead, this functionality can be added using the new `(after-error:)` and `(debug:)` macros (see below).

##### Syntax highlighter

 * The green line marking whitespace before hooks that's removed by changer attachment (added in 3.2.0) has been removed, due to the possibility of false positives when using non-changer variables in position (which is no longer an error, as mentioned above).
 * Tooltips (if enabled) now dismiss themselves if you move the mouse cursor a bit.

#### Additions

##### Markup

 * HTML `<script>` elements inside passages can now access Harlowe variables and temp variables - simply use the name of the variable as if it was a Javascript variable, such as by `(set: _foo to 9)<script>_foo += 4;</script>`. However, only variables containing certain data types can be accessed in `<script>` elements - numbers, booleans, strings, datamaps, datasets and arrays. Moreover, the latter three data structures can't contain any data types other than those aforementioned. Attempting to assign Javascript values to Harlowe variables that don't match any of those data types will cause an error. Note that this change *only* applies to `<script>` elements without a "src" attribute - Harlowe variables are still inaccessible to included Javascript files. As always, consult the documentation for more details.

##### Coding & Macros

 * Added `(str-replaced:)` (also known as `(replaced:)`, although that name may cause confusion with `(replace:)` if you don't understand Harlowe's convention of nouns/present tense for changers and adjectives/past tense for data macros), which allows you to find and replace sub-strings in a given string. This can take simple strings as the search and replacement patterns, but can also take `(p:)` patterns and string datatypes as the search pattern, as well as "via" lambdas as the replacement. `(str-replaced: (p: (p-many:digit)-type _a, "%"), via _a + " percent", "5% 10%")` produces `"5 percent 10 percent"`. Also, an optional non-negative whole number can be given as the first value, to limit how many replacements are made.
 * Added `(p-not-before:)`, a string pattern macro which can be used to add a further restriction to the previous match (inside a `(p:)` or other such macro). It matches an empty string (that is, zero characters at that position), *unless* the given string pattern appears after that position.
 * Added `(mix:)` a macro which mixes two colours in the given proportions, using a different algorithm to that used when the `+` operator mixes two colours. This algorithm, which is based on the LCH colourspace used by `(lch:)`, compensates for differences in alpha between the two colours and generally preserves chromaticity much better.
 * Added `(visited:)`, which, when given a passage name or a 'where' lambda (similar to `(history:)`), returns true if a matching passage has ever been visited and false if it hasn't. I suppose you're wondering why a macro for such a common idiom has only been introduced now instead of in 1.x. The answer is that prior to 3.2.0, I kept a firm guideline (barring very old exceptions like `(put:)`) to not needlessly introduce highly specific macros whose functionality could be replicated with a relatively short idiomatic use of a more general macro (this is also why `(live:)` was the only "live" macro until 3.0.0.) However, I've now grown to regret this direction, and appreciate that even "relatively short" idioms have room for improvement (which is why `(after:)` was added in 3.2.0). In that spirit, this macro is now available.
 * Added `(action:)`, a macro that, like `(button:)`, is only attached to links or given to `(link:)` or `(click:)` macros. `(action:'mouseover')` changes the link(s) so that they appear and function identically to `(mouseover:)` areas, and the same with `(action:'mouseout')` and `(mouseout:)`. This finally allows every other link macro to access the mouseover and mouseout interaction styles. There is also a new `(action:'doubleclick')` interaction style available.
 * Added `(click-rerun:)`, a variant of `(click:)` which lets the enchanted element be clicked multiple times to re-run the attached hook. This does not have a mouseover or mouseout equivalent.
 * Added an alias for `(link-reveal:)`, `(link-append:)`, which exists mainly to clarify the relationship between it and `(link:)` - while `(link:)` replaces the link with the attached hook, `(link-append:)` appends the hook to the link's text. (A lot of macro aliases mainly exist to aid in learning, and you are under no obligation to use them.)
 * Added `(digit-format:)`, a macro which converts a number to a string using a special customised format that allows for thousands separators and mandatory zeros.
 * Added `(unique:)`, a macro which produces an array containing the unique values in the given sequence, while preserving the order of the values. `(unique:7,6,6,5,4,5)` produces `(a:7,6,5,4)`. Formerly, you could produce the unique values of an array using `(a: ...(ds: ...$arr))`, but this wouldn't preserve the order of values in the array.
 * Added `(partial:)`, a macro which produces a custom macro that, when called, calls a given other macro (either another custom macro, or the string name of a built-in macro) with certain pre-filled values, followed by the other given values. Think of `(partial:)` as creating a *partial macro call* - one that isn't finished, but which can be used to make finished calls to that macro, by providing the remaining values. `(set: $nextLink to (partial:"link-goto","==>"))` sets `$nextLink` to a custom macro which calls `(link-goto:)` with "==>" as the first value. `($nextLink:"Laundry")` would thus be the same as `(link-goto:"==>","Laundry")`.
 * Added `(seed:)`, a command macro used to seed the pseudo-random number generator used for `(random:)`, `(either:)`, `(shuffled:)`, `'s random`, and `random of`. Pass a string to it, such as by `(seed:"AAA")`, and random macros and features from then on will be predetermined based on that seed. The seed is also automatically saved using `(save-game:)` and loaded using `(load-game:)`. This finally brings Harlowe closer into line with the other built-in formats regarding random number generator seeding.
 * Added `(scroll:)`, a command macro which can change the scroll position of the given hook (assuming it is scrollable, such as ?page or a (box:)-attached hook) by either a given fraction of its internal height, or to make another hook inside them become visible.
 * Added `(redirect:)`, a variant of `(go-to:)` which doesn't create a new turn, and instead extends the current turn, but still performing the same actions as `(go-to:)` - transitioning passages out and in, removing temp variables, rendering the header and footer, adding a passage name to the `(history:)` array, and so forth. This precludes a problem with `(go-to:)`, where using it bare in a passage will prevent the player from using the undo feature to unwind past it, as returning to that turn will cause it to immediately create a new turn. Because this is intended for actions which don't represent narrative time advancing, there isn't any plan to add link and click counterparts for this.
 * Added the `turns` keyword, which evaluates to the number of turns the player has taken. Because the addition of `(redirect:)` means that `(history:)'s length` is no longer a reliable means of measuring the number of turns taken, this keyword is functionally necessary in addition to being a convenient shorthand.
 * Added `(mock-turns:)`, a debug-only macro for artificially increasing the value that `turns` produces.
 * Added `(forget-undos:)`, a macro that removes turns from the "undo cache", preventing the player from undoing to that point ever again. `(forget-undos:-2)` forgets all but the last two turns (including the current turn). `(forget-undos:2)` erases the first two turns. This does *not* affect `(history:)`, `(visited:)`, or the `visits` and `turns` keywords, which will continue to behave as if `(forget-undos:)` was never used.
   * Using this to erase the entire undo cache will automatically cause `(link-undo:)` links to update themselves using their optional second string.
 * Added `(forget-visits:)`, a macro that causes Harlowe to "forget" passage visits before the specified turn number, affecting `(history:)`, `(visited:)` and the `visits` identifier. `(forget-visits:-15)` causes all passage visits older than 15 turns to be forgotten. When combined with `(forget-undos:)`, this lets you erase the two kinds of non-variable data that Harlowe stores as part of the game state and saves in browser localStorage.
 * Added `(after-error:)`, a variant of `(after:)` which only displays the attached hook when an error message is displayed. You may use this (in a "header" tagged passage) to show a personalised message to the story's players, possibly advising them to report a bug. Or, you might use this to try and recover the story by redirecting to another passage.
 * Added `(debug:)`, a command which causes Debug Mode to activate (or reactivate if it was exited), even if the story wasn't a test build initially.
 * Added the `codehook` datatype.
 * The `(text-style:)` styles "tall" and "flat" have been added, which stretch or squash the text vertically.
 * The formerly (since Harlowe 1.0) undocumented use of the `-` operator with two strings, which removes all occurrences of the right string from the left, is now documented and "official". This is similar to using the `-` operator with two arrays.

##### Debug Mode

 * A new Debug Mode options panel has been added, letting you set a few options for Debug Mode's display and behaviour. These options are saved in browser localStorage in a story-specific slot, so they should persist across debugging sessions for your story.
 * The new Debug Mode options panel also lets you toggle a new feature that turns the entire panel transparent when the mouse cursor isn't hovering on it, letting you see the whole page better.
 * Added a "replay" feature to Debug Mode. When you use Debug View, special 🔍 icons will appear on variables and macro calls in the passage. Clicking those will produce a dialog showing a step-by-step view of how the macro call's code was interpreted by Harlowe.
 * Variable panel values have more detailed descriptions - for instance, `(a:)` is called "an empty array", and `(a: "Weather the storm", "Search for shelter")` is called "an array (with the string "Weather the storm", and 1 other item)" instead of both being just "an array".
 * The width of the Debug Mode element (which you can adjust using the resizer added in 3.2.0) is now saved in localStorage alongside these options, and should also persist across debugging sessions.
 * Columns in Debug Mode panels can now be sorted by clicking the column headers, as is typical of many apps with columnar data. The columns will remain sorted as the data changes. The Storylet panel is also sorted (placing open storylets first) by default.
 * The source code in the Source, Variables and Storylet panels is now syntax-highlighted, in a manner roughly matching its highlighting in the Twine editor.
 * The Source panel now shows the header and footer passages' source code as well, in separate fold-down sections.
 * Added an additional draggable area to to the top of each panel which, when clicked and dragged, lets you resize each panel vertically. (Panels can't be resized larger than their content.)
 * Added a "Clear this panel" button to the Errors panel, which, when clicked, removes all of the recorded errors.
 * Added a close button to the panel, which exits Debug Mode when clicked.

##### Other

 * Added a Find/Replace panel to the editor toolbar.
 * Added a HTML comments button to the editor toolbar, which wraps the selected text in HTML comments.

### 3.2.3 changes (October 22, 2021):

#### Bugfixes

 * Fixed a long-standing bug where passage elements added by header or footer tagged passages would have a HTML title attribute indicated the included passage's name.
 * Fixed a bug where `(box:)` and `(float-box:)`'s default interior padding was wrong in Chrome (but not Firefox).
 * Fixed a bug where `(after:)` would stop working (the hook wouldn't appear) when the mouse was clicked or a key was pressed, and the optional second value wasn't provided.
 * Fixed a bug where `(click:?page)` would suppress a gradient background applied to ?Page via `(enchant:)` or `(change:)`.
 * Fixed an incorrectly-worded error message resulting from a data name containing an error (such as `$a's (a: 1 to 2)`, which is invalid syntax).
 * Fixed a bug where Harlowe attempting to generate certain error messages would instead cause an unrelated Javascript error to occur.
 * Fixed a Javascript bug that resulted when using `(load-game:)` to load a saved game that had previously used `(mock-visits:)` in Debug Mode.
 * Fixed a bug where a Javascript error would be produced when 0 was used in a substring or subarray data name, such as `$a's (range:0,2)`. Now, a proper error message will be given.
 * Fixed a long-standing bug where a string containing \ followed by a newline would result in the newline transforming into the letter "n".
 * Debug Mode: fixed a bug where values in the Variables pane would sometimes be truncated incorrectly, causing partial HTML entities like "&am…" to appear.
 * Debug Mode: fixed a bug where the variable source rows revealed by the `(source:)` button would abruptly close whenever another entry in one of the panels was updated.

#### Alterations

 * Certain kinds of intense substring or subarray data names, such as `$a's (range:1,65535)`, have had their runtime performance improved.
 * Links (created by `(link:)` and related macros) now work inside `(dialog:)`, `(prompt:)` and `(confirm:)`'s body prose. Note that enchantments and interaction macros such as `(click:)` continue to not affect prose inside dialog boxes.
 * Made the syntax colour of the lambda keywords (`where`, `when`, `via`, `each` and `making`) slightly brighter.
 * `(mock-visits:)` effects are now saved using `(save-game:)` in Debug Mode.
 * Added `newline` as an alias for the `linebreak` datatype. (Some parts of the documentation previously erroneously used the former instead of the latter.)
 * Editor: disabled the "overwrite" input mode that was toggled by pressing Insert, because I've decided it's too confusing and easy to activate accidentally.
 * Improved the performance of Debug Mode's panels when updating individual entries.
 * Debug Mode: The 'Errors' tab now changes colour when the first error has occurred in the story.

### 3.2.2 changes (May 12, 2021):

#### Bugfixes

 * Fixed a bug where custom macros stored in story-wide variables wouldn't be preserved when reloading the page in the browser (restoring the game state using session storage) and would instead become erroneous data.
 * Fixed a long-standing bug where line breaks couldn't be used as whitespace around operators. For instance, `(print: 2`, a line break, then `is > 1)` would cause an error instead of being treated as `(print: 2 is > 1)`.
 * Fixed a long-standing bug where combined changers weren't being properly copied, and adding more changers to them would mutate variables that were storing that changer.
 * Fixed a bug where `bind` and `2bind` wouldn't work properly when used to bind a data structure's data name (such as `bind $list's 1st`).
 * Fixed a bug where error messages would incorrectly call custom macros' parameters "a number" even if that parameter was restricted to something else.
 * Fixed a code generation bug in the "The passage ___ was visited" option of the "If" pane of the editor toolbar.
 * Fixed a bug where custom macros couldn't call other custom macros if the other macro's `(output:)` or `(output-hook:)` was inside a nested hook, such as an `(if:)` hook.
 * Fixed a bug where `(icon-restart:)` didn't restart the story when clicked.
 * Fixed a bug where, upon supplying a label string to `(meter:)`, any updates to the meter would cause that label to gain any styles, such as `(border:)` borders, that had been given to the meter itself.
 * Fixed a bug where `(input-box:)` crashed upon the first inputted character if you didn't supply the optional bound variable.
 * Fixed a bug where `(p-not:)` would not work correctly when given built-in datatypes like `alnum` or `digit`.
 * Fixed a bug where the startup error dialog box (that reports certain kinds of Javascript errors) wouldn't appear.
 * Fixed a bug where `(line-style:)`, `(enchant-in:)`, `(link-style:)` and `(char-style:)` did not work when used in an `(enchant:)` or `(change:)`. (However, they currently still don't work when created by a `via` lambda given to those command macros).
 * Fixed a bug where giving a blank string as the Cancel button's label to `(prompt:)` or `(confirm:)` wouldn't cause the Cancel button to disappear.
 * Fixed a bug where `(link-rerun:)` behaved like `(link-repeat:)` when it was enchanted by `(enchant:)`.
 * Fixed a bug where error messages would sometimes refer to temp variables named "all" as "all values of the temporary variables". The same applies to "any", "start", and "end".
 * Fixed a bug where `(text-rotate-x:)`, `(text-rotate-y:)` and `(text-rotate:)` couldn't be added together to produce a combined rotation.
 * Fixed a long-standing bug where clicking passage links would activate `(click:?Page)` macros in the arrival passage.
 * Fixed a bug where hidden hooks and the `(hidden:)` changer would suppress the effects of `(hook:)`.
 * Fixed a bug where `...array-type` parameters to custom macros would unwittingly "flatten" the passed-in arrays, joining them all together.
 * Now, dataset data should be displayed correctly in the Variables panel in Debug Mode.

#### Alterations

 * Now, temp variables in custom macro calls are no longer listed in the Variables panel in Debug Mode, due to the resulting clutter when many custom macros are used in a passage.

### 3.2.1 changes (Jan 18, 2021):

#### Bugfixes

 * Fixed a bug where the effects of `(enchant:)` were temporarily suppressed whenever a `(dialog:)`, `(prompt:)` or `(confirm:)` was run at roughly the same time.
 * Fixed a bug where, when a transition finished, if the browser experienced lag due to a large number of other elements being present, the transitioning element's `visibility` could become `hidden` briefly before Harlowe removed the transition CSS from it.
 * Fixed a bug where Instant macros (`(set:)`, `(put:)`, `(move:)` and `(unpack:)`) would pollute the browser console with errors when Debug Mode was off.
 * Fixed a bug where Debug Mode's Enchantments panels' headers were being drawn incorrectly in Chrome.
 * Greatly improved the performance of Debug Mode's panels, reducing lag caused by a large number of entries being added to a panel at once.

### 3.2.0 changes (Jan 4, 2021):

#### Bugfixes

 * The bulleted list, numbered list and heading markup has been fixed to permit multi-line markup (such as multi-line hooks) within it. So, among other things, hooks' opening `[` and closing `]` can now be on the same line as a bulleted list item, numbered list item, or heading.
 * Fixed a long-standing bug involving the interaction between temp variables and the `(show:)` and `(link-show:)` macros. The previous behaviour, which was not my intention at all, meant that hooks shown with `(show:)` could only access temp variables available at the `(show:)` macro's location, rather than the hook's location (which is now the current behaviour). The same applies to `(link-show:)`, as well as to the new `(rerun:)` macro (below).
 * Fixed a long-standing bug where continuous ranges for arrays, such as `(a: 1,2)'s 4thlasttolast`, wouldn't work correctly. (What that example should do is provide the entire array, as is consistent with Python.)
 * Fixed a long-standing bug where `(click: ?Passage)` and `(click: ?Sidebar)` just flat-out didn't work at all.
 * Fixed a long-standing bug where, due to an operator precedence conflict, writing something like `$a's stops's (1)` would cause a Javascript error.
 * Fixed a long-standing bug where lambdas would produce an incorrect duplicate-name error if the temp variables used with their clauses contained capital letters.
 * Fixed a long-standing bug where hooks that had `(transition:)` transitions would restart their transition animations whenever the containing passage finished transitioning in. Previously, the only way to overcome this was to make the passage transition using `(transition-arrive:"instant")`.
 * Fixed a long-standing bug where you couldn't use the column markup to create empty columns by placing two column markup lines in succession, without an intervening blank line.
 * Fixed a long-standing bug where strings containing HookName syntax (such as `"?pear"`) were considered identical to actual hooknames (such as `?pear`). This was NOT intended behaviour and was not documented, and as such, certain design patterns that involved constructing HookName strings programmatically (such as `(replace:"?" + $name)`) will no longer work. A new macro, `(hooks-named:)`, has been added (see below) to provide this feature officially.
 * Fixed a bug where the default CSS for `(click: ?Page)` (a blue border around the page) wasn't visible. (Now, an `::after` pseudo-element is created for the enchantment, so that the border displays above all the page content.)
 * Fixed a bug where typing `is not an` instead of `is not a` (such as in `$wallet is not an array`) would cause an error.
 * Now, trying to access the `0th` or `0thlast` value in an array or string produces an error.
 * Now, `(mouseover:)` and `(mouseout:)` should work correctly with ?Page, ?Passage, and ?Sidebar.
 * Now, `(hook:)` works correctly when given to `(enchant:)`.
 * Fixed a bug where `(for:)` would emit infinite loop errors if 50 or more elements were given to it.
 * Fixed a long-standing bug where clicking the sidebar "undo" and "redo" icons would cause `(click:?Page)` in the preceding or following passages to automatically fire, even though you didn't actually click them.
 * Fixed a long-standing bug where block elements (like `(align:)` enchanted hooks) weren't transitioning in correctly when their passage appeared.
 * Significantly improved the performance of macros like `(enchant:)` and `(click:)` when they target a hook's `chars` or `lines`, such as by `(enchant: ?passage's hooks, $changer)`.
 * Fixed a bug where an `(enchant:)` given `?passage's chars` would crash Harlowe if the passage began with whitespace characters.
 * Fixed a bug where `(enchant:)` given a link changer such as `(link:)` or `(click:)` would cause a Javascript error. It now causes no error, but it does nothing. (The documentation that formerly cited this as an example usage has been changed.)
 * Fixed a bug where `(enchant:)` given `?passage's lines` would crash Harlowe if the passage contained zero line breaks.
 * Fixed a bug where `(enchant:)` given `?passage's lines` would often cause text nodes within lines, such as the text of a `(link:)` link, to be transplanted out of any elements containing them.
 * Fixed a bug where `(hover-style:)` combined with a link changer such as `(link:)` would cause the specified hover style, after the link was clicked, to permanently persist on the hook.
 * Fixed a bug where `(hover-style:)` couldn't actually override the default hover colour for links of any kind, due to a CSS conflict.
 * Fixed a bug where certain changers, like `(for:)`, caused a crash when attached to a command (like a `(print:)` macro, or a passage link).
 * Fixed a bug where closing an `(alert:)`, `(confirm:)` or `(prompt:)` dialog box when there was an `(event:)` hook in the passage would cause a crash.
 * Fixed a bug where revision changers like `(replace:)`, as well as `(enchant:)`, could affect text inside transitioning-out passages (including the passage itself, with `?passage`), which was noticeable when `(t8n-depart:)` was used with a passage link and the incoming passage contained one of those macros.
 * Fixed a bug where trying to use datanames with certain unusual types of data (changers, commands, datatypes) would give a bad Javascript error message instead of the intended error message.
 * Fixed a bug where the CSS used to position the new pure HTML dialogs didn't work on certain old browser versions.
 * Now, consecutive line breaks (which Harlowe reduces the cumulative height of) at the start of a passage are no longer the wrong height while that passage transitions in. (To handle this, consecutive line breaks are now made into `<tw-consecutive-br>` elements instead of `<br data-cons>` elements.)
 * Now, `(dropdown:)` explicitly uses the background of its containing hook, instead of being transparent, which the Windows version of Chrome displays as white, regardless of text colour.
 * Now, align, horizontal rule, and column syntax in the editor no longer occupies two lines unexpectedly.
 * `(save-game:)` can now save a greater range of variable data. Formerly, only changers, arrays, datamaps, datasets, booleans, strings and numbers could be stored in variables when you use `(save-game:)` - other values, such as commands, colours, gradients, or lambdas, would cause an error. Now, it should work with every kind of supported Harlowe value (i.e. those mentioned in the documentation) except user-created commands created with `(output:)` (see below). But, this means that save data from stories made in 3.1.0 is no longer compatible with 3.2.0.
 * Improved an error message that could appear if you erroneously put the spread `...` syntax inside parentheses, such as `(...$arr)`.
 * Altered the error message that appears when you don't give macros "enough values", which wouldn't properly exclude optional values.
 * Fixed some error messages involving accessing an invalid data value of a string, which would refer to the string as "an array".
 * Fixed a long-standing bug that caused error messages for certain invalid operators (such as unsupported SugarCube operators) to be replaced with an incorrect message.
 * Fixed a couple of crashes under Internet Explorer 10.

#### Alterations

 * With great humility, I've decided to change the behaviour regarding how temp variables interact with nested hooks. Formerly, temp variables created in an outer hook (or the outermost level of the passage) could be accessed in inner hooks, they couldn't be directly modified, because `(set:)`, `(put:)` and `(move:)` would instead create identically-named inner variables specific to that hook. I had originally planned to add a special kind of syntax to let inner hooks modify outer hooks' temp variables, such as `outer _a` – but, I've since accepted that this behaviour is too close to people's intuitions to require extra syntax to enable, and the existing behaviour too restrictive, especially regarding its interaction with `(if:)`. So now, using `(set:)` on a temp variable in a nested hook which shares a name with an outer temp variable will instead modify the outer temp variable. This change brings Harlowe temp variables closer in behaviour to SugarCube's temp variables – though, since SugarCube doesn't have a notion of "hooks", the notion of temp variables only being accessible in the hook in which they were first set is still unique to Harlowe.
   * It should be noted that the behaviour of `(for:)`'s temp variables is unchanged - this change will still leave any same-named temp variables outside of the hook unaltered by whatever happens inside the hook.
 * For a long time, the interaction between `(link:)` (as well as `(link-reveal:)` and `(link-repeat:)`) and other changers combined with it has been terribly inconsistent, with some changers applying to just the link, others to just the revealed hook, and most of them applying to both. I've decided after much heart-rending that I need to change this to a single hard-and-fast rule: changers combined with `(link:)` (and the others) will only apply to the revealed hook, NOT the link. This is to allow `(t8n:)`, `(box:)`, `(live:)` and other hook-specific changers to interact with `(link:)` as expected, and also to make `(link:)` links more consistent with `(click:)` links.
   * This also means that some unusual combinations of `(link:)` have different, more intuitive behaviour. For instance, combining `(link:)` with itself (such as by `(link:"A")+(link:"B")`) causes the first link to reveal the second link, which then, when clicked, reveals the attached hook. Also, `(for:)` combined with `(link:)` will now repeat the hook for the correct number of iterations.
 * Due to the above alteration, the link changers `(link:)`, `(link-reveal:)` and `(link-repeat:)` (as well as the `(click:)`, `(mouseover:)` and `(mouseout:)` changers) now accept an optional changer as their second value. This is used to style just the link, leaving the revealed hook unchanged.
 * The behaviour of `(text-colour:)` regarding links has been changed. Formerly, `(text-colour:)` couldn't change the colour of links inside hooks unless it was used with `(enchant:)` and wasn't used with `?passage` or `?page`. This meant that changing the colour of individual links was, unintuitively, not possible without `(enchant:)`. Now, a simpler rule is in place: `(text-colour:)` will always change links' colours, unless it's used with `(enchant: ?passage)` or `(enchant:?page)`. (This exception means that all of `(enchant:)`'s behaviour is unchanged with this release.)
 * The behaviour for multiple `(click:)` macros affecting the same hook (such as in `|A>[B] (click: ?A)[1] (click: ?A)[2]`) has changed to be slightly more intuitive: formerly, as you clicked the hook, the last `(click:)` would activate first (so, `[2]` then `[1]`). Now, they activate from first to last. This also applies to `(mouseover:)` and `(mouseout:)`.
 * Now, the text input box in `(prompt:)` is wider, and is auto-focused when the dialog appears, allowing the player to type into it without having to click it.
 * `(hook:)` now gives an error if it's given an empty string.
 * Commands are now considered equal by `is` and other operators if they have identical data values given to them. So, for instance, `(print: "34") is (print:"34")` will now produce `true`.
 * Now, `contains`, `is in` and `is not in` will emit an error if it's used to check if a string contains a non-string value, such as a number or boolean. This brings it into consistency with a few other operations, like trying to set a string's `1st` to something other than a single character.
 * Slightly altered the behaviour of `matches` when both sides are datatypes - now, identical datatypes will match each other, instead of only matching if one side is `datatype`.
 * The `(str-repeated:)` and `(repeated:)` macros now no longer error if the given number of repetitions is 0. (They will return empty strings and arrays, respectively.)
 * Now, `?hook's links` will contain the hook itself, if it's a link, or has been given a link changer or enchantment.
 * Now, pressing Return or Enter in a `(prompt:)` text input box should submit the text, as if "OK" was clicked.
 * Now, `(enchant:)` can correctly apply `(transition:)` transitions to existing hooks and text. Enchanting an existing hook with a transition will cause it to animate immediately, even if it was already visible - so, it's best used at the top level of passages, and in headers or footers.
 * Now, `(enchant:)` can also accept a 'via' lambda as its second argument, to apply a slightly different changer to each hook or text - `(enchant: ?passage's lines, via (text-color:(hsl: pos * 10, 1, 0.5)))` uses the new "pos" identifier (see below) to give each line of the passage a different colour.
 * Now, `(alert:)`, `(confirm:)` and `(prompt:)` accept optional strings for their dialogs' link text (which are "Cancel" and "OK" if no strings are provided).
 * Macros and expressions (such as bare variables) inside the strings given to `(alert:)`, `(confirm:)` and `(prompt:)` will now run. This wasn't strictly a bug, but it was inconsistent given that markup is available in them.
 * The default CSS for `(mouseover:)` and `(mouseout:)` (a dotted gray border and translucent cyan border, respectively) has been brightened slightly to be more visible. Also, it has been altered to work correctly with the new `(box:)` macro.
 * Reworded the error message produced by trying to get an array element that's outside the array's length (such as `(a: 1,2)'s 5th`).
 * Removed unused, undocumented CSS for the following (also unused) elements: `<tw-outline>`, `<tw-shadow>`, `<tw-emboss>`, `<tw-condense>`, `<tw-expand>`, `<tw-blur>`, `<tw-blurrier>`, `<tw-smear>`, `<tw-mirror>`, `<tw-upside-down>`, `<tw-fade-in-out>`, `<tw-rumble>`, `<tw-shudder>`, and `<tw-shudder-in>`. The CSS applied to these was mostly functionally identical to their corresponding `(textstyle:)` styling.
 * The `(text-style:)` styles "rumble" and "shudder" no longer need to set `display:inline-block` on the hook.
 * The shadow of the `(text-style:)` style "emboss" has been slightly adjusted.
 * Now, attaching `(transition:)` to a passage link instead of `(transition-depart:)` or `(transition-arrive:)` will cause an error instead of doing nothing.
 * Now, when Harlowe detects that a hook containing block elements is being transitioned, the `<tw-transition-container>` element will be given `display:block`. This is to fix a number of transition animation bugs, though it may cause certain structures to animate differently during transition.
 * `(mouseover:)`, `(mouseout:)` and their related macros, which use mouse-hovering input that isn't possible on touch devices, will now fall back to simply being activated by clicks/touches on touch devices.
 * After much fretting and fussing, I've decided to un-deprecate `(subarray:)` and `(substring:)`, because my intended subsequence syntax - `$a's 1stTo2ndlast` and `$a's (range: $b, $c)` - has a not-uncommon edge case where it fails - when `$c` in the preceding example is negative - and I've abandoned plans to alter it to accommodate this case. This un-deprecation changes nothing about how they behaved, but the documentation has been rewritten to include them.
 * Slightly adjusted the animation of `(text-style:"rumble")` and `(text-style:"shudder")` so that the text shifts position from its centre, rather than its left edge.
 * `(all-pass:)` can now be shortened to `(pass:)`. This alias is meant for cases when you only want to check a single value, like in `(pass: $noLetterE, "Gadsby")`, rather than a sequence of values.
 * `(background:)` can now be shortened to `(bg:)`.
 * `(text-rotate:)` is now aliased to `(text-rotate-z:)`, for consistency with the new macros below.
 * `(alert:)` has been renamed to `(dialog:)`, retaining the original name `(alert:)` as an alias for it. Moreover, it can now accept any amount of link text, as well as a bound variable to set to the text of whichever link you click. Also, changers like `(t8n:)` can now be attached to the `(dialog:)` macro.
 * `(reload:)` has been renamed to `(restart:)`, retaining the original name as an alias for it.
 * `(rgb:)` now accepts fractional values for the R, G, and B components.
 * The default CSS for `<tw-sidebar>` now sets its `display` to `flex` and gives it `flex-direction:column; justify-content:space-between;`. This should have no effect on its appearance in usual circumstances (see below).
 * Added a responsive `<meta>` tag to the HTML template, along with some very basic media queries. You might remember that responsive CSS was present in 1.2.4 but removed in 2.0.0, but all that ever did was change the font size, which wasn't helpful most of the time. These media queries now only perform the following when the viewport width is below or at 576px (the cutoff used by Bootstrap):
   * `<tw-story>`'s padding changes to `5% 5%` instead of `5% 20%`.
   * `<tw-sidebar>` loses `left: -5em; width: 3em; position:absolute; flex-direction:column;`, thus causing it to be placed atop the passage horizontally.
   * `<tw-dialog>` loses `max-width: 50vw;`.
 * Made the syntax highlighting dark mode colours 50% brighter.
 * Markup that's inside the verbatim markup will no longer be syntax-highlighted as if it was outside it.

#### Additions

##### Coding

 * Added negated versions of several operators. You may now write `is not in`, `is not a`, `does not contain` and `does not match` as more intelligible negations of `is in`, `contains` and `matches`.
 * Added the `pos` identifier, which is used in lambdas to provide the position of the data value (from those passed into the macro) that the lambda is currently processing. `(altered: via it + pos, 0,0,5,0,0)` equals `(a:1,2,8,4,5)`.
 * Added `2bind`, a "two-way bind" variation of `bind` which causes the `(cycling-link:)` and `(dropdown:)` macros, as well as the new `(seq-link:)`, `(checkbox:)` and `(input-box:)` macros, to automatically match the current value of the bound variable, and update itself whenever another macro changes the variable.
 * Datatypes can now be converted into "spread datatypes" using `...`, such as by writing `...str`. This allows the datatype, inside arrays or string patterns (see below), to match zero or more values of that type. `(a: ...str)` can match `(a:"Oat")`, `(a:"Oat","Wheat")` or `(a:"Oat","Wheat","Maize")`.
 * Added the HookName data name `visited` (as in `?passage's visited`), which allows you to select links that point to visited passages, and change the unique colour these links have.
 * Colours now have an alpha `a` data value, containing the alpha value given to the `(hsl:)` and `(rgb:)` macros - `(hsl: 130, 1, 0.5, 0.2)'s a` is 0.2.
 * Colours now have an `lch` data value, which contains a datamap of LCH color space values for that colour (corresponding to the numbers given to the new `(lch:)` macro). Because LCH's values conflict with HSL's, the LCH values are inside this datamap instead of directly accessible from the colour itself.
 * `(text-style:)` now lets you provide multiple style names, as a shortcut to combining multiple changers. `(text-style:"italic","outline")` is the same as `(text-style:"italic")+(text-style:"outline")`.
 * As an error-checking feature, you can now force your story's variables to only ever hold certain datatypes, so that data of the wrong type can't be set to them. `(set: num-type $funds to 0)` will, for the rest of the story, cause an error to occur if a non-number is ever put into $funds, such as by `(set: $funds to "200")`. This not only works with plain datatypes, but with complex data structures, using the `matches` operator's rules: `(set: (a:str,str)-type $b to (a:'1','1'))` will cause an error to occur if any data that doesn't match `(a:str,str)` is put into $b. You can use this syntax with temp variables and the new `(unpack:)` macro, too.
   * Additionally, you can force a variable to remain constant throughout the story using the new `const` datatype. `(set: const-type $robotText to (font:"Courier New"))` specifies that any further changes to $robotText should cause an error.
 * Lambdas' temp variables may now optionally have types as well, such as by writing `each str-type _name where _name contains "el"`. This checks that the correct types of data are given to the lambda.
 * Arrays and strings now have a `random` data name, which retrieves a random value from these structures. `(a:5,8,9)'s random` produces 5, 8 or 9. This works well with the `(move:)` macro, allowing you to randomly move values out of an array without necessarily needing to use `(shuffled:)`.
 * Arrays and strings now have `start` and `end` data names, which are designed to be used with `is` and `matches`. You can check if a string or array begins or ends with a certain other string or subarray by writing, for instance, `start of "Gossamer" is "Goss"`.
 * Added the `lambda` and `macro` datatypes (see below), and the `boolean` datatype can now be shortened to `bool`.
 * Added the following special datatypes:
   * `even`, which matches only even numbers.
   * `odd`, which matches only odd numbers.
   * `integer` (alias `int`) which matches only whole numbers.
   * `alphanumeric` (alias `alnum`), which matches strings that only contain letters and numbers.
   * `digit`, which matches strings that only contain digits.
   * `whitespace`, which matches strings that only contain whitespace.
   * `lowercase` and `uppercase`, which match single lowercase or uppercase characters.
   * `anycase`, which matches any character which has different lowercase or uppercase forms.
   * `linebreak`, which matches only a linebreak character.
   * `empty`, which matches only empty arrays, strings, datamaps and datasets.
 * Added a `transparent` built-in colour value.

##### Markup

 * Added unclosed collapsing whitespace markup `{=` (`{` followed by any number of `=`) to match the unclosed hook markup.

##### Macros

###### Metadata

 * Added some new macros, `(storylet:)` and `(open-storylets:)`, to support "storylets", an alternative way to link between groups of passages that's preferable for writing non-linear "episodic" interactive fiction. Instead of writing direct links between each episode, you instead write a requirement at the start of each episode, specifying (using a 'when' lambda) when would be the best time to let the player visit the passages. An example is `(storylet: when $season is "spring")`. Then, when you want the player to go to an episode, you use macros like `(open-storylets:)` to get a list of which storylet passages are available right now, and create links or other structures from there. Thanks to Emily Short for popularising the "storylet" design pattern.
 * Added an `(urgency:)` macro, which, when used alongside `(storylet:)`, alters the order in which `(open-storylets:)` sorts this passage, placing it higher than storylets with a lower "urgency" value.
 * Added an `(exclusivity:)` macro, which, when used alongside `(storylet:)`, causes it to be the only passage available in `(open-storylets:)` whenever it's open. Use this for very plot-critical storylets that mustn't be missed. For multiple passages with `(exclusivity:)`, the highest exclusivity values override lower ones.
 * Added a `(metadata:)` macro, which, when placed in a passage, adds values to the `(passage:)` datamap for that passage, allowing you to store any arbitrary data on it for your own use. This takes the same values as `(dm:)` - string names and data values in alternation.

###### Colours

 * Added an `(lch:)` macro (alias `(lcha:)`), an alternative colour creation macro (comparable to `(hsl:)`) that uses the LCH colour space (which is the CIELAB colour space, familiar to graphic designers, but expressed radially using a HSL-style hue angle).
 * Added a `(complement:)` macro, which takes a colour and produces its complement by rotating its LCH hue by 180 degrees.
 * Added a `(palette:)` macro, designed for rapid prototyping, which produces a four-colour palette based on a given colour, for use with `(text-colour:)`, `(background:)` and `(enchant:)`.
 * Added `(stripes:)`, a variant of `(gradient:)` which creates a striped background (for use with `(background:)`) when given a given stripe width, angle, and colours.

###### Values

 * Added a `(hooks-named:)` macro, which can be used to construct a HookName using a string. The slightly unusual name of this macro is meant to avoid confusion with `(hook:)`.
 * Added a `(trunc:)` macro, which is similar to `(round:)`, but rounds toward zero, "truncating" the fractional component. It is named after the Excel function that performs the same rounding.
 * Added a `(plural:)` macro, which takes a number and a string, and combines them, automatically pluralising the string if the number isn't 1. `(plural:2,"duck")` produces `"2 ducks"`. Pluralisation is performed by adding "s" - a second string may be given which specifies a more correct plural form of the word (such as `(plural:4,"elf","elves")`).
 * Added a `(str-nth:)` macro (alias `(string-nth)`) which takes a number and produces the English ordinal of that number (such as `"2nd"` for `2`, and `"-41st"` for `-41`).

###### Data Structures

 * Added a `(permutations:)` macro, which, when given a sequence of data, produces an array containing all possible arrangements of that data, in arrays.
 * Added a `(source:)` macro, which can turn any data value into its source code representation. `(source: (text-style:"bold") + (click: ?hat's 1st))` produces the string `'(text-style:"bold")+(click:?hat's 1st)'`.
 * Added a `(rotated-to:)` macro, a variation of `(rotated:)` which, rather than rotating the values by a given number, takes a lambda and rotates them until the first one that matches the lambda is at the front. `(rotated-to:where it > 3, 1,2,3,4)` produces `(a:4,1,2,3)`.
 * Added `(unpack:)`, a variation of `(put:)` used for assigning multiple values from an array, datamap or string into multiple variables at once. You can now write `(unpack: (a:1,2,(a:3)) into (a:$x, $y, (a:$z)))`, and the array on the left will overwrite the array on the right, causing $x to become 1, $y to become 2, and $z to become 3, without needing to write multiple `(set:)` statements. You may also put values or datatypes at positions in the right side, such as in `(put: (a:1,2,3) into (a:1,2,$x))`, to check that the right side indeed has matching values at those positions, and to cause an error if they do not.
   * The `(move:)` macro now also supports unpacking, by providing it with the same kind of statements as `(unpack:)`.
 * Added `(split:)` (also known as `(splitted:)` to emphasise that it has an adjectival name) which takes a string or string pattern (see below) and uses it as a separator value with which to split up the other string given to it, producing an array of substrings.
 * Added `(joined:)`, which joins together the strings given to it, using the first string as a separator value. `(joined:"! ", "Liberty", "Equality", "Fraternity", "")` produces the string `"Liberty! Equality! Fraternity!"`.
 * Added `(trimmed:)`, a macro that removes instances of the given string pattern from the start and end of the given string (defaulting to whitespace if no pattern was given).

###### Datatypes

 * Added several macros that, when used together, let you construct custom string datatypes called "string patterns" that match very specific kinds of strings. These are roughly comparable to regular expressions in other programming languages. 
   * `(p:)` takes a sequence of strings or string datatypes, and produces a datatype that only matches strings that match the entire sequence, in order.
   * `(p-either:)` takes one or more strings or string datatypes, and produces a datatype that only matches strings that match any one of the values.
   * `(p-opt:)` is a variation of `(p:)` that optionally matches the sequence - it matches strings that match the sequence, or are empty.
   * `(p-many:)` is a variation of `(p:)` that matches strings that match the sequence many times. You can specify the minimum and/or maximum amount of times the string can match the sequence.
   * `(p-ins:)` is a case-insensitive version of `(p:)`, which also treats any sub-patterns given to it as case-insensitive.
   * `(p-not:)` matches any character except those that match the given single-character strings, or datatypes corresponding to single characters.
 * You can also use the preceding macros with `(unpack:)`. For instance, `(unpack: "Dr. Iris Cornea" into (p: (p-opt:"Dr. "), (p: str-type _firstName, whitespace, str-type _lastName)-type _fullName))` creates three variables, _firstName, _lastName and _fullName, from a single string.
 * Added `(datatype:)` and `(datapattern)` macros. `(datatype:)` produces the datatype that matches the given value, if it exists. `(datapattern)` is a variation that, when given arrays or datamaps, produces a data pattern that can be used with the `matches` operator, among other things, to check if the structure of one value matches the other. `(datapattern: (passage:))` produces `(dm:"name",str,"source",str,"tags",(a:str))`.

###### Changers

 * Added a variation of the `(enchant:)` macro, called `(change:)`, which simply applies the given changers once, without creating an ongoing effect that causes additional inserted text to be affected by it.
 * Added a changer variation of `(enchant:)`, `(enchant-in:)`, which restricts the effect of the enchantment to just the attached hook. This also lets you deploy (enchant:) effects alongside other changers in variables. Note that `(enchant-in:)` cannot be supplied to itself or `(enchant:)`.
 * Added some shorthands for using `(enchant-in:)` with certain common hook names: `(link-style:)` is a shorthand for using `(enchant-in:)` with `?Link`, `(line-style:)` is a shorthand for using `(enchant-in:)` with `?Page's lines`, and `(char-style:)` is a shorthand for using `(enchant-in:)` with `?Page's chars`. Because the Harlowe code for enchanting just the lines or characters within a hook is messy with the latter two constructions (you can't say "this hook's lines", for instance, and instead must specify the equivalent of "the page's lines which are in this hook") these macros have been created as a more intuitive alternative. Their naming is in keeping with the precedent set by `(hover-style:)`.
 * Added a `(text-size:)` style changer macro (also known as `(size:)`) that scales the attached hook's font size and line height by the given multiplier.
 * Added an `(opacity:)` style changer macro, which allows the CSS opacity of hooks to be altered. This also allows sidebar icons' opacity to be altered, using (change:) and other tools.
 * Added a `(transition-delay:)` macro (also known as `(t8n-delay:)`) which adds an initial delay to transitions before they begin animating. This can only enchant hooks, not links.
 * Added a `(transition-skip:)` macro (also known as `(t8n-skip:)`) which, when included with a transition, allows the player to speed up the transition by a given number of milliseconds per frame, by holding down any keyboard key, mouse button, or by touching the screen.
 * Added an `(after:)` changer macro, which is essentially a `(live:)` changer that only ever runs the hook once. However, unlike `(live:)`, it takes an optional second number that allows the player to speed up the delay by the given number of milliseconds per frame, by holding down any keyboard key, mouse button, or by touching the screen.
 * Added a `(collapse:)` changer macro, which causes the attached hook's whitespace to collapse, as if by the `{` and `}` collapsing whitespace markup. This can also be used with `(enchant:)`.
 * Added a `(verbatim:)` changer macro (alias `(v6m:)`), which causes the attached hook or command to be printed verbatim, as if by the verbatim markup.
 * Added a `(text-indent:)` changer macro, which applies a leading indent to the attached hook, and can be applied to each line in the passage using, for example, `(enchant:?passage's lines, (text-indent:12))`.
 * Added a `(box:)` changer macro, which turns the attached hook into a box with given width and horizontal margins, a height scaling with window height, and a scroll bar if its contained prose exceeds its height.
 * Added a `(float-box:)` changer macro, a variant of `(box:)` which turns the hook into a separate pane floating on the window, using `position:fixed`. These have an explicit vertical position as well as horizontal position.
 * Added a `(text-rotate-x:)` and `(text-rotate-y:)`, which are 3D versions of `(text-rotate:)`, rotating the hook around the X or Y axis, making it appear to lean into the page with perspective.
 * Added the changer macros `(border:)`, `(border-size:)`, and `(border-colour:)` (aliases `(b4r:)`, `(b4r-size:)`, `(b4r-colour:)`) which add and adjust CSS borders for hooks. `(border:)` will automatically make the attached hook have `display:inline-block`, so that it remains rectangular and the border can properly enclose it.
 * Added a `(corner-radius:)` macro, which rounds the corners of the hook (using the CSS "border-radius" property, which, despite its name, works on elements without borders). It will also add padding, proportional to the amount of corner rounding, so that the corners don't encroach on the inner text.
 * Added a `(button:)` macro, which is designed especially for links. It is essentially a convenient shorthand for `(align:"=><=")+(box:"X")+(border:"solid")+(css:"padding:0px")+(corner-radius:16)`.
 * The following `(text-style:)` styles have been added:
   * "double-underline", "wavy-underline", "double-strike" and "wavy-strike", which are variants of "underline" and "strike". Be aware these will not work in Internet Explorer.
   * "fidget", which jolts the hook by one pixel in cardinal directions pseudorandomly.
   * "buoy" and "sway", which are slow, gentle movement animations to serve as counterparts to "rumble" and "shudder".
 * The following `(transition:)` transitions have been added:
   * "zoom", which makes the transitioning entity zoom in or out from the mouse cursor's position (or the last place the touch device was touched).
   * "fade-up", "fade-down", "fade-left", and "fade-right", which are combinations of "dissolve" with gentler sliding transitions.
   * "fade", which is an alias for "dissolve" (for consistency with the above, as well as the "fade-in-out" text style).
   * "blur", which uses the new CSS blur filter to make a hook appear or disappear in a blur. Note that this will not work in any version of Internet Explorer.
 * Added `(append-with:)`, `(prepend-with:)` and `(replace-with:)`, changers which modify the hook by adding a given string of code to the start or end of it, or replace it entirely. This is intended for use with things like dialogue tags or punctuation that's commonly used throughout the story.
 * Added two debugging changers, `(test-true:)` and `(test-false:)`, inspired by Chapbook's `ifalways` and `ifnever` mods, that ignore all of the values given to them (as well as their data types) and instead act like `(if:true)` or `(if:false)`, respectively. As with their inspirations, these are designed for quick debugging checks.

###### Commands

 * Added an `(input-box:)` macro, which places a `<textarea>` element in the passage, sized using the same values given to the `(box:)` macro, and optionally bound to a variable.
 * Added a `(force-input-box:)` macro, designed for linear narratives, that creates what seems to be a normal `(input-box:)`, but which, when typed into, instantly replaces the entered text with portions of a predefined string.
 * Added a `(checkbox:)` macro, which creates a labeled `<input type=checkbox>` element in the passage, which is bound to a boolean variable. You'll usually want to use a `2bind` binding with this macro.
 * Added a `(meter:)` macro, used for creating a videogame bar-graph meter that's bound to a numeric variable. You can provide this with a colour or gradient for the bar, and a text label, as well as make the bar left-aligned, right-aligned or centered.
 * Added a `(link-rerun:)` macro, which is similar to `(link-repeat:)`, but which replaces the hook on each click rather than appending to it.
 * Added a `(rerun:)` macro, which replaces a given hook with its original source, eliminating any changes made to it by `(replace:)` or other macros. This also runs any macros inside the hook an additional time.
 * Added an `(animate:)` macro, which causes an already-present hook to transition in again, using a specified transition and time.
 * Added a `(hide:)` macro, which removes the contents of a given hook from the passage, but allows the `(show:)` macro to restore the contents later. Hooks hidden with `(hide:)` will not re-run any containing macros when `(show:)` is used on them later.
 * Added a `(seq-link:)` macro, a variation of `(cycling-link:)` which does not cycle - it simply turns into plain text on the final string.
 * Added a `(verbatim-print:)` command macro (alias `(v6m-print:)`), a combination of `(verbatim:)` and `(print:)`. This is designed especially for printing player-inputted strings that may, for whatever reason, contain markup.
 * Added a `(verbatim-source:)` command macro (alias `(v6m-source:)`), a combination of `(verbatim-print:)` and `(source:)`, intended for debugging.
 * Added a debugging macro, `(ignore:)`. If you wish to temporarily disable a command in the passage you're currently testing, simply change its name to "ignore" and it will ignore all of the values given to it, without causing an error.
 * Added `(click-undo:)`, `(mouseover-undo:)`, and `(mouseout-undo:)`, to complement `(click-goto:)` and the rest.
 * Added `(link-fullscreen:)`, a command macro that creates a link that, when clicked, toggles the browser's fullscreen mode on and off. It takes two link text options, one for entering fullscreen, and one for exiting it, which are automatically updated to match the browser's current fullscreen state. Note that this will only make the `<html>` element fullscreen, for numerous reasons (mainly that enchanting the `<tw-story>` element with `(enchant:?page,` will deactivate fullscreen if it's the fullscreen element, due to the macro call wrapping `<tw-story>` in another element). Also note that because most browsers allow users to exit fullscreen mode at any time, there's no way to force fullscreen mode into one state or another. Also note that, because browsers only allow fullscreen mode to be entered from interaction elements, like links or buttons, there can't be a low-level "toggle fullscreen" command macro as an alternative to this.
 * Added `(checkbox-fullscreen:)`, a version of `(link-fullscreen:)` that produces a checkbox instead of a link.
 * Added `(link-storylet:)`, a command macro that creates a link to the nth open storylet (or, if a 'where' lambda is given, the first open storylet whose (passage:) datamap matches the lambda).
 * Added `(icon-undo:)` and `(icon-redo:)`, two commands that replicate the default sidebar's "undo" and "redo" icons. Use these to reinsert these into the sidebar if you've modified it using `(replace:)` or `(append:)`, or simply place those icons into your passage text if you wish. You can change the icon to use a different Unicode character if you wish. You can also add text labels to these icons, which appear below them.
 * Added `(icon-restart:)` and `(icon-fullscreen:)`, two additional commands that can be used, with `(prepend:)` and `(append:)`, to add "fullscreen" and "reload" buttons to the sidebar. The "fullscreen" icon works similarly to the `(link-fullscreen:)` macro described above, while the "reload" icon performs similarly to `(reload:)` when clicked. These offer the same options as `(icon-undo:)` and `(icon-redo:)`.
 * Added `(icon-counter:)`, which produces a numeric display element that live-updates to match a bound number variable (rounded to a whole number). The element is roughly the same size as the sidebar icons, and designed to be used in the sidebar alongside them.
 * Added a debugging command, `(mock-visits:)`, which lets you re-create a game state where certain passages have been visited a certain number of times, so that the `visits` keyword and the `(history:)` array produce desired results. This command will cause an error unless it's used in debug mode.
 * Added a debugging command, `(assert:)`, which can be used to write an "assertion" expression about the game state of your story that should always be `true`, such as `(assert: $HP <= $maxHP)`. If some bug causes the assertion to produce `false`, a helpful error will be produced.
 * Added a debugging command, `(assert-exists:)`, which checks whether a hook matching the passed-in HookName, or a text occurrence matching the passed-in string, exists in the passage. If not, an error is produced.

##### Custom Macros

 * A new macro, `(macro:)`, allows you to write custom macros for Harlowe and store them in variables. `(set: $earthName to (macro: [(output:(either:"Terra","Earth"))]))` produces a custom macro that can be called by writing `($earthName:)`.
 * Added three macros, `(output:)` (alias `(out:)`), `(output-data:)` (alias `(out-data:)`) and `(error:)`, which are used to output final values for your custom macros. `(output-data:)` is used for macros that produce data values, such as `(min:)` or `(lowercase:)`, whereas `(output:)` is used for macros that produce commands that display complicated markup, such as `(cycling-link:)`. `(error:)` can be used to output custom error messages.
 * Added CodeHooks, which are special kinds of hooks that go inside macro calls, rather than just in passage prose. These are used to write the inner code of custom macros. You can use `(if:)`, `(for:)`, `(set:)`, and most other macros inside one. Their contents are invisible at runtime - only the result produced by `(output:)` or `(output-hook:)` is visible - so you can comment your code by simply writing prose inside it.
 * The aforementioned `-type` syntax is also used to define the parameters of custom macros. Place a datatype (such as `str` or `dm`) in front, and a temp variable after it (such as `str-type _name`) to specify an input value for the macro. `(set: $ASCIImeter to (macro: num-type _HP, num-type _maxHP, [(output-data: (str-repeated: _HP,"=")+(str-repeated:_maxHP - _HP,"."))])` produces a custom macro that can be called by writing `($ASCIImeter: 2,10)` and produces an error when you write `($ASCIImeter: 2)` or `($ASCIImeter: 2, "10")`.
   * You may also specify that a macro accepts a sequence of values, similar to macros like `(a:)` or `(either:)` by writing `...` before a parameter. `(set: $mean to (macro: ...num-type _a, [(output:(folded:making _total via _total + it, ..._a) / _a's length)]))` can be given any amount of numbers, and puts them into an array inside `_a`.

##### Debug Mode

 * Added a draggable area that, when clicked and dragged, lets you resize the debug mode panel horizontally.
 * Added a debug mode panel listing which enchantments are present in the passage, and the changers they contain. This highlights `(enchant:)` effects, as well as `(click:)`, `(mouseover:)` and `(mouseout:)`.
 * Added a debug mode panel listing which storylet passages are currently available, and their 'where' lambdas. This panel is only visible if you have `(storylet:)` macros in your story.
 * The debug mode variables panel now has a "(source:)" button for each variable containing a complex value (i.e. not a string, boolean, number), letting you examine and copy that variable's value as Harlowe code.
 * The debug mode variables panel now has a "Copy $ variables as (set:) call" button at the bottom, which copies to the clipboard a string of Harlowe code that will (set:) each global variable to their currently displayed value.
 * The debug view now reveals command macros and expressions, such as `(enchant:)`, which don't print anything and are normally hidden during play.
 * Added an alternative debug view, "DOM view", which labels the unique elements on the page with their current HTML tag and a few relevant attributes, as well as spacing out the elements to better distinguish them. The elements that will be highlighted this way are `<tw-story>`, `<tw-passage>`, `<tw-sidebar>`, `<tw-include>`, `<tw-hook>`, `<tw-expression>`, `<tw-link>`, `<tw-dialog>`, `<tw-columns>`, `<tw-column>`, and `<tw-align>`.
 * Now, whenever the first error of your story is displayed, debug mode will automatically, immediately enable itself, so you can begin debugging there and then.

##### Other

 * Added a "toggle fullscreen" button to the sidebar, underneath the "undo" and "redo" buttons. It should only appear if fullscreen mode is permitted by the browser. The same caveats about fullscreen mode for `(link-fullscreen:)` are present here.
 * Added an editor toolbar, available in Twine's Passage Editor.
 * The syntax highlighter no longer highlights syntactic elements inside strings. While this had some fringe benefit in cases where strings contained code to be printed, I've decided it's too distracting in more usual cases.
 * The syntax highlighter now colourises macro names based on their returned data type.
 * Added a `<noscript>` element to the output HTML, containing a sentence instructing that JavaScript should be enabled to play the story (as per SugarCube).

### 3.1.0 changes (Sep 24, 2019):

#### Bugfixes

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

#### Alterations

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

#### Additions

##### Coding

 * Added a `visits` identifier (aliased as `visit`) to join `it` and `time`. It equals the number of times the current passage was visited, including this visit. The purpose of this identifier is to make it easier to replicate the Twine 1 `<<once>>` macro, which only displayed text on the first visit to a passage, and whose absence was a long-standing weakness in Harlowe. Previously, it could be replicated using the rather cumbersome `(if: (passage:)'s name is not in (history:))`, but now, it can be replicated using `(if: visits is 1)`, which expresses the intent much better and approaches the original's brevity. Furthermore, it makes it much easier to specify hooks to display on third, fourth, or even-numbered visits, using `(if: visits is 3)`, `(if: visits % 2 is 0)` and so forth. The reason this is an identifier and not a macro (like `(passage:)`) is because I want identifiers to be used for small, "volatile" information that's specific only to the current context, such as `it` and `time`. (`(history:)`, in retrospect, could have been an identifier.)
 * Also added an `exits` identifier (aliased as `exit`), which equals the number of "exit" elements in the passage (links, `(mouseover:)` or `(mouseout:)` elements).
 * Added the special hookname properties, "chars", "lines", and "links", which can be used to select special kinds of structures inside hooks.
   * `?hook's chars` selects each individual character within a hook, as if they were wrapped in hooks themselves. This is meant to revive the memorable `.char`-selecting CSS functionality in Twine 1, and can, in particular, be used with `(enchant:)` and `(hover-style:)`.
   * `?hook's lines` selects individual lines of text within a hook. A line is any run of text or code between line breaks (or the passage's start and end) - a word-wrapped paragraph of prose is considered a single "line" as a result.
   * `?hook's links` selects hyperlinks, similar to `?Link`, but only within the given hook.
 * Now, you can create consecutive subsets of arrays, strings and hooknames by writing two positions, such as `1st` and `3rd`, and joining them together with `to`, and using that as a data name - `$arr's 1stto3rd` is the same as `$arr's (a:1,2,3)`, and `"Jelly"'s 3rdlasttolast` is "lly". This is a more readable alternative to using arrays of positions. Note that, as with `2nd` etc., these are case-insensitive, so you can write these using the capitalisation `3rdlastToLast` if you wish. (Note that this isn't intended to replace subsets whose ranges are defined by variables, such as in `$a's (range:$p1, $p2)`.)

##### Macros

 * Added `(cond:)`, a macro similar to `(if:)` but which conditionally chooses between two data values, rather than hooks. `(cond: visits is 1, "Strange", "Familiar")` is "Strange" on the first visit and "Familiar" afterward. Since it's not a changer, you can use it in expressions within other macros freely. Additionally, you can add further conditions - `(cond: $gender is "masc", "god", $gender is "femme", "goddess", $gender is "pan", "goddex", "deity")` - to choose among several values precisely.
 * Added `(nth:)`, a macro that takes a sequence of values and chooses one at a given position, similar to the `'s` or `of` indexing syntax for arrays. `(nth: 2, $mary, $edith, $gwen)` is the same as `(a: $mary, $edith, $gwen)'s 2nd`. It serves as a more readable alternative to the indexing syntax in certain situations, such as using it with `visit` in cases like `(nth: visit, "hissing", "whirring", "clanking")`.
 * Added `(more:)`, a convenient shorthand for `(event: when exits is 0)`. When there are no more exits, it will run and display even "more" prose. Loosely inspired by the Ink language's "gather" syntax, its main purpose is to be used alongside `(link:)`, as a shortcut for putting `(show:)` inside it - `(link:"Duck")[It swims on the lake.(show:?next)] |next)[It dives underwater.]` can be rewritten as `(link:"Duck")[It swims on the lake.] (more:)[It dives underwater.]`.
 * Added a `(passages:)` macro, which returns an array containing the `(passage:)` datamaps for every passage in the game, but also can be given a "where" lambda to filter that array.
 * Added a gradient data type, a `(gradient:)` macro, and a `gradient` datatype name. This can be used to quickly create special images called gradients, which are smooth linear fades between various colours. These are implemented using CSS `linear-gradient`s, and the `(gradient:)` macro has similar syntax to it. Currently, these can only be used with `(background:)`.

##### Markup

 * Added "unclosed hook" markup: `[==` (`[` followed by any number of `=`, similar to the aligner markup) is an opening bracket that automatically closes when the passage or enclosing hook ends, so you don't need to include the closing bracket yourself. This is inspired by the `<<continue>>` custom macro I wrote for Twine 1 (not to be confused with SugarCube's macro of the same name), and is designed for convenient use with changers that you may want to apply to the entire remainder of the passage, such as `(link:)`, `(event:)`, `(t8n:)` and such. `(link: "Next.")[=` replicates the behaviour of `<<continue "Next.">>` easily.

##### Debug Mode

 * Added a new toggleale pane to the debug mode panel, "Source", which displays the current passage's source code. This is designed to supplement the "debug view" option, which shows the passage's current state, by letting you compare it to the original code. This pane currently has no syntax highlighting, such as that used in the Twine editor.
 * Added another toggleable pane, "Errors", which displays a record of every error that has been displayed in the story, so far, up to a limit of 500. This should be of assistance when dealing with errors inside `(live:)` hooks, or other hooks whose content appears and disappears abruptly.
 * The debug mode variables pane now lists the contents of datamaps, arrays and datasets, as separate rows.
 * Colours in the variables pane now have a colour swatch in their listing.

### 3.0.2 changes (Apr 17, 2019):

#### Bugfixes

 * Fixed a startup bug that potentially caused `(dropdown:)` menus to stop affecting their bound variables for the rest of the game.
 * Now, `(alert:)`, `(prompt:)` and `(confirm:)` produce errors if they are used in a browser that doesn't support Javascript's `prompt()`, `alert()` or `confirm()` functions, instead of crashing the page.
 * Fixed the `(str:)` macro alias added in 3.0.0 mysteriously not actually having been added.

### 3.0.1 changes (Apr 14, 2019):

#### Bugfixes

 * Fixed a bug where the SessionStorage state-preserving system introduced in 3.0.0 would interfere with the "Test story starting here" feature in the Twine editor.

#### Alterations:

 * If the `(loadgame:)` macro encounters an error while loading save data (such as, a passage it refers to no longer exists in this version of the story) then a polite dialog box (a simple JavaScript `prompt()`) will appear suggesting that the save data might be outdated, and asking the reader whether or not the save data should be deleted.

### 3.0.0 changes (Jan 11, 2019):

#### Bugfixes

 * Fixed a bug where the story crashes on startup if the page's URL contains a hash identifier that doesn't have "stories" in it (such as in `story.html#what`).
 * Fixed a bug where the story crashes on startup if, for some reason, localStorage exists but cannot be accessed.
 * Fixed a bug where same-precedence arithmetic operators (`+` and `-`, or `/` and `*`) had incorrect associativity (so, `3 - 5 + 2` was interpreted as `3 - (5 + 2)` instead of `(3 - 5) + 2`).
 * Temp variables finally work correctly with changers that defer a hook until some event occurs, like `(link:)`, `(click:)` and such. Now, you can reference temp variables inside the hook, such as in `(link:"Read")[It reads: _engraving]`, just as you can with other kinds of changers.
 * Fixed a bug where supplying multiple shortened `is` or `is not` comparisons, in a form such as `$a is $b and $c`, would produce an incorrect result.
 * Fixed a bug where the debug view's `(set:)` messages were worded incorrectly when setting global variables.
 * A more useful error message is given if you write a link with no passage name (such as `[[Go->]]`).
 * Fixed a bug where you could + a changer, a hookname, or a colour to any arbitrary command, like a `(goto:)` command.
 * Fixed a bug where having a `(for:)` macro's lambda's `where` clause return something other than a boolean, such as in `(for: each _a where 127)[]`, wouldn't produce an error message.
 * Fixed a bug where `contains` would wrongly error if used to check if an empty string `""` contained anything.

#### Alterations

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

#### Additions

##### Datatypes

 * Added `is a` and `is an` operators, which can be used to determine what datatype a variable or piece of data is - `$message is a string` is true if the variable is a string. The datatype names are `number` or `num`, `string` or `str`, `boolean`, `array`, `datamap` or `dm`, `dataset` or `ds`, `command`, `changer`, and `color` or `colour`.
 * Added a `matches` operator, which functions similarly to `is a`, but can also be used to check if a data structure's shape resembles a pattern - a similar data structure with datatype names as "holes" in it. `(a: 2, 3) matches (a: num, num)` checks that the first array contains exactly two numbers. `(dm: "Faction", str) matches (dm: "Faction", "Slugbikers")` checks that the second datamap contains only one name with a string value. Nested patterns - `(a: (a: num), num, num)` - are also usable.
 * Added a `bind` operator, which is used to "bind" variables to certain interaction macros, like `(cycling-link:)`, described below.

##### Macros

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

### 2.1.0 changes (Dec 07, 2017):

#### Bugfixes

 * Now, using `(enchant:)` to change the `(text-colour:)` of `?Link` (normal links) will correctly override the default CSS link colour.
 * Fixed a bug where the alternative macro spellings `(text-color:)` and `(color:)` were displayed as erroneous in the editor.
 * Now, `(enchant:)` correctly displays an error when the changer provided to it includes a `(replace:)`, `(append:)` or `(prepend:)` command.
 * Re-fixed the bug where `(pow:)` only accepted 1 value instead of 2, and also fixed `(sqrt:)` and the `(log:)` variants, which weren't working at all.
 * Fixed a parsing bug where `5*3-2`, without whitespace around the minus sign, would break the order of operations.

#### Alterations

 * Changed the `~~` markup to produce a strikethrough style using an `<s>` element, instead of a censor-bar style using a `<del>` element. The censor-bar style, which was used in all previous versions but not ever properly documented, was bugged to always be black even if the text colour was not black. It can be replicated in stories by simply using a `(background-colour:)` macro (preferably set to a variable) in its place.
 * Removed the default `line-height` CSS for `<h1>` and other header elements, because it was causing problems with line-wrapped headers.

#### Additions

##### Debug Mode

 * Added a button to hide/show the variables pane at will.
 * Reduced the maximum CSS height of the variables pane from 90vh (90% of the window's height) to 40vh.
 * Gave variable rows a flex-shrink of 0, which I'm told prevents rows from contracting to unreadability when the pane requires scrolling.
 * The variables pane should now also list temporary variables, and their locations. This currently only lists those that have been explicitly (set:) or (put:), and ignores those that are created inside (for:) loops.

### 2.0.1 changes (Apr 26, 2017):

#### Bugfixes

 * Fixed a bug where `(enchant:)` applied to ?Page couldn't override CSS properties for `<tw-story>` (including the default background colour and colour).
 * Fixed a Passage Editor display bug where the left margin obscured the first letter of lines.

### 2.0.0 changes (Feb 15, 2017):

#### Bugfixes

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

#### Alterations

##### Removed behaviour

 * In order to simplify the purpose of hook names such as `?room`, you can no longer convert them to strings, `(set:)` their value, `(set:)` another variable to them, or use them bare in passage text. The `(replace:)` macro, among others, should be used to achieve most of these effects.
 * Using `contains` and `is in` on numbers and booleans (such as `12 contains 12`) will now produce an error. Formerly, doing so would test whether the number equalled the other value. (The rationale for this was that, since the statement `"a" contains "a"` is the same as `"a" is "a"`, then so should it be for numbers and booleans, which arguably "contain" only themselves. However, this seems to be masking certain kinds of errors when incorrect or uninitialised variables or properties were used).
 * Now, various macros (`(range:)`, `(subarray:)`, `(substring:)`, `(rotated:)` etc.) which require integers (positive or negative whole numbers) will produce errors if they are given fractional numbers.
 * It is now an error to alter data structures that aren't in variables - such as `(set: (a:)'s 1st to 1)` or `(set: (passage:)'s name to "X")` - because doing so accomplishes nothing.
 * Attaching invalid values to hooks, such as `(either:"String")[text]`, `(a:2,3,4)[text]` or `(set: $x to 1) $x[text]`, will now result in an error instead of printing both the value and the hook's contents.
 * Writing a URL in brackets, like `(http://...)`, will no longer be considered an invalid macro call. (To be precise, neither will any macro whose `:` is immediately followed by a `/`, so other protocol URLs are also capable of being written.)

##### Markup

 * Now, if you write `[text]` by itself, it will be treated as a hook, albeit with no name (it cannot be referenced like `?this`) and no attached changer commands. This, I believe, simplfies what square brackets "mean" in passage prose. Incidentally, temporary variables (see below) can be `(set:)` inside nameless unattached hooks without leaking out, so they do have some semantic meaning.
 * Now, you can attach changer macros to nametagged hooks: `(if: true) |moths>[Several moths!]`, for instance, is now valid. However, as with all hooks, trying to attach plain data, such as a number or an array, will cause an error.
 * Hook-attached macros may now have whitespace and line breaks between them and their hooks. This means that `(if: $x)  [text]` and such are now syntactically acceptable - the whitespace is removed, and the macro is treated as if directly attached. (This means that, if after a macro call you have plain passage text that resembles a hook, you'll have to use the verbatim markup to keep it from being interpreted as such.)

##### Code

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

##### HTML/CSS

 * The default Harlowe colour scheme is now white text on black, in keeping with SugarCube and Sugarcane, rather than black text on white. The light colour scheme can be reinstated by putting `(enchant: ?page, (text-colour:black)+(background:white))` in a passage with the `header` tag.
 * The `<tw-story>` element is now kept inside whatever element originally enclosed it, instead of being moved to inside `<html>`.
 * Now, the default CSS applies the default Harlowe `font` (Georgia) to the `<tw-story>` element instead of `html` - so, to override it, write CSS `font` properties for `tw-story` (which is what most custom CSS should be altering now) instead of `html` or `body`.
 * Fixed a bug where the "Story stylesheet" `<style>` element was attached between `<head>` and `<body>`. This should have had no obvious effects in any browser, but was untidy anyway.
 * Altered the CSS of `<tw-story>` to use vertical padding instead of vertical margins, and increased the line-height slightly.
 * Altered the CSS of `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>` and `<h6>` elements to have a slightly lower margin-top.
 * Now, `<tw-passage>` elements (that is, passages' HTML elements) have a `tags` attribute containing all of the passage's tags in a space-separated list. This allows such elements to be styled using author CSS, or selected using author Javascript, in a manner similar to Twine 1.4 (but using the `[tags~= ]` selector instead of `[data-tags~= ]`).
 * Removed the CSS directives that reduce the font size based on the player's device width, because this functionality seems to be non-obvious to users, and can interfere with custom CSS in an unpleasant way.
 * Now, hooks and expressions which contain nothing (due to, for instance, having a false `(if:)` attached) will now have `display:none`, so that styling specific to their borders, etc. won't still be visible.

#### Additions

##### Markup

 * Added column markup, which is, like aligner markup, a special single-line token indicating that the subsequent text should be separated into columns. They consist of a number of `|` marks, indicating the size of the column relative to the other columns, and a number of `=` marks surrounding it, indicating the size of the column's margins in CSS "em" units (which are about the width of a capital M). Separate each column's text with tokens like `|===` and `==||`, and end them with a final `|==|` token to return to normal page layout.
 * Now, it's possible to attach multiple changers to a single hook by joining them with `+`, even outside of a macro - `(text-style:'bold')+(align:'==>')+$robotFont[Text]` will apply `(text-style:'bold')`, `(align:'==>')` and the changer in the variable $robotFont, as if they had been added together in a single variable. Again, you can put whitespace between them – `(text-style:'bold') + (align:'==>') + $robotFont  [Text]` is equally valid, and causes the whitespace between each changer and the hook itself to be discarded.
 * Now, you can make hooks which are hidden when the passage is initially displayed, to be revealed when a macro (see below) is run. Simply replace the `<` and `>` symbol with a `(` or `)`. For example: `|h)[This hook is hidden]`. (You can think of this as being visually similar to comic speech balloons vs. thought balloons.) This is an alternative to the revision macros, and can be used in situations where the readability of the passage prose is improved by having hidden hooks alongside visible text, rather than separate `(replace:)` hooks. (Of course, the revision macros are still useful in a variety of other situations, including `header` passages.)

##### Code

 * Arrays, strings and datasets now have special data names, `any`, and `all`, which can be used with comparison operators like `contains`, `is` and `<=` to compare every value inside them. For instance, you can now write `(a:1,2,3) contains all of (a:2,3)`, or `any of (a:3,2) <= 2`, or `"Fox" contains any of "aeiou"` (all of which are true). You can't use them anywhere else, though - `(set: all of $a to true)` is an error (and wouldn't be too useful anyway).
 * Now, certain hard-coded hook names will also select elements of the HTML page, letting you style the page using enchantment macros. `?page` selects the page element (to be precise, the `<tw-story>`), `?passage` selects the passage element (to be precise, the `<tw-passage>`), `?sidebar` selects the passage's sidebar containing undo/redo icons (`<tw-sidebar>`), and `?link` selects any links in the passage. (Note that if you use these names for yourself, such as `|passage>[]`, then they will, of course, be included in the selection.)
 * Added temporary variables, a special kind of variable that only exists inside the passage or hook in which they're `(set:)`. Outside of the passage or hook, they disappear. Simply use `_` instead of `$` as the sigil for variables - write `(set: _a to 2)`, `(if: _a > 1)`, etc. Their main purpose is to allow you to make "reusable" Twine code - code which can be pasted into any story, without accidentally overwriting any variables that the story has used. (For instance, suppose you had some code which uses the variable `$a` for some quick computation, but you pasted it into a story that already used `$a` for something else in another passage. If you use a temporary variable `_a` instead, this problem won't occur.)
   * Also note that temp variables that are `(set:)` inside hooks won't affect same-named temp variables outside them: `(set: _a to 1) |hook>[(set: _a to 2)]` will make `_a` be 2 inside the hook, but remain as 1 outside of it.
 * Lambdas are a new data type - they are, essentially, user-created functions. You can just think of them as "data converters" - reusable instructions that convert values into different values, filter them, or join multiple values together. They use temporary variables (which only exist inside the lambda) to hold values while computing them, and this is shown in their syntax. An example is `_a where _a > 2`, which filters out data that's smaller than 2, or `_name via "a " + _name`, which converts values by adding 1 to them. Various new macros use these to easily apply the same conversion to sequences of data.
 * Colour values now have read-only data names: `r`, `g` and `b` produce the red, green and blue components of the colour (from 0 to 255), and `h`, `s` and `l` produce, in order, the hue (in degrees), and the saturation and lightness percentages (from 0 to 1).
 * You can now access sub-elements in hook names, as if they were an array: `(click: ?red's 1st)` will only affect the first such named hook in the passage, for instance, and you can also specify an array of positions, like `?red's (a:1,3,5)`. Unlike arrays, though, you can't access their `length`, nor can you spread them with `...`.
 * You can now add hook names together to affect both at the same time: `(click: ?red + ?blue's 1st)` will affect all hooks tagged `<red|`, as well as the first hook tagged `<blue|`.

##### Macros

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

### 1.2.4 changes (Apr 26, 2017):

#### Bugfixes

 * `(random:)` now no longer incorrectly errors when given a single whole number instead of two.
 * `(alert:)`, `(open-url:)`, `(reload:)` and `(goto-url:)` now return empty strings rather than the non-Harlowe value `undefined` (or, for `(open-url:)` a Javascript Window object). This differs slightly from 2.0, which returns more useful command values.
 * Additionally, backported the following fixes from 2.0.0:
   * Fixed a bug where comparing a value with an error (such as `2 is (3 + 'X')`) would suppress the error.
   * Fixed a bug where subtracting non-subtractable values (such as booleans) wouldn't produce an error, instead implicitly converting the values to numbers, and potentially producing the Javascript value `NaN`.
   * Fixed the bug where `(current-time:)` wouldn't pad the minutes value with a leading 0 when necessary, and '12' was printed as '0'.

### 1.2.3 changes (Jan 17, 2017):

#### Bugfixes

 * Fixed a bug where the "outline" `(textstyle:)` option didn't have the correct text colour when no background colour was present, making it appear solid black.
 * Fixed a bug where changer commands couldn't be added together more than once without the possibility of some of the added commands being lost.
 * Fixed a bug where `(pow:)` only accepted 1 value instead of 2, and, moreover, that it could return the Javascript value `NaN`, which Harlowe macros shouldn't be able to return.
 * Fixed a bug where the verbatim markup couldn't enclose a `]` inside a hook, a `}` inside the collapsing markup, or any of the formatting markup's closing tokens immediately after an opening token.
 * Fixed a bug where the Javascript in the resulting HTML files contained the Unicode non-character U+FFFE, causing encoding problems when the file is hosted on some older servers.

#### Alterations

 * Now, setting changer commands into variables no longer prevents the `(save-game:)` command from working.

### 1.2.2 changes (Feb 16, 2016):

#### Bugfixes

 * Fixed a bug where the `(textstyle:)` options "shudder", "rumble" and "fade-in-out", as well as all of `(transition:)`'s options, didn't work at all.
 * Fixed a long-standing bug where `(mouseover:)` affected elements didn't have a visual indicator that they could be moused-over (a dotted underline).
 * Fixed the `(move:)` macro corrupting past turns (breaking the in-game undo functionality) when it deletes array or datamap items.
 * Fixed the `<===` (left-align) markup token erasing the next syntactic structure to follow it.
 * Fixed a bug where attempting to print datamaps using `(print:)` produced a Javascript error.
 * Fixed a long-standing bug where spreading `...` datasets did not, in fact, arrange their values in sort order, but instead in parameter order.
 * Fixed a long-standing bug where a string containing an unmatched `)` inside a macro would abruptly terminate the macro.

#### Alterations

 * Giving an empty string to a macro that affects or alters all occurrences of the string in the passage text, such as `(replace:)` or `(click:)`, will now result in an error (because it otherwise won't affect any part of the passage).

### 1.2.1 changes (Nov 20, 2015):

#### Bugfix

 * Fixed a bug where `(if:)`, `(unless:)` and `(else-if:)` wouldn't correctly interact with subsequent `(else-if:)` and `(else:)` macro calls, breaking them. (Usage with boolean-valued macros such as `(either:)` was not affected.)

### 1.2.0 changes (Nov 08, 2015):

#### Bugfixes

 * Fixed a bug where links created by `(click:)` not having a tabindex, and thus not being selectable with the tab key (a big issue for players who can't use the mouse).
 * Fixed a bug where `(align: "<==")` couldn't be used at all, even inside another aligned hook.
 * Fixed a bug where errors for using changer macros (such as `(link:)`) detached from a hook were not appearing.
 * Fixed a bug where `(align:)` commands didn't have structural equality with each other - `(align:"==>")` didn't equal another `(align:"==>")`.
 * Fixed `(move:)`'s inability to delete items from arrays.
 * `(move: ?a into $a)` will now, after copying their text into `$a`, clear the contents of all `?a` hooks.

#### Alterations

 * It is now an error to use `(set:)` or `(put:)` macros, as well as `to` constructs, in expression position: `(set: $a to (set: $b to 1))` is now an error, as is `(set: $a to ($b to 1))`.
 * Now, setting a markup string to a `?hookSet` will cause that markup to be rendered in the hookset, instead of being used as raw text. For instance, `(set: ?hookSet to "//Golly//")` will put "*Golly*" into the hookset, instead of "//Golly//".
    * Also, it is now an error to set a `?hookSet` to a non-string.
 * `(if:)`/`(unless:)`/`(elseif:)`/`(else:)` now evaluate to changer commands, rather than booleans. This means, among other things, that you can now compose them with other changers: `(set: $a to (text-style: "bold") + (if: $audible is true))`, for instance, will create a style that is bold, and also only appears if the $audible variable had, at that time, been true. (Note: Changing the $audible variable afterward will not change the effect of the `$a` style.)

#### Additions

 * Now, authors can supply an array of property names to the "'s" and "of" property syntax to obtain a "slice" of the container. For instance, `(a: 'A','B','C')'s (a: 1,2)` will evaluate to a subarray of the first array, containing just 'A' and 'B'.
    * As well as creating subarrays, you can also get a slice of the values in a datamap - in effect, a subarray of the datamap's datavalues. You can do `(datamap:'Hat','Beret','Shoe','Clog','Sock','Long')'s (a: 'Hat','Sock')` to obtain an array `(a: 'Beret','Long')`.
    * Additionally, you can obtain characters from a string - "abcde"'s (a: 2,4) becomes the string "bd". Note that for convenience, slices of strings are also strings, not arrays of characters.
    * Combined with the `(range:)` macro, this essentially obsoletes the `(subarray:)` and `(substring:)` macros. However, those will remain for compatibility reasons for now.
 * `(link-reveal:)` is similar to `(link:)` except that the link text remains in the passage after it's been clicked - a desirable use-case which is now available. The code `(link-reveal:"Sin")[cerity]` features a link that, when clicked, makes the text become `Sincerity`. Note that this currently necessitates that the attached hook always appear after the link element in the text, due to how the attaching syntax works.
 * `(link-repeat:)` is similar to the above as well, but allows the link to be clicked multiple times, rerunning the markup and code within.
 * Also added `(link-replace:)` as an identical alias of the current `(link:)` macro, indicating how it differs from the others.

### 1.1.1 changes (Jul 06, 2015):

#### Bugfixes

 * Fixed a bug where hand-coded `<audio>` elements inside transitioning-in passage elements (including the passage itself) would, when the transition concluded, be briefly detached from the DOM, and thus stop playing.
 * Now, save files should be properly namespaced with each story's unique IFID - stories in the same domain will no longer share save files.
 * Fixed a bug where `(live:)` macros would run one iteration too many when their attached hook triggered a `(goto:)`. Now, `(live:)` macros will always stop once their passage is removed from the DOM.
 * Fixed a bug where `<` and a number, followed by `>`, was interpreted as a HTML tag. In reality, HTML tag names can never begin with numbers.
 * Fixed a bug where backslash-escapes in string literals stopped working (so `"The \"End\""` again produces the string `The "End"`). I don't really like this old method of escaping characters, because it hinders readability and isn't particularly scalable - but I let it be usable in 1.0.1, so it must persist until at least version 2.0.0.
 * Fixed a bug, related to the above, where the link syntax would break if the link text contained double-quote marks - such as `[["Stop her!"->Pursue]]`.

### 1.1.0 changes (Jun 19, 2015):

#### Bugfixes

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

#### Alterations

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

#### New Features

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

### 1.0.1 changes (Jan 01, 2015):

#### Bugfixes

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

#### Alterations

* Characters in rendered passages are no longer individually wrapped in `<tw-char>` elements, due to it breaking RTL text. This means CSS that styles individual characters currently cannot be used.
* Eliminated the ability to use property reference outside of macros - you can no longer do `$var's 1st`, etc. in plain passage text, without wrapping a `(print:)` around it.
* You can no longer attach text named properties to arrays using property syntax (e.g. `(set: $a's Garply to "grault")`). Only `1st`, `2ndlast`, etc. are allowed.
* Altered `is`, `is in` and `contains` to use compare-by-value. Now, instead of using JS's compare-by-reference semantics, Harlowe compares containers by value - that is, by checking if their contents are identical. This brings them into alignment with the copy-by-value semantics used by `(set:)` and such.

#### New Features

* Added the ability to property-reference arbitrary values, not just variables. This means that you can now use `(history:)'s last`, or `"Red"'s 1st` as expressions, without having to put the entity in a variable first.

### Compilation

Harlowe is a story format file, called `format.js`, which is used by Twine 2. The Twine 2 program bundles this format with authored story code and assets to produce standalone HTML games.

Use these commands to build Harlowe:

* `make`: As the JS files can be run directly in a browser without compilation (as is used by the test suite), this only builds the CSS file using `make css`.
* `make jshint`: Lints the JS source files. There is a Visual Studio Code plugin that runs JSHint automatically as you edit, which is what I use lately, but this is still available to use.
* `make css`: Builds the CSS file, `build/harlowe-css.css`, from the Sass sources. This is an intermediate build product whose contents are included in the final `format.js` file.
* `make docs`: Builds the official documentation file, `dist/harloweDocs.html`, deriving macro and markup definitions from specially-marked comments in the JS files.
* `make format`: Builds the Harlowe `format.js` file.
* `make all`: Builds the Harlowe `format.js` file, the documentation, and an example file, `dist/exampleOutput.html`, which is a standalone game that confirms that the story format is capable of being bundled by Twine 2 correctly.
* `make clean`: Deletes the `build` and `dist` directories and their contents.
* `make dirs`: Produces empty `build` and `dist` directories, which usually shouldn't be necessary.
