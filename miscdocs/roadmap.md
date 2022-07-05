Appendix: Harlowe 4.0 roadmap

Since 3.0.0, I've been stockpiling ideas for breaking changes to the Harlowe language, and the next major version is where I intend to put them into reality. Here is a decent sample of a few of them. Note that there is no guarantee that any of these will ever be implemented quite as described.

 * **Virtual DOM**: Instead of the current naïve DOM manipulation that makes macros like `(live:)` and the various transitions rather brittle, even a basic virtual DOM would provide serious performance and stability improvements. This is likely to be the trickiest feature to implement, but there's no shying away from it now. 

 * **Eliminating enchantment wrappers from DOM structures**: This ties into the Virtual DOM, above, but a number of tough visual problems in Harlowe stem from `(enchant:)` and other macros having to add and remove wrappers from various elements in order to cause various CSS effects. Replacing these with better enchantment tracking and CSS style creation is somewhat overdue.

 * **Better handling of line breaks**: Past Harlowe versions have had a special case that reduces consecutive line breaks' cumulative heights, and while that has some aesthetic purpose, the resulting inconsistency has become too pesky and should really be removed. In addition to this, I want to try wrapping prose lines in DOM wrappers (not `<p>` elements per se, but something similar) and having those serve the purpose of breaking lines instead of `<br>`. This feeds into the previous feature as well, making `(line-style:)` more robust by eliminating the need for temporary wrappers.

 * Something I've been calling **"the syntax that should have been in 1.0"**: I've thought of a reform of the link syntax inspired by [Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md). Harlowe has long been bothered by the fact that links and hooks use the same glyphs, `[]`. This new feature would confront the issue head-on.
  * Placing `->` or `<-` inside any hook would transform it into a link, so you only need to type `[link->passage name]`. If you remove the passage name, then it becomes a "revealing" link `[link->]` that reveals the nearest hidden hook. Leaving off the link text (like `[->passage name]` or `[->]`) would turn it into a `(click:?page)` interaction instead of a textual link.
  * Also, like Ink, any unnamed unattached hooks inside the link text, like `["Really[?"]->]` would be removed when it is clicked.
  * The existing link syntax `[[link text->passage name]]` is partially compatible with this new syntax: it would simply become "a link entirely inside a hook". Of course, this means that attaching changers to these links would no longer behave as expected, but the basic syntax would still work as intended.
  * Finally, while the simple link syntax `[[link]]` (which would otherwise become "an anonymous hook inside a hook") will probably be kept around for historical reasons, authors would be recommended to use the aforementioned click-page interaction `[->link]` instead. All of these changes allow in-passage revealing links to be on the same footing as between-passage links, with both using the same basic syntax.
This all might seem a little abstract from just this high-level description, but I have high hopes for it and the story code it can enable.

 * In addition to the above, I also envision **new sequence hook syntax** that revives several ideas for text-revealing I'd had back in the Twine 1.4 days. The glyph `|` would split a hook into a "sequence" comprising a visible portion and several hidden portions - `[visible|hidden 1|hidden 2]`. Clicking any revealing links inside a visible portion `[visible [link->] portion|hidden portion]` would unlink the text, remove any unnamed unattached hooks in the visible portion, and reveal the next hidden portion.

 * **Comments that work both inside and outside macro calls**: I'm considering a special "comment" glyph, `--` (or possibly a new glyph like '!'), which turns the next element into a comment, which Harlowe will dutifully ignore. Place `--` in front of a hook to turn that entire hook into a "block comment", or place it in front of a macro call (both in-passage and inside a call) to ignore it altogether, without needing `(ignore:)`. Additionally, place it in front of any other code element, such as a number, to "cross it out". `(set: $hp to --3 2)` sets the variable to 2, ignoring the 3.

 * **Units as separate datatypes from numbers**: instead of the crude `s` and `ms` syntax for providing seconds to `(t8n-time:)` and other macros, having times be a special unit separate from numbers, and having sizing lines like `"==XX=="` be separate from strings, allows for better type signatures and error messages for built-in macros and custom macros alike.

 * **Eliminating the default 0 value for story-wide variables**: Not much to say, except that this has been in Harlowe since 1.0, and has had an overall negative effect on story debugging. Also, story-wide variables should really act more like temp variables instead of having a special case like this.

 * **Nullable `'s` and `of` syntax**: a feature that has long been on the horizon, this would let authors write something like `(set: $a to $b's? 1st)`, without an error occurring if $b doesn't have a `1st` value at all. The problem here has always been that it requires implementing a proper `None` value (distinct from `false`) for Harlowe, or else adding short-circuiting operators like "guard" and "default".

 * **Dropping Internet Explorer support**: It's sad to say, but supporting IE's older version of Javascript and CSS no longer seems like a worthwhile use of my development resources in the current browser landscape, so Harlowe 4.0 will likely drop support in favour of using the latest CSS as-is. Harlowe already provides features that only function outside of IE, so this shouldn't be entirely unexpected.

 * **Localisation**: Getting Harlowe up to the localisation standards of the Twine 2 user interface is also long overdue. While this will be slightly laborious (due to Harlowe's large amount of built-in message strings), it likely won't have the same infrastructural issues as other listed features (which is to say, the underlying game engine shouldn't be affected too much).

All that being said, here are a few things I will **not** be changing in 4.0:

 * 1-indexing for sequences, or any changes for the `1st` and `last` data names. (Even if I thought this was a problem, which I don't, it's a smidge late to change something so fundamental.)

 * Pass-by-value for everything, including data structures. (I remain adamant that pass-by-reference is simply not beginner-friendly.) I'll likely try to add more sophisticated [copy-on-write](https://en.wikipedia.org/wiki/Copy-on-write) optimisations, though, so that data structure copying is a bit more efficient.

And finally: Harlowe 4.0 currently has *no release date* and should *not* be expected any time before 2024.
