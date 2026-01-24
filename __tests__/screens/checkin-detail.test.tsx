import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import CheckInDetailScreen from '../../app/checkin-detail';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: mockBack,
        push: jest.fn(),
        replace: jest.fn(),
    }),
    useLocalSearchParams: () => ({ id: 'checkin-1' }),
}));

jest.mock('@/services/intentions/intentionsStorage', () => ({
    getCheckIn: jest.fn(() =>
        Promise.resolve({
            id: 'checkin-1',
            type: 'morning',
            title: 'Morning focus',
            summary: 'Be present.',
            mood: 'Reflective',
            status: 'completed',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [
                {
                    id: 'msg-1',
                    role: 'assistant',
                    content: 'Hello there',
                    timestamp: Date.now(),
                },
                {
                    id: 'msg-2',
                    role: 'user',
                    content: 'Hi',
                    timestamp: Date.now(),
                },
            ],
        })
    ),
}));

jest.mock('@/components/ChatMessage', () => ({
    ChatMessage: ({ text }: { text: string }) => <>{text}</>,
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('CheckInDetailScreen', () => {
    it('renders check-in details', async () => {
        render(<CheckInDetailScreen />);

        await waitFor(() => {
            expect(screen.getByText('Morning focus')).toBeTruthy();
        });

        expect(screen.getByText('Be present.')).toBeTruthy();
    });
});
