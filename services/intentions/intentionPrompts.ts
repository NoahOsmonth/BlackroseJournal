import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import { IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';

interface IntentionPromptOptions {
    type: IntentionCheckInType;
    areaLabel?: string;
    intentionTitle?: string;
    personaPrompt?: string;
    memorySummary?: string;
}

export function buildIntentionSystemPrompt({
    type,
    areaLabel,
    intentionTitle,
    personaPrompt,
    memorySummary,
}: IntentionPromptOptions): string {
    const contextLabel =
        type === 'morning'
            ? 'Morning Intention'
            : type === 'evening'
                ? 'Evening Reflection'
                : 'Intention Check-In';

    const intentionLine = intentionTitle ? `Intention: ${intentionTitle}` : undefined;
    const areaLine = areaLabel ? `Life area: ${areaLabel}` : undefined;

    const contextBlock = [
        `## Current Session\nYou are guiding a ${contextLabel} chat.`,
        intentionLine,
        areaLine,
        memorySummary ? `Previous summary: ${memorySummary}` : undefined,
    ]
        .filter(Boolean)
        .join('\n');

    const personaBlock = personaPrompt
        ? `\n## Persona Guidance\n${personaPrompt}\n`
        : '';

    return `${THERAPIST_SYSTEM_PROMPT}\n\n${contextBlock}${personaBlock}`.trim();
}
