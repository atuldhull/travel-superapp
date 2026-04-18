import { Writable } from 'node:stream';
import { createLogger } from '../src/logger';
import { runWithTraceContext } from '../src/trace-context';

/** Collects every line written to the logger as a parsed JSON object. */
function captureLogger(context = 'test', extra: Parameters<typeof createLogger>[1] = {}) {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      const text = chunk.toString('utf8').trim();
      if (text) {
        for (const line of text.split('\n')) {
          try {
            lines.push(JSON.parse(line) as Record<string, unknown>);
          } catch {
            // Ignore non-JSON frames (pino-pretty etc., not used here).
          }
        }
      }
      cb();
    },
  });
  const logger = createLogger(context, { ...extra, destination: stream, level: 'trace' });
  return { logger, lines };
}

describe('createLogger', () => {
  it('emits JSON with level, context, and message', () => {
    const { logger, lines } = captureLogger('places');
    logger.info({ placeId: 'p1' }, 'place_viewed');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      context: 'places',
      placeId: 'p1',
      msg: 'place_viewed',
    });
    expect(typeof lines[0]!['time']).toBe('string'); // ISO timestamp
  });

  it('redacts top-level sensitive fields', () => {
    const { logger, lines } = captureLogger();
    logger.info({ email: 'a@b.com', password: 'secret', token: 't123' }, 'login_attempt');
    expect(lines[0]).toMatchObject({
      email: '[REDACTED]',
      password: '[REDACTED]',
      token: '[REDACTED]',
    });
  });

  it('redacts nested *.sensitive fields one level deep', () => {
    const { logger, lines } = captureLogger();
    logger.info({ user: { id: 'u1', email: 'a@b.com', refreshToken: 'rt' } }, 'user_loaded');
    expect(lines[0]).toMatchObject({
      user: {
        id: 'u1',
        email: '[REDACTED]',
        refreshToken: '[REDACTED]',
      },
    });
  });

  it('redacts request headers carrying auth / cookies', () => {
    const { logger, lines } = captureLogger();
    logger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer abc',
            cookie: 'sid=xyz',
            'user-agent': 'jest',
          },
        },
      },
      'incoming',
    );
    const headers = (lines[0]!['req'] as { headers: Record<string, string> }).headers;
    expect(headers['authorization']).toBe('[REDACTED]');
    expect(headers['cookie']).toBe('[REDACTED]');
    expect(headers['user-agent']).toBe('jest'); // non-sensitive untouched
  });

  it('merges the current trace context into every line', () => {
    const { logger, lines } = captureLogger();
    runWithTraceContext({ traceId: 'trace-xyz', userId: 'u-7' }, () => {
      logger.info({}, 'inside_scope');
    });
    logger.info({}, 'outside_scope');

    expect(lines[0]).toMatchObject({
      msg: 'inside_scope',
      traceId: 'trace-xyz',
      userId: 'u-7',
    });
    expect(lines[1]).toMatchObject({ msg: 'outside_scope' });
    expect(lines[1]!['traceId']).toBeUndefined();
  });

  it('honours additionalRedactPaths', () => {
    const { logger, lines } = captureLogger('custom', {
      additionalRedactPaths: ['customSecret'],
    });
    logger.info({ customSecret: 'value', keep: 'visible' }, 'with_custom_redact');
    expect(lines[0]).toMatchObject({ customSecret: '[REDACTED]', keep: 'visible' });
  });

  it('respects the configured level (info suppresses trace/debug)', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        lines.push(chunk.toString('utf8'));
        cb();
      },
    });
    const logger = createLogger('lvl', { level: 'info', destination: stream });
    logger.trace({}, 'should_not_appear');
    logger.debug({}, 'should_not_appear');
    logger.info({}, 'visible');
    logger.warn({}, 'visible');
    logger.error({}, 'visible');
    const emitted = lines
      .join('')
      .split('\n')
      .filter(Boolean)
      .map((s) => JSON.parse(s) as { msg?: string });
    const messages = emitted.map((e) => e.msg ?? '');
    expect(messages).toEqual(['visible', 'visible', 'visible']);
  });

  it('child() inherits context + redaction', () => {
    const { logger, lines } = captureLogger('parent');
    const child = logger.child({ module: 'sub' });
    child.info({ email: 'leak@x.com' }, 'sub_event');
    expect(lines[0]).toMatchObject({
      context: 'parent',
      module: 'sub',
      email: '[REDACTED]',
      msg: 'sub_event',
    });
  });
});
