/**
 * ChatFlow behavior guards
 *
 * Pins the shared chat-flow registry so persona, clock, digests, and intention
 * prompts evolve deliberately rather than drifting per screen.
 */

import { THERAPIST_SYSTEM_PROMPT } from '../../constants/aiPrompts';
import { DAILY_PROMPTS } from '../../constants/dailyPrompts';
import { FLOWS, composeHistoryContextBlocks, composeSystemPrompt, flowForCheckInType } from '../../features/chat/flows';
import type { ChatFlowContext } from '../../features/chat/flows/types';
import { buildDailyCheckInSystemPrompt } from '../../services/ai/dailyCheckInPrompt';
import {
    MEMORY_PROMPT_BUDGET,
    applyMemoryPromptBudget,
    measureMemoryEstTokens,
} from '../../services/ai/memoryPromptBudget';
import { estimateTokensFromChars } from '../../services/ai/promptBudget';
import { HISTORY_TOOLS_POLICY } from '../../services/ai/tools';
import { buildIntentionSystemPrompt } from '../../services/intentions/intentionPrompts';
import type { Persona } from '../../services/personas/personasStorage.types';
import { buildClockContext } from '../../utils/date';
import * as memoryPromptBudget from '../../services/ai/memoryPromptBudget';

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

    it('feeds retrievedHistoryContext into the recall slot at index 3', () => {
        const recall = [
            '## Relevant long-term context',
            'Long-term recollections from the user\u2019s past entries.',
            '- sim=0.91 Maya got married (Written 2024-08-15)',
        ].join('\n');
        const ctx = withClock({
            identityContext: '## Identity\n- Preferred name: Ren',
            recentDaysContext: '## Recent day digests\n- Written 2026-07-12: sleep',
            retrievedHistoryContext: recall,
        });
        const blocks = composeHistoryContextBlocks(ctx);
        expect(blocks[0]).toContain('## Clock');
        expect(blocks[1]).toContain('Preferred name: Ren');
        expect(blocks[2]).toContain('Recent day digests');
        expect(blocks[3]).toContain('Maya got married');
        const out = composeSystemPrompt('BASE', ctx);
        expect(out).toContain('## Relevant long-term context');
        expect(out).toContain('Maya got married');
    });

    it('PR8b-2 wiring: oversize memory through composeSystemPrompt is capped ≤ MEMORY_PROMPT_BUDGET', () => {
        const pad = 'word '.repeat(4_000).trim();
        const digests = [
            '## Recent day digests',
            ...Array.from({ length: 30 }, (_, i) =>
                `- Written 2020-${String((i % 12) + 1).padStart(2, '0')}-01: day ${i} ${pad.slice(0, 400)}`
            ),
        ].join('\n');
        const capsule = `## Local Memory Capsule\n${pad}`;
        const recall = [
            '## Relevant past context',
            ...Array.from({ length: 20 }, (_, i) =>
                `- Written 2021-01-${String((i % 28) + 1).padStart(2, '0')}: recall ${i} ${pad.slice(0, 300)}`
            ),
        ].join('\n');
        const raw = {
            identity: '## Identity\n- Preferred name: Ren',
            digests,
            capsule,
            recall,
            goals: `## Goals\n${pad.slice(0, 2_000)}`,
            persona: `## Persona Guidance\n${pad.slice(0, 2_000)}`,
        };
        expect(measureMemoryEstTokens(raw)).toBeGreaterThan(MEMORY_PROMPT_BUDGET);

        const out = composeSystemPrompt('BASE', withClock({
            clockContext: '## Clock\nLocal date: 2026-07-18',
            identityContext: raw.identity,
            recentDaysContext: digests,
            localMemoryContext: capsule,
            retrievedHistoryContext: recall,
            goalsContext: raw.goals,
            activePersona: { ...persona, prompt: pad.slice(0, 2_000) },
            omitHistoryToolsPolicy: true,
        }));

        // Reconstruct memory blocks from assembly markers and re-measure.
        // Identity must survive; full pad must not (budget would keep it otherwise).
        expect(out).toContain('Preferred name: Ren');
        expect(out).toContain('BASE');
        // Memory contribution: strip base + clock (and empty joiners).
        const withoutStatic = out
            .replace('BASE', '')
            .replace('## Clock\nLocal date: 2026-07-18', '');
        const memEst = estimateTokensFromChars(withoutStatic.length);
        // Allow small overhead from joiners; still well under raw and at/near budget.
        expect(memEst).toBeLessThanOrEqual(MEMORY_PROMPT_BUDGET + 200);
        expect(memEst).toBeLessThan(measureMemoryEstTokens(raw));
    });

    it('PR8b-2 call-site sabotage: neuter applyMemoryPromptBudget → oversize leaks; restore caps', () => {
        const pad = 'word '.repeat(3_000).trim();
        const digests = `## Recent day digests\n- Written 2020-01-01: ${pad}\n- Written 2026-07-01: ${pad}`;
        const capsule = `## Local Memory Capsule\n${pad}`;
        const ctx = withClock({
            clockContext: '## Clock\nx',
            identityContext: '## Identity\n- Preferred name: Ren',
            recentDaysContext: digests,
            localMemoryContext: capsule,
            omitHistoryToolsPolicy: true,
        });

        const spy = jest
            .spyOn(memoryPromptBudget, 'applyMemoryPromptBudget')
            .mockImplementation((blocks) => ({
                blocks: { ...blocks },
                totalEstTokens: measureMemoryEstTokens(blocks),
                trimmed: false,
            }));

        try {
            const redOut = composeSystemPrompt('BASE', ctx);
            // Without budget, oversize pad material is retained.
            expect(redOut.length).toBeGreaterThan(20_000);
            expect(redOut.split('word ').length).toBeGreaterThan(2_000);
        } finally {
            spy.mockRestore();
        }

        const greenOut = composeSystemPrompt('BASE', ctx);
        expect(greenOut).toContain('Preferred name: Ren');
        // With real applyMemoryPromptBudget, assembly shrinks under cap pressure.
        expect(greenOut.length).toBeLessThan(20_000);
        expect(applyMemoryPromptBudget({
            identity: ctx.identityContext,
            digests: ctx.recentDaysContext,
            capsule: ctx.localMemoryContext,
        }).totalEstTokens).toBeLessThanOrEqual(MEMORY_PROMPT_BUDGET);
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
