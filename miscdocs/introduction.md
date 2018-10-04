Introduction: Some of what's new in 3.0

Harlowe 3.0, while not as major an upgrade as 2.0, offers a few new features that deserve your attention:

* New form input macros have been added, similar to those available in Twine 1.4 and SugarCube. They use a new keyword, <a href="#type_bind">bind</a>, to automatically set a variable when they're interacted with.
  * (cycling-link:) reappears after a long absence since Twine 1.4.
  * (dropdown:) produces a dropdown menu.
* You can now attach changers to ordinary links and other commands, rather than just hooks.
* Passage transitions can now be changed on a per-link basis - instead of the normal fade-in, a number of other transitions can be used. Simply attach (t8n-depart:) or (t8n-arrive:) to the passage link.
* New transitions are available: "instant", "rumble", "slide-up", "slide-down", "slide-left", "slide-right" and "flicker".
* New `is a` and `matches` operators are available to compare data structures' similarity, or to check the <a href="#type_datatype">datatype</a> of variables.

For a complete list of changes and outlines of how to use the above features, consult the <a href="#changes_3.0.0-changes">change log</a> section.
