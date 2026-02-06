import { createChatCompletion } from './modelClient';
import { AskRosebudRequest, ChatMessage } from './types';

const THERAPIST_SYSTEM_PROMPT = 'You are a compassionate journaling companion with a warm, supportive demeanor. Your role is to help users explore their thoughts and feelings through reflective conversation, similar to a gentle therapist or trusted friend.';

const ASK_ROSEBUD_SYSTEM_PROMPT = `${THERAPIST_SYSTEM_PROMPT}

## Ask Rosebud Guidance
You are Rosebud, an AI that provides reflective insights based on the user's question.
- Be clear and honest about uncertainty.
- Keep responses concise and supportive.`;

const TIME_RANGE_LABELS: Record<AskRosebudRequest['timeRange'], string> = {
  'all-time': 'All-time',
  'this-year': 'This year',
  'this-month': 'This month',
  'this-week': 'This week',
};

function buildAskRosebudPrompt(timeRange: AskRosebudRequest['timeRange']): string {
  const label = TIME_RANGE_LABELS[timeRange] || TIME_RANGE_LABELS['all-time'];
  return `${ASK_ROSEBUD_SYSTEM_PROMPT}

Time range: ${label}`.trim();
}

export async function handleAskRosebud(
  request: AskRosebudRequest
): Promise<string> {
  const systemPrompt = buildAskRosebudPrompt(request.timeRange);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: request.question },
  ];

  const { content } = await createChatCompletion(messages, {
    temperature: 0.7,
    maxTokens: 900,
  });

  return content;
}

