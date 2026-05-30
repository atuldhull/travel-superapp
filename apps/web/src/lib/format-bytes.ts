/**
 * AE277 — human-friendly byte size formatter.
 *
 * For the AE131 data-export progress + future "media library size"
 * tile we want "1.2 MB" not "1234567". Uses binary units (KiB/MiB)
 * by default since storage caps are binary; passing decimal=true
 * gives the SI scale (KB/MB) for download-friendliness.
 *
 * Rounds to 1 decimal place except for byte counts < 1024 which
 * render as a whole number. Negative + NaN → "—".
 */

const BIN_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
const DEC_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export interface FormatBytesOptions {
  readonly decimal?: boolean;
}

export function formatBytes(bytes: number, opts: FormatBytesOptions = {}): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const base = opts.decimal === true ? 1000 : 1024;
  const units = opts.decimal === true ? DEC_UNITS : BIN_UNITS;
  if (bytes < base) return `${Math.round(bytes)} ${units[0]}`;
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const n = bytes / base ** exp;
  return `${n.toFixed(1)} ${units[exp]}`;
}
