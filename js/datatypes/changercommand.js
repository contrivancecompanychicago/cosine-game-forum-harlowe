"use strict";
define(['utils', 'utils/operationutils', 'internaltypes/changedescriptor', 'internaltypes/twineerror'], ({plural, impossible}, {is,toSource}, ChangeDescriptor, TwineError) => {
	/*
		A ChangerCommand is a command that is used to alter the way a particular
		Section renders the value. It does this by mutating a passed-in ChangeDescriptor
		object in some way.
		
		ChangerCommands are first-class values so that they can be saved and combined
		by the author to create "custom styles" for sections of story text.
		
		Other commands are generated by the macros in macrolib/commands.
	*/
	const
		// Private collection of command definitions, populated by register()
		commandRegistry = {};

	const ChangerCommand = {
		
		TwineScript_TypeID: "changer",

		TwineScript_TypeName:
			"a changer",
		
		TwineScript_Print() {
			return "`[A (" + this.macroName + ":) changer]`";
		},

		TwineScript_ToSource() {
			return "(" + this.macroName + ":"
				/*
					(else:) is an unfortunate special case that needs to be addressed.
				*/
				+ (this.name === "else" ? "": this.params.map(toSource))
				+ ")" + (this.next ? "+" + this.next.TwineScript_ToSource() : "");
		},

		get TwineScript_ObjectName() {
			/*
				Since most changer macros are 1-arity, it can pay to add the first param
				to the listing - there's a world of difference between a (text-style:'bold') macro and a (text-style:'upsidedown').
				Though, to avoid being misleading, this doesn't show the 1st of multiple params.
			*/
			let firstParam;
			if (this.params.length === 1) {
				firstParam = toSource(this.params[0]);
				if (firstParam.length > 36) {
					firstParam = undefined;
				}
			}
			let ret = `a (${this.macroName}:${firstParam || ''}) changer`;
			let {next} = this;
			if (next) {
				ret += " combined with ";
			}
			/*
				For each subsequent changer, display only its name.
			*/
			let count = 0;
			while (next && ret.length < 48) {
				const nextChanger = `(${next.macroName}:)`;
				ret += (count > 0 && !next.next ? ' and ' : '') + nextChanger + (next.next ? ", " : '');
				next = next.next;
				count += 1;
			}
			/*
				Add the "and X other changers" string based on the remaining changers in the linked list.
			*/
			let remainder = 0;
			while (next && remainder < 99) {
				next = next.next;
				remainder += 1;
			}
			if (remainder > 0) {
				ret += `${count > 0 ? ' and ' : ''}${plural(remainder, 'other changer')}`;
			}
			return ret;
		},
		
		/*
			This returns a summary of all ChangeDescriptor properties altered by this ChangerCommand,
			were it run against one. This delegates to ChangeDescriptor.summary(), which knows which
			properties a ChangeDescriptor normally has.
		*/
		summary() {
			const desc = ChangeDescriptor.create();
			this.run(desc);
			return desc.summary();
		},

		/*
			ChangerCommands are created and returned changer macro calls.
			The arguments passed to them are essentially direct representations
			of the macro call itself.
			For instance, (font: "Skia") would result in a call of
				ChangerCommand.create("font", ["Skia"])
		*/
		create(macroName, params = [], next = null, canEnchant = true) {
			if(!Array.isArray(params)) {
				impossible('ChangerCommand.create', 'params was not an array but ' + params);
			}
			
			return Object.assign(Object.create(this), {
				macroName,
				params,
				/*
					The next property links this changer to one it has been composed
					with. In this way, composed ChangerCommands are linked lists.
				*/
				next,
				/*
					If a Changer can NOT be used with (enchant:), (enchant-in:), (link-style:) etc., then this is false.
					Used only by (replace:) and its ilk, and (link:) and its ilk.
				*/
				canEnchant,
			});
		},
		
		/*
			Changer composition is performed using the + operator.
			This is the basis for advanced use of changer macros -
			(transition:) + (background:), etc., provide sophisticated
			styling.
		*/
		"TwineScript_+"(other) {
			/*
				Make a copy of this changer to return.
			*/
			const clone = this.TwineScript_Clone();
			/*
				Attach the other changer to the "tail" (the end of the
				"next" chain) of this changer.
			*/
			let tail = clone;
			while (tail.next) {
				tail = tail.next;
			}
			tail.next = other;

			/*
				Combine the canEnchant flags of both, too.
			*/
			clone.canEnchant = this.canEnchant && other.canEnchant;
			return clone;
		},
		
		TwineScript_is(other) {
			/*
				Since the canEnchant flag is fixed based on the macroName, it doesn't need to be compared.
			*/
			if (ChangerCommand.isPrototypeOf(other)) {
				return this.macroName === other.macroName &&
					is(this.params, other.params) &&
					is(this.next, other.next);
			}
		},
		
		TwineScript_Clone() {
			/*
				Each link in the chain needs to be cloned, not just the start.
			*/
			let clone = ChangerCommand.create(this.macroName, this.params, this.next), tail = clone;
			while (tail.next) {
				tail = tail.next = tail.next.TwineScript_Clone();
			}
			/*
				Copy the canEnchant flag, too.
			*/
			clone.canEnchant = this.canEnchant;
			return clone;
		},
		
		/*
			Only Section calls this, at the point where a ChangerCommand is ready to be run on a descriptor.

			'head' is only used by recursive calls, and contains the first changer in the chain.
		*/
		run(desc, head) {
			/*
				Special #awkward case for the "output" changer: it receives the head changer instead of its params, because
				it needs to store it for serialisation purposes.
			*/
			const params = (this.macroName === "output" ? [head || this] : this.params);
			const error = commandRegistry[this.macroName](desc, ...params);
			/*
				If this function returns a result, it should just be a ChangeDescriptor. If it's a
				TwineError, then it needs to be returned and rendered by section.renderInto() immediately.
			*/
			if (TwineError.containsError(error)) {
				return error;
			}
			if (this.next) {
				this.next.run(desc, head || this);
			}
		},

		/*
			Changer Command functions added via Macros.addChanger() will register their functions
			here, so that ChangerCommand.run() can access them.
		*/
		register(name, fn) {
			commandRegistry[name] = fn;
		},

	};
	return Object.freeze(ChangerCommand);
});
