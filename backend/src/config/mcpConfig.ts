import { McpServerConfig } from '../mcp/types';

interface McpConfig {
  servers: McpServerConfig[];
  allowlist: string[];
  defaultMemoryServerId: string;
}

const DEFAULT_SUPERMEMORY_URL = 'https://mcp.supermemory.ai/mcp';
const DEFAULT_MEMORY_SERVER_ID = 'supermemory';

function readEnv(key: string): string | undefined {
  return process.env[key];
}

function parseJsonArray(raw?: string): unknown[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildSupermemoryServer(): McpServerConfig | null {
  const apiKey = readEnv('MCP_SUPERMEMORY_API_KEY');
  const project = readEnv('MCP_SUPERMEMORY_PROJECT');
  const explicitUrl = readEnv('MCP_SUPERMEMORY_URL');

  if (!apiKey && !explicitUrl) {
    return null;
  }

  const url = explicitUrl || DEFAULT_SUPERMEMORY_URL;

  if (!url) return null;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (project) {
    headers['x-sm-project'] = project;
  }

  return {
    id: DEFAULT_MEMORY_SERVER_ID,
    name: 'Supermemory MCP',
    transport: 'http',
    url,
    headers: Object.keys(headers).length ? headers : undefined,
    toolAliases: {
      saveMemory: 'memory',
      recallMemory: 'recall',
    },
  };
}

export function getMcpConfig(): McpConfig {
  const servers: McpServerConfig[] = [];
  const rawServers = parseJsonArray(readEnv('MCP_SERVERS_JSON'));

  if (rawServers) {
    rawServers.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        servers.push(entry as McpServerConfig);
      }
    });
  }

  const supermemory = buildSupermemoryServer();
  if (supermemory) {
    const alreadyExists = servers.some((server) => server.id === supermemory.id);
    if (!alreadyExists) {
      servers.push(supermemory);
    }
  }

  const allowlistRaw = readEnv('MCP_ALLOWLIST');
  const allowlist = allowlistRaw
    ? allowlistRaw.split(',').map((value) => value.trim()).filter(Boolean)
    : servers.map((server) => server.id);

  return {
    servers,
    allowlist,
    defaultMemoryServerId: readEnv('MCP_DEFAULT_MEMORY_SERVER_ID') || DEFAULT_MEMORY_SERVER_ID,
  };
}
