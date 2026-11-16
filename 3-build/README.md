# 3. Build: from approved concept to real site

The concept sold the idea. Now it has to become a site with real pages.

1. Copy `site-starter` to a new folder named for the client and open it in Claude Code.
2. Ask: "The client approved the concept in `<concept folder>`. Build the site from it."
3. The **concept-to-site** skill plans the pages, waits for your yes, then builds them.

## What the starter gives you

| File | What it does |
| --- | --- |
| `site.config.json` | The site's name, live address, Cloudflare project name and the noindex switch |
| `src/pages/` | One folder per page |
| `src/partials/` | The header, footer and head every page shares. Change it once, every page changes |
| `src/public/` | Images, styles, security headers (`_headers`), redirects (`_redirects`) |
| `scripts/build.mjs` | Puts it together in `dist/` and writes the sitemap and robots.txt |
| `scripts/check.mjs` | Stops a launch with broken links, missing titles or descriptions, images without alt text |
| `scripts/deploy.mjs` | Sends it to Cloudflare Pages. Add `--preview` for a link to show the client |

No framework and nothing to install besides Node. Four commands:

```
npm run build      put the site together
npm run check      build, then look for problems
npm run preview    build, then open it on your own computer
npm run deploy     build, check, and go live
```

If your agency builds on something else (WordPress, Webflow, Astro), keep the skill's Steps 1, 2 and 5: the page plan and the redirects matter on every platform.
