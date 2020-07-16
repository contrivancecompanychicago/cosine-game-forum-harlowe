describe("determiners", function() {
	'use strict';

	/*
		This structure expresses the tests as the following:
		determiners
			comparison operators
				left-hand-sides
					values that, when used as right-hand-side, produce true
					values that, when used as right-hand-side, produce false
					values that, when used as right-hand-side, produce errors (optional)
	*/
	[
		['any',
			['contains',
				['any of "G𐌎ld"',
					['"𐌎"', 'any of "Bad"', 'all of "G"', 'all of ""'],
					['"R"', 'any of "Hen"', 'all of "Gd"'],
					['start of "Gale"','end of "Bold"'],
				],
				['any of (a:"R𐌎d","B𐌎y")',
					['"𐌎d"', 'any of (a:"R")', 'all of (a:"R𐌎","𐌎d")'],
					['"𐌎g"', 'any of (a:"J")', 'all of (a:"R𐌎","𐌎y")'],
				],
				['any of (a:(a:2),(a:false),(a:(dm:)))',
					['2','false','(dm:)'],
					['3','true','(dm:"A",1)'],
				],
				['any of (a:2,false,(dm:))',
					[],
					[],
					['4','2'],
				]
			],
			['is not in',
				['any of "G𐌎ld"',
					['"G𐌎l"', 'any of "dl𐌎G"', 'all of "G"'],
					['"G𐌎ld"'],
					['start of "Gale"','end of "Bold"'],
				],
				['any of (a:"R𐌎","𐌎y")',
					['"𐌎d"', 'any of (a:"R")', 'all of (a:"Hen","𐌎y")'],
					['"R𐌎dB𐌎y"', 'any of (a:"R𐌎dB𐌎y","𐌎yR𐌎")', 'all of (a:"R𐌎y","R𐌎y")'],
				]
			],
			['is',
				['any of "G𐌎ld"',
					['"𐌎"', 'any of "Bad"'],
					['"R"', 'any of "Hen"'],
				],
				['any of (a:"R𐌎d","R𐌎y")',
					['"R𐌎d"', 'any of (a:2,"R𐌎d",false)'],
					['"𐌎g"', 'any of (a:"J")'],
				],
				['any of (a:2,false,(dm:))',
					['2','false','(dm:)', 'any of (a:3,(dm:))', 'all of (a:2,2)'],
					['3','true','(dm:"A",1)', 'any of (a:3,(dm:"A",1))', 'all of (a:2,1)'],
				],
			],
			['is not',
				['any of "𐌎𐌎𐌎𐌎"',
					['"R"', 'any of "Hen"'],
					['"𐌎"', 'any of "𐌎𐌎𐌎"'],
				],
				['any of (a:"R𐌎d","R𐌎d")',
					['"𐌎g"', 'any of (a:"R𐌎d","J")','all of (a:"G𐌎p","J")'],
					['"R𐌎d"', 'any of (a:"R𐌎d","R𐌎d")','all of (a:"R𐌎d","J")'],
				],
			],
			['is a',
				['any of (a:2,false,(dm:))',
					['num','empty','dm','bool'],
					['ds','str'],
					['3','true','(dm:)','start of (a:2,1,3)','end of (a:1,false)'],
				],
			],
			['<',
				['any of (a:3,4,5)',
					['4','any of (a:1,7)', 'all of (a:8,9)'],
					['1','any of (a:2,3)', 'all of (a:8,2)'],
					['"R"','any of (a:1,7,"R")', 'all of (a:1,7,"R")','start of (a:3,1,2)','end of (a:1,4,5)'],
				],
			],
			['>=',
				['any of (a:3,4,5)',
					['5','any of (a:7,5)', 'all of (a:4,2)'],
					['6','any of (a:8,7)', 'all of (a:1,9)'],
					['"R"','any of (a:1,7,"R")', 'all of (a:1,7,"R")','start of (a:3,1,2)','end of (a:1,4,5)'],
				],
			],
			['>',
				['any of (a:6,7,8)',
					['1', 'any of (a:2,9)', 'all of (a:1,5)'],
					['9', 'any of (a:10,11)', 'all of (a:1,8)'],
					['"R"', 'any of (a:1,7,"R")', 'all of (a:1,7,"R")','start of (a:3,1,2)','end of (a:1,4,5)'],
				],
			],
			['<=',
				['any of (a:6,7,8)',
					['9', 'any of (a:1,11)', 'all of (a:10,6)'],
					['1', 'any of (a:2,5)', 'all of (a:1,6)'],
					['"R"', 'any of (a:1,7,"R")', 'all of (a:1,7,"R")','start of (a:3,1,2)','end of (a:1,4,5)'],
				],
			],
		],
		['all',
			['contains',
				['all of "𐌎𐌎𐌎𐌎"',
					['"𐌎"', 'any of "R𐌎d"', 'all of "𐌎"'],
					['"𐌎𐌎"','"R"', 'any of "Hen"'],
				],
				['all of (a:"R𐌎d","B𐌎y")',
					['"𐌎"', 'any of "R𐌎d"', 'all of "𐌎"'],
					['"𐌎d"', 'any of (a:"𐌎y")', 'all of "R𐌎"'],
				],
				['all of (a:(a:2),(a:false),(a:(dm:)))',
					[],
					['2','false','(dm:)'],
				],
				['all of (a:2,false,(dm:))',
					[],
					[],
					['4','2'],
				],
			],
			['is not in',
				['all of "𐌎𐌎𐌎𐌎"',
					['"bar"','"R"', 'any of "Hen"'],
					['"R𐌎bar"', 'any of "𐌎𐌎"'],
				],
				['all of (a:"R𐌎d","B𐌎y")',
					['"𐌎"', 'any of "R𐌎d"'],
					['"R𐌎de"', 'any of (a:"R𐌎d")'],
				],
			],
			['is',
				['all of "𐌎𐌎𐌎𐌎"',
					['"𐌎"', 'any of "R𐌎d"', 'all of "𐌎"'],
					['"𐌎𐌎"','"R"', 'any of "Hen"'],
				],
				['all of (a:"R𐌎d","R𐌎d")',
					['"R𐌎d"', 'any of (a:2,"R𐌎d",false)', 'all of (a:"R𐌎d")'],
					['"G𐌎p"', 'any of (a:"J")', 'all of (a:"R𐌎d", "J")'],
				],
				['all of (a:2,false,(dm:))',
					[],
					['2','false','(dm:)'],
				],
			],
			['is not',
				['all of "R𐌎d"',
					['"A"', 'any of "R𐌎d"', 'all of "Gap"'],
					['"𐌎"', 'all of "G𐌎p"'],
				],
				['all of (a:"R𐌎d","R𐌎d")',
					['"𐌎g"', 'any of (a:"R𐌎d","J")','all of (a:"G𐌎p","J")'],
					['"R𐌎d"', 'any of (a:"R𐌎d","R𐌎d")','all of (a:"R𐌎d","J")'],
				],
			],
			['>',
				['all of (a:3,4,5)',
					['1','all of (a:2,1)', 'any of (a:8,2)'],
					['4','all of (a:1,7)', 'any of (a:8,9)'],
					['"R"','any of (a:1,7,"R")', 'all of (a:1,7,"R")'],
				],
			],
			['<=',
				['all of (a:3,4,5)',
					['6','all of (a:5,9)', 'any of (a:5,1)'],
					['4','all of (a:4,5)', 'any of (a:3,1)'],
					['"R"','any of (a:1,7,"R")', 'all of (a:1,7,"R")'],
				],
			],
			['<',
				['all of (a:6,7,8)',
					['9', 'all of (a:10,11)', 'any of (a:1,9)'],
					['1', 'all of (a:2,9)', 'any of (a:1,5)'],
					['"R"', 'any of (a:1,7,"R")', 'all of (a:1,7,"R")'],
				],
			],
			['>=',
				['all of (a:6,7,8)',
					['1', 'all of (a:2,5)', 'any of (a:1,6)'],
					['9', 'all of (a:10,7)', 'any of (a:10,7)'],
					['"R"', 'any of (a:1,7,"R")', 'all of (a:1,7,"R")'],
				],
			],
		],
		['start',
			['is',
				['start of "abcdef"',
					['""','"a"','"ab"','"abc"','"abcd"','any of "ag"','all of "aaa"'],
					['"abcdefg"','"abdcef"'],
					['start of "bee"','end of "bee"'],
				],
				['start of (a:6,7,8,9)',
					['(a:)','(a:6)','(a:6,7)','(a:6,7,8)','(a:6,7,8,9)','any of (a:(a:6),(a:7))','all of (a:(a:6),(a:6,7))'],
					['(a:6,7,8,9,10)'],
					['start of (a:1,2)','end of (a:1,2)'],
				]
			],
			['is not',
				['start of "abcdef"',
					['"abcdefg"','"abdcef"'],
					['""','"a"','"ab"','"abc"','"abcd"','any of "ag"','all of "aaa"'],
					['start of "bee"','end of "bee"'],
				],
				['start of (a:6,7,8,9)',
					['(a:6,7,8,9,10)'],
					['(a:)','(a:6)','(a:6,7)','(a:6,7,8)','(a:6,7,8,9)','any of (a:(a:6),(a:7))','all of (a:(a:6),(a:6,7))'],
					['start of (a:1,2)','end of (a:1,2)'],
				]
			],
			['matches',
				['start of (a:6,7,8,9)',
					['empty','array','(a:num)','(a:6,num)','(a:num,7,8,9)','any of (a:empty,str)','all of (a:empty,array)'],
					['(a:6,7,8,9,10)','(a:str)'],
					['start of (a:1,2)','end of (a:1,2)'],
				]
			],
			['does not match',
				['start of (a:6,7,8,9)',
					['(a:6,7,8,9,10)','(a:str)'],
					['empty','array','(a:num)','(a:6,num)','(a:num,7,8,9)','any of (a:empty,str)','all of (a:empty,array)'],
					['start of (a:1,2)','end of (a:1,2)'],
				]
			],
		],
		['end',
			['is',
				['end of "abcdef"',
					['""','"f"','"ef"','"def"','"cdef"','any of "fa"','all of "fff"'],
					['"abcdefg"','"abdcef"'],
					['start of "bee"','end of "bee"'],
				],
				['end of (a:6,7,8,9)',
					['(a:)','(a:9)','(a:8,9)','(a:7,8,9)','(a:6,7,8,9)','any of (a:(a:8),(a:9))','all of (a:(a:9),(a:8,9))'],
					['(a:6,7,8,9,10)'],
					['start of (a:1,2)','end of (a:1,2)'],
				]
			],
			['is not',
				['end of (a:6,7,8,9)',
					['(a:6,7,8,9,10)'],
					['(a:)','(a:9)','(a:8,9)','(a:7,8,9)','(a:6,7,8,9)','any of (a:(a:8),(a:9))','all of (a:(a:9),(a:8,9))'],
					['start of (a:1,2)','end of (a:1,2)'],
				]
			],
			['matches',
				['end of (a:6,7,8,9)',
					['empty','array','(a:num)','(a:8,num)','(a:num,7,8,9)','any of (a:empty,str)','all of (a:empty,array)'],
					['(a:5,6,7,8,9)','(a:str)'],
					['start of (a:1,2)','end of (a:1,2)'],
				]
			],
			['does not match',
				['end of (a:6,7,8,9)',
					['(a:5,6,7,8,9)','(a:str)'],
					['empty','array','(a:num)','(a:8,num)','(a:num,7,8,9)','any of (a:empty,str)','all of (a:empty,array)'],
					['start of (a:1,2)','end of (a:1,2)'],
				]
			],
		],
	].forEach(function(arr) {
		var keyword = arr[0];
		describe("the '" + keyword + "' determiner", function() {
			arr.slice(1).forEach(function(arr) {
				var operator = arr[0];
				it("works with the '" + operator + "' operator", function() {
					arr.slice(1).forEach(function(arr) {
						var leftSide = arr[0],
							rightSideTrue = arr[1],
							rightSideFalse = arr[2],
							rightSideError = arr[3] || [];
						rightSideTrue.forEach(function(rightSide) {
							expect('(print:' + leftSide + ' ' + operator + ' ' + rightSide + ')').markupToPrint('true');
						});
						rightSideFalse.forEach(function(rightSide) {
							expect('(print:' + leftSide + ' ' + operator + ' ' + rightSide + ')').markupToPrint('false');
						});
						rightSideError.forEach(function(rightSide) {
							expect('(print:' + leftSide + ' ' + operator + ' ' + rightSide + ')').markupToError();
						});
					});
				});
			});
			it("cannot be used with non-sequences", function() {
				expect("(print: " + keyword + " of 2 is 1)").markupToError();
				expect("(print: " + keyword + " of (dm:'A',1) is 1)").markupToError();
			});
			it("cannot be printed or stored", function() {
				expect("(print: " + keyword + " of (a:1))").markupToError();
				expect("(set: $a to (a:" + keyword + " of (a:1)))").markupToError();
				expect("(set: $a to " + keyword + " of (a:1))").markupToError();
			});
		});
	});
	describe("the 'random' data name", function() {
		it("obtains a random value from arrays", function() {
			expect("(print: random of (a:6,8,9))").markupToPrint(/^[689]$/);
			expect("(print: (a:165)'s random)").markupToPrint("165");
		});
		it("obtains a random character from strings", function() {
			expect("(print: random of 'ERIS')").markupToPrint(/^[ERIS]$/);
			expect("(print: ('e')'s random)").markupToPrint("e");
			expect("(print: ('𐌎')'s random)").markupToPrint("𐌎");
		});
		it("works with (move:)", function() {
			for(var i = 0; i < 10; i+=1) {
				expect("(set:$a to (a:6,8,9))(move:$a's random into $b)(print:$a)").markupToPrint(/^(6,8|8,9|6,9)$/);
			}
		});
		it("errors if given empty structures", function() {
			expect("(print: random of '')").markupToError();
			expect("(print: random of (a:))").markupToError();
		});
	});
});
