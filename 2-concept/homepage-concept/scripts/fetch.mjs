// Research fetch: saves a page the way a browser sees it, for sites that build themselves with
// JavaScript (Wix, Squarespace, Webflow, Shopify, React apps), where a plain download comes back thin.
//
// Usage: node fetch.mjs <url> <outDir> [--name home]
// Writes into <outDir>:
//   <name>.html         the rendered HTML after scripts ran and lazy content loaded
//   <name>.txt          the visible text, in reading order
//   <name>.images.json  every image and video: url, alt, rendered size, natural size, where it sits
//   <name>.styles.json  fonts in use, the most used colors, the logo candidates and the nav links
// Prints a one-line summary. Exits 1 if the page will not load (try the Wayback Machine copy).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const ni = args.indexOf("--name");
const name = ni >= 0 ? args[ni + 1] : "home";
const [url, outDir] = args.filter((x, i) => !x.startsWith("--") && args[i - 1] !== "--name");
if (!url || !outDir) { console.error("usage: node fetch.mjs <url> <outDir> [--name home]"); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
});
const page = await ctx.newPage();
try {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()}`);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight && y < 20000; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); }
    scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => {
    const abs = (u) => { try { return new URL(u, location.href).href; } catch { return ""; } };
    const images = [];
    for (const el of document.querySelectorAll("img, video, source, [style*='background']")) {
      const b = el.getBoundingClientRect();
      if (el.tagName === "IMG") {
        const best = (el.srcset || "").split(",").map((s) => s.trim().split(/\s+/)).filter((p) => p[0]).sort((x, y) => (parseFloat(y[1]) || 0) - (parseFloat(x[1]) || 0))[0];
        images.push({ type: "img", url: abs(el.currentSrc || el.src), largest: best ? abs(best[0]) : "", alt: el.alt || "", w: Math.round(b.width), h: Math.round(b.height), naturalW: el.naturalWidth, naturalH: el.naturalHeight, y: Math.round(b.top + scrollY) });
      } else if (el.tagName === "VIDEO" || el.tagName === "SOURCE") {
        const src = el.currentSrc || el.src;
        if (src) images.push({ type: "video", url: abs(src), poster: el.poster ? abs(el.poster) : "", w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.top + scrollY) });
      } else {
        const m = getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)/);
        if (m && b.width > 200 && b.height > 120) images.push({ type: "background", url: abs(m[1]), w: Math.round(b.width), h: Math.round(b.height), y: Math.round(b.top + scrollY) });
      }
    }
    const seen = new Set();
    const uniq = images.filter((i) => i.url && !i.url.startsWith("data:") && !seen.has(i.url) && seen.add(i.url));
    const tally = (list) => Object.entries(list.reduce((c, k) => ((c[k] = (c[k] || 0) + 1), c), {})).sort((a, b) => b[1] - a[1]);
    const els = [...document.querySelectorAll("body *")].slice(0, 3000);
    const hex = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return a < 0.5 ? null : "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""); };
    const fonts = tally(els.map((e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/["']/g, "").trim())).slice(0, 8).map(([f, n]) => ({ font: f, uses: n }));
    const colors = (prop) => tally(els.map((e) => hex(getComputedStyle(e)[prop])).filter(Boolean)).slice(0, 10).map(([c, n]) => ({ color: c, uses: n }));
    const logos = [...document.querySelectorAll("header img, header svg, [class*='logo' i] img, [class*='logo' i] svg, img[alt*='logo' i], a[href='/'] img")].slice(0, 6).map((e) => (e.tagName === "IMG" ? abs(e.currentSrc || e.src) : "inline svg: " + e.outerHTML.slice(0, 300)));
    const nav = [...document.querySelectorAll("nav a, header a")].map((x) => ({ text: (x.innerText || "").trim().replace(/\s+/g, " "), href: abs(x.getAttribute("href") || "") })).filter((x) => x.text && x.href).slice(0, 60);
    const icons = [...document.querySelectorAll("link[rel*='icon'], meta[property='og:image']")].map((e) => abs(e.href || e.content));
    return { html: document.documentElement.outerHTML, text: document.body.innerText, images: uniq, styles: { title: document.title, description: document.querySelector("meta[name='description']")?.content || "", fonts, textColors: colors("color"), backgroundColors: colors("backgroundColor"), logos, icons, nav } };
  });
  const w = (ext, v) => fs.writeFileSync(path.join(outDir, `${name}.${ext}`), typeof v === "string" ? v : JSON.stringify(v, null, 1));
  w("html", "<!doctype html>\n" + data.html); w("txt", data.text); w("images.json", data.images); w("styles.json", data.styles);
  const words = (data.text.match(/\S+/g) || []).length;
  console.log(`ok ${name}: ${words} words, ${data.images.length} images and videos, ${data.styles.nav.length} nav links -> ${outDir}`);
  if (words < 80) console.log("note: very little visible text; the site may block automated browsers. Try the Wayback Machine copy (https://web.archive.org/web/2/<url>).");
} catch (e) {
  console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
  await browser.close();
  process.exit(1);
}
await browser.close();
