import { NextFunction, Request, Response } from 'express';

export function createAuthMiddleware(expectedKey?: string) {
  if (!expectedKey) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '').trim();
    if (!token || token !== expectedKey) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid Authorization header.',
        },
      });
      return;
    }
    next();
  };
}
