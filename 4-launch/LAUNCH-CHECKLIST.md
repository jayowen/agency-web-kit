# Launch checklist

Copy this file into the client's site folder and tick it off. Do not skip lines because the site is small.

## The week before

- [ ] Client has approved every page in writing
- [ ] Nothing is still marked `NEEDS FROM CLIENT` in `PLAN.md`
- [ ] `npm run check` passes with no ✗
- [ ] Every form has been submitted once and the client received it
- [ ] Phone number, address and hours match their Google Business Profile exactly
- [ ] `_redirects` has a line for every old address that moved (check the old sitemap and the top pages in Search Console)
- [ ] Looked at every page on a real phone
- [ ] Tabbed through the homepage with a keyboard; focus is always visible
- [ ] Privacy policy is linked in the footer; any tracking is disclosed
- [ ] You know who controls the domain's DNS and have a login that works
- [ ] The old site is backed up

## Launch day

- [ ] Lower the DNS TTL an hour ahead if the DNS host allows it
- [ ] In `site.config.json` set `"noindex": false` and `"url"` to the real address
- [ ] `npm run deploy`
- [ ] Cloudflare > the Pages project > Custom domains > add the domain (both `www` and the bare domain) and follow the DNS steps shown
- [ ] Wait for the certificate to show Active, then load the site at the real address
- [ ] `node scripts/live-check.mjs` passes
- [ ] Test three old addresses; each lands on the right new page
- [ ] Submit a form on the live site

## The day after

- [ ] Add the property in Google Search Console and submit `/sitemap.xml`
- [ ] Analytics is recording visits
- [ ] Check securityheaders.com and PageSpeed Insights; save both results for the client
- [ ] Add the GitHub secrets so pushes deploy and the weekly check runs
- [ ] Tell the client it is live, what to watch, and how to ask for changes
