# Agency Web Kit

Everything we use to take a client from first conversation to a live, maintained website, packaged so you can run it under your own agency's name.

From AI Web Build Day, November 16, 2026.

## The six steps

| | Step | What you end up with | Folder |
| --- | --- | --- | --- |
| 1 | **Onboard** | A survey the client's whole team fills in, and a dashboard showing where they agree | `1-onboard/` |
| 2 | **Concept** | A finished homepage design and a before-and-after page, from just their URL | `2-concept/` |
| 3 | **Build** | The real site: every page, shared header and footer, search basics, redirects | `3-build/` |
| 4 | **Launch** | The site live on Cloudflare at the client's domain | `4-launch/` |
| 5 | **Maintain** | Weekly automatic checks and a monthly routine you can bill for | `5-maintain/` |
| 6 | **Feedback** | The client's reactions, collected in one place and fed back into the build | `6-feedback/` |

Each folder has a README. Read them in order the first time.

## Set up once (15 minutes)

You need:

- [ ] [Claude Code](https://claude.com/claude-code), installed and signed in
- [ ] [Node.js](https://nodejs.org) 18 or newer. Check with `node -v`
- [ ] A free [Cloudflare](https://dash.cloudflare.com/sign-up) account
- [ ] A [GitHub](https://github.com) account
- [ ] Google Chrome (recommended)

Then, in a terminal in this folder:

```
node install-skills.mjs
npx wrangler login
```

The first line gives Claude Code three new skills. The second connects your computer to your Cloudflare account; it opens a browser, and you click Allow.

Restart Claude Code. Type `/` and you should see `assessment-builder`, `homepage-concept` and `concept-to-site`.

Everything here runs the same on a Mac and on Windows.

## Your first client, start to finish

1. **Concept first, to win the work.** In a folder you keep for concepts: `/homepage-concept https://their-site.com`. Publish it and send the link.
2. **They say yes. Onboard them.** Copy `1-onboard/assessment-starter`, ask Claude to build the assessment, run `node setup.mjs <client>`, send the survey link.
3. **Answers are in.** `node scripts/export-brief.mjs <survey-url> > client-brief.md`. Drop that file in the concept's folder and run the concept again if the answers changed the direction.
4. **Build.** Copy `3-build/site-starter`, ask Claude to build the site from the approved concept.
5. **Launch.** Work through `4-launch/LAUNCH-CHECKLIST.md`.
6. **Maintain.** Push to GitHub, add the two secrets, and the weekly checks start.

## Make it yours

`CUSTOMIZE.md` lists every place your agency's name, rules and prices go. Do that before your first real client.

## Three rules that keep you out of trouble

1. **Passwords and tokens never go in a repo, an email or a chat.** Password manager only.
2. **Real content only.** No invented reviews, numbers, people or awards. The skills refuse to; do not override them.
3. **Client repos are private.** Each client's survey answers and stakeholder list stay in that client's own private repo.
