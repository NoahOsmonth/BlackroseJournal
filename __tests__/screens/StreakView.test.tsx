import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import StreakViewScreen from '../../app/streak-view';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        back: mockBack,
    }),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('@/hooks/journal/useJournalEntries', () => ({
    useJournalEntries: () => ({
        completed: [
            { id: 'entry-1', createdAt: new Date('2026-01-23T10:00:00Z').toISOString() },
            { id: 'entry-2', createdAt: new Date('2026-01-22T10:00:00Z').toISOString() },
        ],
    }),
}));

jest.mock('@/hooks/intentions/useIntentionCheckIns', () => ({
    useIntentionCheckIns: () => ({
        completed: [
            { id: 'checkin-1', createdAt: new Date('2026-01-21T10:00:00Z').toISOString() },
        ],
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

describe('StreakViewScreen', () => {
    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-23T12:00:00Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it('renders streak summary and calendar month', () => {
        render(<StreakViewScreen />);

        expect(screen.getByText('Streak')).toBeTruthy();
        expect(screen.getByText('Current streak')).toBeTruthy();
        expect(screen.getByText(/Total days with check-ins: 3/)).toBeTruthy();
        expect(screen.getByText('January 2026')).toBeTruthy();
    });

    it('opens rewards from header action', () => {
        render(<StreakViewScreen />);

        fireEvent.press(screen.getByLabelText('Open rewards'));

        expect(mockPush).toHaveBeenCalledWith('/rewards');
    });
});
