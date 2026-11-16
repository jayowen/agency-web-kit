# 6. Feedback: collecting what the client thinks

Two kinds of feedback, two tools.

## Before the build: what the whole team thinks of the concept

Use the assessment. The sample survey already has a "Homepage concept" section with a link to the concept and three questions. Put your published concept link in `public/client.config.json` (the `link.href` on the `concept_score` question), send the survey, and read the scores by team in the dashboard.

Then run this in the assessment folder to hand the answers back to the build:

```
node scripts/export-brief.mjs https://<project>.pages.dev > client-brief.md
```

## During the build: notes on a specific page

Send the preview link (`node scripts/deploy.mjs --preview`) and ask for notes by page.

To let the client leave notes right on the site, add a feedback button with the `add-feedback-widget` skill. In Claude Code, inside the site's folder, type:

```
/add-feedback-widget
```

What it adds:

- A floating button on every page. It opens a short form: bug, feature request, or "please remove this", plus a comment.
- A screenshot of the page, taken when the form opens. The client can remove it before sending.
- The page address and screen size, saved with each note, so you know where they were.
- A private review page where you read every note and mark it reviewed, resolved, or dismissed.

Notes are saved to a real database, so you see them from any computer. On Cloudflare Pages the skill sets up a free D1 database for you. If the site has no login, the review page is locked with a private admin key (a long password) the skill helps you set.

The skill works with any kind of site. It asks a few setup questions first, then builds it, then checks that a test note really lands.

Turn the button off, or remove it, before the site launches unless the client wants to keep it.
