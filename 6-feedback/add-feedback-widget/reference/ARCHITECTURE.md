# Feedback feature — architecture & security invariants

Read this so the port preserves *why* the code is shaped the way it is. These
properties are the reason to copy this implementation instead of writing a
naive feedback form.

## Data flow

```
Signed-in user
   │  clicks floating button (FeedbackLauncher)  ── or staff: a "Send feedback"
   │                                                view inside the chat panel
   ▼
FeedbackForm (client)
   │  on open: capture.ts → modern-screenshot domToCanvas → crop to viewport
   │           → JPEG data URL (or null on any failure/timeout/oversize)
   │  reads url + screen/viewport dims at the same instant as capture
   │  POST /api/feedback  { type, comment, url, userAgent, dims, screenshot }
   ▼
POST /api/feedback (server)
   │  auth() — must be signed in (else 401)
   │  rate-limit by IP (20/10min) then by user (5/10min) → 429
   │  Content-Length cap (~2MB) → 413
   │  Zod (createFeedbackSchema) → 422
   │  IDENTITY FROM SESSION ONLY (name/email/org/userId/impersonation flags)
   │  INSERT feedback row, status='new'
   ▼
DB: feedback table
   ▲
   │  GET /api/admin/feedback         (super-admin) → list, NO screenshot column
   │  GET /api/admin/feedback/[id]    (super-admin) → detail WITH screenshot
   │  updateFeedbackStatusAction      (super-admin) → status change + audit log
   ▼
Admin review page /admin/feedback (client)
      table + detail dialog + status dropdown
```

## Security invariants (do not regress)

1. **Identity is server-derived.** The POST body carries only the report
   (type/comment/url/dims/screenshot). `submitterName`, `submitterEmail`,
   `userId`, `organizationId`, and impersonation flags come from the session.
   Never trust the body for identity.
2. **Rate limited.** IP gate first (bounds an unauthenticated burst), then a
   per-user gate. Both via the in-memory `rate-limit.ts` (best-effort; swap for
   Redis on multi-instance for hard guarantees).
3. **Body-size capped before parse.** The body is read as a stream and cut off past ~2MB (a Content-Length check alone is bypassable), before
   `JSON.parse`; the screenshot string is separately capped (~1.5MB) in the
   schema. Prevents giant-payload abuse.
4. **URL is http/https only.** `createFeedbackSchema` rejects other schemes so a
   `javascript:` URL can never become a clickable link in the admin's
   highest-privilege session.
5. **Screenshot shape is validated.** Must start with `data:image/jpeg;base64,`
   and have a valid base64 payload, or be null/empty.
6. **Screenshot nulled on close.** Resolving/dismissing a report sets
   `screenshot = NULL` — a retention mitigation so closed reports don't keep
   page captures (and their backup footprint) around. The audit log stores
   status only, never the screenshot, so the nulling isn't defeated by copying
   the capture into an unpruned log.
7. **Admin routes re-check the role** inside the handler (defense in depth) even
   though middleware guards `/api/admin/**`. Server actions are invocable from
   any page, so `updateFeedbackStatusAction` gates explicitly too.
8. **List excludes the screenshot column.** Only the per-id detail route returns
   it — keeps list payloads small and limits where captures are exposed.
9. **Output is inert.** The admin page renders the comment as plain text
   (`whitespace-pre-wrap`, never markup), the screenshot only as an `<img>`
   (never a link), and linkifies the URL **only when same-origin** (foreign
   origins render as text — anti-phishing in the admin session).
10. **Capture excludes sensitive/uncapturable nodes.** `data-feedback-exclude`
    nodes (the panel itself, secret-bearing UI) and cross-origin images
    (CSP-blocked) are filtered out of the screenshot.

## Roles & visibility

- **Submitter**: any signed-in user. Reachable by all roles — the submit route
  is the real guard, not the middleware allowlist.
- **Reviewer**: `super_admin` in the reference app. Reads are cross-org *by
  design* (one inbox for the whole product), so `queries.ts` intentionally does
  NOT filter by `organizationId`. They are only called from super-admin-gated
  routes. If you change the reviewer role, keep the "only called from gated
  routes" property.

## Field reference (feedback table)

| Column | Source | Notes |
|---|---|---|
| type | body | bug \| feature \| removal_request |
| comment | body | ≤5000 chars |
| url, userAgent, screen/viewport dims | body | context for repro |
| screenshot | body | base64 JPEG data URL, nullable, nulled on close |
| userId | session | ON DELETE SET NULL |
| submitterName / submitterEmail | session | denormalized snapshot (survives user deletion) |
| organizationId | session | nullable, no cascade (multi-tenant only) |
| impersonatorUserId / wasImpersonating | session | tags reports sent during impersonation |
| status | server | new \| reviewed \| resolved \| dismissed |
