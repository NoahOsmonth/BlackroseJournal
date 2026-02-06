import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getServerConfig } from './config/serverConfig';
import { createAuthMiddleware } from './routes/auth';
import { registerChatRoutes } from './routes/chatRoutes';
import { registerAskRosebudRoutes } from './routes/askRosebudRoutes';
import { registerHealthRoutes } from './routes/healthRoutes';

const config = getServerConfig();

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use(cors({
  origin: config.allowedOrigins ?? true,
  credentials: true,
}));

registerHealthRoutes(app);

const auth = createAuthMiddleware(config.agentApiKey);
app.use('/v1', auth);

registerChatRoutes(app);
registerAskRosebudRoutes(app);

app.listen(config.port, () => {
  console.log(`Backend agent listening on :${config.port}`);
});
