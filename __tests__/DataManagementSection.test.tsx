import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { DataManagementSection } from '../components/settings/DataManagementSection';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('DataManagementSection', () => {
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
});
