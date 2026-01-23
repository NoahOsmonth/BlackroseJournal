import { Application, Request, Response } from 'express';
import { McpRegistry } from '../mcp/registry';
import { handleAskRosebud } from '../agent/askRosebudService';
import { AskRosebudRequest } from '../agent/types';

function parseAskRosebud(body: unknown): AskRosebudRequest | null {
  if (!body || typeof body !== 'object') return null;
  const payload = body as Partial<AskRosebudRequest>;
  if (!payload.question || typeof payload.question !== 'string') return null;
  if (!payload.timeRange || typeof payload.timeRange !== 'string') return null;

  return {
    question: payload.question,
    timeRange: payload.timeRange as AskRosebudRequest['timeRange'],
    memoryNamespace: payload.memoryNamespace,
  };
}

export function registerAskRosebudRoutes(app: Application, registry: McpRegistry): void {
  app.post('/v1/ask-rosebud', async (req: Request, res: Response) => {
    const request = parseAskRosebud(req.body);
    if (!request) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid ask-rosebud payload.',
        },
      });
      return;
    }

    try {
      const answer = await handleAskRosebud(request, registry);
      res.json({
        data: {
          answer,
        },
      });
    } catch (error) {
      console.error('Ask Rosebud error:', error);
      res.status(500).json({
        error: {
          code: 'ASK_ROSEBUD_ERROR',
          message: 'Failed to generate Ask Rosebud response.',
        },
      });
    }
  });
}
