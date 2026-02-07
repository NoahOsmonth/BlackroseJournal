import { createChatCompletion } from './modelClient';
import { retrieveLongTermMemoryContext, storeMessageInLongTermMemory } from './simpleMemService';
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

function buildAskRosebudPrompt(
  timeRange: AskRosebudRequest['timeRange'],
  memoryContext?: string
): string {
  const label = TIME_RANGE_LABELS[timeRange] || TIME_RANGE_LABELS['all-time'];
  const sections = [
    ASK_ROSEBUD_SYSTEM_PROMPT,
    `Time range: ${label}`,
  ];

  if (memoryContext && memoryContext.trim()) {
    sections.push('Relevant long-term memories:');
    sections.push(memoryContext.trim());
  }

  return sections.join('\n\n').trim();
}

export async function handleAskRosebud(
  request: AskRosebudRequest
): Promise<string> {
  const memoryContext = await retrieveLongTermMemoryContext(request.question);
  const systemPrompt = buildAskRosebudPrompt(request.timeRange, memoryContext);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: request.question },
  ];

  void storeMessageInLongTermMemory('user', request.question).catch(() => undefined);

  const { content } = await createChatCompletion(messages, {
    temperature: 0.7,
    maxTokens: 900,
  });

  if (content.trim()) {
    void storeMessageInLongTermMemory('assistant', content).catch(() => undefined);
  }

  return content;
}
