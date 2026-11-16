import { db } from '@/lib/db';
import { feedback, organizations } from '@/lib/db/schema';
import { and, desc, eq, type SQL } from 'drizzle-orm';

// NOTE: feedback is reviewed cross-org by super_admin, so these queries
// intentionally do NOT filter by organizationId (the usual org-isolation rule).
// They are only ever called from super_admin-gated /api/admin/feedback routes.

export interface FeedbackListFilters {
  status?: string;
  type?: string;
  organizationId?: number;
}

/**
 * Cross-org feedback list for the admin review queue. Selects metadata only —
 * the screenshot column is deliberately excluded so list payloads stay small
 * (screenshots can be hundreds of KB each). The detail view fetches the
 * screenshot separately via getFeedbackById.
 */
export async function getFeedbackList(filters: FeedbackListFilters = {}) {
  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(feedback.status, filters.status));
  if (filters.type) conditions.push(eq(feedback.type, filters.type));
  if (filters.organizationId !== undefined) {
    conditions.push(eq(feedback.organizationId, filters.organizationId));
  }

  return db
    .select({
      id: feedback.id,
      organizationId: feedback.organizationId,
      organizationName: organizations.name,
      userId: feedback.userId,
      submitterName: feedback.submitterName,
      submitterEmail: feedback.submitterEmail,
      type: feedback.type,
      comment: feedback.comment,
      url: feedback.url,
      status: feedback.status,
      impersonatorUserId: feedback.impersonatorUserId,
      wasImpersonating: feedback.wasImpersonating,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
    })
    .from(feedback)
    .leftJoin(organizations, eq(feedback.organizationId, organizations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(feedback.createdAt));
}

export type FeedbackListItem = Awaited<ReturnType<typeof getFeedbackList>>[number];

/** Full feedback row (including the screenshot data URL) for the detail view. */
export async function getFeedbackById(id: number) {
  const [row] = await db
    .select({
      id: feedback.id,
      organizationId: feedback.organizationId,
      organizationName: organizations.name,
      userId: feedback.userId,
      submitterName: feedback.submitterName,
      submitterEmail: feedback.submitterEmail,
      type: feedback.type,
      comment: feedback.comment,
      url: feedback.url,
      userAgent: feedback.userAgent,
      screenWidth: feedback.screenWidth,
      screenHeight: feedback.screenHeight,
      viewportWidth: feedback.viewportWidth,
      viewportHeight: feedback.viewportHeight,
      screenshot: feedback.screenshot,
      status: feedback.status,
      impersonatorUserId: feedback.impersonatorUserId,
      wasImpersonating: feedback.wasImpersonating,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
    })
    .from(feedback)
    .leftJoin(organizations, eq(feedback.organizationId, organizations.id))
    .where(eq(feedback.id, id))
    .limit(1);

  return row ?? null;
}

export type FeedbackDetail = NonNullable<Awaited<ReturnType<typeof getFeedbackById>>>;
