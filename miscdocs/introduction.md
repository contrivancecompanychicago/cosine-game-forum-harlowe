Introduction 2: Welcome to the world of 3.2.0

Dear fellow author of hypertext fiction: this version of Harlowe is most unlike others before it - despite a commitment to backwards-compatibility letting it be numbered a "minor" release, its wealth of added features is truly incredible. Let me explain in brief how this came to be. In April 2020, as the COVID-19 pandemic death toll (and the even greater permanent disability toll) was steadily rising worldwide, I came to something of a quiet realisation... that it was very possible I would not live to the end of this year, and, furthermore, it was probable that many Harlowe users would not live to the end of this year. I thought about Harlowe, and about how so much functionality I'd always envisioned for it - custom macros, string patterns, fullscreen support - was still unimplemented, and came to a decision that I absolutely had to finally get all of it in, this year.

So, I worked diligently on Harlowe for 9 months. In retrospect, it feels like my life lost all meaning except for Harlowe. Honestly, it was perhaps less like 9 months of productivity and more like a 9-month-long panic attack. (This is what most "COVID-19 productivity" stories are actually like, deep down. Please, don't admire me. Love yourself.)

But at the end, Harlowe finally became, for the first time, a hypertext fiction coding language I could be proud of. Even now, there's still some extra features I wish I'd been able to fit in, but this version feels like the first version where Harlowe is "complete", as my original vision for the story format in 2014 had resembled.

And now you get to enjoy all of this, and more.

 * A means of creating custom macros, using (macro:), (output:) and (output-hook:).
 * String patterns, an advanced means of matching strings comprehensively, that can be used with `matches` and the new (split:) and (trimmed:) macros.
 * Changers for creating block elements, (box:) and (float-box:), with the latter allowing you to overlay a box of text anywhere in the browser window.
 * Support for storylets as an alternative to hard-coded links between sections of a game, provided by (storylet:), (open-storylets:), and their related macros.
 * Macros for adding and creating the sidebar's icons, allowing you to freely customise it using (replace:) and other macros.
 * Several new interaction/UI command macros, such as (input-box:), (checkbox:) and (meter:).
 * (set:), (put:) and (move:) now support optional type-restrictions on variables.
 * A changer and a command for displaying text verbatim, (verbatim:) and (verbatim-print:).
 * Interaction macros for toggling fullscreen mode, (link-fullscreen:) and (icon-fullscreen:).
 * Assorted pieces of "missing" common functionality, like (rerun:), (link-rerun:), (text-size:), (border:), (opacity:) and (joined:).
 * A small selection of debugging-focused macros, such as (ignore:), (test-false:), (test-true:) and (assert:).
 * Additional features for Debug Mode, including an enchantments panel, buttons for producing the source code of variables, and a DOM View button that shows the basic HTML DOM structure of the page.
 * Heavily improved in-editor syntax highlighting that now colours macros by their datatype and can, if enabled, show tooltips for code structures.

And, most importantly, a new toolbar has been implemented for the Twine 2 editor that allows common Harlowe code idioms to be quickly created.

For a complete list of changes and outlines of how to use the above features, consult the <a href="#changes_3.2.0-changes">change log</a> section.
