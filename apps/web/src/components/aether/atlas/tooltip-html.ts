/**
 * AE273 — pure HTML string builder for the Atlas pin tooltip.
 *
 * Leaflet's tooltip API takes a string of HTML. AE108 hand-builds
 * this with template-string concatenation that mixes accent colours,
 * the in-season chip, and the tagline. This helper canonicalises
 * the markup so a future palette refactor only touches one file.
 *
 * Output is escaped via AE257 escapeAttr so trip titles + accent
 * notes containing &, <, > don't break the HTML.
 */
import { escapeAttr } from '../../../lib/escape-attr';

export interface AtlasTooltipInputs {
  readonly name: string;
  readonly state: string;
  readonly tagline: string;
  readonly inSeason: boolean;
  readonly accentBase: string;
  readonly accentNote?: string | null;
}

export function buildAtlasTooltipHtml(inputs: AtlasTooltipInputs): string {
  const name = escapeAttr(inputs.name);
  const state = escapeAttr(inputs.state);
  const tagline = escapeAttr(inputs.tagline);
  const accent = escapeAttr(inputs.accentBase);
  const noteRow =
    inputs.accentNote !== undefined && inputs.accentNote !== null && inputs.accentNote.trim() !== ''
      ? `<div class="atlas-tt-note" style="color:${accent}">${escapeAttr(inputs.accentNote)}</div>`
      : '';
  const seasonRow =
    inputs.inSeason === true ? `<div class="atlas-tt-season">◐ in season now</div>` : '';
  return [
    `<div class="atlas-tt">`,
    `<div class="atlas-tt-name">${name}</div>`,
    `<div class="atlas-tt-state">${state}</div>`,
    `<div class="atlas-tt-tag">${tagline}</div>`,
    noteRow,
    seasonRow,
    `</div>`,
  ].join('');
}
