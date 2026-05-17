/**
 * Thin orchestration over the DiaryAiAssistant port: validate the
 * mode + required text, delegate, return the result. Kept as a
 * use-case (not a direct controller→port call) so a future LLM
 * adapter, rate-limit, or usage-metering slots in one place.
 *
 * Installed for the adventure-diary feature.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '@app/errors';
import {
  DIARY_AI_ASSISTANT,
  type DiaryAiAssistant,
  type DiaryAssistInput,
  type DiaryAssistResult,
} from './ports/diary-ai-assistant.port';

@Injectable()
export class AssistDiaryUseCase {
  constructor(@Inject(DIARY_AI_ASSISTANT) private readonly assistant: DiaryAiAssistant) {}

  execute(input: DiaryAssistInput): Promise<DiaryAssistResult> {
    if ((input.mode === 'polish' || input.mode === 'title') && !input.text?.trim()) {
      throw new ValidationError(
        `"${input.mode}" needs some text to work with`,
        { text: ['required for polish/title'] },
        { mode: input.mode },
        'DIARY_ASSIST_NEEDS_TEXT',
      );
    }
    return this.assistant.assist(input);
  }
}
