---
name: concept-to-site
description: "Turns an approved homepage concept into a real, launch-ready website: shared header and footer, the inner pages, search basics, redirects from the old site, security headers, checks, and a preview link on Cloudflare Pages. Use when someone says 'build the site from the concept', 'turn this concept into a website', 'the client approved the concept', 'build out the inner pages', or 'get this ready to launch'."
metadata:
  version: 0.1.0
---

# Concept to Site

An approved concept is one long HTML file. A website is many pages that share a header, a footer and a look, that Google can read, and that somebody can keep up. This skill gets from one to the other.

Do the work. Ask only what the files cannot tell you.

`SITE` is the client's site folder, a copy of `site-starter`. `CONCEPT` is the approved concept folder from the homepage-concept skill (it has `index.html`, `images/`, `meta.json` and `research/`).

## Step 1: Confirm the inputs

1. Find `CONCEPT`. If there are several options (`option-a`, `option-b`), ask which one the client approved. Never guess.
2. If `SITE` does not exist, copy the kit's `3-build/site-starter` folder to a new folder named for the client and work there.
3. Read `CONCEPT/research/` notes and `client-brief.md` if present. Read `house-style.md` in the kit root if present: it is the agency's own rules and it wins over your defaults.
4. Ask once, in one message: the live domain, the page list if they have one, and where form submissions should go. If they have no page list, propose one in Step 2.

## Step 2: Plan the pages

List every page of the current site (its sitemap.xml, or the links in its menu and footer). For each one decide: keep, merge into another page, or drop. Write the plan to `SITE/PLAN.md` as a table: old address, new address, what the page is for, where its content comes from.

Rules:
- Every page needs one job and one main call to action.
- Real content only. Pull words, photos, names, prices and reviews from the current site and the brief. Where something is missing, write `NEEDS FROM CLIENT: <what>` in the plan instead of inventing it.
- Show the plan and wait for a yes before building more than the homepage.

## Step 3: Split the concept

1. Move the concept's colors, fonts and spacing into variables at the top of `src/public/assets/site.css`, then the rest of its styles below. Delete the starter's sample styles.
2. The concept's header becomes `src/partials/header.html`; its footer becomes `src/partials/footer.html`. Every menu link points at a real page from the plan.
3. The concept's body becomes `src/pages/index.html`, using the `<!-- include:head -->`, `<!-- include:header -->` and `<!-- include:footer -->` lines the starter shows.
4. Copy images to `src/public/assets/`. Keep each under 400 KB. Every image needs honest alt text.
5. Fill in `site.config.json`. Leave `"noindex": true`.

Run `node scripts/build.mjs`, open `dist/index.html` next to the concept, and fix any difference. The homepage must look the same as what the client approved.

## Step 4: Build the inner pages

One page at a time from the plan, each in `src/pages/<name>/index.html`. Reuse the homepage's sections and styles; do not invent a new look per page. Every page gets:

- a `<title>` under 60 characters that no other page shares, and a meta description under 160
- exactly one `<h1>`
- the page's main call to action in the first screen and again at the end

Add once, on the pages where it is true: `LocalBusiness` or `Organization` structured data on the homepage (name, address, phone and hours exactly as the client lists them), and `FAQPage` only where real questions and answers are on the page.

## Step 5: Protect the old site's traffic

In `src/public/_redirects`, add a `301` line for every old address in the plan that moved or merged. A launch without redirects throws away the client's search traffic.

## Step 6: Forms

Ask before choosing. The simple route is the form tool the client already pays for (their CRM's embed). If they have none, write a Pages Function in `functions/api/contact.js` that checks a Cloudflare Turnstile token and emails the submission. Never post a form to an address that is not theirs, and never put an API key in a page.

## Step 7: Check and preview

```
node scripts/build.mjs
node scripts/check.mjs
node scripts/deploy.mjs --preview
```

Fix every ✗ from the check. Then look at the preview on a phone-width and a desktop-width screen, and tab through it with the keyboard: every link and button must show a visible focus ring.

## Step 8: Report

Tell the person, in this order: the preview link, the pages built, everything marked `NEEDS FROM CLIENT`, and anything you guessed. Do not point a domain at the site or turn off `noindex`. That is launch day, and it is in the kit's `4-launch/LAUNCH-CHECKLIST.md`.
