---
name: homepage-concept
description: "Turns any website URL into an ultra-high-end, one-of-a-kind homepage redesign concept that looks like a top design studio made it for that brand, plus a before-and-after page to show the client and a link to send them. Uses the company's real logo, colors, photos and content, never templates or invented facts. Use when someone says 'homepage concept', '/homepage-concept', 'redesign concept for [url]', 'web design concept', 'mock up a new homepage for [company]', 'before and after for [site]', 'show this prospect what their site could look like', 'publish the concept', or pastes a URL and asks what a better site could look like."
metadata:
  version: 1.5.0
  author: Business Builders (businessbldrs.com)
---

# Homepage Concept

Turn one URL into one or more homepage concepts good enough to win the redesign, with a before-and-after page to show the client.

Each concept is built hero first by four subagents: a builder makes the plan and the first screen, a fresh reviewer fixes the hero, a finisher builds the rest of the page, and a separate art director polishes the whole. Two checkers gate every step: `qa.mjs` (broken basics and the conversion path) and `slop.mjs` (AI design habits, word limits, code craft). Several options are built in parallel, each a different design idea in the same brand. The first screen is ready to look at in about 15 minutes; one finished option takes 30 to 60.

Do the work. Do not hand the user steps.

`SKILL_DIR` below means the folder this file is in. Everything runs on Node.js alone, on macOS, Windows and Linux. Write paths with forward slashes in every command, on Windows too.

## Step 1: Get the URL, the number of options and any client material

- If the user did not give a URL, ask: "What's the website URL? (Add the company name if it isn't obvious from the URL.)"
- Ask both of these in one AskUserQuestion call (skip any the user already answered):
  - "How many design options do you want to see?" with **1 (Recommended)**, **2**, **3** and **4**. If they skip it, use 1. Call the number `N`. More than 4 is allowed if they ask, but each option adds time and usage.
  - "Any client material the site doesn't show?" with **No, use the site (Recommended)** and **Yes, I'll share it**. On yes, take what they give you. A file (assessment results, discovery notes, a brand guide, a list of reviews or numbers) goes to every `fill_prompt.mjs` call as `--brief <file>`. Short remarks (people to feature, things to avoid) go in `--notes "..."`. Real material from the client beats anything scraped. Never invent what they did not give.
- If the workspace has a `client-brief.md` or an assessment export for this company, use it as the `--brief` without asking.

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

Check the site loads: `curl -sIL -m 30 "<url>"`. If it is dead, parked, or redirects to a different company, tell the user and stop.

## Step 4: Build hero first (one option)

**If N is 1, follow Steps 4 and 5. If N is 2 or more, skip to Step 4B.**

Every `fill_prompt.mjs` call takes the same arguments. Call them `ARGS`:

```
--dir DIR --name "<name>" --url "<url>" --tools TOOLS [--brief <file>] [--notes "<extra context>"]
```

Each sub-step: fill the brief, then spawn one `general-purpose` agent in the foreground with "Read <the printed path> and follow every instruction in it exactly. It is your full brief." Wait for it before the next.

1. **Plan and hero.** `node SKILL_DIR/scripts/fill_prompt.mjs build ARGS`. The builder researches, writes the plan to `DIR/research/decisions.md` and builds only the header and first screen.
2. **Show the plan.** Read `decisions.md` and view the hero shots (`DIR/after/desktop.jpg`, `DIR/after/mobile.jpg`). Post the plan to the user as a short **Decisions** block (thesis, archetype, hero, nav, footer, type, ground, signature, sections, photos, what material is missing) with one line: "Building the rest now. Say stop to change direction." Do not wait for an answer.
3. **Hero review (fresh eyes).** `fill_prompt.mjs hero ARGS`. It scores and fixes the hero before anything else is built, and writes `research/hero-review.md`.
4. **Finish.** `fill_prompt.mjs finish ARGS`. It builds the rest of the page from the plan and the hero notes, and writes `meta.json`.

## Step 5: Art direct (last subagent)

`node SKILL_DIR/scripts/fill_prompt.mjs director ARGS`, then a separate `general-purpose` agent with "Read <that path> and follow every instruction in it exactly." It critiques the concept and fixes it until it honestly scores 9 or higher, with `qa.mjs` and `slop.mjs` clean. A fresh agent catches what the builder could not see. If you already spotted problems (a font that feels generic, a fact you doubt, a layout that looks like a template), put them in `--notes`.

## Step 4B: Several options, built in parallel

**Research once.** `node SKILL_DIR/scripts/fill_prompt.mjs research ARGS`, then one `general-purpose` agent in the foreground with "Read <path> and follow every instruction in it exactly." It writes `DIR/research/brief.md`, the before shots and a starter `DIR/meta.json`.

**Assign the options.** Read the brief and `references/design-bar.md`, and run `node SKILL_DIR/scripts/workspace_index.mjs WORKSPACE` to see what earlier concepts used. Pick N clearly different directions that all fit this brand. For each option (letters a, b, c, d...) write one line: archetype, hero type, nav type, footer type (codes from the design bar; no two options share a hero type), font direction, color ground, the hero photo to lead with (from the brief's photo inventory), and the one idea. Example: "D. Product on color; H5; N3; F6; heavy condensed sans; saturated brand green field; hero photo verti-cutter.jpg; idea: dealer catalog, one machine per screen." Every option shares the brief's message and primary action; they differ in design, never in what they ask the visitor to do.

**Show the decisions before building.** Post one **Decisions** block: a short table with a row per option, plus the shared one-liner and primary action, and what material is missing. Then ask one AskUserQuestion: "Build these options?" with **Build them (Recommended)** and **Change something**. On a change, update the lines and show the block again. This is the last cheap moment to redirect. If the user said not to ask or is running this unattended, post the block and go on.

**Build all heroes at once.** One brief per option:

```
node SKILL_DIR/scripts/fill_prompt.mjs option ARGS --option b --count N --assign "<this option's line>" --siblings "<the other options' lines, labeled A, C...>"
```

Spawn N `general-purpose` agents **in one message** so they run in parallel, each with "Read <its option-x-prompt.md path> and follow every instruction in it exactly." Wait for all of them.

**Review all heroes at once.** `fill_prompt.mjs hero ARGS --option b --count N` for each option, then N fresh reviewers in one message. View the hero shots side by side; if two heroes feel alike, tell the weaker option's finisher in `--notes` what to change.

**Finish all pages at once.** `fill_prompt.mjs finish ARGS --option b --count N` for each option, then N finishers in one message. Each writes `research/option-<x>.json`.

**Art direct all options at once.** `fill_prompt.mjs director ARGS --option b --count N` for each option, then N directors in one message.

**Merge.** `node SKILL_DIR/scripts/merge_options.mjs DIR` writes every option into `DIR/meta.json` (Option A becomes the main concept). It must say "status done".

## Step 6: Check it yourself

```
node TOOLS/qa.mjs DIR
node TOOLS/slop.mjs DIR
```

For several options, check them all at once: `node TOOLS/qa.mjs DIR DIR/options/b DIR/options/c` and the same for `slop.mjs`.

`qa.mjs` must print `0 with issues`. It checks for a real photo above the fold on desktop and phone, sideways scrolling, broken images, missing alt text, the h1 count, em dashes and script errors, plus the conversion path: the main button in the first screen, repeated and linked for real, tap-to-call links and the phone page height. `slop.mjs` must show `0 fail, 0 warn` for each (waived lines are fine). Read every waiver in the page; if a reason is lazy ("looks nice"), send it back to the director.

If either reports anything, fix it in `DIR/concept/index.html`, reshoot, and run both again:

```
node TOOLS/shoot.mjs DIR/concept/index.html DIR/after
```

Then look at the work: Read `DIR/after/desktop.jpg` and `DIR/after/mobile.jpg` (and each option's `options/<x>/after/` shots). With several options, put them side by side: if two feel like the same design, send the weaker one back to its director with notes on how to differ. Check that the same photo is not used twice on the page. Do the 5-second test on each first screen: if you cannot say what they offer and what to do next, or the page reads like a filled-in template, send it back to the director. If anything looks broken, generic or AI-made, send it back to the art director with your notes. Confirm `DIR/meta.json` has `"status": "done"` and every field in `references/meta-format.md`, including the design log fields (`hero`, `nav`, `footer`, `sections`, `created`).

## Step 7: Build the before-and-after page

```
node SKILL_DIR/scripts/make_compare.mjs WORKSPACE
```

This writes `DIR/index.html` (the before-and-after page for this company, with Option A / B / C tabs when there are several) and `WORKSPACE/index.html` (every concept in the workspace). If `WORKSPACE/agency.json` exists, the pages carry that agency's name, accent color, logo and call to action (the format is at the top of `make_compare.mjs`).

Open the page for the user: `open DIR/index.html` on a Mac, `start "" DIR/index.html` on Windows, `xdg-open DIR/index.html` on Linux.

## Step 8: Publish (when the user wants a link to send)

Ask before publishing; it puts the pages on the public internet. On yes:

```
node TOOLS/publish.mjs WORKSPACE [--only <slug>] [--project <name>]
```

It copies the finished concepts (never the `research/` folders) to Cloudflare Pages, hides them from search engines, and prints one link per company. The list of every concept stays off the public site unless you add `--with-index`, so one client cannot browse the others. It needs a free Cloudflare account and one `npx wrangler login`; if the deploy fails for that reason, tell the user to run that command and try again. `--dry-run` builds the folder without deploying.

## Step 9: Report

Tell the user, in plain words:

- Where the before-and-after page is (`DIR/index.html`) and the full new homepage (`DIR/concept/index.html`), and the published link if there is one
- The design idea in one line (one line per option when there are several), and the top 2 problems with the current site
- The one-liner and what makes it convert, in one line (from meta.json "conversion")
- What real material was missing (from `decisions.md`), so they know what to ask the client for
- If it was not published: that they can say "publish it" to get a link to send

## Rules that do not bend

- A real photo or video must be in the first screen on desktop and phone, big enough to matter. Type-only first screens are not allowed except in very rare cases.
- Real content only. Every fact, number, quote, name and photo comes from the company's own site, the client brief or public sources. Never invent testimonials, stats, awards, team members or stock people.
- No em dashes anywhere in the page or meta.json.
- Short copy: a hero headline of 7 words or fewer, about 80 words a screen, about 450 on the page.
- `slop.mjs` clean: 0 fail, and every warn fixed or waived with a real reason.
- Every page carries the message beats and one primary action ("Message and conversion path" in the design bar), drawn in the design's own language. Never a stock StoryBrand template.
- It must look like a top studio designed it for this brand, and unlike any other concept in the workspace.
- Write only inside `DIR`. Never publish without the user saying so.
