/* eslint-disable import/first */

import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/services/data/dataProvider', () => ({
    isRemoteDataSyncEnabled: jest.fn(),
}));

jest.mock('@/services/supabase/supabaseConfig', () => ({
    getSupabaseConfig: jest.fn(),
}));

jest.mock('@/services/supabase/supabaseClient', () => ({
    ensureSupabaseSession: jest.fn(),
}));

jest.mock('@/services/supabase/supabaseErrors', () => ({
    isMissingTableMessage: jest.fn(),
}));

import { isRemoteDataSyncEnabled } from '@/services/data/dataProvider';
import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { getSupabaseConfig } from '@/services/supabase/supabaseConfig';
import { useSupabaseSchemaStatus } from '../hooks/supabase/useSupabaseSchemaStatus';

const mockIsRemoteDataSyncEnabled = jest.mocked(isRemoteDataSyncEnabled);
const mockGetSupabaseConfig = jest.mocked(getSupabaseConfig);
const mockEnsureSupabaseSession = jest.mocked(ensureSupabaseSession);

describe('useSupabaseSchemaStatus', () => {
    beforeEach(() => {
        Object.defineProperty(global, '__DEV__', {
            configurable: true,
            value: true,
        });
        mockIsRemoteDataSyncEnabled.mockReturnValue(false);
    });

    afterEach(() => {
        mockIsRemoteDataSyncEnabled.mockReset();
        mockGetSupabaseConfig.mockReset();
        mockEnsureSupabaseSession.mockReset();
    });

    it('does not warn about Supabase setup in local-only mode', async () => {
        const { result } = renderHook(() => useSupabaseSchemaStatus());

        await waitFor(() => {
            expect(result.current.warning).toBeNull();
        });
        expect(result.current.status).toBe('ok');
        expect(mockGetSupabaseConfig).not.toHaveBeenCalled();
        expect(mockEnsureSupabaseSession).not.toHaveBeenCalled();
    });
});
