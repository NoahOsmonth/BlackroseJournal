/**
 * Unit tests for the task-intent gate + context-aware agent-turn token budget
 * (services/ai/agenticGate.ts). Pure — no storage, no network.
 */

import {
    resolveAgentTurnTokenBudget,
    resolveHistoryToolsBranch,
    shouldEnableHistoryTools,
} from '../../../services/ai/agenticGate';
import type { Message } from '../../../services/ai/chatTypes';

function userMessage(content: string): Message {
    return { id: `u-${content.length}`, role: 'user', content, timestamp: Date.now() };
}

/**
 * Build a messages array with `priorUserTurns` earlier user turns before the
 * latest text, so the `first-turns` branch (userTurns <= 2) never fires.
 */
function withPriorTurns(userText: string, priorUserTurns: number): Message[] {
    const out: Message[] = [];
    for (let i = 0; i < priorUserTurns; i += 1) {
        out.push({ id: `prior-u-${i}`, role: 'user', content: `earlier note ${i}`, timestamp: 0 });
        out.push({ id: `prior-a-${i}`, role: 'assistant', content: 'ok', timestamp: 0 });
    }
    out.push(userMessage(userText));
    return out;
}

describe('resolveHistoryToolsBranch — forced flags', () => {
    it('forced-false stays forced-false and disables tools regardless of text', () => {
        expect(
            resolveHistoryToolsBranch(false, 'what did I write last week?', [userMessage('what did I write last week?')])
        ).toBe('forced-false');
        expect(shouldEnableHistoryTools(false, 'add a goal', [userMessage('add a goal')])).toBe(false);
    });

    it('forced-true stays forced-true and enables tools regardless of text', () => {
        expect(resolveHistoryToolsBranch(true, 'hi', [userMessage('hi')])).toBe('forced-true');
        expect(shouldEnableHistoryTools(true, 'hi', [userMessage('hi')])).toBe(true);
    });
});

describe('resolveHistoryToolsBranch — branch precedence', () => {
    it('bootstrap synthetic lines return bootstrap and disable tools', () => {
        const bootstrap = [userMessage('[Start daily check-in]')];
        expect(resolveHistoryToolsBranch('auto', bootstrap[0].content, bootstrap)).toBe('bootstrap');
        expect(shouldEnableHistoryTools('auto', bootstrap[0].content, bootstrap)).toBe(false);
    });

    it('history questions return historyIntent', () => {
        const msgs = [userMessage('what did I write last week?')];
        expect(resolveHistoryToolsBranch('auto', msgs[0].content, msgs)).toBe('historyIntent');
    });

    it('task intent returns agentic-task and enables tools', () => {
        const taskPhrases = [
            'add a goal to run twice a week',
            'i want to start meditating',
            'make a plan for next week',
        ];
        for (const text of taskPhrases) {
            const msgs = withPriorTurns(text, 5);
            expect(resolveHistoryToolsBranch('auto', text, msgs)).toBe('agentic-task');
            expect(shouldEnableHistoryTools('auto', text, msgs)).toBe(true);
        }
    });

    it('history-intent words take precedence over task verbs (branch order preserved)', () => {
        // 'tomorrow' matches HISTORY_INTENT_RE before the agentic-task branch runs,
        // so this task phrase resolves to historyIntent — not agentic-task.
        const msgs = [userMessage('make a plan for tomorrow')];
        expect(resolveHistoryToolsBranch('auto', msgs[0].content, msgs)).toBe('historyIntent');
        // Tools still fire either way.
        expect(shouldEnableHistoryTools('auto', msgs[0].content, msgs)).toBe(true);
    });

    it('short noise with many prior user turns returns none', () => {
        const msgs = withPriorTurns('hi', 5);
        expect(resolveHistoryToolsBranch('auto', 'hi', msgs)).toBe('none');
        expect(shouldEnableHistoryTools('auto', 'hi', msgs)).toBe(false);
    });

    it('PROACTIVE_RE fires for tired/exhausted rants when no history word wins', () => {
        const msgs = [userMessage('so tired')];
        expect(resolveHistoryToolsBranch('auto', msgs[0].content, msgs)).toBe('PROACTIVE_RE');
        expect(shouldEnableHistoryTools('auto', msgs[0].content, msgs)).toBe(true);
    });

    it("'today' still routes to historyIntent, not PROACTIVE_RE (existing behavior)", () => {
        // 'today' is a HISTORY_INTENT_RE word; PROACTIVE_RE is checked after it.
        const msgs = [userMessage('so tired today')];
        expect(resolveHistoryToolsBranch('auto', msgs[0].content, msgs)).toBe('historyIntent');
    });
});

describe('resolveAgentTurnTokenBudget', () => {
    it('floors small windows up to 12_000', () => {
        // floor(16_384 * 0.5) = 8_192, clamped up to the 12_000 floor.
        expect(resolveAgentTurnTokenBudget(16_384, 24_000)).toBe(12_000);
        expect(resolveAgentTurnTokenBudget(2_048, 24_000)).toBe(12_000);
    });

    it('uses half the context window for mid-size windows', () => {
        expect(resolveAgentTurnTokenBudget(32_768, 24_000)).toBe(16_384);
    });

    it('caps at the provided cap for large windows', () => {
        expect(resolveAgentTurnTokenBudget(128_000, 24_000)).toBe(24_000);
    });
});
