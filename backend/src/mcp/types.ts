export type JsonRpcId = number | string;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpServerInfo {
  name?: string;
  version?: string;
}

export interface McpServerConfigBase {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  toolAliases?: {
    saveMemory?: string;
    recallMemory?: string;
  };
}

export interface McpHttpServerConfig extends McpServerConfigBase {
  transport: 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface McpStdioServerConfig extends McpServerConfigBase {
  transport: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export type McpServerConfig = McpHttpServerConfig | McpStdioServerConfig;

export interface McpInitializeResult {
  protocolVersion?: string;
  serverInfo?: McpServerInfo;
}

export interface McpToolListResult {
  tools: McpTool[];
}

export interface McpToolCallResult {
  content?: Array<{ type: string; text?: string; data?: unknown }>;
  isError?: boolean;
}
