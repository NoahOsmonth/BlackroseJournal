import { fireEvent, render, screen } from '@testing-library/react-native';

import EntryReflectionScreen from '@/app/entry-reflection';

const mockUseLocalSearchParams = jest.fn();
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockRouterPush,
        replace: mockRouterReplace,
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

const mockUseEntryReflection = jest.fn();

jest.mock('@/hooks/useEntryReflection', () => ({
    useEntryReflection: (entryId?: string) => mockUseEntryReflection(entryId),
}));

describe('EntryReflectionScreen', () => {
    beforeEach(() => {
        mockRouterPush.mockClear();
        mockRouterReplace.mockClear();
        mockUseLocalSearchParams.mockReturnValue({ entryId: 'entry-1' });
        mockUseEntryReflection.mockReturnValue({
            data: {
                reflection: 'You navigated a tough day with honesty.',
                keyInsight: 'Naming the feeling made it lighter.',
                suggestions: [
                    { type: 'HABIT', text: 'Take a short walk' },
                    { type: 'HABIT', text: 'Write one gratitude' },
                ],
            },
            isLoading: false,
            error: null,
        });
    });

    it('renders reflection, key insight, and suggestions CTA', () => {
        render(<EntryReflectionScreen />);

        expect(screen.getByText('Entry Reflection')).toBeTruthy();
        expect(screen.getByText('You navigated a tough day with honesty.')).toBeTruthy();
        expect(screen.getByText('Key Insight')).toBeTruthy();
        expect(screen.getByText('Naming the feeling made it lighter.')).toBeTruthy();
        expect(screen.getByText('Suggestions')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.getByText('Continue')).toBeTruthy();
    });

    it('navigates to Suggestions when tapping suggestions row', () => {
        render(<EntryReflectionScreen />);

        fireEvent.press(screen.getByText('Suggestions'));
        expect(mockRouterPush).toHaveBeenCalledWith({ pathname: '/suggestions', params: { entryId: 'entry-1' } });
    });

    it('navigates to streak haiku when pressing Continue', () => {
        render(<EntryReflectionScreen />);

        fireEvent.press(screen.getByText('Continue'));
        expect(mockRouterPush).toHaveBeenCalledWith({ pathname: '/streak-haiku', params: { entryId: 'entry-1' } });
    });
});
