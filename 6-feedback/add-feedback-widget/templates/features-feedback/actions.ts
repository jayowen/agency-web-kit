'use server';

import { db } from '@/lib/db';
import { feedback, adminAuditLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { updateFeedbackStatusSchema } from './schemas';

// Triage is super_admin-only. `requireAdmin` would pass org-level admins, and
// server actions are invocable from any page regardless of the /admin
// middleware guard — so gate explicitly, mirroring src/features/admin/actions.ts.
async function getAdminSession() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'super_admin') {
    throw new Error('Unauthorized: Super Admin required');
  }
  return session;
}

async function logAction(
  adminUserId: string,
  action: string,
  targetId: string,
  details?: unknown,
) {
  await db.insert(adminAuditLog).values({
    adminUserId,
    action,
    targetType: 'feedback',
    targetId,
    details,
  });
}

export async function updateFeedbackStatusAction(data: unknown) {
  const session = await getAdminSession();

  const parsed = updateFeedbackStatusSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, status } = parsed.data;

  const [before] = await db
    .select({ status: feedback.status })
    .from(feedback)
    .where(eq(feedback.id, id))
    .limit(1);
  if (!before) return { error: 'Feedback not found' };

  // Closing feedback nulls the screenshot: the v1 retention mitigation so
  // resolved/dismissed reports don't keep sensitive page captures (and their
  // backup footprint) around indefinitely. Reopening simply has no screenshot.
  const closesFeedback = status === 'resolved' || status === 'dismissed';

  const updateData: { status: string; updatedAt: Date; screenshot?: null } = {
    status,
    updatedAt: new Date(),
  };
  if (closesFeedback) updateData.screenshot = null;

  await db.update(feedback).set(updateData).where(eq(feedback.id, id));

  // Audit details carry status only — never the screenshot or other large
  // columns, which would defeat the nulling mitigation by copying captures
  // into the (unpruned) admin_audit_log.
  await logAction(session.user.id, 'update_feedback_status', String(id), {
    before: { status: before.status },
    after: { status },
  });

  revalidatePath('/admin/feedback');
  return { success: true };
}
