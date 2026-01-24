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
