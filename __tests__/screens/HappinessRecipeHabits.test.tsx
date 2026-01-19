import { render, screen } from '@testing-library/react-native';

import HappinessRecipeScreen from '@/app/happiness-recipe';

jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: jest.fn(),
        push: jest.fn(),
        replace: jest.fn(),
    }),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

const mockUseHappinessRecipe = jest.fn();

jest.mock('@/hooks/useHappinessRecipe', () => ({
    useHappinessRecipe: () => mockUseHappinessRecipe(),
}));

describe('HappinessRecipeScreen habits section', () => {
    beforeEach(() => {
        mockUseHappinessRecipe.mockReturnValue({
            items: [
                {
                    id: 'ingredient-1',
                    type: 'ingredient',
                    text: 'Sunlight',
                    completed: false,
                    createdAt: '',
                    updatedAt: '',
                },
                {
                    id: 'habit-1',
                    type: 'habit',
                    text: 'Take a short walk',
                    completed: false,
                    createdAt: '',
                    updatedAt: '',
                },
                {
                    id: 'goal-1',
                    type: 'goal',
                    text: 'Sleep 8 hours',
                    completed: false,
                    createdAt: '',
                    updatedAt: '',
                },
            ],
            isLoading: false,
            addItem: jest.fn(),
            updateItem: jest.fn(),
            toggleItem: jest.fn(),
            deleteItem: jest.fn(),
            activeItems: [],
            completedItems: [],
            refresh: jest.fn(),
        });
    });

    it('renders Habits section below Ingredients', () => {
        const { toJSON } = render(<HappinessRecipeScreen />);

        expect(screen.getByText('Ingredients')).toBeTruthy();
        expect(screen.getByText('Habits')).toBeTruthy();
        expect(screen.getByText('Goals')).toBeTruthy();
        expect(screen.getByText('🌿 Take a short walk')).toBeTruthy();

        const tree = JSON.stringify(toJSON());
        expect(tree.indexOf('Ingredients')).toBeLessThan(tree.indexOf('Habits'));
        expect(tree.indexOf('Habits')).toBeLessThan(tree.indexOf('Goals'));
    });
});
