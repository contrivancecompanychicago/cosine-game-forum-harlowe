define(['jquery', 'twinemarked', 'story', 'utils', 'selectors', 'regexstrings', 'state', 'macros', 'script'], function ($, TwineMarked, Story, Utils, Selectors, RegexStrings, State, Macros, Script) {
	"use strict";

	/**
		A singleton class responsible for rendering passages to the DOM.

		@class Engine
		@static
	*/

	/**
		Creates the HTML structure of the <tw-passage>. Sub-function of showPassage().

		@method createPassageElement
		@private
		@return {jQuery} the element
	*/
	function createPassageElement () {
		var container, back, fwd, sidebar;
		container = $('<tw-passage><tw-sidebar>'),
		sidebar = container.children(Selectors.sidebar);

		// Permalink
		sidebar.append('<tw-icon class="permalink" title="Permanent link to this passage"><a href="#' + State.save() + '">&sect;');
		// Apart from the Permalink, the sidebar buttons consist of Undo (Back) and Redo (Forward) buttons.
		back = $('<tw-icon class="undo" title="Undo">&#8630;</tw-icon>').click(Engine.goBack);
		fwd = $('<tw-icon class="redo" title="Redo">&#8631;</tw-icon>').click(Engine.goForward);

		if (State.pastLength <= 0) {
			back.css("visibility", "hidden");
		}
		if (State.futureLength <= 0) {
			fwd.css("visibility", "hidden");
		}
		sidebar.append(back).append(fwd);

		return container;
	}
	
	/**
		Shows a passage by transitioning the old passage(s) out, and then adds the new passages.

		@method showPassage
		@private
		@param {String} id
		@param {Boolean} stretch Is stretchtext
		@param {jQuery} el The DOM parent element to append to
	*/
	function showPassage (id, stretch, el) {
		var newPassage, // Passage element to create
			t8n, // Transition ID
			passageCode,
			el = el || Utils.storyElement,
			passageData = Story.passageWithID(id),
			oldPassages = Utils.$(el.children(Utils.passageSelector));

		if (!passageData) {
			Utils.impossible("Engine.showPassage","no passage with id \""+id+"\"");
			return;
		}

		$(window).scrollTop(oldPassages.offset());

		// Load the default transition if none specified

		t8n = passageData.attr("data-t8n") || "dissolve";

		// Transition out

		if (!stretch && t8n) {
			Utils.transitionOut(oldPassages, t8n);
		}
		// Create new passage
		passageCode = Utils.unescape(passageData.html());
		newPassage = createPassageElement().append(Engine.render(passageCode));
		el.append(newPassage);
		Engine.updateEnchantments(newPassage);

		// Transition in
		if (t8n) {
			Utils.transitionIn(newPassage, t8n);
		}
	}
	
	/**
		Renders macros to HTML. Called by render().

		@method renderMacros
		@private
		@param {String} source		source text to render
		@return {Array} Two entries: the HTML to render, and all Macros 
	*/
	function renderMacros (source) {
		var macroInstances = [],
			macroCount = 0,
			newhtml = "",
			index = 0;

		Macros.matchMacroTag(source, null, function (m) {
			// A macro by that name doesn't exist

			if (!m.desc) {
				m.desc = Macros.get("unknown");
			}

			// Contain the macro in a hidden span.

			newhtml += source.slice(index, m.startIndex) + '<tw-macro count="' + macroCount + '" name="' + m.name +
				'" hidden></tw-macro>';
			macroInstances.push(m);
			macroCount += 1;
			index = m.endIndex;
		});

		newhtml += source.slice(index);
		return [newhtml, macroInstances];
	}
	
	var Engine = {
		/**
			Moves the game state backward one. If there is no previous state, this does nothing.

			@method goBack
		*/
		goBack: function () {
			//TODO: get the stretch value from state

			if (State.rewind()) {
				showPassage(State.passage);
			}
		},

		/**
			Moves the game state forward one after a previous goBack().

			@method goForward
		*/
		goForward: function () {
			//TODO: get the stretch value from state

			if (State.fastForward()) {
				showPassage(State.passage);
			}
		},

		/**
			Displays a new passage, advancing the game state forward.

			@method goToPassage
			@param {String} id			id of the passage to display
			@param {Boolean} stretch	display as stretchtext?
		*/
		goToPassage: function (id, stretch) {
			// Update the state.
			State.play(id);
			showPassage(id, stretch);
		},

		/**
			Does all initial startup work. This should be called once.

			@method init
		*/
		init: function () {
			var html = $(document.documentElement);
			
			// Install handler for links

			html.on('click.passage-link', Selectors.internalLink+'[passage-id]', function (e) {
				var next = $(this).attr('passage-id');

				if (next) {
					// TODO: stretchtext
					Engine.goToPassage(next,false);
				}

				e.preventDefault();
			});

			// If debug, add button

			if (Story.options.debug) {
				$(document.body).append($('<div class="debug-button">').click(function (e) {
					html.toggleClass('debug-mode');
				}));
			}
		},

		/**
			Updates all enchantment DOM structures in the passage.

			@method updateEnchantments
			@param {jQuery} top The passage element in which this is being performed.
		*/
		updateEnchantments: function (top) {
			// Remove the old enchantments
			Utils.$(Selectors.pseudoHook, top).children().unwrap();
			Utils.$(Selectors.hook, top).attr("class", "");

			// Perform actions for each scoping macro's scope.
			Utils.$(Selectors.hookMacroInstance, top).each(function () {
				var instance = $(this).data("instance");
				if (instance) {
					// Refresh the scope, and enchant it.
					instance.refreshScope();
					instance.enchantScope();
				}
			});
		},

		/**
			The top-level rendering method.

			@method render
			@param {string} source The code to render - HTML entities must be unescaped
			@param {MacroInstance} [context] Macro instance which triggered this rendering.
			@param {jQuery} [top] the topmost DOM level into which this will be rendered
			(usually a <tw-passage>). Undefined if this is the document top.
			@return {jQuery} The rendered passage.
		*/
		render: function (source, context, top) {
			var html, temp, macroInstances;
			
			// If a non-string is passed into here, there's really nothing to do.
			if (typeof source !== "string") {
				Utils.impossible("Engine.render", "source was not a string");
				return $();
			}

			// macros

			temp = renderMacros(source);
			source = temp[0];
			macroInstances = temp[1];

			// Do Markdown
			
			// Let's not bother if this source solely held macros.
			if (source.trim()) {
				try {
					source = TwineMarked.render(source);
				} catch (e) {
					Utils.impossible("Engine.render()","TwineMarked crashed");
					temp = renderMacros("<p>"+RegexStrings.macroOpen + "rendering-error " +
						e + RegexStrings.macroClose+"</p>");
					source = temp[0];
					macroInstances = temp[1];
				}
			}
			
			// Render the HTML
			/*
				Important: various Twine macros perform DOM operations on this pre-inserted jQuery set of
				rendered elements, but assume that all the elements have a parent item, so that e.g.
				.insertBefore() can be performed on them. Also, and perhaps more saliently, the next
				block uses .find() to select <tw-macro> elements etc., which assumes that no <tw-macro>
				elements are present at the jQuery object's "root level".
				
				So, a <tw-temp-container> is temporarily used to house the entire rendered HTML
				before it's inserted at the end of this function.
			*/
			html = $('<tw-temp-container>' + source);
			
			/*
				Execute macros immediately
			*/
			html.find(Selectors.macroInstance + ", " + Selectors.internalLink).each(function runMacroInstances () {
				var passage,
					text,
					visited,
					count,
					el = $(this);

				switch(this.tagName.toLowerCase()) {
					case "tw-macro":
					{
						count = this.getAttribute("count");
						this.removeAttribute("hidden");
						/*
							To provide the macros with a sufficient top,
							unwrap the <tw-temp-container>, and add the 'top' for this
							rendered fragment.
						*/
						macroInstances[count].run(el, context, html.contents().add(top));
						break;
					}
					/*
						To consider: there should perchance exist "lazy links" whose passage-exprs are not
						evaluated into passage-ids until the moment they are clicked.
					*/
					case "tw-link":
					{
						passage = Utils.unescape(el.attr("passage-expr"));
						text = el.text();
						visited = -1;
						
						if (Story.passageNamed(passage)) {
							visited = (State.passageNameVisited(passage));
						} else {
							// Is it a code link?
							try {
								passage = Script.environ().evalExpression(passage);
								Story.passageNamed(passage) && (visited = (State.passageNameVisited(passage)));
							} catch(e) { /* pass */ }
							
							// Not an internal link?
							if (!~visited) {
								el.replaceWith('<tw-broken-link passage-id="' + passage + '">' + (text || passage) + '</tw-broken-link>');
							}
						}
						el.removeAttr("passage-expr").attr("passage-id", Story.getPassageID(passage));
						if (visited) {
							el.addClass("visited");
						}
						if (Story.options.opaquelinks) {
							el.attr("title",passage);
						}
						break;
					}
				}
			});
			// Unwrap the aforementioned <tw-temp-container>.
			return html.contents();
		}
	};
	
	Utils.log("Engine module ready!");
	
	return Object.freeze(Engine);
});
