import { fireEvent, render, screen } from '@testing-library/react-native';

import SuggestionsScreen from '@/app/suggestions';

const mockUseLocalSearchParams = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: mockRouterBack,
        push: jest.fn(),
        replace: jest.fn(),
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

const mockAddItem = jest.fn();
const mockUseHappinessRecipe = jest.fn();

jest.mock('@/hooks/useHappinessRecipe', () => ({
    useHappinessRecipe: () => mockUseHappinessRecipe(),
}));

describe('SuggestionsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseLocalSearchParams.mockReturnValue({ entryId: 'entry-1' });

        mockUseEntryReflection.mockReturnValue({
            data: {
                reflection: 'x',
                keyInsight: 'y',
                suggestions: [
                    { type: 'HABIT', text: 'Take a short walk' },
                    { type: 'HABIT', text: 'Drink a glass of water' },
                ],
            },
            isLoading: false,
            error: null,
        });

        mockUseHappinessRecipe.mockReturnValue({
            items: [
                {
                    id: 'habit-1',
                    type: 'habit',
                    text: 'take a short walk',
                    completed: false,
                    createdAt: '',
                    updatedAt: '',
                },
            ],
            addItem: mockAddItem,
        });

        mockAddItem.mockResolvedValue({
            id: 'habit-2',
            type: 'habit',
            text: 'Drink a glass of water',
            completed: false,
            createdAt: '',
            updatedAt: '',
        });
    });

    it('renders HABIT suggestions', () => {
        render(<SuggestionsScreen />);

        expect(screen.getByText('Suggestions')).toBeTruthy();
        expect(screen.getAllByText('HABIT').length).toBe(2);
        expect(screen.getByText('Take a short walk')).toBeTruthy();
        expect(screen.getByText('Drink a glass of water')).toBeTruthy();
    });

    it('disables Add button when already added', () => {
        render(<SuggestionsScreen />);

        expect(screen.getByText('Added')).toBeTruthy();
    });

    it('adds a habit when tapping Add to list', () => {
        render(<SuggestionsScreen />);

        fireEvent.press(screen.getByText('Add to list'));
        expect(mockAddItem).toHaveBeenCalledWith('habit', 'Drink a glass of water');
    });
});
