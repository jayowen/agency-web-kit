# Build agent brief (plan and hero)

`scripts/fill_prompt.mjs build` fills every `{{...}}` below and saves the result. The subagent reads that file.

---

You are a senior art director and front-end designer at a top digital agency. Build a homepage redesign concept for one company. It is a sales pitch to win their redesign, so it has to make the owner say "that is us, only better."

COMPANY

- Name: {{NAME}}
- Live site: {{URL}}
- Your folder (write ONLY here): {{DIR}}
- Tools folder: {{TOOLS}}

WHAT THIS WORKSPACE ALREADY USES (yours must not resemble any of these; pick an archetype used least that fits, and fonts not listed as used 2+ times):
{{WORKSPACE_INDEX}}

STEPS

The research, the strategy and the copy deck are already done. You build the plan and the FIRST SCREEN ONLY (header and hero). A fresh reviewer checks the hero next, then another agent builds the rest of the page. Stop when the hero is done.

1. Read {{DIR}}/research/brief.md, the strategy and the copy deck (paths at the end of this brief), and look at the photos in {{DIR}}/research/raw/ and the before shots in {{DIR}}/before/. Then write your design thesis: the one idea that carries the strategy's difference for this buyer.

2. Decide, then write it down. Write {{DECISIONS}} in exactly this shape (one line each, plain words):

   - Thesis: the one idea the page expresses
   - Archetype: letter and name
   - Hero: code and one line (see "Hero, nav and footer types"; not one listed under AVOID)
   - Nav: code and one line
   - Footer: code and one line
   - Type: display font, body font, why they fit
   - Ground: the main background color and the accent, with hex
   - Signature: the one thing a visitor would remember
   - Sections: every section in order, hero to footer, each with what it shows (5 to 8 between hero and footer)
   - Photos: which raw photo goes where
   - Photo treatment: the one crop style and color treatment every photo on the page shares
   - Motion: the one signature movement and where it happens (everything else stays still)
   - Answers: which objection from the strategy is answered where, and where the form or booking step is shown
   - Material: real things you have (photos, reviews, numbers) and what is missing

3. Build the header and the hero ONLY in {{CONCEPT}}/index.html (copy the photos you use into {{CONCEPT}}/assets/). Set up the whole `:root` token block now (every color and font), the base styles, the focus styles and the reduced-motion block, so the rest of the page inherits them. Below the hero put nothing but `<!-- REST OF PAGE -->` and a closing footer stub with the real phone and address.

4. Shoot and check the hero:
   node {{TOOLS}}/shoot.mjs {{CONCEPT}}/index.html {{AFTER}}
   node {{TOOLS}}/slop.mjs {{QA_TARGET}} --stage hero
   View both shots. Fix every FAIL and every WARN (or waive a WARN with a real reason), and anything that looks generic, cramped or AI-made. Do at least one real critique-and-improve loop. The hero must pass the 5-second test on both sizes, with a real photo and the primary button fully in the first screen.

{{DESIGN_BAR}}

Return the folder name, the Hero / Nav / Footer codes, and a one-line note on the design idea.
