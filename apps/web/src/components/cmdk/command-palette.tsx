/**
 * V.UX.29 — global Cmd+K command palette. Built on `cmdk`.
 *
 * Bindings:
 *   - `mod+k` (Cmd on macOS, Ctrl elsewhere) opens the palette.
 *   - `Esc` closes it (cmdk handles this internally on the Dialog).
 *
 * Items:
 *   - Navigate to /trips, /trips/new, /discover, /near-me, /inbox,
 *     /memory-books, /account/preferences, /accessibility.
 *   - Sign out (clears the in-memory + cookie auth state and bounces
 *     to /login).
 *
 * The palette uses a portal-rendered `Command.Dialog` so it floats
 * above every other element including the persistent FABs. Search
 * filters items by their visible label + an optional `keywords`
 * string that includes synonyms for fuzzy matching.
 *
 * Installed by prompt [V.UX.29].
 */
'use client';

import { useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useShortcut } from '../../lib/use-shortcuts';
import { useAuthToken } from '../../lib/use-auth-token';
import { announce } from '../../lib/announce';

interface NavItem {
  readonly value: string;
  readonly label: string;
  readonly path: string;
  readonly keywords?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { value: 'trips', label: 'Trips', path: '/trips', keywords: 'list itinerary' },
  { value: 'new-trip', label: 'New trip', path: '/trips/new', keywords: 'create plan' },
  { value: 'discover', label: 'Discover hidden gems', path: '/discover', keywords: 'explore' },
  { value: 'near-me', label: 'Near me', path: '/near-me', keywords: 'nearby spontaneous' },
  { value: 'inbox', label: 'Inbox', path: '/inbox', keywords: 'notifications' },
  { value: 'memory-books', label: 'Memory books', path: '/memory-books', keywords: 'photos' },
  {
    value: 'preferences',
    label: 'Account preferences',
    path: '/account/preferences',
    keywords: 'settings family budget comfort nomad',
  },
  {
    value: 'accessibility',
    label: 'Accessibility statement',
    path: '/accessibility',
    keywords: 'a11y wcag',
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthToken();

  useShortcut(
    'mod+k',
    (e) => {
      e.preventDefault();
      setOpen((v) => !v);
    },
    { allowInInput: true },
  );

  function go(path: string, label: string) {
    setOpen(false);
    announce(`Navigating to ${label}`);
    router.push(path as never);
  }

  async function signOut() {
    setOpen(false);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* best-effort */
    }
    queryClient.clear();
    announce('Signed out');
    router.replace('/login' as never);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter
      className="fixed left-1/2 top-24 z-50 w-[min(92vw,520px)] -translate-x-1/2 overflow-hidden rounded-lg border border-muted/30 bg-surface shadow-2xl"
      overlayClassName="fixed inset-0 z-40 bg-black/40"
    >
      <Command.Input
        placeholder="Type a command or search…"
        className="w-full border-b border-muted/20 bg-transparent px-4 py-3 text-sm text-surface-foreground outline-none placeholder:text-muted"
      />
      <Command.List className="max-h-80 overflow-y-auto py-2">
        <Command.Empty className="px-4 py-3 text-sm text-muted">No matches.</Command.Empty>
        <Command.Group heading="Go to" className="px-2 text-xs font-medium text-muted">
          {NAV_ITEMS.map((it) => (
            <Command.Item
              key={it.value}
              value={`${it.value} ${it.label} ${it.keywords ?? ''}`}
              onSelect={() => go(it.path, it.label)}
              className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-surface-foreground aria-selected:bg-brand/10 aria-selected:text-brand"
            >
              <span aria-hidden>→</span>
              <span>{it.label}</span>
            </Command.Item>
          ))}
        </Command.Group>
        {token !== null ? (
          <Command.Group heading="Account" className="px-2 text-xs font-medium text-muted">
            <Command.Item
              value="sign-out logout"
              onSelect={() => void signOut()}
              className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-danger aria-selected:bg-danger/10"
            >
              <span aria-hidden>↩</span>
              <span>Sign out</span>
            </Command.Item>
          </Command.Group>
        ) : null}
      </Command.List>
      <div className="flex items-center justify-between border-t border-muted/20 px-3 py-2 text-[10px] text-muted">
        <span>↑↓ navigate · Enter select · Esc close</span>
        <span>Cmd+K toggles</span>
      </div>
    </Command.Dialog>
  );
}
