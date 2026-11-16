---
name: assessment-builder
description: "Builds a custom stakeholder assessment (client.config.json) for the Agency Web Kit assessment starter: interviews you about the client and project, writes the sections and questions using only supported question types, checks the config, and previews it in review mode. Use when someone says 'build an assessment', 'new client assessment', 'make a survey for [client]', 'website assessment for [client]', 'brand assessment for [client]', or 'customize client.config.json'."
metadata:
  owner: Jay Owen
  version: 0.1.0
  created: 2026-11-09
---

# Assessment Builder

Turn a short conversation about a client into a ready-to-send stakeholder assessment.
The output is one file: `public/client.config.json`. The survey and dashboard render
entirely from it, so no code changes.

## 1. Interview (ask in one message, accept short answers)

1. Client name, website URL, and a one-line description.
2. What is the project? (website rebuild, brand refresh, campaign, intake, other)
3. Who will take it? Their areas/departments (becomes `roles`) and how long they've been there (becomes `tenures`).
4. The 3 to 5 decisions this assessment must settle. Every section should serve one of them.
5. Brand colors (hex) and logo file, or the URL so you can pull them from the site.
6. Deadline for responses.
7. Any concept, page, or competitor you want people to react to (becomes a question `link`).

If they give a URL, read the site first and propose answers to 1, 5 and 7 instead of asking.

## 2. Write the config

Start from `public/client.config.json` in a copy of the assessment starter (`1-onboard/assessment-starter` in https://github.com/jayowen/agency-web-kit). If you are not inside a copy, clone the kit and copy that folder to `<client>-assessment` first. Keep its shape. Rules:

- Section 1 is always identity: `identity_name`, `identity_email`, then `identity_select` for role and tenure, all `required: true`.
- 6 to 9 sections total, 10 minutes to complete. Count roughly 20 seconds per click question and 60 per open text question; stay under 10 minutes.
- One section per decision from the interview. Mix types so it doesn't feel like homework: at most 3 `textarea` in a row.
- Supported types only: `text`, `textarea`, `sentence`, `rating`, `slider_pair`, `wordbank`, `ab_pair`, `palette_grid`, `multi_select`, `image_pick`, `repeater`. Shapes are in the README table.
- `wordbank`: 16 to 24 words, `count` 3 to 5, `allowWriteIn: true`. Pair a positive bank with a `negative: true` "never" bank.
- `slider_pair`: two honest opposites, neither one the "right" answer (Warm / Polished, not Good / Bad).
- `multi_select` and `wordbank` have exact counts. Say the count in the label or helper.
- Use the client's own language from the interview in answer choices.
- Never name a person, title, or "whose vote counts" in survey copy. Weighting lives in `functions/api/_segments.js` and dashboard tags only.
- `reviewMode: true` while drafting.
- Theme: six hex colors (`ink`, `accent`, `support`, `paper`, `soft`, `alert`). Check `ink` on `paper` reads clearly.

## 3. Check and preview

1. Run `node scripts/check-config.mjs public/client.config.json` and fix every ✗.
2. Run `npx wrangler pages dev` and click through the whole survey in review mode.
3. Optional: `node scripts/seed-demo.mjs 20 > seed.sql` and load it locally to see the dashboard with data.
4. Report back: section list with time estimate, which decision each section serves, and anything you guessed.

## 4. Go live (only when the person says so)

Set `reviewMode` to `false`, set the deadline, and deploy (push to `main`, or `node setup.mjs <slug>` the first time).
Remind them that dashboard passwords belong in a password manager, never in the repo or an email.
