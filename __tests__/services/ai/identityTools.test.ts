/* eslint-disable import/first */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

import {
    executeToolCall,
    getIdentityTool,
    updateIdentityTool,
} from '../../../services/ai/tools';
import {
    clearIdentityProfile,
    resetIdentityStorageAdapter,
    setIdentityStorageAdapter,
} from '../../../services/memory/identityProfile';

function createInMemoryAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
    };
}

describe('identity tools', () => {
    beforeEach(() => {
        setIdentityStorageAdapter(createInMemoryAdapter());
    });

    afterEach(async () => {
        await clearIdentityProfile();
        resetIdentityStorageAdapter();
    });

    it('get_identity reports empty profile', async () => {
        const out = await getIdentityTool({});
        expect(out.toLowerCase()).toContain('no identity');
    });

    it('update_identity persists preferred name and get_identity reads it', async () => {
        const written = await updateIdentityTool({ preferredName: 'Sigurd' });
        expect(written).toContain('Sigurd');

        const read = await getIdentityTool({});
        expect(read).toContain('Preferred name: Sigurd');
    });

    it('executeToolCall routes update_identity', async () => {
        const result = await executeToolCall({
            id: 'c1',
            name: 'update_identity',
            arguments: JSON.stringify({ name: 'Alex', pronouns: 'they/them' }),
        });
        expect(result.isError).toBeFalsy();
        expect(result.content).toContain('Alex');
    });
});
