// Checks the live site: every page in the sitemap answers, security headers are present,
// and the homepage is not slow. Usage: node scripts/live-check.mjs [url]
import fs from "node:fs";

const site = JSON.parse(fs.readFileSync("site.config.json", "utf8"));
const base = (process.argv[2] || site.url).replace(/\/$/, "");
const errs = [];
const get = async (u) => { const t = Date.now(); const r = await fetch(u, { redirect: "follow" }); const text = await r.text(); return { r, text, ms: Date.now() - t }; };

let home;
try { home = await get(base + "/"); } catch (e) { console.error(`✗ ${base} did not answer: ${e.message}`); process.exit(1); }
if (!home.r.ok) errs.push(`homepage answered ${home.r.status}`);
if (home.ms > 3000) errs.push(`homepage took ${home.ms} ms`);
for (const h of ["strict-transport-security", "x-content-type-options", "referrer-policy"])
  if (!home.r.headers.get(h)) errs.push(`missing security header: ${h}`);
if (!site.noindex && /noindex/i.test(home.r.headers.get("x-robots-tag") || "")) errs.push("the live site is telling search engines to stay out");

const map = await get(base + "/sitemap.xml").catch(() => null);
const urls = map?.r.ok ? [...map.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : [];
if (!urls.length) errs.push("no sitemap.xml, or it is empty");
for (const u of urls) {
  const live = u.replace(site.url.replace(/\/$/, ""), base);
  try { const { r } = await get(live); if (!r.ok) errs.push(`${live} answered ${r.status}`); } catch (e) { errs.push(`${live}: ${e.message}`); }
}
for (const e of errs) console.log(`✗ ${e}`);
console.log(errs.length ? `\n${errs.length} problems on ${base}` : `✓ ${base}: ${urls.length} pages up, headers in place, homepage ${home.ms} ms`);
process.exit(errs.length ? 1 : 0);
