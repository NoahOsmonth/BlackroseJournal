import { getMcpConfig } from '../config/mcpConfig';
import { McpClient } from './client';
import { HttpTransport } from './transport/httpTransport';
import { StdioTransport } from './transport/stdioTransport';
import { McpServerConfig, McpTool } from './types';

interface RegistryState {
  config: ReturnType<typeof getMcpConfig>;
  clients: Map<string, McpClient>;
}

function createTransport(server: McpServerConfig) {
  if (server.transport === 'http') {
    return new HttpTransport({
      url: server.url,
      headers: server.headers,
    });
  }

  return new StdioTransport({
    command: server.command,
    args: server.args,
    env: server.env,
    cwd: server.cwd,
  });
}

export class McpRegistry {
  private state: RegistryState;

  constructor(config = getMcpConfig()) {
    this.state = {
      config,
      clients: new Map(),
    };
  }

  getConfig(): ReturnType<typeof getMcpConfig> {
    return this.state.config;
  }

  listServers(): McpServerConfig[] {
    return this.state.config.servers;
  }

  getServer(serverId: string): McpServerConfig | undefined {
    return this.state.config.servers.find((server) => server.id === serverId);
  }

  isAllowed(serverId: string): boolean {
    return this.state.config.allowlist.includes(serverId);
  }

  getDefaultMemoryServerId(): string {
    return this.state.config.defaultMemoryServerId;
  }

  async getClient(serverId: string): Promise<McpClient> {
    const cached = this.state.clients.get(serverId);
    if (cached) return cached;

    const server = this.getServer(serverId);
    if (!server) {
      throw new Error(`Unknown MCP server: ${serverId}`);
    }
    if (!this.isAllowed(serverId)) {
      throw new Error(`MCP server not allowed: ${serverId}`);
    }

    const transport = createTransport(server);
    const client = new McpClient(transport);
    await client.connect();
    this.state.clients.set(serverId, client);
    return client;
  }

  async listTools(serverId: string): Promise<McpTool[]> {
    const client = await this.getClient(serverId);
    const result = await client.listTools();
    return result.tools || [];
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>) {
    const client = await this.getClient(serverId);
    return client.callTool(toolName, args);
  }
}
