/**
 * Vitest specs for AE278 extractDomain.
 */
import { describe, expect, it } from 'vitest';
import { extractDomain } from '../../src/lib/extract-domain';

describe('extractDomain', () => {
  it('https URL → hostname', () => {
    expect(extractDomain('https://example.com/path')).toBe('example.com');
  });
  it('http URL → hostname', () => {
    expect(extractDomain('http://example.com')).toBe('example.com');
  });
  it('strips "www." prefix', () => {
    expect(extractDomain('https://www.example.com')).toBe('example.com');
  });
  it('preserves subdomains other than "www"', () => {
    expect(extractDomain('https://docs.example.com')).toBe('docs.example.com');
  });
  it('lowercases the hostname', () => {
    expect(extractDomain('https://Example.COM')).toBe('example.com');
  });
  it('localhost with port', () => {
    expect(extractDomain('http://localhost:3001')).toBe('localhost');
  });
  it('garbage URL → null', () => {
    expect(extractDomain('not a url')).toBeNull();
  });
  it('empty → null', () => {
    expect(extractDomain('')).toBeNull();
  });
  it('whitespace-only → null', () => {
    expect(extractDomain('   ')).toBeNull();
  });
  it('trims input', () => {
    expect(extractDomain('  https://example.com  ')).toBe('example.com');
  });
  it('handles fathom share URL', () => {
    expect(extractDomain('https://fathom.video/calls/12345')).toBe('fathom.video');
  });
});
