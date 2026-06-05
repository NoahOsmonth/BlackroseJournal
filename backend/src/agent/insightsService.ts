import { createChatCompletion } from './modelClient';
import { ChatMessage } from './types';

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
Return ONLY the title text. No quotes, no markup.
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

export interface WeeklyInsightsEntry {
    messages: Array<{ content: string }>;
}

export interface EntryReflectionRequest {
    entryText: string;
}

export interface EntryReflectionSuggestion {
    type: 'HABIT';
    text: string;
}

export interface EntryReflectionResponse {
    reflection: string;
    keyInsight: string;
    suggestions: EntryReflectionSuggestion[];
}

export interface WeeklyInsightsResponse {
    emotionalLandscape: Array<{ emotion: string; score: number; emoji: string }>;
    keyThemes: string[];
    castOfCharacters: string[];
    weeklySummary: string;
}

export interface EntryTitleRequest {
    entryText: string;
}

export interface StreakHaikuRequest {
    entryText: string;
    streakCount: number;
}

export async function handleEntryReflection(
    request: EntryReflectionRequest
): Promise<EntryReflectionResponse> {
    const messages: ChatMessage[] = [
        { role: 'system', content: REFLECTION_SYSTEM_PROMPT },
        { role: 'user', content: `Entry:\n${request.entryText}` },
    ];
    const { content } = await createChatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 900,
    });
    const parsed = parseJsonShape<Partial<EntryReflectionResponse>>(content);
    if (!parsed) {
        return { reflection: content.trim(), keyInsight: '', suggestions: [] };
    }
    const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .filter((s) => s && s.type === 'HABIT' && typeof s.text === 'string')
            .map((s) => ({ type: 'HABIT' as const, text: s.text.trim() }))
        : [];
    return {
        reflection: typeof parsed.reflection === 'string' ? parsed.reflection.trim() : '',
        keyInsight: typeof parsed.keyInsight === 'string' ? parsed.keyInsight.trim() : '',
        suggestions,
    };
}

export async function handleWeeklyInsights(
    entries: WeeklyInsightsEntry[]
): Promise<WeeklyInsightsResponse> {
    const combinedText = entries
        .map((e) => e.messages.map((m) => m.content).join('\n'))
        .join('\n\n---\n\n');
    const messages: ChatMessage[] = [
        { role: 'system', content: WEEKLY_SYSTEM_PROMPT },
        { role: 'user', content: `Entries:\n${combinedText}` },
    ];
    const { content } = await createChatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 1000,
    });
    const parsed = parseJsonShape<Partial<WeeklyInsightsResponse>>(content);
    if (!parsed) {
        return { emotionalLandscape: [], keyThemes: [], castOfCharacters: [], weeklySummary: content.slice(0, 100) };
    }
    return {
        emotionalLandscape: Array.isArray(parsed.emotionalLandscape) ? parsed.emotionalLandscape : [],
        keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes : [],
        castOfCharacters: Array.isArray(parsed.castOfCharacters) ? parsed.castOfCharacters : [],
        weeklySummary:
            typeof parsed.weeklySummary === 'string'
                ? parsed.weeklySummary
                : content.slice(0, 100),
    };
}

export async function handleEntryTitle(request: EntryTitleRequest): Promise<{ title: string }> {
    const messages: ChatMessage[] = [
        { role: 'system', content: TITLE_SYSTEM_PROMPT },
        { role: 'user', content: `Entry:\n${request.entryText}` },
    ];
    const { content } = await createChatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 50,
    });
    return { title: content.trim().replace(/^["']|["']$/g, '') || 'Untitled Entry' };
}

export async function handleStreakHaiku(request: StreakHaikuRequest): Promise<{ lines: [string, string, string] }> {
    const messages: ChatMessage[] = [
        { role: 'system', content: HAIKU_SYSTEM_PROMPT },
        {
            role: 'user',
            content: `Streak: ${request.streakCount} day(s)\nEntry:\n${request.entryText}`,
        },
    ];
    const { content } = await createChatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 200,
    });
    const parsed = parseJsonShape<{ lines?: unknown }>(content);
    if (parsed && Array.isArray(parsed.lines)) {
        const clean = parsed.lines
            .filter((l): l is string => typeof l === 'string')
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 3);
        if (clean.length === 3) {
            return { lines: [clean[0], clean[1], clean[2]] };
        }
    }
    return {
        lines: [
            `Day ${request.streakCount}—still here`,
            'Words become gentle lanterns',
            'You are learning yourself',
        ],
    };
}
