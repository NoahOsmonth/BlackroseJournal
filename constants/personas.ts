export const PERSONA_AVATARS = [
    {
        id: 'persona-default',
        label: 'Classic',
        source: require('@/assets/personas/persona-default.png'),
    },
    {
        id: 'persona-new',
        label: 'Geo',
        source: require('@/assets/personas/persona-new.png'),
    },
] as const;

export type PersonaAvatarKey = typeof PERSONA_AVATARS[number]['id'];

export function getPersonaAvatarSource(key?: string) {
    return PERSONA_AVATARS.find((avatar) => avatar.id === key)?.source;
}

/** Allowed TTS voices — shared by the persona form and AI generation. */
export const PERSONA_VOICES = ['Onyx', 'Nova', 'Echo'] as const;

export type PersonaVoice = typeof PERSONA_VOICES[number];

export const DEFAULT_PERSONA_VOICE: PersonaVoice = 'Onyx';
