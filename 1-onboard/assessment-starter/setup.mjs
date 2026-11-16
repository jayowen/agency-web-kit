#!/usr/bin/env node
// One-command setup for a new client assessment on Cloudflare Pages + D1.
// Usage: node setup.mjs <client-slug>      e.g. node setup.mjs acme-website
// Needs: Node 18+, and `npx wrangler login` done once. Works on macOS, Windows and Linux.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";

const slug = process.argv[2] || "";
if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
  console.error("Usage: node setup.mjs <client-slug>  (lowercase letters, numbers, dashes)");
  process.exit(1);
}
const name = `${slug}-assessment`;
const win = process.platform === "win32";
const wr = (args, opts = {}) =>
  spawnSync(win ? "npx.cmd" : "npx", ["--yes", "wrangler@4", ...args], { encoding: "utf8", shell: win, ...opts });
const step = (m) => console.log(`==> ${m}`);
const die = (m, detail) => { console.error(m); if (detail) console.error(detail); process.exit(1); };
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

step("Checking Cloudflare login");
if (wr(["whoami"]).status !== 0) die("Not logged in. Run: npx wrangler login");

step("Checking client.config.json");
const chk = spawnSync(process.execPath, ["scripts/check-config.mjs", "public/client.config.json"], { stdio: "inherit" });
if (chk.status !== 0) die("Fix the config, then run this again.");

step(`Creating D1 database: ${name}`);
const created = wr(["d1", "create", name]);
let dbId = ((created.stdout || "") + (created.stderr || "")).match(UUID)?.[0];
if (!dbId) {
  // Already exists? Look it up.
  const list = wr(["d1", "list", "--json"]);
  try { dbId = JSON.parse(list.stdout).find((d) => d.name === name)?.uuid; } catch {}
}
if (!dbId) die(`Could not create or find database ${name}`, created.stdout + created.stderr);

step("Writing wrangler.toml");
fs.writeFileSync("wrangler.toml", `name = "${name}"
compatibility_date = "2026-08-01"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "${name}"
database_id = "${dbId}"

# Secrets live in Cloudflare, never in this file:
#   ADMIN_PASSWORD   full dashboard access, can delete
#   CLIENT_PASSWORD  view, print and tag, cannot delete
`);

step("Creating tables (local and remote)");
wr(["d1", "execute", name, "--local", "--file=schema.sql"], { stdio: "inherit" });
if (wr(["d1", "execute", name, "--remote", "--file=schema.sql", "--yes"], { stdio: "inherit" }).status !== 0)
  die("Could not create the tables in Cloudflare.");

step("Creating Pages project");
if (wr(["pages", "project", "create", name, "--production-branch", "main"]).status !== 0) console.log("   (project already exists)");

step("Setting dashboard passwords");
const gen = () => randomBytes(12).toString("base64url");
const adminPw = `${slug}-${gen()}`, clientPw = `${slug}view-${gen()}`;
for (const [key, val] of [["ADMIN_PASSWORD", adminPw], ["CLIENT_PASSWORD", clientPw]]) {
  const r = wr(["pages", "secret", "put", key, "--project-name", name], { input: val });
  if (r.status !== 0) die(`Could not set ${key}`, r.stderr);
}
fs.writeFileSync(".dev.vars", `ADMIN_PASSWORD=${adminPw}\nCLIENT_PASSWORD=${clientPw}\n`, { mode: 0o600 });

step("Deploying");
if (wr(["pages", "deploy", "public", "--project-name", name, "--branch", "main", "--commit-dirty=true"], { stdio: "inherit" }).status !== 0)
  die("Deploy failed. Read the message above, fix it, and run this again. It is safe to re-run.");

console.log(`
Done.
  Survey:     https://${name}.pages.dev/
  Dashboard:  https://${name}.pages.dev/admin.html

Your two dashboard passwords are in .dev.vars (git ignores it).
Save them in your password manager now. Do not paste them into email, Slack, or the repo.

Next: set "reviewMode": false in public/client.config.json when you are ready
to collect real answers, then push to main (or run this again).
`);
