"use strict";
define(['jquery', 'utils', 'utils/operationutils', 'internaltypes/varref', 'internaltypes/twineerror'], ($, Utils, {objectName}, VarRef, TwineError) => {
	/*
		VarBinds provide a means for certain UI input macros like (textarea:) to bind changes to their contents
		to a variable.

		They are unobservable - attempts to store them or use them in any other macros must fail.
	*/

	/*
		Two-way binding macros work by waiting on this event handler, which fires when any variable set is
		performed. This only passes the object and name, as those macros can retrieve the current value
		from their own passed-in VarBind object.
	*/
	VarRef.on('set', (obj, name) => {
		/*
			For a deep data structure (set:), VarRef.on will fire set callbacks for every object in the
			chain: $a's b's c's d to 1 will produce 'set' callbacks for c, b, a and State.variables.
			We only care about the root - false positives created by altering a deep value in a datamap
			neighbouring the actual bound value don't really matter, as the twoWayBindEvent function should
			filter them out.
		*/
		if (obj.TwineScript_VariableStore) {
			/*
				Sadly, there isn't quite a more efficient way of sleuthing out every DOM element
				that could be a two-way bound interaction element, beyond a DOM query with an attachable attribute.
			*/
			$(Utils.storyElement).find('[data-2bind]').each((_,elem) => {
				elem = $(elem);
				/*
					Retrieve and run the twoWayBindEvent handler, which should've been installed by the macro.
				*/
				const d = elem.data('twoWayBindEvent');
				(typeof d === "function") && d(elem, obj, name);
			});
		}
	});
	
	/*d:
		Bind data

		A few macros that produce interactive elements, like (cycling-link:), have the ability to automatically update a variable whenever the
		player interacts with them. There needs to be a way to specify which variable these will update: simply giving the macro the variable
		itself, such as in `(cycling-link: $hat, "Poker visor", "Beret")`, won't work - the value that's currently inside `$hat` will be given
		instead, as one would expect for every other kind of macro. So, the `bind` keyword is needed to make your intent unambiguous:
		`bind $hat` produces a "bound variable".

		One can bind any kind of variable: story-wide variables like `$morality`, temp variables like `_glance`, and data values and positions
		inside them, like `$diary's 1st's event`. Once bound, the macro's element will set data to it automatically, as if by a series of
		unseen (set:)s or (move:)s.

		Two-way binds, created by the `2bind` syntax, enforce an equality that normal binds do not: whenever the variable changes outside
		of the element, such as by an `(event:)` macro, then the interaction element updates to match, if it can. Thus, there are two bindings
		between the data and the element using it: the variable updates when the element changes, and the element updates when the variable changes.

		Note that bound variables can't be (set:) into variables themselves, because there's no real point to doing so (and it could lead to
		a lot of undue confusion).

		| Operator | Purpose | Example
		|---
		| `bind` | Binds the named variable on the right. | `bind $weapon`, `bind _hat`, `bind $profile's age`
		| `2bind` | Double-binds the named variable on the right. | `2bind $weapon`, `2bind _hat`, `2bind $profile's age`
	*/
	const VarBind = Object.freeze({
		/*
			These should normally only appear during type signature error messages.
		*/
		TwineScript_TypeName: "a bound variable",
		TwineScript_ObjectName: "a bound variable",

		TwineScript_Unstorable: true,

		TwineScript_ToSource() {
			return (this.bind === "two way" ? "2" : "") + "bind " + this.varRef.TwineScript_ToSource();
		},

		/*
			Setting a value in a VarBind is fairly straightforward - simply set the varRef, and then pass up any errors.
		*/
		set(value) {
			const result = this.varRef.set(value);
			let error;
			if ((error = TwineError.containsError(result))) {
				return error;
			}
		},
		
		/*
			bind is either "one way" (the DOM element's first provided value is automatically selected and
			written to the variable) or "two way" (the macro's contained value determines which option in
			the DOM element is initially selected, and continues to affect the DOM element if the variable is remotely
			changed).
		*/
		create(varRef, bind = "one way") {
			/*
				Produce a user-facing error if a non-varRef was given.
				Since "bind" is just another operator, this can't be picked up in compilation until now.
			*/
			if (!VarRef.isPrototypeOf(varRef)) {
				return TwineError.create("operation", "I can only 'bind' a variable, not " + objectName(varRef) + ".");
			}
			if (varRef.error) {
				return varRef.error;
			}
			return Object.assign(Object.create(this), { varRef, bind });
		},
	});
	return VarBind;
});
