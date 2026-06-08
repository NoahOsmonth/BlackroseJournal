import { fetchDirectChatCompletion } from '@/services/ai/directTransport';
import {
    EntryAnalysisResult,
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

const FALLBACK_ANALYSIS: EntryAnalysisResult = {
    insight: 'You are noticing what matters and giving it language.',
    quote: 'Small honest moments can become a map.',
    mood: 'Reflective',
    topics: ['Self-awareness'],
};

const FALLBACK_HAIKU: StreakHaiku = [
    'Still here today',
    'Words become gentle lanterns',
    'You are learning yourself',
];

const REFLECTION_SYSTEM_PROMPT = `You are a journaling reflection assistant.
Return ONLY valid JSON with the exact shape:
{
  "reflection": string,
  "keyInsight": string,
  "suggestions": [{"type":"HABIT","text":string}]
}

Rules:
- Keep reflection warm and concise (2-5 sentences).
- Key insight should be 1 sentence.
- Provide 3-6 HABIT suggestions that are specific, small, and actionable.`;

const ENTRY_ANALYSIS_SYSTEM_PROMPT = `You are a concise journal analyst.
Return ONLY valid JSON with the exact shape:
{
  "insight": string,
  "quote": string,
  "mood": string,
  "topics": string[]
}

Rules:
- insight: 1 grounded sentence about the entry's meaning.
- quote: 1 short original line inspired by the entry, no quotation marks.
- mood: 1-3 words.
- topics: 2-5 short topic labels.`;

const WEEKLY_SYSTEM_PROMPT = `You are a psychological analyst for a journal.
Analyze the user's weekly entries and return valid JSON with this EXACT structure:
{
  "emotionalLandscape": [{"emotion": "string", "score": number(1-10), "emoji": "string"}],
  "keyThemes": ["string"],
  "castOfCharacters": ["string"],
  "weeklySummary": "string"
}
Rules:
- emotionalLandscape: Top 4-6 emotions. Score is intensity (1-10). Emoji should match the emotion.
- keyThemes: Top 3 recurring topics (e.g., "Career", "Health").
- castOfCharacters: List of people mentioned (names or roles).
- weeklySummary: A concise 2-sentence summary of the week's vibe.`;

const TITLE_SYSTEM_PROMPT = `You are a title generator.
Return ONLY valid JSON with the exact shape: {"title": string}
Rules:
- Max 6 words
- Capture the essence/mood
- Simple and poetic`;

const HAIKU_SYSTEM_PROMPT = `You write uplifting, grounded haiku.
Return ONLY valid JSON with the exact shape: {"lines":[string,string,string]}
Rules:
- 3 lines only
- Each line <= 40 characters
- Refer subtly to journaling and streak count
- Tone: warm, celebratory, not cheesy`;

interface InsightsChatPayload {
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    temperature: number;
    response_format: { type: 'json_object' };
}

interface OpenAIChatResponse {
    choices?: { message?: { content?: string } }[];
}

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

function parseJsonShape<T>(raw: string): T | null {
    const jsonText = extractFirstJsonObject(raw) ?? raw;
    try {
        return JSON.parse(jsonText) as T;
    } catch {
        return null;
    }
}

function normalizeTopics(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 5)
        : [];
}

async function postInsights<TRes>(payload: InsightsChatPayload): Promise<TRes> {
    const response = await fetchDirectChatCompletion({
        model: 'agent-default',
        messages: payload.messages,
        temperature: payload.temperature,
        response_format: payload.response_format,
    }, { modelPurpose: 'flash' });
    if (!response.ok) {
        const preview = await response.text().catch(() => '');
        throw new Error(`Insights request failed (status ${response.status}). ${preview.slice(0, 200)}`);
    }
    const json = (await response.json()) as OpenAIChatResponse;
    const content = json.choices?.[0]?.message?.content ?? '';
    const parsed = parseJsonShape<TRes>(content);
    if (parsed === null) {
        throw new Error('Insights response was not valid JSON.');
    }
    return parsed;
}

export async function generateEntryReflection(input: { entryText: string }): Promise<EntryReflectionResult> {
    try {
        const data = await postInsights<EntryReflectionResult>({
            messages: [
                { role: 'system', content: REFLECTION_SYSTEM_PROMPT },
                { role: 'user', content: `Entry:\n${input.entryText}` },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
        });
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

export async function generateEntryAnalysis(input: { entryText: string }): Promise<EntryAnalysisResult> {
    try {
        const data = await postInsights<EntryAnalysisResult>({
            messages: [
                { role: 'system', content: ENTRY_ANALYSIS_SYSTEM_PROMPT },
                { role: 'user', content: `Entry:\n${input.entryText}` },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
        });
        const topics = normalizeTopics(data.topics);
        const insight = typeof data.insight === 'string' ? data.insight.trim() : '';
        const quote = typeof data.quote === 'string' ? data.quote.trim() : '';
        const mood = typeof data.mood === 'string' ? data.mood.trim() : '';
        return {
            insight: insight || FALLBACK_ANALYSIS.insight,
            quote: quote || FALLBACK_ANALYSIS.quote,
            mood: mood || FALLBACK_ANALYSIS.mood,
            topics: topics.length > 0 ? topics : FALLBACK_ANALYSIS.topics,
        };
    } catch {
        return FALLBACK_ANALYSIS;
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
        const data = await postInsights<WeeklyInsightsResult>({
            messages: [
                { role: 'system', content: WEEKLY_SYSTEM_PROMPT },
                { role: 'user', content: `Entries:\n${combinedText}` },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
        });
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
        const data = await postInsights<{ title: string }>({
            messages: [
                { role: 'system', content: TITLE_SYSTEM_PROMPT },
                { role: 'user', content: `Entry:\n${input.entryText}` },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
        });
        const cleaned = typeof data.title === 'string' ? data.title.trim().replace(/^["']|["']$/g, '') : '';
        return cleaned || 'Untitled Entry';
    } catch {
        return 'Untitled Entry';
    }
}

export async function generateStreakHaiku(input: { entryText: string; streakCount: number }): Promise<StreakHaiku> {
    try {
        const data = await postInsights<{ lines: StreakHaiku }>({
            messages: [
                { role: 'system', content: HAIKU_SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Streak: ${input.streakCount} day(s)\nEntry:\n${input.entryText}`,
                },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
        });
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
