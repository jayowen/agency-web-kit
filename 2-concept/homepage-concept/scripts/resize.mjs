// Resize and recompress photos without any image software (it uses the browser the skill installs).
// Works the same on macOS, Windows and Linux.
//
// Usage: node resize.mjs <file-or-folder> [...] [--max 2000] [--quality 82] [--out <folder>]
//   Photos wider or taller than --max are scaled down; JPEGs over about 400KB are recompressed.
//   Without --out, files are replaced in place. PNGs with transparency stay PNG; SVG and GIF are skipped.
// Prints one line per file: name, old size -> new size, pixel size.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : d; };
const max = Number(flag("max", 2000)), quality = Number(flag("quality", 82)) / 100, outDir = flag("out", "");
const inputs = args.filter((x, i) => !x.startsWith("--") && !(args[i - 1] || "").startsWith("--"));
if (!inputs.length) { console.error("usage: node resize.mjs <file-or-folder> [...] [--max 2000] [--quality 82] [--out <folder>]"); process.exit(1); }
const files = [];
for (const p of inputs) {
  if (!fs.existsSync(p)) { console.log(`skip ${p}: not found`); continue; }
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) files.push(path.join(p, f)); else files.push(p);
}
const photos = files.filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f) && fs.statSync(f).isFile());
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif" };

const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const page = await browser.newPage();
await page.setContent("<!doctype html><html><body></body></html>");
for (const f of photos) {
  const buf = fs.readFileSync(f);
  const ext = path.extname(f).toLowerCase();
  const r = await page.evaluate(async ({ b64, mime, max, quality }) => {
    const img = new Image();
    img.src = `data:${mime};base64,${b64}`;
    try { await img.decode(); } catch { return { error: "cannot decode" }; }
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, w, h);
    let alpha = false;
    if (mime !== "image/jpeg") { const s = g.getImageData(0, 0, Math.min(w, 400), Math.min(h, 400)).data; for (let i = 3; i < s.length; i += 4) if (s[i] < 250) { alpha = true; break; } }
    const outMime = alpha ? "image/png" : mime === "image/png" ? "image/png" : "image/jpeg";
    return { w, h, scaled: scale < 1, outMime, data: c.toDataURL(outMime, quality).split(",")[1] };
  }, { b64: buf.toString("base64"), mime: MIME[ext], max, quality });
  if (r.error) { console.log(`skip ${path.basename(f)}: ${r.error}`); continue; }
  const out = Buffer.from(r.data, "base64");
  // Keep the original when re-encoding gained nothing. A file that is already small stays as it is,
  // even if its pixel size is over --max (an optimized PNG often grows when it is re-encoded).
  if (out.length >= buf.length * (r.scaled ? 1 : 0.95)) {
    if (outDir) fs.copyFileSync(f, path.join(outDir, path.basename(f)));
    console.log(`keep ${path.basename(f)}: ${Math.round(buf.length / 1024)}KB, ${r.w}x${r.h}`);
    continue;
  }
  const keepExt = (r.outMime === "image/png" && ext === ".png") || (r.outMime === "image/jpeg" && /^\.jpe?g$/.test(ext));
  const dest = path.join(outDir || path.dirname(f), path.basename(f, path.extname(f)) + (keepExt ? ext : r.outMime === "image/png" ? ".png" : ".jpg"));
  fs.writeFileSync(dest, out);
  if (!outDir && dest !== f) fs.unlinkSync(f);
  console.log(`ok ${path.basename(dest)}: ${Math.round(buf.length / 1024)}KB -> ${Math.round(out.length / 1024)}KB, ${r.w}x${r.h}`);
}
await browser.close();
