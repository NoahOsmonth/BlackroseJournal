/* eslint-disable import/first */

const mockCreateClient = jest.fn(
    (_url: string, _anonKey: string, _options: unknown) => ({ auth: {} })
);

jest.mock('@supabase/supabase-js', () => ({
    __esModule: true,
    createClient: (url: string, anonKey: string, options: unknown) =>
        mockCreateClient(url, anonKey, options),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

import { resilientAuthLock } from '@/services/supabase/authLock';
import {
    getSessionSafely,
    getSupabaseClient,
    resetSupabaseClient,
} from '@/services/supabase/supabaseClient';

const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

describe('supabase client auth safety', () => {
    beforeEach(() => {
        mockCreateClient.mockClear();
        process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    });

    afterEach(() => {
        process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
        resetSupabaseClient();
    });

    it('installs the resilient lock so lock aborts cannot escape as uncaught errors', () => {
        getSupabaseClient();

        expect(mockCreateClient).toHaveBeenCalledTimes(1);
        const options = mockCreateClient.mock.calls[0][2] as {
            auth: { lock?: unknown; storageKey?: string };
        };
        expect(options.auth.lock).toBe(resilientAuthLock);
    });

    it('returns the session when getSession resolves with one', async () => {
        const session = { access_token: 'token', user: { id: 'user-a' } };

        await expect(
            getSessionSafely({ auth: { getSession: async () => ({ data: { session }, error: null }) } })
        ).resolves.toEqual({ session, error: null });
    });

    it('converts a returned auth error into a soft failure', async () => {
        const result = await getSessionSafely({
            auth: {
                getSession: async () => ({
                    data: { session: null },
                    error: { message: 'Failed to fetch' },
                }),
            },
        });

        expect(result.session).toBeNull();
        expect(result.error?.message).toBe('Failed to fetch');
    });

    it('absorbs a rejected getSession (lock acquire abort) instead of throwing', async () => {
        const abort = new Error('signal is aborted without reason');
        abort.name = 'AbortError';

        const result = await getSessionSafely({
            auth: { getSession: async () => { throw abort; } },
        });

        expect(result.session).toBeNull();
        expect(result.error?.name).toBe('AbortError');
    });
});
