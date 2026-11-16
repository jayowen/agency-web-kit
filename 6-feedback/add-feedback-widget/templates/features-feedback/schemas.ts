import { z } from 'zod';

// ─── Constants (shared with UI) ──────────────────────────────────────

export const FEEDBACK_TYPES = ['bug', 'feature', 'removal_request'] as const;
export const FEEDBACK_STATUSES = ['new', 'reviewed', 'resolved', 'dismissed'] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature: 'Feature request',
  removal_request: 'Removal request',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

// Screenshot is a base64 JPEG data URL. Capture settings target 80-300 KB; the
// ~1 MB string cap is generous headroom that still bounds blob-storage abuse.
// (The submit route additionally gates the whole POST body at ~2 MB via
// Content-Length before this schema ever runs.)
export const SCREENSHOT_DATA_URL_PREFIX = 'data:image/jpeg;base64,';
export const MAX_SCREENSHOT_CHARS = 1_500_000;

const base64Payload = /^[A-Za-z0-9+/]+={0,2}$/;

// Every captured field is attacker-controlled JSON — the route trusts the
// session for identity, nothing in the body. Validate accordingly.
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export const createFeedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  comment: z.string().trim().min(1, 'Comment is required').max(5000),
  // Restricted to http/https so a `javascript:`-style URL can never be rendered
  // as a clickable link in the super_admin review view.
  url: z.string().max(2000).refine(isHttpUrl, 'Invalid URL'),
  userAgent: z.string().max(500).optional().default(''),
  screenWidth: z.number().int().positive().max(100000).optional(),
  screenHeight: z.number().int().positive().max(100000).optional(),
  viewportWidth: z.number().int().positive().max(100000).optional(),
  viewportHeight: z.number().int().positive().max(100000).optional(),
  screenshot: z
    .string()
    .max(MAX_SCREENSHOT_CHARS, 'Screenshot too large')
    .nullish()
    .refine(
      (v) =>
        v == null ||
        v === '' ||
        (v.startsWith(SCREENSHOT_DATA_URL_PREFIX) &&
          base64Payload.test(v.slice(SCREENSHOT_DATA_URL_PREFIX.length))),
      'Invalid screenshot',
    ),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export const updateFeedbackStatusSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(FEEDBACK_STATUSES),
});

export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>;
