'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Loader2, X, ImageOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  type FeedbackType,
} from '@/features/feedback/schemas';
import { capturePageScreenshot } from './capture';

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

type CaptureStatus = 'idle' | 'capturing' | 'done' | 'failed';

interface PageContext {
  url: string;
  screenW: number;
  screenH: number;
  vpW: number;
  vpH: number;
}

export interface FeedbackDraft {
  type: FeedbackType | '';
  comment: string;
  /** Captured data URL, or null if it failed / was removed. */
  screenshot: string | null;
  /** User explicitly removed the screenshot. */
  removed: boolean;
  captureStatus: CaptureStatus;
  /** URL + dimensions, read at the same instant capture starts so the stored
   *  screenshot and URL describe the same page state. */
  context: PageContext | null;
}

export const emptyFeedbackDraft: FeedbackDraft = {
  type: '',
  comment: '',
  screenshot: null,
  removed: false,
  captureStatus: 'idle',
  context: null,
};

function readContext(): PageContext {
  return {
    url: window.location.href,
    screenW: window.screen?.width ?? window.innerWidth,
    screenH: window.screen?.height ?? window.innerHeight,
    vpW: window.innerWidth,
    vpH: window.innerHeight,
  };
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || '/';
  } catch {
    return url;
  }
}

interface FeedbackFormProps {
  draft: FeedbackDraft;
  setDraft: Dispatch<SetStateAction<FeedbackDraft>>;
  /** Called when the user finishes (Done / close). The host returns to chat or
   *  closes its sheet. */
  onClose: () => void;
}

export function FeedbackForm({ draft, setDraft, onClose }: FeedbackFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [droppedScreenshot, setDroppedScreenshot] = useState(false);
  const firstFieldRef = useRef<HTMLButtonElement>(null);
  const captureIdRef = useRef(0);

  // Capture once when the form opens (and again after "Send another" resets the
  // draft to idle). Guarded on captureStatus so remounting the panel does not
  // re-capture an already-captured draft. URL/dims are read synchronously here
  // so they match the screenshot's moment.
  //
  // We deliberately do NOT cancel the scheduled capture in a cleanup: this
  // effect re-runs the instant it flips captureStatus 'idle' -> 'capturing', and
  // a cleanup would abort the very capture we just scheduled (leaving the draft
  // stuck on 'capturing' forever). Stale results are instead ignored via a
  // monotonic capture-id guard, so a newer capture session always wins.
  useEffect(() => {
    if (draft.captureStatus !== 'idle') return;
    const myCaptureId = captureIdRef.current + 1;
    captureIdRef.current = myCaptureId;
    setDraft((prev) => ({ ...prev, captureStatus: 'capturing', context: readContext() }));

    const run = () => {
      capturePageScreenshot().then((shot) => {
        if (captureIdRef.current !== myCaptureId) return; // superseded by a newer capture
        setDraft((prev) => ({
          ...prev,
          screenshot: prev.removed ? null : shot,
          captureStatus: shot ? 'done' : 'failed',
        }));
      });
    };
    const w = window as WindowWithIdleCallback;
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 1000 });
    else window.setTimeout(run, 50);
  }, [draft.captureStatus, setDraft]);

  // Move focus to the first field when the form mounts.
  useEffect(() => {
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, []);

  const canSubmit = draft.type !== '' && draft.comment.trim().length > 0 && !submitting;

  async function postFeedback(screenshot: string | null): Promise<Response> {
    const ctx = draft.context ?? readContext();
    return fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: draft.type,
        comment: draft.comment.trim(),
        url: ctx.url,
        userAgent: navigator.userAgent,
        screenWidth: ctx.screenW,
        screenHeight: ctx.screenH,
        viewportWidth: ctx.vpW,
        viewportHeight: ctx.vpH,
        screenshot,
      }),
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const hasShot = !draft.removed && !!draft.screenshot;
    try {
      let res = await postFeedback(hasShot ? draft.screenshot : null);
      let dropped = false;
      // An oversized/invalid screenshot is the likely 422 cause — retry once
      // without it so the report still lands.
      if (res.status === 422 && hasShot) {
        res = await postFeedback(null);
        dropped = res.ok;
      }
      if (res.ok) {
        setDroppedScreenshot(dropped);
        setSubmitted(true);
        return;
      }
      const body = await res.json().catch(() => null);
      setError(body?.error || 'Could not send feedback. Please try again.');
    } catch {
      setError('Could not send feedback. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function sendAnother() {
    setSubmitted(false);
    setError(null);
    setDroppedScreenshot(false);
    setDraft(emptyFeedbackDraft);
  }

  if (submitted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Thanks for the feedback!</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {droppedScreenshot
              ? 'Submitted without the screenshot (it was too large).'
              : 'It’s been sent to the team.'}
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" onClick={sendAnother}>
            Send another
          </Button>
          <Button
            size="sm"
            onClick={() => {
              // Clear the submitted draft so reopening starts fresh (no stale
              // comment/screenshot, no accidental resubmission).
              setDraft(emptyFeedbackDraft);
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">What kind of feedback?</label>
        <Select
          value={draft.type || undefined}
          onValueChange={(v) => setDraft((prev) => ({ ...prev, type: v as FeedbackType }))}
        >
          <SelectTrigger ref={firstFieldRef}>
            <SelectValue placeholder="Choose a category…" />
          </SelectTrigger>
          <SelectContent>
            {FEEDBACK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {FEEDBACK_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="feedback-comment">
          Tell us more
        </label>
        <Textarea
          id="feedback-comment"
          value={draft.comment}
          onChange={(e) => setDraft((prev) => ({ ...prev, comment: e.target.value }))}
          placeholder="Describe the bug, the feature you'd like, or what should be removed…"
          rows={5}
          maxLength={5000}
        />
      </div>

      {/* Screenshot preview */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Screenshot</label>
        {draft.captureStatus === 'capturing' && (
          <div className="h-28 w-full animate-pulse rounded-md border border-border bg-muted" />
        )}
        {draft.captureStatus === 'done' && draft.screenshot && !draft.removed && (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.screenshot}
              alt="Page screenshot"
              className="max-h-28 rounded-md border border-border object-contain"
            />
            <button
              type="button"
              aria-label="Remove screenshot"
              onClick={() => setDraft((prev) => ({ ...prev, removed: true, screenshot: null }))}
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {(draft.captureStatus === 'failed' || draft.removed) && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            <ImageOff className="h-4 w-4 shrink-0" />
            <span>{draft.removed ? 'Screenshot removed — not included.' : 'Screenshot unavailable — sending without it.'}</span>
          </div>
        )}
      </div>

      {/* Context line */}
      {draft.context && (
        <p className="text-[11px] text-muted-foreground">
          Sending from <span className="font-medium">{shortUrl(draft.context.url)}</span> · {draft.context.vpW}×{draft.context.vpH}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="mt-auto flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send feedback
        </Button>
      </div>
    </div>
  );
}
