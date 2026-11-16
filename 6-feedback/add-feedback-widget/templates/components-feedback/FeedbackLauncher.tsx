'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { FeedbackForm, emptyFeedbackDraft, type FeedbackDraft } from './FeedbackForm';

/**
 * Standalone feedback entry point for client/contractor users, who never mount
 * the staff chat panel. A floating button (distinct icon + visible label so it
 * is not mistaken for the staff chat bubble) opens a right-side sheet with the
 * shared form. Draft lives here so it survives the sheet unmounting on close.
 */
export function FeedbackLauncher() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft>(emptyFeedbackDraft);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Send feedback"
        data-feedback-exclude=""
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg ring-2 ring-primary/20 transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </motion.button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          data-feedback-exclude=""
          className="flex w-full flex-col p-0 sm:max-w-[420px]"
        >
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-center gap-2 pr-6">
              <MessageSquarePlus className="h-4 w-4 shrink-0 text-primary" />
              <SheetTitle className="truncate text-base">Send feedback</SheetTitle>
            </div>
            <SheetDescription className="sr-only">
              Report a bug, request a feature, or ask for something to be removed.
            </SheetDescription>
          </SheetHeader>
          <FeedbackForm draft={draft} setDraft={setDraft} onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
