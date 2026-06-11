import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import { DAILY_PROMPTS } from '@/constants/dailyPrompts';
import { IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';

interface IntentionPromptOptions {
    type: IntentionCheckInType;
    areaLabel?: string;
    intentionTitle?: string;
    personaPrompt?: string;
    memorySummary?: string;
    feedbackGuidance?: string;
}

function sessionGuidance(type: IntentionCheckInType, areaLabel?: string): string {
    if (type === 'morning') {
        return [
            DAILY_PROMPTS.morning.aiFollowUp,
            'Guide the user toward one grounded intention for the day.',
            'Ask about energy, what would make today meaningful, and one realistic next step.',
        ].join('\n');
    }

    if (type === 'evening') {
        return [
            DAILY_PROMPTS.evening.aiFollowUp,
            'Help the user reflect on what happened, what they appreciate, and what to release.',
            'Keep the tone gentle and closing-oriented rather than productivity-focused.',
        ].join('\n');
    }

    return [
        `Guide a staged intention-setting conversation${areaLabel ? ` for ${areaLabel}` : ''}.`,
        'Move through three stages: Clarify what needs attention, envision success, then commit to one concrete step this week.',
        'Ask one focused question at a time and avoid sounding like a form.',
    ].join('\n');
}

export function buildIntentionRefineSystemPrompt({
    intentionTitle,
    personaPrompt,
    memorySummary,
    feedbackGuidance,
}: Omit<IntentionPromptOptions, 'type' | 'areaLabel'>): string {
    const contextBlock = [
        '## Current Session',
        `You are helping refine the existing intention: ${intentionTitle ?? 'Untitled intention'}.`,
        'Ask what the user wants to adjust, then help turn that into a clearer description or next direction.',
        'On finish, summarize the refined intention in concrete, user-owned language.',
        memorySummary ? `Previous summary: ${memorySummary}` : undefined,
    ]
        .filter(Boolean)
        .join('\n');

    const personaBlock = personaPrompt
        ? `\n## Persona Guidance\n${personaPrompt}\n`
        : '';

    const feedbackBlock = feedbackGuidance ? `\n${feedbackGuidance}\n` : '';

    return `${THERAPIST_SYSTEM_PROMPT}\n\n${contextBlock}${personaBlock}${feedbackBlock}`.trim();
}

export function buildIntentionSystemPrompt({
    type,
    areaLabel,
    intentionTitle,
    personaPrompt,
    memorySummary,
    feedbackGuidance,
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
        sessionGuidance(type, areaLabel),
        intentionLine,
        areaLine,
        memorySummary ? `Previous summary: ${memorySummary}` : undefined,
    ]
        .filter(Boolean)
        .join('\n');

    const personaBlock = personaPrompt
        ? `\n## Persona Guidance\n${personaPrompt}\n`
        : '';

    const feedbackBlock = feedbackGuidance ? `\n${feedbackGuidance}\n` : '';

    return `${THERAPIST_SYSTEM_PROMPT}\n\n${contextBlock}${personaBlock}${feedbackBlock}`.trim();
}
