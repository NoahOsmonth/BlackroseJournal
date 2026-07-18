/**
 * PR8a prompt-budget ledger — estimator, sum==assembled, sabotage.
 * Never mocks the unit under test (promptBudget.ts).
 */

import {
    assembleSystemPromptFromLedger,
    buildLedgerFromAssembledRequest,
    buildPromptBudgetLedger,
    estimateTokens,
    estimateTokensFromChars,
    formatPromptBudgetLogLine,
    sumSystemBlockChars,
} from '../../../services/ai/promptBudget';
import type { Message } from '../../../services/ai/chatTypes';

const msgs = (user: string): Message[] => [
    { id: '1', role: 'user', content: user, timestamp: 1 },
];

describe('promptBudget estimator', () => {
    it('estimates tokens as ceil(chars/4)', () => {
        expect(estimateTokensFromChars(0)).toBe(0);
        expect(estimateTokensFromChars(1)).toBe(1);
        expect(estimateTokensFromChars(4)).toBe(1);
        expect(estimateTokensFromChars(5)).toBe(2);
        expect(estimateTokens('abcd')).toBe(1);
        expect(estimateTokens('abcde')).toBe(2);
        expect(estimateTokens('')).toBe(0);
        expect(estimateTokens(undefined)).toBe(0);
    });
});

describe('promptBudget ledger vs assembled system', () => {
    const companion = 'COMPANION_STATIC_BODY';
    const clock = '## Clock\nLocal date: 2026-07-18';
    const identity = '## Identity (always-on core memory)\n- Preferred name: Ren';
    const rollups = '## Recent day digests\n- Written 2026-07-17: sleep';
    const policy = '## On-device tools — use freely (proactive)\nCall get_clock.';
    const capsule = '## Local Memory Capsule\n- note';

    it('ledger systemChars equals assembled system prompt length', () => {
        const assembled = [companion, clock, identity, rollups, policy, capsule].join('\n\n');
        const ledger = buildLedgerFromAssembledRequest({
            systemPrompt: assembled,
            messages: msgs('hello there friend'),
            toolsBranch: 'first-turns',
            includeToolsSchema: true,
        });

        expect(ledger.systemChars).toBe(assembled.length);
        // Block texts reassemble to the same system string (sections only).
        const rebuilt = assembleSystemPromptFromLedger(ledger);
        expect(rebuilt.replace(/\n+$/, '')).toBe(assembled.replace(/\n+$/, ''));
        expect(sumSystemBlockChars(ledger)).toBeGreaterThan(0);
        expect(ledger.blocks.some((b) => b.label === 'user-message')).toBe(true);
        expect(ledger.blocks.some((b) => b.label === 'tools-schema')).toBe(true);

        const line = formatPromptBudgetLogLine(ledger);
        expect(line).toContain('[prompt-budget]');
        expect(line).toContain('branch=first-turns');
        expect(line).toContain('system-companion-static=');
    });

    it('buildPromptBudgetLedger sum of system parts + joiners matches compose join', () => {
        const ledger = buildPromptBudgetLedger({
            systemCompanionStatic: companion,
            clockDoctrine: clock,
            identity,
            rollups,
            toolsPolicy: policy,
            capsule,
            messages: msgs('x'),
            toolsBranch: 'none',
        });
        const joined = [companion, clock, identity, rollups, policy, capsule].join('\n\n');
        expect(ledger.systemChars).toBe(joined.length);
    });

    /**
     * Sabotage: drop one block from the ledger input → assembled length mismatch → red.
     * Restore → green. Proves the equality assertion is load-bearing.
     */
    it('sabotage: dropping a block from ledger input fails length equality; restore passes', () => {
        const assembled = [companion, clock, identity, rollups, policy].join('\n\n');

        // GREEN: full assembly
        const full = buildLedgerFromAssembledRequest({
            systemPrompt: assembled,
            messages: msgs('hi'),
            toolsBranch: 'none',
        });
        expect(full.systemChars).toBe(assembled.length);
        expect(assembleSystemPromptFromLedger(full).replace(/\n+$/, '')).toBe(
            assembled.replace(/\n+$/, ''),
        );

        // RED: pretend rollups never made it into the measured system string
        // but we still claim the full assembled length — simulate by removing
        // rollups section from systemPrompt while keeping join structure wrong.
        const withoutRollups = [companion, clock, identity, policy].join('\n\n');
        const sabotaged = buildLedgerFromAssembledRequest({
            systemPrompt: withoutRollups,
            messages: msgs('hi'),
            toolsBranch: 'none',
        });
        // Equality to the *full* assembled must fail when a block was dropped.
        expect(sabotaged.systemChars).not.toBe(assembled.length);
        expect(assembleSystemPromptFromLedger(sabotaged)).not.toBe(assembled);

        // RESTORE: measure the reduced prompt against itself → green again
        expect(sabotaged.systemChars).toBe(withoutRollups.length);
        expect(assembleSystemPromptFromLedger(sabotaged).replace(/\n+$/, '')).toBe(
            withoutRollups.replace(/\n+$/, ''),
        );
    });
});
