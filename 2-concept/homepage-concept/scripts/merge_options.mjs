// Merge a multi-option run into one meta.json.  Usage: node merge_options.mjs DIR
// Reads DIR/meta.json (written by the research agent) and DIR/research/option-*.json (one per option).
// Option A becomes the main concept (DIR/concept, DIR/after). Every option, A included, is listed in
// meta.options with its own paths, so the before/after page can show Option A / B / C tabs.
// Sets status to "done" only when every option has a concept page and screenshots.
import fs from "node:fs";
import path from "node:path";

const d = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(path.join(d, "meta.json"))) { console.error("usage: node merge_options.mjs DIR  (DIR must hold meta.json)"); process.exit(1); }
const meta = JSON.parse(fs.readFileSync(path.join(d, "meta.json"), "utf8"));
const research = path.join(d, "research");
const opts = [];
for (const f of fs.readdirSync(research).filter((x) => /^option-.*\.json$/.test(x)).sort()) {
  const o = JSON.parse(fs.readFileSync(path.join(research, f), "utf8"));
  const letter = String(o.option || f.replace(/^option-|\.json$/g, "")).toLowerCase();
  if (!/^[a-z]$/.test(letter)) { console.error(`skipping ${f}: option must be one letter`); continue; }
  const base = letter === "a" ? "" : `options/${letter}/`;
  o.option = letter.toUpperCase();
  o.concept = `${base}concept/index.html`;
  o.after = { desktop: `${base}after/desktop.jpg`, mobile: `${base}after/mobile.jpg` };
  o.ready = [o.concept, o.after.desktop, o.after.mobile].every((p) => fs.existsSync(path.join(d, p)));
  opts.push(o);
}
if (!opts.length) { console.error("no research/option-*.json files found"); process.exit(1); }
opts.sort((a, b) => a.option.localeCompare(b.option));
const main = opts[0];
for (const k of ["tagline", "design_thesis", "archetype", "hero", "nav", "footer", "sections", "ground", "palette", "fonts", "changes", "one_liner", "primary_action", "conversion", "concept", "after"]) {
  if (k in main) meta[k] = main[k];
}
meta.options = opts.map(({ ready, ...o }) => o);
meta.before ??= { desktop: "before/desktop.jpg", mobile: "before/mobile.jpg" };
meta.created ??= new Date().toISOString().slice(0, 10);
const missing = opts.filter((o) => !o.ready).map((o) => o.option);
meta.status = missing.length ? "pending" : "done";
fs.writeFileSync(path.join(d, "meta.json"), JSON.stringify(meta, null, 2));
console.log(`${opts.length} options merged` + (missing.length ? `; not ready: ${missing.join(", ")}` : "; status done"));
