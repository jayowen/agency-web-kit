// Start a concept folder.  Usage: node new_concept.mjs <workspace> <url> [Company Name] [--force]
// Prints JSON: slug, name, url, dir. Exits with EXISTS if the folder already has a concept (use --force to redo).
import fs from "node:fs";
import path from "node:path";

const force = process.argv.includes("--force");
const args = process.argv.slice(2).filter((a) => a !== "--force");
if (args.length < 2) { console.error("usage: node new_concept.mjs <workspace> <url> [Company Name] [--force]"); process.exit(1); }
const ws = path.resolve(args[0].replace(/^~(?=$|[\\/])/, process.env.HOME || process.env.USERPROFILE || "~"));
const url = /^https?:\/\//.test(args[1]) ? args[1] : "https://" + args[1];
const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
const title = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const name = args.slice(2).join(" ").trim() || title(host.split(".")[0]);
const slug = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const dir = path.join(ws, slug);
if (fs.existsSync(path.join(dir, "meta.json")) && !force) {
  console.error(`EXISTS: ${dir} already has a concept. Re-run with --force to redo it.`);
  process.exit(1);
}
for (const sub of ["research/raw", "before", "after", "concept/assets"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
console.log(JSON.stringify({ slug, name, url, dir }));
