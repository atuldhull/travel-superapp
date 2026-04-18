/**
 * Unit test for `DomainExceptionFilter` focused on its integration with
 * the `@app/logger` `AsyncLocalStorage` trace context.
 *
 * The full HTTP behaviours (status, headers, body shape) are covered by
 * `filters.e2e-spec.ts` via Fastify's `inject()`. This spec instantiates
 * the filter directly and manually enters a trace scope around the
 * `filter.catch()` call — proving that when a request-level middleware
 * (arriving with [III.15.4]) populates the ALS, the filter picks up and
 * serialises the `traceId` into every response body.
 */
import { ArgumentsHost } from '@nestjs/common';
import { TripNotFoundError } from '@app/errors';
import { runWithTraceContext } from '@app/logger';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

interface MockReply {
  status: jest.Mock;
  send: jest.Mock;
  header: jest.Mock;
}

function buildMockHost(reply: MockReply): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({}),
      getNext: () => undefined,
    }),
    // Not exercised by the filter, but satisfy the interface.
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({ getData: () => ({}), getContext: () => ({}) }),
    switchToWs: () => ({ getClient: () => ({}), getData: () => ({}), getPattern: () => '' }),
    getType: () => 'http',
    getHandler: () => (() => undefined) as () => unknown,
    getClass: () => class {},
  } as unknown as ArgumentsHost;
}

function freshReply(): MockReply {
  const reply: MockReply = {
    status: jest.fn(() => reply),
    send: jest.fn(() => reply),
    header: jest.fn(() => reply),
  } as unknown as MockReply;
  return reply;
}

describe('DomainExceptionFilter (unit — trace context)', () => {
  const filter = new DomainExceptionFilter();

  it('includes `traceId: undefined` when called outside any ALS scope', () => {
    const reply = freshReply();
    const host = buildMockHost(reply);

    filter.catch(new TripNotFoundError('trip_1'), host);

    expect(reply.status).toHaveBeenCalledWith(404);
    const body = reply.send.mock.calls[0]![0] as Record<string, unknown>;
    expect(body['code']).toBe('TRIP_NOT_FOUND');
    expect(body['traceId']).toBeUndefined();
  });

  it('reads `traceId` from the surrounding `runWithTraceContext` scope', () => {
    const reply = freshReply();
    const host = buildMockHost(reply);

    runWithTraceContext({ traceId: 'trace-xyz', userId: 'u-7' }, () => {
      filter.catch(new TripNotFoundError('trip_2'), host);
    });

    const body = reply.send.mock.calls[0]![0] as Record<string, unknown>;
    expect(body['traceId']).toBe('trace-xyz');
    expect(body['code']).toBe('TRIP_NOT_FOUND');
    expect(body['context']).toEqual({ tripId: 'trip_2' });
  });
});
