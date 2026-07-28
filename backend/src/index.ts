import 'dotenv/config';
import http from 'http';
import type { RequestHandler } from 'express';
import { createApp } from './app';
import { createMemoryAuthMiddleware } from './auth/supabaseAuth';
import { getServerConfig } from './config/serverConfig';
import { readMemoryConfig } from './memory/config';
import { createPostgrestGateway } from './memory/gateway/postgrestGateway';
import {
  createMemoryRepository,
  type MemoryRepository,
} from './memory/repositories/memoryRepository';
import { registerChatWebSocket } from './ws/chatWebSocket';

const config = getServerConfig();
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

const app = createApp({
  serverConfig: config,
  memoryAuthMiddleware,
  memoryRepository,
});

const server = http.createServer(app);
registerChatWebSocket(server, { expectedApiKey: config.agentApiKey });

server.listen(config.port, () => {
  console.log(`Backend agent listening on :${config.port}`);
});
