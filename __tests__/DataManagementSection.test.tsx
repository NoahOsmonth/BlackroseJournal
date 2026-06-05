import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { DataManagementSection } from '../components/settings/DataManagementSection';

jest.mock('@expo/vector-icons', () => ({
    Ionicons: () => null,
}));

describe('DataManagementSection', () => {
    it('shows local backup controls and the latest backup label', () => {
        const { getByText } = render(
            <DataManagementSection
                latestBackup={{ id: 'backup-1', name: 'Friday backup', createdAt: 0, itemCount: 2 }}
                isBusy={false}
                onCreateBackup={jest.fn()}
                onRestoreLatestBackup={jest.fn()}
                onExportJournalJson={jest.fn()}
                onClearJournalEntries={jest.fn()}
            />
        );

        expect(getByText('Create Local Backup')).toBeTruthy();
        expect(getByText('Restore Latest Backup')).toBeTruthy();
        expect(getByText('Latest: Friday backup')).toBeTruthy();
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
                onClearJournalEntries={jest.fn()}
            />
        );

        fireEvent.press(getByText('Create Local Backup'));
        fireEvent.press(getByText('Restore Latest Backup'));

        expect(onCreateBackup).toHaveBeenCalledTimes(1);
        expect(onRestoreLatestBackup).toHaveBeenCalledTimes(1);
    });
});
