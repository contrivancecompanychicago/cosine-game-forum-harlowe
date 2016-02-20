#Harlowe - the default [Twine 2](https://bitbucket.org/klembot/twinejs) story format.

Rough documentation is at http://twine2.neocities.org/

###2.0.0 changes (unreleased, still unstable):

####Bugfixes

 * Now, a `(print:)` command that contains a command will only execute the contained command if itself is actually displayed in the passage - the code `(set: $x to (print:(goto:'X')))` would formerly perform the (goto:) immediately, even though the (print:) was never displayed.
 * Now, datasets contained in other datasets should be printed correctly, listing their contents.
 * `(alert:)`, `(open-url:)`, `(reload:)` and `(goto-url:)` now correctly return command values rather than the non-Harlowe value `undefined`. This means that `(alert:)`'s' time of execution changes relative to `(prompt:)` and `(confirm:)` - `(set: $x to (prompt:"X"))` will display a JS dialog immediately, but `(set: $x to (alert:"X"))` will not - although this is conceptually reasonable given that `(prompt:)` and `(confirm:)` are essentially "input" commands obtaining data from the player, and `(alert:)` is strictly an "output" command.

####Alterations

 * Now, when working with non-positive numbers as computed indexes (such as `$array's (-1)`), Harlowe no longer uses `0` for `last`, `-1` for `2ndlast`, and so forth - instead, `-1` means `last`, `-2` means `2ndlast`, and using `0` produces an error. (So, `"Red"'s (-1)` produces "d", not "e".)
 * Hook-attached macros may now have whitespace and line breaks between them and their hooks. This means that `(if: $x)  [text]` and such are now syntactically acceptable - the whitespace is removed, and the macro is treated as if directly attached. (This means that, if after a macro call you have plain passage text that resembles a hook, you'll have to use the verbatim markup to keep it from being interpreted as such.)
 * Attaching invalid values to hooks, such as `(either:"String")[text]`, `(a:2,3,4)[text]` or `(set: $x to 1) $x[text]`, will now result in an error instead of printing both the value and the hook's contents.
 * Now, you can optionally put 'is' at the start of inequality operators - you can write `$a is < 3` as a more readable alternative to `$a < 3`. Also, `$a is not > 3` can be written as well, which negates the operator (making it behave like `$a is <= 3`).
 * Passage links can now be used as values inside macros - `(set: $x to [[Go down->Cellar]])` is now valid. You may recall that passage links are treated as equivalent to `(link-goto:)` macro calls. As such, `(set: $x to [[Go down->Cellar]])` is treated as identical to `(set: $x to (link-goto:"Go down","Cellar"))`.
 * Revision macros such as `(replace:)`, `(append:)` and `(prepend:)` can now accept multiple values: `(replace:?ape, ?hen)`, for instance, can affect both hooks equally, and `(replace:'red', 'green')` can affect occurrences of either string.
 * Fixed a bug where the "Story stylesheet" `<style>` element was attached between `<head>` and `<body>`. This should have had no obvious effects in any browser, but was untidy anyway.
 * Altered the CSS of `<tw-story>` to use vertical padding instead of vertical margins, and increased the line-height slightly.
 * Altered the CSS of `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>` and `<h6>` elements to have a slightly lower margin-top.
 * Using `contains` and `is in` on numbers and booleans (such as `12 contains "a"`) will now produce an error. Formerly, doing so would test whether the number equalled the other value. (The rationale for this was that, since the statement `"a" contains "a"` is the same as `"a" is "a"`, then so should it be for numbers and booleans, which arguably "contain" only themselves. However, this seems to be masking certain kinds of errors when incorrect or uninitialised variables or properties were used).

####Additions

 * Added column markup, which is, like aligner markup, a special single-line token indicating that the subsequent text should be separated into columns. They consist of a number of `|` marks, indicating the size of the column relative to the other columns, and a number of `=` marks surrounding it, indicating the size of the column's margins in CSS "em" units (which are about the width of a capital M). Separate each column's text with tokens like `|===` and `==||`, and end them with a final `|==|` token to return to normal page layout.
 * Added temporary variables, a special kind of variable that only exists inside the passage or hook in which they're `(set:)`. Outside of the passage or hook, they disappear. Simply use `_` instead of `$` as the sigil for variables - write `(set: _a to 2)`, `(if: _a > 1)`, etc. Their main purpose is to allow you to make "reusable" Twine code - code which can be pasted into any story, without accidentally overwriting any variables that the story has used. (For instance, suppose you had some code which uses the variable `$a` for some quick computation, but you pasted it into a story that already used `$a` for something else in another passage. If you use a temporary variable `_a` instead, this problem won't occur.)
   * Also note that temp variables that are `(set:)` inside hooks won't affect same-named temp variables outside them: `(set: _a to 1) |hook>[(set: _a to 2)]` will make `_a` be 2 inside the hook, but remain as 1 outside of it.
 * Lambdas (tentative name) are a new data type - they are, essentially, user-created functions. You can just think of them as "data converters" - reusable instructions to convert one or more values into different values. An example of their current (also tentative) syntax is `each _a, _b to _a *_b *2` - this creates a lambda that takes two values, puts them in the temporary variables `_a` and `_b`, and produces the result of multiplying them with each other and 2. This can potentially be saved and reused multiple times, keeping you from needing to write that specific expression over and over.
 * The only macro which uses lambdas, currently, is `(converted:)`. This takes a lambda as its first value, and any number of other values, and uses the lambda to convert the values, placing the results in an array. For instance, `(converted: each _material to _material + " Sword"), "Iron", "Wood", "Bronze", "Plastic")` will create an array of all those strings with " Sword" added to the end of each. (This macro is similar to Javascript's `map()` array method.)
 * Added the aliases `(dm:)` and `(ds:)` for `(datamap:)` and `(dataset:)`, respectively.
 * Added `(lowercase:)` and `(uppercase:)`, which take a string and convert it to all-lowercase or all-uppercase, as well as `(lowerfirst:)` and `(upperfirst:)`, which only convert the first non-whitespace character in the string and leave the rest untouched.
 * Added `(words:)`, which takes a string and produces an array of the words (that is, the sequences of non-whitespace characters) in it. For instance, `(words: "2 big one's")` produces `(a: "2", "big", "one's")`.

###1.2.2 changes (unreleased):

####Bugfixes

 * Fixed a bug where the `(textstyle:)` options "shudder", "rumble" and "fade-in-out", as well as all of `(transition:)`'s options, didn't work at all.
 * Fixed a long-standing bug where `(mouseover:)` affected elements didn't have a visual indicator that they could be moused-over (a dotted underline).
 * Fixed the `(move:)` macro corrupting past turns (breaking the in-game undo functionality) when it deletes array or datamap items.
 * Fixed the `<===` (left-align) markup token erasing the next syntactic structure to follow it.
 * Fixed a bug where attempting to print datamaps using `(print:)` produced a Javascript error.
 * Fixed a long-standing bug where spreading `...` datasets did not, in fact, arrange their values in sort order, but instead in parameter order.
 * Fixed a long-standing bug where a string containing an unmatched `)` inside a macro would abruptly terminate the macro.

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
 * Now, during every `(set:)` operation on a TwineScript collection such as a datamap or array, the entire collection is cloned and reassigned to that particular moment's variables. Thus, the collection can be rolled back when the undo button is pressed.
 * Fixed some bugs where "its" would sometimes be incorrectly parsed as "it" plus the text "s".
 * Fixed a bug where enchantment event handlers (such as those for `(click:)`) could potentially fail to load.
 * Fixed a bug where the verbatim syntax (backticks) didn't preserve spaces at the front and end of it.

####Alterations

 * Altered the collapsing whitespace syntax (`{` and `}`)'s handling of whitespace considerably.
    * Now, whitespace between multiple invisible elements, like `(set:)` macro calls, should be removed outright and not allowed to accumulate.
    * It can be safely nested inside itself.
    * It will also no longer collapse whitespace inside macros' strings, or HTML tags' attributes.
 * TwineScript strings are now Unicode-aware. Due to JavaScript's use of UCS-2 for string indexing, Unicode astral plane characters (used for most non-Latin scripts) are represented as 2 characters instead of a single character. This issue is now fixed in TwineScript: strings with Unicode astral characters will now have correct indexing, length, and `(substring:)` behaviour.
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
 * TwineScript now supports single trailing commas in macro calls. `(a: 1, 2,)` is treated the same as `(a: 1,2)`. This is in keeping with JS, which allows trailing commas in array and object literals (but not calls, currently).
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
* Altered `is`, `is in` and `contains` to use compare-by-value. Now, instead of using JS's compare-by-reference semantics, TwineScript compares containers by value - that is, by checking if their contents are identical. This brings them into alignment with the copy-by-value semantics used by `(set:)` and such.

####New Features

* Added the ability to property-reference arbitrary values, not just variables. This means that you can now use `(history:)'s last`, or `"Red"'s 1st` as expressions, without having to put the entity in a variable first.
