/* eslint-disable import/first */

const mockPush = jest.fn();
const mockMarkSeen = jest.fn(async () => undefined);

let mockState: {
    records: unknown[];
    unseenCount: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    markSeen: () => Promise<void>;
    clear: () => Promise<void>;
} = {
    records: [],
    unseenCount: 0,
    isLoading: false,
    error: null,
    refresh: async () => undefined,
    markSeen: mockMarkSeen,
    clear: async () => undefined,
};

jest.mock('@/hooks/crash/useCrashLogs', () => ({
    useCrashLogs: () => mockState,
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => ({
    __esModule: true,
    default: () => null,
}));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CrashReportBanner } from '../../components/system/CrashReportBanner';

function setState(next: Partial<typeof mockState>) {
    mockState = { ...mockState, ...next };
}

describe('CrashReportBanner', () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockMarkSeen.mockClear();
        setState({ records: [], unseenCount: 0 });
    });

    it('stays hidden when every crash has already been opened', () => {
        render(<CrashReportBanner />);

        expect(screen.queryByLabelText('View crash logs')).toBeNull();
    });

    it('names a single unseen crash', () => {
        setState({ records: [{ id: 'a' }], unseenCount: 1 });

        render(<CrashReportBanner />);

        expect(screen.getByText('The app closed unexpectedly')).toBeTruthy();
        expect(screen.getByText('1 crash log is ready to copy')).toBeTruthy();
    });

    it('counts every stored crash once more than one is waiting', () => {
        setState({ records: [{ id: 'a' }, { id: 'b' }], unseenCount: 2 });

        render(<CrashReportBanner />);

        expect(screen.getByText('2 crash logs are ready to copy')).toBeTruthy();
    });

    it('opens the crash log screen', () => {
        setState({ records: [{ id: 'a' }], unseenCount: 1 });

        render(<CrashReportBanner />);
        fireEvent.press(screen.getByLabelText('View crash logs'));

        expect(mockPush).toHaveBeenCalledWith('/crash-logs');
    });

    it('dismisses without opening the screen', () => {
        setState({ records: [{ id: 'a' }], unseenCount: 1 });

        render(<CrashReportBanner />);
        fireEvent.press(screen.getByLabelText('Dismiss crash notice'));

        expect(mockMarkSeen).toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });
});
