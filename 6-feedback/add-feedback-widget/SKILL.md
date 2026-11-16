---
name: add-feedback-widget
description: Add an in-app feedback widget (bug / feature request / removal request) with screenshot capture and an admin review queue to a web app. A floating button opens a form, captures the page as an image, and stores submissions in the database for admin triage. Use when the user wants to add "feedback", "report a bug" / "bug report", a "feedback button/widget", in-app user feedback, or a feedback inbox to one of their apps. Works in ANY stack: the feature is defined by a stack-neutral spec, with a hardened Next.js/Drizzle/NextAuth reference implementation included to copy or translate.
---

# Add Feedback Widget

Adds an in-app feedback feature to a web app: a floating button opens a form
(type + comment + auto-captured screenshot), a hardened submit endpoint stores
it, and an admin review queue triages submissions by status.

**The feature is defined once, stack-neutrally, in [`reference/SPEC.md`](reference/SPEC.md)**, 
capabilities, data model, API contract, security invariants, UX, and the
configuration seams. That spec is the source of truth. `templates/` holds ONE
hardened reference implementation (Next.js · Drizzle · NextAuth · Tailwind/Radix)
of that spec. Build to the spec in whatever stack the target app uses; use the
templates as a concrete example (and a fast path when the target is the same
stack), never as the requirement.

This means the same feature definition serves every app, you don't re-describe
the features per stack. You read the spec for *what*, read the target codebase
for *how that app does things*, and write idiomatic code.

## When to use

- "Add a feedback button / widget to [app]"
- "Let users report bugs / request features from inside the app"
- "I need a feedback inbox / review queue for admins"

Works regardless of framework (Next.js, Rails, Django, Laravel, SvelteKit, Remix,
Express+React, static-site-on-a-Node-host, etc.). The one hard requirement is
**durable, server-side persistence**, feedback must reach a real datastore an
admin on another device can read (SPEC §2.0); client-only storage is never the
destination. Auth is *not* required: if the app has authenticated users + an admin
role, use them; if it has no login (a public tool), submit becomes public and the
admin queue is gated by a shared admin token (SPEC §1, §3A). Adapt the gate, never
skip persistence.

## Process

### 0. Read the spec
Read `reference/SPEC.md` first, it is the single definition of every feature,
field, endpoint, and invariant. Skim `reference/ARCHITECTURE.md` for the security
rationale. You will build to these no matter the stack.

### 1. Detect the target stack
Probe; don't assume. Identify: framework/router, ORM/DB + migration convention,
auth/session getter and what it exposes (especially an admin signal), tenancy
(is there an organizations concept?), whether impersonation and an audit-log
table exist, the UI toolkit, and the import/path conventions.

Also identify **where this app is deployed and what durable store it can reach**
(SPEC §2.0): an existing primary DB? a platform that offers managed Postgres/D1/KV
(Railway, Render, Fly, Vercel, Netlify, Cloudflare, Supabase…)? or a static-only
host with no backend? This decides the persistence target, a required seam, not an
afterthought. And note whether the app even has a login; if not, plan for public
submit + a token-gated admin queue.

### 2. Pick the path

- **Next.js-family (App Router + Drizzle/Prisma + NextAuth-ish):** fast path, 
  copy the `templates/` files and adapt the seams. Use `reference/ADAPTATION.md`
  (it maps every Next.js-specific seam: aliases, ORM, session, tenancy, admin
  gate, impersonation, audit log, UI primitives, rate limiter, mount points,
  Next version param style, no-screenshot fallback).

- **Any other stack:** build from `reference/SPEC.md` idiomatically. Use
  `SPEC.md` §8 for the concept→stack mapping and §2/§3 for the exact data model
  and API contract. Open the matching `templates/` files as a **behavioral
  reference**, they show the hardening details and the screenshot capture
  edge-cases you must reproduce, but write code that looks like the target app
  (its router, ORM, auth helper, components, naming). Do not port Next.js
  structure.

### 3. Confirm the configuration seams with the user
From `SPEC.md` §7, decide and confirm (only ask where genuinely ambiguous):
the **persistence target** (which durable store, how it's provisioned, required,
never client-only), the **auth model** (full user auth vs public submit + token-gated
admin), tenancy (multi vs single), which session signal means "admin", keep/drop
impersonation, keep/drop audit log, screenshot enabled or text-only, and where
the launcher mounts. State the choices, then proceed.

### 4. Build
Implement the four operations (`SPEC.md` §3), the table (`SPEC.md` §2 / portable
DDL in `templates/migration.sql`), the form + launcher + capture (§5/§6), and the
admin queue (§6), in the target's idiom. **Preserve all ten security invariants
(§4)** regardless of stack; they are the point of using this skill instead of
writing a naive form. If the screenshot seam is on, wire a DOM-to-image lib
(reference uses `modern-screenshot`) or the platform snapshot API; if off, ship
the optional-screenshot path (everything already treats it as nullable).

### 5. Wire it in
- Mount the launcher on authenticated pages (or into an existing help/chat panel).
- Add an admin-nav entry to the review screen.
- If routes are role-gated, allow the submit endpoint for all signed-in users and
  keep the admin endpoints admin-only, and re-check admin **inside** each
  handler.
- Add the capture exclude-marker to the launcher/panel and any secret-bearing UI.

### 6. Provision + migrate the datastore
First make sure the host can reach a durable store (SPEC §2.0), if it has no DB
yet, **provision the best-suited one for the platform now** (e.g. on Railway:
`railway add --database postgres` then reference `DATABASE_URL` into the service;
on Cloudflare: a D1 binding; on Vercel/Netlify: a managed Postgres). Then apply the
migration (dev → verify → prod), matching the target's migration workflow.
`templates/migration.sql` is portable SQL; adjust types for the target DB
(MySQL/SQLite/Postgres/etc.) per `SPEC.md` §2. Do not leave persistence as a TODO
or fall back to localStorage as the store.

### 7. Verify
Typecheck/build; run the app; submit feedback with and without a screenshot and
**confirm a row actually lands in the real datastore** (query it, or read it back
through the admin API, not just that the client said "sent"); open the review
screen as admin (sign in, or use the admin token), change a status, confirm it
persists and that resolving/dismissing nulls the screenshot. Confirm a second
device / a fresh session can read the same submission. Use the app's preview/verify
flow to capture proof if available.

## Files in this skill

| File | Role |
|---|---|
| `reference/SPEC.md` | **Source of truth**, stack-neutral feature definition, data model, API contract, invariants, UX, config seams, stack-mapping |
| `reference/ARCHITECTURE.md` | Data flow + security rationale (the *why*) |
| `reference/ADAPTATION.md` | Next.js reference-impl porting guide (seam-by-seam), for the fast path |
| `templates/` | One hardened reference implementation (Next.js/Drizzle/NextAuth) + portable `migration.sql` + stack-agnostic `schema-snippet.ts` |

## Notes

- **Persistence is mandatory (SPEC §2.0).** Always wire feedback to a durable,
  server-side store best-suited to the host platform (provision it as part of this
  task). A client-side `localStorage`/`IndexedDB` mirror is acceptable only as an
  offline fallback, never the system of record. If the host genuinely can't run any
  backend, surface that and propose the smallest option, don't quietly ship
  client-only and call it done.
- **No auth ≠ no feature.** A public app still gets the widget: public submit
  (rate-limited + validated) and a token-gated admin queue. Adapt the gate.
- **Spec over templates.** When the target isn't Next.js, the templates inform
  *behavior and hardening*, not *structure*. Match the host app's conventions.
- **Never downgrade the security invariants** (`SPEC.md` §4) to fit a stack. If a
  stack makes one hard (e.g. no rate-limit store), flag it explicitly.
- **One source of truth for enums/labels.** Define the type/status enums + labels
  once in the target's shared module and import them into UI + validation.
- **Screenshots are best-effort everywhere.** Capture fails soft to null; the
  submit path retries once without the image on a validation failure. Keep both.
