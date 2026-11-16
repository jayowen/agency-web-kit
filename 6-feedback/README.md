# 6. Feedback: collecting what the client thinks

Two kinds of feedback, two tools.

## Before the build: what the whole team thinks of the concept

Use the assessment. The sample survey already has a "Homepage concept" section with a link to the concept and three questions. Put your published concept link in `public/client.config.json` (the `link.href` on the `concept_score` question), send the survey, and read the scores by team in the dashboard.

Then run this in the assessment folder to hand the answers back to the build:

```
node scripts/export-brief.mjs https://<project>.pages.dev > client-brief.md
```

## During the build: notes on a specific page

Send the preview link (`node scripts/deploy.mjs --preview`) and ask for notes by page. A page-pinned feedback tool belongs here; this section of the kit is waiting on which tool your host uses, and will be filled in before the workshop.
