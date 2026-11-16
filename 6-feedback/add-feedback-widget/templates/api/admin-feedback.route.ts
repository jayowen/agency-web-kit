import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFeedbackList } from '@/features/feedback/queries';

// List is metadata-only (no screenshot column — see getFeedbackList).
// super_admin required: re-checked here as defense-in-depth even though
// middleware already guards /api/admin/**.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const type = searchParams.get('type') || undefined;
  const orgIdRaw = searchParams.get('orgId');
  const orgId = orgIdRaw ? Number(orgIdRaw) : undefined;

  const rows = await getFeedbackList({
    status,
    type,
    organizationId: orgId !== undefined && !Number.isNaN(orgId) ? orgId : undefined,
  });
  return NextResponse.json(rows);
}
