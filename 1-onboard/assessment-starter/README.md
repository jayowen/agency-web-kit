# Assessment starter

A stakeholder survey and a results dashboard for one client. Cloudflare Pages hosts it, Pages Functions are the API, and a D1 database stores the answers. No build step and nothing to install besides Node.

Setup is in `../README.md`. This page is the reference.

## What is where

```
public/client.config.json   the whole survey: questions, colors, logo, deadline
public/assets/              the client's logo goes here as client-logo.svg
functions/api/              the API (submit, dashboard data, tagging)
functions/api/_segments.js  optional list of known decision makers (private)
schema.sql                  the two database tables
setup.mjs                   one command to put a new copy online
scripts/                    check-config, seed-demo, export-brief
.github/workflows/          deploy on push, nightly backup, weekly health check
```

## Running it on your own computer

```
npx wrangler d1 execute <client-slug>-assessment --local --file=schema.sql
npx wrangler pages dev
```

For the dashboard locally, `.dev.vars` needs `ADMIN_PASSWORD=...` (setup.mjs writes it). `.dev.vars` is local only. Never commit it.

## Automatic deploys and upkeep

Push the folder to a private GitHub repo, then in **Settings > Secrets and variables > Actions** add:

- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Variables: `PAGES_PROJECT` = `<client-slug>-assessment`, `SITE_URL` = your survey link

Every push to `main` then deploys, every night the answers are backed up, and every Monday the survey is checked. A failed check opens a GitHub issue.

## Using the dashboard

**Segment filter.** The control bar at the top drives every chart on every view.
Pick All, Voice, Vote, Veto, or Custom. Custom opens a checkbox list so you can
hand-pick any subset. Role and tenure dropdowns narrow further. The
"compare against everyone" toggle draws a second series on every chart so you can
see the segment against the full population at a glance.

**Tagging.** On the Responses tab, click the tag chips on any row. Tags save
immediately. Nothing about tags is ever visible to respondents.

**Consensus.** Scores every question 0 to 100 for agreement and sorts into
Settled, Leaning, and Needs discussion. When a segment is active it also flags
where that segment diverges from everyone. That divergence list is the agenda for
the results call.

**Report.** Print from the browser. All dashboard chrome is hidden, the active
segment is named on the cover, and it comes out Letter size and presentable.

## Adding a question

Add an object to the right section in `client.config.json`. No code changes.
Supported `type` values, with the shape each one stores:

| type | stores |
| --- | --- |
| `identity_name`, `identity_email` | string, into the respondent record |
| `identity_select` | string, options from `config[options_from]` |
| `text`, `textarea`, `sentence` | string |
| `rating` | number between `min` and `max` |
| `slider_pair` | `{ current, desired }`, each 1 to 7 |
| `wordbank` | array of exactly `count` strings, write-ins allowed |
| `ab_pair` | the chosen option's `id` |
| `palette_grid` | array of palette ids, `min` to `max` |
| `multi_select` | array of option ids, exactly `count` |
| `image_pick` | array of chosen tile ids, `min` to `max`. A gallery grid of style tiles. Each tile carries one or two `families`, and the dashboard reports by family first |
| `repeater` | array of objects keyed by sub-field |

Set `"randomize": true` on a section to shuffle its questions and flip the sides
of A/B pairs. Answers always store by option id, never by position, so
randomizing never corrupts the data.


Set `"negative": true` on a wordbank to have the dashboard render it in the alert
color as a "never" list.

## Notes

- Duplicate submissions are blocked by email. To reopen one for someone, delete
  their row on the Responses tab and they can submit again.
- Survey answers autosave to the respondent's browser, so a half-finished form
  survives a closed tab.
- The survey never displays any individual's name, role, or title from the client
  organization, and nothing in it signals that some responses carry more weight.
  All of that lives in the admin only.
