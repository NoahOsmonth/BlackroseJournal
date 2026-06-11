import { ChatCompletionOptions, createChatCompletion, createChatCompletionStream } from './modelClient';
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

async function buildChatPayload(request: ChatCompletionRequest): Promise<{ messages: ChatMessage[]; options: ChatCompletionOptions }> {
  const { basePrompt, conversation } = extractSystemPrompt(request.messages);
  const systemPrompt = buildSystemPrompt(basePrompt);
  // Note: client-supplied model is intentionally ignored in v1 (server-side
  // profile resolution). We still pass it through the options bag for
  // logging, but modelClient.ts discards it.
  const modelOverride = request.model && request.model !== 'agent-default'
    ? request.model
    : undefined;

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversation,
    ],
    options: {
      temperature: request.temperature,
      topP: request.top_p,
      maxTokens: request.max_tokens,
      model: modelOverride,
    },
  };
}

export async function handleChatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResult> {
  const payload = await buildChatPayload(request);
  return createChatCompletion(payload.messages, payload.options);
}

export async function handleChatCompletionStream(
  request: ChatCompletionRequest
): Promise<Response> {
  const payload = await buildChatPayload(request);
  return createChatCompletionStream(payload.messages, payload.options);
}
