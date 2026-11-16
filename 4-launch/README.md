# 4. Launch: how the hosting works

Everything in this kit is hosted the same way, on Cloudflare Pages. Learn it once.

## The pieces

- **A Pages project** is one website. The assessment is one project, your concept gallery is one, each client site is one.
- **A deploy** uploads a folder of files. Each deploy gets its own address, and the newest one on the `main` branch is the live site.
- **`<project>.pages.dev`** is the free address every project gets. It is fine for assessments, concepts and previews.
- **A custom domain** is the client's real address. You attach it to the project on launch day.
- **The free plan** is enough for everything in this kit.

## Two ways to deploy

| | From your laptop | From GitHub |
| --- | --- | --- |
| How | `npm run deploy` | Push to `main`; `.github/workflows/deploy.yml` does the rest |
| Good for | Workshop day, quick previews | Every real client site |
| Needs | `npx wrangler login` once | Two repo secrets (below) |

For GitHub deploys, in the repo go to **Settings > Secrets and variables > Actions** and add:

- `CLOUDFLARE_ACCOUNT_ID`: on the right side of your Cloudflare dashboard home.
- `CLOUDFLARE_API_TOKEN`: Cloudflare dashboard > My Profile > API Tokens > Create Token > Create Custom Token. Give it **Account > Cloudflare Pages > Edit**, plus **Account > D1 > Edit** for the assessment.

A token is a password. It goes in GitHub secrets and nowhere else.

## Whose Cloudflare account?

Decide this before you sell it. Two honest options:

1. **Your agency's account, one project per client.** Simplest to run. You own the hosting, so say so in your contract and have an exit plan for the client.
2. **The client's own account, with you added as a member.** They own it. More setup, cleaner handoff.

## Launch day

Work through `LAUNCH-CHECKLIST.md`, top to bottom, every time.
