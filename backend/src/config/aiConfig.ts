export interface AiConfig {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  flashModel: string;
}

const DEFAULT_API_BASE_URL = 'https://nano-gpt.com/api/v1';
const DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';
const DEFAULT_FLASH_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b';

function readEnv(key: string): string | undefined {
  return process.env[key];
}

export function getAiConfig(): AiConfig {
  const apiKey = readEnv('NANO_GPT_API_KEY');
  if (!apiKey) {
    throw new Error('Missing NANO_GPT_API_KEY for backend AI requests.');
  }

  return {
    apiBaseUrl: readEnv('NANO_GPT_API_BASE_URL') || DEFAULT_API_BASE_URL,
    apiKey,
    model: readEnv('NANO_GPT_MODEL') || DEFAULT_MODEL,
    flashModel: readEnv('NANO_GPT_FLASH_MODEL') || DEFAULT_FLASH_MODEL,
  };
}
