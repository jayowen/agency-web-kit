// Builds src/ into dist/: fills the shared header, footer and head into every page,
// copies src/public as is, and writes sitemap.xml and robots.txt.
// Usage: node scripts/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"));
site.url = site.url.replace(/\/$/, "");
const src = path.join(root, "src"), dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(src, "public"), dist, { recursive: true });

const partials = Object.fromEntries(fs.readdirSync(path.join(src, "partials"))
  .map((f) => [path.basename(f, ".html"), fs.readFileSync(path.join(src, "partials", f), "utf8").trim()]));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

const urls = [];
for (const file of walk(path.join(src, "pages"))) {
  const rel = path.relative(path.join(src, "pages"), file).split(path.sep).join("/");
  const out = path.join(dist, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (!rel.endsWith(".html")) { fs.copyFileSync(file, out); continue; }
  const pagePath = "/" + rel.replace(/index\.html$/, "").replace(/\.html$/, "");
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<!--\s*include:([\w-]+)\s*-->/g, (m, name) => {
    if (!(name in partials)) { console.error(`${rel}: no partial named "${name}"`); process.exit(1); }
    return partials[name];
  });
  html = html.replaceAll("{{site.name}}", site.name).replaceAll("{{site.url}}", site.url)
    .replaceAll("{{site.description}}", site.description || "").replaceAll("{{page.path}}", pagePath)
    .replaceAll("{{year}}", String(new Date().getFullYear()));
  const left = html.match(/\{\{[^}]+\}\}/);
  if (left) { console.error(`${rel}: unknown placeholder ${left[0]}`); process.exit(1); }
  fs.writeFileSync(out, html);
  if (rel !== "404.html" && !/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) urls.push(pagePath);
}

urls.sort();
fs.writeFileSync(path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${site.url}${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
// "noindex": true keeps a preview out of Google. Set it to false in site.config.json on launch day.
fs.writeFileSync(path.join(dist, "robots.txt"), site.noindex
  ? "User-agent: *\nDisallow: /\n"
  : `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
if (site.noindex) fs.appendFileSync(path.join(dist, "_headers"), "\n/*\n  X-Robots-Tag: noindex\n");
console.log(`Built ${urls.length} pages into dist/${site.noindex ? " (noindex is ON: search engines are told to stay out)" : ""}`);
