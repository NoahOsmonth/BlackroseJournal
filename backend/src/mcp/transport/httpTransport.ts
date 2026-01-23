export interface HttpTransportOptions {
  url: string;
  headers?: Record<string, string>;
  protocolVersion?: string;
}

type MessageHandler = (message: unknown) => void;
type ErrorHandler = (error: Error) => void;

const DEFAULT_PROTOCOL_VERSION = '2025-03-26';

export class HttpTransport {
  private messageHandler: MessageHandler | null = null;
  private errorHandler: ErrorHandler | null = null;
  private sessionId: string | null = null;

  constructor(private readonly options: HttpTransportOptions) {}

  async start(): Promise<void> {
    return;
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  async send(payload: unknown): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': this.options.protocolVersion || DEFAULT_PROTOCOL_VERSION,
      ...this.options.headers,
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(this.options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const nextSession = response.headers.get('mcp-session-id');
    if (nextSession) {
      this.sessionId = nextSession;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const preview = errorText.slice(0, 200);
      throw new Error(`MCP HTTP error ${response.status}. ${preview}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      const text = await response.text();
      this.handleSse(text);
      return;
    }

    const json = await response.json().catch(() => null);
    if (!json) {
      throw new Error('MCP HTTP response was not valid JSON.');
    }
    this.messageHandler?.(json);
  }

  async close(): Promise<void> {
    return;
  }

  private handleSse(payload: string): void {
    const lines = payload.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.replace(/^data:\s?/, '');
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        this.messageHandler?.(parsed);
      } catch (error) {
        this.errorHandler?.(new Error(`Failed to parse MCP SSE data: ${String(error)}`));
      }
    }
  }
}
