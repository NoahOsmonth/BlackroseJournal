/**
 * Shared AI model registry
 *
 * Single source of truth for the persona/chat model picker and AI persona
 * generation. Previously these were hardcoded inline in
 * `app/persona/advanced.tsx`; extracting them here lets generation and the
 * picker draw from one list.
 */

export const PERSONA_MODELS = [
    'nvidia/nemotron-3-ultra-550b-a55b',
    'moonshotai/kimi-k2.5:thinking',
    'moonshotai/kimi-k2.5',
] as const;

export type PersonaModelId = (typeof PERSONA_MODELS)[number];

export const PERSONA_MODEL_LABELS: Record<PersonaModelId, string> = {
    'nvidia/nemotron-3-ultra-550b-a55b': 'NVIDIA Nemotron 3 Ultra 550B',
    'moonshotai/kimi-k2.5:thinking': 'Kimi K2.5 Thinking',
    'moonshotai/kimi-k2.5': 'Kimi K2.5',
};

export const PERSONA_MODEL_OPTIONS = PERSONA_MODELS.map((id) => ({
    id,
    label: PERSONA_MODEL_LABELS[id],
}));

/** Default model used for newly generated personas. */
export const DEFAULT_PERSONA_MODEL: PersonaModelId = PERSONA_MODELS[0];

/** Coerces an arbitrary string to a known model id, falling back to the default. */
export function resolvePersonaModel(value?: string): PersonaModelId {
    if (value && (PERSONA_MODELS as readonly string[]).includes(value)) {
        return value as PersonaModelId;
    }
    return DEFAULT_PERSONA_MODEL;
}
