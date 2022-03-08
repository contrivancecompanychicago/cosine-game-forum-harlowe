describe("interaction macros", function() {
	'use strict';
	[{
		name: 'click',
		entity: 'link',
		action: 'click',
		cssClass: 'enchantment-link',
		eventMethod: 'click',
	},{
		name: 'mouseover',
		entity: 'mouseover-region',
		action: 'mouseover',
		cssClass: 'enchantment-mouseover',
		eventMethod: 'mouseenter',
	},{
		name: 'mouseout',
		entity: 'mouseout-region',
		action: 'mouseout',
		cssClass: 'enchantment-mouseout',
		eventMethod: 'mouseleave',
	},{
		name: 'click-rerun',
		entity: 'link',
		action: 'click',
		cssClass: 'enchantment-link',
		eventMethod: 'click',
	},{
		name: 'click-goto',
		entity: 'link',
		action: 'click',
		cssClass: 'enchantment-link',
		eventMethod: 'click',
	},{
		name: 'mouseover-goto',
		entity: 'mouseover-region',
		action: 'mouseover',
		cssClass: 'enchantment-mouseover',
		eventMethod: 'mouseenter',
	},{
		name: 'mouseout-goto',
		entity: 'mouseout-region',
		action: 'mouseout',
		cssClass: 'enchantment-mouseout',
		eventMethod: 'mouseleave',
	},{
		name: 'click-undo',
		entity: 'link',
		action: 'click',
		cssClass: 'enchantment-link',
		eventMethod: 'click',
	},{
		name: 'mouseover-undo',
		entity: 'mouseover-region',
		action: 'mouseover',
		cssClass: 'enchantment-mouseover',
		eventMethod: 'mouseenter',
	},{
		name: 'mouseout-undo',
		entity: 'mouseout-region',
		action: 'mouseout',
		cssClass: 'enchantment-mouseout',
		eventMethod: 'mouseleave',
	}].forEach(function(e) {
		var goTo = e.name.includes('goto');
		var undo = e.name.includes('undo');
		var rerun = e.name.includes('rerun');
		var hooksetCall = "(" + e.name + ":?foo" + (goTo ? ",'garply')" : ')[]');
		var stringCall = "(" + e.name + ":'wow'" + (goTo ? ",'garply')" : ')[]');
		describe("(" + e.name + ":)", function() {
			beforeEach(function() {
				runPassage("''grault''(set: $a to 1)","garply");
			});
			if (!goTo && !undo) {
				it("accepts either 1 hookset or 1 non-empty string, followed by an optional changer or 'via' lambda", function() {
					expect("(print:(" + e.name + ":?foo))").not.markupToError();
					expect("(print:(" + e.name + ":'baz'))").not.markupToError();

					expect("(print:(" + e.name + ":?foo, ?bar))").markupToError();
					expect("(print:(" + e.name + ":?foo, 'baz'))").markupToError();
					expect("(print:(" + e.name + ":'baz', 'baz'))").markupToError();
					expect("(print:(" + e.name + ":''))").markupToError();
					expect("(print:(" + e.name + ":?foo, (b4r:'solid')))").not.markupToError();
					expect("(print:(" + e.name + ":?foo, via (b4r:'solid')))").not.markupToError();
					expect("(print:(" + e.name + ":'baz', (b4r:'solid')))").not.markupToError();
					expect("(print:(" + e.name + ":'baz', via (b4r:'solid')))").not.markupToError();
				});
				it("errors when placed in passage prose while not attached to a hook", function() {
					expect("(" + e.name + ":?foo)").markupToError();
					expect("(" + e.name + ":?foo)[]").not.markupToError();
				});
			}
			else if (goTo) {
				it("accepts either 1 hookset or 1 non-empty string, followed by a string", function() {
					expect("(print:(" + e.name + ":?foo))").markupToError();
					expect("(print:(" + e.name + ":'baz'))").markupToError();

					expect("(print:(" + e.name + ":?foo, 'garply'))").not.markupToError();
					expect("(print:(" + e.name + ":'baz', 'garply'))").not.markupToError();

					expect("(print:(" + e.name + ":?foo, ?bar, 'garply'))").markupToError();
					expect("(print:(" + e.name + ":?foo, 'baz', 'garply'))").markupToError();
					expect("(print:(" + e.name + ":'baz', 'baz', 'garply'))").markupToError();
					expect("(print:(" + e.name + ":''))").markupToError();
				});
				it("errors when the given passage doesn't exist", function() {
					expect("(" + e.name + ":?foo,'qux')").markupToError();
				});
			}
			else if (undo) {
				it("accepts either 1 hookset or 1 non-empty string", function() {
					expect("(print:(" + e.name + ":?foo))").not.markupToError();
					expect("(print:(" + e.name + ":'baz'))").not.markupToError();

					expect("(print:(" + e.name + ":?foo, 'garply'))").markupToError();
					expect("(print:(" + e.name + ":'baz', 'garply'))").markupToError();
				});
				it("errors when the given passage doesn't exist", function() {
					expect("(" + e.name + ":?foo,'qux')").markupToError();
				});
			}
			describe("given a single hook", function() {
				it("enchants the selected hook as a " + e.entity, function() {
					var p = runPassage("[cool]<foo|" + hooksetCall).find('tw-enchantment');
					expect(p.length).toBe(1);
					expect(p.hasClass(e.cssClass)).toBe(true);
				
					p = runPassage(hooksetCall + "[cool]<foo|").find('tw-enchantment');
					expect(p.length).toBe(1);
					expect(p.hasClass(e.cssClass)).toBe(true);
				});
				if (!goTo && !undo) {
					it("renders the attached hook when the enchantment is " + e.action + "ed", function() {
						var p = runPassage("[cool]<foo|(" + e.name + ":?foo)[beans]");
						expect(p.text()).toBe("cool");
						p.find('tw-enchantment')[e.eventMethod]();
						expect(p.text()).toBe("coolbeans");
					});
					it("works with temporary variables", function() {
						var p = runPassage("(set:_a to 1)[(set:_a to 2)]<bar|("+e.name+":?bar)[(print:_a)]");
						p.find('tw-enchantment')[e.eventMethod]();
						expect(p.text()).toBe('2');
					});
					if (!rerun) {
						it("disenchants the selected hook when the enchantment is " + e.action + "ed", function() {
							var p = runPassage("[cool]<foo|(" + e.name + ":?foo)[beans]");
							expect(p.text()).toBe("cool");
							p.find('tw-enchantment')[e.eventMethod]();
							expect(p.find('tw-enchantment').length).toBe(0);
						});
						it("nested enchantments are triggered one by one", function() {
							var p = runPassage("[[cool]<foo|]<bar|(" + e.name + ":?foo)[beans](" + e.name + ":?bar)[lake]");
							expect(p.text()).toBe("cool");
							p.find('tw-enchantment').first()[e.eventMethod]();
							expect(p.text()).toBe("coollake");
							p.find('tw-enchantment').first()[e.eventMethod]();
							expect(p.text()).toBe("coolbeanslake");
						});
						it("multiple enchantments are triggered in order", function() {
							var p = runPassage(
								"[A]<foo|(" + e.name + ":?foo)[1]"
								+ "(" + e.name + ":?foo)[2]"
								+ "(" + e.name + ":?foo)[3]");
							$('tw-hook')[e.eventMethod]();
							expect(p.text()).toBe("A1");
							$('tw-hook')[e.eventMethod]();
							expect(p.text()).toBe("A12");
							$('tw-hook')[e.eventMethod]();
							expect(p.text()).toBe("A123");
						});
					} else {
						it("doesn't disenchant the selected hook when the enchantment is " + e.action + "ed", function() {
							var p = runPassage("(set:_b to 0)[cool]<foo|(" + e.name + ":?foo)[(set:_b to it+1)_b]");
							expect(p.text()).toBe("cool");
							p.find('tw-enchantment')[e.eventMethod]();
							expect(p.text()).toBe("cool1");
							expect(p.find('tw-enchantment').length).toBe(1);
							p.find('tw-enchantment')[e.eventMethod]();
							expect(p.text()).toBe("cool2");
						});
					}
				}
				else if (goTo) {
					it("goes to the given passage when the enchantment is " + e.action + "ed", function(done) {
						var p = runPassage("[cool]<foo|(" + e.name + ":?foo, 'garply')");
						expect(p.text()).toBe("cool");
						p.find('tw-enchantment')[e.eventMethod]();
						setTimeout(function() {
							expect($('tw-passage:last-child').find('b').text()).toBe("grault");
							done();
						},20);
					});
				}
				else if (undo) {
					it("undoes the current turn when the enchantment is " + e.action + "ed", function(done) {
						var p = runPassage("[cool]<foo|(" + e.name + ":?foo)");
						expect(p.text()).toBe("cool");
						p.find('tw-enchantment')[e.eventMethod]();
						setTimeout(function() {
							expect("(print: $a) (print:(history:)'s length)").markupToPrint("1 1");
							done();
						},20);
					});
				}
				it("doesn't affect empty hooks", function() {
					var p = runPassage("[]<foo|" + hooksetCall).find('tw-enchantment');
					expect(p.length).toBe(0);
				});
				it("affects hooks inside other hooks", function() {
					var p = runPassage("(if:true)[[cool]<foo|]" + hooksetCall).find('tw-enchantment');
					expect(p.length).toBe(1);
					expect(p.hasClass(e.cssClass)).toBe(true);
				});
				it("gives affected hooks a tabindex", function() {
					var p = runPassage("[cool]<foo|" + hooksetCall).find('tw-enchantment');
					expect(p.attr('tabindex')).toBe('0');
				});
				[['?Page','tw-story'],['?Passage','tw-passage'],['?Sidebar','tw-sidebar']].forEach(function(f) {
					var name = f[0], elem = f[1];
					describe("with "+name, function() {
						var pageCall = goTo ? "(" + e.name + ":"+name+",'garply')" : "(" + e.name + ":"+name+")[1]";
						it("enchants the <"+elem+"> element with the 'enchantment-"+e.action+"block' class", function() {
							runPassage(pageCall+"garply");
							var g = $(elem).parent('tw-enchantment.enchantment-'+e.action+'block');
							expect(g.length).toBe(1);
						});
						it("does this even when targeting other hooks", function() {
							var p = runPassage("[cool]<" + name.replace("?",'') + "|" + pageCall);
							expect(p.find('tw-enchantment').length).toBe(1);
							var g = $(elem).parent('tw-enchantment.enchantment-'+e.action+'block');
							expect(g.length).toBe(1);
						});
						// Since the box-shadow is on a pseudo-element, we can't test its CSS.
						if (!goTo && !undo && !rerun) {
							it("multiple enchantments are triggered in order", function() {
								var p = runPassage(
									"(" + e.name + ":"+name+")[1]"
									+ "(" + e.name + ":"+name+")[2]"
									+ "(" + e.name + ":"+name+")[3]");
								$(elem)[e.eventMethod]();
								expect(p.text()).toBe("1");
								$(elem)[e.eventMethod]();
								expect(p.text()).toBe("12");
								$(elem)[e.eventMethod]();
								expect(p.text()).toBe("123");
							});
						}
						if (e.action === "click") {
							it("gives it a tabindex", function() {
								runPassage(pageCall);
								var p = $(elem).parent('tw-enchantment.enchantment-clickblock');
								expect(p.attr('tabindex')).toBe('0');
							});
						}
						if (name === "?Page") {
							if (goTo) {
								it("doesn't trigger when arriving on the page by the same input method", function(done) {
									createPassage("''foo''","baz");
									createPassage("(" + e.name + ":"+name+",'baz')''grault''","corge");
									var p = runPassage("(t8n-arrive:'instant')(" + e.name + ":"+name+",'corge')");
									p[e.eventMethod]();
									setTimeout(function() {
										expect($('tw-passage:last-child').find('b').text()).toBe("grault");
										done();
									},20);
								});
								if (e.eventMethod === "click") {
									it("doesn't trigger when arriving on the page via undo", function(done) {
										createPassage("''foo''","baz");
										runPassage("(" + e.name + ":"+name+",'baz')''grault''","corge");
										runPassage("");
										$('tw-sidebar [alt=Undo]')[e.eventMethod]();
										setTimeout(function() {
											expect($('tw-passage:last-child').find('b').text()).toBe("grault");
											done();
										},20);
									});
								}
							} else if (!undo) {
								it("doesn't trigger when arriving on the page by a (goto:) revealed by the same input method", function(done) {
									createPassage("''foo''","baz");
									createPassage("(" + e.name + ":"+name+")[=''grault''","corge");
									
									var p = runPassage("(" + e.name + ":"+name+")[=(t8n-arrive:'instant')(goto:'corge')");
									
									p[e.eventMethod]();
									setTimeout(function() {
										expect($('tw-passage:last-child').find('b').text()).not.toBe("grault");
										done();
									},20);
								});
								if (e.eventMethod === "click") {
									it("doesn't trigger when arriving on the page by a link", function(done) {
										createPassage("''foo''","baz");
										createPassage("(" + e.name + ":"+name+")[=''grault''","corge");
										
										var p = runPassage("(t8n-arrive:'instant')[[corge]]");
										p.find('tw-link')[e.eventMethod]();
										setTimeout(function() {
											expect($('tw-passage:last-child').find('b').text()).not.toBe("grault");
											done();
										},20);
									});
									it("doesn't trigger when arriving on the page by a (link-reveal-goto:)", function(done) {
										createPassage("''foo''","baz");
										createPassage("(" + e.name + ":"+name+")[=''grault''","corge");
										
										var p = runPassage("(link-reveal-goto:'corge',(t8n-arrive:'instant'))[]");
										p.find('tw-link')[e.eventMethod]();
										setTimeout(function() {
											expect($('tw-passage:last-child').find('b').text()).not.toBe("grault");
											done();
										},20);
									});
								}
							}
						}
					});
				});
			});
			describe("given multiple hooks", function() {
				it("enchants each selected hook as an interaction element", function() {
					var p = runPassage("[very]<foo|[cool]<foo|" + hooksetCall).find('tw-enchantment');
					expect(p.length).toBe(2);
					p = runPassage(hooksetCall + "[very]<foo|[cool]<foo|").find('tw-enchantment');
					expect(p.length).toBe(2);
				});
				if (!goTo && !undo) {
					it("renders the attached hook when either enchantment is " + e.action + "ed", function() {
						['first','last'].forEach(function(f) {
							var p = runPassage("[very]<foo|[cool]<foo|(" + e.name + ":?foo)[beans]");
							expect(p.text()).toBe("verycool");
							p.find('tw-enchantment')[f]()[e.eventMethod]();
							expect(p.text()).toBe("verycoolbeans");
						});
					});
					if (!rerun) {
						it("disenchants all selected hooks when the enchantment is " + e.action + "ed", function() {
							['first','last'].forEach(function(f) {
								var p = runPassage("[very]<foo|[cool]<foo|(" + e.name + ":?foo)[beans]");
								p.find('tw-enchantment')[f]()[e.eventMethod]();
								expect(p.find('tw-enchantment').length).toBe(0);
							});
						});
					} else {
						it("doesn't disenchant all selected hooks when the enchantment is " + e.action + "ed", function() {
							['first','last'].forEach(function(f) {
								var p = runPassage("(set:_b to 0)[very]<foo|[cool]<foo|(" + e.name + ":?foo)[(set:_b to it+1)beans_b]");
								p.find('tw-enchantment')[f]()[e.eventMethod]();
								expect(p.find('tw-enchantment').length).toBe(2);
								expect(p.text()).toBe("verycoolbeans1");
								p.find('tw-enchantment')[f]()[e.eventMethod]();
								expect(p.text()).toBe("verycoolbeans2");
							});
						});
					}
					it("if given a changer, styles every selected hook using it", function() {
						var p = runPassage("[A]<foo|[A]<foo|("+e.name+":?foo, (size: 2))[]");
						expect(p.find('tw-enchantment:first-of-type').attr('style')).toMatch(/size:\s*48px/);
						expect(p.find('tw-enchantment:last-of-type').attr('style')).toMatch(/size:\s*48px/);
					});
					it("if given a lambda, uses it to produce a changer for each target", function() {
						var p = runPassage("[A]<foo|[A]<bar|("+e.name+":?foo+?bar, via (size: pos*2))[]");
						expect(p.find('tw-enchantment:first-of-type').attr('style')).toMatch(/size:\s*48px/);
						expect(p.find('tw-enchantment:last-of-type').attr('style')).toMatch(/size:\s*96px/);
					});
				} else if (goTo) {
					it("goes to the given passage when either enchantment is " + e.action + "ed", function(done) {
						var p = runPassage("[very]<foo|[cool]<foo|(" + e.name + ":?foo, 'garply')");
						expect(p.text()).toBe("verycool");
						p.find('tw-enchantment').first()[e.eventMethod]();
						setTimeout(function() {
							expect($('tw-passage:last-child').find('b').text()).toBe("grault");
							p = runPassage("[very]<foo|[cool]<foo|(" + e.name + ":?foo, 'garply')");
							expect(p.text()).toBe("verycool");
							p.find('tw-enchantment').last()[e.eventMethod]();
							setTimeout(function() {
								expect($('tw-passage:last-child').find('b').text()).toBe("grault");
								done();
							},20);
						},20);
					});
				} else if (undo) {
					it("undoes the current turn when either enchantment is " + e.action + "ed", function(done) {
						var p = runPassage("[very]<foo|[cool]<foo|(" + e.name + ":?foo)");
						expect(p.text()).toBe("verycool");
						p.find('tw-enchantment')[e.eventMethod]();
						setTimeout(function() {
							expect("(print: $a) (print:(history:)'s length)").markupToPrint("1 1");
							p = runPassage("[very]<foo|[cool]<foo|(" + e.name + ":?foo)");
							p.find('tw-enchantment').last()[e.eventMethod]();
							setTimeout(function() {
								expect("(print: $a) (print:(history:)'s length)").markupToPrint("1 2"); // 2, because the first markupToPrint() passage was visited also.
								done();
							},20);
						},20);
					});
				}
				it("enchants additional matching hooks added to the passage", function() {
					var p = runPassage("[very]<foo|" + hooksetCall + "(link:)[[cool]<foo|]");
					p.find('tw-expression[name=link]').click();
					expect(p.find('tw-enchantment').length).toBe(2);
				});
			});
			describe("given strings", function() {
				it("enchants each found string in the passage", function() {
					var p = runPassage("wow" + stringCall + "wow").find('tw-enchantment');
					expect(p.length).toBe(2);
					expect(p.hasClass(e.cssClass)).toBe(true);
				});
				if (!goTo && !undo) {
					it("renders the attached hook when any enchanted string is " + e.action + "ed", function() {
						['first','last'].forEach(function(f) {
							var p = runPassage("wow(" + e.name + ":'wow')[ gosh ]wow");
							expect(p.text()).toBe("wowwow");
							p.find('tw-enchantment')[f]()[e.eventMethod]();
							expect(p.text()).toBe("wow gosh wow");
						});
					});
					if (!rerun) {
						it("disenchants all selected strings when the enchantment is " + e.action + "ed", function() {
							['first','last'].forEach(function(f) {
								var p = runPassage("wow(" + e.name + ":'wow')[ gosh ]wow");
								p.find('tw-enchantment')[f]()[e.eventMethod]();
								expect(p.find('tw-enchantment').length).toBe(0);
							});
						});
						it("nested enchantments are triggered one by one", function() {
							var p = runPassage("wow(" + e.name + ":'wow')[gosh](" + e.name + ":'w')[geez]");
							expect(p.text()).toBe("wow");
							p.find('tw-enchantment').first()[e.eventMethod]();
							expect(p.text()).toBe("wowgosh");
							p.find('tw-enchantment').first()[e.eventMethod]();
							expect(p.text()).toBe("wowgoshgeez");
						
							p = runPassage("wow(" + e.name + ":'w')[gosh](" + e.name + ":'wow')[geez]");
							expect(p.text()).toBe("wow");
							p.find('tw-enchantment').first()[e.eventMethod]();
							expect(p.text()).toBe("wowgosh");
							p.find('tw-enchantment').first()[e.eventMethod]();
							expect(p.text()).toBe("wowgoshgeez");
						});
					} else {
						it("doesn't disenchant all selected strings when the enchantment is " + e.action + "ed", function() {
							['first','last'].forEach(function(f) {
								var p = runPassage("(set:_b to 0)wow(" + e.name + ":'wow')[(set:_b to it+1) gosh _b ]wow");
								p.find('tw-enchantment')[f]()[e.eventMethod]();
								expect(p.text()).toBe("wow gosh 1 wow");
								expect(p.find('tw-enchantment').length).toBe(2);
								p.find('tw-enchantment')[f]()[e.eventMethod]();
								expect(p.text()).toBe("wow gosh 2 wow");
							});
						});
					}
					it("if given a changer, styles every selected hook using it", function() {
						var p = runPassage("foo foo|("+e.name+":'foo', (size: 2))[]");
						expect(p.find('tw-enchantment:first-of-type').attr('style')).toMatch(/size:\s*48px/);
						expect(p.find('tw-enchantment:last-of-type').attr('style')).toMatch(/size:\s*48px/);
					});
					it("if given a lambda, uses it to produce a changer for each target", function() {
						var p = runPassage("foo foo|("+e.name+":'foo', via (size: pos*2))[]");
						expect(p.find('tw-enchantment:first-of-type').attr('style')).toMatch(/size:\s*48px/);
						expect(p.find('tw-enchantment:last-of-type').attr('style')).toMatch(/size:\s*96px/);
					});
				} else if (goTo) {
					it("goes to the given passage when any enchanted string is " + e.action + "ed", function(done) {
						var p = runPassage("wow(" + e.name + ":'wow', 'garply')wow");
						expect(p.text()).toBe("wowwow");
						p.find('tw-enchantment').first()[e.eventMethod]();
						setTimeout(function() {
							expect($('tw-passage:last-child').find('b').text()).toBe("grault");
							var p = runPassage("wow(" + e.name + ":'wow', 'garply')wow");
							expect(p.text()).toBe("wowwow");
							p.find('tw-enchantment').last()[e.eventMethod]();
							setTimeout(function() {
								expect($('tw-passage:last-child').find('b').text()).toBe("grault");
								done();
							},20);
						},20);
					});
				}
				else if (undo) {
					it("undoes the current turn when any enchanted string is " + e.action + "ed", function(done) {
						var p = runPassage("wow(" + e.name + ":'wow')wow");
						expect(p.text()).toBe("wowwow");
						p.find('tw-enchantment')[e.eventMethod]();
						setTimeout(function() {
							expect("(print: $a) (print:(history:)'s length)").markupToPrint("1 1");
							p = runPassage("wow(" + e.name + ":'wow')wow");
							p.find('tw-enchantment').last()[e.eventMethod]();
							setTimeout(function() {
								expect("(print: $a) (print:(history:)'s length)").markupToPrint("1 2"); // 2, because the first markupToPrint() passage was visited also.
								done();
							},20);
						},20);
					});
				}
				it("enchants additional matching strings added to the passage", function() {
					var p = runPassage("wow" + stringCall + "(link:'A')[wow]");
					p.find('tw-link').click();
					expect(p.find('tw-enchantment').length).toBe(2);
				});
			});
		});
	});
});
