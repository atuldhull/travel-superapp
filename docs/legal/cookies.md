# Cookie Policy

Last updated: 2026-05-12. Counsel review pending.

> **Heads up:** this is a placeholder draft authored during the
> POST.6 build slice. Treat it as a starting point until your
> privacy lawyer signs off.

## What's a cookie?

A cookie is a small text file a website asks your browser to
store. The next time you visit, the browser sends the cookie
back so the site can recognise you (still signed in, theme
preference still light/dark, etc.).

## Cookies we set

| Name             | Purpose                                                                                                  | Lifetime           | Type               |
| ---------------- | -------------------------------------------------------------------------------------------------------- | ------------------ | ------------------ |
| `travel.refresh` | httpOnly + secure refresh token used to mint short-lived access tokens. Required for signed-in sessions. | 30 days (rotating) | Strictly necessary |
| `travel.csrf`    | CSRF protection token paired with every state-changing API call.                                         | Session            | Strictly necessary |

That's it. We do **not** set:

- Advertising or marketing cookies
- Third-party analytics cookies
- Cross-site tracking cookies
- Social-media-widget cookies

## localStorage (not cookies, but related)

A handful of UX preferences are stored in your browser's
localStorage (not cookies, so they never leave your device):

- `travel-web-theme` — light / dark / system preference
- `travel-web-comfort` — accessibility comfort-density toggle
- `travel.visit-recall.v1` — your last viewed sample plan (24-hour TTL,
  used by the welcome-back banner on the landing page)

These never leave your machine. You can clear them anytime in
your browser settings.

## How to refuse cookies

Our cookies are all strictly necessary for the Service to work —
disabling them will sign you out and break CSRF protection. If
that's a deal-breaker for you, please contact us and we'll work
with you on an alternative.

## Changes

Material changes to this Cookie Policy are announced via the
in-app inbox 30 days in advance.

## Contact

Questions: **privacy@travel.local**.
