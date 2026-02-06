export interface ServerConfig {
  port: number;
  allowedOrigins: string[] | null;
  agentApiKey?: string;
}

const DEFAULT_PORT = 8787;

function readEnv(key: string): string | undefined {
  return process.env[key];
}

export function getServerConfig(): ServerConfig {
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
  };
}
