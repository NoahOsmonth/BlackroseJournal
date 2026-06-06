import { Application, Request, Response } from 'express';
import { handleChatCompletion, handleChatCompletionStream } from '../agent/agentService';
import { ChatCompletionRequest, ChatMessage } from '../agent/types';

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
    max_tokens: payload.max_tokens,
    conversationId: payload.conversationId,
    metadata: payload.metadata,
  };
}

function writeSse(res: Response, data: string): void {
  res.write(`data: ${data}\n\n`);
}

function flushResponse(res: Response): void {
  // Some reverse proxies (and some Express stacks with compression) buffer small chunks.
  // `res.flush()` exists when compression middleware is enabled; optional chain keeps this safe.
  (res as unknown as { flush?: () => void }).flush?.();
}

async function pipeReadableStreamToResponse(
  body: ReadableStream<Uint8Array>,
  res: Response
): Promise<void> {
  const reader = body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      res.write(Buffer.from(value));
      flushResponse(res);
    }
  }
}

export function registerChatRoutes(app: Application): void {
  app.post('/v1/chat/completions', async (req: Request, res: Response) => {
    const request = parseChatRequest(req.body);
    if (!request) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid chat payload.',
        },
      });
      return;
    }

    try {
      if (request.stream) {
        const upstream = await handleChatCompletionStream(request);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Hint to common proxies not to buffer SSE.
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();

        // Send an initial SSE comment to encourage early flush on some stacks.
        res.write(':\n\n');
        flushResponse(res);

        if (upstream.body) {
          await pipeReadableStreamToResponse(upstream.body, res);
          res.end();
          return;
        }

        const fallback = await upstream.text();
        if (fallback.trim()) {
          const lines = fallback.split('\n');
          lines.forEach((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              res.write(`${trimmed}\n\n`);
            }
          });
        }

        writeSse(res, '[DONE]');
        res.end();
        return;
      }

      const completion = await handleChatCompletion(request);

      res.json({
        id: `chatcmpl_${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: completion.content,
              reasoning: completion.reasoning || '',
            },
            finish_reason: 'stop',
          },
        ],
      });
    } catch (error) {
      console.error('Chat completion error:', error);
      res.status(500).json({
        error: {
          code: 'CHAT_ERROR',
          message: 'Failed to generate chat response.',
        },
      });
    }
  });
}
