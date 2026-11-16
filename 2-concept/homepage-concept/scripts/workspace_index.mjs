// Show what the workspace already uses, so a new concept can be different.
// Usage: node workspace_index.mjs <workspace> [--skip <concept-folder-name>]
// Prints archetype, font, hero, nav and footer counts, the most recent builds' design log,
// and every concept's industry + archetype. Options B, C... count too (research/option-*.json).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RECENT = 10;
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

export function workspaceIndex(ws, skip = "") {
  const metas = [], designs = [];
  const dirs = fs.existsSync(ws) ? fs.readdirSync(ws).sort() : [];
  for (const name of dirs) {
    if (name === skip) continue;
    const f = path.join(ws, name, "meta.json");
    const m = readJSON(f);
    if (!m || m.status !== "done") continue;
    metas.push(m);
    const t = Date.parse(m.created);
    const when = Number.isNaN(t) ? fs.statSync(f).mtimeMs : t;
    designs.push([when, m.slug || name, m]);
    const research = path.join(ws, name, "research");
    for (const o of fs.existsSync(research) ? fs.readdirSync(research).filter((x) => /^option-.*\.json$/.test(x)).sort() : []) {
      const om = readJSON(path.join(research, o));
      if (om && String(om.option || "a").toLowerCase() !== "a") designs.push([when, `${m.slug || name} option ${String(om.option || "").toUpperCase()}`, om]);
    }
  }
  if (!metas.length) return "(none yet: this is the first concept in this workspace, so nothing is off limits)";
  const key = (v) => String(v || "?").split(".")[0].trim();
  const count = (list) => { const c = {}; for (const k of list) c[k] = (c[k] || 0) + 1; return c; };
  const sorted = (c) => Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
  const out = [];
  out.push(`${metas.length} concepts in this workspace (${designs.length} designs counting options)\n`);
  out.push("ARCHETYPES used (letter: count): " + JSON.stringify(sorted(count(designs.map(([, , d]) => key(d.archetype))))));
  const fonts = count(designs.flatMap(([, , d]) => d.fonts || []));
  const multi = Object.entries(fonts).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`);
  out.push("\nFONTS used 2+ times (avoid these): " + (multi.join(", ") || "none"));
  out.push("\nALL FONTS used once: " + (Object.entries(fonts).filter(([, v]) => v === 1).map(([k]) => k).sort().join(", ") || "none"));
  const logged = designs.filter(([, , d]) => d.hero);
  for (const field of ["hero", "nav", "footer"]) {
    out.push(`\n${field.toUpperCase()} types used (code: count, from ${logged.length} logged designs): ` + JSON.stringify(sorted(count(logged.filter(([, , d]) => d[field]).map(([, , d]) => key(d[field]))))));
  }
  const recent = [...designs].sort((a, b) => b[0] - a[0]).slice(0, RECENT);
  out.push(`\nDESIGN LOG, the ${recent.length} most recent builds (do not repeat any of their hero, nav or footer types, or their shape):`);
  for (const [when, name, d] of recent) {
    const parts = [`archetype ${d.archetype || "?"}`, `fonts ${(d.fonts || []).join(", ")}`];
    for (const field of ["hero", "nav", "footer"]) if (d[field]) parts.push(`${field} ${d[field]}`);
    if (d.sections) parts.push("sections " + d.sections.join(" > "));
    out.push(`- ${new Date(when).toISOString().slice(0, 10)} ${name}: ${parts.join(" | ")}`);
  }
  const avoid = ["hero", "nav", "footer"].map((f) => `${f} ${[...new Set(recent.filter(([, , d]) => d[f]).map(([, , d]) => key(d[f])))].sort().join(", ") || "none logged yet"}`);
  out.push("\nAVOID (used in the last builds): " + avoid.join("; "));
  out.push("\nCONCEPTS (industry | archetype | fonts):");
  for (const m of metas) out.push(`- ${m.slug || m.name}: ${m.industry || ""} | ${m.archetype || "?"} | ${(m.fonts || []).join(", ")}`);
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  if (!a[0]) { console.error("usage: node workspace_index.mjs <workspace> [--skip <folder>]"); process.exit(1); }
  const i = a.indexOf("--skip");
  console.log(workspaceIndex(path.resolve(a[0]), i >= 0 ? a[i + 1] : ""));
}
