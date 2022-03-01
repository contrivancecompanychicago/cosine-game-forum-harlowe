"use strict";
define([
	'macros',
	'state',
	'utils',
	'utils/operationutils',
	'twinescript/operations',
	'datatypes/colour',
	'datatypes/hookset',
	'datatypes/lambda',
	'datatypes/datatype',
	'datatypes/varbind',
	'datatypes/codehook',
	'datatypes/typedvar',
	'datatypes/assignmentrequest',
	'internaltypes/varref',
	'internaltypes/twineerror'
],
(Macros, State, {insensitiveName, impossible, escape}, {toSource,typeName,objectName}, Operations, Colour, HookSet, Lambda, Datatype, VarBind, CodeHook, TypedVar, AssignmentRequest, VarRef, TwineError) => {

	/*
		This is used to find which lexer tokens represent "free variables" instead of pure deterministic data.
		A free variable is:
		- Anything that takes user input as part of its evaluation
		- Anything that queries the system time or section time
		- Any variable or temp variable
		- Anything that queries the passage on evaluation (exits etc.)
		- Anything with PRNG

		Free variables' environment can potentially be captured, allowing them to be serialised.
		Those that do add these environment parameters to section.freeVariables.
		Those that can't simply replace section.freeVariables with "true".
	*/
	function addFreeVariable(section, token) {
		const f = section.freeVariables;
		if (token.type === "macro") {
			const name = insensitiveName(token.name);
			/*
				Currently, these macros' environment isn't captured.
			*/
			if (name === "current-time" ||
					name === "current-date" ||
					name === "monthday" ||
					name === "weekday" ||
					name === "history" ||
					name === "passage") {
				section.freeVariables = true;
			}
			/*
				Because the only two blocking macros are (prompt:), which produces a string,
				and (confirm:), which produces a boolean, both of which are JSON values,
				their results (which are currently accessible in section.stackTop.blockedValues -
				or rather, they /should/ be) can be captured as-is.

				Note that this environment capture isn't actually useful when (confirm:) or (prompt:)'s result
				is saved to a variable as-is, and only matters when they are included
				as part of a much larger data structure. Which is admittedly not a common idiom.
			*/
			else if (token.blockedValue && !f.blockedValues) {
				f.blockedValues = section.stackTop.blockedValues.concat();
			}
			/*
				For random values, simply store the seed and seedIter. If these are already stored,
				that means an earlier part of a larger composite value was also random,
				and provided both that and this are run in the same order in State.recompileValues(),
				only the seed and seedIter for the first one is necessary.
			*/
			else if ((name === "random" ||
					name === "either" ||
					name === "shuffled") && !f.seed) {
				f.seed = State.seed;
				f.seedIter = State.seedIter;
			}
		}
		/*
			Identifiers are currently not captured either.
			TODO: capture that environment elsewhere, akin to possessive operators.
		*/
		else if (token.type === "identifier") {
			const name = insensitiveName(token.text);
			if (name === "time" || name === "exits" || name === "it" || name === "visits") {
				section.freeVariables = true;
			}
		}
		/*
			Possessive operators and belonging operators have to be handled elsewhere,
			because they could be operating on computed properties.
		*/
		else if (token.type === "property" || token.type === "belongingProperty") {
			const name = insensitiveName(token.name);
			if (name === 'random' && !f.seed) {
				f.seed = State.seed;
				f.seedIter = State.seedIter;
			}
		}
		/*
			Variables aren't captured either.
		*/
		else if (token.type === "variable" || token.type === "tempVariable") {
			section.freeVariables = true;
		}
	}

	const precedenceTable = 
		/*
			The following is the precedence table for Harlowe tokens,
			in ascending order of tightness. Each row has identical precedence.
			Absent token types have the least precedence.
			Associativity doesn't matter for most operators, as their results aren't
			chainable with themselves (you can't write "$a to 2 to 2", for instance).
		*/
		[
			["error", "text"],
			["comma"],
			["to","into"],
			["where", "when", "via", "making", "each"],
			["typeSignature"], // the "-type" operator
			["augmentedAssign"],
			["and", "or"],
			["is", "isNot"],
			["contains", "doesNotContain", "isIn", "isNotIn"],
			["isA", "isNotA", "matches", "doesNotMatch"],
			["inequality"],
			["addition", "subtraction"],
			["multiplication", "division"],
			{rightAssociative: ["spread", "bind"]},
			/*
				"positive" and "negative" are never emitted by the lexer, and are only
				created by converting "addition" and "subtraction" in run().
			*/
			{rightAssociative: ["not", "positive", "negative"]},
			{rightAssociative: ["belongingProperty","belongingItProperty", "belongingOperator", "belongingItOperator"]},
			["property","itsProperty", "possessiveOperator", "itsOperator"],
			["twineLink", "macro", "identifier", "variable", "tempVariable", "hookName", "number", "cssTime",
				"boolean", "string", "hook", "colour", "datatype", "root"],
			["grouping"],
		];

	/*
		When given an array of tokens, this finds the token with the highest or lowest precedence
		among them, and returns it with its index.
	*/
	function precedentToken(tokens, order) {
		/*
			If none is found, this empty array is returned.
		*/
		let ret = [];
		if (!tokens.length) {
			return ret;
		}
		let i, end, step;
		if (order === "most") {
			i = precedenceTable.length - 1; end = step = -1;
		}
		else {
			i = 0; end = precedenceTable.length; step = 1;
		}
		for(; i !== end; i += step) {
			let types = precedenceTable[i];
			let index = NaN;
			if (types.rightAssociative) {
				/*
					Find the first token that has a rightAssociative type.
				*/
				for (let i = 0; i < tokens.length; i+=1) {
					if (types.rightAssociative.includes(tokens[i].type)) {
						index = i;
						break;
					}
				}
			}
			else {
				/*
					In order for a token to be left-associative, the rightmost one of its type
					needs to be recursively visited first, and the leftmost one deepest.
					So, the array of tokens must be indexed in reverse.
				*/
				for (let i = tokens.length - 1; i >= 0; i -= 1) {
					if (types.includes(tokens[i].type)) {
						index = i;
						break;
					}
				}
			}
			/*
				Return the token once we find it.
			*/
			if (!Number.isNaN(index) && index > -1) {
				ret = [tokens[index], index];
				break;
			}
		}
		return ret;
	}

	/*
		A helper for the comparison operators that computes
		which ops method to call for them.
	*/

	/*
		A helper that shows which types of operator tokens are comparisons.
	*/
	const comparisonOpTypes = ['inequality','is','isNot','isIn','contains','doesNotContain',
		'isNotIn','isA','typifies','isNotA','untypifies','matches','doesNotMatch'];

	/*
		A helper that gets the comparison operator of a token, accounting for the token's negation
		(caused by writing "is not <" or something).
	*/
	const inequalityNegator = {
		'>' :     '<=',
		'<' :     '>=',
		'>=':     '<',
		'<=':     '>',
	};
	function compileComparisonOperator(token) {
		if (token.type === "inequality") {
			return (token.negate ? (inequalityNegator[token.operator]) : token.operator);
		}
		else {
			return token.type;
		}
	}

	/*
		A helper which performs compileComparisonOperator(), then returns the reverse of
		the compiled operation. Used in the "and" and "or" operator compilation
		to flip child comparisons.
	*/
	const comparisonReverser = {
		'>' :     '<',
		'<' :     '>',
		'>=':     '<=',
		'<=':     '>=',
		contains: "isIn",
		doesNotContain: "isNotIn",
		isIn:     "contains",
		isA:      "typifies",
		typifies: "isA",
		isNotA:   "untypifies",
		untypifies: "isNotA",
	};
	function reverseComparisonOperator(token) {
		const type = compileComparisonOperator(token);
		return (comparisonReverser[type]) || type;
	}

	/*
		This is a super-quick lookup table for determining what a token absolutely
		must or must not have on its sides (for instance, spreads must have a token after
		but not before).
	*/
	const tokenSides = {
		"error": "neither",
		"identifier": "neither",
		"variable": "neither",
		"tempVariable": "neither",
		"hookName": "neither",
		"number": "neither",
		"boolean": "neither",
		"string": "neither",
		"hook": "neither",
		"colour": "neither",
		"datatype": "neither",
		"root": "neither",
		"twineLink": "neither",
		"macro": "neither",
		"grouping": "neither",
		"itsProperty": "neither",
		"belongingItProperty": "neither",

		"to": "both",
		"into": "both",
		"typeSignature": "both",
		"augmentedAssign": "both",
		"and": "both",
		"or": "both",
		"belongingOperator": "both",
		"possessiveOperator": "both",
		"multiplication": "both",
		"division": "both",

		"spread": "after",
		"bind": "after",
		/*
			Addition and subtraction are not included due to their 
			conversion, in unary position, to positive/negative.
		*/
		"not": "after",
		"belongingProperty": "after",
		"each": "after",
		/*
			"where", "when", "via" and "making" are not included as they
			can optionally have another lambda to their left.
		*/
		"itsOperator": "after",
		"positive": "after",
		"negative": "after",

		"belongingItOperator": "before",
		"property": "before",
	};

	function missingSideError(needsLeft, needsRight, token) {
		return TwineError.create('syntax', `I need usable code to be ${needsLeft ? "left " : ""}${needsLeft && needsRight ? "and " : ""}${needsRight ? "right " : ""}of ${token.text}.`);
	}

	function wrongSideError(wrongLeft, wrongRight, token) {
		return TwineError.create('syntax',
			`There can't be a ${
					(wrongLeft && wrongRight)
					? wrongLeft.map(e => e.text).join('') + ' or ' + wrongRight.map(e => e.text).join('')
					: (wrongLeft || wrongRight).map(e => e.text).join('')
				} to the ${wrongLeft ? "left " : ""}${wrongLeft && wrongRight ? "or " : ""}${wrongRight ? "right " : ""}of ${token.text}.`,
			"There could be a comma missing between them."
		);
	}

	/*
		Having evaluated a token, if debug mode is on, a replay frame of this
		evaluation should be added to the evalReplay array.
	*/
	function makeEvalReplayFrame(evalReplay, val, transformation, tokens, i) {
		const token = tokens[i];
			/*
				This replay system does not remove the whitespace tokens from before and after,
				because it needs the full text length of these.
			*/
		let before = tokens.slice(0, i),
			after = tokens.slice(i + 1);
		/*
			Replays should stop at the first error, because seeing the same error propagate
			upward isn't particularly enlightening.
		*/
		if (evalReplay[evalReplay.length-1].error) {
			return;
		}
		const error = TwineError.containsError(val);
		const fullCode = evalReplay[evalReplay.length-1].code;
		/*
			The basis is used to convert string indexes from passage-wise to expression-wise.
			It equals the passage-wise index of the expression's first element.
		*/
		const basis = evalReplay[0].basis;

		/*
			If a string for the transformed source wasn't provided,
			compute it here from the val.
		*/
		let resultSource;
		if (!transformation) {
			resultSource = ` ${error ? "🐞" :
				val && !val.TwineScript_ToSource && val.TwineScript_Unstorable ? objectName(val) :
				toSource(val)} `;

			/*
				Don't create a replay frame for tokens whose source representation doesn't change at all.
			*/
			if ((!before || (before.length === 1 && before[0].type === 'whitespace')) && 
					(!after || (after.length === 1 && after[0].type === 'whitespace')) &&
					resultSource.trim() === token.text.trim()) {
				return val;
			}
		}
		else {
			resultSource = transformation;
		}
		/*
			Before and after can be swapped in one special case: right-side elided comparisons.
		*/
		if (before.length && after.length && before[0].start > after[0].start) {
			[before, after] = [after, before];
		}
		/*
			Splicing a string in-place multiple times is a little tricky. We need the changes in
			length produced by each splice before this.
			Calculate the start and end of this token + its inferiors, relative to the original
			source, and then re-compute it for each replay frame before this.
		*/
		let start = (before.length ? before[0] : token).start - basis;
		let end = (after.length ? after[after.length-1] : token).end - basis;
		for (let i of evalReplay) {
			/*
				Previous substitutions that start before this push both the start and end forward.
			*/
			if (i.start < start) {
				start += i.diff;
				end += i.diff;
			}
			/*
				Substitutions that start inside this (i.e. child tokens) only push the end forward.
			*/
			else if (i.start < end) {
				end += i.diff;
			}
		}
		/*
			This difference is that of the result source length vs. the original (token + inferiors) text length.
		*/
		const diff = resultSource.length - (end - start);
		evalReplay.push({
			code: fullCode.slice(0, start) + resultSource + fullCode.slice(end),
			/*
				Each step depicts either the permution of a code structure into a Harlowe value, or an error being produced.
			*/
			fromCode: fullCode.slice(start, end),
			/*
				Code transformations (such as by inferred 'it') are described using the resultant transformed code.
				Plain evaluations are described using only the object name of the result value.
			*/
			toCode: !error && transformation,
			toDesc: !error && !transformation && objectName(val),
			start,
			end,
			diff,
			error: error && error.render(fullCode.slice(start, end), /*NoEvents*/ true),
		});
	}

	/*
		This takes an array of tokens, and executes it as JS code.
		
		@param {Array} The tokens array.
		@param {Object} Some flags to carry down recursive calls to compile()
			{Boolean} isVarRef: whether or not this value should be compiled to a VarRef
			{Boolean} isTypedVar: whether or not this value should be compiled to an any-type TypedVar if it's a variable.
				Should only be true for the left-side of 'to' and right-side of 'into'.
		@return {Any} The result.
	*/
	return function run(section, tokens, isVarRef = false, isTypedVar = false) {
		const {evalReplay} = section;
		const hasEvalReplay = (evalReplay && evalReplay.length);
		const ops = Operations;
		let token, ret;
		/*
			The passed-in tokens are an array when a lambda is run and a single token (the macro itself)
			when a macro is run.
		*/
		if (!Array.isArray(tokens)) {
			tokens = [tokens];
		}

		if (!tokens.length || !tokens[0]) {
			impossible('Runner.run', 'No tokens to run!');
			return 0;
		}
		/*
			Obtain the least precedent token, its index i, and its type.
		*/
		let i, before, after;
		if (tokens.length === 1) {
			token = tokens[0];
		}
		else {
			[token, i] = precedentToken(tokens, "least");
			before = tokens.slice(0, i);
			after = tokens.slice(i + 1);
			if (!before.length || (before.length === 1 && before[0].type === 'whitespace')) {
				before = false;
			}
			if (!after.length || (after.length === 1 && after[0].type === 'whitespace')) {
				after = false;
			}
		}
		const type = token.type;
		if (!type) {
			impossible('Runner.run', 'Token has no type!');
			return 0;
		}
		/*
			Perform the error-checking for tokens requiring or prohibiting more
			precedent tokens on their sides.
		*/
		const sides = tokenSides[type] || '';

		if (sides === "both" && (!before || !after)) {
			ret = missingSideError(!before, !after, token);
		}
		else if (sides === "neither" && (before || after)) {
			ret = wrongSideError(before, after, token);
		}
		else if (sides === "before") {
			if (!before) {
				ret = missingSideError(true, false, token);
			}
			else if (after) {
				ret = wrongSideError(null, after, token);
			}
		}
		else if (sides === "after") {
			if (!after) {
				ret = missingSideError(false, true, token);
			}
			else if (before) {
				ret = wrongSideError(before, null, token);
			}
		}
		/*
			If section has the "freeVariables" array (which is only present when it's being mutated during
			a run() call by "to" and "into") then add this token if it's a free variable.
		*/
		if (section.freeVariables && typeof section.freeVariables === "object") {
			addFreeVariable(section, token);
		}
		/*
			These exist simply to document the arguments to recursive run() calls.
		*/
		const VARREF = true, TYPEDVAR = true;
		/*
			The JS comma serves just to separate macro arguments in Harlowe.
		*/
		/*
			This should never appear because commas are handled by "macro" tokens
			by themselves, and commas shouldn't appear in other jurisdictions.
		*/
		if (ret) {
			/*
				If the previous checks already set the return value to an error,
				don't do anything more.
			*/
		}
		else if (type === "comma") {
			impossible('Section.run', 'a comma token was run() somehow.');
			return 0;
		}
		/*
			Root tokens are usually never passed in, but let's
			harmlessly handle them anyway.
		*/
		else if (type === "root") {
			ret = run(section, token.children);
		}
		else if (type === "identifier") {
			if (isVarRef) {
				ret = VarRef.create(section.Identifiers, token.text.toLowerCase());
			}
			else {
				ret = section.Identifiers[token.text.toLowerCase()];
			}
		}
		else if (type === "variable" || type === "tempVariable") {
			ret = VarRef.create(type === "tempVariable" ? section.stackTop.tempVariables : State.variables,
				token.name);

			if (isTypedVar) {
				ret = TypedVar.create(Datatype.create('any'),ret);
			}
			else if (!isVarRef && !TwineError.containsError(ret)) {
				ret = ret.get();
			}
		}
		else if (type === "hookName") {
			ret = HookSet.create({type:'name', data:token.name});
		}
		else if (type === "number" || type === "cssTime") {
			ret = token.value;
		}
		else if (type === "boolean") {
			ret = token.text.toLowerCase() === "true";
		}
		else if (type === "string") {
			/*
				Note that this is reliant on the fact that TwineScript string
				literals are currently exactly equal to JS string literals (minus template
				strings and newlines).
			*/
			ret = eval(token.text.replace(/(.?)\n/g, (_,a) =>
				/*
					If a literal newline has a \ before it (such as when invoking the escaped line ending syntax), DON'T escape the newline without escaping the \ first.
				*/
				(a === "\\" ? "\\\\" : a === "\n" ? "\\n" : a) + "\\n"));
		}
		else if (type === "hook") {
			ret = CodeHook.create(token.children, token.text);
		}
		else if (type === "colour") {
			ret = Colour.create(token.colour);
		}
		else if (type === "datatype") {
			ret = Datatype.create(token.name);
		}
		else if (type === "spread") {
			/*
				Whether or not this actually makes sense as a "mid"string
				is probably easily disputed.
			*/
			ret = ops.makeSpreader(run(section,  after, false, isTypedVar));
		}
		else if (type === "bind") {
			ret = VarBind.create(run(section,  after, VARREF), token.text.startsWith('2') ? 'two way' : '');
		}
		else if (type === "to" || type === "into") {
			const dest = (type === "to") ? section.setIt(run(section, before, VARREF, TYPEDVAR)) : run(section, after, VARREF, TYPEDVAR);
			if (TwineError.containsError(dest)) {
				ret = dest;
			} else {
				/*
					For the purposes of State optimisation, each assignmentRequest collects the
					"free variables" used in the source. This is currently (Jan 2022) done by
					permuting section to have a "freeVariables" array, running the source,
					then removing it, rather than adding an additional argument to run().
				*/
				/*
					Currently, (unpack:) is too complicated to generate prose references for, even if
					it is pure.
					
					This check confirms that this is only a (set:) or (put:) command
					that isn't a property modification (like $a's 1st).
				*/
				if ((VarRef.isPrototypeOf(dest) && dest.propertyChain.length <= 1) || (TypedVar.isPrototypeOf(dest) && dest.varRef.propertyChain.length <= 1)) {
					section.freeVariables = Object.create(null);
				}
				/*
					This needs to be a VarRef so that (set: $b to 0, $d to $b) can work.
				*/
				const src = (type === "to") ? run(section, after, VARREF) : section.setIt(run(section, before, VARREF));
				if (TwineError.containsError(src)) {
					return src;
				}
				const freeVariables = section.freeVariables;
				section.freeVariables = null;
				/*
					If it is indeed pure, or its environment has been captured, create a prose reference to this location.
				*/
				let srcRef;
				if (freeVariables && typeof freeVariables === "object" &&
						/*
							ValueRefs shouldn't be used if the value was a Number or Boolean.
						*/
						(typeof src !== 'boolean' && typeof src !== 'number')) {
					srcRef = freeVariables;
					srcRef.at = token.place;
					srcRef.from = after[0].start;
					srcRef.to = after[after.length-1].end;
					/*
						Don't bother if the stringified Harlowe source of the value is longer than its reference.
					*/
					if (JSON.stringify(srcRef).length >= toSource(src).length) {
						srcRef = undefined;
					}
				}
				ret = AssignmentRequest.create(dest, src, type, srcRef);
			}
		}
		else if (type === "typeSignature") {
			const datatype = run(section,  before, isVarRef);
			/*
				TypedVars are the one case where variable children shouldn't be considered freeVariables.
				So, reinstate the current value after the right (NOT left) side is run.
			*/
			const free = section.freeVariables;
			section.freeVariables = null;
			/*
				Because this is already being compiled into a TypedVar, the variable on the right does not need
				to be compiled into a TypedVar as well.
			*/
			const variable = run(section,  after, VARREF);
			section.freeVariables = free;
			ret = TypedVar.create(datatype, variable);
		}
		else if (type === "where" || type === "when" || type === "via") {
			if (!after) {
				ret = missingSideError(false, true, token);
			}
			else {
				/*
					Lambdas need to store their entire Harlowe source, for display with (source:)
				*/
				const source = tokens.map(e => e.text).join('');
				/*
					Type errors for 'before' and 'after' are handled by Lambda.create().
				*/
				ret = Lambda.create(
					/*
						'when' lambdas don't have a before.
						TODO: Move the error from Lambda.create to here?
					*/
					!before ? undefined : run(section,  before, VARREF),
					token.type,
					/*
						The 'where' or 'when' clause is evaluated only at runtime.
					*/
					after,
					source
				);
			}
		}
		else if (type === "making" || type === "each") {
			if (!after) {
				ret = missingSideError(false, true, token);
			}
			else {
				/*
					Lambdas need to store their entire Harlowe source, for display with (source:)
				*/
				const source = [].concat(tokens).map(e => e.text).join('');
				/*
					The optional "each" keyword simply permits a originalSource to be created using a bare
					successive temp variable, without any other clauses. As such, it doesn't have a
					temp variable preceding it, and its "clause" (the temp variable) is really its subject.
				*/
				if (type === "each") {
					ret = Lambda.create(
						run(section,  after, VARREF),
						'each',
						null,
						source
					);
				}
				// Other keywords can have a preceding temp variable, though.
				else {
					ret = Lambda.create(
						!before ? undefined : run(section,  before, VARREF),
						token.type,
						/*
							The 'making' or 'each' clause must be a VarRef, which is computed now.
						*/
						run(section,  after, VARREF),
						source
					);
				}
			}
		}
		/*
			I'm also not sure if augmented assignment is strictly necessary given that
			one can do (set: $x to it+1), and += is sort of an overly abstract token.
		*/
		else if (type === "augmentedAssign") {
			ret = ops.makeAssignmentRequest(
				run(section,  before, VARREF),
				/*
					This line converts the "b" in "a += b" into "a + b" (for instance),
					thus partially de-sugaring the augmented assignment.
					
					Note that the left tokens must be compiled again, as a non-varRef this time.
					
					Note also that this assumes the token's assignment property corresponds to
					a binary-arity Operation method name.
				*/
				ops[token.operator](run(section,  before), run(section,  after)),
				token.operator
			);
		}
		/*
			The following are the logical arithmetic operators.
		*/
		else if (type === "and" || type === "or") {
			/*
				Rule: a side is a comparison if its least precedentToken's type is a comparison
				operator, or its type is "and" or "or" and its sides are a comparison.
			*/
			const isComparisonOp = (tokens) => {
				const [token, i] = precedentToken(tokens, "least");
				if (!token || token.type === "whitespace") {
					return;
				}
				if (comparisonOpTypes.includes(token.type)) {
					return token;
				}
				if (token.type === type) {
					return (isComparisonOp(tokens.slice(0, i)) || isComparisonOp(tokens.slice(i + 1)));
				}
			};

			const
				leftIsComparison        = isComparisonOp(before),
				rightIsComparison       = isComparisonOp(after),
				// This error message is used for elided "is not" comparisons.
				ambiguityError = TwineError.create('operation', "This use of \"is not\" and \"" + type + "\" is grammatically ambiguous.",
					"Maybe try rewriting this as \"__ is not __ " + type + " __ is not __\"");

			let operator;
			/*
				This function gathers all the operands that have elided comparison operators and are joined
				by identical and/or operators.
				For instance, given
				3 < 4 and 5 and 6 and 7
				this is used to gather 5, 6 and 7.
			*/
			const getElisionOperands = (tokens) => {
				const [token, i] = precedentToken(tokens, "least");
				if (!token || token.type === "whitespace") {
					return [];
				}
				if (token.type === type) {
					return [...getElisionOperands(tokens.slice(0, i)), ...getElisionOperands(tokens.slice(i + 1))];
				}
				/*
					For each elided comparison, make an evalReplay frame explaining the inferred "it" rule.
				*/
				const ret = run(section, tokens);
				if (hasEvalReplay) {
					makeEvalReplayFrame(evalReplay, null, ` it ${operator} ${toSource(ret)} `, tokens, i);
				}
				return [ret];
			};

			/*
				If the left side is a comparison operator, and the right side is not,
				wrap the right side in an elidedComparisonOperator call.
				This transforms statements like (if: $a > 2 and 3) into (if: $a > 2 and it > 3).
			*/
			if (leftIsComparison && !rightIsComparison) {
				const leftSide = leftIsComparison;
				operator = compileComparisonOperator(leftSide);

				/*
					The one operation for which this transformation cannot be allowed is "is not",
					because of its semantic ambiguity ("a is not b and c") in English.
				*/
				if (leftSide.type === 'isNot' || leftSide.type === 'isNotA' || leftSide.type === 'untypifies') {
					ret = ambiguityError;
				}
				else {
					/*
						Because getElisionOperands() calls run(), and run() affects the evalReplay, the order of these
						calls is important.
					*/
					const evalBefore =  run(section, before);
					const elisionOperands = getElisionOperands(after); /*all elided comparisons in after*/
					ret = ops[type](
						evalBefore,
						ops.elidedComparisonOperator(token.type, operator, section.Identifiers.it, ...elisionOperands)
					);
				}
			}
			/*
				If the right side is a comparsion operator, and the left side is not,
				swap the left and right sides, invert the right (left) side, then perform the above.
				This transforms statements like (if: $a and $b < 3) into (if: 3 >= $b and it >= $a).
			*/
			else if (!leftIsComparison && rightIsComparison) {
				/*
					isComparisonOp actually returns the token holding the comparison op.
					We can reuse that token in this computation.
				*/
				const rightSide = rightIsComparison,
					rightIndex = tokens.indexOf(rightSide);
				operator = reverseComparisonOperator(rightSide);

				/*
					Again, "is not" should not be transformed.
				*/
				if (rightSide.type === 'isNot' || rightSide.type === 'isNotA' || rightSide.type === "untypifies") {
					ret = ambiguityError;
				}
				else {
					/*
						Because getElisionOperands() calls run(), and run() affects the evalReplay, the order of these
						calls is important.
					*/
					/*
						The following additional action swaps the tokens to the right and left of rightSide,
						and changes rightSide's type into its inverse. This changes ($b < 3) into (3 > $b),
						and thus alters the It value of the expression from $b to 3.

						For multi-part comparisons, (3 and 4 and 5 < 6) becomes (6 > 5 and it > 3 and it > 4).

						This could cause issues when "it" is used explicitly in the expression, but frankly such
						uses are already kinda nonsensical ("(if: $a is in it and $b)"?).
					*/
					const swappedSides = [
						...tokens.slice(rightIndex + 1),
						// Create a copy of rightSide with the type changed, rather than mutate it in-place.
						Object.assign(Object.create(rightSide), {
							[rightSide.type === "inequality" ? "operator" : "type"]:
								reverseComparisonOperator(rightSide),
						}),
						...tokens.slice(i + 1, rightIndex),
					];
					const evalAfter = run(section, swappedSides);
					const elisionOperands = getElisionOperands(before);/*all elided comparisons in before*/

					ret = ops[type](
						evalAfter,
						ops.elidedComparisonOperator(token.type, operator, section.Identifiers.it, ...elisionOperands)
					);
				}
			}
			/*
				Note for comparison operations:
				If two variables are being compared (such as $a < $y or $b contains $c)
				and the comparison operation is in potential VarRef position
				(such as (set: $x to $a < $y)) then don't compile the variables into VarRefs
				(because comparison operations can't, and shouldn't, process VarRefs instead of values.)
			*/
			else ret = ops[type](run(section, before), run(section, after));
		}
		/*
			The following are the comparison operators.
		*/
		else if (comparisonOpTypes.includes(type)) {
			if (!after) {
				missingSideError(false, true, token);
			}
			const leftOp = !before ? section.Identifiers.it : run(section,  before);
			ret = ops[compileComparisonOperator(token)](
				leftOp,
				run(section,  after)
			);
			section.Identifiers.it = leftOp;
		}
		else if (type === "addition" || type === "subtraction") {
			if (!after) {
				missingSideError(false, true, token);
			}
			/*
				"addition" and "subtraction" have the unfortunate ignomity of being identical in appearance to
				unary + and -, and lack easy rules for distinguishing when they can and can't follow certain token types.
				As a result, converting one into the other can, to my knowledge, only be done here, in compilation,
				instead of the lexer.
			*/
			let convert = !before;
			if (before) {
				/*
					Find the precedent token of the 'before' side. if it needs something on its right,
					convert this to "positive" or "negative" and re-run this whole set of tokens.
				*/
				const [previousPrecedentToken,i] = precedentToken(before, "least");
				const sides = tokenSides[previousPrecedentToken.type], pType = previousPrecedentToken.type;
				convert = (
					(sides === "both" || sides === "after" ||
					pType === "addition" || pType === "subtraction") &&
					/*
						If this token is the last non-whitespace 'before' token, then it has nothing
						'after' it. Therefore, it's equivalent to previousPrecedentToken being the last token.
					*/
					(i === before.length-1 || (i === before.length-2 && before[before.length-1].type === "whitespace"))
				);
			}
			if (convert) {
				/*
					Converting the token to a unary "positive" or "negative" involves the slightly #awkward
					yet concise step of permuting the token in-place, then redoing this run() invocation
					entirely.
				*/
				token.type = type === 'addition' ? "positive" : "negative";
				ret = run(section,  tokens);
				token.type = type;
			} else {
				ret = ops[token.text](
					run(section,  before),
					run(section,  after)
				);
			}
		}
		else if (type === "multiplication" || type === "division") {
			ret = ops[token.text](
				run(section,  before),
				run(section,  after)
			);
		}
		else if (type === "positive" || type === "negative") {
			ret = ops['*'](
				(type === "negative" ? -1 : 1),
				run(section, after)
			);
		}
		else if (type === "not") {
			ret = ops.not(run(section,  after));
		}
		else if (type === "belongingProperty") {
			ret = VarRef.create(
				run(section,  after, VARREF),
				token.name
			);
			ret = isVarRef || TwineError.containsError(ret) ? ret : ret.get();
		}
		else if (type === "belongingOperator" || type === "belongingItOperator") {
			const value = run(section,  before);
			/*
				addFreeVariable() couldn't capture the environment of "random" datanames
				because this value could only be found by computing the tokens before this.
				But, we CAN capture that environment now.

				Note that isVarRef (below) doesn't matter here, because section.freeVariables wouldn't be truthy
				if that was the case.
			*/
			if (value === "random" && section.freeVariables && typeof section.freeVariables === "object" && !section.freeVariables.seed) {
				section.freeVariables.seed = State.seed;
				section.freeVariables.seedIter = State.seedIter;
			}
			ret = VarRef.create(
				token.type.includes("It") ? section.Identifiers.it :
					// Since, as with belonging properties, the variable is on the right,
					// we must compile the right side as a varref.
					run(section,  after, VARREF),
				{computed:true,value}
			);
			ret = isVarRef || TwineError.containsError(ret) ? ret : ret.get();
		}
		/*
			Notice that this one is right-associative instead of left-associative.
			This must be so because, by branching on the rightmost token, it will compile to:
				VarRef.create(VarRef.create(a,1).get(),2).get()
			instead of the incorrect:
				VarRef.create(a,1).get() VarRef.create(,2).get()
		*/
		else if (type === "property") {
			ret = VarRef.create(
				run(section, before, VARREF),
				token.name
			);
			ret = isVarRef || TwineError.containsError(ret) ? ret : ret.get();
		}
		else if (type === "itsProperty" || type === "belongingItProperty") {
			ret = VarRef.create(
				section.Identifiers.it,
				token.name
			);
			ret = isVarRef || TwineError.containsError(ret) ? ret : ret.get();
		}
		else if (type === "possessiveOperator" || type === "itsOperator") {
			if (!after || (!before && token.type !== "itsOperator")) {
				ret = missingSideError(!before, !after, token);
			}
			else {
				/*
					See the note above for belongingOperator.
				*/
				const value = run(section, after);
				if (value === "random" && section.freeVariables && typeof section.freeVariables === "object" && !section.freeVariables.seed) {
					section.freeVariables.seed = State.seed;
					section.freeVariables.seedIter = State.seedIter;
				}

				/*
					The left side should not be compiled into a TypedVar even if it's in position - for instance,
					num-type $a's ('foo') shouldn't compile "num-type $a" into a TypedVar.
				*/
				ret = VarRef.create(
					token.type === "itsOperator" ? section.Identifiers.it : run(section,  before, isVarRef),
					{computed:true, value}
				);
				ret = isVarRef || TwineError.containsError(ret) ? ret : ret.get();
			}
		}
		else if (type === "twineLink") {
			/*
				This crudely desugars the twineLink token into a
				(link-goto:) token, in a manner similar to that in Renderer.
			*/
			ret = Macros.run("link-goto",section,[token.innerText,token.passage]);
		}
		else if (type === "macro") {
			/*
				Blocker macros are marked with 'blockedValue', representing the value they would
				evaluate to, in Renderer. The blockers are run separately from the main macros
				whenever section is blocked. If it isn't, use the saved blockedValue() that was
				produced by their execution.
			*/
			if (token.blockedValue && !section.blocked) {
				ret = section.blockedValue();
				if (ret === undefined) {
					impossible('Runner.run', 'section.blockedValue() returned undefined');
					return 0;
				}
			}
			else {
				/*
					The first child token in a macro is always the method name.
				*/
				const macroNameToken = token.children[0];
				const variableCall = macroNameToken.text[0] === "$" || macroNameToken.text[0] === "_";
				if(macroNameToken.type !== "macroName" && !variableCall) {
					impossible('Runner.run', 'macro token had no macroName child token');
					return 0;
				}
				let macroRef; 
				if (variableCall) {
					macroRef = VarRef.create(
						macroNameToken.text[0] === "_" ? section.stackTop.tempVariables : State.variables,
						macroNameToken.text.trim().slice(1,-1)
					);
					if (!TwineError.containsError(macroRef)) {
						macroRef = macroRef.get();
					}
				}
				else {
					macroRef = token.name;
				}
				ret = Macros[variableCall ? "runCustom" : "run"](
					macroRef,
					section,
					/*
						Divide all of the children of this macro call (minus the macro name) into
						sets of arrays broken by 'comma' tokens. In effect, this is token.children.split(comma tokens).

						Each child array of children is run separately and immediately.
					*/
					token.children.slice(1).reduce((a, e) => {
						if (e.type === "comma") {
							a.push([]);
						}
						else {
							a[a.length-1].push(e);
						}
						return a;
					},[[]]).filter(e => e.length && (e.length > 1 || e[0].type !== "whitespace")).map(e => run(section,  e,
						/*
							To allow destructuring patterns to work, macros in destructuring position should
							compile all of their contained VarRefs to TypedVars.
						*/
						false, isTypedVar))
				);
			}
		}
		else if (type === "grouping") {
			ret = run(section,  token.children, isVarRef);
		}
		else if (type === "error") {
			ret = TwineError.create('syntax', token.message, token.explanation || '');
		}
		else if (type === "text") {
			ret = TwineError.create('syntax', `"${token.text}" isn't valid Harlowe syntax for the inside of a macro call.`,
				"Maybe you misspelled something? Also, as of 3.3.0, Javascript syntax is not allowed inside macro calls.");
		}
		else {
			impossible("Section.run", `unknown syntax token type: ${type}!!`);
			return 0;
		}

		if (ret === undefined) {
			impossible("Section.run", `token ${type}${token.name ? ` (${token.name}:)` : ''} produced undefined`);
			return 0;
		}
		if (ret === section) {
			impossible("Section.run", `token ${type}${token.name ? ` (${token.name}:)` : ''} produced the section`);
			return 0;
		}
		if (hasEvalReplay) {
			makeEvalReplayFrame(evalReplay, ret, '', tokens, i);
		}
		return ret;
	};
});
