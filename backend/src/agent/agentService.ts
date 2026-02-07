import { ChatCompletionOptions, createChatCompletion, createChatCompletionStream } from './modelClient';
import { retrieveLongTermMemoryContext, storeMessageInLongTermMemory } from './simpleMemService';
import { buildSystemPrompt } from './systemPrompt';
import { ChatCompletionRequest, ChatCompletionResult, ChatMessage } from './types';

const FALLBACK_PROMPT = 'You are a helpful assistant.';

interface ParsedSseChunk {
  done?: boolean;
  content?: string;
}

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

function parseSseLine(line: string): ParsedSseChunk | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) {
    return null;
  }

  const payload = trimmed.replace(/^data:\s?/, '');
  if (!payload) {
    return null;
  }

  if (payload === '[DONE]') {
    return { done: true };
  }

  try {
    const parsed = JSON.parse(payload);
    const delta = parsed.choices?.[0]?.delta;
    if (!delta || typeof delta !== 'object') {
      return null;
    }

    const content = typeof delta.content === 'string' ? delta.content : undefined;
    return content ? { content } : null;
  } catch {
    return null;
  }
}

async function readAssistantContentFromSseStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const parsed = parseSseLine(line);
      if (!parsed) {
        continue;
      }

      if (parsed.done) {
        return content;
      }

      if (parsed.content) {
        content += parsed.content;
      }
    }
  }

  return content;
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
      maxContext: request.max_context,
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
  const upstream = await createChatCompletionStream(payload.messages, payload.options);

  // Streaming responses need to be persisted without consuming the stream we return to the client.
  // clone() tees the body, letting us read assistant content in the background.
  if (upstream.body) {
    const clone = upstream.clone();
    void (async () => {
      try {
        if (!clone.body) {
          return;
        }

        const assistantContent = await readAssistantContentFromSseStream(clone.body);
        if (assistantContent.trim()) {
          await storeMessageInLongTermMemory('assistant', assistantContent);
        }
      } catch (error) {
        console.warn('SimpleMem stream store failed:', error);
      }
    })();
  }

  return upstream;
}
