/**
 * Vitest specs for the Pulse slash-command matcher (AE91, extracted
 * from AE85). Pure function — no DOM needed.
 */
import { describe, expect, it } from 'vitest';
import {
  SLASH_COMMANDS,
  matchSlashCommands,
  type SlashCommand,
} from '../../src/components/aether/pulse/slash-commands';

const POOL: ReadonlyArray<SlashCommand> = [
  { cmd: '/jaipur', hint: 'A', expand: 'A' },
  { cmd: '/leh', hint: 'B', expand: 'B' },
  { cmd: '/luxury', hint: 'C', expand: 'C' },
  { cmd: '/two-days', hint: 'D', expand: 'D' },
];

describe('matchSlashCommands', () => {
  it('returns [] when input does not start with /', () => {
    expect(matchSlashCommands('jaipur', POOL)).toEqual([]);
    expect(matchSlashCommands('', POOL)).toEqual([]);
    expect(matchSlashCommands('hello /jaipur', POOL)).toEqual([]);
  });

  it('returns all commands for a bare slash', () => {
    const all = matchSlashCommands('/', POOL);
    expect(all.length).toBe(POOL.length);
  });

  it('filters by stem (case-insensitive prefix on the cmd suffix)', () => {
    expect(matchSlashCommands('/le', POOL)).toEqual([POOL[1]]);
    expect(matchSlashCommands('/JA', POOL).map((c) => c.cmd)).toEqual(['/jaipur']);
  });

  it('matches multi-stem entries by their prefix', () => {
    expect(matchSlashCommands('/two', POOL).map((c) => c.cmd)).toEqual(['/two-days']);
    expect(matchSlashCommands('/two-da', POOL).map((c) => c.cmd)).toEqual(['/two-days']);
  });

  it('returns [] when no stem matches', () => {
    expect(matchSlashCommands('/xyz', POOL)).toEqual([]);
  });

  it('defaults to the real SLASH_COMMANDS pool', () => {
    const matches = matchSlashCommands('/');
    expect(matches.length).toBe(SLASH_COMMANDS.length);
    expect(SLASH_COMMANDS.some((c) => c.cmd === '/festival')).toBe(true);
  });
});

describe('SLASH_COMMANDS catalogue', () => {
  it('every entry has cmd / hint / expand strings', () => {
    for (const c of SLASH_COMMANDS) {
      expect(c.cmd.startsWith('/')).toBe(true);
      expect(c.cmd.length).toBeGreaterThan(1);
      expect(c.hint.length).toBeGreaterThan(0);
      expect(c.expand.length).toBeGreaterThan(0);
    }
  });

  // ─── AE175: extended sanity ─────────────────────────────────────────
  it('every cmd is unique (no duplicates)', () => {
    const cmds = SLASH_COMMANDS.map((c) => c.cmd);
    expect(new Set(cmds).size).toBe(cmds.length);
  });

  it('every cmd is lowercase + kebab-shaped (no spaces, no caps)', () => {
    for (const c of SLASH_COMMANDS) {
      expect(c.cmd).toBe(c.cmd.toLowerCase());
      expect(c.cmd).not.toMatch(/\s/);
    }
  });

  it('every expand string ends with a non-whitespace char', () => {
    for (const c of SLASH_COMMANDS) {
      const last = c.expand[c.expand.length - 1] ?? '';
      expect(last).toMatch(/\S/);
    }
  });
});

describe('matchSlashCommands — sort stability', () => {
  it('preserves catalogue order for matches', () => {
    const tail: SlashCommand[] = [
      { cmd: '/lima', hint: 'L1', expand: 'L1' },
      { cmd: '/leo', hint: 'L2', expand: 'L2' },
      { cmd: '/london', hint: 'L3', expand: 'L3' },
    ];
    const got = matchSlashCommands('/l', tail).map((c) => c.cmd);
    expect(got).toEqual(['/lima', '/leo', '/london']);
  });
});
