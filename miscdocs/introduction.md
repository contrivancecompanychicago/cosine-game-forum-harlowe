Introduction 2: 3.3.0: The relentless rush toward the present

*2022-06-20 - A message from Harlowe developer Leon Arnott*

Once again, thank you for using the Harlowe story format for Twine. As this (2022) is my 8th year of developing this programming language, my gratitude for my users deepens. Y'know, it seems like no matter how much work I sink into this, the amount of work still before me remains the same as ever. 3.2.0 once seemed fresh, pristine and stable, a break from the old and haggard past versions, and a grand leap into the present. Now, having finished 3.3.0, I look back to 3.2.0 and can only see it as ugly and unbearable as all that came before. It seems that I have to constantly rush forward in order to reach the present, to touch it for just a single moment. Alas, such is the life of a toolmaker, always ready to believe that the next reforging of their hammerhead will be the last.

3.2.0 was a frantic rush of new, long-desired features, such as an editor toolbar and custom macros. As such, 3.3.0 has taken a different tack, tuning up the basic game engine and giving additions to 
3.3.0 development has prioritised performance improvements. Many features that, until now, poorly scaled to large, data-rich stories, such as the game-saving system and basic macro execution, have been given much-needed optimisations. On a tangent, I'd like to emphasise something important: serious performance issues **should** be reported as bugs in Harlowe if you encounter them! Please, *please* report situations which cause excessive slowness in Harlowe stories, or else there's no guarantee I'll find out about it and fix it.

A second priority has been making debugging in Debug Mode better. Even though 3.2.0 added a lot of features to Debug Mode, I've tried to improve other parts of the debugging workflow in 3.3.0. The big feature in this respect is the new Replay system, which allows both error messages and successful Harlowe macro calls to be examined and 'replayed', to better understand how Harlowe understood and computed them. If a macro deep inside an expression returned a value you didn't expect it to, this can help you dig down and discover the discrepancy for yourself. In addition, 3.3.0 mostly eliminates the "Javascript error message" and adds new error messages for basic syntax errors, which had always been a blemish on Harlowe's user experience.

Of course, a couple handfuls of new macros and identifiers have been added, too. These fall into the following groups:
 * Shorthands for common idioms and use-cases (`turns`, `(visited:)`, `(partial:)`, `(dm-altered:)`).
 * "Missing" tools for certain feature sets (`(str-replaced:)` and `(str-find:)` for string manipulation, `(p-start:)` for patterns, `(click-rerun:)` and `(redirect:)` for links, etc).
 * Niche features with powerful ramifications (`(seed:)`, `(forget-undos:)`, `(scroll:)`).

And, of course, another huge cacophony of bugs, some years-old, have been dealt with in this release.

Do take care, of course, to watch out for bugs in this version. In particular, please report any bugs in the saving system - be it `(load-game:)` reproducibly failing in an unaltered story, or variables changing to bizarre values after `(load-game:)` has run.

For a complete list of changes and outlines of how to use the above features, consult the <a href="#section_changes">change log</a> section. **Pay special care to the <a href="#compatibility">compatibility</a> section if you are upgrading a story from 3.2.3!**
