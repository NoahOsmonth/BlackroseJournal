import type { Application, Request, Response } from 'express';
import type { ReadinessProvider } from '../readiness';

export function registerHealthRoutes(
  app: Application,
  readiness: ReadinessProvider,
): void {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.get('/ready', (_req: Request, res: Response) => {
    const dependencies = readiness.getSnapshot();
    const ready = Object.values(dependencies).every(Boolean);
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      dependencies,
    });
  });
}
