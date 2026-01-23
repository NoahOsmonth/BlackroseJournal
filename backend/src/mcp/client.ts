import {
  JsonRpcRequest,
  JsonRpcResponse,
  McpInitializeResult,
  McpToolCallResult,
  McpToolListResult,
} from './types';

export interface McpTransport {
  start(): Promise<void>;
  send(payload: unknown): Promise<void>;
  onMessage(handler: (message: unknown) => void): void;
  onError(handler: (error: Error) => void): void;
  close(): Promise<void>;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const DEFAULT_PROTOCOL_VERSION = '2025-03-26';

export class McpClient {
  private requestId = 0;
  private pending = new Map<string, PendingRequest>();
  private started = false;

  constructor(private readonly transport: McpTransport) {
    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.onError((error) => this.handleError(error));
  }

  async connect(): Promise<McpInitializeResult> {
    if (this.started) {
      return { protocolVersion: DEFAULT_PROTOCOL_VERSION };
    }

    await this.transport.start();
    this.started = true;

    const result = await this.request<McpInitializeResult>('initialize', {
      protocolVersion: DEFAULT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: 'journalapp-backend',
        version: '0.1.0',
      },
    });

    await this.notify('initialized', {});
    return result;
  }

  async listTools(): Promise<McpToolListResult> {
    return this.request<McpToolListResult>('tools/list', {});
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolCallResult> {
    return this.request<McpToolCallResult>('tools/call', {
      name,
      arguments: args,
    });
  }

  async close(): Promise<void> {
    await this.transport.close();
    this.pending.clear();
    this.started = false;
  }

  private async notify(method: string, params: unknown): Promise<void> {
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
    };
    await this.transport.send(payload);
  }

  private async request<T>(method: string, params: unknown): Promise<T> {
    const id = `${++this.requestId}`;
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const response = new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
    });

    await this.transport.send(payload);

    return response;
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') {
      return;
    }

    const response = message as JsonRpcResponse;
    if (!response.id) {
      return;
    }

    const pending = this.pending.get(String(response.id));
    if (!pending) {
      return;
    }

    this.pending.delete(String(response.id));

    if (response.error) {
      pending.reject(new Error(response.error.message));
      return;
    }

    pending.resolve(response.result as unknown);
  }

  private handleError(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
