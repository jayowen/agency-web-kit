// Fill a subagent brief for the homepage-concept skill and save it in the concept's research folder.
//
// One option (the default), hero first:
//   node fill_prompt.mjs build    --dir DIR --name NAME --url URL --tools TOOLS [--notes "..."] [--brief FILE]   research, plan, hero only
//   node fill_prompt.mjs hero     ...   fresh-eyes review of the hero alone
//   node fill_prompt.mjs finish   ...   the rest of the page, meta.json
//   node fill_prompt.mjs director ...   art direction of the whole page
//
// Several options (built in parallel from one shared research pass):
//   node fill_prompt.mjs research ...
//   node fill_prompt.mjs option   ... --option b --count 3 --assign "archetype, hero, nav, footer, fonts, idea" --siblings "A: ..., C: ..."
//   node fill_prompt.mjs hero | finish | director ... --option b --count 3
//
// --brief FILE adds a client brief to every agent: assessment results, discovery notes, a list of
// reviews or numbers. Real material from the client outranks anything scraped.
//
// Option A lives at DIR/concept and DIR/after. Options B, C, ... live at DIR/options/<letter>/.
// Prints the path of the filled brief. The subagent is told to read that file and follow it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { workspaceIndex } from "./workspace_index.mjs";

const KINDS = { build: "build-agent.md", research: "research-agent.md", option: "option-build-agent.md", hero: "hero-review-agent.md", finish: "finish-agent.md", director: "director-agent.md" };
const REF = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "references");
const argv = process.argv.slice(2);
const kind = argv[0];
const a = { notes: "", brief: "", option: "", count: "1", assign: "", siblings: "" };
for (let i = 1; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) fail(`unexpected argument: ${argv[i]}`);
  a[argv[i].slice(2)] = argv[++i] ?? "";
}
function fail(msg) { console.error(msg); process.exit(1); }
if (!KINDS[kind]) fail(`first argument must be one of: ${Object.keys(KINDS).join(", ")}`);
for (const k of ["dir", "name", "url", "tools"]) if (!a[k]) fail(`--${k} is required`);

const home = process.env.HOME || process.env.USERPROFILE || "";
const abs = (p) => path.resolve(p.replace(/^~(?=$|[\\/])/, home));
const d = abs(a.dir);
if (!fs.existsSync(d)) fail(`missing concept folder ${d}; run new_concept.mjs first`);
const opt = a.option.toLowerCase().trim();
if (kind === "option" && !opt) fail("--option is required for kind 'option'");

// Where this option's files live.
const odir = !opt || opt === "a" ? d : path.join(d, "options", opt);
const meta = opt ? path.join(d, "research", `option-${opt}.json`) : path.join(d, "meta.json");
const tag = opt ? `-${opt}` : "";
const decisions = path.join(d, "research", `decisions${tag}.md`);
const heroNotes = path.join(d, "research", `hero-review${tag}.md`);
for (const sub of ["concept/assets", "after"]) fs.mkdirSync(path.join(odir, sub), { recursive: true });
fs.mkdirSync(path.join(d, "research", "raw"), { recursive: true });

// Siblings: what the other options are doing (given, plus anything already written to disk).
const sib = a.siblings.trim() ? [a.siblings.trim()] : [];
if (opt) {
  for (const f of fs.readdirSync(path.join(d, "research")).filter((x) => /^option-.*\.json$/.test(x)).sort()) {
    if (f === `option-${opt}.json`) continue;
    try {
      const o = JSON.parse(fs.readFileSync(path.join(d, "research", f), "utf8"));
      sib.push(`- Option ${String(o.option || f.slice(7, 8)).toUpperCase()} (${o.label || ""}): ${o.archetype || ""}; hero ${o.hero || "?"}; fonts ${(o.fonts || []).join(", ")}; ${o.design_thesis || ""}`);
    } catch {}
  }
}

const read = (f) => fs.readFileSync(path.join(REF, f), "utf8");
let body = read(KINDS[kind]).split("---").slice(1).join("---").trim();
const which = opt ? `Option ${opt.toUpperCase()} of ${a.count} homepage concepts` : "a homepage concept";
const metaRule = opt
  ? `It is this option's notes file, read by merge_options.mjs: write it as JSON with "option": "${opt.toUpperCase()}", a "label" (2 to 4 words naming this direction) and these fields from the format below: tagline, design_thesis, archetype, hero, nav, footer, sections, ground, palette, fonts, changes, one_liner, primary_action, conversion. No em dashes.`
  : `Write every field in the format below, with "status": "done" and today's date as "created". The 4 problems come from the brief.`;
// Forward slashes work in every shell the agents use (bash, zsh, Git Bash, PowerShell), so briefs never carry backslashes.
const P = (p) => p.replace(/\\/g, "/");
const fills = {
  "{{NAME}}": a.name, "{{URL}}": a.url, "{{SLUG}}": path.basename(d), "{{DIR}}": P(d), "{{TOOLS}}": P(abs(a.tools)),
  "{{WORKSPACE_INDEX}}": workspaceIndex(path.dirname(d), path.basename(d)),
  "{{CONCEPT}}": P(path.join(odir, "concept")), "{{AFTER}}": P(path.join(odir, "after")), "{{META}}": P(meta),
  "{{QA_TARGET}}": P(odir), "{{OPTION}}": opt.toUpperCase(), "{{OPTION_COUNT}}": String(a.count),
  "{{ASSIGNMENT}}": a.assign.trim() || "Choose the archetype, hero, nav and footer types and the font pairing that fit the brand best.",
  "{{SIBLINGS}}": sib.join("\n") || "(none: this is the only option)", "{{WHICH}}": which,
  "{{DECISIONS}}": P(decisions), "{{HERO_NOTES}}": P(heroNotes), "{{META_RULE}}": metaRule,
  "{{META_FORMAT}}": "META FORMAT\n" + read("meta-format.md").split("\n").slice(1).join("\n").trim(),
  "{{DESIGN_BAR}}": read("design-bar.md").trim(),
};
for (const [k, v] of Object.entries(fills)) body = body.split(k).join(v);
const left = body.match(/\{\{[A-Z_]+\}\}/g);
if (left) fail(`unfilled placeholders in ${KINDS[kind]}: ${[...new Set(left)].join(", ")}`);

if (a.brief.trim()) {
  const bf = abs(a.brief);
  if (!fs.existsSync(bf)) fail(`--brief file not found: ${bf}`);
  const dest = path.join(d, "research", "client-brief" + (path.extname(bf) || ".md"));
  if (path.resolve(bf) !== path.resolve(dest)) fs.copyFileSync(bf, dest);
  body += `\n\nCLIENT BRIEF (from the client or the agency: assessment results, discovery notes, real reviews or numbers). Read ${P(dest)} before anything else. What it says about the audience, the goals, what to keep and what to avoid outranks what you infer from the live site. Facts in it count as real content; cite it as the source. It never licenses inventing anything it does not say.`;
}
if (a.notes.trim()) body += "\n\nEXTRA NOTES FROM THE PERSON RUNNING THIS (follow them; they outrank your own guesses about the brand):\n" + a.notes.trim();
const out = path.join(d, "research", `${kind}${opt && kind !== "research" ? `-${opt}` : ""}-prompt.md`);
fs.writeFileSync(out, body + "\n");
console.log(P(out));
