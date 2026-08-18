import 'dotenv/config';
import http from 'http';
import type { RequestHandler } from 'express';
import type { DeploymentWriteRequest } from '../../shared/memory/deploymentAuthority';
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
import {
  createSourceMirrorRepository,
  type SourceMirrorRepository,
} from './memory/repositories/sourceMirrorRepository';
import { createReadinessController } from './readiness';
import { registerChatWebSocket } from './ws/chatWebSocket';

const memoryConfig = readMemoryConfig(process.env);

let memoryAuthMiddleware: RequestHandler;
let mirrorAuthMiddleware: RequestHandler;
let memoryRepository: MemoryRepository;
let sourceMirrorRepository: SourceMirrorRepository | null = null;
let mirrorWriteAuthority: DeploymentWriteRequest | null = null;
let mirrorWritesEnabled = false;
let credentialFingerprint: string | null = null;
if (memoryConfig.ready) {
  const gateway = createPostgrestGateway({
    postgrestBaseUrl: memoryConfig.config.postgrestBaseUrl,
    postgrestServerKey: memoryConfig.config.postgrestServerKey,
    postgrestKeyKind: memoryConfig.config.postgrestKeyKind,
  });
  credentialFingerprint = gateway.credentialFingerprint;
  memoryAuthMiddleware = createMemoryAuthMiddleware({
    config: memoryConfig.config.auth,
  });
  mirrorAuthMiddleware = createMemoryAuthMiddleware({
    config: memoryConfig.config.auth,
    requireMirrorSession: true,
  });
  memoryRepository = createMemoryRepository(gateway);
  sourceMirrorRepository = createSourceMirrorRepository(gateway);
  mirrorWriteAuthority = {
    deploymentId: memoryConfig.config.deploymentId,
    writerEpoch: memoryConfig.config.writerEpoch,
    writerLeaseId: memoryConfig.config.writerLeaseId,
    writerLeaseToken: memoryConfig.config.writerLeaseToken,
    sourceCredentialFingerprint: credentialFingerprint,
  };
  mirrorWritesEnabled = memoryConfig.config.mirrorWritesEnabled;
} else {
  memoryAuthMiddleware = (_req, res) => {
    res.status(503).json({
      error: {
        code: 'MEMORY_CONFIG_NOT_READY',
        message: 'Memory service unavailable.',
      },
    });
  };
  mirrorAuthMiddleware = memoryAuthMiddleware;
  const never = async (): Promise<never> => {
    throw new Error('MEMORY_CONFIG_NOT_READY');
  };
  memoryRepository = {
    getBootstrap: never,
    getOwnerState: never,
    getSourceInventory: never,
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
  credentialFingerprint,
});
const config = getServerConfig(readiness);
const app = createApp({
  serverConfig: config,
  memoryAuthMiddleware,
  memoryRepository,
  mirrorAuthMiddleware,
  sourceMirrorRepository,
  mirrorWriteAuthority,
  mirrorWritesEnabled,
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
