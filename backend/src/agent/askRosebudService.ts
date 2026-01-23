import { McpRegistry } from '../mcp/registry';
import { buildRecallArgs, formatRecallContext, resolveMemoryTools } from './memoryTools';
import { createChatCompletion } from './modelClient';
import { AskRosebudRequest, ChatMessage } from './types';

const THERAPIST_SYSTEM_PROMPT = `You are a compassionate journaling companion with a warm, supportive demeanor. Your role is to help users explore their thoughts and feelings through reflective conversation, similar to a gentle therapist or trusted friend.`;

const ASK_ROSEBUD_SYSTEM_PROMPT = `${THERAPIST_SYSTEM_PROMPT}

## Ask Rosebud Guidance
You are Rosebud, an AI that provides reflective insights based on the user's journal history.
- Ground answers in the provided memory context.
- Be clear about uncertainty when memories are missing.
- Keep responses concise and supportive.`;

const TIME_RANGE_LABELS: Record<AskRosebudRequest['timeRange'], string> = {
  'all-time': 'All-time',
  'this-year': 'This year',
  'this-month': 'This month',
  'this-week': 'This week',
};

function buildAskRosebudPrompt(memoryContext: string, timeRange: AskRosebudRequest['timeRange']): string {
  const label = TIME_RANGE_LABELS[timeRange] || TIME_RANGE_LABELS['all-time'];
  return `${ASK_ROSEBUD_SYSTEM_PROMPT}

Time range: ${label}

${memoryContext}`.trim();
}

export async function handleAskRosebud(
  request: AskRosebudRequest,
  registry: McpRegistry
): Promise<string> {
  const memoryServerId = registry.getDefaultMemoryServerId();
  let memoryContext = '';

  if (registry.listServers().length > 0) {
    try {
      const tools = await resolveMemoryTools(registry, memoryServerId);
      if (tools.recallTool) {
        const label = TIME_RANGE_LABELS[request.timeRange] || TIME_RANGE_LABELS['all-time'];
        const args = buildRecallArgs({
          tool: tools.recallTool,
          query: `${request.question} (time range: ${label})`,
          containerTag: request.memoryNamespace,
          includeProfile: true,
        });
        const recallResult = await registry.callTool(memoryServerId, tools.recallTool.name, args);
        memoryContext = formatRecallContext(recallResult);
      }
    } catch (error) {
      console.warn('Ask Rosebud memory recall failed:', error);
    }
  }

  const systemPrompt = buildAskRosebudPrompt(memoryContext, request.timeRange);
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
