// Checks dist/ before it goes live. No browser needed.
// Fails on: broken internal links, missing or duplicate titles, missing descriptions,
// pages without exactly one h1, images without alt, leftover sample text.
// Usage: node scripts/check.mjs
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
if (!fs.existsSync(dist)) { console.error("No dist/ folder. Run: node scripts/build.mjs"); process.exit(1); }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(dist);
const pages = files.filter((f) => f.endsWith(".html"));
const exists = (urlPath) => {
  const p = path.join(dist, decodeURIComponent(urlPath));
  return fs.existsSync(p) && (fs.statSync(p).isFile() || fs.existsSync(path.join(p, "index.html")));
};
const redirects = fs.existsSync(path.join(dist, "_redirects"))
  ? fs.readFileSync(path.join(dist, "_redirects"), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.trim().split(/\s+/)[0])
  : [];
const errs = [], warns = [], titles = new Map();

for (const file of pages) {
  const rel = "/" + path.relative(dist, file).split(path.sep).join("/");
  const html = fs.readFileSync(file, "utf8");
  const here = rel.replace(/[^/]*$/, "");
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim();
  const noindex = /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html);
  if (!title) errs.push(`${rel}: no <title>`);
  else {
    if (titles.has(title)) errs.push(`${rel}: same title as ${titles.get(title)}`);
    titles.set(title, rel);
    if (title.length > 65) warns.push(`${rel}: title is ${title.length} characters; Google cuts it near 60`);
  }
  if (!noindex) {
    if (!desc) errs.push(`${rel}: no meta description`);
    else if (desc.length > 165) warns.push(`${rel}: description is ${desc.length} characters; keep it under 160`);
  }
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1 !== 1) errs.push(`${rel}: has ${h1} h1 headings; needs exactly one`);
  if (!/<html[^>]+lang=/i.test(html)) errs.push(`${rel}: <html> has no lang`);
  for (const img of html.match(/<img\b[^>]*>/gi) || [])
    if (!/\balt=/.test(img)) errs.push(`${rel}: image without alt: ${img.slice(0, 80)}`);
  if (/Replace this page with the real one|Sample Client Co\.|lorem ipsum/i.test(html)) warns.push(`${rel}: still has sample text`);
  for (const m of html.matchAll(/\b(?:href|src)=["']([^"'#?]+)[^"']*["']/gi)) {
    const u = m[1];
    if (/^(https?:|mailto:|tel:|data:|\/\/)/i.test(u)) continue;
    const target = u.startsWith("/") ? u : path.posix.join(here, u);
    if (!exists(target) && !redirects.includes(target.replace(/\/$/, "")) && !target.startsWith("/api/") && !target.startsWith("/cdn-cgi/"))
      errs.push(`${rel}: broken link ${u}`);
  }
}
for (const f of files) {
  const kb = fs.statSync(f).size / 1024;
  if (/\.(jpe?g|png|webp|avif|gif)$/i.test(f) && kb > 400) warns.push(`/${path.relative(dist, f).split(path.sep).join("/")}: ${Math.round(kb)} KB image; aim for under 400`);
}
if (!fs.existsSync(path.join(dist, "404.html"))) errs.push("no 404.html");
if (!fs.existsSync(path.join(dist, "_headers"))) errs.push("no _headers file (security headers)");

for (const w of warns) console.log(`! ${w}`);
for (const e of errs) console.log(`✗ ${e}`);
console.log(errs.length ? `\n${errs.length} to fix before this goes live.` : `✓ ${pages.length} pages checked${warns.length ? `, ${warns.length} to look at` : ""}`);
process.exit(errs.length ? 1 : 0);
