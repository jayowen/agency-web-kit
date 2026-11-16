// Build the before/after pages.
// Usage: node make_compare.mjs <workspace>
// Writes <workspace>/<concept>/index.html (a before/after page for each finished concept)
// and <workspace>/index.html (a list of every concept). Open them in any browser, or publish
// the workspace with publish.mjs to get a link to send.
//
// Agencies: put your name on these pages with a brand file at <workspace>/agency.json:
//   { "name": "Your Agency", "url": "https://youragency.com", "accent": "#1f5eff", "logo": "logo.svg",
//     "cta": { "label": "Book a call", "href": "https://youragency.com/call" } }
// Every field is optional. The logo path is relative to the workspace.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ws = path.resolve(process.argv[2] || ".");
const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const e = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const agency = readJSON(path.join(ws, "agency.json")) || {};
const accent = /^#[0-9a-f]{3,8}$/i.test(agency.accent || "") ? agency.accent : "";
const STYLE = fs.readFileSync(path.join(here, "compare.css"), "utf8") + (accent ? `:root{--acc:${accent}}` : "") +
  ".by{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;padding:20px 0;border-top:1px solid var(--line);color:var(--mut);font-size:14px}.by img{height:28px;width:auto;display:block}.by a{text-decoration:none}";
const SCRIPT = fs.readFileSync(path.join(here, "compare.js"), "utf8");

// The agency's own line at the foot of each page (only when agency.json exists).
function byline(prefix) {
  if (!agency.name) return "";
  const safe = (u) => (/^(https?:|mailto:|tel:)/.test(u || "") ? u : "");
  const mark = agency.logo ? `<img src="${e(prefix + agency.logo)}" alt="${e(agency.name)}">` : `Concept by ${e(agency.name)}`;
  const home = safe(agency.url) ? `<a href="${e(agency.url)}" target="_blank" rel="noopener">${mark}</a>` : `<span>${mark}</span>`;
  const cta = agency.cta && safe(agency.cta.href) ? `<a class="btn p" href="${e(agency.cta.href)}" target="_blank" rel="noopener">${e(agency.cta.label || "Talk to us")}</a>` : "";
  return `<footer class="wrap"><div class="by">${home}${cta}</div></footer>`;
}
const page = (title, body, extra = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${e(title)}</title><style>${STYLE}</style></head><body>${body}${extra}</body></html>`;

const done = [];
for (const name of fs.existsSync(ws) ? fs.readdirSync(ws).sort() : []) {
  const d = path.join(ws, name);
  const m = readJSON(path.join(d, "meta.json"));
  if (!m || m.status !== "done") continue;
  done.push([name, m]);
  const opts = m.options?.length ? m.options : [{ option: "A", label: "", concept: m.concept || "concept/index.html", after: m.after || {}, changes: m.changes || [], design_thesis: m.design_thesis || "", palette: m.palette || [], fonts: m.fonts || [], tagline: m.tagline || "" }];
  // meta.json is written from scraped sites, so paths are only trusted when they are plain relative file paths.
  const rel = (p, fallback) => (typeof p === "string" && /^[\w][\w./-]*$/.test(p) && !p.includes("..") ? p : fallback);
  const shots = (s, base) => ({ desktop: rel(s?.desktop, base + "/desktop.jpg"), mobile: rel(s?.mobile, base + "/mobile.jpg") });
  for (const o of opts) { o.concept = rel(o.concept, "concept/index.html"); o.after = shots(o.after, "after"); }
  const pick = (o) => Object.fromEntries(["option", "label", "concept", "after", "changes", "design_thesis", "palette", "fonts", "tagline"].map((k) => [k, o[k] ?? null]));
  const data = { before: shots(m.before, "before"), opts: opts.map(pick) };
  const tabs = opts.length > 1
    ? '<div class="seg opts" role="group" aria-label="Design option">' + opts.map((o, i) => `<button data-o="${i}">Option ${e(o.option || String.fromCharCode(65 + i))}${o.label ? ": " + e(o.label) : ""}</button>`).join("") + "</div>"
    : "";
  const live = /^https?:/.test(m.url || "") ? `<a class="btn" href="${e(m.url)}" target="_blank" rel="noopener">Current site</a>` : "";
  const count = opts.length > 1 ? `<p class="sub" style="margin-top:-12px">${opts.length} design options. Pick a tab to compare each one.</p>` : "";
  const body = `<main class="wrap"><h1>${e(m.name || name)}</h1><p class="sub" id="tagline">${e(opts[0].tagline || m.tagline || "")}</p>${count}
${tabs ? '<div class="bar">' + tabs + "</div>" : ""}
<div class="btns"><a class="btn p" id="open" href="${e(opts[0].concept || "concept/index.html")}" target="_blank" rel="noopener">Open the new homepage</a>${live}</div>
<div class="bar"><div class="seg" role="group" aria-label="Device"><button data-d="desktop">Desktop</button><button data-d="mobile">Mobile</button></div>
<div class="seg" id="mseg" role="group" aria-label="View"><button data-m="slider">Slider</button><button data-m="sbs">Side by side</button></div></div>
<div id="stage"></div>
<div class="notes"><div><h2>What holds the current site back</h2><ol>${(m.problems || []).map((x) => `<li>${e(x)}</li>`).join("")}</ol></div>
<div><h2>What the new homepage does</h2><ol id="chg"></ol></div></div>
<div class="idea"><div><h2 style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)">The idea</h2><blockquote id="thesis"></blockquote></div>
<div><div class="sw" id="sw"></div><p id="fonts"></p></div></div></main>${byline("../")}`;
  // "</" is escaped so text inside the data can never close the script tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  fs.writeFileSync(path.join(d, "index.html"), page(`${m.name || name}: before and after`, body, `<script>const D=${json};${SCRIPT}</script>`));
}

const cards = done.map(([name, m]) =>
  `<a class="card" href="${e(name)}/index.html"><div class="t"><img src="${e(name)}/${e(m.before?.desktop || "before/desktop.jpg")}" alt="" loading="lazy">` +
  `<img class="af" src="${e(name)}/${e(m.after?.desktop || "after/desktop.jpg")}" alt="" loading="lazy"></div><h3>${e(m.name || name)}</h3><p>${e(m.industry || "")}</p></a>`).join("");
fs.writeFileSync(path.join(ws, "index.html"), page(agency.name ? `${agency.name}: homepage concepts` : "Homepage concepts",
  `<main class="wrap"><h1>Homepage concepts</h1><p class="sub">${done.length} concept${done.length === 1 ? "" : "s"}. Hover a card to see the new design, click for the full before and after.</p><div class="grid">${cards}</div></main>${byline("")}`));
console.log(`${done.length} before/after pages written. Open ${path.join(ws, "index.html").replace(/\\/g, "/")}`);
