Introduction 3: What Harlowe does best

Harlowe is one of a small handful of story formats offered in Twine. Each has its own specific focus and audience. Harlowe is designed for the following kind of author and work.

### No HTML, Javascript or CSS experience needed

At its core, Harlowe's language is designed to assist authors with no familiarity with HTML, Javascript or CSS. Rather than requiring knowledge of all three languages, Harlowe provides a single language that fulfills the basic needs of all three and whose parts seamlessly integrate.

Use layout syntax, such as columns and aligners, to provide structure and composition to your prose. Harlowe contains special values that represent one or more CSS styles bundled together for convenience. Attach them to single runs of prose to provide the equivalent of inline styles, or use variables or the (change:) or (enchant:) macros to globally affect certain labeled structures. Harlowe's coding language, inside macro calls, smooths over the pitfalls and discrepancies of Javascript - better type-checking and clearer syntax prevents obvious datatype bugs like `1 + "1"`, `1 == "1"` or `if (a = 1)`, more plentiful error messages replace silent failures and junk values like `NaN` or `undefined`, different data structures each use the same setting, getting and checking syntax, and the styling datatypes are easily handled alongside other data. Styles can be combined by simply adding them together, for instance, and computed based on the current game state.

Though, if you already have HTML, Javascript or CSS experience, and would prefer to leverage that experience as you create, you may wish to use [SugarCube](https://www.motoslave.net/sugarcube/2/) instead, which provides more direct access to the page's HTML elements and to the Javascript language.

### Dynamic hypertext as a focus

I have a deep admiration for the storytelling potential of early and recent hypertext mediums, such as HyperCard, Shockwave, Flash, and early HTML fiction, and I have kept their versatility in mind when creating Harlowe. Harlowe heavily encourages you to think of a page as a dynamic interactive space, not just a sequence of prose followed by choices. Harlowe encourages you to place links and interactive elements in the midst of prose, not just at the end, and to use them to change the prose in surprising and unusual ways - inserting or removing text in a previously-read paragraph, changing the styling of words, changing just the link itself, and other such effects to reveal new meaning in the text and communicate your story in a manner unique to hypertext. If you would like to explore the storytelling potential of hypertext, it is my dear hope that you will find Harlowe satisfying.

Though, if you would prefer a more traditional, branching style of interactive prose writing, you may wish to use [Chapbook](https://klembot.github.io/chapbook/guide/) or a non-Twine language like [Ink](https://www.inklestudios.com/ink/) instead.

### Programming depth available when you need it

Don't let the preceding sections lead you to believe Harlowe is narrowly limited as a programming environment. Despite crafting Harlowe as a language apart from Javascript, I've nonetheless equipped it with tools and utilities to handle dense data manipulation. A wide collection of conversion macros and syntactic structures exist to convert and manipulate arrays, strings, and maps, including a lambda syntax, and the (macro:) macro lets you sculpt a personal sub-language within Harlowe. In addition, the Debug Mode gives you a live view of variables, styles, and game state as the story progresses. While these are not meant to be immediately useful to the first-time author, one who has grown more ambitious in their time with Harlowe may call upon them to make more computationally complicated stories, such as basic role-playing games. As you grow in programming confidence, Harlowe can follow you.

### No specific simulation elements

Interactive fiction is commonly associated with text adventure games with a high degree of spatial simulation and procedurally generated text, where you control a player-character and manipulate objects and navigate rooms. Harlowe (and the other Twine story formats) is intended for a much wider variety of stories with a much lighter amount of interaction with the story's inner world, and as such it does not contain pre-built programming constructs for rooms, objects, inventories, manipulation verbs, and other common design affordances of text adventures. If you would prefer to write a story with a higher degree of simulation and interaction, you may wish to use a non-Twine language like [Inform](http://inform7.com/) instead.
