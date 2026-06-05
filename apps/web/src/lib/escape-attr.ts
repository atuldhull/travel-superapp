/**
 * AE257 — HTML-attribute-safe escaping.
 *
 * shareSvg + future inline-SVG renders build attribute strings by
 * concatenation. Trip titles like O'Reilly's Pub or "Best of " would
 * break the SVG. This helper escapes the 5 chars that matter inside
 * a double-quoted attribute:
 *   & → &amp;
 *   < → &lt;
 *   > → &gt;
 *   " → &quot;
 *   ' → &#39;
 *
 * Order matters: & must be replaced first so we don't double-encode.
 */

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Stricter variant: also strips control chars (\x00-\x1f) which
 *  some viewers refuse to render. */
export function escapeAttrStrict(value: string): string {
  return escapeAttr(value.replace(/[\x00-\x1f]/g, ''));
}
