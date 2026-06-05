/* eslint-disable import/first */

const mockCreateClient = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
    createClient: mockCreateClient,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {},
}));

import {
    ensureSupabaseSession,
    resetSupabaseClient,
} from '../services/supabase/supabaseClient';

describe('supabaseClient local-only data mode', () => {
    const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const originalDataProvider = process.env.EXPO_PUBLIC_DATA_PROVIDER;
    const originalRemoteFlag = process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

    afterEach(() => {
        process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
        process.env.EXPO_PUBLIC_DATA_PROVIDER = originalDataProvider;
        process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC = originalRemoteFlag;
        mockCreateClient.mockClear();
        resetSupabaseClient();
    });

    it('does not initialize Supabase sessions for app data by default', async () => {
        process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
        delete process.env.EXPO_PUBLIC_DATA_PROVIDER;
        delete process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

        await expect(ensureSupabaseSession()).resolves.toBeNull();
        expect(mockCreateClient).not.toHaveBeenCalled();
    });
});
