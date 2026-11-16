#!/usr/bin/env node
// Copies the kit's four skills into your Claude skills folder. Safe to run again after you edit them.
// Usage: node install-skills.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kit = path.dirname(fileURLToPath(import.meta.url));
const dest = path.join(os.homedir(), ".claude", "skills");
const skills = {
  "assessment-builder": "1-onboard/skills/assessment-builder",
  "homepage-concept": "2-concept/homepage-concept",
  "concept-to-site": "3-build/skills/concept-to-site",
  "add-feedback-widget": "6-feedback/add-feedback-widget",
};
fs.mkdirSync(dest, { recursive: true });
for (const [name, from] of Object.entries(skills)) {
  const to = path.join(dest, name);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(path.join(kit, from), to, { recursive: true, filter: (p) => !p.includes("node_modules") });
  console.log(`installed ${name}`);
}
console.log(`\nSkills are in ${dest}\nRestart Claude Code, then type / to see them.`);
