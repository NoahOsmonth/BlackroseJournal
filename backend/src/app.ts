import cors from 'cors';
import express, { type RequestHandler } from 'express';
import type { DeploymentWriteRequest } from '../../shared/memory/deploymentAuthority';
import type { ServerConfig } from './config/serverConfig';
import type { MemoryRepository } from './memory/repositories/memoryRepository';
import type { SourceMirrorRepository } from './memory/repositories/sourceMirrorRepository';
import { registerMemoryRoutes } from './memory/routes/memoryRoutes';
import { registerSourceMirrorRoutes } from './memory/routes/sourceMirrorRoutes';
import { registerAskRosebudRoutes } from './routes/askRosebudRoutes';
import { createAuthMiddleware } from './routes/auth';
import { registerChatRoutes } from './routes/chatRoutes';
import { registerHealthRoutes } from './routes/healthRoutes';
import { registerInsightsRoutes } from './routes/insightsRoutes';

export interface AppDeps {
  serverConfig: ServerConfig;
  memoryAuthMiddleware: RequestHandler;
  memoryRepository: MemoryRepository;
  mirrorAuthMiddleware: RequestHandler;
  sourceMirrorRepository: SourceMirrorRepository | null;
  mirrorWriteAuthority: DeploymentWriteRequest | null;
  mirrorWritesEnabled: boolean;
}

export function createApp(deps: AppDeps): express.Application {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(cors({
    origin: deps.serverConfig.allowedOrigins ?? true,
    credentials: true,
  }));

  registerHealthRoutes(app, deps.serverConfig.readiness);
  registerMemoryRoutes(app, {
    authMiddleware: deps.memoryAuthMiddleware,
    repository: deps.memoryRepository,
  });
  registerSourceMirrorRoutes(app, {
    authMiddleware: deps.mirrorAuthMiddleware,
    repository: deps.sourceMirrorRepository,
    authority: deps.mirrorWriteAuthority,
    writesEnabled: deps.mirrorWritesEnabled,
  });

  const legacyAuth = createAuthMiddleware(deps.serverConfig.agentApiKey);
  app.use(
    ['/v1/chat', '/v1/ask-rosebud', '/v1/insights'],
    legacyAuth,
  );
  registerChatRoutes(app);
  registerAskRosebudRoutes(app);
  registerInsightsRoutes(app);

  return app;
}
