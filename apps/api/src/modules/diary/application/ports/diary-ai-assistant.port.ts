/**
 * Port for the diary's AI writing assistant.
 *
 *   - `prompt`  → evocative writing prompts to unblock the traveller
 *   - `polish`  → tidy raw notes into clean prose (keeps the voice)
 *   - `title`   → a short, vivid title from the body
 *
 * Bound to `HeuristicDiaryAssistant` (deterministic, $0, offline,
 * test-safe). The port exists so an LLM-backed adapter can drop in
 * later behind the SAME contract, env-gated like the trip-planner
 * provider chain — adding it never breaks the heuristic path.
 *
 * Installed for the adventure-diary feature.
 */
export type DiaryAssistMode = 'prompt' | 'polish' | 'title';

export interface DiaryAssistInput {
  readonly mode: DiaryAssistMode;
  /** Required for `polish` / `title`; optional context for `prompt`. */
  readonly text?: string;
  readonly mood?: string;
  readonly place?: string;
}

export interface DiaryAssistResult {
  readonly mode: DiaryAssistMode;
  /** Populated for `polish` / `title`. */
  readonly text?: string;
  /** Populated for `prompt` (3 suggestions). */
  readonly suggestions?: readonly string[];
  /** False when the heuristic fallback produced this (UI can label). */
  readonly aiBacked: boolean;
}

export interface DiaryAiAssistant {
  assist(input: DiaryAssistInput): Promise<DiaryAssistResult>;
}

export const DIARY_AI_ASSISTANT = Symbol('DiaryAiAssistant');
