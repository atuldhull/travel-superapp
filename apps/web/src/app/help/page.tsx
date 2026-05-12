/**
 * POST.6 — Help centre. Client-side filter over a 20-entry FAQ
 * grouped into 5 categories (Account, Trips, Safety, Privacy,
 * Billing). Each entry is an accordion item; search filters
 * across both question and answer.
 *
 * Pure client component — no API call. The FAQ is hand-curated
 * and updates with the app, not from a CMS. Keeping the content
 * inline means the page works offline + has zero load time.
 */
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

interface FaqEntry {
  readonly category: 'Account' | 'Trips' | 'Safety' | 'Privacy' | 'Billing';
  readonly q: string;
  readonly a: string;
}

const FAQ: readonly FaqEntry[] = [
  // Account
  {
    category: 'Account',
    q: 'How do I create an account?',
    a: 'Click "Sign up" on the landing page, enter your email + a password of at least 12 characters. We send a confirmation email via Resend. You can also sign in with Google — the button is right below the password form.',
  },
  {
    category: 'Account',
    q: 'I forgot my password. What now?',
    a: 'On the login page, click "Trouble signing in?" → "Reset password". We email a one-time link that lets you set a new password. The link is valid for 30 minutes.',
  },
  {
    category: 'Account',
    q: 'How do I delete my account?',
    a: 'Go to /account → Erase. We soft-delete immediately and hard-delete after a 7-day grace period (you can reactivate within those 7 days by signing in again). Backups age out within another 7 days.',
  },
  {
    category: 'Account',
    q: 'Can I export all my data?',
    a: 'Yes — /account → Export gives you an NDJSON download with every trip, photo metadata, caption, and event we have on you. Photos themselves are linked via short-TTL S3 URLs you can fetch with curl.',
  },
  // Trips
  {
    category: 'Trips',
    q: 'How does the AI trip planner work?',
    a: 'We send your trip title, centre coordinates, radius, and dates to an LLM (Anthropic Claude, Google Gemini Flash, or a local Ollama model — whichever is configured for that environment) with a tightly-scoped system prompt. The response is plain prose, never executed code. Failures fall back to a deterministic stub so the page never 500s.',
  },
  {
    category: 'Trips',
    q: 'Why does my plan look different each time?',
    a: "LLMs have temperature > 0 — variation is a feature, not a bug. If you want a stable plan, copy it into the itinerary editor; that one's persisted in the database.",
  },
  {
    category: 'Trips',
    q: 'Can I share a trip without giving someone an account?',
    a: 'Yes — open the trip, click "Shareable links → New code". Send the resulting URL to anyone; they get a read-only view + can clone it into their own account if they sign up.',
  },
  {
    category: 'Trips',
    q: 'How do I archive vs delete a trip?',
    a: 'Archive keeps the trip but hides it from your active list — recoverable from /trips → Archived tab. Delete is permanent; cascading deletes drop the itinerary, attached media references (SetNull), and shareable codes.',
  },
  // Safety
  {
    category: 'Safety',
    q: 'What does the SOS button do?',
    a: "Tapping it (or holding the persistent FAB) sends an SOS event to every trusted contact you've added under /account → Trusted contacts. Each contact gets an email + optional SMS (when Twilio is configured) with your last-known location.",
  },
  {
    category: 'Safety',
    q: 'How do I add trusted contacts?',
    a: '/account → Trusted contacts → Add. Up to 5 contacts; each one gets a confirmation email before the SOS surface activates them.',
  },
  {
    category: 'Safety',
    q: 'What about local emergency numbers?',
    a: 'Our /safety/emergency-numbers/:country endpoint returns the police / fire / ambulance numbers for the country of your current trip. The SOS modal links straight to the appropriate tel: URL.',
  },
  {
    category: 'Safety',
    q: 'How do I report a scam?',
    a: 'Open the place + click "Report scam" or use /safety → Report a scam. Reports go through admin moderation (verify or unverify) before they appear on the public scam layer.',
  },
  // Privacy
  {
    category: 'Privacy',
    q: 'Do you sell my data?',
    a: 'No. Never. See /privacy.',
  },
  {
    category: 'Privacy',
    q: 'Do you train AI on my content?',
    a: 'No. When you generate an AI plan, your prompt is sent to whichever provider is configured (Anthropic / Google / Ollama). We log the prompt + provider for cost accounting but never share it with anyone, and the providers themselves are bound by their privacy policies — Anthropic explicitly does not train on API traffic.',
  },
  {
    category: 'Privacy',
    q: 'What cookies do you set?',
    a: 'Only two: a refresh token (httpOnly + secure) and a CSRF token. Both are strictly necessary. No analytics, no advertising, no tracking. Details on /cookies.',
  },
  {
    category: 'Privacy',
    q: 'Where is my data stored?',
    a: 'Postgres on Supabase (EU region), object storage on Cloudflare R2. Backups encrypted, 7-day retention. International transfers (if any) go through Standard Contractual Clauses.',
  },
  // Billing
  {
    category: 'Billing',
    q: 'How much is Premium?',
    a: '$9 / month. See /pricing for the full feature list. Stripe checkout lands in a follow-up release — until then the upgrade button shows a "coming soon" notice.',
  },
  {
    category: 'Billing',
    q: 'Can I get a refund?',
    a: 'Yes — within 14 days of your first Premium charge, no questions asked. After that we look at things case-by-case. Email billing@travel.local.',
  },
  {
    category: 'Billing',
    q: 'How do I cancel?',
    a: '/account → Subscription → Cancel. You keep Premium features until the end of your current billing period.',
  },
  {
    category: 'Billing',
    q: 'Do you offer team / enterprise pricing?',
    a: "Not yet. If you're planning a deployment for an org, agent network, or tour operator: email sales@travel.local and we'll work something out.",
  },
];

const CATEGORIES: readonly FaqEntry['category'][] = [
  'Account',
  'Trips',
  'Safety',
  'Privacy',
  'Billing',
];

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ;
    return FAQ.filter(
      (entry) =>
        entry.q.toLowerCase().includes(q) ||
        entry.a.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <section className="space-y-6" aria-labelledby="help-h1">
      <header className="space-y-2">
        <h1 id="help-h1" className="text-3xl font-bold tracking-tight">
          Help centre
        </h1>
        <p className="text-sm text-muted">
          20 quick answers across 5 categories. Search below or jump to a category. Still stuck?
          Email{' '}
          <a href="mailto:hello@travel.local" className="underline-offset-2 hover:underline">
            hello@travel.local
          </a>
          .
        </p>
      </header>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search e.g. delete account, SOS, refund…"
        className="w-full rounded-md border border-muted/15 bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        aria-label="Search the FAQ"
      />
      {filtered.length === 0 ? (
        <p className="rounded-md border border-muted/15 bg-muted/5 p-4 text-sm text-muted">
          No matches. Try a different keyword, or email us directly.
        </p>
      ) : (
        CATEGORIES.map((cat) => {
          const entries = filtered.filter((e) => e.category === cat);
          if (entries.length === 0) return null;
          return (
            <section key={cat} className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{cat}</h2>
              <ul className="space-y-2">
                {entries.map((e, idx) => {
                  const id = `${cat}-${idx}`;
                  const open = openId === id;
                  return (
                    <li key={id} className="rounded-md border border-muted/15 bg-surface">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : id)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand"
                      >
                        <span>{e.q}</span>
                        <span aria-hidden className="text-muted">
                          {open ? '−' : '+'}
                        </span>
                      </button>
                      {open ? (
                        <p className="border-t border-muted/15 px-3 py-2 text-sm leading-relaxed text-muted">
                          {e.a}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
      <footer className="rounded-md border border-muted/15 bg-muted/5 p-4 text-xs text-muted">
        Still need help? Check our{' '}
        <Link href={'/status' as never} className="underline-offset-2 hover:underline">
          status page
        </Link>{' '}
        for outages, or email{' '}
        <a href="mailto:hello@travel.local" className="underline-offset-2 hover:underline">
          hello@travel.local
        </a>{' '}
        and we'll reply within 1 business day.
      </footer>
    </section>
  );
}
