import { THERAPIST_SYSTEM_PROMPT } from '../constants/aiPrompts';
import { Message, completeChat } from './ai';
import { buildAskRosebudContext, TimeRange } from './supermemory';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    'all-time': 'All-time',
    'this-year': 'This year',
    'this-month': 'This month',
    'this-week': 'This week',
};

const ASK_ROSEBUD_SYSTEM_PROMPT = `${THERAPIST_SYSTEM_PROMPT}

## Ask Rosebud Guidance
You are Rosebud, an AI that provides reflective insights based on the user's journal history.
- Ground answers in the provided memory context.
- Be clear about uncertainty when memories are missing.
- Keep responses concise and supportive.`;

function buildAskRosebudPrompt(memoryContext: string, timeRange: TimeRange): string {
    const label = TIME_RANGE_LABELS[timeRange] || TIME_RANGE_LABELS['all-time'];

    return `${ASK_ROSEBUD_SYSTEM_PROMPT}

Time range: ${label}

${memoryContext}`.trim();
}

function buildUserMessage(content: string): Message {
    return {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
    };
}

export async function askRosebud(question: string, timeRange: TimeRange): Promise<string> {
    const memoryContext = await buildAskRosebudContext({ question, timeRange });
    const systemPrompt = buildAskRosebudPrompt(memoryContext, timeRange);
    const response = await completeChat([buildUserMessage(question)], systemPrompt);

    return response.content;
}
