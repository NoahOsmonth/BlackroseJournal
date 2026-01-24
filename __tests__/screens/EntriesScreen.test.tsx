import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import EntriesScreen from '../../app/(tabs)/entries';

const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        navigate: mockNavigate,
        back: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('@/hooks/history/useHistoryFeed', () => ({
    useHistoryFeed: () => ({
        sections: [
            {
                dateKey: '2026-01-23',
                label: 'Today January 23',
                items: [
                    {
                        id: 'journal-1',
                        type: 'journal',
                        title: 'Test Entry',
                        summary: 'Summary',
                        createdAt: Date.now(),
                        sourceId: '1',
                    },
                    {
                        id: 'checkin-1',
                        type: 'checkin',
                        title: 'Morning focus',
                        summary: 'Check-in summary',
                        createdAt: Date.now(),
                        sourceId: 'checkin-1',
                    },
                ],
            },
        ],
    }),
}));

jest.mock('@/hooks/journal/useJournalEntries', () => ({
    useJournalEntries: () => ({
        drafts: [],
    }),
}));

jest.mock('@/hooks/intentions/useIntentionCheckIns', () => ({
    useIntentionCheckIns: () => ({
        drafts: [],
    }),
}));

jest.mock('@/hooks/navigation/useTabNavigation', () => ({
    useTabNavigation: () => ({
        goToTab: jest.fn(),
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('EntriesScreen (History)', () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockNavigate.mockClear();
    });

    it('renders history sections', () => {
        render(<EntriesScreen />);

        expect(screen.getByText('This week')).toBeTruthy();
        expect(screen.getByText('Today January 23')).toBeTruthy();
        expect(screen.getByText('Test Entry')).toBeTruthy();
    });

    it('opens entry detail when a history item is pressed', () => {
        render(<EntriesScreen />);

        fireEvent.press(screen.getByText('Test Entry'));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/entry-detail',
            params: { id: '1' },
        });
    });

    it('opens check-in detail when check-in has no intention', () => {
        render(<EntriesScreen />);

        fireEvent.press(screen.getByText('Morning focus'));

        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/checkin-detail',
            params: { id: 'checkin-1' },
        });
    });
});
