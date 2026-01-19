import { useCallback, useRef } from 'react';
import { THERAPIST_SYSTEM_PROMPT } from '../constants/aiPrompts';
import { DailyPrompt } from '../constants/dailyPrompts';
import { getAiConfig } from './aiConfig';
import { buildChatMemoryContext, ingestConversation } from './supermemory';

const DEFAULT_API_BASE_URL = 'https://nano-gpt.com/api/v1';
const DEFAULT_MODEL = 'zai-org/glm-4.7-original:thinking';

function getEnv(key: string): string | undefined {
  // In Expo, only EXPO_PUBLIC_* is guaranteed to be available at runtime.
  // In Jest/Node, process.env is available.
  try {
    return (process.env as Record<string, string | undefined>)[key];
  } catch {
    return undefined;
  }
}

function getApiConfig() {
  const apiKey =
    getEnv('EXPO_PUBLIC_NANO_GPT_API_KEY') ??
    getEnv('NANO_GPT_API_KEY');
  const baseUrl =
    getEnv('EXPO_PUBLIC_NANO_GPT_API_BASE_URL') ??
    getEnv('NANO_GPT_API_BASE_URL') ??
    DEFAULT_API_BASE_URL;
  const model =
    getEnv('EXPO_PUBLIC_NANO_GPT_MODEL') ??
    getEnv('NANO_GPT_MODEL') ??
    DEFAULT_MODEL;

  return { apiKey, baseUrl, model };
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

type ChatRole = 'system' | 'user' | 'assistant';

interface ChatCompletionMessage {
  role: ChatRole;
  content: string;
}

interface EntryReflectionSuggestion {
  type: 'HABIT';
  text: string;
}

export interface EntryReflectionResult {
  reflection: string;
  keyInsight: string;
  suggestions: EntryReflectionSuggestion[];
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

async function completeChatOnce(
  messages: ChatCompletionMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const { apiKey, baseUrl, model } = getApiConfig();
  if (!apiKey) {
    throw new Error('Missing NanoGPT API key (EXPO_PUBLIC_NANO_GPT_API_KEY)');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const json = await response.json();
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    '';
  return typeof content === 'string' ? content : '';
}

export async function generateEntryReflection(input: {
  entryText: string;
}): Promise<EntryReflectionResult> {
  const system = `You are a journaling reflection assistant.
Return ONLY valid JSON with the exact shape:
{
  "reflection": string,
  "keyInsight": string,
  "suggestions": [{"type":"HABIT","text":string}]
}

Rules:
- Keep reflection warm and concise (2-5 sentences).
- Key insight should be 1 sentence.
- Provide 3-6 HABIT suggestions that are specific, small, and actionable.`;

  const raw = await completeChatOnce(
    [
      { role: 'system', content: system },
      { role: 'user', content: `Entry:\n${input.entryText}` },
    ],
    { temperature: 0.8, maxTokens: 900 }
  );

  const jsonText = extractFirstJsonObject(raw) ?? raw;
  try {
    const parsed = JSON.parse(jsonText) as EntryReflectionResult;
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
        .filter((s) => s && s.type === 'HABIT' && typeof s.text === 'string')
        .map((s) => ({ type: 'HABIT' as const, text: s.text.trim() }))
      : [];

    return {
      reflection: typeof parsed.reflection === 'string' ? parsed.reflection.trim() : '',
      keyInsight: typeof parsed.keyInsight === 'string' ? parsed.keyInsight.trim() : '',
      suggestions,
    };
  } catch {
    // Graceful fallback when the model doesn't comply perfectly.
    return {
      reflection: raw.trim() || 'Thanks for sharing—your entry shows real self-awareness.',
      keyInsight: 'A small consistent step today can shift tomorrow.',
      suggestions: [
        { type: 'HABIT', text: 'Take a 10-minute walk' },
        { type: 'HABIT', text: 'Write one sentence of gratitude' },
        { type: 'HABIT', text: 'Do 3 slow breaths before bed' },
      ],
    };
  }
}

export async function generateStreakHaiku(input: {
  entryText: string;
  streakCount: number;
}): Promise<[string, string, string]> {
  const system = `You write uplifting, grounded haiku.
Return ONLY valid JSON with the exact shape: {"lines":[string,string,string]}
Rules:
- 3 lines only
- Each line <= 40 characters
- Refer subtly to journaling and streak count
- Tone: warm, celebratory, not cheesy`;

  const raw = await completeChatOnce(
    [
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Streak: ${input.streakCount} day(s)\nEntry:\n${input.entryText}`,
      },
    ],
    { temperature: 0.9, maxTokens: 200 }
  );

  const jsonText = extractFirstJsonObject(raw) ?? raw;
  try {
    const parsed = JSON.parse(jsonText) as { lines?: unknown };
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    const clean = lines
      .filter((l) => typeof l === 'string')
      .map((l) => (l as string).trim())
      .filter(Boolean)
      .slice(0, 3);
    if (clean.length === 3) {
      return [clean[0], clean[1], clean[2]];
    }
  } catch {
    // ignore
  }

  return [
    `Day ${input.streakCount}—still here`,
    'Words become gentle lanterns',
    'You are learning yourself',
  ];
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
    const { apiKey, baseUrl, model } = getApiConfig();
    if (!apiKey) {
      throw new Error('Missing NanoGPT API key (EXPO_PUBLIC_NANO_GPT_API_KEY)');
    }
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          // System message with therapist prompt (or custom)
          { role: 'system', content: customSystemPrompt || THERAPIST_SYSTEM_PROMPT },
          // User and assistant messages
          ...messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        ],
        stream: true,
        temperature: 1.0,
        max_tokens: 16384,
      }),
    });

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

