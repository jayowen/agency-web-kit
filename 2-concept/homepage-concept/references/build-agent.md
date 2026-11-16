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

You build the research, the plan and the FIRST SCREEN ONLY (header and hero). A fresh reviewer checks the hero next, then another agent builds the rest of the page. Stop when the hero is done.

1. Research. Start with the rendered fetch, which sees the site the way a browser does (plain curl comes back thin on Wix, Squarespace, Webflow and other JavaScript-built sites):
   node {{TOOLS}}/fetch.mjs "{{URL}}" {{DIR}}/research/raw/pages --name home
   Read home.txt, home.styles.json (fonts, colors, logo candidates, nav links) and home.images.json (every image with its real pixel size). Run it again with a new --name for each main page in the nav (about, services, reviews, contact, and any page a first-time customer would need). Capture the logo (SVG if it exists), brand colors (hex), fonts, every usable real photo or video, services, real copy, contact details, hours, and real reviews with names. Download the photos and logo into {{DIR}}/research/raw/ with curl (use each image's "largest" URL when there is one), then shrink them:
   node {{TOOLS}}/resize.mjs {{DIR}}/research/raw --max 2000
   Save notes to {{DIR}}/research/brief.md: brand facts, palette, type, a photo inventory (each file, its pixel size, hero-worthy or not), a content inventory, 4 factual problems with the current site, a Message block written before any design (the fields listed under "Message first" in the design bar below), and your design thesis, which must carry that message.

2. Before shots:
   node {{TOOLS}}/shoot.mjs "{{URL}}" {{DIR}}/before
   View both with the Read tool. If the site blocks the tool (a 401 or a challenge page), shoot the latest Wayback Machine copy instead and say so in the brief.

3. Decide, then write it down. Write {{DECISIONS}} in exactly this shape (one line each, plain words):

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
   - Material: real things you have (photos, reviews, numbers) and what is missing

4. Build the header and the hero ONLY in {{CONCEPT}}/index.html (copy the photos you use into {{CONCEPT}}/assets/). Set up the whole `:root` token block now (every color and font), the base styles, the focus styles and the reduced-motion block, so the rest of the page inherits them. Below the hero put nothing but `<!-- REST OF PAGE -->` and a closing footer stub with the real phone and address.

5. Shoot and check the hero:
   node {{TOOLS}}/shoot.mjs {{CONCEPT}}/index.html {{AFTER}}
   node {{TOOLS}}/slop.mjs {{QA_TARGET}} --stage hero
   View both shots. Fix every FAIL and every WARN (or waive a WARN with a real reason), and anything that looks generic, cramped or AI-made. Do at least one real critique-and-improve loop. The hero must pass the 5-second test on both sizes, with a real photo and the primary button fully in the first screen.

{{DESIGN_BAR}}

Return the folder name, the Hero / Nav / Footer codes, and a one-line note on the design idea.
