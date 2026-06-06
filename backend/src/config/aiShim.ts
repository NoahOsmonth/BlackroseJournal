/**
 * aiShim.ts
 *
 * Backward-compat shim for the legacy NANO_GPT_* env var names. Maps them
 * to the new AI_DEFAULT_* names. The shim is a pure function in PR5 — it
 * is NOT wired into the config loader here. A later PR combines PR1
 * (config loader) and PR5 (shim) so the shim is invoked at boot.
 *
 * Deprecation date: 2026-09-01. After that date, the CI guard in
 * scripts/check-legacy-shim.js fails the build until the shim is removed.
 *
 * See docs/MIGRATION.md for the upgrade runbook.
 */

/** Hard deprecation date for the NANO_GPT_* env vars. */
export const AI_LEGACY_SHIM_DEPRECATION_DATE = '2026-09-01';

/** Output shape: the same env keys the new config loader consumes. */
export interface AiConfigInput {
    AI_DEFAULT_API_KEY?: string;
    AI_DEFAULT_API_BASE_URL?: string;
    AI_DEFAULT_MODEL?: string;
    AI_DEFAULT_FLASH_MODEL?: string;
}

/**
 * Permissive env shape. The shim only reads NANO_GPT_* and AI_DEFAULT_*,
 * so it accepts any string-keyed env object. Using a structural type
 * (not NodeJS.ProcessEnv) keeps the shim callable in tests without
 * needing to fake the Expo-required NODE_ENV field.
 */
export type EnvLike = Readonly<Record<string, string | undefined>>;

/** Legacy env name → new env name. Order does not matter. */
const LEGACY_MAP = {
    NANO_GPT_API_KEY: 'AI_DEFAULT_API_KEY',
    NANO_GPT_API_BASE_URL: 'AI_DEFAULT_API_BASE_URL',
    NANO_GPT_MODEL: 'AI_DEFAULT_MODEL',
    NANO_GPT_FLASH_MODEL: 'AI_DEFAULT_FLASH_MODEL',
} as const;

type LegacyKey = keyof typeof LEGACY_MAP;
type NewKey = (typeof LEGACY_MAP)[LegacyKey];
type MutableAiConfigInput = {
    -readonly [K in keyof AiConfigInput]: AiConfigInput[K];
};

let deprecationWarningEmitted = false;

/**
 * Reads the env, preserves any new AI_DEFAULT_* values, and fills in the
 * gaps from legacy NANO_GPT_* values when present. Emits a one-time
 * console.warn if any legacy values are mapped. New names always win.
 */
export function applyLegacyShim(processEnv: EnvLike): AiConfigInput {
    const result: MutableAiConfigInput = {
        AI_DEFAULT_API_KEY: processEnv.AI_DEFAULT_API_KEY,
        AI_DEFAULT_API_BASE_URL: processEnv.AI_DEFAULT_API_BASE_URL,
        AI_DEFAULT_MODEL: processEnv.AI_DEFAULT_MODEL,
        AI_DEFAULT_FLASH_MODEL: processEnv.AI_DEFAULT_FLASH_MODEL,
    };

    let mappedFromLegacy = false;
    for (const legacyKey of Object.keys(LEGACY_MAP) as LegacyKey[]) {
        const newKey = LEGACY_MAP[legacyKey] as NewKey;
        const legacyValue = processEnv[legacyKey];
        if (legacyValue && !result[newKey]) {
            result[newKey] = legacyValue;
            mappedFromLegacy = true;
        }
    }

    if (mappedFromLegacy && !deprecationWarningEmitted) {
        deprecationWarningEmitted = true;
        console.warn(
            `[DEPRECATION] NANO_GPT_* env vars are deprecated and will stop working on ${AI_LEGACY_SHIM_DEPRECATION_DATE}. ` +
                `Rename them to AI_DEFAULT_* now. See docs/MIGRATION.md for the upgrade runbook.`
        );
    }

    return result;
}

/** Test-only helper: reset the one-time warning latch. Not part of the public API. */
export function __resetLegacyShimWarningForTests(): void {
    deprecationWarningEmitted = false;
}
