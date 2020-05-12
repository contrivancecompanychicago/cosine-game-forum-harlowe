describe("style changer macros", function() {
	'use strict';
	var dominantTextColour, dominantBackground;
	beforeAll(function() {
		dominantTextColour = $('tw-story').css('color');
		dominantBackground = $('tw-story').css('background-color');
	});

	describe("the (css:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(css:)").markupToError();
			expect("(css:1)").markupToError();
			expect("(css:'A','B')").markupToError();
		});
		it("applies the passed CSS to the hook as an inline style property", function() {
			expect(runPassage("(css:'display:inline-block')[Hey]").find('tw-hook').css('display'))
				.toBe('inline-block');
			expect(runPassage("(css:'clear:both;')[Hey]").find('tw-hook').css('clear'))
				.toBe('both');
		});
		it("can be (set:) in a variable", function() {
			runPassage("(set: $s to (css:'display:inline-block;'))");
			var hook = runPassage("$s[Hey]").find('tw-hook');
			expect(hook.css('display')).toBe('inline-block');
		});
		it("can compose with itself", function() {
			runPassage("(set: $s to (css:'display:inline-block') + (css:'clear:both') + (css:'white-space:pre-wrap'))");
			var hook = runPassage("$s[Hey]").find('tw-hook');
			expect(hook.css('display')).toBe('inline-block');
			expect(hook.css('clear')).toBe('both');
			expect(hook.css('white-space')).toBe('pre-wrap');
		});
		it("compositions have structural equality", function() {
			expect("(print: (css:'display:inline-block') + (css:'clear:both')"
				+ " is (css:'display:inline-block') + (css:'clear:both'))").markupToPrint("true");
			expect("(print: (css:'display:inline-block') + (css:'clear:both')"
				+ " is (css:'display:flex') + (css:'clear:both'))").markupToPrint("false");
		});
		it("errors when placed in passage prose while not attached to anything", function() {
			expect("(css:'color:red')").markupToError();
			expect("(css:'color:red')[]").not.markupToError();
		});
	});
	describe("the (textstyle:) macro", function() {
		it("requires 1 or more string arguments", function() {
			expect("(print:(textstyle:))").markupToError();
			expect("(print:(textstyle:1))").markupToError();
			expect("(print:(textstyle:'A',1))").markupToError();
		});
		it("errors unless given one or more valid textstyle name", function() {
			expect("(print:(textstyle:''))").markupToError();
			expect("(print:(textstyle:'garply corge'))").markupToError();
			['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'blink', 'shudder',
			'mark', 'condense', 'expand', 'outline', 'shadow', 'emboss', 'smear', 'blur', 'blurrier',
			'mirror', 'upsidedown', 'fadeinout', 'rumble', 'shudder','buoy','sway'].forEach(function(e) {
				expect("(textstyle:'" + e + "')[Hey]").not.markupToError();
				expect("(textstyle:'" + e + "','bold')[Hey]").not.markupToError();
				expect("(textstyle:'" + e + "','bold','italic')[Hey]").not.markupToError();
			});
		});
		it("uses case- and dash-insensitive style names", function() {
			expect("(textstyle:'BOLD')[]").not.markupToError();
			expect("(textstyle:'--b--o--l--d')[]").not.markupToError();
			expect("(textstyle:'_bOl_-D')[]").not.markupToError();
		});
		it("errors when placed in passage prose while not attached to anything", function() {
			expect("(textstyle:'bold')").markupToError();
			expect("(textstyle:'bold')[]").not.markupToError();
		});
		['outline','shadow','blur','blurrier','emboss','smear'].forEach(function(e) {
			describe("'" + e + "' style", function() {
				it("uses the shadow colour equal to the dominant text colour", function(done) {
					var hook = runPassage("(text-style:'" + e + "')[Goobar]")
						.find('tw-hook');
					setTimeout(function() {
						expect(hook).toHaveTextShadowColour(dominantTextColour);
						hook = runPassage("(text-color:#f00)+(text-style:'" + e + "')[Goobar]")
							.find('tw-hook');
						setTimeout(function() {
							expect(hook).toHaveTextShadowColour('#ff0000');
							hook = runPassage("(text-style:'" + e + "')+(text-color:#f00)[Goobar]")
								.find('tw-hook');
							setTimeout(function() {
								expect(hook).toHaveTextShadowColour('#ff0000');
								done();
							});
						});
					});
				});
				it("correctly discerns the dominant text colour of outer hooks", function(done) {
					var hook = runPassage("(text-colour: #fadaba)[|2>[(text-style:'" + e + "')[Goobar]]]")
						.find('tw-hook[name=2] > tw-hook');
					setTimeout(function() {
						expect(hook).toHaveTextShadowColour('#fadaba');
						done();
					});
				});
				if (e.slice(0,4)==="blur") {
					it("has transparent text colour", function(done) {
						var hook = runPassage("(text-style:'" + e + "')[Goobar]")
							.find('tw-hook');
						setTimeout(function() {
							expect(hook).toHaveColour('transparent');
							done();
						});
					});
				}
				if (e === "outline") {
					it("uses the text colour of the background", function(done) {
						var hook = runPassage("(text-style:'outline')[Goobar]")
							.find('tw-hook');
						setTimeout(function() {
							expect(hook).toHaveColour(dominantBackground);
							done();
						});
					});
					it("correctly discerns the background colour of outer hooks", function(done) {
						var hook = runPassage("(background: #fadaba)[|2>[(text-style:'outline')[Goobar]]]")
							.find('tw-hook[name=2] > tw-hook');
						setTimeout(function() {
							expect(hook).toHaveColour('#fadaba');
							done();
						});
					});
				}
			});
		});
		['mirror','upside-down'].forEach(function(e) {
			describe("'" + e + "' style", function() {
				// We can't examine the elements any more than this.
				it("uses a defined CSS transform ", function(done) {
					var hook = runPassage("(text-style:'" + e + "')[Goobar]")
						.find('tw-hook');
					setTimeout(function() {
						expect(hook.attr('style')).toMatch(new RegExp("transform:.*?\\s" +
							((e === "mirror") ? "scaleX\\(\\s*-1\\s*\\)" : "scaleY\\(\\s*-1\\s*\\)")));
						done();
					});
				});
			});
		});
		['rumble','shudder','fade-in-out','blink'].forEach(function(e){
			describe("'" + e + "' style", function() {
				// We can't examine the elements any more than this.
				it("uses a defined CSS animation and easing function", function(done) {
					var hook = runPassage("(text-style:'" + e + "')[Goobar]")
						.find('tw-hook');
					setTimeout(function() {
						var style = hook.attr('style');
						expect(style).toMatch(new RegExp("animation(?:\\-name)?:.*?\\s" +
							((e === "blink") ? "fade-in-out" :
							e) + "\\b"));
						expect(style).toMatch(new RegExp("animation(?:\\-timing\\-function)?:.*?\\s" +
							(e === "blink" ? "steps\\(\\s*1(?:,\\s*end)?\\s*\\)" :
							e === "fade-in-out" ? "ease-in-out" :
							"linear")));
						done();
					});
				});
			});
		});
		describe("'none' style", function() {
			it("removes other styles it is composed to the right with", function(done) {
				var hook = runPassage("(set:$x to (text-style:'bold'))(set:$x to it + (text-style:'none'))$x[Goobar]")
					.find('tw-hook');
				setTimeout(function() {
					expect(hook.attr('style')).toBe(undefined);
					done();
				});
			});
			xit("removes other styles in already enchanted text", function(done) {
				var hook = runPassage("[Goobar]<x|(enchant:?x, (text-style:'bold'))(enchant:?x, (text-style:'none'))")
					.find('tw-hook');
				setTimeout(function() {
					expect(hook.css('font-weight')).toBe("400");
					done();
				});
			});
			it("doesn't remove styles if it is composed to the left", function(done) {
				var hook = runPassage("(set:$x to (text-style:'bold'))(set:$x to (text-style:'none') + it)$x[Goobar]")
					.find('tw-hook');
				setTimeout(function() {
					expect(hook.attr('style')).toMatch(/font-weight:\s*(bold|800)/);
					done();
				});
			});
		});
	});
	['transition','transition-depart','transition-arrive'].forEach(function(name) {
		describe("the ("+name+":) macro", function() {
			it("requires exactly 1 string argument", function() {
				expect("(print:("+name+":))").markupToError();
				expect("(print:("+name+":1))").markupToError();
				expect("(print:("+name+":'A','B'))").markupToError();
			});
			it("errors unless given a valid transition name", function() {
				expect("(print:("+name+":''))").markupToError();
				expect("(print:("+name+":'garply corge'))").markupToError();
				["dissolve", "shudder", "pulse"].forEach(function(e) {
					expect("(print:("+name+":'" + e + "'))").not.markupToError();
				});
			});
			it("errors when placed in passage prose while not attached to anything", function() {
				expect("("+name+":'dissolve')").markupToError();
				expect("("+name+":'dissolve')[]").not.markupToError();
			});
			it("has structural equality", function() {
				expect("(print: ("+name+":'dissolve') is ("+name+":'dissolve'))").markupToPrint("true");
				expect("(print: ("+name+":'dissolve') is ("+name+":'pulse'))").markupToPrint("false");
			});
			var shorthand = name.replace("ransitio","8");
			it("is aliased to ("+shorthand+":)", function() {
				expect("(print: ("+shorthand+":'dissolve') is ("+name+":'dissolve'))").markupToPrint("true");
			});
			// TODO: Add .css() tests of output.

			if (name === "transition") {
				it("changes the transition of (link:)", function(done) {
					var p = runPassage("("+name+":'pulse')+(link:'grault')[garply]");
					p.find('tw-link').click();
					setTimeout(function() {
						expect(p.find('[data-t8n="pulse"]').length).toBe(1);
						done();
					});
				});
				it("with (link:), doesn't transition the link in immediately", function() {
					var p = runPassage("("+name+":'pulse')+(link:'grault')[garply]");
					expect(p.find('[data-t8n="pulse"]').length).toBe(0);
				});
				it("changes the transition of (show:)", function() {
					var p = runPassage("|foo)[bar](t8n-time:12s)+("+name+":'pulse')(show:?foo)");
					expect(p.find('[data-t8n="pulse"]').length).toBe(1);
				});
				it("changes the passage transitions of (link-show:)", function(done) {
					var p = runPassage("[bar](foo|("+name+":'pulse')(link-show:'grault',?foo)");
					p.find('tw-link').click();
					setTimeout(function() {
						expect($('tw-story tw-transition-container[data-t8n="pulse"]').length).toBe(1);
						done();
					});
				});
				['click','click-replace','click-append','click-prepend',
				'mouseover','mouseover-replace','mouseover-append','mouseover-prepend'].forEach(function(name2) {
					var interaction = (name2.startsWith('mouseover')) ? "mouseenter" : "click";
					it("changes the transition of (" + name2 + ":)", function(done) {
						var p = runPassage("foo("+name+":'pulse')+("+name2+":'foo')[bar]");
						p.find('tw-link, .enchantment-link, .enchantment-mouseover')[interaction]();
						setTimeout(function() {
							expect(p.find('[data-t8n="pulse"]').length).toBe(1);
							done();
						});
					});
					it("with (" + name2 + ":), doesn't transition the link in immediately", function() {
						var p = runPassage("foo("+name+":'pulse')("+name2+":'foo','grault')");
						expect(p.find('[data-t8n="pulse"]').length).toBe(0);
					});
				});
			} else {
				it("changes the passage transitions of (goto:)", function(done) {
					createPassage("foo","grault");
					var p = runPassage("("+name+":'pulse')(goto:'grault')");
					setTimeout(function() {
						expect($('tw-story tw-transition-container[data-t8n="pulse"]').length).toBe(1);
						done();
					});
				});
				it("changes the passage transitions of (undo:)", function(done) {
					runPassage("foo","grault");
					var p = runPassage("("+name+":'pulse')(undo:)");
					setTimeout(function() {
						expect($('tw-story tw-transition-container[data-t8n="pulse"]').length).toBe(1);
						done();
					});
				});
				['link-goto','link-undo','click-goto','mouseover-goto'].forEach(function(name2) {
					var interaction = (name2 === 'mouseover-goto') ? "mouseenter" : "click";
					var arg = (name2.startsWith('link')) ? "'grault'" : "'foo','grault'";
					it("changes the passage transitions of (" + name2 + ":)", function(done) {
						runPassage("foo","grault");
						var p = runPassage("foo("+name+":'pulse')("+name2+":"+arg+")");
						p.find('tw-link, .enchantment-link, .enchantment-mouseover')[interaction]();
						setTimeout(function() {
							expect($('tw-story tw-transition-container[data-t8n="pulse"]').length).toBe(1);
							done();
						});
					});
				});
				it("changes the passage transitions of (link-undo:)", function(done) {
					runPassage("foo","grault");
					var p = runPassage("("+name+":'pulse')(link-undo:'grault')");
					p.find('tw-link').click();
					setTimeout(function() {
						expect($('tw-story tw-transition-container[data-t8n="pulse"]').length).toBe(1);
						done();
					});
				});
				it("changes the passage transitions of ?Link", function(done) {
					createPassage("foo","grault");
					var p = runPassage("[[grault]](enchant: ?Link, ("+name+":'pulse'))");
					p.find('tw-link').click();
					setTimeout(function() {
						expect($('tw-story tw-transition-container[data-t8n="pulse"]').length).toBe(1);
						done();
					});
				});
				if (name === "transition-arrive") {
					describe("works when combined with (transition-depart:)", function() {
						it("on (goto:)", function(done) {
							createPassage("foo","grault");
							var p = runPassage("(t8n-depart:'dissolve')+(t8n-arrive:'pulse')(goto:'grault')");
							setTimeout(function() {
								expect($('tw-story tw-transition-container.transition-out[data-t8n="dissolve"]').length).toBe(1);
								expect($('tw-story tw-transition-container[data-t8n="pulse"]').length).toBe(1);
								done();
							});
						});
						it("on (undo:)", function(done) {
							runPassage("foo","grault");
							var p = runPassage("(t8n-depart:'dissolve')+(t8n-arrive:'pulse')(undo:)");
							setTimeout(function() {
								expect($('tw-story tw-transition-container.transition-out[data-t8n="dissolve"]').length).toBe(1);
								expect($('tw-story tw-transition-container.transition-in[data-t8n="pulse"]').length).toBe(1);
								done();
							});
						});
						['link-goto','link-undo','click-goto','mouseover-goto'].forEach(function(name2) {
							var interaction = (name2 === 'mouseover-goto') ? "mouseenter" : "click";
							var arg = (name2.startsWith('link')) ? "'grault'" : "'foo','grault'";
							it("on (" + name2 + ":)", function(done) {
								runPassage("foo","grault");
								var p = runPassage("foo(t8n-depart:'dissolve')+(t8n-arrive:'pulse')("+name2+":"+arg+")");
								p.find('tw-link, .enchantment-link, .enchantment-mouseover')[interaction]();
								setTimeout(function() {
									expect($('tw-story tw-transition-container.transition-out[data-t8n="dissolve"]').length).toBe(1);
									expect($('tw-story tw-transition-container.transition-in[data-t8n="pulse"]').length).toBe(1);
									done();
								});
							});
						});
						it("with (enchant: ?Link)", function(done) {
							createPassage("foo","grault");
							var p = runPassage("[[grault]](enchant:?Link, (t8n-depart:'dissolve')+(t8n-arrive:'pulse'))");
							p.find('tw-link').click();
							setTimeout(function() {
								expect($('tw-story tw-transition-container.transition-out[data-t8n="dissolve"]').length).toBe(1);
								expect($('tw-story tw-transition-container.transition-in[data-t8n="pulse"]').length).toBe(1);
								done();
							});
						});
					});
				}
			}
		});
	});
	['time','delay','skip'].forEach(function(name,i) {
		describe("the (transition-"+name+":) macro", function() {
			it("requires exactly 1 number argument", function() {
				expect("(print:(transition-"+name+":))").markupToError();
				expect("(print:(transition-"+name+":'A'))").markupToError();
				expect("(print:(transition-"+name+":2,2))").markupToError();
			});
			it("errors unless given a " + (i===1 ? "non-negative" : "positive") + " number", function() {
				var e = expect("(print:(transition-"+name+":0s))");
				(i===1 ? e.not : e).markupToError();
				expect("(print:(transition-"+name+":-50ms))").markupToError();
				expect("(print:(transition-"+name+":50ms))").not.markupToError();
			});
			it("errors when placed in passage prose while not attached to anything", function() {
				expect("(transition-"+name+":2s)").markupToError();
				expect("(transition-"+name+":2s)[]").not.markupToError();
			});
			it("has structural equality", function() {
				expect("(print: (transition-"+name+":2s) is (transition-"+name+":2s))").markupToPrint("true");
				expect("(print: (transition-"+name+":2s) is (transition-"+name+":2ms))").markupToPrint("false");
			});
			it("is aliased to (t8n-"+name+":)", function() {
				expect("(print: (t8n-"+name+":2s) is (transition-"+name+":2s))").markupToPrint("true");
			});
			// TODO: Add .css() tests of output, including passage links.
		});
	});

	describe("the (text-size:) macro", function() {
		it("requires exactly 1 positive number argument", function() {
			expect("(print:(text-size:))").markupToError();
			expect("(print:(text-size:1.1))").not.markupToError();
			expect("(print:(text-size:'A'))").markupToError();
			expect("(print:(text-size:55,55))").markupToError();
			expect("(print:(text-size:-0.2))").markupToError();
		});
		it("scales the attached hook's font-size and line-height", function(done) {
			var hook = runPassage("(text-size:2)[Sized.]").find('tw-hook');
			setTimeout(function() {
				expect(hook.attr('style')).toMatch(/font-size:\s*48px/);
				expect(hook.attr('style')).toMatch(/line-height:\s*72px/);
				hook = runPassage("(text-size:0.82)[Sized.]").find('tw-hook');
				setTimeout(function() {
					expect(hook.attr('style')).toMatch(/font-size:\s*19\.68px/);
					expect(hook.attr('style')).toMatch(/line-height:\s*29.52px/);
					done();
				});
			});
		});
	});
	describe("the (text-rotate:) macro", function() {
		it("requires exactly 1 number argument", function() {
			expect("(print:(text-rotate:))").markupToError();
			expect("(print:(text-rotate:1))").not.markupToError();
			expect("(print:(text-rotate:'A'))").markupToError();
			expect("(print:(text-rotate:55,55))").markupToError();
		});
		it("rotates the attached hook by the given number of degrees", function(done) {
			var hook = runPassage("(text-rotate:20)[Rotated.]").find('tw-hook');
			setTimeout(function() {
				expect(hook.attr('style')).toMatch(/rotate\(20deg\)/);
				done();
			});
		});
	});
	describe("the (border:) macro", function() {
		it("errors unless given a valid border name", function() {
			expect("(print:(border:))").markupToError();
			expect("(print:(border:1))").markupToError();
			expect("(print:(border:'A','A'))").markupToError();
			['dotted','dashed','solid','double','groove','ridge',
					'inset','outset','none'].forEach(function(name) {
				expect("(print:(border:'"+name+"'))").not.markupToError();
			});
		});
		it("uses case- and dash-insensitive border names", function() {
			expect("(border:'solID')[]").not.markupToError();
			expect("(border:'--sol--id')[]").not.markupToError();
			expect("(border:'_sOl_-id')[]").not.markupToError();
		});
		it("is aliased as (b4r:)", function() {
			expect("(print:(border:'solid') is (b4r:'solid'))").markupToPrint('true');
		});
		it("applies a border to the attached hook", function(done) {
			var hook = runPassage("(border:'dotted')[Dotted.]").find('tw-hook');
			setTimeout(function() {
				expect(hook[0].style.borderStyle).toBe("dotted");
				done();
			});
		});
		it("applies a default border width of 8px, unless another changer applied another value", function(done) {
			var hook = runPassage("(border:'ridge')[Ridge.]").find('tw-hook');
			setTimeout(function() {
				expect(hook[0].style.borderWidth).toMatch("8px");
				hook = runPassage("(Css:'border-width:10px')+(border:'ridge')[Ridge.]").find('tw-hook');
				setTimeout(function() {
					expect(hook[0].style.borderWidth).toMatch("10px");
					done();
				});
			});
		});
		it("applies a default display of 'inline-block', unless another changer applied another non-inline value", function(done) {
			var hook = runPassage("(border:'ridge')[Ridge.]").find('tw-hook');
			setTimeout(function() {
				expect(hook[0].style.display).toMatch("inline-block");
				hook = runPassage("(Css:'display:flex')+(border:'ridge')[Ridge.]").find('tw-hook');
				setTimeout(function() {
					expect(hook[0].style.display).toMatch("flex");
					hook = runPassage("(Css:'display:inline-flex')+(border:'ridge')[Ridge.]").find('tw-hook');
					setTimeout(function() {
						expect(hook[0].style.display).toMatch("inline-block");
						done();
					});
				});
			});
		});
	});
	describe("the (border-size:) macro", function() {
		it("requires 1 positive number", function() {
			expect("(print:(border-size:))").markupToError();
			expect("(print:(border-size:'A'))").markupToError();
			expect("(print:(border-size:-1))").markupToError();
		});
		it("is aliased as (b4r-size:)", function() {
			expect("(print:(b4r-size:3) is (border-size:3))").markupToPrint('true');
		});
		it("multiplies the default border width of 8px by that number", function(done) {
			var hook = runPassage("(border-size:1.9)+(border:'ridge')[Ridge.]").find('tw-hook');
			setTimeout(function() {
				expect(hook[0].style.borderWidth).toMatch("15.2px");
				done();
			});
		});
	});
	describe("the (border-radius:) macro", function() {
		it("requires 1 positive number", function() {
			expect("(print:(border-radius:))").markupToError();
			expect("(print:(border-radius:'A'))").markupToError();
			expect("(print:(border-radius:-1))").markupToError();
		});
		it("is aliased as (b4r-radius:)", function() {
			expect("(print:(b4r-radius:3) is (border-radius:3))").markupToPrint('true');
		});
		it("applies a border-radius equal to 8px multipled by the given number", function(done) {
			var hook = runPassage("(border-radius:1.9)+(border:'ridge')[Ridge.]").find('tw-hook');
			setTimeout(function() {
				expect(hook[0].style.borderRadius).toMatch("15.2px");
				done();
			});
		});
		it("applies a padding equal to 1px multipled by the given number, unless another changer applied another value", function(done) {
			var hook = runPassage("(border-radius:1.9)+(border:'ridge')[Ridge.]").find('tw-hook');
			setTimeout(function() {
				expect(hook[0].style.padding).toMatch("1.9px");
				hook = runPassage("(Css:'padding:10px')+(border:'ridge')+(border-radius:1.9)[Ridge.]").find('tw-hook');
				setTimeout(function() {
					expect(hook[0].style.padding).toMatch("10px");
					done();
				});
			});
		});
	});
	describe("the (border-colour:) macro", function() {
		it("requires 1 colour or 1 string", function() {
			expect("(print:(border-colour:))").markupToError();
			expect("(print:(border-colour:'red','blue'))").markupToError();
			expect("(print:(border-colour:red,blue))").markupToError();
			expect("(print:(border-colour:-1))").markupToError();
		});
		it("is aliased as (b4r-colour:), (b4r-color:) and (border-colour:)", function() {
			['b4r-color','b4r-colour','border-color'].forEach(function(name) {
				expect("(print:("+name+":red) is (border-colour:red))").markupToPrint('true');
			});
		});
		it("applies a border-color equal to the given colour or string", function(done) {
			var hook = runPassage("(border-colour:#ff0022)+(border:'ridge')[Ridge.]").find('tw-hook');
			setTimeout(function() {
				expect(hook.attr('style') + '').toMatch(/border-color:\s*(?:rgb\(255,\s*0,\s*34\))/i);
				done();
			});
		});
	});
	describe("the (background:) macro", function() {
		it("requires 1 string argument, 1 colour argument or 1 gradient argument", function() {
			expect("(print:(background:))").markupToError();
			expect("(print:(background:1))").markupToError();
			expect("(print:(background:'A','B'))").markupToError();
			expect("(print:(background:'A'))").not.markupToError();
			expect("(print:(background:red + white))").not.markupToError();
			expect("(print:(background:(gradient:45,0,red,1,white)))").not.markupToError();
			expect("(print:(background:(gradient:45,0,red,1,white),'B'))").markupToError();
		});
		it("errors when placed in passage prose while not attached to anything", function() {
			expect("(background:'A')").markupToError();
			expect("(background:'A')[]").not.markupToError();
		});
		it("given a string, applies it as the background-image property", function(done) {
			var p = runPassage("(background:'garply')[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-image:\s*url\(['"]?.*?garply['"]?\)/);
				done();
			});
		});
		it("given a string with a hex colour, applies it as the background-color property", function(done) {
			var p = runPassage("(background:'#601040')[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-color:\s*(?:#601040|rgb\(\s*96,\s*16,\s*64\s*\))/);
				done();
			});
		});
		it("given a colour, applies it as the background-color property", function(done) {
			var p = runPassage("(background:'#800000')[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-color:\s*(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				done();
			});
		});
		it("given a gradient, applies it as the background-image property", function(done) {
			var p = runPassage("(background:(gradient:45,0,(rgb:0,255,0),1,(rgb:0,0,0)))[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p).toHaveBackgroundGradient(45, [{stop:0,colour:"#00FF00"},{stop:1,colour:"#000000"}]);
				done();
			});
		});
		it("can compose with itself", function(done) {
			var p = runPassage("(set: $x to (background:'#800000')+(background:'garply'))$x[Hey]").find('tw-hook');
			setTimeout(function() {
				expect(p.attr('style')).toMatch(/background-image:\s*url\(['"]?.*?garply['"]?\)/);
				expect(p.attr('style')).toMatch(/background-color:\s*(?:#800000|rgb\(\s*128,\s*0,\s*0\s*\))/);
				done();
			});
		});
		it("compositions have structural equality", function() {
			expect("(print: (background:black)+(background:'garply') is (background:black)+(background:'garply'))").markupToPrint("true");
			expect("(print: (background:black)+(background:'garply') is (background:black)+(background:'grault'))").markupToPrint("false");
		});
	});
	describe("the (align:) macro", function() {
		it("requires exactly 1 string argument", function() {
			expect("(print:(align:))").markupToError();
			expect("(print:(align:1))").markupToError();
			expect("(print:(align:'A','B'))").markupToError();
		});
		it("errors if not given an valid arrow", function() {
			expect("(align:'')[]").markupToError();
			expect("(align:'===')[]").markupToError();
			expect("(align:'<<==')[]").markupToError();
			expect("(align:'===><==>')[]").markupToError();
		});
		it("errors when placed in passage prose while not attached to anything", function() {
			expect("(align:'==>')").markupToError();
			expect("(align:'==>')[]").not.markupToError();
		});
		it("right-aligns text when given '==>'", function(done) {
			var align = runPassage("(align:'==>')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('right');
				expect(align.text()).toBe('garply');
				expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
				done();
			});
		});
		it("ignores the number of, and imbalance of, = signs used", function(done) {
			[2,3,4,5,6,7,8,9,10].forEach(function(number) {
				var align = runPassage("(align:'" + "=".repeat(number) + ">')[garply]").find('tw-hook');
				setTimeout(function() {
					expect(align.css('text-align')).toBe('right');
					expect(align.text()).toBe('garply');
					expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
					done();
				});
			});
		});
		it("centres text with a balanced '=><='", function(done) {
			var align = runPassage("(align:'=><=')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('center');
				expect(align.text()).toBe('garply');
				expect(align.attr('style')).toMatch(/max-width:\s*50%/);
				expect(align.attr('style')).toMatch(/margin-left:\s*auto/);
				expect(align.attr('style')).toMatch(/margin-right:\s*auto/);
				done();
			});
		});
		it("justifies text with '<==>'", function(done) {
			var align = runPassage("(align:'<==>')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('justify');
				expect(align.text()).toBe('garply');
				expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
				done();
			});
		});
		it("left-aligns text when given '<=='", function(done) {
			var align = runPassage("(align:'==>')[(align:'<==')[garply]]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('right');
				expect(align.css('margin-left')).toMatch(/^(?:0px)?$/);
				align = align.find('tw-hook');
				expect(align.css('text-align')).toBe('left');
				expect(align.css('margin-right')).toMatch(/^(?:0px)?$/);
				done();
			});
		});
		it("aligns text with unbalanced '==><='", function(done) {
			var align = runPassage("(align:'==><====')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(align.css('text-align')).toBe('center');
				expect(align.attr('style')).toMatch(/margin-left:\s*17%/);
			
				align = runPassage("(align:'=====><=')[garply]").find('tw-hook');
				setTimeout(function() {
					expect(align.css('text-align')).toBe('center');
					expect(align.attr('style')).toMatch(/margin-left:\s*42%/);
					done();
				});
			});
		});
		it("has structural equality", function() {
			expect("(print: (align:'<==') is (align:'<=='))").markupToPrint("true");
			expect("(print: (align:'<==') is (align:'=><=='))").markupToPrint("false");
		});
	});
	describe("the (box:) macro", function() {
		it("requires 1 string and 1 number", function() {
			expect("(print:(box:))").markupToError();
			expect("(print:(box:1))").markupToError();
			expect("(print:(box:'A'))").markupToError();
			expect("(print:(box:'A','B'))").markupToError();
		});
		it("errors if not given a valid size string", function() {
			expect("(box:'',1)[]").markupToError();
			expect("(box:'===',1)[]").markupToError();
			expect("(box:'=X=X=',1)[]").markupToError();
		});
		it("errors if not given a valid vertical size", function() {
			expect("(box:'=X=',1.5)[]").markupToError();
			expect("(box:'=X=',0)[]").markupToError();
			expect("(box:'=X=',-0.1)[]").markupToError();
		});
		it("gives the hook the specified margins, width, height, as well as display:block", function() {
			[
				['=XX=', 25, 50, 40],
				['X===', 0, 25, 10],
				['==XXXXXXXX', 20, 80, 35],
			].forEach(function(a) {
				var code = a[0], marginLeft=a[1], width=a[2], height=a[3];

				var s = runPassage("(box:'" + code + "', " + height/100 + ")[]").find('tw-hook').attr('style');
				expect(s).toMatch(RegExp("margin-left:\\s*"+marginLeft+"%"));
				expect(s).toMatch(RegExp("\\bwidth:\\s*"+width+"%"));
				expect(s).toMatch(RegExp("\\bheight:\\s*"+height+"vh"));
				expect(s).toMatch(/display:\s*block/);
				expect(s).toMatch(/overflow-y:\s*auto/);
			});
		});
	});
	describe("the (float-box:) macro", function() {
		it("requires exactly 2 string arguments", function() {
			expect("(print:(float-box:))").markupToError();
			expect("(print:(float-box:1))").markupToError();
			expect("(print:(float-box:'A'))").markupToError();
		});
		it("errors if not given valid size strings", function() {
			expect("(float-box:'')[]").markupToError();
			expect("(float-box:'===','=X=')[]").markupToError();
			expect("(float-box:'=X=','=X=X=')[]").markupToError();
		});
		it("gives the hook the specified margins, width, height, as well as display:block and position:fixed", function() {
			[
				['=XX=', 'Y', 25, 0, 50, 100],
				['X===', '====Y=====', 0, 40, 25, 10],
				['==XXXXXXXX', 'YYYY====', 20, 0, 80, 50],
			].forEach(function(a) {
				var code = a[0], code2=a[1], marginLeft=a[2], marginTop=a[3], width=a[4], height=a[5];

				var s = runPassage("(float-box:'" + code + "', '" + code2 + "')[]").find('tw-hook').attr('style');
				expect(s).toMatch(RegExp("\\bleft:\\s*"+marginLeft+"vw|\\binset:\\s*"+marginLeft+"vw"));
				expect(s).toMatch(RegExp("\\btop:\\s*"+marginTop+"vh|\\binset:\\s*\\d+vw\\s*"+marginTop+"vh"));
				expect(s).toMatch(RegExp("\\bwidth:\\s*"+width+"vw"));
				expect(s).toMatch(RegExp("\\bheight:\\s*"+height+"vh"));
				expect(s).toMatch(/display:\s*block/);
				expect(s).toMatch(/position:\s*fixed/);
				expect(s).toMatch(/overflow-y:\s*auto/);
			});
		});
		it("has the background colour of outer hooks", function(done) {
			var hook = runPassage("(background: #fadaba)[|2>[(float-box:'=X=','=Y=')[baz]]]")
				.find('tw-hook[name=2] > tw-hook');
			setTimeout(function() {
				expect(hook).toHaveColour('#fadaba');
				done();
			});
		});
	});
	describe("the (hover-style:) macro", function() {
		it("requires exactly 1 style changer argument", function() {
			expect("(hover-style:)[]").markupToError();
			expect("(hover-style:1)[]").markupToError();
			expect("(hover-style:'A')[]").markupToError();
			expect("(hover-style:(font:'Skia'),(textstyle:'bold'))[]").markupToError();

			expect("(hover-style:(align:'==>'))[]").not.markupToError();
			expect("(hover-style:(background:black))[]").not.markupToError();
			expect("(hover-style:(css:'display:block'))[]").not.markupToError();
			expect("(hover-style:(font:'Skia'))[]").not.markupToError();
			expect("(hover-style:(text-colour:red))[]").not.markupToError();
			expect("(hover-style:(text-rotate:2))[]").not.markupToError();
		});
		it("applies the passed-in style only when hovering over the hook", function(done) {
			var hover = runPassage("(hover-style:(textstyle:'bold'))[garply]").find('tw-hook');
			hover.mouseenter();
			setTimeout(function() {
				expect(hover.attr('style')).toMatch(/font-weight:\s*(bold|800)/);
				hover.mouseleave();
				setTimeout(function() {
					expect(hover.attr('style')).not.toMatch(/font-weight:\s*(bold|800)/);
					done();
				});
			});
		});
		it("applies the style alongside existing styles", function(done) {
			var hover = runPassage("(hover-style:(textstyle:'bold'))+(text-color:'#ea1dac')[garply]").find('tw-hook');
			hover.mouseenter();
			setTimeout(function() {
				expect(hover.attr('style')).toMatch(/font-weight:\s*(bold|800)/);
				expect(hover).toHaveColour('#ea1dac');
				hover.mouseleave();
				done();
			});
		});
		it("removes the passed-in style when leaving the hook", function(done) {
			var hover = runPassage("(hover-style:(text-color:'#fadaba'))+(text-color:'#ea1dac')[garply]").find('tw-hook');
			setTimeout(function() {
				expect(hover).toHaveColour('#ea1dac');
				hover.mouseenter();
				setTimeout(function() {
					expect(hover).toHaveColour('#fadaba');
					hover.mouseleave();
					setTimeout(function() {
						expect(hover).toHaveColour('#ea1dac');
						done();
					});
				});
			});
		});
		it("errors if the passed-in changer isn't just a style changer", function() {
			expect("(hover-style:(replace:?1))[]").markupToError();
			expect("(hover-style:(if:true))[]").markupToError();
			expect("(hover-style:(t8n:'dissolve'))[]").markupToError();
			expect("(hover-style:(text-color:'red')+(hook:'E'))[]").markupToError();
		});
		it("works correctly when combined with (link:)", function(done) {
			var hover = runPassage("(hover-style:(text-style:'bold'))+(link:'The lake')[The still, cold lake.]").find('tw-hook');
			hover.mouseenter();
			setTimeout(function() {
				hover.click();
				setTimeout(function() {
					expect(hover.attr('style')).toMatch(/font-weight:\s*(bold|800)/);
					hover.mouseleave();
					setTimeout(function() {
						expect(hover.attr('style')).not.toMatch(/font-weight:\s*(bold|800)/);
						done();
					});
				});
			});
		});
	});
	it("can compose arbitrarily deep", function(done) {
		var align = runPassage(
			"(set:$c1 to (align:'==>'))"
			+ "(set: $c2 to $c1 + (text-color:#400))"
			+ "(set: $c3 to $c2 + (text-color:#400))"
			+ "(set: $c4 to $c3 + (text-color:#400))"
			+ "(set: $c5 to $c4 + (text-color:#400))"
			+ "(set: $c6 to $c4 + (text-color:#400))"
			+ "(set: $c7 to $c6 + (text-color:#400))"
			+ "$c7[garply]"
		).find('tw-hook');
		setTimeout(function() {
			expect(align.css('text-align')).toBe('right');
			done();
		});
	});
	it("errors if composed with non-changer objects", function() {
		expect("(set: $a to (align:'==>')+?Foo)").markupToError();
		expect("(set: $a to (align:'==>')+(goto:'Foo'))").markupToError();
		expect("(set: $a to (align:'==>')+(stop:))").markupToError();
		expect("(set: $a to (align:'==>')+red)").markupToError();
	});
});
