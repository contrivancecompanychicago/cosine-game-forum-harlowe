Introduction 5: Example stories

Here are a few example stories, written by me, Leon, and designed to be downloaded and opened in the Twine editor for reference and experimentation. These stories' prose and Harlowe code (though, of course, not the Harlowe engine itself) are entirely public domain - use their contents for your own projects as you wish.

### [Quack of Duckness](./Quack_of_Duckness.html) <a href="./Quack_of_Duckness.html" download="Quack of Duckness.html">[download]</a>.

This is a parody of the [example story](https://klembot.github.io/chapbook/examples/cloak-of-darkness.html) for the Chapbook story format, "Cloak of Darkness". This demonstrates several basic Harlowe features:

* Using variables to track the player's actions.
* Using (if:) with the "visits" keyword to display text only once.
* Using (click-append:) to add a link in the middle of a paragraph.
* Using (transition:) to alter the transition of a hook, both as an attached changer and as an additional value given to (click-append:).
* Using a boolean variable to enable a hook, similar to (if:).
* Using escaped line break syntax to control whitespace in the story.
* Using "footer" tagged passages to place text beneath every passage in the story.
* Using (enchant:) with (t8n-depart:) and (t8n-arrive:) inside a "footer" tagged passage to affect the transition of every passage link in the story.
* Using (append:) with the ?sidebar hook name to add icons to the sidebar.

Additionally, it contains an extra passage with a "character creator" board, which allows players to spend statistic points to increase character attributes, in the manner of an RPG. This board makes use of these features:
* Using named hooks and (rerun:) to alter a statistical readout whenever the player modifies one of the statistics.
* Using temp variables to store complicated commands such as (link:) that need to be used multiple times in the passage.

### [The Basics of TBC](./The_Basics_of_TBC.html) <a href="./The_Basics_of_TBC.html" download="The Basics of TBC.html">[download]</a>.

This demonstrates how one would implement a very simple 1-vs-1 turn-based-combat (TBC) engine in Harlowe, in the manner of an RPG. It provides examples of the following features:

* Using (click:) with ?page to only advance the story when the mouse is clicked.
* Using custom macros to reduce the amount of overall code that needs to be written.
* Using temp variables to store calculated values that are used further down the passage.
* Using datamaps (created via (dm:)) to greatly simplify the process of defining unique turn-based-combat opponents, as well as reducing the amount of variables that need to be created to store data relating to the battle's state.
* Using arrays (created via (a:)) to store sequential data, and using (move:) and (rotated:) to change the first value of those arrays.

### [Styling with Enchantments](./Styling_with_Enchantments.html) <a href="./Styling_with_Enchantments.html" download="Styling with Enchantments.html">[download]</a>.

This demonstrates a number of ways you can style your stories without needing to use CSS stylesheets. All of the styles in this story are coded in separate passages, and their code is free to use in your stories. They provide examples of the following features:

* Using (enchant:) with ?page, ?passage and ?link to alter the visual presentation of various parts of the page.
* Using (hover-style:) to change how links appear when the mouse hovers over them.
* Using (background:) with (gradient:) and (stripes:).
* Using (hide:) and (replace:) with ?sidebar to alter the sidebar.

Enjoy the examples!
