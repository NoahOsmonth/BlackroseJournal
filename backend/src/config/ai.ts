/**
 * Frozen, validated, single-source AI provider config loader (PR1).
 *
 * Reads the `AI_DEFAULT_*` env vars exactly once, validates the result with a
 * hand-rolled validator (no Zod, no extra deps), and hands out a frozen
 * singleton via {@link getAiConfig}. The legacy `NANO_GPT_*` names are mapped
 * to the new names via {@link applyLegacyShim} (PR5) before the read, so
 * deployments that haven't migrated their `.env` yet still boot. New names
 * always win when both are set.
 *
 * This file is the ONLY place in the backend that reads AI env vars.
 */
import { applyLegacyShim } from './aiShim';

export interface AiConfigInput {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  flashModel: string;
}

export type AiConfig = Readonly<AiConfigInput>;

const ENV_API_BASE_URL = 'AI_DEFAULT_API_BASE_URL';
const ENV_API_KEY = 'AI_DEFAULT_API_KEY';
const ENV_MODEL = 'AI_DEFAULT_MODEL';
const ENV_FLASH_MODEL = 'AI_DEFAULT_FLASH_MODEL';

const DEFAULT_API_BASE_URL = 'https://nano-gpt.com/api/v1';
const DEFAULT_MODEL = 'moonshotai/kimi-k2.5:thinking';
const DEFAULT_FLASH_MODEL = 'moonshotai/kimi-k2.5';

const FIELDS: readonly (readonly [keyof AiConfigInput, string])[] = [
  ['apiKey', ENV_API_KEY],
  ['apiBaseUrl', ENV_API_BASE_URL],
  ['model', ENV_MODEL],
  ['flashModel', ENV_FLASH_MODEL],
];

let cached: AiConfig | null = null;

function isEmpty(value: string | undefined): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Hand-rolled validator. Throws a single-line error that names both the env
 * var (`AI_DEFAULT_*`) and the field (`apiKey`, `flashModel`, …) so callers
 * can fix either layer of the config without guessing.
 */
export function validateConfig(input: AiConfigInput): void {
  for (const [field, envName] of FIELDS) {
    if (isEmpty(input[field])) {
      throw new Error(`Invalid AI config: ${envName} (${field}) is required.`);
    }
  }
}

/** Read env (with shim), validate, freeze, cache, return. Idempotent. */
export function loadConfig(): AiConfig {
  if (cached !== null) {
    return cached;
  }

  const shimmed = applyLegacyShim(process.env);

  const input: AiConfigInput = {
    apiBaseUrl: shimmed.AI_DEFAULT_API_BASE_URL || DEFAULT_API_BASE_URL,
    apiKey: shimmed.AI_DEFAULT_API_KEY || '',
    model: shimmed.AI_DEFAULT_MODEL || DEFAULT_MODEL,
    flashModel: shimmed.AI_DEFAULT_FLASH_MODEL || DEFAULT_FLASH_MODEL,
  };

  validateConfig(input);
  cached = Object.freeze(input);
  return cached;
}

/** Return the frozen singleton. Lazy-initializes on first call. */
export function getAiConfig(): AiConfig {
  return cached ?? loadConfig();
}
