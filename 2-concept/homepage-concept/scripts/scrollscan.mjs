// Scroll scan: walks the page top to bottom in half-screen steps at 15 screen sizes (360 to 2560 wide)
// and flags text that overlaps other text, text sitting on a photo or video, and text cut off at the
// screen edge. Full-page screenshots miss these (sticky elements, absolute layouts that only collide
// at some widths), so qa.mjs runs this on every concept.
//
// As a module: import { scrollScan } from "./scrollscan.mjs"; const issues = await scrollScan(browser, file);
// As a CLI:    node scrollscan.mjs <concept-folder> [...]
//              Prints issues and writes contact sheets of what a visitor sees while scrolling, at
//              390, 1024, 1440 and 1920 wide, to <concept-folder>/research/scroll/sheet-<width>.jpg.
//              View those sheets: they are the top-to-bottom review.
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

export const SIZES = [
  [360, 740], [390, 844], [430, 932], [600, 900], [768, 1024], [900, 1000], [1000, 700],
  [1024, 768], [1180, 800], [1280, 720], [1366, 768], [1440, 900], [1680, 1050], [1920, 1080], [2560, 1440],
];
export const SHEET_WIDTHS = [390, 1024, 1440, 1920];

// Runs in the page. Returns a list of issue strings for the current scroll position.
function inspect() {
  const out = [];
  // Fixed chrome (sticky header, phone action bar, skip link) is meant to sit over content.
  const isChrome = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (e.classList && e.classList.contains("skip")) return true;
      if (e.tagName === "HEADER" && e.parentElement === document.body) return true;
      const p = getComputedStyle(e).position;
      if (p === "fixed") return true;
      if (p === "sticky" && (e.tagName === "HEADER" || e.tagName === "NAV" || e.getAttribute("role") === "banner")) return true;
    }
    return false;
  };
  const label = (el) => {
    const cls = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/)[0] : "";
    return el.tagName.toLowerCase() + cls + ' "' + (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) + '"';
  };
  const group = (el) => el.closest("h1,h2,h3,h4,h5,h6,p,li,a,button,label,figcaption,blockquote,td,th,dt,dd") || el;
  const scrollsSideways = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const ox = getComputedStyle(e).overflowX;
      if ((ox === "auto" || ox === "scroll") && e.scrollWidth > e.clientWidth) return true;
    }
    return false;
  };
  const shown = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || +cs.opacity < 0.15 || cs.display === "none") return false;
    }
    return true;
  };
  const boxes = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("script,style,noscript,svg,video") || isChrome(el) || !shown(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
      boxes.push({ el, g: group(el), r });
      if ((r.right > innerWidth + 1 || r.left < -1) && !scrollsSideways(el)) out.push("text cut off at the screen edge: " + label(group(el)));
    }
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      if (A.g === B.g || A.g.contains(B.g) || B.g.contains(A.g)) continue;
      const smaller = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
      if (overlap(A.r, B.r) > 0.2 * smaller) out.push("text overlaps text: " + label(A.g) + " and " + label(B.g));
    }
  }
  // Text on top of a photo or video is a bug unless it was built that way. Built that way means: the
  // text and the media share a figure, or the media is a full-width background layer (it, or a near
  // ancestor, is absolutely positioned and spans at least 90% of the box it is positioned in, like a
  // cinematic hero or a photo behind a closing panel), or it is marked data-under-text.
  const isBackdrop = (m) => {
    let layered = false;
    for (let e = m, k = 0; e && e !== document.body && k < 4; e = e.parentElement, k++) {
      const p = getComputedStyle(e).position;
      if (p === "absolute" || p === "fixed") { layered = true; break; }
    }
    if (!layered) return false;
    const block = m.closest("section,header,footer,article,main") || document.body;
    return m.getBoundingClientRect().width >= 0.9 * Math.min(block.getBoundingClientRect().width, innerWidth);
  };
  const media = [...document.querySelectorAll("img,video")]
    .filter((m) => !isChrome(m) && shown(m) && !m.closest("[data-under-text]") && !isBackdrop(m))
    .map((m) => ({ m, r: m.getBoundingClientRect() }))
    .filter((o) => o.r.width > 60 && o.r.height > 60 && o.r.bottom > 0 && o.r.top < innerHeight);
  const done = new Set();
  for (const B of boxes) {
    for (const M of media) {
      const fig = M.m.closest("figure");
      if (fig && fig.contains(B.el)) continue;
      if (overlap(B.r, M.r) <= 0.2 * B.r.width * B.r.height) continue;
      const key = label(B.g) + "|" + label(M.m);
      if (done.has(key)) continue;
      done.add(key);
      out.push("text sits on a photo or video: " + label(B.g) + " over " + (M.m.getAttribute("src") || M.m.currentSrc || "video"));
    }
  }
  return out;
}

async function openPage(browser, file, w, h) {
  const mobile = w < 600;
  // Reduced motion freezes entrance and scroll-reveal animations so boxes are measured where they land.
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  // Reveal everything a scroll observer would reveal, then let transitions settle.
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    scrollTo(0, 0);
  }).catch(() => {});
  await page.waitForTimeout(900);
  return { ctx, page };
}

// Returns issue strings like "at 1024x768: text overlaps text: ...".
export async function scrollScan(browser, file, { sizes = SIZES, shotsDir = null } = {}) {
  const found = new Map();
  for (const [w, h] of sizes) {
    const { ctx, page } = await openPage(browser, file, w, h);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = Math.round(h * 0.5);
    let i = 0;
    for (let y = 0; y < total; y += step, i++) {
      await page.evaluate((y) => scrollTo(0, y), y);
      await page.waitForTimeout(120);
      if (shotsDir && SHEET_WIDTHS.includes(w)) {
        await page.screenshot({ path: path.join(shotsDir, `w${w}-${String(i).padStart(3, "0")}.jpg`), quality: 60 });
      }
      for (const s of await page.evaluate(inspect)) if (!found.has(s)) found.set(s, `${w}x${h}`);
    }
    await ctx.close();
  }
  return [...found].map(([s, at]) => `at ${at}: ${s}`);
}

// Tiles each width's scroll shots into contact sheets (up to 12 frames per sheet) by rendering a grid
// page in the same browser, so it needs nothing beyond Playwright. Frames are inlined as data URLs:
// a blank page is not allowed to load file:// images, which left the sheets empty.
async function makeSheets(browser, shotsDir) {
  const page = await (await browser.newContext({ viewport: { width: 1860, height: 1000 } })).newPage();
  for (const w of SHEET_WIDTHS) {
    const files = fs.readdirSync(shotsDir).filter((f) => f.startsWith(`w${w}-`)).sort();
    if (!files.length) continue;
    const phone = w < 600, cols = phone ? 6 : 2, per = phone ? 18 : 12, tw = phone ? 300 : 900;
    for (let start = 0, part = 1; start < files.length; start += per, part++) {
      const imgs = files.slice(start, start + per).map((f) => `<img src="data:image/jpeg;base64,${fs.readFileSync(path.join(shotsDir, f)).toString("base64")}">`).join("");
      await page.setContent(`<body style="margin:0;background:#e00"><div style="display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:8px;padding:8px;width:max-content">${imgs}</div><style>img{width:${tw}px;display:block}</style></body>`, { waitUntil: "load" });
      const name = files.length <= per ? `sheet-${w}.jpg` : `sheet-${w}-${part}.jpg`;
      await page.locator("div").first().screenshot({ path: path.join(shotsDir, name), quality: 70 });
    }
    for (const f of files) fs.rmSync(path.join(shotsDir, f));
  }
  await page.context().close();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dirs = process.argv.slice(2).map((d) => path.resolve(d));
  if (!dirs.length) { console.error("usage: node scrollscan.mjs <concept-folder> [...]"); process.exit(1); }
  const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
  let bad = 0;
  for (const dir of dirs) {
    const file = path.join(dir, "concept/index.html");
    if (!fs.existsSync(file)) { console.error(`${dir}: no concept/index.html here. Pass the concept folder's full path, not its name.`); bad++; continue; }
    const shotsDir = path.join(dir, "research/scroll");
    fs.rmSync(shotsDir, { recursive: true, force: true });
    fs.mkdirSync(shotsDir, { recursive: true });
    const issues = await scrollScan(browser, file, { shotsDir });
    await makeSheets(browser, shotsDir);
    console.log(`${path.basename(dir)}: ${issues.length ? issues.length + " scroll issues" : "no scroll issues"}`);
    for (const s of issues) console.log("  " + s);
    console.log(`  contact sheets: ${shotsDir}/sheet-*.jpg`);
    if (issues.length) bad++;
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
}
