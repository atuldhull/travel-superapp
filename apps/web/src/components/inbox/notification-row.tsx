/**
 * V.UX.26 — single inbox row. Renders the templateId (humanised) +
 * the payload's `subject` if present, plus three actions:
 *
 *   - Tap → mark-read + navigate to payload.url (or /trips on miss).
 *   - "Archive" button → soft-archive (the lister default omits archived).
 *   - "Delete" → hard-delete (kept for parity with existing surface).
 *
 * Read state is reflected with an unread dot. The action buttons
 * disable while their mutation is pending.
 *
 * Installed by prompt [V.UX.26].
 */
'use client';

import type { ReactNode } from 'react';
import { RelativeTime } from '../ui/relative-time';

interface NotificationRowProps {
  readonly id: string;
  readonly templateId: string;
  readonly status: string;
  readonly read: boolean;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly subject: string | null;
  readonly body: string | null;
  readonly url: string | null;
  readonly archiving: boolean;
  readonly deleting: boolean;
  readonly onOpen: () => void;
  readonly onArchive: () => void;
  readonly onDelete: () => void;
}

export function NotificationRow(props: NotificationRowProps): ReactNode {
  const {
    templateId,
    status,
    read,
    createdAt,
    subject,
    body,
    archiving,
    deleting,
    onOpen,
    onArchive,
    onDelete,
  } = props;
  return (
    <li className="flex items-start gap-3 rounded border border-muted/15 p-3 text-sm">
      <span
        aria-hidden
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${read ? 'bg-muted/30' : 'bg-brand'}`}
      />
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
        <p className="text-xs text-muted">
          {humaniseTemplateId(templateId)} · {status} · <RelativeTime at={createdAt} />
        </p>
        {subject ? <p className="mt-1 font-medium leading-snug">{subject}</p> : null}
        {body ? <p className="mt-1 text-xs text-muted line-clamp-2">{body}</p> : null}
      </button>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={onArchive}
          disabled={archiving}
          className="rounded-md border border-muted/30 px-2 py-1 text-xs hover:bg-muted/10 disabled:opacity-50"
          aria-label="Archive"
        >
          📥 Archive
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-md border border-danger/30 px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
          aria-label="Delete"
        >
          🗑 Delete
        </button>
      </div>
    </li>
  );
}

function humaniseTemplateId(id: string): string {
  return id
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
