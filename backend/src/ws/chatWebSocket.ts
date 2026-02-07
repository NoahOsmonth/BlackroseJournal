import type { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { handleChatCompletion, handleChatCompletionStream } from '../agent/agentService';
import { ChatCompletionRequest, ChatMessage } from '../agent/types';

type WsEventData = string | ArrayBuffer | Buffer | Uint8Array;

interface WsDeltaMessage {
  type: 'delta';
  content?: string;
  reasoning?: string;
}

interface WsDoneMessage {
  type: 'done';
}

interface WsErrorMessage {
  type: 'error';
  message: string;
}

type WsServerMessage = WsDeltaMessage | WsDoneMessage | WsErrorMessage;

function isValidMessage(message: ChatMessage): boolean {
  return Boolean(message && message.role && typeof message.content === 'string');
}

function parseChatRequest(body: unknown): ChatCompletionRequest | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Partial<ChatCompletionRequest>;
  if (!Array.isArray(payload.messages)) return null;

  const messages = payload.messages.filter((message): message is ChatMessage =>
    message && typeof message === 'object' && isValidMessage(message as ChatMessage)
  );

  if (messages.length === 0) return null;

  return {
    messages,
    model: payload.model,
    stream: Boolean(payload.stream),
    temperature: payload.temperature,
    max_context: payload.max_context,
    max_tokens: payload.max_tokens,
    conversationId: payload.conversationId,
    metadata: payload.metadata,
  };
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function serializeMessage(message: WsServerMessage): string {
  return JSON.stringify(message);
}

function extractTokenFromRequest(req: IncomingMessage): string {
  const header = req.headers.authorization || '';
  const headerToken = header.replace('Bearer ', '').trim();
  if (headerToken) return headerToken;

  const rawUrl = req.url || '';
  const host = req.headers.host || 'localhost';

  try {
    const url = new URL(rawUrl, `http://${host}`);
    return url.searchParams.get('token')?.trim() || '';
  } catch {
    return '';
  }
}

interface ParsedSseChunk {
  done?: boolean;
  content?: string;
  reasoning?: string;
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

    return {
      content: typeof delta.content === 'string' ? delta.content : undefined,
      reasoning: typeof delta.reasoning === 'string'
        ? delta.reasoning
        : (typeof delta.reasoning_content === 'string' ? delta.reasoning_content : undefined),
    };
  } catch {
    return null;
  }
}

function splitStreamBuffer(buffer: string): { lines: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const remainder = lines.pop() || '';
  return { lines, remainder };
}

function decodeWsData(data: WsEventData): string {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8');
  if (Buffer.isBuffer(data)) return data.toString('utf-8');
  if (data instanceof Uint8Array) return Buffer.from(data).toString('utf-8');
  return '';
}

export function registerChatWebSocket(
  server: HttpServer,
  options: { expectedApiKey?: string } = {}
): void {
  const wss = new WebSocketServer({ server, path: '/v1/chat/ws' });
  const expectedApiKey = options.expectedApiKey;

  wss.on('connection', (socket, req) => {
    if (expectedApiKey) {
      const token = extractTokenFromRequest(req);
      if (!token || token !== expectedApiKey) {
        socket.close(1008, 'Unauthorized');
        return;
      }
    }

    socket.on('message', (raw: WsEventData) => {
      void (async () => {
        const parsed = safeJsonParse(decodeWsData(raw));
        const request = parseChatRequest(parsed);
        if (!request) {
          socket.send(serializeMessage({ type: 'error', message: 'Invalid chat payload.' }));
          socket.close(1003, 'Invalid payload');
          return;
        }

        try {
          if (!request.stream) {
            const completion = await handleChatCompletion(request);
            if (completion.reasoning) {
              socket.send(serializeMessage({
                type: 'delta',
                content: completion.content,
                reasoning: completion.reasoning,
              }));
            } else {
              socket.send(serializeMessage({ type: 'delta', content: completion.content }));
            }
            socket.send(serializeMessage({ type: 'done' }));
            socket.close(1000);
            return;
          }

          const upstream = await handleChatCompletionStream(request);
          if (!upstream.body) {
            const text = await upstream.text();
            socket.send(serializeMessage({ type: 'delta', content: text }));
            socket.send(serializeMessage({ type: 'done' }));
            socket.close(1000);
            return;
          }

          const reader = upstream.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            if (!value) {
              continue;
            }

            buffer += decoder.decode(value, { stream: true });
            const { lines, remainder } = splitStreamBuffer(buffer);
            buffer = remainder;

            for (const line of lines) {
              const chunk = parseSseLine(line);
              if (!chunk) {
                continue;
              }

              if (chunk.done) {
                socket.send(serializeMessage({ type: 'done' }));
                socket.close(1000);
                return;
              }

              if (chunk.content || chunk.reasoning) {
                socket.send(serializeMessage({
                  type: 'delta',
                  content: chunk.content,
                  reasoning: chunk.reasoning,
                }));
              }
            }
          }

          socket.send(serializeMessage({ type: 'done' }));
          socket.close(1000);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown streaming error';
          socket.send(serializeMessage({ type: 'error', message }));
          socket.close(1011, 'Internal error');
        }
      })();
    });
  });
}
