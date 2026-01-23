import { McpRegistry } from '../mcp/registry';
import { buildRecallArgs, buildSaveMemoryArgs, formatRecallContext, resolveMemoryTools } from './memoryTools';
import { planMemoryUsage } from './memoryPlanner';
import { createChatCompletion } from './modelClient';
import { buildSystemPrompt } from './systemPrompt';
import { ChatCompletionRequest, ChatCompletionResult, ChatMessage } from './types';

const FALLBACK_PROMPT = 'You are a helpful assistant.';

function extractSystemPrompt(messages: ChatMessage[]): { basePrompt: string; conversation: ChatMessage[] } {
  const systemIndex = messages.findIndex((message) => message.role === 'system');
  if (systemIndex === -1) {
    return { basePrompt: FALLBACK_PROMPT, conversation: messages };
  }

  const basePrompt = messages[systemIndex].content;
  const conversation = messages.filter((_, index) => index !== systemIndex);
  return { basePrompt, conversation };
}

function hasUserMessage(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.role === 'user');
}

export async function handleChatCompletion(
  request: ChatCompletionRequest,
  registry: McpRegistry
): Promise<ChatCompletionResult> {
  const { basePrompt, conversation } = extractSystemPrompt(request.messages);
  const memoryServerId = registry.getDefaultMemoryServerId();
  let memoryContext = '';
  let responseHint = '';

  if (registry.listServers().length > 0 && registry.isAllowed(memoryServerId) && hasUserMessage(conversation)) {
    try {
      const plan = await planMemoryUsage(conversation);
      responseHint = plan.responseHint || '';
      const tools = await resolveMemoryTools(registry, memoryServerId);

      if (plan.action === 'recall' || plan.action === 'save_and_recall') {
        if (tools.recallTool && plan.recall?.query) {
          const args = buildRecallArgs({
            tool: tools.recallTool,
            query: plan.recall.query,
            limit: plan.recall.limit,
            containerTag: request.memoryNamespace,
            includeProfile: true,
          });
          const recallResult = await registry.callTool(memoryServerId, tools.recallTool.name, args);
          memoryContext = formatRecallContext(recallResult);
        }
      }

      if (plan.action === 'save' || plan.action === 'save_and_recall') {
        if (tools.saveTool && plan.save?.text) {
          const metadata = {
            source: 'chat',
            conversationId: request.conversationId,
            timestamp: Date.now(),
            ...plan.save.metadata,
          };
          const args = buildSaveMemoryArgs({
            tool: tools.saveTool,
            content: plan.save.text,
            containerTag: request.memoryNamespace,
            metadata,
          });
          await registry.callTool(memoryServerId, tools.saveTool.name, args);
        }
      }
    } catch (error) {
      console.warn('Memory planning failed:', error);
    }
  }

  const systemPrompt = buildSystemPrompt(basePrompt, memoryContext);
  const finalPrompt = responseHint
    ? `${systemPrompt}\n\n## Response focus\n${responseHint}`
    : systemPrompt;

  const modelOverride = request.model && request.model !== 'agent-default'
    ? request.model
    : undefined;

  const completion = await createChatCompletion([
    { role: 'system', content: finalPrompt },
    ...conversation,
  ], {
    temperature: request.temperature,
    maxTokens: request.max_tokens,
    model: modelOverride,
  });

  return completion;
}
