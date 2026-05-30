/**
 * Vitest specs for AE257 escapeAttr + escapeAttrStrict.
 */
import { describe, expect, it } from 'vitest';
import { escapeAttr, escapeAttrStrict } from '../../src/lib/escape-attr';

describe('escapeAttr', () => {
  it('passes through a plain string', () => {
    expect(escapeAttr('hello world')).toBe('hello world');
  });
  it('escapes &', () => {
    expect(escapeAttr('a & b')).toBe('a &amp; b');
  });
  it('escapes < and >', () => {
    expect(escapeAttr('<x>')).toBe('&lt;x&gt;');
  });
  it('escapes double-quote', () => {
    expect(escapeAttr('say "hi"')).toBe('say &quot;hi&quot;');
  });
  it('escapes single-quote', () => {
    expect(escapeAttr("O'Reilly")).toBe('O&#39;Reilly');
  });
  it('does NOT double-encode &amp;', () => {
    expect(escapeAttr('&amp;')).toBe('&amp;amp;');
  });
  it('handles empty string', () => {
    expect(escapeAttr('')).toBe('');
  });
  it('handles all 5 special chars together', () => {
    expect(escapeAttr('<a href="x" title=\'y\'>&end</a>')).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;end&lt;/a&gt;',
    );
  });
});

describe('escapeAttrStrict', () => {
  it('strips control chars then escapes', () => {
    expect(escapeAttrStrict('hi\x01<world>')).toBe('hi&lt;world&gt;');
  });
  it('preserves printable ASCII', () => {
    expect(escapeAttrStrict('Hello, world!')).toBe('Hello, world!');
  });
});
