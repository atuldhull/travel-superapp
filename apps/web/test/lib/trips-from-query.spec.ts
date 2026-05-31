/**
 * Vitest specs for AE346 tripsFromQuery.
 */
import { describe, expect, it } from 'vitest';
import { tripsFromQuery } from '../../src/lib/trips-from-query';

const t = (id: string) => ({ id });

describe('tripsFromQuery', () => {
  it('undefined query → []', () => {
    expect(tripsFromQuery(undefined)).toEqual([]);
  });

  it('query with no data → []', () => {
    expect(tripsFromQuery({})).toEqual([]);
  });

  it('query with empty data envelope → []', () => {
    expect(tripsFromQuery({ data: {} })).toEqual([]);
  });

  it('query with data but no trips → []', () => {
    expect(tripsFromQuery({ data: { data: {} } })).toEqual([]);
  });

  it('query with empty trips array → []', () => {
    expect(tripsFromQuery({ data: { data: { trips: [] } } })).toEqual([]);
  });

  it('query with populated trips → the array', () => {
    const trips = [t('a'), t('b'), t('c')];
    expect(tripsFromQuery({ data: { data: { trips } } })).toEqual(trips);
  });

  it('non-array trips field → [] (defensive)', () => {
    expect(
      tripsFromQuery({
        data: { data: { trips: 'oops' as unknown as ReadonlyArray<{ id: string }> } },
      }),
    ).toEqual([]);
  });
});
