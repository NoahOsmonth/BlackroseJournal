/**
 * Daily check-in system prompt builder.
 *
 * Extracted as a standalone, dependency-light module so it can be consumed by
 * the ChatFlow registry (WS2) without dragging in the streaming/storage chain
 * that `useChat.ts` pulls. The output is byte-identical to the prior inline
 * builder in `useChat.ts`.
 */

import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import { DailyPrompt } from '@/constants/dailyPrompts';

export function buildDailyCheckInSystemPrompt(prompt: DailyPrompt): string {
    return `${THERAPIST_SYSTEM_PROMPT}

## Current Check-In Context
The user is doing a "${prompt.title}" daily check-in. The prompt they're responding to is:
"${prompt.promptText}"

Begin the conversation with an appropriate greeting for this time of day and gently invite them to share what's on their mind. Use the follow-up style: "${prompt.aiFollowUp}"`;
}
