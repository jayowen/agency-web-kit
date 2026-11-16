import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFeedbackById } from '@/features/feedback/queries';

// Detail includes the screenshot data URL. super_admin required (re-checked
// here as defense-in-depth; this is the only route that returns the capture).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const row = await getFeedbackById(numId);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}
