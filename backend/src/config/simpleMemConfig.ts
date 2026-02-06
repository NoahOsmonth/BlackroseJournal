import path from 'path';

export interface SimpleMemConfig {
  enabled: boolean;
  pythonExecutable: string;
  scriptPath: string;
  tableName: string;
  dbPath: string;
  topK: number;
  embeddingApiKey?: string;
  embeddingBaseUrl: string;
  embeddingModel: string;
}

const DEFAULT_PYTHON_EXECUTABLE = 'python';
const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'simplemem');
const DEFAULT_SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'simplemem_bridge.py');
const DEFAULT_TABLE_NAME = 'journal_global_memory';
const DEFAULT_TOP_K = 12;
const DEFAULT_EMBEDDING_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

function readEnv(key: string): string | undefined {
  return process.env[key];
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on';
}

export function getSimpleMemConfig(): SimpleMemConfig {
  const embeddingApiKey = readEnv('OPENROUTER_EMBEDDING_API_KEY');
  const explicitEnabled = readEnv('SIMPLEMEM_ENABLED');
  const enabledByDefault = Boolean(embeddingApiKey);
  const enabled = parseBoolean(explicitEnabled, enabledByDefault);
  const topK = Number(readEnv('SIMPLEMEM_TOP_K') || DEFAULT_TOP_K);

  return {
    enabled,
    pythonExecutable: readEnv('SIMPLEMEM_PYTHON_EXECUTABLE') || DEFAULT_PYTHON_EXECUTABLE,
    scriptPath: readEnv('SIMPLEMEM_SCRIPT_PATH') || DEFAULT_SCRIPT_PATH,
    tableName: readEnv('SIMPLEMEM_TABLE_NAME') || DEFAULT_TABLE_NAME,
    dbPath: readEnv('SIMPLEMEM_DB_PATH') || DEFAULT_DB_PATH,
    topK: Number.isFinite(topK) && topK > 0 ? Math.floor(topK) : DEFAULT_TOP_K,
    embeddingApiKey,
    embeddingBaseUrl: readEnv('OPENROUTER_EMBEDDING_BASE_URL') || DEFAULT_EMBEDDING_BASE_URL,
    embeddingModel: readEnv('SIMPLEMEM_EMBEDDING_MODEL') || DEFAULT_EMBEDDING_MODEL,
  };
}

