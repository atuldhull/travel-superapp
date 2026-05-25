/**
 * Real-LLM diary assistant. Env-gated, behind the SAME
 * `DiaryAiAssistant` port as the heuristic — `CompositeDiaryAssistant`
 * picks this when a provider is configured and falls back to the
 * heuristic on ANY failure, so the contract never breaks and tests
 * (no keys) stay deterministic.
 *
 * Providers (precedence set in diary.module): Gemini Flash (free
 * tier) → Ollama (local, truly $0). The REST shapes are copied
 * verbatim from the proven trip-planner adapters
 * (gemini-/ollama-trip-planner.adapter.ts) so there is no new wire
 * format to maintain. Anthropic is a one-line precedence extension if
 * a paid key is ever added.
 *
 * Modes: prompt → 3 evocative prompts (one per line) · polish →
 * tidied prose preserving the traveller's voice · title → one short
 * vivid line. Any non-OK / empty / timeout throws so the composite
 * degrades to the heuristic.
 *
 * Installed for the adventure-diary feature (real-LLM upgrade).
 */
import { Inject, Injectable } from '@nestjs/common';
import { createLogger, type AppLogger } from '@app/logger';
import { CLOCK, type Clock } from '@app/clock';
import { CircuitBreaker, callExternal } from '@app/resilience';
import type {
  DiaryAiAssistant,
  DiaryAssistInput,
  DiaryAssistResult,
} from '../application/ports/diary-ai-assistant.port';

const TIMEOUT_MS = 20_000;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM =
  `You are a warm, precise travel-diary writing assistant. You help a ` +
  `traveller journal their adventures. Never invent facts the user did ` +
  `not state. No markdown, no preamble, no emoji. Reply with ONLY what ` +
  `is asked.`;

export interface LlmDiaryConfig {
  readonly provider: 'gemini' | 'ollama';
  readonly model: string;
  /** Gemini: API key. Ollama: base URL. */
  readonly credential: string;
}

interface GeminiResponse {
  readonly candidates?: ReadonlyArray<{
    readonly content?: { readonly parts?: ReadonlyArray<{ readonly text?: string }> };
  }>;
  readonly error?: { readonly message?: string };
}
interface OllamaResponse {
  readonly message?: { readonly content?: string };
  readonly error?: string;
}

@Injectable()
export class LlmDiaryAssistant implements DiaryAiAssistant {
  private readonly logger: AppLogger = createLogger('diary.assistant.llm');
  private readonly breaker: CircuitBreaker;

  constructor(
    private readonly cfg: LlmDiaryConfig,
    @Inject(CLOCK) clock: Clock,
  ) {
    // [O1] 4 fails / 60s. Diary assist degrades to a heuristic on
    // any failure; breaker keeps the heuristic latency low instead
    // of waiting 20s per call once the upstream is wedged.
    this.breaker = new CircuitBreaker({
      name: `diary-${cfg.provider}`,
      clock,
      failureThreshold: 4,
      openMs: 60_000,
      onTransition: (from, to, name) =>
        this.logger.warn({ from, to, name }, 'circuit_state_change'),
    });
  }

  async assist(input: DiaryAssistInput): Promise<DiaryAssistResult> {
    const text = (await this.complete(this.buildPrompt(input))).trim();
    if (text.length === 0) throw new Error('empty LLM response');
    if (input.mode === 'prompt') {
      const suggestions = text
        .split('\n')
        // eslint-disable-next-line security/detect-unsafe-regex -- two simple character-class repetitions, neither shares overlap; bounded by per-line length cap upstream
        .map((l) => l.replace(/^\s*(?:[-*\d.)]+\s*)?/, '').trim())
        .filter((l) => l.length > 0)
        .slice(0, 3);
      if (suggestions.length === 0) throw new Error('no prompts parsed');
      return { mode: 'prompt', suggestions, aiBacked: true };
    }
    if (input.mode === 'title') {
      return { mode: 'title', text: text.split('\n')[0]!.slice(0, 120).trim(), aiBacked: true };
    }
    return { mode: 'polish', text, aiBacked: true };
  }

  private buildPrompt(input: DiaryAssistInput): string {
    const ctx = [
      input.place ? `Place: ${input.place}.` : '',
      input.mood ? `Mood: ${input.mood}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (input.mode === 'prompt') {
      return `${ctx} Give exactly 3 short, evocative journaling prompts (one per line, no numbering) to help me write about this day.`;
    }
    if (input.mode === 'title') {
      return `${ctx} Write ONE short, vivid diary title (max 8 words) for this entry. Reply with only the title:\n\n${input.text ?? ''}`;
    }
    return `${ctx} Tidy these raw travel notes into clean, flowing diary prose. Keep my voice and every fact; fix grammar, spacing and structure; 1–3 short paragraphs. Reply with only the polished text:\n\n${input.text ?? ''}`;
  }

  private async complete(userPrompt: string): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      return this.cfg.provider === 'gemini'
        ? await this.callGemini(userPrompt, ctrl.signal)
        : await this.callOllama(userPrompt, ctrl.signal);
    } catch (err) {
      this.logger.warn(
        { provider: this.cfg.provider, err: err instanceof Error ? err.message : String(err) },
        'diary_llm_unavailable',
      );
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  private async callGemini(userPrompt: string, signal: AbortSignal): Promise<string> {
    const url = `${GEMINI_BASE}/${this.cfg.model}:generateContent?key=${this.cfg.credential}`;
    const res = await callExternal(
      () =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: 768, temperature: 0.8 },
          }),
          signal,
        }),
      { breaker: this.breaker, label: 'diary.gemini' },
    );
    const json = (await res.json()) as GeminiResponse;
    if (!res.ok || json.error) {
      throw new Error(json.error?.message ?? `Gemini HTTP ${res.status}`);
    }
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  }

  private async callOllama(userPrompt: string, signal: AbortSignal): Promise<string> {
    const endpoint = `${this.cfg.credential.replace(/\/+$/, '')}/api/chat`;
    const res = await callExternal(
      () =>
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.cfg.model,
            stream: false,
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: userPrompt },
            ],
            options: { temperature: 0.8 },
          }),
          signal,
        }),
      { breaker: this.breaker, label: 'diary.ollama' },
    );
    const json = (await res.json()) as OllamaResponse;
    if (!res.ok || json.error) throw new Error(json.error ?? `Ollama HTTP ${res.status}`);
    return json.message?.content ?? '';
  }
}
