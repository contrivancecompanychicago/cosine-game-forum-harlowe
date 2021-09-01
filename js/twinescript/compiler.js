"use strict";
define(['utils'], ({impossible}) => {
	
	const {stringify} = JSON;
	/*
		A module that handles the JIT compilation of TwineScript syntax tokens
		(received from TwineMarkup) into Javascript code that calls Operations methods.
	*/
	
	/*
		Before I continue, I'd like to explain the API for "TwineScript datatype" objects.
		This is an otherwise plain object that may implement any of the following:
		
		{Function|String} TwineScript_ObjectName:
			returns a string that's used when Harlowe needs to
			name the object in error messages or the debug menu.

		{Function|String} TwineScript_TypeName:
			returns a string that's used when Harlowe needs to
			name the type of the object in error messages or the debug menu.
		
		{Function} TwineScript_Clone:
			a function which clones the value, even if it's an oddly-shaped object.
			Should be used exclusively by VarRef.set().
		
		{Function} TwineScript_+:
			a function which is used to overload the + operator. Note that Harlowe
			automatically forces both sides of + to be of identical type.

		{Function} TwineScript_is:
			a function which is used to overload the "is" operator.

		{Function} TwineScript_IsTypeOf:
			a function which is used to implement the "is a" operator. Should only be
			present on Datatype data. Note that this reverses "is a"'s arguments so
			that the right side has its TwineScript_isTypeOf method called.
		
		{Function} TwineScript_GetProperty:
			a function that, if present, is used to obtain indexed elements
			of the object, as if it were an object or array. Currently used by HookSets, Gradients
			and Colours.

		{Array} TwineScript_Properties:
			an array of property names, which should comprise the only property names
			recognised by the object. Currently used by HookSets, Gradients and Colours.

		{Function} TwineScript_Print:
			a function which is used when this is printed into the passage,
			or used in a (print:) command. This does NOT execute Command objects,
			instead just printing their name.
		
		{Function} TwineScript_Run:
			a function which executes when this is printed into the passage, in place of
			TwineScript_Print. Should only be present on Command objects. Usually
			returns a ChangeDescriptor to permute the <tw-expression> the Command came from.

		{Function} TwineScript_Attach:
			a function used only by certain Command objects, allowing passed-in Changers to be
			"attached" to it, permuting its internal ChangeDescriptor.
		
		{Boolean} TwineScript_Unstorable:
			a value that, if present and truthy, means the value cannot be stored using
			(set:) or (put:), nor can be used inside macros with an Any signature.

		{Boolean} TwineScript_Identifiers:
			a value that, if present and truthy, means the object is the Identifiers object
			in Operations. Should be used exclusively by VarRef.set().

		{Boolean} TwineScript_VariableStore:
			a value that, if present and truthy, means the object is either a State's
			variables store, or a Section's temporary variables store.
			in Operations. Should be used exclusively by VarRef.set().

		{String} TwineScript_VariableStoreName:
			requires the truthy presence of TwineScript_VariableStore. Provides a name
			for the enclosing scope of the variables inside this store, to be used by
			Debug Mode's variable listing.
	*/

	/*
		Everything preceding was concerned with runtime TwineScript operations.
		From here on are functions concerned with compile-time TwineScript -
		that is, compiling TwineScript into JS.
	*/

	/*
		A helper function for compile(). When given a token array, and a
		bunch of token type strings, it returns the index in the array of the
		first token that has one of those types. Very useful.
		
		@param {Array} array The tokens array.
		@param {Array} types The token type(s).
		@return {Number} The array index, or NaN.
	*/
	function indexOfType(array, types) {
		for (let i = 0; i < array.length; i+=1) {
			if (types.includes(array[i].type)) {
				return i;
			}
		}
		return NaN;
	}
	
	/*
		In order for a token to be left-associative, the rightmost one of its type
		needs to be recursively visited first, and the leftmost one deepest.
		So, the array of tokens must be indexed in reverse.
	*/
	function leftAssociativeIndexOfType(array, types) {
		/*
			What this does is tricky: it reverses the passed-in array,
			calls the normal indexOfType, then inverts the returned index
			(converting, say, 3/10 on the reversed array into 7/10 on
			the original array).
		*/
		return (array.length - 1) - indexOfType(...[
			/*
				Regrettably, .reverse() is an in-place method, so a copy must be
				manually made.
			*/
			[...array].reverse(), types
		]);
	}

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
				created by converting "addition" and "subtraction" in compile().
			*/
			{rightAssociative: ["not", "positive", "negative"]},
			{rightAssociative: ["belongingProperty","belongingItProperty", "belongingOperator", "belongingItOperator"]},
			["property","itsProperty", "possessiveOperator", "itsOperator"],
			["twineLink"],
			["macro"],
			["grouping"],
		][order === "most" ? "reverse" : "valueOf"]().some(types => {
			let index;
			if (types.rightAssociative) {
				index = indexOfType(tokens, types.rightAssociative);
			}
			else {
				index = leftAssociativeIndexOfType(tokens, types);
			}
			/*
				Return the token once we find it.
			*/
			if (!Number.isNaN(index) && index > -1) {
				ret = [tokens[index], index];
				return true;
			}
		});
		return ret;
	}

	/*
		A helper for the comparison operators that computes
		which Operations method to call for them.
	*/
	function compileComparisonOperator(token) {
		if (token.type === "inequality") {
			let operation = token.operator;
			return (token.negate ? ({
					'>' :     '<=',
					'<' :     '>=',
					'>=':     '<',
					'<=':     '>',
				}[operation]) : operation);
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
	function reverseComparisonOperator(token) {
		const type = compileComparisonOperator(token);
		return ({
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
		}[type]) || type;
	}

	/*
		A helper that shows which types of operator tokens are comparisons.
	*/
	const comparisonOpTypes = ['inequality','is','isNot','isIn','contains','doesNotContain',
		'isNotIn','isA','typifies','isNotA','untypifies','matches','doesNotMatch'];

	/*
		A helper that creates a TwineError.create() call, stringifying all arguments.
	*/
	function emitTwineError(type, message, explanation) {
		return "TwineError.create(" + stringify(type) + "," + stringify(message) + "," + stringify(explanation) + ")";
	}
	
	/*
		This takes an array from TwineMarkup, rooted at an expression,
		and returns raw Javascript code for the expression's execution.
		
		@param {Array} The tokens array.
		@param {Object} Some flags to carry down recursive calls to compile()
			{Boolean} isVarRef: whether or not this value should be compiled to a VarRef
			{Boolean} isTypedVar: whether or not this value should be compiled to an any-type TypedVar if it's a variable.
				Should only be true for the left-side of 'to' and right-side of 'into'.
			{String} [whitespaceError]: if isVarRef or isTypedVar is true and this is given, this is used as an error
				to be returned if the token was just whitespace.
			{String} [elidedComparison]: whether or not this is part of an elided comparison
				inside an "and" or "or" operation, like "3 < 4 and 5".
			{Boolean} [testNeedsRight]: used solely by the addition and subtraction operators,
				for determining if they are really unary + or - operators. Test the left-hand
				side to see if it needs a right-hand side operand, and if so, return "" instead of
				the TwineError compiled code.
		@return {String} String of Javascript code.
	*/
	function compile(tokens, {isVarRef, isTypedVar, whitespaceError, elidedComparison, testNeedsRight} = {}) {
		const Operations = "Operations", dotCreate = ".create(", It = Operations + ".Identifiers.it";

		// Convert tokens to a 1-size array if it's just a single non-array.
		tokens = [].concat(tokens);
		/*
			Recursive base case: no tokens.
			Any special behaviour that should be done in the event of no tokens
			must be performed elsewhere.
		*/
		if (!tokens.length) {
			/*
				Operations recursively calling this, which require certain data to be in
				these tokens, and which provide an error message to display if they aren't,
				should be abided.
			*/
			if (isVarRef && whitespaceError) {
				return emitTwineError('operation', whitespaceError);
			}
			return "";
		}
		let token;
		/*
			Potential early return if we're at a leaf node.
		*/
		if (tokens.length === 1) {
			token = tokens[0];
			const {type} = token;
			if (type === "identifier") {
				if (isVarRef) {
					return "VarRef" + dotCreate + "Operations.Identifiers," + stringify(token.text) + ")";
				}
				return "Operations.Identifiers." + token.text.toLowerCase() + " ";
			}
			else if (type === "variable" || type === "tempVariable") {
				const ret = "VarRef" + dotCreate + (type === "tempVariable" ? "section.stackTop.tempV" : "State.v") + "ariables,"
					+ stringify(token.name)
					+ ")" + (isVarRef || isTypedVar ? "" : ".get()");
				if (isTypedVar) {
					return "TypedVar" + dotCreate + "Datatype" + dotCreate + "'any')," + ret + ")";
				}
				return ret;
			}
			else if (type === "hookName") {
				return "HookSet" + dotCreate + "{type:'name', data:'" + token.name + "'}) ";
			}
			else if (type === "string") {
				/*
					Note that this is entirely reliant on the fact that TwineScript string
					literals are currently exactly equal to JS string literals (minus template
					strings and newlines).
				*/
				return token.text.replace(/\n/g, "\\n");
			}
			else if (type === "hook") {
				/*
					Slice off the opening [ and closing ] of the source.
				*/
				return "CodeHook" + dotCreate + stringify(token.text.slice(1,-1)) + "," + stringify(token.html || '') + ")";
			}
			else if (type === "colour") {
				return "Colour" + dotCreate + stringify(token.colour) + ")";
			}
			else if (type === "datatype") {
				return "Datatype" + dotCreate + stringify(token.name) + ")";
			}
			/*
				"blockedValue" tokens aren't created by the TwineMarkup tokeniser, but made from permuted macro
				tokens by Renderer.
			*/
			else if (type === "blockedValue") {
				return "section.blockedValue()";
			}
			/*
				Root tokens are usually never passed in, but let's
				harmlessly handle them anyway.
			*/
			else if (type === "root") {
				return compile(token.children);
			}
			/*
				Whitespace is usually harmless, but if it's meant as a VarRef,
				it's almost certainly a mistake.
			*/
			else if (type === "whitespace") {
				if (isVarRef && whitespaceError) {
					return emitTwineError('operation', whitespaceError);
				}
			}
		}

		/*
			Obtain the least precedent token, its index i, and its type.
		*/
		let i;
		[token, i] = precedentToken(tokens, "least");
		const type = (token || {}).type;
		const before = tokens.slice(0, i), after = tokens.slice(i + 1);
		/*
			This helper creates arguments for recursive compile() calls whose results should be VarRefs.
		*/
		const varRefArgs = (side, isTypedVar) => ({isVarRef:true, isTypedVar, whitespaceError:`I need usable data to be on the ${side} of "${token.text}".`});

		const MUST = "must", MUSTNT = "mustn't", MAY = "may";
		let
			/*
				These hold the returned compilations of the tokens
				surrounding a matched token, as part of this function's
				recursive descent.
			*/
			left, right,
			/*
				Construct code using these three type-specific partition strings. Note that, when assigning to these,
				left and right should NOT have any extraneous code attached to them; the "needsLeft" and "needsRight"
				error checking code expects that left remains "" if there are no left tokens, and that
				right remains "" if there are no right tokens.
			*/
			openString = '', midString = '', closeString = '',
			/*
				Some operators should present a simple error when one of their sides is missing.
			*/
			needsLeft = MUST, needsRight = MUST,
			/*
				Some JS operators, like >, don't automatically work when the other side
				is absent, even when people expect them to. e.g. $var > 3 and < 5 (which is
				legal in Inform 6). To cope, I implicitly convert a blank left side to
				"it", which is the nearest previous left-hand operand.
			*/
			implicitLeftIt = false;

		if (!type) {
			/*
				If no token was found, skip the rest of these checks.
			*/
		}
		/*
			The JS comma serves just to separate macro arguments in Harlowe.
		*/
		else if (type === "comma") {
			midString = ",";
			/*
				Unlike Javascript, Harlowe allows trailing commas in calls.
			*/
			needsRight = MAY;
		}
		else if (type === "spread") {
			/*
				Whether or not this actually makes sense as a "mid"string
				is probably easily disputed.
			*/
			openString = Operations + ".makeSpreader(";
			closeString = ")";
			needsLeft = MAY;
		}
		else if (type === "bind") {
			openString = "VarBind" + dotCreate;
			right = compile(after, varRefArgs("right"));
			closeString = (token.text.startsWith('2') ? ",'two way'" : '') + ")";
			needsLeft = MUSTNT;
		}
		else if (type === "to") {
			openString = Operations + ".makeAssignmentRequest(" + Operations + ".setIt(";
			right = compile(after, varRefArgs("right"));
			midString = "),";
			left = compile(before, varRefArgs("left", true));
			closeString = ",'to')";
		}
		else if (type === "into") {
			openString = Operations + ".makeAssignmentRequest(";
			// varRefArgs uses the syntactic left, which isn't the compiler's left.
			right = compile(before, varRefArgs("left"));
			midString = "," + Operations + ".setIt(";
			left  = compile(after, varRefArgs("right", true));
			closeString = "),'into')";
		}
		else if (type === "typeSignature") {
			openString = "TypedVar" + dotCreate;
			midString = ",";
			right = compile(after, varRefArgs("right"));
			closeString = ")";
			/*
				Because this is already being compiled into a TypedVar, the variable on the right does not need
				to be compiled into a TypedVar as well.
			*/
			isTypedVar = false;
		}
		else if (type === "where" || type === "when" || type === "via") {
			openString = "Lambda" + dotCreate;
			left = (compile(before, {isVarRef:true, whitespaceError:null}).trim()
					// Omitting the temp variable means that you must use "it"
					|| "undefined");
			midString = "," + stringify(token.type) + ",";
			right = stringify(compile(after));
			closeString = ","
				// Lambdas need to store their entire Harlowe source.
				+ stringify(tokens.map(e => e.text).join(''))
				+ ")";
		}
		else if (type === "making" || type === "each") {
			/*
				The optional "each" keyword simply permits a lambda to be created using a bare
				successive temp variable, without any other clauses. As such, it doesn't have a
				temp variable preceding it, and its "clause" (the temp variable) is really its subject.
			*/
			if (type === "each") {
				openString = "Lambda" + dotCreate;
				right = compile(after, varRefArgs("right")).trim();
				closeString = ",'where','true',"
					// Lambdas need to store their entire Harlowe source.
					+ stringify(tokens.map(e => e.text).join('')) + ")";
				needsLeft = MAY;
			}
			// Other keywords can have a preceding temp variable, though.
			else {
				openString = "Lambda" + dotCreate;
				left = (compile(before, {isVarRef:true, whitespaceError:null}).trim()
						// Omitting the temp variable means that you must use "it"
						|| "undefined");
				midString = "," + stringify(token.type) + ",";
				right = compile(after, varRefArgs("right")).trim();
				closeString = ","
					// Lambdas need to store their entire Harlowe source.
					+ stringify(tokens.map(e => e.text).join(''))
					+ ")";
			}
		}
		/*
			I'm also not sure if augmented assignment is strictly necessary given that
			one can do (set: $x to it+1), and += is sort of an overly abstract token.
		*/
		else if (type === "augmentedAssign") {
			openString = Operations + ".makeAssignmentRequest(";
			left = compile(before, varRefArgs("left"));
			/*
				This line converts the "b" in "a += b" into "a + b" (for instance),
				thus partially de-sugaring the augmented assignment.
				
				Note that the left tokens must be compiled again, as a non-varRef this time.
				
				Note also that this assumes the token's assignment property corresponds to
				a binary-arity Operation method name.
			*/
			midString = ",";
			right = "Operations[" + stringify(token.operator) + "]("
				+ (compile(before) + ","
				+  compile(after)) + ")";
			closeString = "," + stringify(token.operator) + ")";
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
				if (!token) {
					return;
				}
				if (comparisonOpTypes.includes(token.type)) {
					return token;
				}
				if (['and','or'].includes(token.type)) {
					return (isComparisonOp(tokens.slice(0, i)) || isComparisonOp(tokens.slice(i + 1)));
				}
			};

			const
				leftIsComparison        = isComparisonOp(before),
				rightIsComparison       = isComparisonOp(after),
				// This error message is used for elided "is not" comparisons.
				ambiguityError = emitTwineError('operation', "This use of \"is not\" and \"" + type + "\" is grammatically ambiguous.",
					"Maybe try rewriting this as \"__ is not __ " + type + " __ is not __\"");

			openString = Operations + "." + type + "(";
			midString = ",";
			closeString = ")";

			/*
				If elidedComparison is a matching type, then this token is a continuation of an elided
				comparison, such as "3 < 4 and [5 and 6]".
				Simply add the left and right side as arguments to elidedComparisonOperator().
			*/
			if (elidedComparison === token.type) {
				openString = closeString = '';
				left  = (compile(before, {isVarRef, elidedComparison})).trim();
				right = (compile(after, {elidedComparison})).trim();
			}
			/*
				If the left side is a comparison operator, and the right side is not,
				wrap the right side in an elidedComparisonOperator call.
				This transforms statements like (if: $a > 2 and 3) into (if: $a > 2 and it > 3).
			*/
			else if (leftIsComparison && !rightIsComparison) {
				const
					leftSide = leftIsComparison,
					operator = stringify(compileComparisonOperator(leftSide));

				/*
					The one operation for which this transformation cannot be allowed is "is not",
					because of its semantic ambiguity ("a is not b and c") in English.
				*/
				if (leftSide.type === 'isNot' || leftSide.type === 'isNotA' || leftSide.type === 'untypifies') {
					return ambiguityError;
				}
				right = "Operations.elidedComparisonOperator("
					+ stringify(token.type) + ","
					+ operator + ","
					+ compile(after, {elidedComparison:type})
					+ ")";
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
					operator = stringify(reverseComparisonOperator(rightSide));

				/*
					Again, "is not" should not be transformed.
				*/
				if (rightSide.type === 'isNot' || rightSide.type === 'isNotA' || rightSide.type === "untypifies") {
					return ambiguityError;
				}
				right = "Operations.elidedComparisonOperator("
					+ stringify(token.type) + ","
					+ operator + ","
					+ compile(before, {elidedComparison:type})
					+ ")";

				/*
					The following additional action swaps the tokens to the right and left of rightSide,
					and changes rightSide's type into its inverse. This changes ($b < 3) into (3 > $b),
					and thus alters the It value of the expression from $b to 3.

					For multi-part comparisons, (3 and 4 and 5 < 6) becomes (6 > 5 and it > 3 and it > 4).

					This could cause issues when "it" is used explicitly in the expression, but frankly such
					uses are already kinda nonsensical ("(if: $a is in it and $b)"?).
				*/
				left =
					compile([
						...tokens.slice(rightIndex + 1),
						// Create a copy of rightSide with the type changed, rather than mutate it in-place.
						Object.assign(Object.create(rightSide), {
							[rightSide.type === "inequality" ? "operator" : "type"]:
								reverseComparisonOperator(rightSide),
						}),
						...tokens.slice(i + 1, rightIndex),
					]);
			}
			/*
				Note for comparison operations:
				If two variables are being compared (such as $a < $y or $b contains $c)
				and the comparison operation is in potential VarRef position
				(such as (set: $x to $a < $y)) then don't compile the variables into VarRefs
				(because comparison operations can't, and shouldn't, process VarRefs instead of values.)
			*/
			isVarRef = false;
		}
		/*
			The following are the comparison operators.
		*/
		else if (comparisonOpTypes.includes(type)) {
			implicitLeftIt = true;
			isVarRef = false;
			openString = Operations + "[" + stringify(compileComparisonOperator(token)) + "](";
			midString = ",";
			closeString = ")";
		}
		else if (type === "addition" || type === "subtraction") {
			/*
				"addition" and "subtraction" have the unfortunate ignomity of being identical in appearance to
				unary + and -, and lack easy rules for distinguishing when they can and can't follow certain token types.
				As a result, converting one into the other can, to my knowledge, only be done here, in compilation,
				instead of the lexer.
				The test for determining whether this is a unary or binary +/- is to attempt compiling the left side,
				and if it "fails" (using testNeedsRight to mask the error) or is empty, decide that it is unary.
			*/
			const testLeft = compile(before, { testNeedsRight: true }).trim();
			if (!testLeft) {
				/*
					Converting the token to a unary "positive" or "negative" involves the slightly #awkward
					yet concise step of permuting the token in-place, then redoing this compile() invocation
					entirely.
				*/
				token.type = ({ addition: "positive", subtraction: "negative" }[type]);
				return compile(tokens, {isVarRef, whitespaceError, elidedComparison, testNeedsRight});
			}
			isVarRef = false;
			openString = Operations + "[" + stringify(token.text) + "](";
			midString = ",";
			closeString = ")";
		}
		else if (type === "multiplication" || type === "division") {
			isVarRef = false;
			openString = Operations + "[" + stringify(token.text) + "](";
			midString = ",";
			closeString = ")";
		}
		else if (type === "positive" || type === "negative") {
			isVarRef = false;
			left = (type === "negative" ? "-1" : "1");
			openString = Operations + "['*'](";
			midString = ",";
			closeString = ")";
		}
		else if (type === "not") {
			openString = Operations + ".not(";
			right = compile(after);
			closeString = ")";
			needsLeft = MAY;
		}
		else if (type === "belongingProperty") {
			/*
				As with the "property" case, we need to manually wrap the variable side
				inside the Operations.get() call, while leaving the other side as is.
			*/
			openString = "VarRef" + dotCreate;
			/*
				belongingProperties place the variable on the right.
			*/
			right = compile(after, varRefArgs("right"));
			closeString = ","
				/*
					stringify() is used to both escape the name
					string and wrap it in quotes.
				*/
				+ stringify(token.name) + ")"
				+ (isVarRef ? "" : ".get()");
			needsLeft = MAY;
		}
		else if (type === "belongingOperator" || type === "belongingItOperator") {
			if (token.type.includes("It")) {
				left = It;
			}
			else {
				// Since, as with belonging properties, the variable is on the right,
				// we must compile the right side as a varref.
				left = compile(after, varRefArgs("right"));
			}
			right = compile(before);
			openString = "VarRef.create(";
			midString = ",{computed:true,value:";
			closeString = "})" + (isVarRef ? "" : ".get()");
		}
		/*
			Notice that this one is right-associative instead of left-associative.
			This must be so because, by branching on the rightmost token, it will compile to:
				VarRef.create(VarRef.create(a,1).get(),2).get()
			instead of the incorrect:
				VarRef.create(a,1).get() VarRef.create(,2).get()
		*/
		else if (type === "property") {
			/*
				This is somewhat tricky - we need to manually wrap the left side
				inside the Operations.get() call, while leaving the right side as is.
			*/
			openString = "VarRef" + dotCreate;
			left = compile(before, varRefArgs("left"));
			closeString = ","
				/*
					stringify() is used to both escape the name
					string and wrap it in quotes.
				*/
				+ stringify(token.name) + ")"
				+ (isVarRef ? "" : ".get()");
			needsRight = MAY;
		}
		else if (type === "itsProperty" || type === "belongingItProperty") {
			/*
				This is actually identical to the above, but with the difference that
				there is no left subtoken (it is always Identifiers.it).
			*/
			openString = "VarRef" + dotCreate;
			left = It;
			closeString = ","
				/*
					stringify() is used to both escape the name
					string and wrap it in quotes.
				*/
				+ stringify(token.name) + ")"
				+ (isVarRef ? "" : ".get()");
			needsLeft = needsRight = MAY;
		}
		else if (type === "possessiveOperator" || type === "itsOperator") {
			if (token.type.includes("it")) {
				left = It;
				needsLeft = MAY;
			}
			openString = "VarRef" + dotCreate;
			midString = ",{computed:true,value:";
			closeString = "})" + (isVarRef ? "" : ".get()");
			/*
				The left side should not be compiled into a TypedVar even if it's in position - for instance,
				num-type $a's ('foo') shouldn't compile "num-type $a" into a TypedVar.
			*/
			isTypedVar = false;
		}
		else if (type === "twineLink") {
			/*
				This crudely desugars the twineLink token into a
				(link-goto:) token, in a manner similar to that in Renderer.
			*/
			midString = 'Macros.run("link-goto", [section,'
				+ stringify(token.innerText) + ","
				+ stringify(token.passage) + "])";
			needsLeft = needsRight = MUSTNT;
		}
		else if (type === "macro") {
			/*
				The first child token in a macro is always the method name.
			*/
			const macroNameToken = token.children[0];
			const variableCall = macroNameToken.text[0] === "$" || macroNameToken.text[0] === "_";
			if(macroNameToken.type !== "macroName" && !variableCall) {
				impossible('Compiler.compile', 'macro token had no macroName child token');
			}
			midString = 'Macros.run' + (variableCall ? 'Custom' : '') + '('
				+ (variableCall
					/*
						Transmute the macro name, which contains a variable, into a VarRef.
					*/
					? "VarRef" + dotCreate + (macroNameToken.text[0] === "_" ? "section.stackTop.tempV" : "State.v") + "ariables,"
						+ stringify(macroNameToken.text.trim().slice(1,-1))
						+ ").get()"
					: '"' + token.name + '"'
				)
				/*
					The arguments given to a macro instance are given in an array.
				*/
				+ ', ['
				/*
					The first argument to macros must be the current section,
					so as to give the macros' functions access to data
					about the runtime state (such as, whether this expression
					is nested within another one).
				*/
				+ "section,"
				/*
					You may notice here, unseen, is the assumption that Javascript array literals
					and TwineScript macro invocations use the same character to separate arguments/items.
					(That, of course, being the comma - (macro: 1,2,3) vs [1,2,3].)
					This is currently true, but it is nonetheless a fairly bold assumption.
				*/
				+ compile(token.children.slice(1),
				/*
					To allow destructuring patterns to work, macros in destructuring position should
					compile all of their contained VarRefs to TypedVars.
				*/
				{isTypedVar})
				+ '])';
			needsLeft = needsRight = MUSTNT;
		}
		else if (type === "grouping") {
			midString = "(" + compile(token.children, {isVarRef}) + ")";
			needsLeft = needsRight = MUSTNT;
		}
		else if (type === "error") {
			return emitTwineError('syntax', stringify(token.message), token.explanation ? stringify(token.explanation) : '');
		}
		/*
			If a token was found, we can recursively
			compile those next to it.
		*/
		if (i > -1) {
			/*
				Any of the comparisons above could have provided specific
				values for left and right, but usually they will just be
				the tokens to the left and right of the matched one.
			*/
			left  = (left  || compile(before, {isVarRef, isTypedVar})).trim();
			right = (right || compile(after)).trim();
			/*
				The compiler should implicitly insert the "it" keyword when the
				left-hand-side of a comparison operator was omitted.
			*/
			if (implicitLeftIt && !(left)) {
				left = It;
			}
			/*
				If a value is missing from the left or right, and it MUST be there,
				produce an error message.
			*/
			if ((needsLeft === MUST && !left) || (needsRight === MUST && !right)) {
				/*
					testNeedsRight, used only by the "addition" and "subtraction" branches,
					indicates that this compile() is purely speculative,
					to determine whether compiling this without a usable right-side would produce
					an error or nothing. In that case, we return "" instead of the full error.
				*/
				if (testNeedsRight && needsRight && !right) {
					return "";
				}
				/*
					Otherwise, create the error object for end-user examination.
				*/
				return emitTwineError('operation', "I need usable code to be "
					+ (needsLeft === MUST ? "left " : "")
					+ (needsLeft === MUST && needsRight === MUST ? "and " : "")
					+ (needsRight === MUST ? "right " : "")
					+ 'of ' + token.text + '.');
			}
			/*
				Conversely, if a value is present at the left or right, and it MUSTN'T be there,
				produce an error message.
			*/
			if ((needsLeft === MUSTNT && left) || (needsRight === MUSTNT && right)) {
				return emitTwineError('operation', "There can't be a "
					+ ((left && needsLeft === MUSTNT && right && needsRight === MUSTNT) ? left + ' or ' + right
						: (left && needsLeft === MUSTNT ? left : right))
					+ " to the "
					+ (needsLeft === MUSTNT ? "left " : "")
					+ (needsLeft === MUSTNT && needsRight === MUSTNT ? "or " : "")
					+ (needsRight === MUSTNT ? "right " : "")
					+ 'of ' + token.text + ".",
					"There could be a comma missing between them, or there could be a ");
			}
			return openString + left + midString + right + closeString;
		}
		/*
			Base case: just convert the tokens back into text.
		*/
		else if (tokens.length === 1) {
			/*
				This should default to a " " so that some separation lies between tokens.
				Otherwise, some tokens like "contains" will break in certain (rare) circumstances.
			*/
			return (('value' in tokens[0] ? tokens[0].value : tokens[0].text) + "").trim() || " ";
		}
		else {
			return tokens.reduce((a, token) => a + compile(token, {isVarRef, isTypedVar}), "");
		}
	}
	
	return compile;
});
