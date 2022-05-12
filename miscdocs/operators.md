Appendix: Operators and order-of-operations

The following table is a complete list of all operators and other non-identifier keywords in Harlowe,
as well as the order of operations that Harlowe uses to compute expressions. This is a *rough* summary of information found in the "Types of data" articles in this manual. For more details on these operators and how they interact with a given data type, please consult those articles.

These operators are listed in reverse order of operation. Those with a lower order number are evaluated first.

| Order | Operator(s) | Syntax&nbsp;Description | Usage |
| --- | --- | --- | --- |
| 17 | `,` | Any `,` [Any] | Commas are not actually operators, but part of the macro syntax, used to separate expressions given to a macro. However, to express their order-of-operations relationship to the actual operators, they are listed here. Just remember: everything between commas (inside a single macro call) is evaluated separately from each other. Also note that trailing commas (commas without a right side) in macro calls are valid, even though they don't do anything
| 16 | `to`, `into` | Variable or TypedVar `to` Any<br>Any `into` Variable or TypedVar | Used only by (set:) and (put:), these put the data value into the named variable. If the variable is a TypedVar, it becomes restricted to that datatype or data pattern first (which may cause the entire operation to error). |
| 15 | `where`, `when`, `via` | [Lambda or Variable or TypedVar] `where` Expression<br>[Lambda or Variable or TypedVar] `when` Expression<br>[Lambda or Variable or TypedVar] `via` Expression<br> | Produces a lambda of the given type. The entire expression to the right is **not** evaluated, but stored inside the lambda. If another lambda is to the left, they are both joined into one. If a Variable or TypedVar is to the left, that becomes the name of the lambda's loop variable.
|| `making`, `each` | [Lambda or Variable or TypedVar] `making` Variable or TypedVar<br>`each` Variable or TypedVar | Produces a lambda of the given type. The Variable or TypedVar becomes the name of the lambda's "making" variable if it's a `making` lambda, and otherwise it becomes the name of the lambda's loop variable. Note that `making` cannot be given to any macros without being combined with at least a `via` lambda.
| 14 | `-type` | Any `-type` Variable | Used to create a TypedVar, which is a variable name combined with a datatype.
| 13 | `and`, `or` | Boolean `and` Boolean‡<br>Boolean `or` Boolean‡ | Used to perform the basic logic operations on Boolean values, producing `true` or `false`.
| 12 | `is`, `is not` | Any `is` Any†<br>Any `is not` Any† | Produces Boolean `true` if the value on the left is exactly identical to the value on the right, and `false` otherwise.
| 11 | `contains`, `does not contain`, `is in`, `is not in` | Array or Dataset `contains` Any†<br>Array or Dataset `does not contain` Any†<br>Any `is in` Array or Dataset†<br>Any `is not in` Array or Dataset† | Produces Boolean `true` if the value is (or is not) inside the array or dataset as a data value, and `false` otherwise.
| | | Datamap `contains` Any†<br>Datamap `does not contain` Any†<br>Any `is in` Datamap†<br>Any `is not in` Datamap† | Produces Boolean `true` if the value is (or is not) a data name of the datamap, and `false` otherwise. (To check that a datamap contains a value, try using this with (dm-values:))
| | | String `contains` String†<br>String `does not contain` String†<br>String `is in` String†<br>String `is not in` String† | Produces Boolean `true` if one of the strings is (or is not) a substring of the other, and `false` otherwise.
| 10 | `is a`, `is not a` | Any `is a` Datatype†<br>Any `is not a` Datatype† | Produces Boolean `true` if the datatype describes the value, and `false` otherwise.
| | `matches`, `does not match` | Any `matches` Any†<br>Any `does not match` Any† | Produces Boolean `true` if one value matches the data pattern on the other, and `false` otherwise.
| 9 | `<`, `<=`, `>=`, `>` | Number `<` Number†<br>Number `<=` Number†<br>Number `>=` Number†<br>Number `>` Number† | Used to perform mathematical comparisons on numbers, producing `true` or `false`.
| 8 | `+`, `-` | Number `+` Number<br>Number `-` Number | Used to perform mathematical addition and subtraction on numbers.
| | | String `+` String<br>String `-` String | Used to join strings, *or* produce a copy of the left string with all occurrences of the right string removed.
| | | Array `+` Array<br>Array `-` Array | Used to join arrays, *or* produce a copy of the left array with all occurrences of the right array's values removed.
| | | Dataset `+` Dataset<br>Dataset `-` Dataset | Used to join datasets, *or* produce a copy of the left datasets with all occurrences of the right datasets's values removed.
| | | Datamap `+` Datamap | Used to join datamaps, using the right side's value whenever both sides contain the same name.
| | | Colour `+` Colour | Used to mix colours (using the sRGB mixing algorithm).
| | | Changer `+` Changer | Used to combine changers.
| | | HookName `+` HookName | Produces a special complex HookName that refers to both of the HookNames' hooks.
| 7 | `*`, `/` | Number `*` Number<br>Number `/` Number | Used to perform mathematical multiplication and division on numbers.
| 6 | `...` | `...` Array | Spreads out the individual elements of an array into the containing macro call, as if each element had been listed and separated with commas.
| | | `...` String | Spreads out the individual characters of a string into the containing macro call, as if each character had been listed and separated with commas.
| | | `...` Dataset | Spreads out the individual elements of a dataset into the containing macro call, in sorted order (as if by the (sorted:) macro).
| | | `...` Datatype | Produces a special "spread" version of the datatype, which, when used in arrays or patterns, matches zero or more of its values. Can also be used with `-type` to make multi-value TypedVars for the (macro:) macro.
| | `bind`, `2bind` | `bind` Variable<br>`2bind` Variable | Used to make Binds, which allow a variable name to be "bound" to a particular interaction macro, like (dialog:). Two-way binds force the variable to always have the currently-selected value of the interaction element.
| 5 | `not` | `not` Boolean | Turns `false` into `true` and vice-versa.
| | `+`, `-` | `+` Number<br>`-` Number | `-` is used to make positive numbers negative, and vice-versa. `+` is less useful, but may be used to check if a variable is a number: `+$a` produces an error if $a does not hold a number.
| 4 | `of` | Dataname or Number or String `of` Any | Used to obtain data values from certain data types (Array, String, Datamap, Dataset, Colour, CustomMacro, Gradient, or TypedVar).
| | | Dataname or Number or String `of` HookName | Produces a variant of the HookName which only refers to one, two, or a subrange of the hooks with its name.
| 3 | `'s`, `its` | Any `'s` Dataname or Number or String<br> `its` Dataname or Number or String | Used to obtain data values from certain data types (Array, String, Datamap, Dataset, Colour, CustomMacro, Gradient, TypedVar). `'s` cannot have spaces between it and the value to the left. `its` is a special combination of this operator with the `it` identifier.
| | | HookName `'s` Dataname or Number or String<br>Dataname or Number or String `of` HookName | Produces a variant of the HookName which only refers to one, two, or a subrange of the hooks with its name.
| 2 | Data values (numbers, strings, macro calls, etc.) | | Again, these are not operators, but are listed here to express their order-of-operations relationship to the real operators (and to the grouping operator, below).
| 1 | `(`, `)` | `(` Any `)` | Much like in arithmetic, brackets can be used to force a certain sub-expression to be evaluated before others.

†. When the left side is missing, Harlowe will try to infer a missing [it identifier](#keyword_it) to automatically put there, instead of just producing an error.

‡. When either side is not a Boolean, Harlowe will try to infer a missing [it identifier](#keyword_it) and a missing comparison operator to automatically put there, instead of just producing an error.