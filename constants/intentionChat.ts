export const INTENTION_START_TRIGGER_TEXT = '[Start intention check-in]';

export const DEFAULT_INTENTION_OPENING_PROMPT =
    'Financial wellbeing shapes so many aspects of life. Looking at your financial landscape right now, what about this area feels particularly important to you at this moment?';

export function resolveIntentionChatContent(content: string): string {
    return content === INTENTION_START_TRIGGER_TEXT
        ? DEFAULT_INTENTION_OPENING_PROMPT
        : content;
}
