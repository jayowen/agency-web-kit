---
name: homepage-concept
description: "Turns any website URL into an ultra-high-end, one-of-a-kind homepage redesign concept that looks like a top design studio made it for that brand, plus a before-and-after page to show the client and a link to send them. Uses the company's real logo, colors, photos and content, never templates or invented facts. Use when someone says 'homepage concept', '/homepage-concept', 'redesign concept for [url]', 'web design concept', 'mock up a new homepage for [company]', 'before and after for [site]', 'show this prospect what their site could look like', 'publish the concept', 'revise the [company] concept', 'we won [company]', or pastes a URL and asks what a better site could look like."
metadata:
  version: 1.6.1
  author: Business Builders (businessbldrs.com)
---

# Homepage Concept

Turn one URL into one or more homepage concepts good enough to win the redesign, with a before-and-after page to show the client.

Each lane has its own agent, so no one grades their own work:

- **Research** gathers the facts, photos and before shots.
- **Strategy** studies three competitors and names the difference, the objections, the offer and the brand's voice.
- **Copy** writes the words before anyone designs.
- **Design** runs hero first: a builder makes the plan and the first screen, a fresh reviewer fixes the hero, a finisher builds the rest, and an art director polishes the whole page.
- **An outside judge** scores creative direction, art direction, messaging, conversion and craft with evidence, and never edits. Anything under 9 goes back to the art director.

Three checkers gate the work: `qa.mjs` (broken basics and the conversion path), `slop.mjs` (AI design habits, word limits, code craft) and `scrollscan.mjs` (overlaps and crowding at 15 screen widths). Several options are built in parallel, each a different design idea in the same brand. Quality matters more than speed: the first screen is ready to look at in about 30 minutes, and one finished option takes one to two hours.

**Two modes.** *Cold pitch*: the company has not hired you; work from the URL and whatever the user adds. *Client project*: a signed client; the concept becomes the real site, so it also takes the client's goals, keeps a project log, saves versions when it is revised, and writes build notes.

Do the work. Do not hand the user steps.

`SKILL_DIR` below means the folder this file is in. Everything runs on Node.js alone, on macOS, Windows and Linux. Write paths with forward slashes in every command, on Windows too.

## Step 1: Intake (always ask)

If the user did not give a URL, ask: "What's the website URL? (Add the company name if it isn't obvious from the URL.)"

Then ask these in ONE AskUserQuestion call, every run. Skip the mode or options question only if the user already answered it. **Never skip the content question**, even if they already pasted material or the workspace already has a client brief; then it reads "Anything else to add?"

1. "Is this a cold pitch or a signed client?" with **Cold pitch (Recommended)** and **Client project**.
2. "How many design options do you want to see?" with **1 (Recommended)**, **2**, **3** and **4**. If they skip it, use 1. Call the number `N`. More than 4 is allowed if they ask, but each option adds time and usage.
3. "Do you have any additional content? Photos, reviews, numbers, brand files, notes from the client." with **No, use the site** and **Yes, I'll share it**.
4. "Any sites or looks to steer toward or away from? (Optional)" with **No, surprise me (Recommended)** and **Yes, I'll share some**.

On a yes to 3 or 4, tell them to dump everything in one message (paste, attach, a folder path, a link, a list of URLs) and wait for it. Do not ask follow-up questions about it; sort it yourself. For a client project, add one line to that request: "Include anything you know about their goals, their best customers, their offers and who they compete with."

Running unattended, or the user said not to ask: use cold pitch, 1 option, no extra content, no taste input, and say so in the report.

## Step 2: Set up

Pick the workspace folder, called `WORKSPACE`: `$HOMEPAGE_CONCEPTS_DIR` if it is set, otherwise `./homepage-concepts` in the current directory. Create it if needed.

Install the tools (one time; safe to re-run). The last line it prints is the tools folder, called `TOOLS`:

```
node SKILL_DIR/scripts/setup.mjs
```

It needs Node.js 18 or newer and nothing else. If `node` is missing, tell the user to install the LTS from nodejs.org, reopen the terminal, and stop.

## Step 3: Start the concept folder

```
node SKILL_DIR/scripts/new_concept.mjs WORKSPACE "<url>" "<Company Name if known>"
```

It prints JSON with `slug`, `name`, `url` and `dir`. Call the folder `DIR`. If it says `EXISTS`, ask the user whether to redo that one; on yes, re-run with `--force`.

Save what the user gave you, in their words, so every agent reads the same thing (the briefs pick these files up on their own):

- Additional content goes in `DIR/research/client-brief.md` (copy any files they pointed to into `DIR/research/raw/`). If the workspace already has a `client-brief.md` or an assessment export for this company, start from that file. A file they hand you can also go to the first `fill_prompt.mjs` call as `--brief <file>`. Real material from the client beats anything scraped. Never invent what they did not give.
- Taste input goes in `DIR/research/taste.md`: each site or look, and whether to steer toward it or away from it. Skip the file if they gave none.
- Client projects: start `DIR/research/log.md` with today's date, the mode, who asked, and what they supplied.

Check the site loads: `curl -sIL -m 30 "<url>"`. If it is dead, parked, or redirects to a different company, tell the user and stop.

## Step 4: Research, strategy and copy (every run, once per company)

Every `fill_prompt.mjs` call takes the same arguments. Call them `ARGS`:

```
--dir DIR --name "<name>" --url "<url>" --tools TOOLS [--notes "<a short instruction for this one brief>"]
```

Add `--mode pitch` or `--mode client` to the first call; it is remembered.

Each sub-step: fill the brief, then spawn one `general-purpose` agent in the foreground with "Read <the printed path> and follow every instruction in it exactly. It is your full brief." Wait for it before the next.

1. **Research.** `node SKILL_DIR/scripts/fill_prompt.mjs research ARGS --mode <pitch|client>`. It writes `DIR/research/brief.md`, the before shots and a starter `DIR/meta.json`.
2. **Strategy.** `fill_prompt.mjs strategy ARGS`. It writes `research/strategy.md` and sharpens the brief's Message block.
3. **Copy.** `fill_prompt.mjs copy ARGS`. It writes `research/copy.md`, the words every option sets.

Read `strategy.md` and `copy.md` yourself before going on. If the difference is vague ("quality and service") or the hero headline could sit on a competitor's site, send that agent back once with a note saying so.

## Step 5: Build hero first (one option)

**If N is 1, follow Steps 5 and 6. If N is 2 or more, skip to Step 5B.**

1. **Plan and hero.** `node SKILL_DIR/scripts/fill_prompt.mjs build ARGS`. The builder writes the plan to `DIR/research/decisions.md` and builds only the header and first screen.
2. **Show the plan.** Read `decisions.md` and view the hero shots (`DIR/after/desktop.jpg`, `DIR/after/mobile.jpg`). Post the plan to the user as a short **Decisions** block (the difference, thesis, archetype, hero, nav, footer, type, ground, signature, sections, photos, what material is missing) with one line: "Building the rest now. Say stop to change direction." Do not wait for an answer.
3. **Hero review (fresh eyes).** `fill_prompt.mjs hero ARGS`. It scores and fixes the hero before anything else is built, and writes `research/hero-review.md`.
4. **Finish.** `fill_prompt.mjs finish ARGS`. It builds the rest of the page from the plan and the hero notes, and writes `meta.json`.

## Step 6: Art direct, then judge

1. **Art direct.** `fill_prompt.mjs director ARGS`, then a separate `general-purpose` agent. It fixes the concept until `qa.mjs`, `slop.mjs` and the scroll scan are clean. If you already spotted problems (a font that feels generic, a fact you doubt, a layout that looks like a template), put them in `--notes`.
2. **Judge.** `fill_prompt.mjs judge ARGS`, then a fresh `general-purpose` agent. It scores five lanes with evidence, runs the sameness, template and truth checks, and writes `research/scorecard.json`. It edits nothing else.
3. **Loop.** Read the scorecard. "ship" means done. "ship with limits" means done too: every lane is 8 or higher and what remains needs the client (a photo shoot, a price answer); put the limits list in the report as what to ask the client for. If the verdict is "revise", run `fill_prompt.mjs director ARGS` again (it now reads the scorecard on its own) and spawn a new director, then a new judge. Do up to three judge rounds. Each judge is fresh, but from round two it also checks the last round's fixes, and the director is told which sections need a rebuild, not a polish. If the verdict is still "revise" after the third, stop and tell the user which lane and why; do not present it as finished.

Never raise a score yourself, and never let the director's own score stand in for the judge's.

## Step 5B: Several options, built in parallel

Step 4 has already run once for the company. Every option shares its research, strategy and copy.

**Assign the options.** Read the brief, the strategy and `references/design-bar.md`, and run `node SKILL_DIR/scripts/workspace_index.mjs WORKSPACE` to see what earlier concepts used. Pick N clearly different directions that all fit this brand. For each option (letters a, b, c, d...) write one line: archetype, hero type, nav type, footer type (codes from the design bar; no two options share a hero type), font direction, color ground, the hero photo to lead with (from the brief's photo inventory), and the one idea. Example: "D. Product on color; H5; N3; F6; heavy condensed sans; saturated brand green field; hero photo verti-cutter.jpg; idea: dealer catalog, one machine per screen." Every option shares the copy deck and primary action; they differ in design, never in what they ask the visitor to do.

**Show the decisions before building.** Post one **Decisions** block: a short table with a row per option, plus the shared one-liner and primary action, and what material is missing. Then ask one AskUserQuestion: "Build these options?" with **Build them (Recommended)** and **Change something**. On a change, update the lines and show the block again. This is the last cheap moment to redirect. If the user said not to ask or is running this unattended, post the block and go on.

**Build all heroes at once.** One brief per option:

```
node SKILL_DIR/scripts/fill_prompt.mjs option ARGS --option b --count N --assign "<this option's line>" --siblings "<the other options' lines, labeled A, C...>"
```

Spawn N `general-purpose` agents **in one message** so they run in parallel, each with "Read <its option-x-prompt.md path> and follow every instruction in it exactly." Wait for all of them.

**Review all heroes at once.** `fill_prompt.mjs hero ARGS --option b --count N` for each option, then N fresh reviewers in one message. View the hero shots side by side; if two heroes feel alike, tell the weaker option's finisher in `--notes` what to change.

**Finish all pages at once.** `fill_prompt.mjs finish ARGS --option b --count N` for each option, then N finishers in one message. Each writes `research/option-<x>.json`.

**Art direct all options at once.** `fill_prompt.mjs director ARGS --option b --count N` for each option, then N directors in one message.

**Judge all options at once.** `fill_prompt.mjs judge ARGS --option b --count N` for each option, then N fresh judges in one message. Each writes `research/scorecard-<x>.json`. Any option with a "revise" verdict goes back through its director and a new judge, up to three rounds, as in Step 6. If the judges find two options too alike, the weaker one is rebuilt, not tweaked.

**Merge.** `node SKILL_DIR/scripts/merge_options.mjs DIR` writes every option into `DIR/meta.json` (Option A becomes the main concept). It must say "status done".

## Step 7: Check it yourself

```
node TOOLS/qa.mjs DIR
node TOOLS/slop.mjs DIR
node TOOLS/scrollscan.mjs DIR
```

For several options, check them all at once: `node TOOLS/qa.mjs DIR DIR/options/b DIR/options/c` and the same for `slop.mjs`.

`qa.mjs` must print `0 with issues`. It checks for a real photo above the fold on desktop and phone, sideways scrolling, broken images, missing alt text, the h1 count, em dashes and script errors, plus the conversion path: the main button in the first screen, repeated and linked for real, tap-to-call links and the phone page height. `slop.mjs` must show `0 fail, 0 warn` for each (waived lines are fine). Read every waiver in the page; if a reason is lazy ("looks nice"), send it back to the director.

If either reports anything, fix it in `DIR/concept/index.html`, reshoot, and run both again:

```
node TOOLS/shoot.mjs DIR/concept/index.html DIR/after
```

Then look at the work: Read `DIR/after/desktop.jpg` and `DIR/after/mobile.jpg` (and each option's `options/<x>/after/` shots). With several options, put them side by side: if two feel like the same design, send the weaker one back to its director with notes on how to differ. Check that the same photo is not used twice on the page. Do the 5-second test on each first screen: if you cannot say what they offer and what to do next, or the page reads like a filled-in template, send it back to the director. If anything looks broken, generic or AI-made, send it back to the art director with your notes. Read the scroll sheets in `DIR/research/scroll/` and look hard at the page below the first screen; that is where concepts go generic.

Then finish `DIR/meta.json`: copy the judge's final scores into `"scores"`, the strategy's difference into `"difference"`, set `"mode"`, and set `"outcome": {"status": "not sent", "date": "", "note": ""}`. Client projects: add a dated line to `research/log.md` with the scores and what was built. Confirm it has `"status": "done"` and every field in `references/meta-format.md`, including the design log fields (`hero`, `nav`, `footer`, `sections`, `created`).

## Step 8: Build the before-and-after page

```
node SKILL_DIR/scripts/make_compare.mjs WORKSPACE
```

This writes `DIR/index.html` (the before-and-after page for this company, with Option A / B / C tabs when there are several) and `WORKSPACE/index.html` (every concept in the workspace). If `WORKSPACE/agency.json` exists, the pages carry that agency's name, accent color, logo and call to action (the format is at the top of `make_compare.mjs`).

Open the page for the user: `open DIR/index.html` on a Mac, `start "" DIR/index.html` on Windows, `xdg-open DIR/index.html` on Linux.

## Step 9: Publish (when the user wants a link to send)

Ask before publishing; it puts the pages on the public internet. On yes:

```
node TOOLS/publish.mjs WORKSPACE [--only <slug>] [--project <name>]
```

It copies the finished concepts (never the `research/` folders) to Cloudflare Pages, hides them from search engines, and prints one link per company. The list of every concept stays off the public site unless you add `--with-index`, so one client cannot browse the others. It needs a free Cloudflare account and one `npx wrangler login`; if the deploy fails for that reason, tell the user to run that command and try again. `--dry-run` builds the folder without deploying.

## Step 10: Report

Tell the user, in plain words:

- Where the before-and-after page is (`DIR/index.html`) and the full new homepage (`DIR/concept/index.html`), and the published link if there is one
- The design idea in one line (one line per option when there are several), and the top 2 problems with the current site
- The difference you led with, the one-liner, and what makes it convert, in one line each
- The judge's five scores, and any lane that did not reach 9
- What real material was missing (from `decisions.md`, the brief's photo verdict and the strategy's unanswered objections), so they know what to ask the client for
- Client projects: where the build notes are (`DIR/research/build-notes.md`)
- If it was not published: that they can say "publish it" to get a link to send

## Revising a concept (client projects, or any concept that comes back with feedback)

When the user returns with feedback on a concept that exists:

1. Save the current version first: copy `DIR/concept/` and `DIR/after/` into `DIR/versions/v<n>/` (the next free number).
2. Write the feedback, word for word, into `DIR/research/log.md` under today's date, with who gave it.
3. If the feedback changes the message or the offer, re-run the copy step with it in `--notes`. Then run the director with the feedback in `--notes`, then the judge, as in Step 6.
4. Add a dated line to the log: what changed and the new scores. Rebuild the before-and-after page and report as usual, naming the version.

Never overwrite a version folder. The log is the project's memory; read it at the start of every revision.

## Logging what happened (how you learn what wins)

When the user says a concept was sent, got a meeting, won, lost or got no reply ("we won Acme", "mark Acme as sent"), update `outcome` in that concept's `meta.json` (`status`, today's `date`, a one-line `note` with the reason if they gave one). Do not ask follow-up questions. When the user asks what is working, read every `meta.json` in the workspace with an outcome and compare winners with losers by archetype, hero type, scores and industry.

## Rules that do not bend

- A real photo or video must be in the first screen on desktop and phone, big enough to matter. Type-only first screens are not allowed except in very rare cases.
- Real content only. Every fact, number, quote, name and photo comes from the company's own site, the client brief or public sources. Never invent testimonials, stats, awards, team members or stock people.
- No em dashes anywhere in the page or meta.json.
- Short copy: a hero headline of 7 words or fewer, about 80 words a screen, about 450 on the page.
- `slop.mjs` clean: 0 fail, and every warn fixed or waived with a real reason.
- Every page carries the message beats and one primary action ("Message and conversion path" in the design bar), drawn in the design's own language. Never a stock StoryBrand template.
- No one grades their own work. The judge's scorecard is the score, and the judge never edits the page.
- Always ask the additional-content question at intake.
- It must look like a top studio designed it for this brand, and unlike any other concept in the workspace.
- Write only inside `DIR`. Never publish without the user saying so.
