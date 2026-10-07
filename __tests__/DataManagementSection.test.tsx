import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { DataManagementSection } from '../components/settings/DataManagementSection';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

// DEF-009: Alert.alert is a silent no-op on web, so Drive outcomes must route
// through the web-safe notifier instead.
const mockNotifyUser = jest.fn();
jest.mock('@/components/ui/webConfirm', () => ({
    notifyUser: (title: string, message?: string) => mockNotifyUser(title, message),
}));

const mockBackupNow = jest.fn();
const mockRestoreLatest = jest.fn();
jest.mock('@/hooks/backup/useDriveBackup', () => ({
    useDriveBackup: () => ({
        status: 'ready',
        detail: null,
        remoteFiles: [],
        backupNow: mockBackupNow,
        restoreLatest: mockRestoreLatest,
        refreshRemote: jest.fn(),
    }),
}));

describe('DataManagementSection', () => {
    beforeEach(() => {
        mockNotifyUser.mockClear();
        mockBackupNow.mockReset();
        mockRestoreLatest.mockReset();
    });

    it('shows local backup controls and the latest backup label', () => {
        const { getByText, queryByText } = render(
            <DataManagementSection
                latestBackup={{ id: 'backup-1', name: 'Friday backup', createdAt: 0, itemCount: 2 }}
                isBusy={false}
                onCreateBackup={jest.fn()}
                onRestoreLatestBackup={jest.fn()}
                onExportJournalJson={jest.fn()}
                onClearHistory={jest.fn()}
            />
        );

        expect(getByText('Create local backup')).toBeTruthy();
        expect(getByText('Restore latest backup')).toBeTruthy();
        expect(getByText('Latest: Friday backup')).toBeTruthy();
        // Production default: demo seed controls hidden
        expect(queryByText('Seed demo data')).toBeNull();
        expect(queryByText('Clear demo data')).toBeNull();
    });

    it('shows seed controls only when showDemoSeedControls is true', () => {
        const { getByText } = render(
            <DataManagementSection
                latestBackup={null}
                isBusy={false}
                onCreateBackup={jest.fn()}
                onRestoreLatestBackup={jest.fn()}
                onExportJournalJson={jest.fn()}
                showDemoSeedControls
                onSeedDemoData={jest.fn()}
                onClearDemoData={jest.fn()}
                onClearHistory={jest.fn()}
            />
        );
        expect(getByText('Seed demo data')).toBeTruthy();
        expect(getByText('Clear demo data')).toBeTruthy();
    });

    it('calls the backup actions from the visible controls', () => {
        const onCreateBackup = jest.fn();
        const onRestoreLatestBackup = jest.fn();
        const { getByText } = render(
            <DataManagementSection
                latestBackup={{ id: 'backup-1', name: 'Friday backup', createdAt: 0, itemCount: 2 }}
                isBusy={false}
                onCreateBackup={onCreateBackup}
                onRestoreLatestBackup={onRestoreLatestBackup}
                onExportJournalJson={jest.fn()}
                onClearHistory={jest.fn()}
            />
        );

        fireEvent.press(getByText('Create local backup'));
        fireEvent.press(getByText('Restore latest backup'));

        expect(onCreateBackup).toHaveBeenCalledTimes(1);
        expect(onRestoreLatestBackup).toHaveBeenCalledTimes(1);
    });

    /**
     * DEF-013: the seed row must show real progress instead of looking frozen,
     * and must not accept a second press while it runs.
     */
    it('replaces the seed detail with row progress while seeding', () => {
        const onSeedDemoData = jest.fn();
        const { getByText, queryByText } = render(
            <DataManagementSection
                latestBackup={null}
                isBusy={false}
                onCreateBackup={jest.fn()}
                onRestoreLatestBackup={jest.fn()}
                onExportJournalJson={jest.fn()}
                onClearHistory={jest.fn()}
                showDemoSeedControls
                onSeedDemoData={onSeedDemoData}
                seedProgress={{ completed: 7, total: 25 }}
                isSeeding
            />
        );

        expect(getByText('Seeding… 7/25 rows')).toBeTruthy();
        // The idle description is gone while the seed runs (regex: the row text is long).
        expect(queryByText(/replaces prior seed/)).toBeNull();

        fireEvent.press(getByText('Seed demo data'));
        expect(onSeedDemoData).not.toHaveBeenCalled();
    });

    /**
     * DEF-009 / DEF-011: a Drive backup or restore that silently reported
     * nothing was indistinguishable from success. Both outcomes must reach
     * `notifyUser` (window.alert on web, Alert on native).
     */
    it('routes Drive backup and restore outcomes through the web-safe notifier', async () => {
        mockBackupNow.mockResolvedValue('Backed up 3 atoms + 1 files as drive.json.');
        mockRestoreLatest.mockResolvedValue(null);

        const { getByText } = render(
            <DataManagementSection
                latestBackup={null}
                isBusy={false}
                onCreateBackup={jest.fn()}
                onRestoreLatestBackup={jest.fn()}
                onExportJournalJson={jest.fn()}
                onClearHistory={jest.fn()}
            />
        );

        fireEvent.press(getByText('Back up memory to Google Drive'));
        await waitFor(() => {
            expect(mockNotifyUser).toHaveBeenCalledWith(
                'Drive backup done',
                'Backed up 3 atoms + 1 files as drive.json.',
            );
        });

        fireEvent.press(getByText('Restore memory from Google Drive'));
        await waitFor(() => {
            expect(mockNotifyUser).toHaveBeenCalledWith(
                'Drive restore',
                'Google Drive restore failed.',
            );
        });
    });
});
