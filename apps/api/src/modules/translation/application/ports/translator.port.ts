/**
 * V.UX.18 — port for a translation provider. v1 ships a stub
 * adapter that prefixes the input with `[stub:<lang>]` so the
 * end-to-end flow works in dev without paid keys. Real adapters
 * (Google Cloud Translate, DeepL, Azure) land as siblings
 * behind the same port.
 *
 * Installed by prompt [V.UX.18].
 */
import type { Translation } from '../../domain/translation.entity';

export interface TranslateInput {
  readonly text: string;
  readonly targetLang: string;
  readonly sourceLang?: string;
}

export interface Translator {
  translate(input: TranslateInput): Promise<Translation>;
}

export const TRANSLATOR_PORT = Symbol('Translator');
