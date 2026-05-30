/**
 * Vitest specs for AE221 format-coords — lat/lng pretty-printing.
 */
import { describe, expect, it } from 'vitest';
import { formatLat, formatLatLng, formatLng } from '../../src/lib/format-coords';

describe('formatLat', () => {
  it('positive lat → north hemisphere', () => {
    expect(formatLat(28.6139)).toBe('28.6139° N');
  });
  it('negative lat → south hemisphere with absolute value', () => {
    expect(formatLat(-33.8688)).toBe('33.8688° S');
  });
  it('equator (0) renders as positive N (convention)', () => {
    expect(formatLat(0)).toBe('0.0000° N');
  });
  it('out of range → "—"', () => {
    expect(formatLat(91)).toBe('—');
    expect(formatLat(-90.0001)).toBe('—');
  });
  it('NaN / Infinity → "—"', () => {
    expect(formatLat(Number.NaN)).toBe('—');
    expect(formatLat(Number.POSITIVE_INFINITY)).toBe('—');
  });
  it('rounds to 4 decimals', () => {
    expect(formatLat(34.152611111)).toBe('34.1526° N');
  });
});

describe('formatLng', () => {
  it('positive lng → east', () => {
    expect(formatLng(77.5946)).toBe('77.5946° E');
  });
  it('negative lng → west', () => {
    expect(formatLng(-122.4194)).toBe('122.4194° W');
  });
  it('prime meridian (0) renders as E (convention)', () => {
    expect(formatLng(0)).toBe('0.0000° E');
  });
  it('lng out of range (>180) → "—"', () => {
    expect(formatLng(181)).toBe('—');
    expect(formatLng(-180.5)).toBe('—');
  });
  it('lng of exactly 180 / -180 is in range', () => {
    expect(formatLng(180)).toBe('180.0000° E');
    expect(formatLng(-180)).toBe('180.0000° W');
  });
});

describe('formatLatLng', () => {
  it('joins lat + lng with a comma', () => {
    expect(formatLatLng({ lat: 28.6139, lng: 77.209 })).toBe('28.6139° N, 77.2090° E');
  });
  it('degenerate lat poisons the whole render → "—"', () => {
    expect(formatLatLng({ lat: 91, lng: 77 })).toBe('—');
  });
  it('degenerate lng poisons the whole render → "—"', () => {
    expect(formatLatLng({ lat: 28, lng: 200 })).toBe('—');
  });
  it('renders Jaipur fallback (sanity)', () => {
    expect(formatLatLng({ lat: 26.9124, lng: 75.7873 })).toBe('26.9124° N, 75.7873° E');
  });
});
