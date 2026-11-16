// Deploys dist/ to Cloudflare Pages. Run `npx wrangler login` once first.
// Usage: node scripts/deploy.mjs [--preview]
//   default: production (the live address)      --preview: a throwaway address to show the client
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const site = JSON.parse(fs.readFileSync("site.config.json", "utf8"));
const project = site.pagesProject;
if (!/^[a-z0-9][a-z0-9-]{1,57}$/.test(project || "")) { console.error('Set "pagesProject" in site.config.json (lowercase letters, numbers, dashes).'); process.exit(1); }
const win = process.platform === "win32";
const wr = (args, opts = {}) => spawnSync(win ? "npx.cmd" : "npx", ["--yes", "wrangler@4", ...args], { shell: win, ...opts });
const branch = process.argv.includes("--preview") ? "preview" : "main";

wr(["pages", "project", "create", project, "--production-branch", "main"], { stdio: "ignore" }); // harmless if it exists
const r = wr(["pages", "deploy", "dist", "--project-name", project, "--branch", branch, "--commit-dirty=true"], { stdio: "inherit" });
if (r.status !== 0) process.exit(r.status || 1);
console.log(branch === "main"
  ? `\nLive at https://${project}.pages.dev (Cloudflare adds a suffix if the name was taken; the line above has the exact address).`
  : "\nPreview deployed. The address is in the line above.");
if (site.noindex) console.log('Search engines are blocked ("noindex": true). Set it to false on launch day and deploy again.');
