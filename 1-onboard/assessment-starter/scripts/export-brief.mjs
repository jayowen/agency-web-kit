// Turns the assessment answers into client-brief.md, the file the homepage-concept
// skill reads so the concept is built from what the client's own people said.
// Usage:
//   node scripts/export-brief.mjs https://<project>.pages.dev  > client-brief.md
//   node scripts/export-brief.mjs http://localhost:8788         > client-brief.md
// The admin password is read from .dev.vars (or the ADMIN_PASSWORD environment variable).
// Names and emails are left out on purpose: the brief gets handed to other tools.
import fs from "node:fs";

const base = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) { console.error("usage: node scripts/export-brief.mjs <survey-url> > client-brief.md"); process.exit(1); }
let pw = process.env.ADMIN_PASSWORD;
if (!pw && fs.existsSync(".dev.vars")) pw = fs.readFileSync(".dev.vars", "utf8").match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
if (!pw) { console.error("No admin password. Run from the assessment folder (it reads .dev.vars) or set ADMIN_PASSWORD."); process.exit(1); }

const cfg = JSON.parse(fs.readFileSync(process.argv[3] || "public/client.config.json", "utf8"));
const res = await fetch(`${base}/api/admin/data`, { headers: { authorization: `Bearer ${pw}` } });
if (!res.ok) { console.error(`Could not read answers: ${res.status} ${res.statusText}`); process.exit(1); }
const people = (await res.json()).respondents || [];
if (!people.length) { console.error("No responses yet."); process.exit(1); }

const tally = (lists) => {
  const m = new Map();
  for (const l of lists) for (const v of [].concat(l ?? [])) if (v !== "" && v != null) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
const out = [`# Client brief: ${cfg.client?.name || ""}`, "",
  `From ${people.length} assessment responses, exported ${new Date().toISOString().slice(0, 10)}.`,
  "Everything below is what the client's own people said. Treat it as fact about what they want; do not invent beyond it.", ""];

for (const s of cfg.sections || []) {
  const lines = [];
  for (const q of s.questions || []) {
    const vals = people.map((p) => p.answers?.[q.key]).filter((v) => v !== undefined && v !== null && v !== "");
    if (!vals.length || q.type.startsWith("identity")) continue;
    const label = q.label || (q.left ? `${q.left} vs ${q.right}` : q.key);
    switch (q.type) {
      case "rating":
        lines.push(`- **${label}** Average ${avg(vals.map(Number))} out of ${q.max ?? 10} (${vals.length} answers; low = "${q.minLabel || ""}", high = "${q.maxLabel || ""}").`); break;
      case "slider_pair": {
        const cur = avg(vals.map((v) => Number(v.current))), want = avg(vals.map((v) => Number(v.desired)));
        lines.push(`- **${q.left} (1) to ${q.right} (7):** today ${cur}, should be ${want}.`); break;
      }
      case "multi_select": case "palette_grid": case "image_pick": {
        const names = Object.fromEntries((q.options || q.palettes || q.tiles || []).map((o) => [o.id, o.label || o.name || o.id]));
        lines.push(`- **${label}**`, ...tally(vals).map(([id, n]) => `  - ${names[id] || id}: ${n}`)); break;
      }
      case "wordbank":
        lines.push(`- **${label}** ${tally(vals).slice(0, 10).map(([w, n]) => `${w} (${n})`).join(", ")}`); break;
      case "ab_pair": {
        const names = { [q.a?.id]: q.a?.label || q.a?.id, [q.b?.id]: q.b?.label || q.b?.id };
        lines.push(`- **${label}** ${tally(vals).map(([id, n]) => `${names[id] || id}: ${n}`).join(", ")}`); break;
      }
      case "repeater":
        lines.push(`- **${label}**`, ...vals.flat().map((r) => `  - ${Object.values(r).filter(Boolean).join(": ")}`)); break;
      default: {
        const head = q.prefix ? `${label}: "${q.prefix} ..."` : label;
        lines.push(`- **${head}**`, ...vals.map((v) => `  - ${String(v).replace(/\s+/g, " ").trim()}`));
      }
    }
  }
  if (lines.length) out.push(`## ${s.title}`, "", ...lines, "");
}
console.log(out.join("\n"));
