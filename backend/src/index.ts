import 'dotenv/config';
import http from 'http';
import { createApp } from './app';
import { loadConfig } from './config/ai';
import { getServerConfig } from './config/serverConfig';
import { createReadinessController } from './readiness';
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
const app = createApp({
  serverConfig: config,
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
