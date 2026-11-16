import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { feedback } from '@/lib/db/schema';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { createFeedbackSchema } from '@/features/feedback/schemas';

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const USER_LIMIT = 5;
const IP_LIMIT = 20;
// Route handlers buffer the whole body before Zod runs; cap it first. The
// screenshot is capped at ~1 MB by the schema, leaving ~1 MB for the rest.
const MAX_BODY_BYTES = 2_000_000;

// Reachable by ALL roles (added to middleware nonStaffAllowedPaths). The
// session check below — not the middleware allowlist — is the real guard.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // IP gate first so an unauthenticated/burst flood is bounded before the
  // per-user limit. Both are best-effort (in-memory, per-instance).
  const ip = getClientIp(request);
  const ipLimit = rateLimit(`feedback:ip:${ip}`, IP_LIMIT, WINDOW_MS);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 });
  }
  const userLimit = rateLimit(`feedback:user:${session.user.id}`, USER_LIMIT, WINDOW_MS);
  if (!userLimit.allowed) {
    const mins = Math.max(1, Math.ceil((userLimit.resetAt - Date.now()) / 60000));
    return NextResponse.json(
      { error: `You've sent several reports recently. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429 },
    );
  }

  // Fast reject on a declared oversize body, then enforce the cap on the bytes
  // actually read: Content-Length can be missing (chunked) or wrong.
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  const raw = await readBodyCapped(request, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = createFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid feedback' }, { status: 422 });
  }
  const data = parsed.data;

  // Identity comes from the session, never the body. Impersonation is tagged
  // for both flavors: user-impersonation exposes originalUserId; org- and
  // user-impersonation both set isImpersonating.
  const submitterName =
    `${session.user.firstName ?? ''} ${session.user.lastName ?? ''}`.trim() || session.user.name || null;

  await db.insert(feedback).values({
    organizationId: session.user.organizationId ?? null,
    userId: session.user.id,
    submitterName,
    submitterEmail: session.user.email ?? null,
    type: data.type,
    comment: data.comment,
    url: data.url,
    userAgent: data.userAgent || null,
    screenWidth: data.screenWidth ?? null,
    screenHeight: data.screenHeight ?? null,
    viewportWidth: data.viewportWidth ?? null,
    viewportHeight: data.viewportHeight ?? null,
    screenshot: data.screenshot || null,
    impersonatorUserId: session.user.originalUserId ?? null,
    wasImpersonating: session.user.isImpersonating ?? false,
    status: 'new',
  });

  return NextResponse.json({ success: true });
}

// Reads the request body as a stream and stops once it passes maxBytes.
// Returns the text, or null if the body is too large.
async function readBodyCapped(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}
