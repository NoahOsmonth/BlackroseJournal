import { Application, Request, Response } from 'express';

export function registerHealthRoutes(app: Application): void {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    res.json({ status: 'ready' });
  });
}
