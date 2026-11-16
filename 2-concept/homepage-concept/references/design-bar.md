# Design bar

This is the standard every concept is judged against. Paste all of it into both subagent prompts.

## The goal

Ultra-high-end, agency-of-the-year work. It must look like a senior human design team made it for THIS brand. Never a template. Never an "AI website." If someone saw it next to a hundred other agency concepts, it must look like a different studio made it.

## Start from the brand

- Use the real logo, real colors (pull hex values from their CSS and logo), real photography and real voice.
- Push the brand upward; don't replace it. If the brand is weak, refine it (a better tint and shade system, a sharper accent) but keep it recognizable.
- Write a design thesis first: one idea the whole page expresses for this industry and audience. Examples: a valet company built around a claim ticket, a fishing shop built on a drawn nautical chart of its own waters, a staffing firm built as a job order form, a symphony built as a program-book cover, a plumbing filter company built as a schematic. Every section must serve the idea.
- The thesis carries the strategy. `research/strategy.md` names what this company can say that its competitors cannot; the idea must make that difference felt, and must not look like the competitor sites the strategy describes.
- Taste input is optional. If `research/taste.md` exists, it lists sites or looks the person running this wants to steer toward or away from. Borrow the principle (the pacing, the restraint, the way type and photo meet), never a layout. The brand still comes first.

## Composition archetypes

Pick ONE as the backbone. Choose the one that fits the brand best. If earlier concepts exist in the same workspace, prefer one they have used least (see the workspace list in your brief).

- A. Cinematic full-bleed: one huge real photo or video edge to edge, type over the lower third, minimal chrome.
- B. Type as image: giant display type fills the first screen like a poster; photos come as small insets or later.
- C. Magazine cover: masthead, issue-style grid, cover lines, editorial columns.
- D. Product on color: real product cut-outs on a saturated brand-color field, catalog energy.
- E. Filmstrip / horizontal: a horizontally scrolling gallery or project rail is the main device.
- F. Diagram-led: an SVG diagram, map, timeline or process drawing specific to the business is the hero.
- G. Interface-led: the real product UI or dashboard is the hero, crisp and large.
- H. Photo essay: a documentary stack of large real photos with short captions; type is quiet.
- I. Swiss color-block: strict modular grid, flat brand-color blocks, sans-serif only.
- J. Collage / layered: overlapping photos, cut paper, stamps, notes; warm and handmade.
- K. Monumental centered: one centered statement, generous margins, crest or seal; for institutions and public service.
- L. Index-led: a giant typographic list of services that is both the navigation and the hero.
- M. Utilitarian / spec sheet: technical data, rules, tables, part numbers; engineered and dense.
- N. Illustrated: a custom SVG illustration or pattern system for family, kid or playful brands.
- O. Dark luxe: near-black ground, restrained metallic or jewel accent, slow motion, spacious.
- P. Bright and loud: a saturated brand color as the ground (not cream, not white), oversized type.

## Hero, nav and footer types (the design log)

The archetype is the backbone; the hero, nav and footer are the chrome people remember. Pick one of each and log the codes in meta.json. Do not reuse any type the workspace list in your brief shows under AVOID (the most recent builds). If none fits, invent one and give it a short name.

- Hero: H1 full-bleed photo, type on top · H2 split, photo one side · H3 giant type with a photo inset · H4 photo band under or over a type block · H5 framed or matted photo on a color field · H6 real video · H7 off-grid crop, photo breaks the edge · H8 collage of 2 to 4 real photos · H9 the thesis object (ticket, chart, menu, program) holding the photo
- Nav: N1 bar, logo left, links right · N2 logo centered, links split · N3 logo plus a menu button only · N4 side rail · N5 two tiers, a utility strip over the main bar · N6 floating pill or tab · N7 laid over the hero, solid on scroll · N8 index or table of contents
- Footer: F1 link columns · F2 giant wordmark · F3 contact card, address, hours and phone set large · F4 one quiet line · F5 map and hours · F6 merged with the closing call to action as one block · F7 the thesis object again (ticket stub, colophon, back cover)

## A real photo above the fold

The first screen must show a real photograph or video, on desktop (1440x900) AND on phones (390x844), without scrolling. Type-only, illustration-only, diagram-only or UI-only first screens are not allowed, except in very rare cases where the brand truly has no usable photography (say so in the brief, and still try a real still from their video, their building, their product or their team first). Logos and icons do not count. The photo must be large enough to matter: at least about a quarter of the first screen, not a thumbnail. Every archetype can do this: type-as-image puts a big photo inset under or behind the type, diagram-led sets a real photo beside or under the drawing, interface-led pairs the UI with a real photo of people using it.

## Photo direction

- One treatment for every photo on the page: the same crop logic, the same color handling (all natural, all duotone in a brand color, all black and white with one color accent). Name it in the plan. Mixed treatments read as a template filled with whatever was on hand.
- Crop with intent. Faces and hands large; no dead sky; no heads cut at the forehead.
- When the brief's photo verdict is mixed or weak: use fewer photos, smaller and sharper; let type, a diagram or the thesis object carry more of the page; and never upscale. The shot list in the brief goes into the report so the client knows what a shoot would add.

## Typography

- Type carries the design. Choose a deliberate display + body pairing from Google Fonts or Fontshare that fits the brand.
- Never use Inter, Roboto, Poppins, Montserrat, Open Sans, Lato, Space Grotesk or Playfair Display.
- Avoid the fonts every AI site reaches for. Do not use any font the workspace list shows as used 2+ times; prefer fonts it does not list at all. Good starting pools: Google Fonts and Fontshare display faces with real character.
- Real craft: strong scale contrast, tight display tracking, a readable measure, tabular numerals where numbers matter, `text-wrap: balance` on headings.

## Banned (these read as AI or template)

- Purple or blue gradient blobs, glassmorphism cards, glows
- 3-up icon-in-a-circle feature grids, emoji, Lucide-style icons as the main visual
- A centered hero with two pill buttons over a gradient
- "Trusted by industry leaders" filler, fake stats, fake testimonials, lorem ipsum, invented people, stock photos you picked
- Every section using the same card style, heavy drop shadows, rounded everything
- Worn-out agency habits, unless the brand truly calls for one: an italic serif accent word in the headline, small mono letterspaced eyebrow labels over every section, 01/02/03 numbered lists, cream or beige backgrounds, a photo-on-the-right split hero, one giant word ending in a period on a flat color field
- Gimmicks that cheapen the brand (cartoon mascots the client doesn't own, sparkles, rockets)

These bans target generic styling, not the message. A plan, real proof and a quieter second call to action are still required (see "Message and conversion path"); draw them in this page's own language, never as the generic version banned above.

## Sameness check

A count across 247 past concepts found one skeleton under many skins: thin ruled rows on 98% of pages, seven or more stacked full-width bands on 95%, a numbered list on 74%. Break it on every page.

- Thin ruled rows (list rows split by hairlines) may lead one section per page at most.
- At least two sections must break the stacked full-width band: an overlap, a sideways strip, an inset, type set inside a full-bleed image, or an off-center layout.
- No large pull-quote band directly under the hero by default. Proof near the top takes a form the last five concepts in the workspace did not use.
- Before the design thesis, list in the brief the layout moves of the last five concepts in the workspace (hero shape, proof device, list device, section rhythm) and reuse none of them. With several options, the sibling options count too.
- The page below the first screen is where sameness hides. Every section between the hero and the footer gets its own layout decision from the thesis; no two sections in a row share a structure, and the proof, the plan and the service list each take a form the workspace's last ten concepts did not use.
- Art director: blur the desktop shot until the text cannot be read. If the silhouette could pass for another concept in the workspace, rebuild two sections before scoring.

## Content

- Only real content from their live site and public sources: services, history, addresses, phones, hours, real reviews quoted word for word with names, real team names.
- The words come from the copy deck (`research/copy.md`), written before design in clear StoryBrand style, held loosely: the customer is the hero, a clear problem, the company as the guide, a simple plan, one primary call to action. Set those words. Trim to fit, but never change the meaning or add a claim. Never invent facts, numbers, quotes, awards or people. The full message rules are in "Message and conversion path" below.
- No em dashes anywhere. Use commas, colons or two sentences.
- If the live site is thin, a real fact about it (a broken button, an old copyright year, a locked site) belongs in the problems list, not in the concept.

## Word limits (long copy is the loudest AI tell)

- Hero headline: 7 words or fewer. The line under it: one sentence, 25 words or fewer. Then the button.
- About 80 words per screen. A screen with more than about 120 reads as a wall.
- About 450 words on the page, not counting the nav and footer. Service lists, menus, service times and addresses are content, not copy; keep them, but cut the paragraphs around them.
- Cut adjectives before facts. If a sentence would fit any company in the industry, delete it.
- The copy deck sets the words. Lines it marks as never cut stay. If the design thesis needs more text than the limits allow (a newspaper, a catalog, a spec sheet), the extra is real content in list form (ads, listings, part numbers), never longer paragraphs.
- `slop.mjs` measures all of this. Over a limit is a WARN: cut, or waive with a real reason.

## Page

- A full homepage: header and nav, hero, 5 to 8 strong sections, a closing call to action, a real footer with real contact details.
- Fully responsive. Check 390px and 1440px. No sideways scroll at any width (add `html,body{overflow-x:clip}` if art bleeds off the edge on purpose).
- Keep the phone version under about 10,000px tall: use swipe rows and hide repeat copy on phones rather than stacking everything. Never hide a call to action, a phone number or proof to save height.
- Accessible: exactly one h1, alt text on every image, strong contrast, visible focus states, a skip link.
- Motion is restrained and chosen: one signature movement that belongs to the thesis (named in the plan), a considered hero entrance, scroll reveals that never hide content if JS fails, hover states with craft. Respect `prefers-reduced-motion`. Vanilla JS, or GSAP from cdnjs only.
- A hero video autoplays muted and loops, with no play or pause button, and is never paused by script (not even for reduced motion).
- Layout holds at every width from 360 to 2560: no `position: sticky` on section content (only the site header and phone action bar), and no absolutely positioned text or media in the hero that can collide with the copy. Use grid areas so the copy and the photo each own their space. `scrollscan.mjs` checks this at 15 widths.

## Message and conversion path

StoryBrand is the skeleton; the design thesis is the skin. Every page carries the same message structure underneath, and no two pages look alike on top. A visitor should feel the clarity and never see the framework.

**Message first.** Before the design thesis, the brief has a Message block: one-liner (the problem, what they offer, the result, under 30 words); the character and the one thing they came to do; the problem as external, internal and philosophical, one line each; one empathy line in the brand's voice; 3 to 5 authority points with a source URL for each (rating and review count, years, press, licenses, awards, notable clients); a 3-step plan, each step led by a verb, 5 words or fewer; the primary action (label, type and the real URL or `tel:`; one label, used everywhere); a secondary, lower-commitment action only if the client offers one; stakes (what doing nothing costs, 1 to 2 concrete lines); success (what life looks like after, 2 to 3 concrete lines). Mark anything the site and public sources do not support `[not on site]`; never invent it. The design thesis must carry this message. If the idea fights the message, change the idea.

**Required beats.** Every homepage carries all of these.

- The first screen passes the 5-second test on desktop and phone: a stranger can say what they offer, why it matters, and what to do next. The hero as a unit (the h1, the line under it, the button) carries this, so the h1 can stay bold or poetic if the next line says plainly what they do.
- One primary action with one label, used everywhere: in the header, in the first screen, again after the proof, and at the close. (Churches: Give may keep the top-right button beside it.)
- Stakes and success, in concrete words.
- The guide: one line of empathy plus real authority, every point traceable to a source.
- A plan of 3 steps.
- A quieter secondary action for people not ready yet, only if the client really offers one (a free estimate, a guide, a menu, a tour, a sermon).
- A closing call to action before a full footer (nav, contact, hours, socials).

**Keep it from feeling StoryBranded.** The beats are required. Their look and their labels are not.

- Never use framework words as headings: no "The Problem," "Our Plan," "How It Works," "Why Choose Us," "Meet Your Guide" or "What's at Stake." Write every heading in the brand's own voice and world.
- Draw each beat as an object from the design thesis, never as a stock section. The plan can be stubs on a claim ticket, frames on a film reel or waypoints on a chart. Proof can be a stamped ledger, a film credit or a margin note. Stakes can be a before and after inside the thesis object. A "How it works" row of three numbered cards, a testimonial carousel or a "Why choose us" grid fails the same way a gradient blob does.
- Beats may merge and move. The plan can live inside the hero or the booking block. Stakes can be one line under a heading. Proof can sit inside the closing call to action. Only two positions are fixed: the hero comes first and the closing call to action comes last.
- Add no section just to tick a box. Fold a missing beat into a section that already exists first. The page should not get longer than the design needs.
- Stakes stay in the brand's register: one concrete line, never fear copy. A luxury brand states a contrast; a plumber can be blunt.
- Buttons belong to the design. Only the label and placement are fixed; the shape, type and motion come from the thesis. Use no more than one primary button per screen. A quieter text link beside it is fine.

**Conversion path.**

- Mark every primary button `data-cta="primary"` and link it to the real booking, quote, call or visit URL, or a `tel:` link. Never `#` or empty. When there are several real destinations (several locations or venues), the button may jump to an on-page chooser (`#id`) that holds the real links.
- On phones the primary action is always reachable: a sticky bar or header button styled to the design, at least 44px tall. Businesses that run on calls get a tap-to-call link, and every phone number on the page is a `tel:` link.
- Put one piece of real, sourced proof within about one and a half screens of the top, and one beside the closing call to action.
- Add a risk-reversal line only if the client offers one (a guarantee, free estimates, no contract, walk-ins welcome).
- The offer is specific. The button says what the visitor gets, and one short line near it says what happens next ("We call you back within one business day"), only if that is true. If the strategy proposed a stronger label for the same real destination, use it.
- Answer the top objections where the decision happens. Take the 2 or 3 objections in the strategy that have real answers and put each answer beside a button or in a short question list before the close, drawn in the thesis. Never a stock FAQ accordion with ten questions.
- Show the step after the click. When the primary action is a form, a quote request or a booking, draw it on the page (near the close): only the fields a first contact needs, a label on every field, and the consent line the form needs. The concept form does not submit: the `<form>` has no `action` and no `method`, so nothing a visitor types can end up in a URL, and its button is a link to the real destination.
- Two buyers, two doors. If the strategy names two different buyers, the first screen routes them with two clear labels. There is still one primary action per buyer.
- Archetype guardrails: filmstrip and index-led layouts still keep a header button; dark luxe buttons still meet AA contrast; type-as-image heroes still show the button in the first screen; the button never waits on an animation to appear.

## Technical

- `concept/index.html` is one self-contained static HTML file with inline CSS and JS.
- Images live in `concept/assets/`, downloaded from the client's site. Resize with `node TOOLS/resize.mjs <folder> --max 2000` (TOOLS is the tools folder in your brief) and keep each under about 400KB where possible. Real video is fine if the client has it (keep it under 4MB).
- If the client's photos are small, use them at sizes where they stay sharp. Never upscale a 600px photo into a full-bleed hero.
- Fonts load from Google Fonts or Fontshare with a `<link>`.
- It must work when opened as a file and when served.

## Built to ship

Concepts become real sites. Design freely, but build so a developer (or the concept-to-site skill) can lift it.

- Every section is a `<section data-block="name">` with a short plain name (`hero`, `service-index`, `review-ledger`, `closing-call`).
- Content that repeats (services, reviews, team, locations, projects) is one repeated element fed from a list, never hand-built one-offs with different markup each time. That list becomes a CMS collection.
- Text an editor would change lives in the HTML, never baked into an image, an SVG path or CSS `content`.
- One-off art (a drawn map, a diagram) is fine; it is custom work, and client projects name it in the build notes.
- Pitch concepts may load fonts from Google Fonts or Fontshare. The real build self-hosts them, and loads no tracking before consent.

## Code craft (prospects open the source)

- Every color and font is a custom property on `:root` (`--ink`, `--paper`, `--accent`, `--font-display`, `--font-body`). Past the `:root` block, use `var()`, never a hex value or a font name. See-through scrims and shadows (`rgba()` with alpha) are fine inline.
- Never `transition: all`. Name the properties. Animate `transform` and `opacity`, never `width`, `height`, `top` or `left`.
- `overflow-x: clip` on `html` and `body`, never `hidden` (it breaks sticky headers). Never `100vw` for widths; use `100%`.
- Every link, button and field has a `:focus-visible` style.
- Every animation has a `prefers-reduced-motion: reduce` fallback, and every word is visible with scripting off.
- Nothing a visitor needs (the button, a headline, a result number) starts at `opacity: 0`; animate movement, not appearance. Never detect automated browsers (`navigator.webdriver`) to change what the page shows: the screenshots and the judge must see what a visitor sees.
- Image grid tracks use `minmax(0, 1fr)`; giant display type gets `overflow-wrap: break-word; min-width: 0` so it never pushes the page sideways.
- One primary button style, one container width, one radius per nesting level. No card inside a card.
- Labels, captions and tags are the body face a step smaller, in sentence case, not tiny letterspaced capitals (unless that is the brand's real voice; then waive it).
- No middle-dot strings ("Est. 1999 · Family owned · Licensed"), no arrows glued to link text as decoration, no decorative status dots.

## The slop check

Run `node TOOLS/slop.mjs <concept-folder>` (the folder that holds `concept/index.html`) beside `qa.mjs`. After the hero only, add `--stage hero`. It renders the page at 1440 and 390 and flags AI habits: italic accent words, gradients and glows, glass cards, two filled buttons side by side, card in card, eyebrow labels, 01/02/03 lists, icon-in-circle grids, emoji, banned fonts, cream grounds, the word limits and the code craft rules above.

- FAIL: fix it. No exceptions.
- WARN: fix it, or waive it in the page with a real, brand-specific reason: `<!-- slop-waive: italic-accent: the logo itself is an italic serif -->`. "It looks nice" is not a reason. Waivers are read by the director and by the person running the skill.
- A concept is done when slop.mjs shows 0 fail and 0 warn (waived lines are fine).
