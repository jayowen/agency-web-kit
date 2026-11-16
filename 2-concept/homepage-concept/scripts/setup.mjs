// One-time setup (safe to re-run). Works on macOS, Windows and Linux; needs only Node.js 18+.
// Copies the tools to ~/.homepage-concept/tools, installs Playwright there, and makes sure a
// browser is available. The LAST line it prints is the tools folder.
// Usage: node setup.mjs
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const major = Number(process.versions.node.split(".")[0]);
if (major < 18) {
  console.error(`Node.js 18 or newer is required (this is ${process.versions.node}). Install the LTS from https://nodejs.org`);
  process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const tools = process.env.HOMEPAGE_CONCEPT_TOOLS || path.join(os.homedir(), ".homepage-concept", "tools");
fs.mkdirSync(tools, { recursive: true });
for (const f of fs.readdirSync(here)) {
  if (/\.(mjs|json|css|js)$/.test(f)) fs.copyFileSync(path.join(here, f), path.join(tools, f));
}
const run = (cmd) => execSync(cmd, { cwd: tools, stdio: ["ignore", "ignore", "inherit"] });
if (!fs.existsSync(path.join(tools, "node_modules", "playwright"))) {
  console.error("Installing Playwright (one time, about a minute)...");
  run("npm install --silent --no-audit --no-fund");
}
// Real Google Chrome plays video heroes. If it is not installed, fall back to Playwright's Chromium.
const { chromium } = await import(pathToFileURL(path.join(tools, "node_modules", "playwright", "index.mjs")).href);
let ok = false;
for (const opts of [{ channel: "chrome" }, {}]) {
  try { const b = await chromium.launch(opts); await b.close(); ok = true; break; } catch {}
}
if (!ok) {
  console.error("No browser found. Downloading Chromium (one time)...");
  run("npx playwright install chromium");
}
console.log(tools);
