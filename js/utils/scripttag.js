'use strict';
define('utils/scripttag', ['state','utils/operationutils', 'internaltypes/varref', 'internaltypes/twineerror'], (State, OperationUtils, VarRef, TwineError) => {
	/*d:
		HTML script tag markup

		This section details further information about the workings of `<script>` elements placed inside Harlowe passages, and how the Javascript code relates to the Harlowe code in the containing passage.

		If a `<script>` tag has a `type` attribute, and the MIME-type in that attribute is anything other than 'text/javascript', Harlowe will ignore it (in keeping with HTML's normal behaviour).

		No Harlowe internal methods and modules are currently accessible inside scripts. However, [jQuery 3.6](https://api.jquery.com/) may be accessed from the `$` global variable. This is a third-party library that Harlowe uses internally
		and whose code is included in every compiled story, and is *not* retrieved via CDN or any online connections.

		As of Harlowe 3.3.0, `<script>` elements are run while Harlowe runs the macros and expressions in a passage. Thus, if a macro or hook is before the `<script>` tag in the passage, it will be run beforehand,
		and if a macro or hook is after it, it will be run after it. To defer the execution of Javascript code until the passage is fully rendered or run, consider using a `setTimeout` callback.

		As of Harlowe 3.3.0, Javascript code in `<script>` elements (that is, *without* a `src` attribute) has access to Harlowe variables - both story-wide variables that begin with `$`, and temporary (temp) variables
		that begin with `_` which are visible in the same hook as the `<script>` element. Harlowe variables are accessed by writing the Harlowe variable name as if it were a Javascript variable.
		Valid Harlowe variable names are also coincidentally valid Javascript names, so there's no need to escape or modify them. Assigning to these names will immediately update the Harlowe variable, if possible.

		Example usage:
		```
		(set: _harloweVariable to "You're reading the ")\
		<script>
		_harloweVariable += document.title.bold();
		</script>\
		(print: _harloweVariable)
		```

		Details:
		
		To eliminate any confusion: These names are *not* Javascript variables, or even global `window` properties, but object getters and setters added to the script's scope using a `with` statement.
		These names do not pollute or overwrite the global scope (although they shadow any global variables with the same names, such as `window.$arr` being shadowed by a Harlowe variable $arr), and
		remain accessible and current even inside a callback created within the script. Moreover, even though these names are created using a `with` statement, it is still possible to opt
		into Javascript's ["strict mode"](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode) by placing the `"use strict"` pragma at the start of the script.

		If "strict mode" is not enabled for the script, an error will **not** occur if you attempt to assign to a Harlowe variable that doesn't exist, such as by writing `$arr = []` - instead, a global
		Javascript variable will be created.

		Harlowe variables in Javascript currently have the following restrictions.

		* Only the following six Javascript datatypes may be assigned to Harlowe variables: booleans, strings, numbers (except NaN and Infinity), Maps (created by Map() or a subclass) that
		have **only strings as keys**, Sets (created by Set() or a subclass) and Arrays. These last three data structures can only contain the aforementioned six datatypes. Attempting to assign other values
		will produce an error. The restriction on Map keys may be removed in a future version of Harlowe.
		* Only the following Harlowe datatypes may be accessed from Javascript: numbers, booleans, strings, datamaps, datasets and arrays. These last three data structures
		can only contain the aforementioned six datatypes. Attempting to read other values from Harlowe variables will produce an error.
		* Of course, if the Harlowe variable was type-restricted (using the `-type` syntax in a (set:), (put:) or (unpack:) macro call) then this restriction will also apply to
		Javascript assignments. Assigning the wrong datatype to a type-restricted Harlowe variable will cause an error.
		* Data structures are deep-cloned when read from Harlowe variables and assigned to Harlowe variables. Hence, Javascript code cannot receive direct references
		to Harlowe values. This is to prevent Harlowe data structures from being deeply mutated (such as by calling `.set()` on a Harlowe datamap, or `.push()` on a Harlowe array)
		as a way of circumventing the previous two restrictions.
		* As a consequence of the above, "expando" properties (such as `let a = []; a.pigs = 1;`) are erased from data structures, and data structures created from subclasses of Map, Set
		or Array will be converted to instances of the base class.
		* Story-wide variables that were only created after the `<script>` was run will NOT be available to the script, even if the script creates a callback function that is called later.
		
		Finally, there is no way to call Harlowe macros from Javascript, at present. There is also no way to access identifiers like `exits` or `visits` from Javascript, at present.

		A redundant note:

		Harlowe is not meant to be a story format that you write using Javascript instead of its own language, and I have taken great care in designing it such that authors are not rewarded for knowing how to write Javascript.
		The `<script>` element feature is intended solely to complement existing Harlowe code, by allowing small samples of Javascript to minimally interact with it. As such, I recommend using it sparingly and judiciously.
		That being said, feel free to use this feature in any way you wish, as long as you understand whether your usage lines up with its purpose and intent.

		#extra
	*/
	return function(script, locals) {
		/*
			Harlowe variables' visibility in JS <script> is implemented via a with() statement. Because this isn't allowed in strict mode,
			this convenient Function() constructor is used instead. This also has the advantage of running this in global scope, WITHOUT
			State or Utils being visible.
		*/
		(Function('script', 'scope',
			/*
				The two variables of this function, plus its arguments, are shadowed with undefined to make them unusable to the <script>.
				Even the script variable is shadowed.
				Non-strict mode makes shadowing 'arguments' possible.
			*/
			`with(scope){var scope=void 0,arguments=void 0;eval([script,script=void 0][0]);}`
		)(script,
			/*
				The with() statement receives a clean object with a bunch of getters/setters (a descriptor given as the second argument of Object.create())
				that are constructed below. Thus, when the <script> assigns to the variables, the functions below redirect the data to the appropriate
				variables store.
			*/
			Object.create(null,
				/*
					Both global and local variables are mixed in like so.
				*/
				Object.keys(State.variables).map(e => !e.startsWith("TwineScript_") && "$" + e)
				.concat(Object.keys(locals).map(e => !e.startsWith("TwineScript_") && "_" + e))
				.reduce((a, name) => {
					/*
						The descriptor converts JS values to Harlowe values, and produces errors if that's not possible.
					*/
					name && (a[name] = {
						get() {
							const v = (name[0] === "$" ? State.variables : locals)[name.slice(1)];
							if (!OperationUtils.isHarloweJSValue(v)) {
								/*
									To suspend JS execution immediately, a throw statement is used even for a TwineError.
									Section should catch these thrown TwineErrors.
								*/
								throw TwineError.create('',
									`The contents of the variable ${name}, ${OperationUtils.objectName(v)}, couldn't be converted to a Javascript value.`,
									'Only booleans, strings, numbers, datamaps, datasets and arrays can be converted to Javascript values.');
							}
							return OperationUtils.clone(v);
						},
						set(v) {
							const source = name[0] === "$" ? State.variables : locals;
							if (!OperationUtils.isHarloweJSValue(v)) {
								throw TwineError.create('',
									`The Javascript value, ${v}, couldn't be converted to a Harlowe value and assigned to the variable ${name}.`,
									'Only booleans, strings, numbers (except NaN and Infinity), Maps, Sets and Arrays can be converted to Harlowe values.');
							}
							/*
								To prevent expando properties from being leaked into Harlowe, values are cloned before being set.
								Cloning arrays also erases holes in them.
							*/

							/*
								As mentioned above, values are cloned before assignment.
								To ensure proper type-restriction checking, VarRef.set() is used.
							*/
							v = OperationUtils.clone(v);
							const error = VarRef.create(source, name.slice(1)).set(v);
							if (TwineError.containsError(error)) {
								throw error;
							}
						},
					});
					return a;
				}, {}))));
	};
});