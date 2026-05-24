/**
 * Fitness invariants for the [F2] deprecated-routes registry.
 *
 * Today the registry is empty — these invariants exist to FAIL CI
 * the moment someone adds an entry that violates ADR-016's policy
 * (6-month minimum sunset window, valid URLs, etc.). They run on
 * every PR via the same `--testPathPattern=fitness` filter the
 * other fitness specs use.
 *
 * Installed by [F2].
 */
import { DEPRECATED_ROUTES } from '../src/common/deprecation/deprecated-routes';

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6; // ADR-016 minimum

describe('deprecated-routes registry (fitness)', () => {
  it('every entry has a parseable, future sunset date at least 6 months out', () => {
    const now = Date.now();
    for (const entry of DEPRECATED_ROUTES) {
      const sunset = new Date(entry.sunsetDate).getTime();
      expect({
        url: entry.url,
        sunsetParseable: Number.isFinite(sunset),
      }).toEqual({ url: entry.url, sunsetParseable: true });
      expect({
        url: entry.url,
        atLeastSixMonthsOut: sunset - now >= SIX_MONTHS_MS,
      }).toEqual({ url: entry.url, atLeastSixMonthsOut: true });
    }
  });

  it('every entry has v1 url + v2 replacement url + https changelog url', () => {
    for (const entry of DEPRECATED_ROUTES) {
      expect({
        url: entry.url,
        startsWithV1: entry.url.startsWith('/api/v1/'),
        replacementIsV2: /\/api\/v2\//.test(entry.replacementUrl),
        changelogIsHttps: entry.changelogUrl.startsWith('https://'),
      }).toEqual({
        url: entry.url,
        startsWithV1: true,
        replacementIsV2: true,
        changelogIsHttps: true,
      });
    }
  });

  it('registry has no duplicate urls (a route is deprecated AT MOST once)', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const e of DEPRECATED_ROUTES) {
      if (seen.has(e.url)) dupes.push(e.url);
      seen.add(e.url);
    }
    expect(dupes).toEqual([]);
  });
});
