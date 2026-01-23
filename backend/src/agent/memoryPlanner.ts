import { ChatMessage } from './types';
import { createChatCompletion, extractFirstJsonObject } from './modelClient';

export type MemoryAction = 'respond' | 'save' | 'recall' | 'save_and_recall';

export interface MemoryPlan {
  action: MemoryAction;
  save?: {
    text: string;
    metadata?: Record<string, unknown>;
  };
  recall?: {
    query: string;
    limit?: number;
  };
  responseHint?: string;
}

const MEMORY_PLANNER_PROMPT = `You are a memory decision agent for a journaling assistant.
Return ONLY valid JSON with the exact shape:
{
  "action": "respond" | "save" | "recall" | "save_and_recall",
  "save": { "text": string, "metadata"?: object } | null,
  "recall": { "query": string, "limit"?: number } | null,
  "responseHint": string | null
}

Rules:
- Save memory ONLY if the user explicitly asks to remember, or states a stable preference/identity (name, long-term goal, recurring routine).
- Do NOT save secrets, credentials, financial data, or highly sensitive details.
- Recall memory ONLY if the user asks about past details or you need context to answer.
- If no memory action is needed, action must be "respond".
- Keep queries concise.
- Output JSON only, no extra text.`;

function formatConversation(messages: ChatMessage[]): string {
  return messages.map((message) => `${message.role}: ${message.content}`).join('\n');
}

function isValidPlan(plan: MemoryPlan | null): plan is MemoryPlan {
  if (!plan) return false;
  if (!['respond', 'save', 'recall', 'save_and_recall'].includes(plan.action)) return false;
  return true;
}

export async function planMemoryUsage(messages: ChatMessage[]): Promise<MemoryPlan> {
  const conversation = formatConversation(messages);
  const plannerMessages: ChatMessage[] = [
    { role: 'system', content: MEMORY_PLANNER_PROMPT },
    { role: 'user', content: conversation },
  ];

  const { content } = await createChatCompletion(plannerMessages, {
    temperature: 0.1,
    maxTokens: 600,
  });

  const jsonText = extractFirstJsonObject(content) ?? content;
  try {
    const parsed = JSON.parse(jsonText) as MemoryPlan;
    return isValidPlan(parsed) ? parsed : { action: 'respond' };
  } catch {
    return { action: 'respond' };
  }
}
