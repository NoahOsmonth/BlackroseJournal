import { useCallback, useRef } from 'react';
import { THERAPIST_SYSTEM_PROMPT } from '../constants/aiPrompts';
import { DailyPrompt } from '../constants/dailyPrompts';
import { getAiConfig } from './aiConfig';
import { buildChatMemoryContext, ingestConversation } from './supermemory';

const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_MAX_TOKENS = 16384;

type ChatRole = 'system' | 'user' | 'assistant';

interface ChatRequestMessage {
  role: ChatRole;
  content: string;
}

interface ChatRequestPayload {
  model: string;
  messages: ChatRequestMessage[];
  stream: boolean;
  temperature: number;
  max_tokens: number;
}

interface StreamingReader {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
}

export interface StreamingCallback {
  (chunk: string, reasoning?: string): void;
}

export interface CompleteCallback {
  (fullContent: string, fullReasoning: string): void;
}

export interface ErrorCallback {
  (error: Error): void;
}

interface ParsedChunk {
  content?: string;
  reasoning?: string;
  done?: boolean;
}

interface Accumulator {
  content: string;
  reasoning: string;
}

function generateConversationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `chat_${timestamp}_${random}`;
}

function buildChatPayload(
  model: string,
  messages: Message[],
  systemPrompt: string,
  stream: boolean
): ChatRequestPayload {
  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    ],
    stream,
    temperature: DEFAULT_TEMPERATURE,
    max_tokens: DEFAULT_MAX_TOKENS,
  };
}

function hasReadableStream(body: unknown): body is { getReader: () => StreamingReader } {
  return Boolean(body && typeof (body as { getReader?: unknown }).getReader === 'function');
}

function parseSseLine(line: string): ParsedChunk | null {
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

    return {
      content: delta?.content,
      reasoning: delta?.reasoning || delta?.reasoning_content,
    };
  } catch {
    return null;
  }
}

function appendChunk(
  accumulator: Accumulator,
  chunk: ParsedChunk,
  onChunk: StreamingCallback
): void {
  const { content, reasoning } = chunk;

  if (content) {
    accumulator.content += content;
  }

  if (reasoning) {
    accumulator.reasoning += reasoning;
  }

  if (content || reasoning) {
    onChunk(content || '', reasoning);
  }
}

function decodeStreamChunk(
  decoder: TextDecoder,
  value: Uint8Array | undefined,
  buffer: string
): string {
  if (!value) {
    return buffer;
  }

  return buffer + decoder.decode(value, { stream: true });
}

function splitStreamBuffer(buffer: string): { lines: string[]; remainder: string } {
  const lines = buffer.split('\n');
  const remainder = lines.pop() || '';

  return { lines, remainder };
}

function processStreamLines(
  lines: string[],
  accumulator: Accumulator,
  onChunk: StreamingCallback,
  onComplete: CompleteCallback
): boolean {
  for (const line of lines) {
    const parsed = parseSseLine(line);

    if (!parsed) {
      continue;
    }

    if (parsed.done) {
      onComplete(accumulator.content, accumulator.reasoning);
      return true;
    }

    appendChunk(accumulator, parsed, onChunk);
  }

  return false;
}

async function readStreamResponse(
  body: { getReader: () => StreamingReader },
  onChunk: StreamingCallback,
  onComplete: CompleteCallback
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const accumulator: Accumulator = { content: '', reasoning: '' };
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer = decodeStreamChunk(decoder, value, buffer);

    const { lines, remainder } = splitStreamBuffer(buffer);
    buffer = remainder;

    if (processStreamLines(lines, accumulator, onChunk, onComplete)) {
      return;
    }
  }

  onComplete(accumulator.content, accumulator.reasoning);
}

function parseJsonSafely(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function extractMessageContent(data: unknown): Accumulator {
  const message = (data as { choices?: Array<{ message?: { content?: string; reasoning?: string; reasoning_content?: string } }> })
    ?.choices?.[0]?.message;

  return {
    content: message?.content || '',
    reasoning: message?.reasoning || message?.reasoning_content || '',
  };
}

async function readNonStreamingResponse(response: Response): Promise<Accumulator> {
  const rawText = await response.text();
  const parsed = parseJsonSafely(rawText);

  if (!parsed) {
    const preview = rawText.slice(0, 200);
    throw new Error(`AI response was not valid JSON. Preview: ${preview}`);
  }

  return extractMessageContent(parsed);
}

async function buildResponseError(
  response: Response,
  context: string,
  streamingAvailable: boolean
): Promise<Error> {
  const responseText = await response.text().catch(() => '');
  const preview = responseText.slice(0, 200);
  const status = response.status;
  const details = preview ? ` Preview: ${preview}` : '';

  return new Error(`${context} (status ${status}, streaming=${streamingAvailable}).${details}`);
}

async function fetchChatCompletion(
  payload: ChatRequestPayload,
  apiBaseUrl: string,
  apiKey: string
): Promise<Response> {
  return fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Build a system prompt that includes the daily check-in context
 */
function buildDailyCheckInSystemPrompt(prompt: DailyPrompt): string {
  return `${THERAPIST_SYSTEM_PROMPT}

## Current Check-In Context
The user is doing a "${prompt.title}" daily check-in. The prompt they're responding to is:
"${prompt.promptText}"

Begin the conversation with an appropriate greeting for this time of day and gently invite them to share what's on their mind. Use the follow-up style: "${prompt.aiFollowUp}"`;
}

function mergeSystemPrompt(basePrompt: string, memoryContext?: string): string {
  if (!memoryContext || !memoryContext.trim()) {
    return basePrompt;
  }

  return `${basePrompt}

${memoryContext}`;
}

async function buildMemoryAwarePrompt(basePrompt: string, query: string): Promise<string> {
  try {
    const memoryContext = await buildChatMemoryContext(query);
    return mergeSystemPrompt(basePrompt, memoryContext);
  } catch (error) {
    console.warn('Supermemory context unavailable:', error);
    return basePrompt;
  }
}

function queueConversationIngestion(conversationId: string, messages: Message[]): void {
  ingestConversation(conversationId, messages).catch((error) => {
    console.warn('Failed to ingest conversation to Supermemory:', error);
  });
}

export async function streamChat(
  messages: Message[],
  onChunk: StreamingCallback,
  onComplete: CompleteCallback,
  onError: ErrorCallback,
  customSystemPrompt?: string
): Promise<void> {
  try {
    const { apiBaseUrl, apiKey, model } = getAiConfig();
    const systemPrompt = customSystemPrompt || THERAPIST_SYSTEM_PROMPT;
    const streamPayload = buildChatPayload(model, messages, systemPrompt, true);
    const response = await fetchChatCompletion(streamPayload, apiBaseUrl, apiKey);
    const streamingAvailable = hasReadableStream(response.body);

    if (!response.ok) {
      throw await buildResponseError(response, 'AI request failed', streamingAvailable);
    }

    if (streamingAvailable && response.body) {
      await readStreamResponse(response.body, onChunk, onComplete);
      return;
    }

    const fallbackPayload = buildChatPayload(model, messages, systemPrompt, false);
    const fallbackResponse = await fetchChatCompletion(fallbackPayload, apiBaseUrl, apiKey);

    if (!fallbackResponse.ok) {
      throw await buildResponseError(fallbackResponse, 'AI fallback request failed', false);
    }

    const fallbackResult = await readNonStreamingResponse(fallbackResponse);

    if (fallbackResult.content || fallbackResult.reasoning) {
      onChunk(fallbackResult.content, fallbackResult.reasoning);
    }

    onComplete(fallbackResult.content, fallbackResult.reasoning);
  } catch (error) {
    if (error instanceof Error) {
      onError(error);
    } else {
      onError(new Error('Unknown error occurred'));
    }
  }
}

export async function completeChat(
  messages: Message[],
  systemPrompt: string
): Promise<Accumulator> {
  const { apiBaseUrl, apiKey, model } = getAiConfig();
  const payload = buildChatPayload(model, messages, systemPrompt, false);
  const response = await fetchChatCompletion(payload, apiBaseUrl, apiKey);

  if (!response.ok) {
    throw await buildResponseError(response, 'AI request failed', false);
  }

  return readNonStreamingResponse(response);
}

export function useChat() {
  const messagesRef = useRef<Message[]>([]);
  const systemPromptRef = useRef<string | undefined>(undefined);
  const conversationIdRef = useRef<string>(generateConversationId());

  const setMessages = useCallback((messages: Message[], systemPrompt?: string) => {
    messagesRef.current = messages;
    systemPromptRef.current = systemPrompt;
  }, []);

  const setConversationId = useCallback((conversationId?: string) => {
    conversationIdRef.current = conversationId || generateConversationId();
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      onChunk: StreamingCallback,
      onComplete: CompleteCallback,
      onError: ErrorCallback
    ) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      messagesRef.current = [...messagesRef.current, userMessage];

      const basePrompt = systemPromptRef.current || THERAPIST_SYSTEM_PROMPT;
      const systemPrompt = await buildMemoryAwarePrompt(basePrompt, content);

      await streamChat(
        messagesRef.current,
        onChunk,
        (fullContent, fullReasoning) => {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: fullContent,
            reasoning: fullReasoning,
            timestamp: Date.now(),
          };
          messagesRef.current = [...messagesRef.current, aiMessage];
          queueConversationIngestion(conversationIdRef.current, messagesRef.current);
          onComplete(fullContent, fullReasoning);
        },
        onError,
        systemPrompt
      );
    },
    []
  );

  /**
   * Send an initial AI prompt for daily check-in mode
   * This triggers an AI-initiated greeting/question without user input
   */
  const sendInitialPrompt = useCallback(
    async (
      prompt: DailyPrompt,
      onChunk: StreamingCallback,
      onComplete: CompleteCallback,
      onError: ErrorCallback
    ) => {
      const basePrompt = buildDailyCheckInSystemPrompt(prompt);
      systemPromptRef.current = basePrompt;
      const systemPrompt = await buildMemoryAwarePrompt(basePrompt, prompt.promptText);

      // Send an empty trigger to get the AI to respond with its greeting
      // We use a minimal user message that the AI will interpret as a conversation starter
      const triggerMessage: Message = {
        id: 'trigger-' + Date.now(),
        role: 'user',
        content: '[Start daily check-in]',
        timestamp: Date.now(),
      };

      messagesRef.current = [triggerMessage];

      await streamChat(
        messagesRef.current,
        onChunk,
        (fullContent, fullReasoning) => {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: fullContent,
            reasoning: fullReasoning,
            timestamp: Date.now(),
          };
          // Replace the trigger with just the AI response for display
          messagesRef.current = [aiMessage];
          queueConversationIngestion(conversationIdRef.current, messagesRef.current);
          onComplete(fullContent, fullReasoning);
        },
        onError,
        systemPrompt
      );
    },
    []
  );

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    systemPromptRef.current = undefined;
  }, []);

  return {
    sendMessage,
    sendInitialPrompt,
    setMessages,
    setConversationId,
    clearMessages,
  };
}

