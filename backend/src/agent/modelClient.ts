import { getAiConfig } from '../config/aiConfig';
import { ChatMessage } from './types';

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

interface ChatCompletionPayload {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature: number;
  max_tokens: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning?: string;
      reasoning_content?: string;
    };
  }>;
}

export async function createChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<{ content: string; reasoning: string }>
{
  const response = await requestChatCompletion(messages, options, false);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as ChatCompletionResponse;
  const message = json?.choices?.[0]?.message;

  return {
    content: message?.content ?? '',
    reasoning: message?.reasoning ?? message?.reasoning_content ?? '',
  };
}

export async function createChatCompletionStream(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<Response> {
  const response = await requestChatCompletion(messages, options, true);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`AI error ${response.status}: ${text}`);
  }

  return response;
}

async function requestChatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  stream: boolean
): Promise<Response> {
  const { apiBaseUrl, apiKey, model: defaultModel } = getAiConfig();
  const payload: ChatCompletionPayload = {
    model: options.model ?? defaultModel,
    messages,
    stream,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (stream) {
    headers.Accept = 'text/event-stream';
  }

  return fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

export function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}
