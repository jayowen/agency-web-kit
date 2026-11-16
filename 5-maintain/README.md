# 5. Maintain: the part clients pay for monthly

A site that nobody checks slowly breaks. This is the retainer, and most of it runs without you.

## What runs by itself

Both starters ship with a GitHub Action that needs no server:

| Where | When | What it checks | If it fails |
| --- | --- | --- | --- |
| Site (`site-starter/.github/workflows/maintenance.yml`) | Every Monday | Site is up, every page in the sitemap answers, security headers present, homepage speed, internal links, titles and descriptions | Opens a GitHub issue |
| Assessment (`assessment-starter/.github/workflows/maintenance.yml`) | Nightly and weekly | Backs up the answers; checks the survey is up and the dashboard is still locked | Opens a GitHub issue |

Turn it on by pushing the repo to GitHub and adding the two secrets from `4-launch/README.md`. Watch the repo so the issue reaches your inbox.

## What a person does each month

Ask Claude Code, in the client's site folder: "Run the monthly maintenance for this site." Give it this list, or save it as your own skill:

1. Run `npm run check` and `node scripts/live-check.mjs`; fix what fails.
2. Read the last month's open issues from the weekly check.
3. Check Search Console for new errors and pages that lost traffic.
4. Confirm hours, phone, staff and prices on the site still match reality (ask the client).
5. Make the changes the client asked for; deploy a preview; get a yes; deploy.
6. Write the client a five-line note: what was checked, what changed, what you recommend next.

Number 6 is what the client sees. Send it every month, even when nothing broke.

## Pricing it

Decide what is included (checks, small edits, the monthly note) and what is extra (new pages, redesigns). Write it down before the first invoice.
