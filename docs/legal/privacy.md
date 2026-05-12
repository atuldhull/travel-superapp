# Privacy Policy

Last updated: 2026-05-12. Counsel review pending.

> **Heads up:** this is a placeholder draft authored during the
> POST.6 build slice. It accurately describes the data flows
> implemented in the codebase but has **not** been reviewed by
> a privacy lawyer in your jurisdiction. Treat it as a starting
> point, not the final word.

## What we collect

When you create an account we collect:

- Your **email address** (required, hashed with a server-side
  pepper before lookup — we never store plaintext emails)
- A **password hash** (argon2id; we never see your plaintext
  password)
- An optional **display name** + avatar
- Sign-in metadata: IP-derived hash, user-agent, timestamps

When you use the Service we collect:

- **Trip drafts** you create (title, centre coordinates, radius,
  dates)
- **Photos and captions** you upload (stored in our object
  store; EXIF metadata is stripped before they reach other users)
- **AI prompts** sent to the trip planner (the prompt + provider
  identifier are logged for cost accounting; the LLM response
  is never shared with other users)
- **SOS events** and **trusted contact** lists (these are only
  surfaced to the emergency contacts you explicitly named)

## What we do NOT collect

- We do not run any third-party analytics on signed-in pages
- We do not place advertising cookies
- We do not sell any user data, ever
- We do not use your content to train any external AI model

## How we use it

- To run the Service (trip generation, photo storage, sharing)
- To send transactional emails you opted into (magic-link
  sign-in, password reset, account deletion confirmation)
- To prevent abuse (rate limits, ban appeals, fraud detection)

## Where it lives

- **Database**: Postgres 16 (Supabase production), encrypted at
  rest. Hosted in the EU.
- **Object storage**: S3-compatible (Cloudflare R2 production),
  encrypted at rest, private bucket — every download is
  presigned + short-TTL.
- **Backups**: 7-day rolling, same encryption posture.

## Your rights (GDPR / DPDP)

You have the right to:

- **Access** all data we hold on you — export from **/account →
  Export** (NDJSON download)
- **Delete** your account and all associated data — **/account
  → Erase**. Hard deletion occurs after a 7-day grace period.
- **Correct** any inaccurate data — most fields are editable
  from **/account → Preferences**
- **Restrict** processing — contact **privacy@travel.local**
- **Port** your data — the export endpoint is the standard
  machine-readable format

## Cookies

We use a small set of strictly-necessary cookies (session id,
CSRF token). Details on **/cookies**. We do not use third-party
or advertising cookies.

## Minors

Users between 13 and 18 require parental consent before account
creation. We retain a separate audit log of consent capture.
Under 13 is not permitted (COPPA).

## Data transfers

If you sign up from outside the EU we may process data on EU
servers. Where required, we rely on Standard Contractual Clauses
for international transfers.

## Retention

- **Active accounts**: data retained for as long as the account
  is active
- **Soft-deleted accounts**: 7-day grace period
- **Hard-deleted accounts**: most data gone within 24 hours of
  hard delete; backups age out within 7 days
- **Audit logs** for security investigations: 90 days
- **Anonymised aggregate metrics** (e.g. "total trips planned
  this month"): retained indefinitely

## Sharing

We share data only with:

- **You** (export, in-product views)
- **Trusted contacts** you've explicitly added (SOS events only)
- **Recipients of shared trips** (only the content you actively
  shared with a public code)
- **Service sub-processors** under written DPAs: Resend (email
  delivery), Anthropic / Google (LLM prompt + response, only
  when you've explicitly invoked the AI plan feature), Stripe
  (subscription billing when you're a Premium user)

## Changes

We notify you of material changes 30 days in advance via the
in-app inbox.

## Contact

Data protection officer: **privacy@travel.local**.
