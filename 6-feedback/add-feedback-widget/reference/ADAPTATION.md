# Adapting the templates to the target app (Next.js fast path)

> Scope: this guide is the **fast path for Next.js-family apps** that copy the
> reference templates. If the target is a different stack (Rails, Django,
> Laravel, SvelteKit, etc.), don't port these files — build from
> [`SPEC.md`](SPEC.md) idiomatically and use the templates only as a behavioral
> reference. `SPEC.md` is the source of truth in all cases.

The templates are verbatim, working code from a production SaaS app (Next.js App
Router · Drizzle · NextAuth · Tailwind · Radix). Each "seam" below is a place
where the target app likely differs. Work the seams in this order; most ports
only touch a few.

## Seam 1 — Import aliases
The templates import from `@/lib/...`, `@/features/...`, `@/components/...`.
Read the target `tsconfig.json` `compilerOptions.paths`. If the alias is `@/*`
mapped to `src/*`, most imports work unchanged. Otherwise rewrite the alias
prefix across the copied files. The internal `@/features/feedback/*` and
`@/components/feedback/*` imports just need to match where you place the files.

## Seam 2 — Database / ORM
**Drizzle (same as source):** drop `templates/schema-snippet.ts`'s `feedback`
table into the schema, fix the FK references (`users`, `organizations`) to the
target's table identifiers, export the inferred types. `queries.ts` /
`actions.ts` / `route.ts` use Drizzle query syntax as-is.

**Prisma or other ORM:** use `templates/migration.sql` to create the table
(ORM-agnostic), add an equivalent model to the Prisma schema, then translate the
three server files' query calls to the target ORM:
- `queries.ts`: two selects (list = metadata only, detail = include screenshot).
- `actions.ts`: select-current-status → update status (+ null screenshot on
  close) → optional audit insert.
- `api/feedback.route.ts`: one insert.
Keep the column semantics identical.

**Apply the migration** to dev first, verify, then prod, matching the target
project's migration workflow.

## Seam 3 — Auth / session contract
The templates call NextAuth's `auth()` and read:
`session.user.{ id, role, email, firstName?, lastName?, name?, organizationId?,
originalUserId?, isImpersonating? }`.

Replace `auth()` with the target's server-side session getter (Clerk
`auth()`/`currentUser()`, Supabase `getUser()`, Lucia `validateRequest()`,
etc.). Map fields:
- `id`, `email`, display name → required.
- `role` / admin signal → Seam 5.
- `organizationId` → Seam 4.
- impersonation fields → Seam 6 (drop if absent).

There are session reads in: `api/feedback.route.ts` (submitter identity),
`api/admin-feedback.route.ts` + `api/admin-feedback-id.route.ts` (admin gate),
`features-feedback/actions.ts` (admin gate). The form/launcher are client
components and need no session.

## Seam 4 — Tenancy (multi-tenant vs single-tenant)
**Multi-tenant (has organizations):** keep as-is. `organizationId` is set from
the session on insert; `queries.ts` left-joins `organizations` for the org name;
the admin list shows an Org column.

**Single-tenant:** remove the `organization_id` column + its index from the
schema/migration; in `queries.ts` drop the `organizations` join and the
`organizationId`/`organizationName` selects; in `api/feedback.route.ts` drop the
`organizationId` insert value; in `admin/feedback-page.tsx` remove the Org column
and the `organizationName` references.

## Seam 5 — Admin gate
Source gates the review surfaces on `session.user.role === 'super_admin'` in
three places (both admin routes + the server action). Replace that exact check
with the target's admin signal (e.g. `role === 'admin'`, `isAdmin`, a Clerk org
role). Keep the **re-check inside each handler** — middleware alone is not the
guard (server actions bypass route middleware).

## Seam 6 — Impersonation (optional)
If the target has no impersonation flow, drop these from
`api/feedback.route.ts`:
`impersonatorUserId: session.user.originalUserId ?? null` and
`wasImpersonating: session.user.isImpersonating ?? false` (insert `null`/`false`
or omit). In `admin/feedback-page.tsx` remove the "Impersonated" / "Submitted
while impersonating" badges. The columns can stay (harmless) or be dropped.

## Seam 7 — Audit log (optional)
`actions.ts` writes a status-change row to `admin_audit_log`. If the target has
no audit table: either create one (in `migration.sql`) or delete the
`logAction()` helper + its call in `actions.ts`. If the target HAS an audit
table with different columns, map the fields.

## Seam 8 — UI primitives
The form/launcher/admin page use Radix wrapper components: `Sheet`, `Select`,
`Dialog`, `Button`, `Textarea`, `Badge`, plus `framer-motion`, `lucide-react`,
and an `EmptyState` shared component, and a `cn()`/Tailwind setup.

- If the target has the same shadcn/Radix wrappers, imports mostly match — fix
  paths.
- Missing a primitive? Either add the shadcn component, or replace it with the
  target's equivalent / a plain element (e.g. a native `<select>`).
- No framer-motion? Replace `motion.button`/`motion.div` with plain elements and
  drop the `variants`/`initial`/`animate` props.
- `EmptyState` (admin page) can be inlined as a simple centered message.
- The animation import (`@/lib/animations` `staggerFadeUp`, `simpleFade`) is
  cosmetic — inline static variants or remove.

## Seam 9 — Rate limiter
`api/feedback.route.ts` imports `rateLimit` + `getClientIp` from
`@/lib/rate-limit`. If the target already has a limiter, use it. If not, copy
`templates/lib/rate-limit.ts`. It is in-memory (best-effort on multi-instance);
for hard guarantees on serverless, back it with Redis/Upstash. Do **not** ship
the submit route with no limiter — it is a public-ish authenticated write.

## Seam 10 — Mount points & middleware
- **Launcher**: import and render `<FeedbackLauncher />` inside the
  authenticated layout (the source mounts it for non-staff in the dashboard
  layout; staff get the form as a view inside an existing chat panel). For most
  apps, just mount the launcher in the main authenticated layout so it floats on
  every page.
- **Admin nav**: add `{ name: 'Feedback', href: '/admin/feedback' }` to the
  admin sidebar/nav.
- **Middleware**: if routes are role-gated, allowlist `POST /api/feedback` for
  all signed-in roles and keep `/api/admin/feedback/**` admin-only.
- **`data-feedback-exclude`**: the launcher/panel already carry it so the
  capture skips them. Add it to any other secret-bearing or floating UI you
  don't want in screenshots.

## Seam 11 — No screenshot library / dep refused
If `modern-screenshot` can't be added: in `FeedbackForm.tsx` make
`capturePageScreenshot()` always resolve `null` (or delete the capture effect
and the screenshot preview block). The form, API, schema, and DB all already
treat the screenshot as optional, so everything else works — submissions simply
have no image. Note this to the user as a reduced-fidelity mode.

## Dynamic route params (Next version)
`api/admin-feedback-id.route.ts` uses the Next 15/16 async-params signature:
`{ params }: { params: Promise<{ id: string }> }` with `const { id } = await
params;`. On Next 13/14, change it to the sync form:
`{ params }: { params: { id: string } }` and `const { id } = params;`.

## Quick checklist
- [ ] dep `modern-screenshot` installed (or capture stubbed)
- [ ] table created + migrated (dev → prod)
- [ ] aliases fixed in all copied files
- [ ] tenancy fork applied consistently
- [ ] `auth()` + admin gate replaced in 3 server files
- [ ] impersonation / audit-log lines kept or cleanly removed
- [ ] UI primitives resolve (or substituted)
- [ ] rate limiter present
- [ ] launcher mounted in authed layout; admin nav item added; middleware allowlist
- [ ] typecheck/build clean; submit + admin triage tested end-to-end
- [ ] security invariants from ARCHITECTURE.md preserved
