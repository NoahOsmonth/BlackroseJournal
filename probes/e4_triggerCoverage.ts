/**
 * E4 — Trigger coverage audit (pure, no network).
 * Runs REAL shouldEnableHistoryTools + detectHistoryIntent against ~40 phrasings.
 */

import { shouldEnableHistoryTools } from '../services/ai/ai';
import { detectHistoryIntent } from '../services/ai/historyPrefetch';
import type { Message } from '../services/ai/chatTypes';
import { writeJsonArtifact, writeArtifact } from './shared/artifacts';

export interface TriggerCase {
    id: string;
    phrasing: string;
    expectFire: boolean;
    note?: string;
}

/** ~40 phrasings: should-fire + should-NOT-fire (known brittleness inventory). */
export const E4_CASES: TriggerCase[] = [
    // should-fire — history / recall
    { id: 'f01', phrasing: 'what did I write last week about work?', expectFire: true },
    { id: 'f02', phrasing: 'What did I talk about yesterday?', expectFire: true },
    { id: 'f03', phrasing: 'when is my birthday according to past entries?', expectFire: true, note: 'may miss — no temporal keyword in HISTORY_INTENT_RE' },
    { id: 'f04', phrasing: 'have I mentioned my boss before?', expectFire: true, note: 'may miss pure "mentioned before" without history RE' },
    { id: 'f05', phrasing: 'remember that thing with the fountain pen?', expectFire: true, note: 'remember when vs remember that' },
    { id: 'f06', phrasing: 'what did I say last Monday?', expectFire: true },
    { id: 'f07', phrasing: 'what did we talk about last month', expectFire: true },
    { id: 'f08', phrasing: 'remember when I wrote about my sister', expectFire: true },
    { id: 'f09', phrasing: 'show me past entries about anxiety', expectFire: true },
    { id: 'f10', phrasing: 'full conversation from last night', expectFire: true },
    { id: 'f11', phrasing: 'what was I talking about on 2025-08-17', expectFire: true },
    { id: 'f12', phrasing: 'did I journal about sleep this week?', expectFire: true, note: 'this week is in RE via this\\s+week' },
    { id: 'f13', phrasing: 'what did I share yesterday about family', expectFire: true },
    { id: 'f14', phrasing: 'last week I mentioned something important — what was it?', expectFire: true },
    { id: 'f15', phrasing: 'pull up my past session about deadlines', expectFire: true },
    { id: 'f16', phrasing: 'on 2026-01-03 what did I write', expectFire: true },
    { id: 'f17', phrasing: 'I am exhausted and my boss keeps piling on', expectFire: true, note: 'PROACTIVE_TOOL_RE' },
    { id: 'f18', phrasing: 'tonight I cannot sleep and work is a mess', expectFire: true },
    { id: 'f19', phrasing: 'feeling overwhelmed again about the same spiral', expectFire: true },
    { id: 'f20', phrasing: 'This morning I already feel anxious about the meeting', expectFire: true },
    // longer rant → length >= 80
    {
        id: 'f21',
        phrasing:
            'Okay so basically the whole day went sideways after the standup and I need to unpack how I keep ending up here with the same people.',
        expectFire: true,
        note: 'length >= 80',
    },
    // first real turn length >= 12 (with empty history we simulate 1 user turn)
    { id: 'f22', phrasing: 'Need to vent about today', expectFire: true, note: 'userTurns<=2 && len>=12' },

    // should-NOT-fire
    { id: 'n01', phrasing: 'hi', expectFire: false },
    { id: 'n02', phrasing: 'hello', expectFire: false },
    { id: 'n03', phrasing: 'how are you', expectFire: false },
    { id: 'n04', phrasing: 'thanks', expectFire: false },
    { id: 'n05', phrasing: 'ok', expectFire: false },
    { id: 'n06', phrasing: 'I am tired today', expectFire: true, note: 'PROACTIVE tired/today — actually FIRES' },
    { id: 'n07', phrasing: 'how do I make pasta', expectFire: false },
    { id: 'n08', phrasing: 'what is 2+2', expectFire: false },
    { id: 'n09', phrasing: '[Start daily check-in]', expectFire: false, note: 'bootstrap' },
    { id: 'n10', phrasing: '[Start intention check-in]', expectFire: false, note: 'bootstrap' },
    { id: 'n11', phrasing: 'Good morning', expectFire: false },
    { id: 'n12', phrasing: 'lol', expectFire: false },
    { id: 'n13', phrasing: 'sure', expectFire: false },
    { id: 'n14', phrasing: 'tell me a joke', expectFire: false },
    { id: 'n15', phrasing: 'define mindfulness', expectFire: false },
    { id: 'n16', phrasing: 'can you rephrase that', expectFire: false },
    { id: 'n17', phrasing: 'shorter please', expectFire: false },
    { id: 'n18', phrasing: 'yes', expectFire: false },

    // known brittleness variants (expectFire true desired; measure actual)
    { id: 'b01', phrasing: 'have I ever talked about my boss?', expectFire: true, note: 'desired true; may miss' },
    { id: 'b02', phrasing: 'did I ever mention Maya', expectFire: true, note: 'desired true; may miss' },
    { id: 'b03', phrasing: 'what is my preferred name from identity', expectFire: true, note: 'desired true; may miss' },
    { id: 'b04', phrasing: 'search my journals for fountain pens', expectFire: true, note: 'desired true; may miss without history RE' },
    { id: 'b05', phrasing: 'go back to what I wrote about pens months ago', expectFire: true, note: 'desired true; may miss' },
    { id: 'b06', phrasing: 'remind me what I said about the catalog code', expectFire: true, note: 'desired true; may miss' },
];

function baseMessages(userText: string): Message[] {
    return [{ role: 'user', content: userText }];
}

export function runE4(): {
    rows: {
        id: string;
        phrasing: string;
        expectFire: boolean;
        historyIntent: boolean;
        toolsAuto: boolean;
        matchExpect: boolean;
        note?: string;
    }[];
    summary: { total: number; matched: number; falsePos: number; falseNeg: number };
} {
    const rows = E4_CASES.map((c) => {
        const historyIntent = detectHistoryIntent(c.phrasing);
        const toolsAuto = shouldEnableHistoryTools('auto', c.phrasing, baseMessages(c.phrasing));
        // For n06 we annotate expectFire based on actual product behavior desired;
        // table reports actual. matchExpect compares toolsAuto to expectFire.
        return {
            id: c.id,
            phrasing: c.phrasing,
            expectFire: c.expectFire,
            historyIntent,
            toolsAuto,
            matchExpect: toolsAuto === c.expectFire,
            note: c.note,
        };
    });

    const falsePos = rows.filter((r) => !r.expectFire && r.toolsAuto).length;
    const falseNeg = rows.filter((r) => r.expectFire && !r.toolsAuto).length;
    const matched = rows.filter((r) => r.matchExpect).length;

    const summary = {
        total: rows.length,
        matched,
        falsePos,
        falseNeg,
    };

    writeJsonArtifact('e4-trigger-coverage.json', {
        experiment: 'E4_TRIGGER_COVERAGE',
        function: 'shouldEnableHistoryTools(auto) + detectHistoryIntent',
        rows,
        summary,
    });
    writeArtifact(
        'e4-coverage-table.txt',
        [
            'id | expect | historyIntent | toolsAuto | match | phrasing',
            ...rows.map((r) =>
                [
                    r.id,
                    r.expectFire ? 'FIRE' : 'NO',
                    r.historyIntent ? 'Y' : 'n',
                    r.toolsAuto ? 'Y' : 'n',
                    r.matchExpect ? 'ok' : 'MISS',
                    JSON.stringify(r.phrasing),
                ].join(' | ')),
            '',
            `summary: matched=${summary.matched}/${summary.total} FP=${summary.falsePos} FN=${summary.falseNeg}`,
        ].join('\n'),
    );

    return { rows, summary };
}
