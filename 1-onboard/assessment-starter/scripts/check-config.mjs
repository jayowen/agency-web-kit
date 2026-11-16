// Checks client.config.json against the question types the survey engine supports.
// Usage: node scripts/check-config.mjs public/client.config.json
// Exits 1 with a plain list of problems, so a bad config never deploys.
import { readFileSync } from "node:fs";

const file = process.argv[2] || "public/client.config.json";
let c;
try { c = JSON.parse(readFileSync(file, "utf8")); }
catch (e) { console.error(`✗ ${file} is not valid JSON: ${e.message}`); process.exit(1); }

const errs = [], warns = [];
const need = (cond, msg) => { if (!cond) errs.push(msg); };
const HEX = /^#[0-9a-f]{6}$/i;
const TYPES = new Set(["identity_name","identity_email","identity_select","text","textarea","sentence",
  "rating","slider_pair","wordbank","ab_pair","palette_grid","multi_select","image_pick","repeater"]);

need(typeof c.reviewMode === "boolean", `"reviewMode" must be true or false`);
need(c.client?.slug && /^[a-z0-9-]+$/.test(c.client.slug), `client.slug must be lowercase letters, numbers, dashes`);
need(c.client?.name, `client.name is missing`);
for (const k of ["ink","accent","support","paper","soft","alert"])
  need(HEX.test(c.theme?.[k] || ""), `theme.${k} must be a hex color like #224045`);
need(!isNaN(Date.parse(c.deadline)), `deadline must be an ISO date like 2026-12-01T23:59:00-05:00`);
need(c.intro?.headline && c.intro?.body, `intro.headline and intro.body are required`);
need(c.confirmation?.headline, `confirmation.headline is required`);
need(Array.isArray(c.sections) && c.sections.length, `sections must be a non-empty list`);

const keys = new Set();
const ids = new Set(["name","email"]);
let hasName = false, hasEmail = false;
for (const [si, s] of (c.sections || []).entries()) {
  const where = `section ${si + 1} (${s.id || "no id"})`;
  need(s.id && s.title, `${where}: needs id and title`);
  for (const q of s.questions || []) {
    const at = `${where} > ${q.key || "no key"}`;
    need(q.key, `${at}: every question needs a key`);
    if (keys.has(q.key)) errs.push(`${at}: duplicate key "${q.key}"`);
    keys.add(q.key);
    if (!TYPES.has(q.type)) { errs.push(`${at}: unknown type "${q.type}"`); continue; }
    if (q.type === "identity_name") hasName = true;
    if (q.type === "identity_email") hasEmail = true;
    const list = (a) => Array.isArray(a) ? a : [];
    switch (q.type) {
      case "identity_select":
        need(Array.isArray(c[q.options_from]), `${at}: options_from "${q.options_from}" is not a list at the top of the config`); break;
      case "rating":
        if (q.min != null && q.max != null) need(q.min < q.max, `${at}: min must be below max`); break;
      case "slider_pair":
        need(q.left && q.right, `${at}: needs left and right words`); break;
      case "wordbank":
        need(list(q.words).length >= (q.count || 0), `${at}: needs at least ${q.count} words`);
        need(q.count > 0, `${at}: needs a count`); break;
      case "multi_select":
        need(q.count > 0, `${at}: needs a count`);
        need(list(q.options).length >= q.count && list(q.options).every(o => o.id && o.label),
          `${at}: needs at least ${q.count} options, each with id and label`); break;
      case "ab_pair":
        need(q.a?.id && q.b?.id && q.a.id !== q.b.id, `${at}: needs a and b, each with a different id`); break;
      case "palette_grid":
        need(list(q.palettes).length && list(q.palettes).every(p => p.id && list(p.colors).every(x => HEX.test(x))),
          `${at}: each palette needs an id and hex colors`); break;
      case "image_pick":
        need(list(q.tiles).length && list(q.tiles).every(t => t.id && t.src), `${at}: each tile needs id and src`); break;
      case "repeater":
        need(list(q.fields).length && list(q.fields).every(f => f.key), `${at}: needs fields, each with a key`); break;
    }
    if (q.link) need(q.link.href, `${at}: link needs an href`);
  }
}
need(hasName && hasEmail, `the survey needs an identity_name and an identity_email question`);
if (c.reviewMode === true) warns.push(`reviewMode is ON: nothing will be saved. Set it to false before you send the link.`);
if (Date.parse(c.deadline) < Date.now()) warns.push(`deadline is in the past`);
for (const t of c.admin?.tags || []) need(t.id && t.label, `admin.tags: each tag needs id and label`);

for (const w of warns) console.log(`! ${w}`);
if (errs.length) { for (const e of errs) console.error(`✗ ${e}`); process.exit(1); }
console.log(`✓ ${file}: ${c.sections.length} sections, ${keys.size} questions`);
