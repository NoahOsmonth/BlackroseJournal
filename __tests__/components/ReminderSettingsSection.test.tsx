import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ReminderSettingsSection } from '@/components/settings/ReminderSettingsSection';
import { DEFAULT_REMINDER_SETTINGS } from '@/utils/reminders';

const mockUpdate = jest.fn();
let mockSettings = DEFAULT_REMINDER_SETTINGS;

jest.mock('@/hooks/settings/useReminders', () => ({
    useReminders: () => ({ settings: mockSettings, isLoading: false, plannedCount: 0, update: mockUpdate }),
}));

describe('ReminderSettingsSection', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
        mockSettings = DEFAULT_REMINDER_SETTINGS;
    });

    it('starts off and says so', () => {
        const { getAllByText, getByText } = render(<ReminderSettingsSection />);
        expect(getAllByText('Off').length).toBeGreaterThanOrEqual(3);
    });

    it('turns the morning nudge on', () => {
        const { getByLabelText } = render(<ReminderSettingsSection />);
        fireEvent.press(getByLabelText(/Morning nudge/));
        expect(mockUpdate).toHaveBeenCalledWith({ morningEnabled: true });
    });

    it('hides the hour choices until the nudge is on', () => {
        const { queryByLabelText } = render(<ReminderSettingsSection />);
        expect(queryByLabelText('Morning at 8:00 AM')).toBeNull();
    });

    it('offers hour choices once the nudge is on', () => {
        mockSettings = { ...DEFAULT_REMINDER_SETTINGS, morningEnabled: true };
        const { getByLabelText, getByText } = render(<ReminderSettingsSection />);
        expect(getByText('Morning at 8:00 AM')).toBeTruthy();
        expect(getByLabelText('Morning at 7:00 AM')).toBeTruthy();
    });

    it('changes the hour', () => {
        mockSettings = { ...DEFAULT_REMINDER_SETTINGS, morningEnabled: true };
        const { getByLabelText } = render(<ReminderSettingsSection />);
        fireEvent.press(getByLabelText('Morning at 7:00 AM'));
        expect(mockUpdate).toHaveBeenCalledWith({ morning: { hour: 7, minute: 0 } });
    });

    it('updates the summary when both are on', () => {
        mockSettings = {
            ...DEFAULT_REMINDER_SETTINGS,
            morningEnabled: true,
            eveningEnabled: true,
        };
        const { getByText } = render(<ReminderSettingsSection />);
        expect(getByText('Morning at 8:00 AM · evening at 9:00 PM')).toBeTruthy();
    });

    it('toggles the skip rule', () => {
        const { getByLabelText } = render(<ReminderSettingsSection />);
        fireEvent.press(getByLabelText(/Skip if I already wrote/));
        expect(mockUpdate).toHaveBeenCalledWith({ skipWhenAlreadyWritten: false });
    });
});
