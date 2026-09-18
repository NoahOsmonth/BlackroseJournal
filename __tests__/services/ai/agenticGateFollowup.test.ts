/**
 * Unit tests for Pi-style tool cues, follow-up conversation persistence,
 * and continuous agent harness gating in agenticGate.ts.
 */

import {
    hasPriorToolContext,
    resolveHistoryToolsBranch,
    selectToolShortlist,
    shouldEnableHistoryTools,
} from '../../../services/ai/agenticGate';
import type { Message } from '../../../services/ai/chatTypes';
import { HISTORY_TOOL_DEFINITIONS } from '../../../services/ai/tools/definitions';
import type { ToolCapability } from '../../../services/ai/tools/toolCapability';

const nativeCap: ToolCapability = {
    mode: 'structured',
    runAgentLoop: true,
    sendToolsInApi: true,
    parseTextToolDumps: true,
    preferTextResultProtocol: false,
};

function userMessage(content: string): Message {
    return { id: `u-${content.length}`, role: 'user', content, timestamp: Date.now() };
}

function withPriorTurns(userText: string, priorUserTurns: number): Message[] {
    const out: Message[] = [];
    for (let i = 0; i < priorUserTurns; i += 1) {
        out.push({ id: `prior-u-${i}`, role: 'user', content: `earlier note ${i}`, timestamp: 0 });
        out.push({ id: `prior-a-${i}`, role: 'assistant', content: 'ok', timestamp: 0 });
    }
    out.push(userMessage(userText));
    return out;
}

describe('resolveHistoryToolsBranch — Pi-style tool cues & follow-ups', () => {
    it('explicit tool cues enable tools and return tool-cue branch', () => {
        const testPhrases = [
            'try to do more tool calling',
            'just do all tool calling because im testing if you are doing it good',
            'test the tools',
            'test tool calling',
            'inspect what is on device',
            'please search my history for reflections',
            'look up what I wrote yesterday',
            'pull up my past notes',
            'fetch device status',
        ];
        for (const text of testPhrases) {
            const msgs = withPriorTurns(text, 5);
            const branch = resolveHistoryToolsBranch('auto', text, msgs);
            expect(['tool-cue', 'historyIntent']).toContain(branch);
            expect(shouldEnableHistoryTools('auto', text, msgs)).toBe(true);
        }
    });

    it('detects user query "did you remember my first chat with you" as historyIntent', () => {
        const msgs = [userMessage('did you remember my first chat with you')];
        expect(resolveHistoryToolsBranch('auto', msgs[0].content, msgs)).toBe('historyIntent');
        expect(shouldEnableHistoryTools('auto', msgs[0].content, msgs)).toBe(true);
    });

    it('follow-up in conversation with prior toolActivity enables tools via conversation-followup', () => {
        const conversationWithTools: Message[] = [
            userMessage('did you remember my first chat with you'),
            {
                id: 'a-1',
                role: 'assistant',
                content: 'I checked your previous entries on device.',
                timestamp: 1,
                toolActivity: [{
                    toolCallId: 'call_1',
                    name: 'get_day',
                    label: 'Get Day',
                    argsPreview: '2026-01-01',
                    status: 'ok',
                    round: 1,
                }],
            },
            userMessage('hmm sure'),
        ];

        expect(resolveHistoryToolsBranch('auto', 'hmm sure', conversationWithTools)).toBe('conversation-followup');
        expect(shouldEnableHistoryTools('auto', 'hmm sure', conversationWithTools)).toBe(true);
    });

    it('follow-ups like "sure", "yes", "tell me more", "done?" continue tool availability', () => {
        const baseConvo: Message[] = [
            userMessage('what happened on 2026-01-01'),
            {
                id: 'a-1',
                role: 'assistant',
                content: 'Let me check what is on the device for you...',
                timestamp: 1,
            },
        ];

        const followUps = ['sure', 'yes', 'yeah', 'tell me more', 'what about the other one', 'done?', 'go ahead'];
        for (const text of followUps) {
            const msgs = [...baseConvo, userMessage(text)];
            expect(resolveHistoryToolsBranch('auto', text, msgs)).toBe('conversation-followup');
            expect(shouldEnableHistoryTools('auto', text, msgs)).toBe(true);
        }
    });

    it('arbitrary natural follow-up questions in conversations with prior tool context retain tools', () => {
        const baseConvo: Message[] = [
            userMessage('search my journal for anxiety'),
            {
                id: 'a-1',
                role: 'assistant',
                content: 'I found several entries on the device.',
                timestamp: 1,
                toolActivity: [{
                    toolCallId: 'call_1',
                    name: 'search_history',
                    label: 'Search',
                    argsPreview: 'anxiety',
                    status: 'ok',
                    round: 1,
                }],
            },
        ];

        // None of these are in FOLLOW_UP_RE, but they are valid follow-up queries in an active tool conversation
        const arbitraryFollowUps = [
            'What did I say about Dr. Smith?',
            'Can you check line 5 again?',
            'Did I mention anything about sleep?',
            'Tell me about the second entry',
            'Give me the full details',
        ];

        for (const text of arbitraryFollowUps) {
            const msgs = [...baseConvo, userMessage(text)];
            // Without passing capability, conversation-followup or historyIntent fires
            const branch = resolveHistoryToolsBranch('auto', text, msgs);
            expect(['conversation-followup', 'historyIntent']).toContain(branch);
            expect(shouldEnableHistoryTools('auto', text, msgs)).toBe(true);
        }
    });

    it('assistant phrases matching ASSISTANT_TOOL_CONTEXT_RE provide prior tool context', () => {
        const assistantPhrases = [
            'I looked at your entries from last week...',
            'According to your past journal conversations, you felt stressed.',
            'From what I found on the device, you had 2 entries.',
        ];

        for (const assistantContent of assistantPhrases) {
            const msgs: Message[] = [
                userMessage('notes'),
                { id: 'a-1', role: 'assistant', content: assistantContent, timestamp: 1 },
            ];
            expect(hasPriorToolContext([...msgs, userMessage('what else?')])).toBe(true);
        }
    });

    it('conversations without prior tool context do NOT treat generic words as tool follow-ups', () => {
        const msgs = withPriorTurns('sure', 5);
        expect(resolveHistoryToolsBranch('auto', 'sure', msgs)).toBe('none');
        expect(shouldEnableHistoryTools('auto', 'sure', msgs)).toBe(false);
    });

    it('native tool-capable models enable agent loop for substantive turns', () => {
        const msgs = withPriorTurns('what is your perspective on my thoughts?', 5);
        expect(resolveHistoryToolsBranch('auto', 'what is your perspective on my thoughts?', msgs, nativeCap)).toBe('native-capable');
        expect(shouldEnableHistoryTools('auto', 'what is your perspective on my thoughts?', msgs, nativeCap)).toBe(true);
    });

    it('native tool-capable models still bypass tools for trivial greetings to preserve latency', () => {
        const msgs = withPriorTurns('hi', 5);
        expect(resolveHistoryToolsBranch('auto', 'hi', msgs, nativeCap)).toBe('none');
        expect(shouldEnableHistoryTools('auto', 'hi', msgs, nativeCap)).toBe(false);
    });

    it('selectToolShortlist with conversation history retains prior tool scope on follow-ups', () => {
        const historyConvo: Message[] = [
            userMessage('what did I write about work last week?'),
            { id: 'a-1', role: 'assistant', content: 'Found entries...', timestamp: 1 },
            userMessage('hmm sure'),
        ];
        const short = selectToolShortlist('hmm sure', historyConvo);
        expect(short.branch).toBe('history-days');
        expect(short.names).toContain('get_day');
    });

    it('selectToolShortlist on explicit tool cues provides all tools', () => {
        const short = selectToolShortlist('try to do more tool calling');
        expect(short.branch).toBe('all-fallback');
        // Derived from the registry so adding/removing a tool cannot drift here.
        expect(short.names).toHaveLength(HISTORY_TOOL_DEFINITIONS.length);
    });

    it('handles the exact 5-turn user sequence without ever dropping tools', () => {
        const thread: Message[] = [];

        // Turn 1: User: "did you remember my first chat with you"
        thread.push(userMessage('did you remember my first chat with you'));
        expect(shouldEnableHistoryTools('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe(true);

        // Assistant Turn 1 reply with toolActivity
        thread.push({
            id: 'a-1',
            role: 'assistant',
            content: 'Let me check what is on the device for you...',
            timestamp: Date.now(),
            toolActivity: [{
                toolCallId: 'call_1',
                name: 'list_recent_days',
                label: 'Recent Days',
                argsPreview: '',
                status: 'ok',
                round: 1,
            }],
        });

        // Turn 2: User: "hmm sure"
        thread.push(userMessage('hmm sure'));
        expect(shouldEnableHistoryTools('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe(true);
        expect(resolveHistoryToolsBranch('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe('conversation-followup');

        // Assistant Turn 2 reply
        thread.push({
            id: 'a-2',
            role: 'assistant',
            content: 'I have a few days here...',
            timestamp: Date.now(),
        });

        // Turn 3: User: "try to do more tool calling"
        thread.push(userMessage('try to do more tool calling'));
        expect(shouldEnableHistoryTools('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe(true);
        expect(resolveHistoryToolsBranch('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe('tool-cue');

        // Assistant Turn 3 reply
        thread.push({
            id: 'a-3',
            role: 'assistant',
            content: 'Got it — let me actually use what is on the phone...',
            timestamp: Date.now(),
        });

        // Turn 4: User: "just do all tool calling because im testing if you are doing it good"
        thread.push(userMessage('just do all tool calling because im testing if you are doing it good'));
        expect(shouldEnableHistoryTools('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe(true);
        expect(resolveHistoryToolsBranch('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe('tool-cue');

        // Assistant Turn 4 reply
        thread.push({
            id: 'a-4',
            role: 'assistant',
            content: 'Fair enough — let me actually run through the tools properly...',
            timestamp: Date.now(),
        });

        // Turn 5: User: "done?"
        thread.push(userMessage('done?'));
        expect(shouldEnableHistoryTools('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe(true);
        expect(resolveHistoryToolsBranch('auto', thread[thread.length - 1].content, thread, nativeCap)).toBe('conversation-followup');
    });
});
