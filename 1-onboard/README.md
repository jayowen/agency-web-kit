# 1. Onboard: ask the client's whole team, once

A survey you send to everyone with a stake in the website, and a dashboard that shows where they agree, where they split, and whose opinion carries a veto. It replaces three discovery meetings.

Each client gets their own copy: one small website and one database on Cloudflare, both free.

## Make one

1. Copy the `assessment-starter` folder to a new folder named `<client>-assessment` and open it in Claude Code.
2. Ask: "Build a website assessment for `<client name>`, `<their URL>`."
   The **assessment-builder** skill asks a few questions and writes `public/client.config.json`. That one file is the whole survey: questions, colors, logo, deadline.
3. Put it online:

```
npx wrangler login            (once; opens your browser)
node setup.mjs <client-slug>  (for example: node setup.mjs acme-website)
```

It prints the survey link and the dashboard link.

## Passwords

`setup.mjs` makes two and saves them in `.dev.vars`, which git ignores. Move them to your password manager right away.

| Login | Can do |
| --- | --- |
| Admin | Everything, including delete |
| Client | View, print and tag. Cannot delete. Give this one to your client. |

Never put a password in the repo, an email or a chat message.

## Before you send the link

- [ ] Opened the survey on a phone and clicked through all of it
- [ ] `"reviewMode": false` in `public/client.config.json` (while it is `true`, nothing is saved)
- [ ] Deployed again after that change (`node setup.mjs <client-slug>` is safe to re-run)

## Useful extras

| Command | What it does |
| --- | --- |
| `node scripts/check-config.mjs public/client.config.json` | Finds mistakes in the survey file |
| `node scripts/seed-demo.mjs 20 > seed.sql` | Sample answers, so you can demo the dashboard before real ones arrive |
| `node scripts/export-brief.mjs <survey-url> > client-brief.md` | Writes the answers up as a brief for the concept and the build |

`functions/api/_segments.js` can tag known decision makers automatically. It holds real people's emails, so keep each client's copy in that client's private repo only.
