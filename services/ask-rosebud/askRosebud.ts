import { fetchDirectChatCompletion } from '@/services/ai/directTransport';

export type TimeRange = 'all-entries' | 'all-time' | 'this-year' | 'this-month' | 'this-week';

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    'all-entries': 'All entries',
    'all-time': 'All-time',
    'this-year': 'This year',
    'this-month': 'This month',
    'this-week': 'This week',
};

export interface AskRosebudEntryContext {
    title?: string;
    createdAt: number;
    messages: { role?: string; content: string }[];
}

const ASK_ROSEBUD_SYSTEM_PROMPT = [
    'You are "Rosebud", a journaling assistant.',
    "Answer the user's question about their past journal entries concisely and warmly,",
    'using only the local journal context provided.',
    'If the question cannot be answered from the given context, say so honestly.',
].join(' ');
const MAX_CONTEXT_ENTRIES = 12;
const MAX_ENTRY_CHARS = 1200;

interface AskRosebudResponse {
    answer?: string;
}

function formatEntry(entry: AskRosebudEntryContext): string {
    const date = new Date(entry.createdAt).toISOString().slice(0, 10);
    const title = entry.title?.trim() || 'Untitled';
    const text = entry.messages
        .map((message) => message.content)
        .join('\n')
        .slice(0, MAX_ENTRY_CHARS);
    return `Date: ${date}\nTitle: ${title}\nEntry:\n${text}`;
}

function formatEntries(entries: AskRosebudEntryContext[]): string {
    if (entries.length === 0) {
        return 'No local completed entries are available for this time range.';
    }
    return entries
        .slice(0, MAX_CONTEXT_ENTRIES)
        .map(formatEntry)
        .join('\n\n---\n\n');
}

export async function askRosebud(
    question: string,
    timeRange: TimeRange,
    entries: AskRosebudEntryContext[] = []
): Promise<string> {
    const response = await fetchDirectChatCompletion({
        model: 'agent-default',
        messages: [
            { role: 'system', content: ASK_ROSEBUD_SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    `Time range: ${timeRange}`,
                    `Question: ${question}`,
                    'Local journal context:',
                    formatEntries(entries),
                ].join('\n'),
            },
        ],
        temperature: 0.7,
    }, { modelPurpose: 'flash' });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Ask Rosebud failed (${response.status}). ${text}`);
    }

    const json = await response.json().catch(() => null) as
        | { choices?: { message?: { content?: string } }[] }
        | null;
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();

    const legacy = json as AskRosebudResponse | null;
    const answer = legacy?.answer;
    return typeof answer === 'string' ? answer : '';
}
