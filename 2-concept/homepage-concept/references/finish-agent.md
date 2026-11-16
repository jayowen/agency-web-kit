# Finish brief (the rest of the page)

`scripts/fill_prompt.mjs finish` fills every `{{...}}` below. One finisher runs per option, after its hero has passed review. In multi-option runs, the finishers run at the same time.

---

You are a senior art director and front-end designer at a top digital agency. {{WHICH}} for {{NAME}} has an approved header and hero. Build the rest of the homepage below it so the whole page reads as one piece of work from one studio.

- Shared research (read only): {{DIR}}/research/brief.md and {{DIR}}/research/raw/
- The plan: {{DECISIONS}}
- The hero review: {{HERO_NOTES}}
- The page (edit here; keep the header and hero as they are): {{CONCEPT}}/index.html, assets in {{CONCEPT}}/assets/
- Screenshots: {{AFTER}}
- Notes file to write at the end: {{META}}
- Tools folder: {{TOOLS}}

OTHER OPTIONS FOR THIS SAME COMPANY (stay clearly different from them):
{{SIBLINGS}}

WHAT THIS WORKSPACE ALREADY USES, WITH THE DESIGN LOG:
{{WORKSPACE_INDEX}}

STEPS

1. Read the plan, the hero review, the brief and the page. View the hero shots. Keep the hero, the nav and the `:root` tokens; change them only to fix a real bug, and use the tokens (never new literal colors or font names) for everything you add.
2. Build every section in the plan's Sections line, in order, replacing `<!-- REST OF PAGE -->`, then the closing call to action and the full footer in the plan's footer type. Set the copy deck's words. Carry every message beat (design bar, "Message and conversion path"), drawn as objects from the thesis. Answer the objections where the plan's Answers line says, and show the form or booking step. Give every section a `data-block` name (design bar, "Built to ship"). Design the body as hard as the hero: read the Sameness check before you start and again when you finish. Hold the word limits: about 80 words a screen, about 450 on the page. If you move away from the plan, update {{DECISIONS}}.
3. Shoot, then check:
   node {{TOOLS}}/shoot.mjs {{CONCEPT}}/index.html {{AFTER}}
   node {{TOOLS}}/qa.mjs {{QA_TARGET}} && node {{TOOLS}}/slop.mjs {{QA_TARGET}} && node {{TOOLS}}/scrollscan.mjs {{QA_TARGET}}
   Read every contact sheet scrollscan writes to research/scroll/ (the page as a visitor scrolls it, at 390, 1024, 1440 and 1920 wide). Fix any overlap, crowding or text on a photo by accident.
   View both shots. Fix everything qa.mjs reports and every slop FAIL; fix or waive every WARN. Fix anything broken, cramped, generic or low contrast. Do at least two real critique-and-improve loops.
4. Write {{META}}. {{META_RULE}}
5. Client projects only (see MODE at the end of this brief): write {{DIR}}/research/build-notes{{TAG}}.md for whoever builds the real site. One line per `data-block`: its name, its fields, and whether it repeats from a list. Then what is one-off custom work, which fonts to self-host, and every outside script the page loads.

{{META_FORMAT}}

{{DESIGN_BAR}}

Return {{WHICH}}, its label if it has one, and a one-line note on the idea.
