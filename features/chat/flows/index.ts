/**
 * ChatFlow registry (WS2 keystone abstraction)
 *
 * `FLOWS` maps every conversational surface to a declarative `ChatFlow`. The
 * single engine `useChatOrchestration` reads a flow to derive its system prompt
 * and opener, so persona/memory/feedback are woven uniformly in ONE place.
 *
 * Behavior-preservation contract: each flow's `buildSystemPrompt` reproduces the
 * exact prompt the screens assembled inline before this refactor. See
 * `__tests__/features/chatFlows.test.ts` for the byte-identity guards.
 */

import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import { buildDailyCheckInSystemPrompt } from '@/services/ai/dailyCheckInPrompt';
import {
    buildIntentionRefineSystemPrompt,
    buildIntentionSystemPrompt,
} from '@/services/intentions/intentionPrompts';
import type { IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';

import type { ChatFlow, ChatFlowContext, ChatFlowId } from './types';

/**
 * The single seam where persona + memory + feedback are woven into a base
 * prompt. Used by the freeform flows. The persona slot stays `undefined`
 * unless `ctx.activePersona` is provided (WS3 supplies it), so today's
 * freeform output — which never injected persona — is byte-identical.
 */
export function composeSystemPrompt(base: string, ctx: ChatFlowContext): string {
    return [
        base,
        ctx.localMemoryContext,
        ctx.activePersona?.prompt
            ? `## Persona Guidance\n${ctx.activePersona.prompt}`
            : undefined,
        ctx.feedbackGuidance,
    ]
        .filter(Boolean)
        .join('\n\n');
}

/** Builds the intention-family prompt; preserves the legacy assembly exactly. */
function buildIntentionFlowPrompt(
    type: IntentionCheckInType,
    ctx: ChatFlowContext
): string {
    return buildIntentionSystemPrompt({
        type,
        areaLabel: ctx.areaLabel,
        intentionTitle: ctx.intentionTitle,
        personaPrompt: ctx.activePersona?.prompt,
        memorySummary: ctx.memorySummary,
        feedbackGuidance: ctx.feedbackGuidance,
    });
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
        ctx.dailyPrompt
            ? buildDailyCheckInSystemPrompt(ctx.dailyPrompt)
            : composeSystemPrompt(THERAPIST_SYSTEM_PROMPT, ctx),
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
    buildSystemPrompt: (ctx) => buildIntentionRefineSystemPrompt({
        intentionTitle: ctx.intentionTitle,
        personaPrompt: ctx.activePersona?.prompt,
        memorySummary: ctx.memorySummary,
        feedbackGuidance: ctx.feedbackGuidance,
    }),
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
