# 2. Concept: show them the new homepage before they sign

The **homepage-concept** skill turns a URL into a finished homepage design with a before-and-after page. The full guide is `homepage-concept/README.md`.

In Claude Code, in a folder you keep for concepts:

```
/homepage-concept https://their-site.com
```

The first screen is ready to look at in about 15 minutes. A finished concept takes 30 to 60.

## Three things that make it yours

1. **Your name on it.** Copy `agency.example.json` into your concepts folder as `homepage-concepts/agency.json` and fill it in. Every before-and-after page then carries your byline and your booking link.
2. **What the client told you.** Save assessment results as `homepage-concepts/<company>/client-brief.md` (step 6 shows the one command that writes it). The skill reads it and designs from it.
3. **A link to send.** Say "publish the concept". It goes to Cloudflare Pages, hidden from search engines, without your other clients' names on it.

## Change how it designs

The quality rules live in `homepage-concept/references/design-bar.md`. It is plain English. Add your own rules at the bottom under a heading with your agency's name, then run `node install-skills.mjs` again from the kit folder.
