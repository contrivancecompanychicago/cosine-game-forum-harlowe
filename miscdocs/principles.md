Introduction 4: Three fundamentals of Harlowe

Harlowe is a markup language that you can apply to your Twine prose to make the prose interactive, non-linear, and game-like. This language's full contents of features may appear daunting, but all of its features revolve around the following three simple concepts, which, when understood, unlock understanding the rest of the language:

###1. Macros produce either commands, or data values

A macro is the basic unit of code. It is either a **command** that changes the game's state or the prose in some way, such as the (set:) macro that saves data to a variable, or the (link-goto:) macro that puts a link inside the prose, or it produces a **data value**, such as a number or a styling instruction. All of Harlowe's macros are either one or the other.

```
(set: $companion to "Gallifrey") This is a command.
(print: $companion) This is a command.
(lowercase: "SCREECH") This is a value (a string).
(a: 3,4,5) This is a value (an array).
(for: each _num, 1,2,3) This is a value (a changer).
```

###2. Attach values to hooks of text to change the text

To use macros to change your story's prose, you must place that prose between brackets, which make a **hook**. You can then attach one or more values to the front of the hook to change the prose. This syntactic structure is used for everything from text styling with (text-style:), to the narrative-branching of the (if:) macro, to more complex commands like (event:) or (for:).

```
(if: $ringStolen)[The ring, as expected, is gone.]
```
In the above example, an "if" statement is created by attaching the (if:) changer value to the square-bracketed hook.

###3. You can use anything that produces a value as if it was that value

```
(set: $text to "VALID")
(set: $slide to (transition:"slide-right"))

(lowercase: "VALID") This is valid.
(lowercase: "VAL" + "ID") This is valid.
(lowercase: "VAL" + (uppercase: "ID")) This is valid.
(lowercase: $text) This is valid.

(transition:"slide-right")[Welcome back.] This is valid.
$slide[Welcome back.] This is valid.
```

It is important, when you read example code in this documentation, not to assume that you're restricted to very specific ways of writing macros and expressions. Just because an example uses a variable, doesn't mean you can't instead use a plain value, or a macro that produces that value, in that exact same place. Variables and macros are interchangeable with the values they contain or produce – a variable containing a number can be used anywhere that a number could be used, as can a macro that produces a number. This means you have a wide range of expressiveness in writing your story's code - you can save values into variables simply to save having to write them in full repeatedly, and you can use data-choosing macros like (either:), (cond:), (nth:) and so forth nearly anywhere you want. Use whatever form is most suited to making your prose readable!
