# Make the kit yours

Work down this list once. After any change to a skill, run `node install-skills.mjs` again.

## 1. Your name and look (10 minutes)

| What | Where |
| --- | --- |
| Byline, logo, accent color and booking link on every before-and-after page | `agency.json` in your concepts folder (copy `2-concept/agency.example.json`) |
| Agency name shown on surveys | `client.agency` in `1-onboard/assessment-starter/public/client.config.json` |
| The name of the Cloudflare project your concepts publish to | `project` in `agency.json` |

## 2. Your rules (30 minutes)

Fill in `house-style.md`. Then copy your design rules to the bottom of `2-concept/homepage-concept/references/design-bar.md` under a heading with your agency's name, so the concept skill follows them too.

Things worth deciding now: the fonts you use, whether stock photos are ever allowed, how your calls to action are worded, and what every site you build must include.

## 3. Your questions (30 minutes)

`1-onboard/assessment-starter/public/client.config.json` is a sample website assessment for a local business. Make versions for the kinds of clients you serve and keep them in an `examples/` folder:

- the industries you work in (answer choices should use their words)
- the kinds of projects you sell (website rebuild, brand refresh, new-client intake)

Ask Claude: "Make a version of this assessment for a `<kind of client>` `<kind of project>`." Then run `node scripts/check-config.mjs` on it.

## 4. Your platform

The site starter is plain HTML on Cloudflare Pages. If you build on WordPress, Webflow or something else, keep steps 1, 2, 5 and 6 as they are and change `3-build/skills/concept-to-site/SKILL.md` to describe your build. The page plan and the redirects in that skill apply on every platform.

## 5. Your offer

Decide and write down:

- what the concept costs (free to win work, or paid discovery)
- what the monthly plan includes and what is extra (`5-maintain/README.md`)
- whose Cloudflare account hosts client sites (`4-launch/README.md`)

## 6. Keep your copy

Put this whole folder in a private GitHub repo of your own. When you improve a skill, commit it. That repo is now your agency's process.
