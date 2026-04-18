import { Writable } from 'node:stream';
import { createLogger } from '../src/logger';
import { AppNestLoggerService } from '../src/nest-logger.service';

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      const text = chunk.toString('utf8').trim();
      if (text) {
        for (const line of text.split('\n')) {
          try {
            lines.push(JSON.parse(line) as Record<string, unknown>);
          } catch {
            /* ignore */
          }
        }
      }
      cb();
    },
  });
  const pino = createLogger('NestJS', { destination: stream, level: 'trace' });
  return { svc: new AppNestLoggerService(pino), lines };
}

describe('AppNestLoggerService', () => {
  it('log() → info', () => {
    const { svc, lines } = capture();
    svc.log('hello', 'TripModule');
    expect(lines[0]).toMatchObject({ level: 'info', context: 'TripModule', msg: 'hello' });
  });

  it('warn() → warn', () => {
    const { svc, lines } = capture();
    svc.warn('slow', 'DbModule');
    expect(lines[0]).toMatchObject({ level: 'warn', context: 'DbModule', msg: 'slow' });
  });

  it('error() forwards stack separately', () => {
    const { svc, lines } = capture();
    svc.error('boom', 'stacktrace-line-1\nline-2', 'PaymentsModule');
    expect(lines[0]).toMatchObject({
      level: 'error',
      context: 'PaymentsModule',
      stack: 'stacktrace-line-1\nline-2',
      msg: 'boom',
    });
  });

  it('debug() → debug, verbose() → trace, fatal() → fatal', () => {
    const { svc, lines } = capture();
    svc.debug('d', 'c1');
    svc.verbose('v', 'c2');
    svc.fatal('f', 'c3');
    expect(lines.map((l) => l['level'])).toEqual(['debug', 'trace', 'fatal']);
    expect(lines.map((l) => l['context'])).toEqual(['c1', 'c2', 'c3']);
  });

  it('stringifies non-string messages (object → JSON)', () => {
    const { svc, lines } = capture();
    svc.log({ orderId: 7 }, 'OrdersModule');
    expect(lines[0]!['msg']).toBe('{"orderId":7}');
  });

  it('stringifies Error messages using .message', () => {
    const { svc, lines } = capture();
    svc.error(new Error('nope'), undefined, 'Anywhere');
    expect(lines[0]!['msg']).toBe('nope');
  });

  it('default constructor wires up its own logger (smoke test)', () => {
    // Constructor without args must not throw.
    expect(() => new AppNestLoggerService()).not.toThrow();
  });
});
