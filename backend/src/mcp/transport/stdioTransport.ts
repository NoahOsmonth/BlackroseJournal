import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import readline from 'readline';

export interface StdioTransportOptions {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

type MessageHandler = (message: unknown) => void;
type ErrorHandler = (error: Error) => void;

export class StdioTransport {
  private process: ChildProcessWithoutNullStreams | null = null;
  private messageHandler: MessageHandler | null = null;
  private errorHandler: ErrorHandler | null = null;

  constructor(private readonly options: StdioTransportOptions) {}

  async start(): Promise<void> {
    if (this.process) return;

    const child = spawn(this.options.command, this.options.args ?? [], {
      env: { ...process.env, ...this.options.env },
      cwd: this.options.cwd,
      stdio: 'pipe',
    });

    const lineReader = readline.createInterface({ input: child.stdout });
    lineReader.on('line', (line) => this.handleLine(line));

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.trim().length === 0) return;
      this.errorHandler?.(new Error(text));
    });

    child.on('error', (error) => {
      this.errorHandler?.(error);
    });

    child.on('exit', (code) => {
      if (code !== 0) {
        this.errorHandler?.(new Error(`MCP stdio process exited with code ${code}`));
      }
    });

    this.process = child;
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  async send(payload: unknown): Promise<void> {
    if (!this.process) {
      throw new Error('MCP stdio transport not started.');
    }

    const line = JSON.stringify(payload);
    this.process.stdin.write(`${line}\n`);
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      this.messageHandler?.(parsed);
    } catch (error) {
      this.errorHandler?.(new Error(`Failed to parse MCP stdio message: ${String(error)}`));
    }
  }
}
