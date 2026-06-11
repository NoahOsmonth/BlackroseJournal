/**
 * ChatFlow behavior guards (WS2/WS5)
 *
 * These tests pin the shared chat-flow registry so persona, guided openers,
 * and intention prompts evolve deliberately rather than drifting per screen.
 */

import { THERAPIST_SYSTEM_PROMPT } from '../../constants/aiPrompts';
import { DAILY_PROMPTS } from '../../constants/dailyPrompts';
import { FLOWS, composeSystemPrompt, flowForCheckInType } from '../../features/chat/flows';
import type { ChatFlowContext } from '../../features/chat/flows/types';
import { buildDailyCheckInSystemPrompt } from '../../services/ai/dailyCheckInPrompt';
import { buildIntentionSystemPrompt } from '../../services/intentions/intentionPrompts';
import type { Persona } from '../../services/personas/personasStorage.types';

const persona: Persona = {
    id: 'p1',
    name: 'Sage',
    tagline: 'Calm guide',
    voice: 'warm',
    prompt: 'Speak slowly and ask grounding questions.',
    model: 'agent-default',
    imagination: 50,
    createdAt: 0,
    updatedAt: 0,
};

describe('chat flows — freeform / continue', () => {
    const legacyFreeform = (ctx: ChatFlowContext) =>
        [THERAPIST_SYSTEM_PROMPT, ctx.localMemoryContext, ctx.feedbackGuidance]
            .filter(Boolean)
            .join('\n\n');

    it('freeform matches the legacy main-chat assembly (no persona)', () => {
        const ctx: ChatFlowContext = {
            localMemoryContext: '## Local Memory Capsule\nYou like mornings.',
            feedbackGuidance: '## Response Feedback Memory\nBe concise.',
        };
        expect(FLOWS.freeform.buildSystemPrompt(ctx)).toBe(legacyFreeform(ctx));
    });

    it('continue matches the legacy assembly identically to freeform', () => {
        const ctx: ChatFlowContext = {
            localMemoryContext: 'capsule',
            feedbackGuidance: 'guidance',
        };
        expect(FLOWS.continue.buildSystemPrompt(ctx)).toBe(legacyFreeform(ctx));
        expect(FLOWS.continue.buildSystemPrompt(ctx)).toBe(
            FLOWS.freeform.buildSystemPrompt(ctx)
        );
    });

    it('freeform omits the persona block when no active persona is provided', () => {
        const ctx: ChatFlowContext = { localMemoryContext: 'x', feedbackGuidance: 'y' };
        expect(FLOWS.freeform.buildSystemPrompt(ctx)).not.toContain('## Persona Guidance');
    });

    it('freeform includes the persona block when an active persona is provided', () => {
        const ctx: ChatFlowContext = { activePersona: persona };
        const out = FLOWS.freeform.buildSystemPrompt(ctx);
        expect(out).toContain('## Persona Guidance');
        expect(out).toContain(persona.prompt);
    });

    it('with no extra context, freeform equals the bare therapist prompt', () => {
        expect(FLOWS.freeform.buildSystemPrompt({})).toBe(THERAPIST_SYSTEM_PROMPT);
    });
});

describe('composeSystemPrompt', () => {
    it('joins base + memory + persona + feedback with double newlines, dropping empties', () => {
        const out = composeSystemPrompt('BASE', {
            localMemoryContext: 'MEM',
            activePersona: persona,
            feedbackGuidance: 'FB',
        });
        expect(out).toBe(
            ['BASE', 'MEM', `## Persona Guidance\n${persona.prompt}`, 'FB'].join('\n\n')
        );
    });
});

describe('chat flows — dailyCheckIn', () => {
    it('matches the legacy daily-check-in builder for a given prompt', () => {
        const ctx: ChatFlowContext = { dailyPrompt: DAILY_PROMPTS.morning };
        expect(FLOWS.dailyCheckIn.buildSystemPrompt(ctx)).toBe(
            buildDailyCheckInSystemPrompt(DAILY_PROMPTS.morning)
        );
    });
});

describe('chat flows — intention family', () => {
    const baseCtx: ChatFlowContext = {
        areaLabel: 'Wellbeing',
        intentionTitle: 'Walk daily',
        memorySummary: 'Felt energized last time.',
        feedbackGuidance: '## Response Feedback Memory\nWarmer tone.',
    };

    const legacy = (type: 'morning' | 'evening' | 'intention', ctx: ChatFlowContext) =>
        buildIntentionSystemPrompt({
            type,
            areaLabel: ctx.areaLabel,
            intentionTitle: ctx.intentionTitle,
            personaPrompt: ctx.activePersona?.prompt,
            memorySummary: ctx.memorySummary,
            feedbackGuidance: ctx.feedbackGuidance,
        });

    it('morning matches the legacy intention assembly', () => {
        expect(FLOWS.morning.buildSystemPrompt(baseCtx)).toBe(legacy('morning', baseCtx));
    });

    it('evening matches the legacy intention assembly', () => {
        expect(FLOWS.evening.buildSystemPrompt(baseCtx)).toBe(legacy('evening', baseCtx));
    });

    it('intention matches the legacy intention assembly', () => {
        expect(FLOWS.intention.buildSystemPrompt(baseCtx)).toBe(legacy('intention', baseCtx));
    });

    it('intentionRefine specializes the prompt around the existing intention', () => {
        const out = FLOWS.intentionRefine.buildSystemPrompt(baseCtx);
        expect(out).toContain('helping refine the existing intention');
        expect(out).toContain(baseCtx.intentionTitle);
        expect(out).not.toBe(legacy('intention', baseCtx));
    });

    it('guided intention flows expose distinct warm openers', () => {
        expect(FLOWS.morning.openingMessage?.(baseCtx)).toContain('Good morning');
        expect(FLOWS.evening.openingMessage?.(baseCtx)).toContain('Evening');
        expect(FLOWS.intention.openingMessage?.(baseCtx)).toContain('Wellbeing');
        expect(FLOWS.intentionRefine.openingMessage?.(baseCtx)).toContain('Walk daily');
    });

    it('new intention flow carries the clarify/envision/commit scaffold', () => {
        expect(FLOWS.intention.stages?.map((stage) => stage.id)).toEqual([
            'clarify',
            'envision',
            'commit',
        ]);
    });

    it('injects the persona block iff an active persona is present', () => {
        const withPersona = { ...baseCtx, activePersona: persona };
        const out = FLOWS.morning.buildSystemPrompt(withPersona);
        expect(out).toContain('## Persona Guidance');
        expect(out).toContain(persona.prompt);
        expect(out).toBe(legacy('morning', withPersona));

        expect(FLOWS.morning.buildSystemPrompt(baseCtx)).not.toContain('## Persona Guidance');
    });
});

describe('flowForCheckInType', () => {
    it('maps each check-in type to its flow', () => {
        expect(flowForCheckInType('morning')).toBe(FLOWS.morning);
        expect(flowForCheckInType('evening')).toBe(FLOWS.evening);
        expect(flowForCheckInType('intention')).toBe(FLOWS.intention);
        expect(flowForCheckInType('intentionRefine')).toBe(FLOWS.intentionRefine);
    });
});
