import { MAX_SCREENSHOT_CHARS } from '@/features/feedback/schemas';

// Best-effort client-side page screenshot for the feedback widget. DOM-to-image
// is inherently lossy and can fail (tainted/cross-origin images, huge DOMs), so
// every failure path returns null and the form proceeds without a screenshot.

const CAPTURE_SCALE = 0.75;
const JPEG_QUALITY = 0.7;
const CAPTURE_TIMEOUT_MS = 4000;
// JPEG has no alpha channel — without a background, transparent regions render
// black. White matches the app's light surfaces closely enough for a thumbnail.
const BACKGROUND_COLOR = '#ffffff';

/** Resolve to null if `p` doesn't settle within `ms` (bounds how long the form
 *  waits — not how long the underlying work runs). Exported for testing. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** True for an http(s) image hosted on a different origin than the page. The
 *  app CSP's connect-src blocks fetching these during capture (e.g. Google
 *  avatars on lh3.googleusercontent.com), so they're excluded up front rather
 *  than left to fail per-resource. Exported for testing. */
export function isCrossOriginImageSrc(src: string, pageOrigin: string): boolean {
  if (!src || src.startsWith('data:')) return false;
  try {
    return new URL(src, pageOrigin).origin !== pageOrigin;
  } catch {
    return false;
  }
}

function captureFilter(node: Node): boolean {
  if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
    // Excludes the chat panel, chat button, feedback sheet + overlay, and any
    // secret-bearing UI tagged data-feedback-exclude.
    if (node.dataset?.feedbackExclude !== undefined) return false;
  }
  if (typeof HTMLImageElement !== 'undefined' && node instanceof HTMLImageElement) {
    const src = node.currentSrc || node.src;
    if (isCrossOriginImageSrc(src, window.location.origin)) return false;
  }
  return true;
}

function cropToViewport(source: HTMLCanvasElement): HTMLCanvasElement {
  const sx = Math.max(0, Math.round(window.scrollX * CAPTURE_SCALE));
  const sy = Math.max(0, Math.round(window.scrollY * CAPTURE_SCALE));
  const sw = Math.min(Math.round(window.innerWidth * CAPTURE_SCALE), source.width - sx);
  const sh = Math.min(Math.round(window.innerHeight * CAPTURE_SCALE), source.height - sy);
  if (sw <= 0 || sh <= 0) return source;
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

function downscale(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(source.width * factor));
  out.height = Math.max(1, Math.round(source.height * factor));
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

/**
 * Capture the current viewport as a base64 JPEG data URL, or null on any
 * failure/timeout/oversize. The capture excludes data-feedback-exclude nodes
 * (the panel itself) and cross-origin images (CSP-blocked), is cropped to the
 * visible viewport, and is downscaled once if it exceeds the storage cap.
 */
export async function capturePageScreenshot(): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const { domToCanvas } = await import('modern-screenshot');
    const full = await withTimeout(
      domToCanvas(document.body, {
        scale: CAPTURE_SCALE,
        backgroundColor: BACKGROUND_COLOR,
        filter: captureFilter,
      }),
      CAPTURE_TIMEOUT_MS,
    );
    if (!full) return null;

    const cropped = cropToViewport(full);
    let dataUrl = cropped.toDataURL('image/jpeg', JPEG_QUALITY);
    if (dataUrl.length > MAX_SCREENSHOT_CHARS) {
      dataUrl = downscale(cropped, 0.66).toDataURL('image/jpeg', 0.6);
    }
    return dataUrl.length > MAX_SCREENSHOT_CHARS ? null : dataUrl;
  } catch {
    return null;
  }
}
