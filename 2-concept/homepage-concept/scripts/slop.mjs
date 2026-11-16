// Flags design habits that make a concept read as AI-made or templated, in a real browser.
// Rule ideas adapted from Hallmark's sloplint (MIT, github.com/nutlope/hallmark); the code is our own.
//
// Usage: node slop.mjs <concept-folder> [<concept-folder> ...] [--stage hero]
//   a concept folder is one that contains concept/index.html (DIR, or DIR/options/b).
//   --stage hero checks only the header, the first screen and the code rules (for a hero-only build).
//
// FAIL must be fixed. WARN must be fixed or waived with a reason, as an HTML comment in the page:
//   <!-- slop-waive: italic-accent: the brand's logo is set in an italic serif -->
// Prints each target's findings and "checked N, M with open fails or warns". Exits 1 when any remain.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const stage = args.includes("--stage") ? args[args.indexOf("--stage") + 1] : "full";
const targets = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--stage").map((t) => path.resolve(t));
if (!targets.length) { console.error("usage: node slop.mjs <concept-folder> [...] [--stage hero]"); process.exit(1); }

const BANNED_FONTS = ["inter", "roboto", "poppins", "montserrat", "open sans", "lato", "space grotesk", "playfair display"];
const LIMITS = { h1Words: 7, heroSubWords: 25, screenWords: 80, pageWords: 450 };

// Code rules: read the page's own CSS and JS as text.
function codeRules(html) {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  const inline = [...html.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]).join(";\n");
  const js = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  const f = [];
  const add = (level, id, msg) => f.push({ level, id, msg });
  if (/transition(-property)?\s*:\s*all\b/i.test(css + inline) || /transition\s*=\s*["'`]all\b/i.test(js))
    add("FAIL", "transition-all", "transition: all found; name the properties (transform, opacity, color)");
  const animatedLayout = [...(css + inline).matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/gi)]
    .map((m) => m[1]).filter((v) => /(^|[\s,])(width|height|top|left|right|bottom|margin|padding)(\s|,|$)/i.test(v));
  const keyLayout = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g)].some((m) => /[{;\s](width|height|top|left)\s*:/i.test(m[1]));
  if (animatedLayout.length || keyLayout) add("WARN", "animate-layout", "animates width, height, top or left; animate transform and opacity instead");
  const rootBlock = [...css.matchAll(/:root[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join("\n");
  const tokens = (rootBlock.match(/--[\w-]+\s*:/g) || []).length;
  const outside = css.replace(/:root[^{]*\{[^}]*\}/g, "").replace(/@font-face\s*\{[^}]*\}/g, "");
  // Solid colors only: see-through rgba() scrims and shadows are allowed inline.
  const solid = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b|rgba?\(\s*\d+[\s,]+\d+[\s,]+\d+\s*\)|hsla?\(\s*\d[^)/]*\)/gi;
  const literals = (outside.match(solid) || []).length + (inline.match(solid) || []).length;
  if (tokens < 3) add("FAIL", "no-tokens", "colors and fonts are not declared as custom properties on :root");
  else if (literals > 12) add("WARN", "color-literals", `${literals} literal colors outside :root; define each color once as a token and use var()`);
  const fontDecls = (outside.match(/font-family\s*:\s*(?!var\()[^;}]+/gi) || []).filter((v) => !/inherit|initial|unset/i.test(v));
  if (fontDecls.length > 2) add("WARN", "font-literals", `${fontDecls.length} font-family values outside :root; use font tokens`);
  if (!/:focus-visible/.test(css)) add("FAIL", "no-focus-visible", "no :focus-visible styles; keyboard users cannot see where they are");
  const moves = /animation\s*:|animation-name|transition\s*:|@keyframes|requestAnimationFrame|gsap\./i.test(css + inline + js);
  if (moves && !/prefers-reduced-motion/.test(css + js)) add("FAIL", "no-reduced-motion", "motion with no prefers-reduced-motion fallback");
  if (/(html|body)[^{]*\{[^}]*overflow-x\s*:\s*hidden/i.test(css)) add("WARN", "overflow-hidden", "overflow-x: hidden on html or body; use overflow-x: clip (hidden breaks sticky headers)");
  if (/\b100vw\b/.test(css)) add("WARN", "100vw", "100vw causes sideways scroll when a scrollbar shows; use 100%");
  return f;
}

// Rendered rules: run inside the page.
function pageRules({ stage, banned, limits }) {
  const vw = innerWidth, vh = innerHeight;
  const out = [];
  const add = (level, id, msg) => out.push({ level, id, msg });
  const cs = (el) => getComputedStyle(el);
  const vis = (el) => { const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return false; for (let e = el; e && e !== document.body; e = e.parentElement) { const s = cs(e); if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.1) return false; } return true; };
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const inHero = (el) => top(el) < vh;
  const scope = (el) => stage !== "hero" || inHero(el);
  const words = (t) => (t.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || []).length;
  const label = (el) => (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 40);
  const parseRGB = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const hue = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return { h: 0, s: 0, l: (mx + mn) / 2 }; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; const l = (mx + mn) / 2; return { h, s: d / (1 - Math.abs(2 * l - 1)), l }; };
  const els = [...document.querySelectorAll("body *")].filter((el) => !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "svg", "path"].includes(el.tagName) && vis(el) && scope(el));

  // Italic accent word inside a roman heading.
  for (const h of document.querySelectorAll("h1, h2")) {
    if (!vis(h) || !scope(h) || cs(h).fontStyle === "italic") continue;
    const it = [...h.querySelectorAll("*")].find((c) => cs(c).fontStyle === "italic" && (c.innerText || "").trim());
    if (it) { add("WARN", "italic-accent", `italic accent word in a heading: "${label(h)}"`); break; }
  }

  // Gradients, glows and glass.
  let gradients = 0, purple = 0, glows = 0, glass = 0;
  for (const el of els) {
    const s = cs(el), b = el.getBoundingClientRect();
    const big = b.width * b.height > vw * vh * 0.08;
    if (/gradient\(/.test(s.backgroundImage) && !/url\(/.test(s.backgroundImage) && big) {
      const stops = (s.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parseRGB).filter((c) => c && c.a > 0.25);
      const colorful = stops.filter((c) => { const x = hue(c); return x.s > 0.35 && x.l > 0.15 && x.l < 0.85; });
      if (colorful.some((c) => { const h = hue(c).h; return h >= 200 && h <= 300; }) && colorful.length >= 2 && new Set(colorful.map((c) => Math.round(hue(c).h / 30))).size >= 2) purple++;
      else if (colorful.length >= 2) gradients++;
    }
    const sh = s.boxShadow;
    // A glow: a centered, wide, saturated shadow (0 0 40px violet), not an offset drop shadow.
    if (sh && sh !== "none") { const c = parseRGB(sh); const glow = [...sh.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)].some((m) => Math.abs(+m[1]) <= 4 && Math.abs(+m[2]) <= 4 && +m[3] >= 24); if (glow && c && hue(c).s > 0.5 && c.a > 0.3) glows++; }
    if (/blur\(/.test(s.backdropFilter || s.webkitBackdropFilter || "") && b.width < vw * 0.9 && b.height > 60) glass++;
  }
  if (purple) add("FAIL", "purple-gradient", "purple or blue multi-color gradient on a large area");
  if (gradients >= 2) add("WARN", "gradient-fill", `${gradients} large color gradients; use a photo or a flat brand color`);
  if (glows) add("FAIL", "glow", `${glows} colored glow shadow(s)`);
  if (glass >= 2) add("WARN", "glassmorphism", `${glass} frosted-glass cards (backdrop blur)`);

  // Filled buttons: two side by side in one row.
  const isFilled = (el) => { const s = cs(el); const c = parseRGB(s.backgroundColor); if (!c || c.a < 0.6) return false; const pc = (() => { for (let p = el.parentElement; p; p = p.parentElement) { const x = parseRGB(cs(p).backgroundColor); if (x && x.a > 0.6) return x; } return { r: 255, g: 255, b: 255 }; })(); return Math.abs(c.r - pc.r) + Math.abs(c.g - pc.g) + Math.abs(c.b - pc.b) > 60; };
  const buttons = [...document.querySelectorAll("a[href], button")].filter((el) => vis(el) && scope(el) && !el.closest("nav, header, [role='tablist'], form, footer") && !el.matches("[role='tab'], [aria-selected], [aria-pressed], [aria-controls]") && isFilled(el) && el.getBoundingClientRect().height >= 32 && el.getBoundingClientRect().width < 420 && words(el.innerText || "") > 0 && words(el.innerText || "") <= 6);
  // Exactly two filled calls to action in one row. Three or more in a row is a chooser or a grid, not a pair.
  const pairs = [];
  const rows = new Map();
  for (const el of buttons) { const box = el.parentElement?.parentElement || el.parentElement; const key = [box, Math.round(el.getBoundingClientRect().top / 16)]; const k = rows.get(box) || {}; (k[key[1]] = k[key[1]] || []).push(el); rows.set(box, k); }
  for (const k of rows.values()) for (const row of Object.values(k)) {
    if (row.length !== 2 || row[0].contains(row[1]) || row[1].contains(row[0])) continue;
    if (Math.abs(row[0].getBoundingClientRect().left - row[1].getBoundingClientRect().left) < 520) pairs.push(`"${label(row[0])}" + "${label(row[1])}"`);
  }
  if (pairs.length) add("FAIL", "two-filled-buttons", `two filled buttons side by side: ${pairs[0]}; make the second a quiet text link`);

  // Card inside a card.
  const isCard = (el) => { const s = cs(el); const bg = parseRGB(s.backgroundColor); const framed = (s.boxShadow !== "none") || (parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== "none" && parseFloat(s.borderLeftWidth) >= 1); return framed && parseFloat(s.borderTopLeftRadius) >= 6 && bg && bg.a > 0.5 && el.getBoundingClientRect().width > 120 && el.getBoundingClientRect().height > 80; };
  const nested = els.filter((el) => isCard(el) && el.parentElement && (() => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (isCard(p)) return true; return false; })());
  if (nested.length) add("WARN", "card-in-card", `${nested.length} card(s) nested inside another card`);

  // Small tracked capitals as labels; eyebrows over section headings.
  const tracked = els.filter((el) => { const s = cs(el); const t = (el.innerText || "").trim(); if (!t || el.children.length > 2 || el.closest("nav, footer, header")) return false; const caps = s.textTransform === "uppercase" || s.fontVariantCaps.includes("small-caps") || (t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t)); const ls = parseFloat(s.letterSpacing) || 0; return caps && parseFloat(s.fontSize) <= 15 && ls >= parseFloat(s.fontSize) * 0.06; });
  const eyebrows = [...document.querySelectorAll("h2, h3")].filter((h) => vis(h) && scope(h)).filter((h) => { const prev = h.previousElementSibling || h.parentElement?.previousElementSibling; return prev && tracked.includes(prev); });
  if (eyebrows.length >= 2) add("WARN", "eyebrows", `${eyebrows.length} section headings sit under small tracked-caps eyebrow labels`);
  else if (tracked.length >= 6) add("WARN", "tracked-caps", `${tracked.length} small labels in tracked capitals; set labels in the body face, a step smaller, sentence case`);

  // 01 / 02 / 03 numbering, middle-dot meta strings, emoji, icon-in-circle grids.
  const leaves = els.filter((el) => el.children.length === 0);
  const nums = leaves.filter((el) => /^0[1-9][.)]?$/.test((el.innerText || "").trim()));
  if (nums.length >= 3) add("WARN", "numbered-list", `${nums.length} 01/02/03 style numbers`);
  const dots = leaves.filter((el) => ((el.innerText || "").match(/ [·•] /g) || []).length >= 2 && !el.closest("footer"));
  if (dots.length >= 2) add("WARN", "dot-meta", `${dots.length} middle-dot joined meta strings ("A · B · C")`);
  const emoji = document.body.innerText.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/gu) || [];
  if (emoji.length) add("FAIL", "emoji", `emoji in the page: ${[...new Set(emoji)].slice(0, 5).join(" ")}`);
  const circles = els.filter((el) => { const s = cs(el), b = el.getBoundingClientRect(); return parseFloat(s.borderTopLeftRadius) >= b.width / 2 - 1 && b.width >= 32 && b.width <= 96 && Math.abs(b.width - b.height) < 3 && el.querySelector("svg, img, i"); });
  const groups = new Map();
  for (const c of circles) { const card = c.parentElement?.parentElement; if (!card?.parentElement) continue; groups.set(card.parentElement, (groups.get(card.parentElement) || 0) + 1); }
  if ([...groups.values()].some((n) => n >= 3)) add("FAIL", "icon-circle-grid", "a row of 3+ icon-in-a-circle feature cards");

  // Fonts actually rendered.
  const fam = new Set(els.slice(0, 600).map((el) => cs(el).fontFamily.split(",")[0].replace(/["']/g, "").trim().toLowerCase()));
  const hit = [...fam].filter((f) => banned.includes(f));
  if (hit.length) add("FAIL", "banned-font", `banned font in use: ${hit.join(", ")}`);

  // Cream or beige ground.
  const bodyBg = parseRGB(cs(document.body).backgroundColor) || {};
  const mainBg = (() => { const m = document.querySelector("main") || document.body; const c = parseRGB(cs(m).backgroundColor); return c && c.a > 0.5 ? c : bodyBg; })();
  if (mainBg.r !== undefined) { const x = hue(mainBg); if (x.h >= 25 && x.h <= 55 && x.l > 0.86 && x.l < 0.97 && x.s > 0.2) add("WARN", "cream-ground", "cream or beige page background, the most worn ground there is"); }

  // Word limits.
  const h1 = document.querySelector("h1");
  if (h1) {
    const n = words(h1.innerText || "");
    if (n > limits.h1Words) add("WARN", "h1-long", `hero headline is ${n} words; keep it to ${limits.h1Words} or fewer`);
    const after = [...document.querySelectorAll("p")].find((p) => vis(p) && inHero(p) && (h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) && !p.closest("nav, header:not(:has(h1))"));
    if (after) { const m = words(after.innerText || ""); if (m > limits.heroSubWords) add("WARN", "hero-sub-long", `the line under the headline is ${m} words; keep it to one sentence under ${limits.heroSubWords}`); }
  }
  const textEls = leaves.concat(els.filter((el) => el.children.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())))
    .filter((el) => !el.closest("nav, footer, [aria-hidden='true']"));
  const bands = new Map();
  let total = 0;
  for (const el of textEls) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ");
    const n = words(own); if (!n) continue;
    const s = cs(el); if (parseFloat(s.fontSize) >= 64) continue; // display type reads as image
    total += n;
    const band = Math.floor(top(el) / vh);
    bands.set(band, (bands.get(band) || 0) + n);
  }
  const heavy = [...bands.entries()].filter(([b, n]) => n > limits.screenWords * 1.5 && (stage !== "hero" || b === 0));
  if (heavy.length) add("WARN", "dense-screen", `${heavy.length} screen(s) over ${limits.screenWords * 1.5} words (worst ${Math.max(...heavy.map((h) => h[1]))}); aim for about ${limits.screenWords} per screen`);
  if (stage !== "hero" && total > limits.pageWords * 1.6) add("WARN", "long-page", `${total} words on the page (outside nav and footer); aim for ${limits.pageWords} or fewer`);
  return out;
}

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const report = {};
let failing = 0;

for (const t of targets) {
  const file = path.join(t, "concept", "index.html");
  if (!fs.existsSync(file)) { console.log(`${t}: no concept/index.html`); continue; }
  const html = fs.readFileSync(file, "utf8");
  const waivers = Object.fromEntries([...html.matchAll(/<!--\s*slop-waive:\s*([\w-]+)\s*:\s*([\s\S]*?)-->/g)].map((m) => [m[1], m[2].trim()]));
  const found = codeRules(html);
  for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: "no-preference" });
    const page = await ctx.newPage();
    await page.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 45000 }).catch(() => {});
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } scrollTo(0, 0); });
    await page.waitForTimeout(500);
    const r = await page.evaluate(pageRules, { stage, banned: BANNED_FONTS, limits: LIMITS }).catch((e) => [{ level: "WARN", id: "lint-error", msg: e.message.split("\n")[0] }]);
    for (const x of r) if (!found.some((f) => f.id === x.id)) found.push({ ...x, msg: w === 390 ? `${x.msg} (phone)` : x.msg });
    await ctx.close();
  }
  const rows = found.map((f) => (f.level === "WARN" && waivers[f.id] ? { ...f, level: "WAIVED", msg: `${f.msg} [waived: ${waivers[f.id]}]` } : f));
  const fails = rows.filter((f) => f.level === "FAIL").length, warns = rows.filter((f) => f.level === "WARN").length;
  if (fails || warns) failing++;
  report[t] = rows;
  console.log(`${path.relative(process.cwd(), t) || t}: ${fails} fail, ${warns} warn${rows.length ? "\n" + rows.map((f) => `  ${f.level.padEnd(6)} ${f.id}: ${f.msg}`).join("\n") : ""}`);
}
await browser.close();
console.log(`checked ${targets.length}${stage === "hero" ? " (hero stage)" : ""}, ${failing} with open fails or warns`);
process.exit(failing ? 1 : 0);
