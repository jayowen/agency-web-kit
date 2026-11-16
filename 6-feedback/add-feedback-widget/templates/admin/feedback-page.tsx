'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2, ExternalLink, UserCog } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { updateFeedbackStatusAction } from '@/features/feedback/actions';
import type { FeedbackListItem, FeedbackDetail } from '@/features/feedback/queries';
import {
  FEEDBACK_TYPES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_STATUS_LABELS,
} from '@/features/feedback/schemas';
import { staggerFadeUp } from '@/lib/animations';

const QUERY_CACHE = { staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false };

const { container, item } = staggerFadeUp;

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'outline'> = {
  new: 'default',
  reviewed: 'secondary',
  resolved: 'outline',
  dismissed: 'outline',
};

function fmtDate(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Only linkify URLs on the app's own origin. The URL is submitter-controlled,
// so a foreign-origin link in the super_admin's highest-privilege session is a
// phishing/navigation vector — render those as plain text instead.
function isSameOriginHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function AdminFeedbackPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: rows = [], isLoading } = useQuery<FeedbackListItem[]>({
    queryKey: ['admin-feedback', statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/admin/feedback?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    ...QUERY_CACHE,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<FeedbackDetail>({
    queryKey: ['admin-feedback-detail', selectedId],
    enabled: selectedId !== null,
    queryFn: async () => {
      const res = await fetch(`/api/admin/feedback/${selectedId}`);
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    ...QUERY_CACHE,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      updateFeedbackStatusAction({ id, status }),
    onSuccess: (r) => {
      if (r && 'error' in r && r.error) return;
      queryClient.invalidateQueries({ queryKey: ['admin-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['admin-feedback-detail'] });
    },
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground mt-1">{rows.length} submission{rows.length === 1 ? '' : 's'}</p>
      </motion.div>

      <motion.div variants={item} className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {FEEDBACK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {FEEDBACK_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{FEEDBACK_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {rows.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No feedback yet"
          description="Bug reports, feature requests, and removal requests submitted from the app will appear here."
        />
      ) : (
        <motion.div variants={item} className="rounded-lg border overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Org</th>
                <th className="px-4 py-2 font-medium">Submitter</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Comment</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDate(row.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.organizationName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{row.submitterName || row.submitterEmail || 'Unknown'}</span>
                      {row.wasImpersonating && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <UserCog className="h-3 w-3" /> Impersonated
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant="secondary">{FEEDBACK_TYPE_LABELS[row.type as keyof typeof FEEDBACK_TYPE_LABELS] ?? row.type}</Badge>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{row.comment}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={STATUS_BADGE[row.status] ?? 'outline'}>
                      {FEEDBACK_STATUS_LABELS[row.status as keyof typeof FEEDBACK_STATUS_LABELS] ?? row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Detail */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feedback detail</DialogTitle>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{FEEDBACK_TYPE_LABELS[detail.type as keyof typeof FEEDBACK_TYPE_LABELS] ?? detail.type}</Badge>
                {detail.wasImpersonating && (
                  <Badge variant="outline" className="gap-1">
                    <UserCog className="h-3 w-3" /> Submitted while impersonating
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Select
                    value={detail.status}
                    onValueChange={(v) => updateStatus.mutate({ id: detail.id, status: v })}
                    disabled={updateStatus.isPending}
                  >
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {updateStatus.data && 'error' in updateStatus.data && updateStatus.data.error && (
                <p className="text-sm text-destructive">{String(updateStatus.data.error)}</p>
              )}

              {/* Comment — rendered as plain text (never markup). */}
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
                {detail.comment}
              </div>

              {/* Context */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Submitter</dt>
                <dd>{detail.submitterName || '—'}{detail.submitterEmail ? ` · ${detail.submitterEmail}` : ''}</dd>
                <dt className="text-muted-foreground">Org</dt>
                <dd>{detail.organizationName ?? '—'}</dd>
                <dt className="text-muted-foreground">URL</dt>
                <dd className="break-all">
                  {detail.url && isSameOriginHttpUrl(detail.url) ? (
                    <a href={detail.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {detail.url} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span>{detail.url || '—'}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Browser</dt>
                <dd className="break-all">{detail.userAgent || '—'}</dd>
                <dt className="text-muted-foreground">Screen</dt>
                <dd>
                  {detail.screenWidth ? `${detail.screenWidth}×${detail.screenHeight}` : '—'}
                  {detail.viewportWidth ? ` (viewport ${detail.viewportWidth}×${detail.viewportHeight})` : ''}
                </dd>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd>{fmtDate(detail.createdAt)}</dd>
              </dl>

              {/* Screenshot — rendered only as an image, never a link. */}
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Screenshot</p>
                {detail.screenshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.screenshot} alt="Page screenshot" className="w-full rounded-md border" />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No screenshot {detail.status === 'resolved' || detail.status === 'dismissed' ? '(removed when closed)' : 'was captured'}.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
