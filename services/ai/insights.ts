import { postAgent } from '@/services/agent/agentClient';
import {
    EntryReflectionResult,
    StreakHaiku,
    WeeklyInsightsEntry,
    WeeklyInsightsResult,
} from './insightsTypes';

const FALLBACK_REFLECTION = 'Thanks for sharing—your entry shows real self-awareness.';
const FALLBACK_KEY_INSIGHT = 'A small consistent step today can shift tomorrow.';
const FALLBACK_SUGGESTIONS: EntryReflectionResult['suggestions'] = [
    { type: 'HABIT', text: 'Take a 10-minute walk' },
    { type: 'HABIT', text: 'Write one sentence of gratitude' },
    { type: 'HABIT', text: 'Do 3 slow breaths before bed' },
];

const FALLBACK_HAIKU: StreakHaiku = [
    'Still here today',
    'Words become gentle lanterns',
    'You are learning yourself',
];

function extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        if (depth === 0) return text.slice(start, i + 1);
    }
    return null;
}

async function postInsights<TReq, TRes>(path: string, payload: TReq): Promise<TRes> {
    const response = await postAgent(path, payload);
    if (!response.ok) {
        const preview = await response.text().catch(() => '');
        throw new Error(`Insights request failed (status ${response.status}). ${preview.slice(0, 200)}`);
    }
    const json = (await response.json()) as { data?: TRes } & TRes;
    const data = (json && typeof json === 'object' && 'data' in json ? json.data : json) as TRes;
    return data;
}

export async function generateEntryReflection(input: { entryText: string }): Promise<EntryReflectionResult> {
    try {
        const data = await postInsights<{ entryText: string }, EntryReflectionResult>(
            '/v1/insights/reflect',
            { entryText: input.entryText }
        );
        const suggestions = Array.isArray(data.suggestions)
            ? data.suggestions
                .filter((s) => s && s.type === 'HABIT' && typeof s.text === 'string')
                .map((s) => ({ type: 'HABIT' as const, text: s.text.trim() }))
            : [];
        return {
            reflection: typeof data.reflection === 'string' ? data.reflection.trim() : '',
            keyInsight: typeof data.keyInsight === 'string' ? data.keyInsight.trim() : '',
            suggestions,
        };
    } catch {
        return {
            reflection: FALLBACK_REFLECTION,
            keyInsight: FALLBACK_KEY_INSIGHT,
            suggestions: FALLBACK_SUGGESTIONS,
        };
    }
}

export async function generateWeeklyInsights(entries: WeeklyInsightsEntry[]): Promise<WeeklyInsightsResult> {
    const combinedText = entries
        .map((e) => e.messages.map((m) => m.content).join('\n'))
        .join('\n\n---\n\n');
    if (!combinedText.trim()) {
        return {
            emotionalLandscape: [],
            keyThemes: [],
            castOfCharacters: [],
            weeklySummary: 'No entries to analyze.',
        };
    }
    try {
        const data = await postInsights<{ entries: WeeklyInsightsEntry[] }, WeeklyInsightsResult>(
            '/v1/insights/weekly',
            { entries }
        );
        return {
            emotionalLandscape: Array.isArray(data.emotionalLandscape) ? data.emotionalLandscape : [],
            keyThemes: Array.isArray(data.keyThemes) ? data.keyThemes : [],
            castOfCharacters: Array.isArray(data.castOfCharacters) ? data.castOfCharacters : [],
            weeklySummary:
                typeof data.weeklySummary === 'string'
                    ? data.weeklySummary
                    : 'Could not generate insights at this time.',
        };
    } catch {
        return {
            emotionalLandscape: [],
            keyThemes: [],
            castOfCharacters: [],
            weeklySummary: 'Could not generate insights at this time.',
        };
    }
}

export async function generateEntryTitle(input: { entryText: string }): Promise<string> {
    try {
        const data = await postInsights<{ entryText: string }, { title: string }>(
            '/v1/insights/title',
            { entryText: input.entryText }
        );
        const cleaned = typeof data.title === 'string' ? data.title.trim().replace(/^["']|["']$/g, '') : '';
        return cleaned || 'Untitled Entry';
    } catch {
        return 'Untitled Entry';
    }
}

export async function generateStreakHaiku(input: { entryText: string; streakCount: number }): Promise<StreakHaiku> {
    try {
        const data = await postInsights<{ entryText: string; streakCount: number }, { lines: StreakHaiku }>(
            '/v1/insights/haiku',
            input
        );
        const lines = Array.isArray(data.lines) ? data.lines : [];
        const clean = lines
            .filter((l): l is string => typeof l === 'string')
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 3);
        if (clean.length === 3) {
            return [clean[0], clean[1], clean[2]];
        }
        return FALLBACK_HAIKU;
    } catch {
        return FALLBACK_HAIKU;
    }
}
