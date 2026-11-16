// Publish concepts to Cloudflare Pages and print the links to send.
//
// Usage: node publish.mjs <workspace> [--project <name>] [--only <concept-folder>] [--with-index] [--dry-run]
//
// What it does:
//   1. Copies the finished concepts into <workspace>/.publish (research folders and agent briefs are left out).
//   2. Adds robots.txt and a _headers file so search engines never index the pages.
//   3. Leaves the list of every concept OFF the public site unless you pass --with-index, so one client
//      cannot browse the others. Each client only gets the link to their own page.
//   4. Deploys with Wrangler: `npx wrangler pages deploy`. You need a free Cloudflare account and to have
//      run `npx wrangler login` once. --dry-run stops before step 4.
//
// The project name defaults to agency.json's "project", else "<agency name>-concepts", else "homepage-concepts".
// Re-running updates the same site, so links you already sent keep working.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : ""; };
const has = (n) => args.includes("--" + n);
const ws = path.resolve(args.find((x, i) => !x.startsWith("--") && !["--project", "--only"].includes(args[i - 1])) || "");
if (!args.length || !fs.existsSync(ws)) { console.error("usage: node publish.mjs <workspace> [--project <name>] [--only <concept-folder>] [--with-index] [--dry-run]"); process.exit(1); }
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const agency = readJSON(path.join(ws, "agency.json")) || {};
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
const project = slugify(flag("project") || agency.project || (agency.name ? `${agency.name}-concepts` : "homepage-concepts"));
const only = flag("only");

const dist = path.join(ws, ".publish");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const SKIP = new Set(["research", "node_modules", ".publish", ".git", ".wrangler"]);
function copy(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(ent.name) || ent.name.startsWith(".")) continue;
    const s = path.join(src, ent.name), d = path.join(dest, ent.name);
    if (ent.isDirectory()) copy(s, d); else fs.copyFileSync(s, d);
  }
}
const published = [];
for (const name of fs.readdirSync(ws).sort()) {
  if (only && name !== only) continue;
  const m = readJSON(path.join(ws, name, "meta.json"));
  if (!m || m.status !== "done") continue;
  if (!fs.existsSync(path.join(ws, name, "index.html"))) { console.error(`skip ${name}: no before/after page yet; run make_compare.mjs first`); continue; }
  copy(path.join(ws, name), path.join(dist, name));
  // meta.json holds the notes the pages already show; it is not needed online.
  fs.rmSync(path.join(dist, name, "meta.json"), { force: true });
  published.push([name, m.name || name]);
}
if (!published.length) { console.error(only ? `no finished concept named "${only}" in ${ws}` : `no finished concepts in ${ws}`); process.exit(1); }
if (agency.logo && fs.existsSync(path.join(ws, agency.logo))) fs.copyFileSync(path.join(ws, agency.logo), path.join(dist, path.basename(agency.logo)));
if (has("with-index") && fs.existsSync(path.join(ws, "index.html"))) fs.copyFileSync(path.join(ws, "index.html"), path.join(dist, "index.html"));
else fs.writeFileSync(path.join(dist, "index.html"), '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Concepts</title><p style="font:16px system-ui;margin:15vh auto;max-width:30ch;text-align:center">Please use the link you were sent.</p>');
fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nDisallow: /\n");
fs.writeFileSync(path.join(dist, "_headers"), "/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Content-Type-Options: nosniff\n");
const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, x) => n + (x.isDirectory() ? count(path.join(d, x.name)) : 1), 0);
console.log(`ready: ${published.length} concept(s), ${count(dist)} files in ${dist.replace(/\\/g, "/")}`);
if (has("dry-run")) { console.log("dry run: nothing was deployed"); process.exit(0); }

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const shell = process.platform === "win32";
// Create the Pages project the first time (this fails harmlessly when it already exists).
spawnSync(npx, ["--yes", "wrangler@4", "pages", "project", "create", project, "--production-branch", "main"], { stdio: "ignore", shell });
let out = "";
try {
  out = execFileSync(npx, ["--yes", "wrangler@4", "pages", "deploy", dist, "--project-name", project, "--branch", "main", "--commit-dirty=true"], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"], shell });
} catch (err) {
  console.error("\nThe deploy did not finish. The usual causes: you have not run `npx wrangler login` yet, or the browser sign-in was not approved. Run it, then run this again.");
  process.exit(1);
}
process.stdout.write(out);
// Wrangler prints a one-off preview address; the stable one is <project>.pages.dev (Cloudflare adds a suffix when the name is taken).
const preview = (out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.pages\.dev/) || [""])[0];
const base = preview ? "https://" + preview.split(".").slice(1).join(".") : `https://${project}.pages.dev`;
console.log("\nLinks to send (hidden from search engines):");
for (const [slug, name] of published) console.log(`- ${name}: ${base}/${slug}/`);
if (has("with-index")) console.log(`- Every concept: ${base}/`);
