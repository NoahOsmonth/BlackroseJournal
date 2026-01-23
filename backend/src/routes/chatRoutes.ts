import { Application, Request, Response } from 'express';
import { McpRegistry } from '../mcp/registry';
import { handleChatCompletion } from '../agent/agentService';
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
    memoryNamespace: payload.memoryNamespace,
    conversationId: payload.conversationId,
    metadata: payload.metadata,
  };
}

function chunkText(content: string, chunkSize = 30): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.slice(i, i + chunkSize));
  }
  return chunks.length ? chunks : [''];
}

function writeSse(res: Response, data: string): void {
  res.write(`data: ${data}\n\n`);
}

export function registerChatRoutes(app: Application, registry: McpRegistry): void {
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
      const completion = await handleChatCompletion(request, registry);

      if (request.stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        const chunks = chunkText(completion.content);
        chunks.forEach((chunk, index) => {
          const reasoning = index === 0 ? completion.reasoning || '' : '';
          writeSse(res, JSON.stringify({
            choices: [{
              delta: {
                content: chunk,
                reasoning,
              },
            }],
          }));
        });

        writeSse(res, '[DONE]');
        res.end();
        return;
      }

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
