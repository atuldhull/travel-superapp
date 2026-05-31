/**
 * Vitest specs for AE354 useAetherAuth.
 *
 * Mocks the two underlying primitives so we lock the composite logic
 * without spinning up the silent-refresh + token-store machinery.
 */
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tokenMock = vi.fn();
const bootMock = vi.fn();

vi.mock('../../src/lib/use-auth-token', () => ({
  useAuthToken: () => tokenMock(),
  useAuthBootComplete: () => bootMock(),
}));

import { useAetherAuth } from '../../src/components/aether/use-aether-auth';

describe('useAetherAuth', () => {
  beforeEach(() => {
    tokenMock.mockReset();
    bootMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('isAuthed=true only when bootComplete && token !== null', () => {
    tokenMock.mockReturnValue('jwt');
    bootMock.mockReturnValue(true);
    const { result } = renderHook(() => useAetherAuth());
    expect(result.current.token).toBe('jwt');
    expect(result.current.bootComplete).toBe(true);
    expect(result.current.isAuthed).toBe(true);
  });

  it('boot incomplete → isAuthed=false even with token', () => {
    tokenMock.mockReturnValue('jwt');
    bootMock.mockReturnValue(false);
    const { result } = renderHook(() => useAetherAuth());
    expect(result.current.isAuthed).toBe(false);
  });

  it('null token → isAuthed=false even after boot', () => {
    tokenMock.mockReturnValue(null);
    bootMock.mockReturnValue(true);
    const { result } = renderHook(() => useAetherAuth());
    expect(result.current.isAuthed).toBe(false);
  });

  it('both pre-boot + no token → isAuthed=false', () => {
    tokenMock.mockReturnValue(null);
    bootMock.mockReturnValue(false);
    const { result } = renderHook(() => useAetherAuth());
    expect(result.current.isAuthed).toBe(false);
  });

  it('empty-string token currently counts as a token (matches prior trio)', () => {
    // Documenting the pre-existing behaviour: the inlined check was
    // `token !== null`, so an empty string ('') was "authed". This
    // helper preserves the contract — change at the auth-store layer,
    // not here, if you want to flip it.
    tokenMock.mockReturnValue('');
    bootMock.mockReturnValue(true);
    const { result } = renderHook(() => useAetherAuth());
    expect(result.current.isAuthed).toBe(true);
  });
});
