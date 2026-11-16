// ─── Feedback ────────────────────────────────────────────────────────
//
// Drop this into your Drizzle schema file (alongside your `users` /
// `organizations` tables). Adapt the FK references to your own table names.
//
// Multi-tenant note: if your app is single-tenant, DELETE the organizationId
// column and its index, and remove the organizations join in queries.ts.
//
// Impersonation note: impersonatorUserId / wasImpersonating only matter if your
// auth supports impersonation. Keep the columns (cheap, nullable) even if you
// never set them — or drop them and remove the two lines that set them in
// api/feedback.route.ts.
//
// Notes on the design choices (carried from the reference app):
//  - organizationId is a nullable FK with NO cascade: an admin with no org can
//    still submit. Hand-delete feedback rows before deleting an org.
//  - userId is ON DELETE SET NULL; submitterName/submitterEmail are a
//    denormalized snapshot so attribution survives user deletion.
//  - screenshot holds a base64 JPEG data URL (best-effort client capture),
//    nulled when feedback is resolved/dismissed to bound at-rest exposure.

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  // OPTIONAL (multi-tenant only): organizationId FK, nullable, no cascade.
  organizationId: integer('organization_id').references(() => organizations.id),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  submitterName: text('submitter_name'),
  submitterEmail: text('submitter_email'),
  type: text('type').notNull(), // bug | feature | removal_request
  comment: text('comment').notNull(),
  url: text('url'),
  userAgent: text('user_agent'),
  screenWidth: integer('screen_width'),
  screenHeight: integer('screen_height'),
  viewportWidth: integer('viewport_width'),
  viewportHeight: integer('viewport_height'),
  screenshot: text('screenshot'), // base64 JPEG data URL, nullable
  impersonatorUserId: text('impersonator_user_id'), // OPTIONAL (impersonation)
  wasImpersonating: boolean('was_impersonating').default(false).notNull(),
  status: text('status').notNull().default('new'), // new | reviewed | resolved | dismissed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_feedback_status').on(t.status),
  index('idx_feedback_created_at').on(t.createdAt),
  index('idx_feedback_organization_id').on(t.organizationId), // drop if single-tenant
]);

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

// ─── Admin audit log (OPTIONAL) ──────────────────────────────────────
// actions.ts logs status changes here. If your app has no audit-log table,
// either create this one or delete the logAction() calls from actions.ts.
export const adminAuditLog = pgTable('admin_audit_log', {
  id: serial('id').primaryKey(),
  adminUserId: text('admin_user_id').references(() => users.id).notNull(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
