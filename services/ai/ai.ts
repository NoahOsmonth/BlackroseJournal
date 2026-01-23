import { THERAPIST_SYSTEM_PROMPT } from '@/constants/aiPrompts';
import { DailyPrompt } from '@/constants/dailyPrompts';
import { postAgent } from '@/services/agent/agentClient';
import { getOrCreateMemoryNamespace } from '@/services/memory/memoryNamespace';
import { useCallback, useRef } from 'react';
import { getAiConfig } from './aiConfig';

const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_AGENT_MODEL = 'agent-default';

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
    memoryNamespace?: string;
    conversationId?: string;
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

interface StreamChatOptions {
    systemPrompt?: string;
    memoryNamespace?: string;
    conversationId?: string;
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
    messages: ChatRequestMessage[],
    options?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<string> {
    const { apiBaseUrl, apiKey, model: defaultModel } = getAiConfig();
    const model = options?.model ?? defaultModel;

    const response = await fetch(`${apiBaseUrl}/chat/completions`, {
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

export interface WeeklyInsightsResult {
    emotionalLandscape: Array<{
        emotion: string;
        score: number;
        emoji: string;
    }>;
    keyThemes: string[];
    castOfCharacters: string[];
    weeklySummary: string;
}

const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        // Retry on rate limiting, server errors, or network issues
        return message.includes('429') ||
            message.includes('rate') ||
            message.includes('exhausted') ||
            message.includes('500') ||
            message.includes('502') ||
            message.includes('503') ||
            message.includes('504') ||
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('fetch');
    }
    return false;
}

export async function generateWeeklyInsights(entries: { messages: { content: string }[] }[]): Promise<WeeklyInsightsResult> {
    const combinedText = entries
        .map((e) => e.messages.map((m) => m.content).join('\n'))
        .join('\n\n---\n\n');

    if (!combinedText.trim()) {
        return {
            emotionalLandscape: [],
            keyThemes: [],
            castOfCharacters: [],
            weeklySummary: 'No entries to analyze.',
        };
    }

    const system = `You are a psychological analyst for a journal.
Analyze the user's weekly entries and return valid JSON with this EXACT structure:
{
  "emotionalLandscape": [{"emotion": "string", "score": number(1-10), "emoji": "string"}],
  "keyThemes": ["string"],
  "castOfCharacters": ["string"],
  "weeklySummary": "string"
}
Rules:
- emotionalLandscape: Top 4-6 emotions. Score is intensity (1-10). Emoji should match the emotion.
- keyThemes: Top 3 recurring topics (e.g., "Career", "Health").
- castOfCharacters: List of people mentioned (names or roles).
- weeklySummary: A concise 2-sentence summary of the week's vibe.`;

    const { flashModel } = getAiConfig();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const raw = await completeChatOnce(
                [
                    { role: 'system', content: system },
                    { role: 'user', content: `Entries:\n${combinedText}` },
                ],
                { temperature: 0.5, maxTokens: 1000, model: flashModel }
            );

            const jsonText = extractFirstJsonObject(raw) ?? raw;
            const parsed = JSON.parse(jsonText);

            return {
                emotionalLandscape: Array.isArray(parsed.emotionalLandscape) ? parsed.emotionalLandscape : [],
                keyThemes: Array.isArray(parsed.keyThemes) ? parsed.keyThemes : [],
                castOfCharacters: Array.isArray(parsed.castOfCharacters) ? parsed.castOfCharacters : [],
                weeklySummary: typeof parsed.weeklySummary === 'string' ? parsed.weeklySummary : raw.slice(0, 100),
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const isJsonError = lastError.message.includes('JSON') || lastError.message.includes('Unexpected token');
            const shouldRetry = isJsonError || isRetryableError(error);

            if (shouldRetry && attempt < MAX_RETRIES) {
                console.warn(`Weekly insights attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`, lastError.message);
                await delay(RETRY_DELAY_MS);
            } else {
                console.error('Failed to generate insights after retries:', lastError);
                break;
            }
        }
    }

    return {
        emotionalLandscape: [],
        keyThemes: [],
        castOfCharacters: [],
        weeklySummary: 'Could not generate insights at this time.',
    };
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

    const { flashModel } = getAiConfig();
    const raw = await completeChatOnce(
        [
            { role: 'system', content: system },
            { role: 'user', content: `Entry:\n${input.entryText}` },
        ],
        { temperature: 0.8, maxTokens: 900, model: flashModel }
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

export async function generateEntryTitle(input: {
    entryText: string;
}): Promise<string> {
    const system = `You are a title generator.
Return ONLY the title text. No quotes, no markup.
Rules:
- Max 6 words
- Capture the essence/mood
- Simple and poetic`;

    const { flashModel } = getAiConfig();
    const raw = await completeChatOnce(
        [
            { role: 'system', content: system },
            { role: 'user', content: `Entry:\n${input.entryText}` },
        ],
        { temperature: 0.7, maxTokens: 50, model: flashModel }
    );

    return raw.trim().replace(/^["']|["']$/g, '') || 'Untitled Entry';
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

    const { flashModel } = getAiConfig();
    const raw = await completeChatOnce(
        [
            { role: 'system', content: system },
            {
                role: 'user',
                content: `Streak: ${input.streakCount} day(s)\nEntry:\n${input.entryText}`,
            },
        ],
        { temperature: 0.9, maxTokens: 200, model: flashModel }
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

function generateConversationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `chat_${timestamp}_${random}`;
}

function buildChatPayload(
    model: string,
    messages: Message[],
    systemPrompt: string,
    stream: boolean,
    memoryNamespace?: string,
    conversationId?: string
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
        memoryNamespace,
        conversationId,
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

async function fetchChatCompletion(payload: ChatRequestPayload): Promise<Response> {
    return postAgent('/v1/chat/completions', payload);
}

function resolveStreamOptions(options?: string | StreamChatOptions): StreamChatOptions {
    if (!options) {
        return {};
    }

    if (typeof options === 'string') {
        return { systemPrompt: options };
    }

    return options;
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

export async function streamChat(
    messages: Message[],
    onChunk: StreamingCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback,
    options?: string | StreamChatOptions
): Promise<void> {
    try {
        const resolved = resolveStreamOptions(options);
        const systemPrompt = resolved.systemPrompt || THERAPIST_SYSTEM_PROMPT;
        const model = DEFAULT_AGENT_MODEL;
        const streamPayload = buildChatPayload(
            model,
            messages,
            systemPrompt,
            true,
            resolved.memoryNamespace,
            resolved.conversationId
        );
        const response = await fetchChatCompletion(streamPayload);
        const streamingAvailable = hasReadableStream(response.body)
            && (response.headers.get('content-type') || '').includes('text/event-stream');

        if (!response.ok) {
            throw await buildResponseError(response, 'AI request failed', streamingAvailable);
        }

        if (streamingAvailable && response.body) {
            await readStreamResponse(response.body, onChunk, onComplete);
            return;
        }

        const fallbackResult = await readNonStreamingResponse(response);

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
    systemPrompt: string,
    options?: { memoryNamespace?: string; conversationId?: string }
): Promise<Accumulator> {
    const payload = buildChatPayload(
        DEFAULT_AGENT_MODEL,
        messages,
        systemPrompt,
        false,
        options?.memoryNamespace,
        options?.conversationId
    );
    const response = await fetchChatCompletion(payload);

    if (!response.ok) {
        throw await buildResponseError(response, 'AI request failed', false);
    }

    return readNonStreamingResponse(response);
}

export function useChat() {
    const messagesRef = useRef<Message[]>([]);
    const systemPromptRef = useRef<string | undefined>(undefined);
    const conversationIdRef = useRef<string>(generateConversationId());
    const memoryNamespaceRef = useRef<string | null>(null);

    const setMessages = useCallback((messages: Message[], systemPrompt?: string) => {
        messagesRef.current = messages;
        systemPromptRef.current = systemPrompt;
    }, []);

    const setConversationId = useCallback((conversationId?: string) => {
        conversationIdRef.current = conversationId || generateConversationId();
    }, []);

    const getMemoryNamespace = useCallback(async (): Promise<string | undefined> => {
        if (memoryNamespaceRef.current) {
            return memoryNamespaceRef.current;
        }

        try {
            const namespace = await getOrCreateMemoryNamespace();
            memoryNamespaceRef.current = namespace;
            return namespace;
        } catch (error) {
            console.warn('Failed to read memory namespace:', error);
            return undefined;
        }
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
            const memoryNamespace = await getMemoryNamespace();

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
                    onComplete(fullContent, fullReasoning);
                },
                onError,
                {
                    systemPrompt: basePrompt,
                    memoryNamespace,
                    conversationId: conversationIdRef.current,
                }
            );
        },
        [getMemoryNamespace]
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
            const memoryNamespace = await getMemoryNamespace();

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
                    onComplete(fullContent, fullReasoning);
                },
                onError,
                {
                    systemPrompt: basePrompt,
                    memoryNamespace,
                    conversationId: conversationIdRef.current,
                }
            );
        },
        [getMemoryNamespace]
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
