// Checks homepage concepts: real photo above the fold, horizontal overflow, broken images,
// missing alt text, h1 count, em dashes and JS errors, at 1440px and 390px.
// Usage: node qa.mjs <concept-folder> [<concept-folder> ...]   (folders that contain concept/index.html)
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const dirs = process.argv.slice(2).map((d) => path.resolve(d));
if (!dirs.length) { console.error("usage: node qa.mjs <concept-folder> [...]"); process.exit(1); }
const browser = await chromium
  .launch({ channel: "chrome" })
  .catch(() => chromium.launch());
const out = {};

async function check(dir) {
  const slug = path.relative(path.join(dir, "..", ".."), dir).split(path.sep).slice(-2).join("/");
  const file = path.join(dir, "concept", "index.html");
  if (!fs.existsSync(file)) { out[dir] = ["no concept/index.html"]; console.log(`${dir}: no concept/index.html`); return; }
  const html = fs.readFileSync(file, "utf8");
  const text = html.replace(
    /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g,
    "",
  );
  const issues = [];
  if (text.includes(String.fromCharCode(8212)) || text.includes("&mdash;")) issues.push("em dash in page text");
  // Message and conversion checks run on concepts built with them (meta.json has primary_action, or the page marks a data-cta="primary" button).
  let wantsCta = false;
  // meta.json sits beside concept/ for a single concept; an option's notes live in <root>/research/option-<x>.json.
  const letter = path.basename(dir).toLowerCase();
  for (const m of [path.join(dir, "meta.json"), path.join(dir, "..", "..", "research", `option-${letter}.json`), path.join(dir, "research", "option-a.json")]) {
    try { if (JSON.parse(fs.readFileSync(m, "utf8")).primary_action) { wantsCta = true; break; } } catch {}
  }
  for (const [w, h, mobile] of [
    [1440, 900, false],
    [390, 844, true],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message.split("\n")[0]));
    await page
      .goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 45000 })
      .catch((e) => errs.push("load: " + e.message.split("\n")[0]));
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 40));
      }
      scrollTo(0, 0);
    });
    await page.waitForTimeout(600);
    // Largest real photo or video visible in the first screen, as a share of the viewport.
    const fold = await page.evaluate(() => {
      scrollTo(0, 0);
      const vw = innerWidth, vh = innerHeight;
      const seen = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.15) return false; } return true; };
      const share = (r) => Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / (vw * vh);
      let best = 0, total = 0;
      for (const el of document.querySelectorAll("img, video, [style*='background'], section, header, div, figure")) {
        let photo = false;
        if (el.tagName === "IMG") { const src = (el.currentSrc || el.src || "").toLowerCase(); photo = el.naturalWidth >= 300 && !/\.svg|logo|icon|favicon|wordmark|logomark/.test(src); }
        else if (el.tagName === "VIDEO") photo = true;
        else { const bg = getComputedStyle(el).backgroundImage; photo = /url\(.*\.(jpe?g|png|webp|avif)/i.test(bg) && !/logo|icon|texture|grain|noise|pattern/i.test(bg); }
        if (!photo || !seen(el)) continue;
        if (el.tagName === "IMG" || el.tagName === "VIDEO") total += share(el.getBoundingClientRect());
        best = Math.max(best, share(el.getBoundingClientRect()));
      }
      return Math.round(Math.max(best, total * 0.6) * 100);
    });
    const r = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      h1: document.querySelectorAll("h1").length,
      broken: [...document.images]
        .filter(
          (i) => i.complete && i.naturalWidth === 0 && i.getAttribute("src"),
        )
        .map((i) => i.getAttribute("src")),
      noAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
    }));
    // Conversion path: primary call to action in the first screen, repeated, linked for real; tap-to-call; phone height.
    const cta = await page.evaluate(() => {
      scrollTo(0, 0);
      const vw = innerWidth, vh = innerHeight;
      const vis = (el) => { const b = el.getBoundingClientRect(); if (!b.width || !b.height) return false; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.15) return false; } return true; };
      const all = [...document.querySelectorAll('[data-cta="primary"]')];
      const fold = all.filter(vis).filter((el) => { const b = el.getBoundingClientRect(); return b.top >= 0 && b.bottom <= vh && b.right > 0 && b.left < vw; });
      const bad = all.map((el) => el.getAttribute("href")).filter((h) => h !== null).filter((h) => { const t = h.trim(); if (!t || t === "#") return true; if (t.startsWith("#")) return !document.getElementById(decodeURIComponent(t.slice(1))); return false; });
      return {
        n: all.length, fold: fold.length, bad,
        small: fold.length > 0 && fold.every((el) => el.getBoundingClientRect().height < 44),
        phoneText: /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(document.body.innerText),
        tel: !!document.querySelector('a[href^="tel:"]'),
        height: document.documentElement.scrollHeight,
      };
    });
    if (wantsCta || cta.n) {
      if (!cta.n) { if (w === 1440) issues.push('meta.json has primary_action but no button is marked data-cta="primary"'); }
      else {
        if (!cta.fold) issues.push(`no primary call to action fully inside the first screen at ${w}px`);
        if (w === 390 && cta.small) issues.push("primary call to action in the first screen is under 44px tall at 390px");
        if (w === 1440 && cta.n < 3) issues.push(`primary call to action marked ${cta.n} time(s); put it in the header, the first screen and the close`);
        if (w === 1440 && cta.bad.length) issues.push(`primary call to action links nowhere: ${cta.bad.slice(0, 3).join(", ")}`);
      }
      if (w === 390 && cta.phoneText && !cta.tel) issues.push("a phone number shows but nothing is a tap-to-call (tel:) link");
      if (w === 390 && cta.height > 10000) issues.push(`phone page is ${cta.height}px tall; keep it under about 10,000px`);
    }
    if (fold < 15) issues.push(`no real photo above the fold at ${w}px (largest covers ${fold}% of the first screen; need 15%+)`);
    if (r.sw > w + 1)
      issues.push(`horizontal overflow at ${w}px (${r.sw}px wide)`);
    if (w === 1440 && r.h1 !== 1) issues.push(`${r.h1} h1 tags`);
    if (w === 1440 && r.broken.length)
      issues.push(`broken images: ${r.broken.slice(0, 4).join(", ")}`);
    if (w === 1440 && r.noAlt) issues.push(`${r.noAlt} images without alt`);
    if (errs.length)
      issues.push(`JS errors at ${w}px: ${errs.slice(0, 2).join(" | ")}`);
    await ctx.close();
  }
  out[slug] = issues;
  if (issues.length) console.log(`${slug}: ${issues.join("; ")}`);
}

const queue = [...dirs];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) await check(queue.shift());
  }),
);
await browser.close();
const bad = Object.values(out).filter((v) => v.length).length;
console.log(`checked ${dirs.length}, ${bad} with issues`);
process.exit(bad ? 1 : 0);
