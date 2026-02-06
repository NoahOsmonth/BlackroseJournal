import { ChatCompletionOptions, createChatCompletion, createChatCompletionStream } from './modelClient';
import { retrieveLongTermMemoryContext, storeMessageInLongTermMemory } from './simpleMemService';
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

function getLatestUserMessage(messages: ChatMessage[]): ChatMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      return messages[i];
    }
  }
  return undefined;
}

async function buildChatPayload(request: ChatCompletionRequest): Promise<{ messages: ChatMessage[]; options: ChatCompletionOptions }> {
  const { basePrompt, conversation } = extractSystemPrompt(request.messages);
  const latestUserMessage = getLatestUserMessage(conversation);
  const memoryContext = latestUserMessage
    ? await retrieveLongTermMemoryContext(latestUserMessage.content)
    : '';
  const systemPrompt = buildSystemPrompt(basePrompt, memoryContext);
  const modelOverride = request.model && request.model !== 'agent-default'
    ? request.model
    : undefined;

  if (latestUserMessage?.content) {
    void storeMessageInLongTermMemory('user', latestUserMessage.content).catch(() => undefined);
  }

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversation,
    ],
    options: {
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      model: modelOverride,
    },
  };
}

export async function handleChatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResult> {
  const payload = await buildChatPayload(request);
  const completion = await createChatCompletion(payload.messages, payload.options);

  if (completion.content.trim()) {
    void storeMessageInLongTermMemory('assistant', completion.content).catch(() => undefined);
  }

  return completion;
}

export async function handleChatCompletionStream(
  request: ChatCompletionRequest
): Promise<Response> {
  const payload = await buildChatPayload(request);
  return createChatCompletionStream(payload.messages, payload.options);
}
