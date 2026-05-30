/**
 * Vitest specs for AE241 articleHref + articleAbsoluteHref.
 */
import { describe, expect, it } from 'vitest';
import { articleAbsoluteHref, articleHref } from '../../src/components/aether/journal/article-href';

describe('articleHref', () => {
  it('plain slug → /aether/journal/<slug>', () => {
    expect(articleHref('chai-in-leh')).toBe('/aether/journal/chai-in-leh');
  });

  it('trims whitespace', () => {
    expect(articleHref('  hello  ')).toBe('/aether/journal/hello');
  });

  it('empty slug → "" (caller decides what to render)', () => {
    expect(articleHref('')).toBe('');
  });

  it('whitespace-only slug → ""', () => {
    expect(articleHref('   \n\t  ')).toBe('');
  });

  it('URL-encodes a slug with safe-but-special chars (defensive)', () => {
    expect(articleHref('a b/c')).toBe('/aether/journal/a%20b%2Fc');
  });
});

describe('articleAbsoluteHref', () => {
  it('appends to https origin', () => {
    expect(articleAbsoluteHref('chai-in-leh', 'https://app.com')).toBe(
      'https://app.com/aether/journal/chai-in-leh',
    );
  });

  it('trims trailing slash on origin', () => {
    expect(articleAbsoluteHref('chai-in-leh', 'https://app.com/')).toBe(
      'https://app.com/aether/journal/chai-in-leh',
    );
  });

  it('empty slug poisons → ""', () => {
    expect(articleAbsoluteHref('', 'https://app.com')).toBe('');
  });

  it('preserves port + protocol', () => {
    expect(articleAbsoluteHref('x', 'http://localhost:3001')).toBe(
      'http://localhost:3001/aether/journal/x',
    );
  });

  it('empty origin still produces a root-relative path', () => {
    expect(articleAbsoluteHref('x', '')).toBe('/aether/journal/x');
  });
});
