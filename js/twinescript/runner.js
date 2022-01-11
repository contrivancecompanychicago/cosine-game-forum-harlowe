"use strict";
define([
	'macros',
	'state',
	'utils',
	'datatypes/colour',
	'datatypes/hookset',
	'datatypes/lambda',
	'datatypes/datatype',
	'datatypes/varbind',
	'datatypes/codehook',
	'datatypes/typedvar',
	'internaltypes/varref',
	'internaltypes/twineerror'
],
/*
	To keep the eval scope very clean in compiled code, no destructuring is done here.
*/
(Macros, State, Utils, Colour, HookSet, Lambda, Datatype, VarBind, CodeHook, TypedVar, VarRef, TwineError) => {

	const precedenceTable = 
		/*
			The following is the precedence table for Harlowe tokens,
			in ascending order of tightness. Each row has identical precedence.
			Absent token types have the least precedence.
			Associativity doesn't matter for most operators, as their results aren't
			chainable with themselves (you can't write "$a to 2 to 2", for instance).
		*/
		[
			["error"],
			["comma"],
			["to","into"],
			["where", "when", "via"],
			["making", "each"],
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
		return TwineError.create('operation', `I need usable code to be ${needsLeft ? "left " : ""}${needsLeft && needsRight ? "and " : ""}${needsRight ? "right " : ""}of ${token.text}.`);
	}

	function wrongSideError(wrongLeft, wrongRight, token) {
		return TwineError.create('operation',
			`There can't be a ${
					(wrongLeft && wrongRight)
					? wrongLeft.map(e => e.text).join('') + ' or ' + wrongRight.map(e => e.text).join('')
					: (wrongLeft || wrongRight).map(e => e.text).join('')
				} to the ${wrongLeft ? "left " : ""}${wrongLeft && wrongRight ? "or " : ""}${wrongRight ? "right " : ""}of ${token.text}.`,
			"There could be a comma missing between them."
		);
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
		const ops = section.operations;
		let token;

		/*
			The passed-in tokens are an array when a lambda is run and a single token (the macro itself)
			when a macro is run.
		*/
		if (!Array.isArray(tokens)) {
			tokens = [tokens];
		}

		if (!tokens.length) {
			Utils.impossible('Runner.run', 'No tokens to run!');
			return undefined;
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
		const type = (token || {}).type;
		if (!type) {
			/*
				If no token was found, toss up an error.
			*/
			Utils.impossible('Runner.run', 'no tokens were passed in!');
			return;
		}

		/*
			Perform the error-checking for tokens requiring or prohibiting more
			precedent tokens on their sides.
		*/
		const sides = tokenSides[type] || '';

		if (sides === "both" && (!before || !after)) {
			return missingSideError(!before, !after, token);
		}
		if (sides === "neither" && (before || after)) {
			return wrongSideError(before, after, token);
		}
		if (sides === "before") {
			if (!before) {
				return missingSideError(true, false, token);
			}
			if (after) {
				return wrongSideError(null, after, token);
			}
		}
		if (sides === "after") {
			if (!after) {
				return missingSideError(false, true, token);
			}
			if (before) {
				return wrongSideError(before, null, token);
			}
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
		if (type === "comma") {
			Utils.impossible('Section.run', 'a comma token was run() somehow.');
			return;
		}
		/*
			Root tokens are usually never passed in, but let's
			harmlessly handle them anyway.
		*/
		else if (type === "root") {
			return run(section, token.children);
		}
		else if (type === "identifier") {
			if (isVarRef) {
				return VarRef.create(ops.Identifiers, token.text.toLowerCase());
			}
			return ops.Identifiers[token.text.toLowerCase()];
		}
		else if (type === "variable" || type === "tempVariable") {
			let ret = VarRef.create(type === "tempVariable" ? section.stackTop.tempVariables : State.variables,
				token.name);

			if (isTypedVar) {
				ret = TypedVar.create(Datatype.create('any'),ret);
			}
			else if (!isVarRef) {
				ret = ret.get();
			}
			return ret;
		}
		else if (type === "hookName") {
			return HookSet.create({type:'name', data:token.name});
		}
		else if (type === "number" || type === "cssTime") {
			return token.value;
		}
		else if (type === "boolean") {
			return token.text.toLowerCase() === "true";
		}
		else if (type === "string") {
			/*
				Note that this is reliant on the fact that TwineScript string
				literals are currently exactly equal to JS string literals (minus template
				strings and newlines).
			*/
			return eval(token.text.replace(/(.?)\n/g, (_,a) =>
				/*
					If a literal newline has a \ before it (such as when invoking the escaped line ending syntax), DON'T escape the newline without escaping the \ first.
				*/
				(a === "\\" ? "\\\\" : a === "\n" ? "\\n" : a) + "\\n"));
		}
		else if (type === "hook") {
			/*
				Slice off the opening [ and closing ] of the source.
			*/
			return CodeHook.create(token.text.slice(1,-1), token.html || '');
		}
		else if (type === "colour") {
			return Colour.create(token.colour);
		}
		else if (type === "datatype") {
			return Datatype.create(token.name);
		}
		else if (type === "spread") {
			/*
				Whether or not this actually makes sense as a "mid"string
				is probably easily disputed.
			*/
			return ops.makeSpreader(run(section,  after, false, isTypedVar));
		}
		else if (type === "bind") {
			return VarBind.create(run(section,  after, VARREF), token.text.startsWith('2') ? 'two way' : '');
		}
		else if (type === "to") {
			return ops.makeAssignmentRequest(
				ops.setIt(run(section,  before, VARREF, TYPEDVAR)),
				/*
					This needs to be a VarRef so that (set: $b to 0, $d to $b) can work.
				*/
				run(section,  after, VARREF),
				'to');
		}
		else if (type === "into") {
			return ops.makeAssignmentRequest(
				ops.setIt(run(section,  after, VARREF, TYPEDVAR)),
				/*
					This needs to be a VarRef so that (set: $b to 0, $d to $b) can work.
				*/
				run(section,  before, VARREF),
				'into');
		}
		else if (type === "typeSignature") {
			/*
				Because this is already being compiled into a TypedVar, the variable on the right does not need
				to be compiled into a TypedVar as well.
			*/
			return TypedVar.create(
				run(section,  before, isVarRef),
				run(section,  after, VARREF)
			);
		}
		else if (type === "where" || type === "when" || type === "via") {
			if (!after) {
				return missingSideError(false, true, token);
			}
			/*
				Lambdas need to store their entire Harlowe source, for display with (source:)
			*/
			const source = tokens.map(e => e.text).join('');
			/*
				Type errors for 'before' and 'after' are handled by Lambda.create().
			*/
			return Lambda.create(
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
		else if (type === "making" || type === "each") {
			if (!after) {
				return missingSideError(false, true, token);
			}
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
				return Lambda.create(
					run(section,  after, VARREF),
					'each',
					null,
					source
				);
			}
			// Other keywords can have a preceding temp variable, though.
			else {
				return Lambda.create(
					run(section,  before, VARREF),
					token.type,
					/*
						The 'making' or 'each' clause must be a VarRef, which is computed now.
					*/
					run(section,  after, VARREF),
					source
				);
			}
		}
		/*
			I'm also not sure if augmented assignment is strictly necessary given that
			one can do (set: $x to it+1), and += is sort of an overly abstract token.
		*/
		else if (type === "augmentedAssign") {
			return ops.makeAssignmentRequest(
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
				return [run(section, tokens)];
			};

			const
				leftIsComparison        = isComparisonOp(before),
				rightIsComparison       = isComparisonOp(after),
				// This error message is used for elided "is not" comparisons.
				ambiguityError = TwineError.create('operation', "This use of \"is not\" and \"" + type + "\" is grammatically ambiguous.",
					"Maybe try rewriting this as \"__ is not __ " + type + " __ is not __\"");

			/*
				If the left side is a comparison operator, and the right side is not,
				wrap the right side in an elidedComparisonOperator call.
				This transforms statements like (if: $a > 2 and 3) into (if: $a > 2 and it > 3).
			*/
			if (leftIsComparison && !rightIsComparison) {
				const
					leftSide = leftIsComparison,
					operator = compileComparisonOperator(leftSide);

				/*
					The one operation for which this transformation cannot be allowed is "is not",
					because of its semantic ambiguity ("a is not b and c") in English.
				*/
				if (leftSide.type === 'isNot' || leftSide.type === 'isNotA' || leftSide.type === 'untypifies') {
					return ambiguityError;
				}
				return ops[type](
					run(section, before),
					ops.elidedComparisonOperator(token.type, operator,
						...getElisionOperands(after)/*all elided comparisons in after*/
					)
				);
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
					rightIndex = tokens.indexOf(rightSide),
					operator = reverseComparisonOperator(rightSide);

				/*
					Again, "is not" should not be transformed.
				*/
				if (rightSide.type === 'isNot' || rightSide.type === 'isNotA' || rightSide.type === "untypifies") {
					return ambiguityError;
				}

				return ops[type](
					/*
						The following additional action swaps the tokens to the right and left of rightSide,
						and changes rightSide's type into its inverse. This changes ($b < 3) into (3 > $b),
						and thus alters the It value of the expression from $b to 3.

						For multi-part comparisons, (3 and 4 and 5 < 6) becomes (6 > 5 and it > 3 and it > 4).

						This could cause issues when "it" is used explicitly in the expression, but frankly such
						uses are already kinda nonsensical ("(if: $a is in it and $b)"?).
					*/
					run(section, [
						...tokens.slice(rightIndex + 1),
						// Create a copy of rightSide with the type changed, rather than mutate it in-place.
						Object.assign(Object.create(rightSide), {
							[rightSide.type === "inequality" ? "operator" : "type"]:
								reverseComparisonOperator(rightSide),
						}),
						...tokens.slice(i + 1, rightIndex),
					]),
					ops.elidedComparisonOperator(token.type, operator,
						...getElisionOperands(before)/*all elided comparisons in before*/
					)
				);
			}
			/*
				Note for comparison operations:
				If two variables are being compared (such as $a < $y or $b contains $c)
				and the comparison operation is in potential VarRef position
				(such as (set: $x to $a < $y)) then don't compile the variables into VarRefs
				(because comparison operations can't, and shouldn't, process VarRefs instead of values.)
			*/
			return ops[type](run(section, before), run(section, after));
		}
		/*
			The following are the comparison operators.
		*/
		else if (comparisonOpTypes.includes(type)) {
			if (!after) {
				missingSideError(false, true, token);
			}
			return ops[compileComparisonOperator(token)](
				!before ? ops.Identifiers.it : run(section,  before),
				run(section,  after)
			);
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
				const [previousPrecedentToken,i] = precedentToken(before, "least");
				const sides = tokenSides[previousPrecedentToken], pType = previousPrecedentToken.type;
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
				const ret = run(section,  tokens);
				token.type = type;
				return ret;
			} else {
				return ops[token.text](
					run(section,  before),
					run(section,  after)
				);
			}
		}
		else if (type === "multiplication" || type === "division") {
			return ops[token.text](
				run(section,  before),
				run(section,  after)
			);
		}
		else if (type === "positive" || type === "negative") {
			return ops['*'](
				(type === "negative" ? -1 : 1),
				run(section, after)
			);
		}
		else if (type === "not") {
			return ops.not(run(section,  after));
		}
		else if (type === "belongingProperty") {
			const ret = VarRef.create(
				run(section,  after, VARREF),
				token.name
			);
			return isVarRef ? ret : ret.get();
		}
		else if (type === "belongingOperator" || type === "belongingItOperator") {
			const ret = VarRef.create(
				token.type.includes("It") ? ops.Identifiers.it :
					// Since, as with belonging properties, the variable is on the right,
					// we must compile the right side as a varref.
					run(section,  after, VARREF),
				{computed:true,value:run(section,  before)}
			);
			return isVarRef ? ret : ret.get();
		}
		/*
			Notice that this one is right-associative instead of left-associative.
			This must be so because, by branching on the rightmost token, it will compile to:
				VarRef.create(VarRef.create(a,1).get(),2).get()
			instead of the incorrect:
				VarRef.create(a,1).get() VarRef.create(,2).get()
		*/
		else if (type === "property") {
			const ret = VarRef.create(
				run(section, before, VARREF),
				token.name
			);
			return isVarRef ? ret : ret.get();
		}
		else if (type === "itsProperty" || type === "belongingItProperty") {
			const ret = VarRef.create(
				ops.Identifiers.it,
				token.name
			);
			return isVarRef ? ret : ret.get();
		}
		else if (type === "possessiveOperator" || type === "itsOperator") {
			if (!after || (!before && token.type !== "itsOperator")) {
				return missingSideError(!before, !after, token);
			}
			/*
				The left side should not be compiled into a TypedVar even if it's in position - for instance,
				num-type $a's ('foo') shouldn't compile "num-type $a" into a TypedVar.
			*/
			const ret = VarRef.create(
				token.type === "itsOperator" ? ops.Identifiers.it : run(section,  before, isVarRef),
				{computed:true, value:run(section,  after)}
			);
			return isVarRef ? ret : ret.get();
		}
		else if (type === "twineLink") {
			/*
				This crudely desugars the twineLink token into a
				(link-goto:) token, in a manner similar to that in Renderer.
			*/
			return Macros.run("link-goto",section,[token.innerText,token.passage]);
		}
		else if (type === "macro") {
			/*
				Blocker macros are marked with 'blockedValue', representing the value they would
				evaluate to, in Renderer. The blockers are run separately from the main macros
				whenever section is blocked. If it isn't, use the saved blockedValue() that was
				produced by their execution.
			*/
			if (token.blockedValue && !section.blocked) {
				return section.blockedValue();
			}
			/*
				The first child token in a macro is always the method name.
			*/
			const macroNameToken = token.children[0];
			const variableCall = macroNameToken.text[0] === "$" || macroNameToken.text[0] === "_";
			if(macroNameToken.type !== "macroName" && !variableCall) {
				Utils.impossible('Section.run', 'macro token had no macroName child token');
			}
			return Macros[variableCall ? "runCustom" : "run"](
				variableCall
					? VarRef.create(
						macroNameToken.text[0] === "_" ? section.stackTop.tempVariables : State.variables,
						macroNameToken.text.trim().slice(1,-1)
					).get()
					: token.name,
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
		else if (type === "grouping") {
			return run(section,  token.children, isVarRef);
		}
		else if (type === "error") {
			return TwineError.create('syntax', token.message, token.explanation || '');
		}
		else if (type === "text") {
			return TwineError.create('syntax', `"${token.text}" isn't valid Harlowe syntax for the inside of a macro call`,
				"Maybe you misspelled something? Also, as of 3.3.0, Javascript syntax is not allowed inside macro calls.");
		}
		else {
			Utils.impossible("Section.run", `unknown syntax token type: ${type}!!`);
			return token.text;
		}
	};
});
