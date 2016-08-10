define(['jquery','macros', 'utils', 'utils/selectors', 'datatypes/colour', 'datatypes/changercommand', 'internaltypes/twineerror'],
($, Macros, {insensitiveName, assertMustHave, childrenProbablyInline}, Selectors, Colour, ChangerCommand, TwineError) => {
	"use strict";

	/*
		Built-in hook style changer macros.
		These produce ChangerCommands that apply CSS styling to their attached hooks.
		
		This module modifies the Macros module only, and exports nothing.
	*/
	/*d:
		Changer data
		
		Changer commands are similar to ordinary commands, but they only have an effect when they're attached to hooks,
		and modify the hook in a certain manner. Macros that work like this include (text-style:), (font:), (transition:),
		(text-rotate:), (hook:), (click:), (link:), and more.

		You can save changer commands into variables, and re-use them many times in your story:
		```
		(set: $robotic to (font:'Courier New'))
		$robotic[Hi, it's me. Your clanky, cold friend.]
		```

		Changer commands can be combined using the `+` operator: `(set: $x to (text-colour: red) + (font: "Skia"))` sets $x to a command
		that can make a hook's text red-coloured and in Skia. This command can be re-used over and over in your story, and
		is in essence a custom text style.

		```
		(set: $alertText to (font:"Courier New") + (text-style: "shudder") + (text-colour:"#e74"))
		$alertText[This text is red shuddering Courier New.]
		$alertText[Fuel warning: the petrol is upside-down.]
		$alertText[Social alert: no one read the emails you sent yesterday.]
		$alertText[Arithmetic error: I forgot my seven-times-tables.]
		```
	*/
	const
		{either, wrapped} = Macros.TypeSignature,
		IfTypeSignature = [wrapped(Boolean, "If you gave a number, you may instead want to check that the number is not 0. "
			+ "If you gave a string, you may instead want to check that the string is not \"\".")];

	/*
		A list of valid transition names. Used by (transition:).
	*/
	const validT8ns = ["dissolve", "shudder", "pulse"];

	Macros.addChanger
		/*d:
			(if: Boolean) -> Changer
			
			This macro accepts only booleans, and produces a command that can be attached to hooks
			to hide them "if" the value was false.
			
			Example usage:
			`(if: $legs is 8)[You're a spider!]` will show the `You're a spider!` hook if `$legs` is `8`.
			Otherwise, it is not run.
			
			Rationale:
			In a story with multiple paths or threads, where certain events could occur or not occur,
			it's common to want to run a slightly modified version of a passage reflecting the current
			state of the world. The (if:), (unless:), (else-if:) and (else:) macros let these modifications be
			switched on or off depending on variables, comparisons or calculations of your choosing.
			
			Alternatives:
			The (if:) macro is not the only attachment that can hide or show hooks! In fact,
			a variable that contains a boolean can be used in its place. For example:
			
			```
			(set: $isAWizard to $foundWand and $foundHat and $foundBeard)
			
			$isAWizard[You wring out your beard with a quick twisting spell.]
			You step into the ruined library.
			$isAWizard[The familiar scent of stale parchment comforts you.]
			```
			By storing a boolean inside `$isAWizard`, it can be used repeatedly throughout the story to
			hide or show hooks as you please.
			
			See also:
			(unless:), (else-if:), (else:)

			#basics 6
		*/
		("if",
			(_, expr) => ChangerCommand.create("if", [expr]),
			(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(unless: Boolean) -> Changer
			
			This macro is the negated form of (if:): it accepts only booleans, and returns
			a command that can be attached hooks to hide them "if" the value was true.
			
			For more information, see the documentation of (if:).

			#basics 7
		*/
		("unless",
			(_, expr) => ChangerCommand.create("unless", [!expr]),
			(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(else-if: Boolean) -> Changer
			
			This macro's result changes depending on whether the previous hook in the passage
			was shown or hidden. If the previous hook was shown, then this command hides the attached
			hook. Otherwise, it acts like (if:), showing the attached hook if it's true, and hiding it
			if it's false. If there was no preceding hook before this, then an error message will be printed.

			Example usage:
			```
			Your stomach makes {
			(if: $size is 'giant')[
			    an intimidating rumble!
			](else-if: $size is 'big')[
			    a loud growl
			](else:​)[
			    a faint gurgle
			]}.
			```
			
			Rationale:
			If you use the (if:) macro, you may find you commonly use it in forked branches of
			source: places where only one of a set of hooks should be displayed. In order to
			make this so, you would have to phrase your (if:) expressions as "if A happened",
			"if A didn't happen and B happened", "if A and B didn't happen and C happened", and so forth,
			in that order.
			
			The (else-if:) and (else:) macros are convenient variants of (if:) designed to make this easier: you
			can merely say "if A happened", "else, if B happened", "else, if C happened" in your code.
			
			Note:
			You may be familiar with the `if` keyword in other programming languages. Do heed this, then:
			the (else-if:) and (else:) macros need *not* be paired with (if:)! You can use (else-if:) and (else:)
			in conjunction with variable attachments, like so:
			```
			$married[You hope this warrior will someday find the sort of love you know.]
			(else-if: not $date)[You hope this warrior isn't doing anything this Sunday (because
			you've got overtime on Saturday.)]
			```
			
			See also:
			(if:), (unless:), (else:)

			#basics 8
		*/
		("elseif", (section, expr) => {
			/*
				This and (else:) check the lastHookShown expando
				property, if present.
			*/
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's no (if:) or something else before this to do (else-if:) with.");
			}
			return ChangerCommand.create("elseif", [section.stack[0].lastHookShown === false && !!expr]);
		},
		(d, expr) => d.enabled = d.enabled && expr,
		IfTypeSignature)
		
		/*d:
			(else:) -> Changer
			
			This is a convenient limited variant of the (else-if:) macro. It will simply show
			the attached hook if the preceding hook was hidden, and hide it otherwise.
			If there was no preceding hook before this, then an error message will be printed.
			
			Rationale:
			After you've written a series of hooks guarded by (if:) and (else-if:), you'll often have one final
			branch to show, when none of the above have been shown. (else:) is the "none of the above" variant
			of (else-if:), which needs no boolean expression to be provided. It's essentially the same as
			`(else-if: true)`, but shorter and more readable.
			
			For more information, see the documentation of (else-if:).
			
			Note:
			Due to a mysterious quirk, it's possible to use multiple (else:) macro calls in succession:
			```
			$isUtterlyEvil[You suddenly grip their ankles and spread your warm smile into a searing smirk.]
			(else:​)[In silence, you gently, reverently rub their soles.]
			(else:​)[Before they can react, you unleash a typhoon of tickles!]
			(else:​)[They sigh contentedly, filling your pious heart with joy.]
			```
			This usage can result in a somewhat puzzling passage source structure, where each (else:) hook
			alternates between visible and hidden depending on the first such hook. So, it is best avoided.

			#basics 9
		*/
		("else", (section) => {
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's nothing before this to do (else:) with.");
			}
			return ChangerCommand.create("else", [section.stack[0].lastHookShown === false]);
		},
		(d, expr) => d.enabled = d.enabled && expr,
		null)

		/*d:
			(hook: String) -> Changer
			A command that allows the author to give a hook a computed tag name.
			
			Example usage:
			`(hook: $name)[]`
			
			Rationale:
			You may notice that it isn't possible to attach a nametag to hooks with commands
			already attached - in the case of `(font:"Museo Slab")[The Vault]<title|`, the nametag results
			in an error. This command can be added with other commands to allow the hook to be named:
			`(font:"Museo Slab")+(hook: "title")`.
			
			Furthermore, unlike the nametag syntax, (hook:) can be given any string expression:
			`(hook: "eyes" + (string:$eyeCount))` is valid, and will, as you'd expect, give the hook
			the name of `eyes1` if `$eyeCount` is 1.

			#styling
		*/
		(["hook"],
			(_, name) => ChangerCommand.create("hook", [name]),
			(d, name) => d.attr.push({name: name}),
			[String]
		)

		/*d:
			(transition: String) -> Changer
			Also known as: (t8n:)
			
			A command that applies a built-in CSS transition to a hook as it appears.
			
			Example usage:
			`(transition: "pulse")[Gleep!]` makes the hook `[Gleep!]` use the "pulse" transition
			when it appears.
			
			Details:
			At present, the following text strings will produce a particular transition:
			* "dissolve" (causes the hook to gently fade in)
			* "shudder" (causes the hook to instantly appear while shaking back and forth)
			* "pulse" (causes the hook to instantly appear while pulsating rapidly)
			
			All transitions are 0.8 seconds long, unless a (transition-time:) command is added
			to the command.
			
			See also:
			(text-style:), (transition-time:)

			#styling
		*/
		(["transition", "t8n"],
			(_, name) => {
				name = insensitiveName(name);
				if (validT8ns.indexOf(name) === -1) {
					return TwineError.create(
						"macrocall",
						"'" + name + '" is not a valid (transition:)',
						"Only the following names are recognised (capitalisation and hyphens ignored): "
							+ validT8ns.join(", "));
				}
				return ChangerCommand.create("transition", [name]);
			},
			(d, name) => {
				d.transition     = name;
				return d;
			},
			[String]
		)

		/*d:
			(transition-time: Number) -> Changer
			Also known as: (t8n-time:)
			
			A command that, when added to a (transition:) command, adjusts the time of the transition.

			Example usage:
			`(set: $slowTransition to (transition:"shudder") + (transition-time: 2s))` creates a transition
			style which uses "shudder" and takes 2 seconds.

			Details:
			Much like (live:), this macro should be given a number of milliseconds (such as `50ms`) or seconds
			(such as `10s`). Providing 0 or fewer seconds/milliseconds is not permitted and will result in an error.

			See also:
			(transition:)

			#styling
		*/
		(["transition-time", "t8n-time"],
			(_, time) => {
				if (time <= 0) {
					return TwineError.create(
						"macrocall",
						"(transition-time:) should be a positive number of (milli)seconds, not " + time);
				}
				return ChangerCommand.create("transition-time", [time]);
			},
			(d, time) => {
				d.transitionTime     = time;
				return d;
			},
			[Number]
		)
		
		/*d:
			(font: String) -> Changer
			
			This styling command changes the font used to display the text of the attached hook. Provide
			the font's family name (such as "Helvetica Neue" or "Courier") as a string.

			Example usage:
			`(font:"Skia")[And what have we here?]`

			Details:
			Currently, this command will only work if the font is available to the player's browser.
			If font files are embedded in your story stylesheet using base64 (an explanation for which
			is beyond the scope of this macro's description) then it can be uses instead.

			No error will be reported if the provided font name is not available, invalid or misspelled.

			See also:
			(text-style:)

			#styling
		*/
		("font",
			(_, family) => ChangerCommand.create("font", [family]),
			(d, family) => {
				d.styles.push({'font-family': family});
				return d;
			},
			[String]
		)
		
		/*d:
			(align: String) -> Changer
			
			This styling command changes the alignment of text in the attached hook, as if the
			`===>`~ arrow syntax was used. In fact, these same arrows (`==>`~, `=><=`~, `<==>`~, `====><=`~ etc.)
			should be supplied as a string to specify the degree of alignment.

			Example usage:
			`(align: "=><==")[Hmm? Anything the matter?]`

			Details:
			Hooks affected by this command will take up their own lines in the passage, regardless of
			their placement in the story prose. This allows them to be aligned in the specified manner.

			#styling
		*/
		("align",
			(_, arrow) => {
				/*
					I've decided to reimplement the aligner arrow parsing algorithm
					used in markup/Markup and Renderer here for decoupling purposes.
				*/
				let style,
					centerIndex = arrow.indexOf("><");
				
				if (!/^(==+>|<=+|=+><=+|<==+>)$/.test(arrow)) {
					return TwineError.create('macrocall', 'The (align:) macro requires an alignment arrow '
						+ '("==>", "<==", "==><=" etc.) be provided, not "' + arrow + '"');
				}
				
				if (~centerIndex) {
					/*
						Find the left-align value
						(Since offset-centered text is centered,
						halve the left-align - hence I multiply by 50 instead of 100
						to convert to a percentage.)
					*/
					const alignPercent = Math.round(centerIndex / (arrow.length - 2) * 50);
					style = Object.assign({
							'text-align'  : 'center',
							'max-width'   : '50%',
						},
						/*
							25% alignment is centered, so it should use margin-auto.
						*/
						(alignPercent === 25) ? {
							'margin-left' : 'auto',
							'margin-right': 'auto',
						} : {
							'margin-left' : alignPercent + '%',
					});
				}
				else if (arrow[0] === "<" && arrow.slice(-1) === ">") {
					style = {
						'text-align'  : 'justify',
						'max-width'   : '50%',
					};
				}
				else if (arrow.includes(">")) {
					style = {
						'text-align'  : 'right'
					};
				}
				else {
					/*
						If this is nested inside another (align:)-affected hook,
						this is necessary to assert leftward alignment.
					*/
					style = {
						'text-align'  : 'left'
					};
				}
				// This final property is necessary for margins to appear.
				style.display = 'block';
				return ChangerCommand.create("align", [style]);
			},
			(d, style) => {
				d.styles.push(style);
			},
			[String]
		)
		
		/*d:
			(text-colour: String or Colour) -> Changer
			Also known as: (colour:), (text-color:), (color:)

			This styling command changes the colour used by the text in the attached hook.
			You can supply either a string with a CSS-style colour (a colour name or
			RGB number supported by CSS), or a built-in colour object.

			Example usage:
			`(colour: red + white)[Pink]` combines the built-in red and white colours to make pink.
			`(colour: "#696969")[Gray]` uses a CSS-style colour to style the text gray.

			Details:
			This macro only affects the text colour. To change the text background, call upon
			the (background:) macro.

			See also:
			(background:)

			#styling
		*/
		(["text-colour", "text-color", "color", "colour"],
			(_, CSScolour) => {
				/*
					Convert TwineScript CSS colours to bad old hexadecimal.
					This is important as it enables the ChangerCommand to be serialised
					as a string more easily.
				*/
				if (Colour.isPrototypeOf(CSScolour)) {
					CSScolour = CSScolour.toRGBAString(CSScolour);
				}
				return ChangerCommand.create("text-colour", [CSScolour]);
			},
			(d, CSScolour) => {
				d.styles.push({'color': CSScolour});
				return d;
			},
			[either(String, Colour)]
		)
		/*d:
			(text-rotate: Number) -> Changer

			This styling command visually rotates the attached hook clockwise by a given number of
			degrees. The rotational axis is in the centre of the hook.

			Example usage:
			`(text-rotate:45)[Tilted]` will produce <span style="display:inline-block;transform:rotate(45deg);">Tilted</span>
			
			Details:

			The surrounding non-rotated text will behave as if the rotated text is still in its original position -
			the horizontal space of its original length will be preserved, and text it overlaps with vertically will
			ignore it.

			A rotation of 180 degrees will, due to the rotational axis, flip the hook upside-down and back-to-front, as
			if the (text-style:) styles "mirror" and "upside-down" were both applied.

			Due to browser limitations, hooks using this macro will have its CSS `display` attribute
			set to `inline-block`.

			See also:
			(text-style:)

			#styling
		*/
		("text-rotate",
			(_, rotation) => ChangerCommand.create("text-rotate", [rotation]),
			(d, rotation) => {
				d.styles.push({display: 'inline-block', 'transform'() {
					let currentTransform = $(this).css('transform') || '';
					if (currentTransform === "none") {
						currentTransform = '';
					}
					return currentTransform + " rotate(" + rotation + "deg)";
				}});
				return d;
			},
			[Number]
		)
		/*d:
			(background: Colour or String) -> Changer

			This styling command alters the background colour or background image
			of the attached hook. Supplying a colour, or a string contanining a CSS
			hexadecimal colour (such as `#A6A612`) will set the background to a flat colour.
			Other strings will be interpreted as an image URL, and the background will be
			set to it.

			Example usage:
			* `(background: red + white)[Pink background]`
			* `(background: "#663399")[Purple background]`
			* `(background: "marble.png")[Marble texture background]`

			Details:
			
			Combining two (background:) commands will do nothing if they both influence the
			colour or the image. For instance `(background:red) + (background:white)` will simply
			produce the equivalent `(background:white)`. However, `(background:red) + (background:"mottled.png")`
			will work as intended if the background image contains transparency, allowing the background
			colour to appear through it.

			Currently, supplying other CSS colour names (such as `burlywood`) is not
			permitted - they will be interpreted as image URLs regardless.

			No error will be reported if the image at the given URL cannot be accessed.

			See also:
			(colour:)

			#styling
		*/
		("background",
			(_, value) => {
				//Convert TwineScript CSS colours to bad old hexadecimal.
				if (Colour.isPrototypeOf(value)) {
					value = value.toRGBAString(value);
				}
				return ChangerCommand.create("background", [value]);
			},
			(d, value) => {
				let property;
				/*
					Different kinds of values can be supplied to this macro
				*/
				if (Colour.isHexString(value) || Colour.isCSS3Function(value)) {
					property = {"background-color": value};
				}
				else {
					/*
						When Harlowe can handle base64 image passages,
						this will invariably have to be re-worked.
					*/
					/*
						background-size:cover allows the image to fully cover the area
						without tiling, which I believe is slightly more desired.
					*/
					property = {"background-size": "cover", "background-image":"url(" + value + ")"};
				}
				d.styles.push(property,
					/*
						We also need to alter the "display" property in a case where the element
						has block children - the background won't display if it's kept as initial.
					 */
					{ display() { return childrenProbablyInline($(this)) ? "initial" : "block"; } });
				return d;
			},
			[either(String,Colour)]
		)
		
		/*d:
			(text-style: String) -> Changer
			
			This applies a selected built-in text style to the hook's text.
			
			Example usage:
			`The shadow (text-style: "shadow")[flares] at you!` will style the word "flares" with a shadow.
			
			`(set: $s to (text-style: "shadow")) The shadow $s[flares] at you!` will also style it with a shadow.
			
			Rationale:
			While Twine offers markup for common formatting styles like bold and italic, having these
			styles available from a command macro provides some extra benefits: it's possible, as with all
			such style macros, to (set:) them into a variable, combine them with other commands, and re-use them
			succinctly throughout the story (by using the variable in place of the macro).
			
			Furthermore, this macro also offers many less common but equally desirable styles to the author,
			which are otherwise unavailable or difficult to produce.
			
			Details:
			At present, the following text strings will produce a particular style.

			| String | Example
			|---
			| "bold"           | <t-s style="font-weight:bold"></t-s>
			| "italic"         | <t-s style="font-style:italic"></t-s>
			| "underline"      | <t-s style="text-decoration: underline"></t-s>
			| "strike"         | <t-s style="text-decoration: line-through"></t-s>
			| "superscript"    | <t-s style="vertical-align:super;font-size:.83em"></t-s>
			| "subscript"      | <t-s style="vertical-align:sub;font-size:.83em"></t-s>
			| "mark"           | <t-s style="background-color: hsla(60, 100%, 50%, 0.6)"></t-s>
			| "outline"        | <t-s style="color:white; text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px  1px 0 black, 1px  1px 0 black"></t-s>
			| "shadow"         | <t-s style="text-shadow: 0.08em 0.08em 0.08em black"></t-s>
			| "emboss"         | <t-s style="text-shadow: 0.08em 0.08em 0em black"></t-s>
			| "condense"       | <t-s style="letter-spacing:-0.08em"></t-s>
			| "expand"         | <t-s style="letter-spacing:0.1em"></t-s>
			| "blur"           | <t-s style="text-shadow: 0em 0em 0.08em black; color:transparent"></t-s>
			| "blurrier"       | <t-s style="text-shadow: 0em 0em 0.2em black; color:transparent"></t-s>
			| "smear"          | <t-s style="text-shadow: 0em 0em 0.02em black, -0.2em 0em 0.5em black, 0.2em 0em 0.5em black; color:transparent"></t-s>
			| "mirror"         | <t-s style="display:inline-block;transform:scaleX(-1)"></t-s>
			| "upside-down"    | <t-s style="display:inline-block;transform:scaleY(-1)"></t-s>
			| "blink"          | <t-s style="animation:fade-in-out 1s steps(1,end) infinite alternate"></t-s>
			| "fade-in-out"    | <t-s style="animation:fade-in-out 2s ease-in-out infinite alternate"></t-s>
			| "rumble"         | <t-s style="display:inline-block;animation:rumble linear 0.1s 0s infinite"></t-s>
			| "shudder"        | <t-s style="display:inline-block;animation:shudder linear 0.1s 0s infinite"></t-s>
			
			Due to browser limitations, hooks using "mirror", "upside-down", "rumble" or "shudder" will have its CSS `display`
			attribute set to `inline-block`.

			See also:
			(css:)
			
			#styling
		*/
		/*
			For encapsulation, the helpers that these two methods use are stored inside
			this closure, and used in the addChanger call.
		*/
		(...(() => {
				var
					/*
						This is a shorthand used for the definitions below.
					*/
					colourTransparent =  { color: "transparent", },
					/*
						These map style names, as input by the author as this macro's first argument,
						to CSS attributes that implement the styles. These are all hand-coded.
					*/
					styleTagNames = Object.assign(Object.create(null), {
						bold:         { 'font-weight': 'bold' },
						italic:       { 'font-style': 'italic' },
						underline:    { 'text-decoration': 'underline' },
						strike:       { 'text-decoration': 'line-through' },
						superscript:  { 'vertical-align': 'super', 'font-size': '.83em' },
						subscript:    { 'vertical-align': 'sub', 'font-size': '.83em' },
						blink: {
							animation: "fade-in-out 1s steps(1,end) infinite alternate",
							// .css() handles browser prefixes by itself.
						},
						shudder: {
							animation: "shudder linear 0.1s 0s infinite",
							display: "inline-block",
						},
						mark: {
							'background-color': 'hsla(60, 100%, 50%, 0.6)',
						},
						condense: {
							"letter-spacing": "-0.08em",
						},
						expand: {
							"letter-spacing": "0.1em",
						},
						outline: [{
								"text-shadow"() {
									const colour = $(this).css('color');
									return "-1px -1px 0 " + colour
										+ ", 1px -1px 0 " + colour
										+ ",-1px  1px 0 " + colour
										+ ", 1px  1px 0 " + colour;
								},
							},
							{
								color() {
									/*
										To correctly identify the background colour of this element, iterate
										upward through all the elements containing it.
									*/
									for (let elem = $(this); elem.length && elem[0] !== document; elem = elem.parent()) {
										const colour = elem.css('background-color');
										/*
											Browsers represent the colour "transparent" as either "transparent",
											hsla(n, n, n, 0) or rgba(n, n, n, 0).
										*/
										if (colour !== "transparent" && !colour.match(/^\w+a\(.+?,\s*0\s*\)$/)) {
											return colour;
										}
									}
									/*
										If there's no colour anywhere, assume this is a completely unstyled document.
									*/
									return "#fff";
								},
							}
						],
						shadow: {
							"text-shadow"() { return "0.08em 0.08em 0.08em " + $(this).css('color'); },
						},
						emboss: {
							"text-shadow"() { return "0.08em 0.08em 0em " + $(this).css('color'); },
						},
						smear: [{
								"text-shadow"() {
									const colour = $(this).css('color');
									return "0em   0em 0.02em " + colour + ","
										+ "-0.2em 0em  0.5em " + colour + ","
										+ " 0.2em 0em  0.5em " + colour;
								},
							},
							// Order is important: as the above function queries the color,
							// this one, eliminating the color, must run afterward.
							colourTransparent
						],
						blur: [{
								"text-shadow"() { return "0em 0em 0.08em " + $(this).css('color'); },
							},
							colourTransparent
						],
						blurrier: [{
								"text-shadow"() { return "0em 0em 0.2em " + $(this).css('color'); },
								"user-select": "none",
							},
							colourTransparent
						],
						mirror: {
							display: "inline-block",
							transform: "scaleX(-1)",
						},
						upsidedown: {
							display: "inline-block",
							transform: "scaleY(-1)",
						},
						fadeinout: {
							animation: "fade-in-out 2s ease-in-out infinite alternate",
						},
						rumble: {
							animation: "rumble linear 0.1s 0s infinite",
							display: "inline-block",
						},
					});
				
				return [
					"text-style",
					(_, styleName) => {
						/*
							The name should be insensitive to normalise both capitalisation,
							and hyphenation of names like "upside-down".
						*/
						styleName = insensitiveName(styleName);
						
						if (!(styleName in styleTagNames)) {
							return TwineError.create(
								"macrocall",
								"'" + styleName + '" is not a valid (textstyle:)',
								"Only the following names are recognised (capitalisation and hyphens ignored): "
									+ Object.keys(styleTagNames).join(", "));
						}
						return ChangerCommand.create("text-style", [styleName]);
					},
					(d, styleName) => {
						assertMustHave(styleTagNames,[styleName]);
						d.styles = d.styles.concat(styleTagNames[styleName]);
						return d;
					}
				];
			})(),
			[String]
		)
		
		/*d:
			(css: String) -> Changer
			
			This takes a string of inline CSS, and applies it to the hook, as if it
			were a HTML "style" property.
			
			Usage example:
			```
			(css: "background-color:indigo")
			```
			
			Rationale:
			The built-in macros for layout and styling hooks, such as (text-style:),
			are powerful and geared toward ease-of-use, but do not entirely provide
			comprehensive access to the browser's styling. This changer macro allows
			extended styling, using inline CSS, to be applied to hooks.
			
			This is, however, intended solely as a "macro of last resort" - as it requires
			basic knowledge of CSS - a separate language distinct from Harlowe - to use,
			and requires it be provided a single inert string, it's not as accommodating as
			the other such macros.
			
			See also:
			(text-style:)

			#styling
		*/
		("css",
			(_, text) => {
				/*
					Add a trailing ; if one was neglected. This allows it to
					be concatenated with existing styles.
				*/
				if (!text.trim().endsWith(";")) {
					text += ';';
				}
				return ChangerCommand.create("css", [text]);
			},
			(d, text) => {
				d.attr.push({'style'() {
					return ($(this).attr('style') || "") + text;
				}});
				return d;
			},
			[String]
		)
		;
});
