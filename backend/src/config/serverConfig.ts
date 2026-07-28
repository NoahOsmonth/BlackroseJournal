import type { ReadinessProvider } from '../readiness';

export interface ServerConfig {
  port: number;
  allowedOrigins: string[] | null;
  agentApiKey?: string;
  readiness: ReadinessProvider;
}

const DEFAULT_PORT = 8787;

function readEnv(key: string): string | undefined {
  return process.env[key];
}

const NOT_READY: ReadinessProvider = {
  getSnapshot: () => ({
    ai: false,
    supabaseAuth: false,
    postgrestGateway: false,
    deploymentAuthority: false,
  }),
};

export function getServerConfig(
  readiness: ReadinessProvider = NOT_READY,
): ServerConfig {
  const port = Number(readEnv('PORT') || DEFAULT_PORT);
  const originsRaw = readEnv('ALLOWED_ORIGINS');
  const allowedOrigins = originsRaw === '*'
    ? null
    : originsRaw
      ? originsRaw.split(',').map((value) => value.trim()).filter(Boolean)
      : null;

  return {
    port: Number.isNaN(port) ? DEFAULT_PORT : port,
    allowedOrigins,
    agentApiKey: readEnv('AGENT_API_KEY'),
    readiness,
  };
}
