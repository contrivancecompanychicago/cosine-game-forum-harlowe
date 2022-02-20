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
			
			@param {String} macroName
			@param {Array} params
			@param {ChangerCommand} next
		*/
		create(macroName, params = [], next = null) {
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
			return clone;
		},
		
		TwineScript_is(other) {
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
			let clone = this.create(this.macroName, this.params, this.next), tail = clone;
			while (tail.next) {
				tail = tail.next = tail.next.TwineScript_Clone();
			}
			return clone;
		},
		
		/*
			Only Section calls this, at the point where a
			ChangerCommand is ready to be run on a descriptor.
		*/
		run(desc) {
			/*
				We need to spread the params array.
			*/
			const result = commandRegistry[this.macroName](desc, ...this.params);
			/*
				If this function returns a result, it should just be a ChangeDescriptor. If it's a
				TwineError, then it needs to be returned and rendered by section.renderInto() immediately.
			*/
			if (TwineError.containsError(result)) {
				return result;
			}
			if (this.next) {
				this.next.run(desc);
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
