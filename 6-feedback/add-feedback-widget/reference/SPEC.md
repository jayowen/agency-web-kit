# Feedback feature — stack-neutral specification (source of truth)

This is the canonical definition of the feature, independent of any framework.
**Build to THIS spec in whatever stack the target app uses.** The Next.js code
in `templates/` is ONE reference implementation of this spec — read it to see a
concrete, hardened example, but never treat it as the requirement. The
requirement is here.

If you only read one file before building, read this one.

---

## 1. Capabilities (what the feature does)

1. **Submit feedback** — any signed-in user can open a form and send:
   - a **type**: `bug` | `feature` | `removal_request`
   - a free-text **comment** (required, ≤5000 chars)
   - an optional **screenshot** of the current page (auto-captured, best-effort)
   - **page context** captured automatically: URL, user-agent, screen +
     viewport dimensions.
2. **Launcher** — a floating button on every authenticated page opens the form.
   (If the app already has a help/chat affordance, the form may live there too.)
3. **Admin review queue** — an admin-only screen lists all submissions, filter
   by status and type, opens a detail view (with the screenshot + context), and
   changes status: `new` | `reviewed` | `resolved` | `dismissed`.

That is the entire feature. Everything below is how to realize it correctly.

**If the app has no user auth** (e.g. a public tool or marketing site): keep the
feature, adapt the gate. Submit becomes **public** (still rate-limited, body-capped,
and validated per §3/§4); the admin review queue is gated by the host's admin
mechanism — a shared **admin token** (Bearer header / one-time prompt cached in
`sessionStorage`), HTTP basic auth, an allowlisted email via the host's access
control, or similar. Identity fields (§2) just stay null. Do **not** refuse the
feature or skip persistence because there's no login — persistence (§2.0) is still
mandatory. Confirm the admin gate with the user (it's a config seam, §7).

---

## 2. Data model

### 2.0 Persistence is mandatory and must be durable + server-side

Feedback **must** land in a durable, server-side datastore so an admin on a
*different* device can see what everyone submitted. This is the whole point of the
feature — a feedback inbox no one but the submitter can read is not the feature.

- **Never** treat client-only storage as the destination: `localStorage`,
  `sessionStorage`, `IndexedDB`, in-memory, or an ephemeral container filesystem
  (a disk with no attached volume) do **not** count as persistence. A client-side
  mirror is fine *only* as an offline fallback — never the system of record.
- **Pick the store that fits the host platform**, then provision and wire it as
  part of this task (don't leave it as a TODO). Default mapping:

  | Host / platform | Best-suited persistent store | How it's wired |
  |---|---|---|
  | App already has a primary DB (Rails/Django/Laravel/Express/etc.) | that same DB | add the `feedback` table via the app's migration tool |
  | Railway | Railway Postgres | `railway add --database postgres`; reference `DATABASE_URL` into the service |
  | Render / Fly.io / Heroku | managed Postgres add-on | provision; read `DATABASE_URL` |
  | Vercel | Vercel Postgres / Neon / Turso (or Vercel KV for light volume) | serverless route + connection string |
  | Netlify | Neon/Supabase Postgres (or Netlify Blobs) | function + connection string |
  | Cloudflare Pages / Workers | D1 (SQLite) — or KV/Durable Objects | `wrangler d1` binding |
  | Supabase / Firebase app | its Postgres / Firestore | add table/collection |
  | Static-only host, **no** server (e.g. plain Cloudflare Pages, GitHub Pages, S3) | add the smallest backend the host supports (a serverless function + a managed DB) — or move the app onto a host with a server | see below |

- **Static-only with no backend at all:** the feature cannot centralize feedback
  without *some* server. Do not silently ship localStorage and call it done.
  Either add the smallest serverless function + managed DB the platform offers, or
  surface to the user that a backend is required and propose the cheapest option
  for their host. State the choice; then build it.
- **Verify a row actually lands in that store** (SPEC §7 / SKILL step 7) before
  considering the task complete — not just that the client said "sent".

### 2.1 Table

One table, `feedback`. Fields, types, semantics:

| Field | Type | Null? | Source | Semantics |
|---|---|---|---|---|
| id | serial PK | no | db | |
| organization_id | FK→orgs | yes | session | OMIT if app is single-tenant |
| user_id | FK→users | yes | session | ON DELETE SET NULL |
| submitter_name | text | yes | session | denormalized snapshot (survives user deletion) |
| submitter_email | text | yes | session | denormalized snapshot |
| type | text | no | body | bug \| feature \| removal_request |
| comment | text | no | body | ≤5000 chars |
| url | text | yes | body | http/https only |
| user_agent | text | yes | body | |
| screen_width/height | int | yes | body | |
| viewport_width/height | int | yes | body | |
| screenshot | text | yes | body | base64 JPEG data URL; **nulled on close** |
| impersonator_user_id | text | yes | session | OMIT if no impersonation |
| was_impersonating | bool | no(def false) | session | OMIT if no impersonation |
| status | text | no(def 'new') | server | new \| reviewed \| resolved \| dismissed |
| created_at / updated_at | timestamp | no | db | |

Indexes: `status`, `created_at`, `organization_id` (drop the last if single-tenant).
Portable DDL is in `templates/migration.sql` (works for any SQL database; adjust
types for MySQL/SQLite — e.g. `SERIAL`→`AUTO_INCREMENT`/`INTEGER PRIMARY KEY`,
`BOOLEAN`→`TINYINT`, `JSONB`→`JSON`/`TEXT`). Optional `admin_audit_log` table
included there.

For document/NoSQL stores: one `feedback` collection with the same fields; emulate
the indexes; statuses/types as string enums.

---

## 3. API contract (framework-neutral)

Three operations. Implement as HTTP routes, RPC, or server actions — whatever is
idiomatic — but keep these contracts.

### A. Submit — `POST /api/feedback` (any signed-in user; or public if the app has no auth)
- **Auth**: must be authenticated → else `401`. **If the app has no user auth, submit is public** (the rate limit + body cap + validation below are then the only gate — keep them strict).
- **Rate limit**: per-IP then per-user (reference: 20/10min IP, 5/10min user) → `429`.
- **Body cap**: reject bodies over ~2MB *before* parsing → `413`.
- **Validate** body → `422` on failure: `type` in enum; `comment` non-empty ≤5000;
  `url` is http/https; screenshot (if present) is a `data:image/jpeg;base64,…`
  string under ~1.5MB.
- **Identity from the session, never the body**: set user_id, submitter_name,
  submitter_email, organization_id, impersonation flags from the authenticated
  session.
- Insert row with `status='new'`. Return `200/201`.

### B. List — `GET /api/admin/feedback` (admin only)
- **Auth**: admin → else `403`. **Re-check inside the handler** (don't rely on
  middleware/router guards alone).
- Optional filters: `status`, `type`, (`orgId` if multi-tenant).
- Return metadata for each row **excluding the screenshot column** (keeps the
  list small). Newest first.

### C. Detail — `GET /api/admin/feedback/:id` (admin only)
- **Auth**: admin → else `403`, re-checked in handler.
- Return the full row **including** the screenshot. This is the only place the
  screenshot is served.

### D. Update status — admin action `update(id, status)` (admin only)
- **Auth**: admin → else error, re-checked in handler.
- Read current status, set new status + `updated_at`.
- **If new status is `resolved` or `dismissed`, set `screenshot = NULL`** (the
  retention mitigation — see invariants).
- If an audit log exists, record `{ before, after }` status — **never** the
  screenshot or other large columns.

---

## 4. Security invariants (must hold in every implementation)

These are the reason to build this spec rather than a naive form. Full rationale
in `ARCHITECTURE.md`; the non-negotiables:

1. Identity is server-derived; the body carries only the report.
2. Submit is rate-limited (IP then user). Never ship it unlimited.
3. Body size is capped before parsing; screenshot string separately capped.
4. URL accepted only if http/https (blocks `javascript:` links in the admin view).
5. Screenshot validated as a base64 JPEG data URL (or empty/null).
6. Screenshot nulled when a report is resolved/dismissed; audit log stores status
   only (never the capture).
7. Admin authorization re-checked inside every admin route/action.
8. List excludes the screenshot column; only detail returns it.
9. Output is inert in the admin UI: comment rendered as plain text (never
   markup), screenshot only as an image (never a link), URL linkified **only when
   same-origin** (foreign origins shown as text).
10. Screenshot capture excludes sensitive / cross-origin / opted-out nodes.
11. Feedback persists to a durable, server-side datastore (SPEC §2.0). Client-only
    storage is never the destination; an admin on another device must be able to
    read every submission.

---

## 5. Client capture behavior (where a browser DOM exists)

A best-effort page screenshot, captured client-side when the form opens:
- Render the current viewport to a **JPEG data URL** (downscaled, e.g. ~0.75
  scale, quality ~0.7; crop to the visible viewport).
- **Exclude** opted-out nodes (the panel itself + any secret-bearing UI, via a
  marker attribute/class like `data-feedback-exclude`) and cross-origin images
  (often CSP-blocked).
- **Time-box** it (~4s) and **fail soft**: on any error/timeout/oversize return
  null and submit without a screenshot.
- Read URL + dimensions at the same instant as capture so they describe the same
  page state.
- Implementation libs by ecosystem: web/React → `modern-screenshot` (used in the
  reference) or `html2canvas`/`html-to-image`; if none is acceptable, ship the
  feature **without** screenshots (the whole pipeline already treats it as
  optional — see config seam below). Native/mobile apps: use the platform's
  view-snapshot API, or omit.

---

## 6. UX / behavior spec

**Form** (in launcher panel or chat panel):
- Type selector → comment textarea → screenshot preview (with remove button) →
  context line ("Sending from <path> · <vp>×<vp>") → Send.
- On open: kick off capture; show a skeleton while capturing, the thumbnail when
  done, or a "screenshot unavailable" note on failure.
- Submit disabled until type + non-empty comment.
- On a `422` when a screenshot was attached, **retry once without it** so the
  report still lands; tell the user it was sent without the image.
- Success state with "Send another" / "Done"; reset draft on done.

**Launcher**: floating button on authenticated pages, visually distinct, carries
the exclude marker so it's not in its own screenshot.

**Admin review screen**: filterable table (Date, [Org], Submitter, Type, Comment,
Status; an "impersonated" badge if applicable) → row opens a detail dialog with
status dropdown, the comment (plain text), full context, and the screenshot.

---

## 7. Configuration seams (decide once, apply in any stack)

These are the only things that vary per app. Decide each with the user, then
apply consistently across schema, API, and UI:

| Seam | Options | Effect |
|---|---|---|
| **Persistence target** (required) | the host's best-suited durable store (SPEC §2.0) | which DB/driver + how it's provisioned and wired; never client-only |
| **Auth model** | full user auth / public submit + token-gated admin | whether submit requires a session or is open; how the admin queue is gated |
| **Tenancy** | multi-tenant / single-tenant | keep vs drop `organization_id` + org joins + Org column |
| **Admin gate** | which session signal = "admin" (or shared admin token if no auth) | replaces the reviewer authorization check everywhere |
| **Impersonation** | present / absent | keep vs drop the two impersonation fields + badges |
| **Audit log** | present / absent | keep vs drop status-change logging |
| **Screenshot** | enabled / disabled | include capture lib + preview, or ship text-only |
| **Launcher home** | standalone button / existing chat-help panel | where the form mounts |

---

## 8. Mapping the concepts to common stacks

The feature uses five generic capabilities. Map each to the target's idiom — do
not import Next.js assumptions. Quick map:

| Concept | Next.js (reference) | Rails | Django | Laravel | SvelteKit/Remix/Express+React |
|---|---|---|---|---|---|
| Persistence / migration | Drizzle + SQL | ActiveRecord migration | Django model + migration | Eloquent + migration | Prisma/Knex/SQL |
| Auth / session | NextAuth `auth()` | Devise/`current_user` | `request.user` | `Auth::user()` | Lucia/Auth.js/Passport |
| Route / endpoint | App Router route | controller + routes.rb | view + urls.py | controller + routes | framework router |
| Admin gate | role check in handler | `before_action` + re-check | permission/decorator + re-check | middleware + policy re-check | guard + in-handler re-check |
| Submit UI / capture | React + modern-screenshot | ERB/Hotwire + html-to-image | template + html-to-image | Blade + html-to-image | component + capture lib |
| Admin queue UI | React table + dialog | ERB/Hotwire table | Django template/admin | Blade table | component table + modal |

Principle: **read the spec for the contract, read the target codebase for the
idiom, and write code that looks like the rest of that app** — same router style,
ORM, auth helper, component conventions, and naming. The Next.js templates are a
behavioral reference (especially for the security invariants and the capture
edge-cases), not a structure to mirror.

If a target capability genuinely doesn't exist, adapt rather than stub:
- **No user auth** → public submit + token-gated admin (see the note under §1).
  Don't skip the feature or drop persistence; just change the gate.
- **No existing datastore** → provision the host's best-suited one (§2.0). Persistence
  is mandatory; it is never satisfied by client-only storage.
The one thing you cannot do without is *some* server-side persistence — if the host
truly can't run any backend, surface that and propose the smallest option (§2.0).
