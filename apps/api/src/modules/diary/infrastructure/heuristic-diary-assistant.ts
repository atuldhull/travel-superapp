/**
 * Deterministic, $0, offline diary assistant. Not an LLM — it's a
 * focused text engine that genuinely helps:
 *
 *   • prompt → 3 evocative, mood/place-aware writing prompts
 *   • polish → normalises raw notes into clean prose (keeps the
 *     traveller's words; fixes spacing, capitalisation, sentence
 *     punctuation, lone "i", paragraphs)
 *   • title  → a short vivid title distilled from the body
 *
 * `aiBacked: false` so the UI can honestly label it "Assisted" (not
 * "AI-generated"). The DiaryAiAssistant port lets a real LLM adapter
 * replace this later behind the same contract without touching
 * callers — same env-gated upgrade pattern as the trip planner.
 *
 * Installed for the adventure-diary feature.
 */
import { Injectable } from '@nestjs/common';
import type {
  DiaryAiAssistant,
  DiaryAssistInput,
  DiaryAssistResult,
} from '../application/ports/diary-ai-assistant.port';

@Injectable()
export class HeuristicDiaryAssistant implements DiaryAiAssistant {
  async assist(input: DiaryAssistInput): Promise<DiaryAssistResult> {
    if (input.mode === 'prompt') {
      return { mode: 'prompt', suggestions: this.prompts(input), aiBacked: false };
    }
    if (input.mode === 'title') {
      return { mode: 'title', text: this.title(input.text ?? ''), aiBacked: false };
    }
    return { mode: 'polish', text: this.polish(input.text ?? ''), aiBacked: false };
  }

  private prompts(input: DiaryAssistInput): string[] {
    const place = input.place?.trim();
    const where = place ? ` in ${place}` : ' today';
    const mood = input.mood?.trim()?.toLowerCase();
    const base = [
      `What is one moment from${where} you'll still remember in ten years?`,
      `Capture a sound, a smell, and a taste from${where} — set the scene.`,
      `Who did you meet${where}, and what did they leave you with?`,
      `What surprised you most${where} — and how did you react?`,
      `If${where} had a single colour, what would it be, and why?`,
    ];
    const byMood: Record<string, string> = {
      adventurous: `What risk did you take${where}, and was it worth it?`,
      calm: `Describe the quietest minute of your day${where}.`,
      tired: `What pushed you forward when you wanted to stop${where}?`,
      joyful: `What made you laugh out loud${where}?`,
    };
    const picked = [base[0]!, base[1]!];
    picked.push((mood && byMood[mood]) || base[2]!);
    return picked;
  }

  private polish(raw: string): string {
    const text = raw.replace(/\r\n/g, '\n').trim();
    if (text.length === 0) return '';
    // Split into paragraphs on blank lines; within each, normalise
    // spacing + sentence casing/punctuation, then regroup ~3 to a
    // paragraph for an even editorial rhythm.
    const sentences = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => this.fixSentence(s))
      .filter((s) => s.length > 0);
    const paras: string[] = [];
    for (let i = 0; i < sentences.length; i += 3) {
      paras.push(sentences.slice(i, i + 3).join(' '));
    }
    return paras.join('\n\n');
  }

  private fixSentence(s: string): string {
    let out = s.trim();
    if (out.length === 0) return '';
    out = out.replace(/\bi\b/g, 'I');
    out = out.charAt(0).toUpperCase() + out.slice(1);
    if (!/[.!?]$/.test(out)) out += '.';
    return out;
  }

  private title(body: string): string {
    const first =
      body
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=[.!?])\s/)[0] ?? '';
    const STOP = new Set(['the', 'a', 'an', 'and', 'but', 'so', 'then', 'we', 'i', 'my', 'our']);
    const words = first
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .split(' ')
      .filter(Boolean);
    const lead = words.filter((w) => !STOP.has(w.toLowerCase())).slice(0, 6);
    const chosen = (lead.length >= 2 ? lead : words.slice(0, 6)).join(' ');
    if (chosen.length === 0) return 'An Adventure to Remember';
    return chosen
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
