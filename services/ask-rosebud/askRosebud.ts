import { postAgent } from '@/services/agent/agentClient';
import { getOrCreateMemoryNamespace } from '@/services/memory/memoryNamespace';

export type TimeRange = 'all-time' | 'this-year' | 'this-month' | 'this-week';

interface AskRosebudResponse {
    data?: {
        answer?: string;
    };
    error?: {
        message?: string;
    };
}

export async function askRosebud(question: string, timeRange: TimeRange): Promise<string> {
    const memoryNamespace = await getOrCreateMemoryNamespace();
    const response = await postAgent('/v1/ask-rosebud', {
        question,
        timeRange,
        memoryNamespace,
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Ask Rosebud failed (${response.status}). ${text}`);
    }

    const json = await response.json().catch(() => null) as AskRosebudResponse | null;
    const answer = json?.data?.answer;
    return typeof answer === 'string' ? answer : '';
}
