/**
 * ChatFlow behavior guards
 *
 * Pins the shared chat-flow registry so persona, clock, digests, and intention
 * prompts evolve deliberately rather than drifting per screen.
 */

import { THERAPIST_SYSTEM_PROMPT } from '../../constants/aiPrompts';
import { DAILY_PROMPTS } from '../../constants/dailyPrompts';
import { FLOWS, composeSystemPrompt, flowForCheckInType } from '../../features/chat/flows';
import type { ChatFlowContext } from '../../features/chat/flows/types';
import { buildDailyCheckInSystemPrompt } from '../../services/ai/dailyCheckInPrompt';
import { HISTORY_TOOLS_POLICY } from '../../services/ai/tools';
import { buildIntentionSystemPrompt } from '../../services/intentions/intentionPrompts';
import type { Persona } from '../../services/personas/personasStorage.types';
import { buildClockContext } from '../../utils/date';

const FIXED_NOW = new Date(2026, 6, 13, 9, 0, 0).getTime();

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

function withClock(ctx: ChatFlowContext = {}): ChatFlowContext {
    return { now: FIXED_NOW, ...ctx };
}

describe('chat flows — freeform / continue', () => {
    it('freeform includes clock + history tools policy by default', () => {
        const out = FLOWS.freeform.buildSystemPrompt(withClock({}));
        expect(out).toContain(THERAPIST_SYSTEM_PROMPT);
        expect(out).toContain('## Clock');
        expect(out).toContain('Local date: 2026-07-13');
        expect(out).toContain(HISTORY_TOOLS_POLICY);
    });

    it('continue matches freeform assembly', () => {
        const ctx = withClock({
            localMemoryContext: 'capsule',
            feedbackGuidance: 'guidance',
        });
        expect(FLOWS.continue.buildSystemPrompt(ctx)).toBe(
            FLOWS.freeform.buildSystemPrompt(ctx)
        );
    });

    it('freeform omits the persona block when no active persona is provided', () => {
        const ctx = withClock({ localMemoryContext: 'x', feedbackGuidance: 'y' });
        expect(FLOWS.freeform.buildSystemPrompt(ctx)).not.toContain('## Persona Guidance');
    });

    it('freeform includes the persona block when an active persona is provided', () => {
        const ctx = withClock({ activePersona: persona });
        const out = FLOWS.freeform.buildSystemPrompt(ctx);
        expect(out).toContain('## Persona Guidance');
        expect(out).toContain(persona.prompt);
    });
});

describe('composeSystemPrompt', () => {
    it('orders clock, identity, digests, memory, goals, persona, feedback', () => {
        const goalsContext = "## User's Current Goals and Habits\n- Walk daily (Goal)";
        const clock = buildClockContext(new Date(FIXED_NOW));
        const identity = '## Identity\n- Preferred name: Sigurd';
        const out = composeSystemPrompt('BASE', withClock({
            clockContext: clock,
            identityContext: identity,
            recentDaysContext: '## Recent day digests\n- 2026-07-12: sleep',
            localMemoryContext: 'MEM',
            goalsContext,
            activePersona: persona,
            feedbackGuidance: 'FB',
        }));
        expect(out.indexOf('BASE')).toBeLessThan(out.indexOf('## Clock'));
        expect(out.indexOf('## Clock')).toBeLessThan(out.indexOf('## Identity'));
        expect(out.indexOf('## Identity')).toBeLessThan(out.indexOf('## Recent day digests'));
        expect(out.indexOf('## Recent day digests')).toBeLessThan(out.indexOf('MEM'));
        expect(out.indexOf('MEM')).toBeLessThan(out.indexOf(goalsContext));
        expect(out.indexOf(goalsContext)).toBeLessThan(out.indexOf('## Persona Guidance'));
        expect(out.indexOf('## Persona Guidance')).toBeLessThan(out.indexOf('FB'));
    });

    it('can omit history tools policy', () => {
        const out = composeSystemPrompt('BASE', withClock({ omitHistoryToolsPolicy: true }));
        expect(out).not.toContain('## History tools');
    });
});

describe('chat flows — dailyCheckIn', () => {
    it('includes guided daily prompt plus shared history/identity blocks', () => {
        const identity = '## Identity\n- Preferred name: Sigurd';
        const ctx: ChatFlowContext = withClock({
            dailyPrompt: DAILY_PROMPTS.morning,
            identityContext: identity,
        });
        const out = FLOWS.dailyCheckIn.buildSystemPrompt(ctx);
        expect(out).toContain(buildDailyCheckInSystemPrompt(DAILY_PROMPTS.morning));
        expect(out).toContain('## Clock');
        expect(out).toContain('Preferred name: Sigurd');
        expect(out).toContain(HISTORY_TOOLS_POLICY);
    });
});

describe('chat flows — intention family', () => {
    const baseCtx: ChatFlowContext = withClock({
        areaLabel: 'Wellbeing',
        intentionTitle: 'Walk daily',
        memorySummary: 'Prior summary',
        feedbackGuidance: 'Be warm.',
    });

    it('includes clock and tools policy on morning flow', () => {
        const out = FLOWS.morning.buildSystemPrompt(baseCtx);
        expect(out).toContain(buildIntentionSystemPrompt({
            type: 'morning',
            areaLabel: 'Wellbeing',
            intentionTitle: 'Walk daily',
            memorySummary: 'Prior summary',
            feedbackGuidance: 'Be warm.',
        }));
        expect(out).toContain('## Clock');
        expect(out).toContain('## On-device tools');
        expect(out).toMatch(/use freely|proactive/i);
    });

    it('flowForCheckInType maps types', () => {
        expect(flowForCheckInType('morning').id).toBe('morning');
        expect(flowForCheckInType('evening').id).toBe('evening');
        expect(flowForCheckInType('intentionRefine').id).toBe('intentionRefine');
        expect(flowForCheckInType('intention').id).toBe('intention');
    });
});
