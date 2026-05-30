/**
 * Vitest specs for AE242 destinationHref + destinationAbsoluteHref +
 * compareHref.
 */
import { describe, expect, it } from 'vitest';
import {
  compareHref,
  destinationAbsoluteHref,
  destinationHref,
} from '../../src/components/aether/destinations/destination-href';

describe('destinationHref', () => {
  it('plain slug', () => {
    expect(destinationHref('leh')).toBe('/aether/destinations/leh');
  });
  it('trims whitespace', () => {
    expect(destinationHref('  jaipur  ')).toBe('/aether/destinations/jaipur');
  });
  it('empty → ""', () => {
    expect(destinationHref('')).toBe('');
  });
  it('encodes path-unsafe chars', () => {
    expect(destinationHref('a b')).toBe('/aether/destinations/a%20b');
  });
});

describe('destinationAbsoluteHref', () => {
  it('appends to origin', () => {
    expect(destinationAbsoluteHref('leh', 'https://app.com')).toBe(
      'https://app.com/aether/destinations/leh',
    );
  });
  it('trims trailing slash on origin', () => {
    expect(destinationAbsoluteHref('leh', 'https://app.com/')).toBe(
      'https://app.com/aether/destinations/leh',
    );
  });
  it('empty slug → ""', () => {
    expect(destinationAbsoluteHref('', 'https://app.com')).toBe('');
  });
});

describe('compareHref', () => {
  it('builds the ?a=&b= permalink', () => {
    expect(compareHref('leh', 'jaipur')).toBe('/aether/destinations/compare?a=leh&b=jaipur');
  });
  it('empty a → ""', () => {
    expect(compareHref('', 'jaipur')).toBe('');
  });
  it('empty b → ""', () => {
    expect(compareHref('leh', '')).toBe('');
  });
  it('whitespace-only a or b → ""', () => {
    expect(compareHref('   ', 'jaipur')).toBe('');
    expect(compareHref('leh', '   ')).toBe('');
  });
  it('encodes path-unsafe chars in both slugs', () => {
    expect(compareHref('a b', 'c&d')).toBe('/aether/destinations/compare?a=a%20b&b=c%26d');
  });
});
