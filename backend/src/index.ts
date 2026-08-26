import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { loadConfig } from './config/ai';
import { getServerConfig } from './config/serverConfig';
import { createReadinessController } from './readiness';
import { createManagedAccessFromEnvironment } from './security/securityConfig';
import { createMemoryGatewayFromEnvironment } from './memory/memoryConfig';
import { createControlPlaneFromEnvironment, createOmnirouteControlFromEnvironment } from './control/controlPlaneConfig';
import { createManagedInferenceFromEnvironment } from './inference/managedInferenceConfig';
import { registerChatWebSocket } from './ws/chatWebSocket';

const readiness = createReadinessController({
  probeAi: () => {
    try {
      loadConfig();
      return true;
    } catch {
      return false;
    }
  },
});
const config = getServerConfig(readiness);
const managedAccess = createManagedAccessFromEnvironment(process.env);
const memoryGateway = createMemoryGatewayFromEnvironment(process.env);
const controlPlaneService = createControlPlaneFromEnvironment(process.env);
const omnirouteControl = createOmnirouteControlFromEnvironment(process.env);
const managedInferenceService = createManagedInferenceFromEnvironment(process.env);
const app = createApp({
  serverConfig: config,
  managedAccess,
  memoryGateway,
  controlPlaneService,
  managedInferenceService,
  omnirouteControl,
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
