import cors from 'cors';
import express from 'express';
import type { ServerConfig } from './config/serverConfig';
import {
  createManagedAuthGuard,
  createManagedAdminGuard,
  createManagedOriginGuard,
  type ManagedAccessDependencies,
} from './control/managedAccess';
import { registerAskRosebudRoutes } from './routes/askRosebudRoutes';
import { createAuthMiddleware } from './routes/auth';
import { registerChatRoutes } from './routes/chatRoutes';
import { registerHealthRoutes } from './routes/healthRoutes';
import { registerInsightsRoutes } from './routes/insightsRoutes';
import { registerMemoryRoutes } from './routes/memoryRoutes';
import type { HindsightMemoryGateway } from './memory/hindsightMemoryGateway';
import {
  registerControlPlaneRoutes,
  type ControlPlaneRouteService,
} from './routes/controlPlaneRoutes';
import {
  registerManagedInferenceRoutes,
  type ManagedInferenceRouteService,
} from './routes/managedInferenceRoutes';

export interface AppDeps {
  serverConfig: ServerConfig;
  managedAccess?: ManagedAccessDependencies;
  memoryGateway?: HindsightMemoryGateway;
  controlPlaneService?: ControlPlaneRouteService;
  managedInferenceService?: ManagedInferenceRouteService;
}

export function createApp(deps: AppDeps): express.Application {
  const app = express();
  app.use(createManagedOriginGuard(deps.serverConfig.allowedOrigins));
  app.use(
    ['/v1/ai', '/v1/memory'],
    createManagedAuthGuard(deps.managedAccess),
  );
  app.use(
    '/v1/admin',
    createManagedAuthGuard(deps.managedAccess),
    createManagedAdminGuard(deps.managedAccess),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(cors({
    origin: deps.serverConfig.allowedOrigins ?? true,
    credentials: true,
  }));

  registerHealthRoutes(app, deps.serverConfig.readiness);

  const legacyAuth = createAuthMiddleware(deps.serverConfig.agentApiKey);
  app.use(
    ['/v1/chat', '/v1/ask-rosebud', '/v1/insights'],
    legacyAuth,
  );
  registerChatRoutes(app);
  registerAskRosebudRoutes(app);
  registerInsightsRoutes(app);
  registerMemoryRoutes(app, deps.memoryGateway);
  registerControlPlaneRoutes(app, deps.controlPlaneService);
  registerManagedInferenceRoutes(app, deps.managedInferenceService);

  return app;
}
