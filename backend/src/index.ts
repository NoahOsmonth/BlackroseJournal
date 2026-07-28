import 'dotenv/config';
import http from 'http';
import type { RequestHandler } from 'express';
import { createApp } from './app';
import { createMemoryAuthMiddleware } from './auth/supabaseAuth';
import { loadConfig } from './config/ai';
import { getServerConfig } from './config/serverConfig';
import { readMemoryConfig } from './memory/config';
import { createPostgrestGateway } from './memory/gateway/postgrestGateway';
import {
  createMemoryRepository,
  type MemoryRepository,
} from './memory/repositories/memoryRepository';
import { createReadinessController } from './readiness';
import { registerChatWebSocket } from './ws/chatWebSocket';

const memoryConfig = readMemoryConfig(process.env);

let memoryAuthMiddleware: RequestHandler;
let memoryRepository: MemoryRepository;
if (memoryConfig.ready) {
  const gateway = createPostgrestGateway({
    postgrestBaseUrl: memoryConfig.config.postgrestBaseUrl,
    postgrestServerKey: memoryConfig.config.postgrestServerKey,
    postgrestKeyKind: memoryConfig.config.postgrestKeyKind,
  });
  memoryAuthMiddleware = createMemoryAuthMiddleware({
    config: memoryConfig.config.auth,
  });
  memoryRepository = createMemoryRepository(gateway);
} else {
  memoryAuthMiddleware = (_req, res) => {
    res.status(503).json({
      error: {
        code: 'MEMORY_CONFIG_NOT_READY',
        message: 'Memory service unavailable.',
      },
    });
  };
  const unavailable = async (): Promise<never> => {
    throw new Error('MEMORY_CONFIG_NOT_READY');
  };
  memoryRepository = {
    getBootstrap: unavailable,
    getOwnerState: unavailable,
    getSourceInventory: unavailable,
  };
}

const readiness = createReadinessController({
  probeAi: () => {
    try {
      loadConfig();
      return true;
    } catch {
      return false;
    }
  },
  memoryConfig,
  repository: memoryConfig.ready ? memoryRepository : null,
});
const config = getServerConfig(readiness);
const app = createApp({
  serverConfig: config,
  memoryAuthMiddleware,
  memoryRepository,
});

const server = http.createServer(app);
registerChatWebSocket(server, { expectedApiKey: config.agentApiKey });

void readiness.refresh();
const readinessTimer = setInterval(() => {
  void readiness.refresh();
}, 5 * 60 * 1_000);
readinessTimer.unref();

server.listen(config.port, () => {
  console.log(`Backend agent listening on :${config.port}`);
});
