/**
 * PR8c: stream-path usage logging — real prompt_tokens when present;
 * explicit usage-unavailable when omitted (never bare n/a).
 */

import {
    attachRealUsage,
    buildLedgerFromAssembledRequest,
    formatPromptBudgetLogLine,
} from '../../../services/ai/promptBudget';
import { parseSseLine } from '../../../services/ai/sseParser';
import type { Message } from '../../../services/ai/chatTypes';

const msgs = (user: string): Message[] => [
    { id: '1', role: 'user', content: user, timestamp: 1 },
];

describe('PR8c stream usage logging', () => {
    it('parseSseLine captures usage from a final stream chunk', () => {
        const line = 'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":1842,"completion_tokens":12,"total_tokens":1854}}';
        const parsed = parseSseLine(line);
        expect(parsed).not.toBeNull();
        expect(parsed!.usage).toEqual({
            prompt_tokens: 1842,
            completion_tokens: 12,
            total_tokens: 1854,
        });
    });

    it('scripted stream WITH usage → log line shows the real number', () => {
        const ledger = attachRealUsage(
            buildLedgerFromAssembledRequest({
                systemPrompt: 'COMPANION\n\n## Clock\nLocal date: 2026-07-18',
                messages: msgs('hi'),
                toolsBranch: 'none',
            }),
            { prompt_tokens: 1842 }
        );
        const line = formatPromptBudgetLogLine(ledger);
        expect(line).toContain('real.prompt_tokens=1842');
        expect(line).not.toContain('n/a');
        expect(line).not.toContain('usage-unavailable');
    });

    it('scripted stream WITHOUT usage → explicit usage-unavailable marker (never bare n/a)', () => {
        const ledger = buildLedgerFromAssembledRequest({
            systemPrompt: 'COMPANION\n\n## Clock\nLocal date: 2026-07-18',
            messages: msgs('hi'),
            toolsBranch: 'none',
        });
        const line = formatPromptBudgetLogLine(ledger);
        expect(line).toContain('real.prompt_tokens=usage-unavailable');
        expect(line).not.toMatch(/real\.prompt_tokens=n\/a\b/);
        expect(line).toContain('estTotal=');
    });
});
