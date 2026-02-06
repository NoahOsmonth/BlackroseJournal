import { spawn } from 'child_process';
import { getSimpleMemConfig } from '../config/simpleMemConfig';

interface BridgeMemoryEntry {
  lossless_restatement: string;
  timestamp?: string | null;
  location?: string | null;
  persons?: string[];
  entities?: string[];
  topic?: string | null;
}

interface RetrievePayload {
  query: string;
  top_k: number;
  table_name: string;
}

interface StorePayload {
  speaker: string;
  content: string;
  timestamp?: string;
  table_name: string;
}

interface RetrieveResponse {
  entries: BridgeMemoryEntry[];
}

const SIMPLEMEM_UNAVAILABLE_LOG =
  'SimpleMem disabled: set OPENROUTER_EMBEDDING_API_KEY and SIMPLEMEM_ENABLED=true to enable long-term memory.';

let hasLoggedUnavailable = false;

function ensureSimpleMemEnabled(): boolean {
  const config = getSimpleMemConfig();
  const available = config.enabled && Boolean(config.embeddingApiKey);

  if (!available && !hasLoggedUnavailable) {
    console.warn(SIMPLEMEM_UNAVAILABLE_LOG);
    hasLoggedUnavailable = true;
  }

  return available;
}

function runBridgeCommand<T extends object>(
  command: 'store' | 'retrieve',
  payload: T
): Promise<string> {
  const config = getSimpleMemConfig();
  const bridgeEnv = {
    ...process.env,
    SIMPLEMEM_DB_PATH: config.dbPath,
    SIMPLEMEM_TABLE_NAME: config.tableName,
    OPENROUTER_EMBEDDING_API_KEY: config.embeddingApiKey || '',
    OPENROUTER_EMBEDDING_BASE_URL: config.embeddingBaseUrl,
    SIMPLEMEM_EMBEDDING_MODEL: config.embeddingModel,
  };

  return new Promise((resolve, reject) => {
    const child = spawn(
      config.pythonExecutable,
      [config.scriptPath, command],
      {
        env: bridgeEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`SimpleMem bridge failed with code ${code}. ${stderr.trim()}`));
        return;
      }

      resolve(stdout.trim());
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function formatMemoryContext(entries: BridgeMemoryEntry[]): string {
  if (entries.length === 0) {
    return '';
  }

  const lines = entries.map((entry, index) => {
    const parts = [`${index + 1}. ${entry.lossless_restatement}`];

    if (entry.timestamp) {
      parts.push(`time=${entry.timestamp}`);
    }

    if (entry.location) {
      parts.push(`location=${entry.location}`);
    }

    return parts.join(' | ');
  });

  return `## Long-Term Memory Context\n${lines.join('\n')}`;
}

export async function retrieveLongTermMemoryContext(query: string): Promise<string> {
  if (!ensureSimpleMemEnabled() || !query.trim()) {
    return '';
  }

  const config = getSimpleMemConfig();
  const payload: RetrievePayload = {
    query: query.trim(),
    top_k: config.topK,
    table_name: config.tableName,
  };

  try {
    const raw = await runBridgeCommand('retrieve', payload);
    const parsed = JSON.parse(raw) as RetrieveResponse;
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    return formatMemoryContext(entries);
  } catch (error) {
    console.warn('SimpleMem retrieve failed:', error);
    return '';
  }
}

export async function storeMessageInLongTermMemory(
  speaker: 'user' | 'assistant',
  content: string,
  timestamp = new Date().toISOString()
): Promise<void> {
  if (!ensureSimpleMemEnabled()) {
    return;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return;
  }

  const config = getSimpleMemConfig();
  const payload: StorePayload = {
    speaker,
    content: trimmed,
    timestamp,
    table_name: config.tableName,
  };

  try {
    await runBridgeCommand('store', payload);
  } catch (error) {
    console.warn('SimpleMem store failed:', error);
  }
}

