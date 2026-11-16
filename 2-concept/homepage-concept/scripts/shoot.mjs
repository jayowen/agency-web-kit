// Usage: node shoot.mjs <url-or-file> <outDir>
// Writes <outDir>/desktop.jpg (1440 wide, full page, capped) and <outDir>/mobile.jpg (390 wide).
// Exits 1 if either shot fails, so a blocked site is never mistaken for a finished capture.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const [, , target, outDir] = process.argv;
if (!target || !outDir) {
  console.error("usage: node shoot.mjs <url|file> <outDir>");
  process.exit(1);
}
const url = /^https?:/.test(target)
  ? target
  : pathToFileURL(path.resolve(target)).href;
fs.mkdirSync(outDir, { recursive: true });
let failed = 0;

const MAX_H = 16000;
const browser = await chromium.launch({ channel: process.env.SHOOT_CHANNEL || "chrome", args: ["--autoplay-policy=no-user-gesture-required"] }).catch(() => chromium.launch());
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
for (const [name, vp, mobile] of [
  ["desktop", { width: 1440, height: 900 }, false],
  ["mobile", { width: 390, height: 844 }, true],
]) {
  const ctx = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: mobile ? 1.5 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    userAgent: mobile ? undefined : UA,
  });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    // Scroll to trigger lazy loading and reveal animations
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight && y < 12000; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 180));
      }
      window.scrollTo(0, 0); await new Promise(r => setTimeout(r, document.querySelector("video, iframe[src*=vimeo], iframe[src*=youtube]") ? 5000 : 300));
      await new Promise((r) => setTimeout(r, 500));
    });
    // Force any scroll-reveal elements visible for the capture
    await page
      .addStyleTag({
        content:
          "[data-reveal],.reveal,.aos-init,[data-aos]{opacity:1!important;transform:none!important}",
      })
      .catch(() => {});
    const h = await page.evaluate(() =>
      document.documentElement.scrollHeight,
    );
    // Chrome cannot capture past ~16,384 device pixels; stay under it.
    const cap = mobile ? Math.floor(16300 / 1.5) : MAX_H;
    await page.screenshot({
      path: path.join(outDir, `${name}.jpg`),
      type: "jpeg",
      quality: 78,
      fullPage: true,
      clip:
        h > cap ? { x: 0, y: 0, width: vp.width, height: cap } : undefined,
    });
    console.log(`ok ${name} ${path.join(outDir, name + ".jpg")} (${h}px)`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
