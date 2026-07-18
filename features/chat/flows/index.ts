/**
 * ChatFlow registry (WS2 keystone abstraction)
 *
 * `FLOWS` maps every conversational surface to a declarative `ChatFlow`. The
 * single engine `useChatOrchestration` reads a flow to derive its system prompt
 * and opener, so persona/memory/feedback are woven uniformly in ONE place.
 */

import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import { buildDailyCheckInSystemPrompt } from '@/services/ai/dailyCheckInPrompt';
import { HISTORY_TOOLS_POLICY } from '@/services/ai/tools';
import {
    buildIntentionRefineSystemPrompt,
    buildIntentionSystemPrompt,
} from '@/services/intentions/intentionPrompts';
import type { IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';
import { buildClockContext } from '@/utils/date';

import type { ChatFlow, ChatFlowContext, ChatFlowId } from './types';

function resolveClockContext(ctx: ChatFlowContext): string {
    if (ctx.clockContext) return ctx.clockContext;
    return buildClockContext(ctx.now !== undefined ? new Date(ctx.now) : new Date());
}

/**
 * Shared time/history blocks used by freeform and intention-family flows.
 */
export function composeHistoryContextBlocks(ctx: ChatFlowContext): string[] {
    return [
        resolveClockContext(ctx),
        // Identity before digests/capsule so name never loses ranking slots.
        ctx.identityContext,
        ctx.recentDaysContext,
        ctx.retrievedHistoryContext,
        ctx.omitHistoryToolsPolicy ? undefined : HISTORY_TOOLS_POLICY,
    ].filter((block): block is string => Boolean(block));
}

/**
 * The single seam where clock, digests, persona, memory, and feedback are woven
 * into a base prompt.
 */
export function composeSystemPrompt(base: string, ctx: ChatFlowContext): string {
    return [
        base,
        ...composeHistoryContextBlocks(ctx),
        ctx.localMemoryContext,
        ctx.goalsContext,
        ctx.activePersona?.prompt
            ? `## Persona Guidance\n${ctx.activePersona.prompt}`
            : undefined,
        ctx.feedbackGuidance,
    ]
        .filter(Boolean)
        .join('\n\n');
}

/** Builds the intention-family prompt with shared clock/history blocks. */
function buildIntentionFlowPrompt(
    type: IntentionCheckInType,
    ctx: ChatFlowContext
): string {
    const base = buildIntentionSystemPrompt({
        type,
        areaLabel: ctx.areaLabel,
        intentionTitle: ctx.intentionTitle,
        personaPrompt: ctx.activePersona?.prompt,
        memorySummary: ctx.memorySummary,
        feedbackGuidance: ctx.feedbackGuidance,
    });
    const shared = composeHistoryContextBlocks(ctx);
    const memory = ctx.localMemoryContext;
    return [
        base,
        ...shared,
        memory,
        ctx.goalsContext,
    ]
        .filter(Boolean)
        .join('\n\n');
}

const freeform: ChatFlow = {
    id: 'freeform',
    buildSystemPrompt: (ctx) => composeSystemPrompt(THERAPIST_SYSTEM_PROMPT, ctx),
};

const continueFlow: ChatFlow = {
    id: 'continue',
    buildSystemPrompt: (ctx) => composeSystemPrompt(THERAPIST_SYSTEM_PROMPT, ctx),
};

const dailyCheckIn: ChatFlow = {
    id: 'dailyCheckIn',
    buildSystemPrompt: (ctx) =>
        composeSystemPrompt(
            ctx.dailyPrompt
                ? buildDailyCheckInSystemPrompt(ctx.dailyPrompt)
                : THERAPIST_SYSTEM_PROMPT,
            ctx,
        ),
};

const morning: ChatFlow = {
    id: 'morning',
    buildSystemPrompt: (ctx) => buildIntentionFlowPrompt('morning', ctx),
    openingMessage: () =>
        "Good morning. Let's set the tone for your day. How are you arriving here this morning?",
};

const evening: ChatFlow = {
    id: 'evening',
    buildSystemPrompt: (ctx) => buildIntentionFlowPrompt('evening', ctx),
    openingMessage: () =>
        "Evening. Let's gently look back on your day. What feels most present right now?",
};

const intention: ChatFlow = {
    id: 'intention',
    buildSystemPrompt: (ctx) => buildIntentionFlowPrompt('intention', ctx),
    openingMessage: (ctx) =>
        `What is calling for your attention${ctx.areaLabel ? ` in ${ctx.areaLabel}` : ''} right now?`,
    stages: [
        { id: 'clarify', instruction: 'Clarify what needs attention.' },
        { id: 'envision', instruction: 'Help the user envision success.' },
        { id: 'commit', instruction: 'Guide the user to one concrete step this week.' },
    ],
};

const intentionRefine: ChatFlow = {
    id: 'intentionRefine',
    buildSystemPrompt: (ctx) => {
        const base = buildIntentionRefineSystemPrompt({
            intentionTitle: ctx.intentionTitle,
            personaPrompt: ctx.activePersona?.prompt,
            memorySummary: ctx.memorySummary,
            feedbackGuidance: ctx.feedbackGuidance,
        });
        return [
            base,
            ...composeHistoryContextBlocks(ctx),
            ctx.localMemoryContext,
            ctx.goalsContext,
        ]
            .filter(Boolean)
            .join('\n\n');
    },
    openingMessage: (ctx) =>
        `I see you're working on "${ctx.intentionTitle ?? 'this intention'}." What would you like to adjust or build on?`,
};

export const FLOWS: Record<ChatFlowId, ChatFlow> = {
    freeform,
    continue: continueFlow,
    dailyCheckIn,
    morning,
    evening,
    intention,
    intentionRefine,
};

/** Maps an intention check-in type to its corresponding flow. */
export function flowForCheckInType(type: IntentionCheckInType | 'intentionRefine'): ChatFlow {
    if (type === 'morning') return FLOWS.morning;
    if (type === 'evening') return FLOWS.evening;
    if (type === 'intentionRefine') return FLOWS.intentionRefine;
    return FLOWS.intention;
}
