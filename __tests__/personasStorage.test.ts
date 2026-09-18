/* eslint-disable import/first */

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
        setItem: jest.fn((key: string, value: string) => {
            mockStore.set(key, value);
            return Promise.resolve();
        }),
        removeItem: jest.fn((key: string) => {
            mockStore.delete(key);
            return Promise.resolve();
        }),
    },
}));

import {
    DEFAULT_PERSONA_ID,
    getActivePersona,
    listPersonas,
} from '../services/personas/personasStorage';
import type { Persona } from '../services/personas/personasStorage.types';

describe('personasStorage', () => {
    beforeEach(() => {
        mockStore.clear();
    });

    it('seeds the active Blackrose persona locally when no personas exist', async () => {
        const personas = await listPersonas();
        const activePersona = await getActivePersona();

        expect(personas).toHaveLength(1);
        expect(personas[0]).toMatchObject({
            id: DEFAULT_PERSONA_ID,
            name: 'Blackrose',
            tagline: 'Balanced and thoughtful',
            isActive: true,
            avatarKey: 'persona-default',
        });
        expect(activePersona?.id).toBe(DEFAULT_PERSONA_ID);

        const storedJson = mockStore.get('@personas') ?? '{}';
        const stored = JSON.parse(storedJson) as Record<string, Persona>;
        expect(stored[DEFAULT_PERSONA_ID]?.name).toBe('Blackrose');
    });
});
