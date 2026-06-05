/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@/services/backup/localBackup', () => ({
    createLocalBackup: jest.fn(),
    listLocalBackups: jest.fn(),
    restoreLocalBackup: jest.fn(),
}));

import {
    createLocalBackup,
    listLocalBackups,
    restoreLocalBackup,
} from '@/services/backup/localBackup';
import { useLocalBackups } from '../hooks/backup/useLocalBackups';

const mockCreateLocalBackup = jest.mocked(createLocalBackup);
const mockListLocalBackups = jest.mocked(listLocalBackups);
const mockRestoreLocalBackup = jest.mocked(restoreLocalBackup);

describe('useLocalBackups', () => {
    beforeEach(() => {
        mockCreateLocalBackup.mockResolvedValue({
            id: 'backup-2',
            name: 'New backup',
            createdAt: 2,
            itemCount: 1,
        });
        mockListLocalBackups.mockResolvedValue([
            { id: 'backup-1', name: 'Existing backup', createdAt: 1, itemCount: 1 },
        ]);
        mockRestoreLocalBackup.mockResolvedValue({ status: 'restored', restoredKeys: 1 });
    });

    afterEach(() => {
        mockCreateLocalBackup.mockReset();
        mockListLocalBackups.mockReset();
        mockRestoreLocalBackup.mockReset();
    });

    it('loads the latest local backup on mount', async () => {
        const { result } = renderHook(() => useLocalBackups());

        await waitFor(() => {
            expect(result.current.latestBackup?.name).toBe('Existing backup');
        });
    });

    it('creates a backup and refreshes the local backup list', async () => {
        const { result } = renderHook(() => useLocalBackups());
        await waitFor(() => {
            expect(result.current.latestBackup?.name).toBe('Existing backup');
        });

        await act(async () => {
            await result.current.createBackup();
        });

        expect(mockCreateLocalBackup).toHaveBeenCalledWith();
        expect(mockListLocalBackups).toHaveBeenCalledTimes(2);
    });
});
