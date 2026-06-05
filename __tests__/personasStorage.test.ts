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

jest.mock('../services/personas/personasRemote', () => ({
    fetchRemotePersonas: jest.fn(() => Promise.resolve(null)),
    mergePersonas: jest.fn((local: object) => local),
    pushPersonas: jest.fn(() => Promise.resolve(false)),
    queuePersonaDelete: jest.fn(() => Promise.resolve()),
    queuePersonaUpsert: jest.fn(() => Promise.resolve()),
}));

import { fetchRemotePersonas, pushPersonas } from '../services/personas/personasRemote';
import {
    DEFAULT_PERSONA_ID,
    getActivePersona,
    listPersonas,
} from '../services/personas/personasStorage';
import type { Persona } from '../services/personas/personasStorage.types';

describe('personasStorage', () => {
    const originalDataProvider = process.env.EXPO_PUBLIC_DATA_PROVIDER;
    const originalRemoteFlag = process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

    beforeEach(() => {
        mockStore.clear();
        jest.clearAllMocks();
        delete process.env.EXPO_PUBLIC_DATA_PROVIDER;
        delete process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;
    });

    afterEach(() => {
        process.env.EXPO_PUBLIC_DATA_PROVIDER = originalDataProvider;
        process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC = originalRemoteFlag;
    });

    it('seeds the active Rosebud persona locally when no personas exist', async () => {
        const personas = await listPersonas();
        const activePersona = await getActivePersona();

        expect(fetchRemotePersonas).not.toHaveBeenCalled();
        expect(pushPersonas).not.toHaveBeenCalled();
        expect(personas).toHaveLength(1);
        expect(personas[0]).toMatchObject({
            id: DEFAULT_PERSONA_ID,
            name: 'Rosebud',
            tagline: 'Balanced and thoughtful',
            isActive: true,
            avatarKey: 'persona-default',
        });
        expect(activePersona?.id).toBe(DEFAULT_PERSONA_ID);

        const storedJson = mockStore.get('@personas') ?? '{}';
        const stored = JSON.parse(storedJson) as Record<string, Persona>;
        expect(stored[DEFAULT_PERSONA_ID]?.name).toBe('Rosebud');
    });
});
