import { fireEvent, render, screen } from '@testing-library/react-native';

import StreakHaikuScreen from '@/app/streak-haiku';

const mockUseLocalSearchParams = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        replace: mockRouterReplace,
        push: jest.fn(),
        back: jest.fn(),
    }),
    useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

const mockUseStreakHaiku = jest.fn();

jest.mock('@/hooks/useStreakHaiku', () => ({
    useStreakHaiku: (entryId?: string) => mockUseStreakHaiku(entryId),
}));

describe('StreakHaikuScreen', () => {
    beforeEach(() => {
        mockRouterReplace.mockClear();
        mockUseLocalSearchParams.mockReturnValue({ entryId: 'entry-1' });
        mockUseStreakHaiku.mockReturnValue({
            streakCount: 1,
            lines: ['First line', 'Second line', 'Third line'],
            isLoading: false,
            error: null,
            refresh: jest.fn(),
        });
    });

    it('renders streak count and haiku lines', () => {
        render(<StreakHaikuScreen />);

        expect(screen.getByText('1')).toBeTruthy();
        expect(screen.getByText('DAY STREAK')).toBeTruthy();
        expect(screen.getByText(/First line/)).toBeTruthy();
        expect(screen.getByText(/Second line/)).toBeTruthy();
        expect(screen.getByText(/Third line/)).toBeTruthy();
        expect(screen.getByText('Continue')).toBeTruthy();
    });

    it('close exits back to Today', () => {
        render(<StreakHaikuScreen />);

        fireEvent.press(screen.getByLabelText('Close'));
        expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/today');
    });

    it('continue exits back to Today', () => {
        render(<StreakHaikuScreen />);

        fireEvent.press(screen.getByText('Continue'));
        expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/today');
    });
});
