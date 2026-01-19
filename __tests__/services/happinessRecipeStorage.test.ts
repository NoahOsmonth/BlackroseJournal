/**
 * Happiness Recipe Storage Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    addRecipeItem,
    clearAllRecipeItems,
    deleteRecipeItem,
    loadRecipeItems,
    toggleRecipeItemCompletion,
    updateRecipeItem,
} from '../../services/happinessRecipeStorage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
}));

describe('happinessRecipeStorage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    });

    describe('loadRecipeItems', () => {
        it('returns empty array when no items stored', async () => {
            const items = await loadRecipeItems();
            expect(items).toEqual([]);
        });

        it('returns stored items', async () => {
            const mockItems = [
                { id: '1', type: 'ingredient', text: 'Test', completed: false, createdAt: '', updatedAt: '' },
            ];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify({ items: mockItems })
            );

            const items = await loadRecipeItems();
            expect(items).toEqual(mockItems);
        });
    });

    describe('addRecipeItem', () => {
        it('adds a new ingredient', async () => {
            const item = await addRecipeItem('ingredient', 'Exercise');

            expect(item.type).toBe('ingredient');
            expect(item.text).toBe('Exercise');
            expect(item.completed).toBe(false);
            expect(item.id).toBeTruthy();
            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });

        it('adds a new goal', async () => {
            const item = await addRecipeItem('goal', 'Learn guitar');

            expect(item.type).toBe('goal');
            expect(item.text).toBe('Learn guitar');
        });

        it('adds a new habit', async () => {
            const item = await addRecipeItem('habit', 'Take a short walk');

            expect(item.type).toBe('habit');
            expect(item.text).toBe('Take a short walk');
            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });

        it('dedupes habits with case-insensitive match', async () => {
            const existing = [
                {
                    id: 'habit-1',
                    type: 'habit',
                    text: 'Take a short walk',
                    completed: false,
                    createdAt: '',
                    updatedAt: '',
                },
            ];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify({ items: existing })
            );

            const item = await addRecipeItem('habit', '  take   a SHORT walk  ');

            expect(item.id).toBe('habit-1');
            expect(item.type).toBe('habit');
            expect(AsyncStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('updateRecipeItem', () => {
        it('updates item text', async () => {
            const mockItems = [
                { id: '1', type: 'ingredient', text: 'Old text', completed: false, createdAt: '', updatedAt: '' },
            ];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify({ items: mockItems })
            );

            const updated = await updateRecipeItem('1', { text: 'New text' });

            expect(updated?.text).toBe('New text');
            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });

        it('returns null for non-existent item', async () => {
            const updated = await updateRecipeItem('nonexistent', { text: 'Test' });
            expect(updated).toBeNull();
        });

        it('sets completedAt when marking as completed', async () => {
            const mockItems = [
                { id: '1', type: 'ingredient', text: 'Test', completed: false, createdAt: '', updatedAt: '' },
            ];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify({ items: mockItems })
            );

            const updated = await updateRecipeItem('1', { completed: true });

            expect(updated?.completed).toBe(true);
            expect(updated?.completedAt).toBeTruthy();
        });
    });

    describe('deleteRecipeItem', () => {
        it('deletes an existing item', async () => {
            const mockItems = [
                { id: '1', type: 'ingredient', text: 'Test', completed: false, createdAt: '', updatedAt: '' },
            ];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify({ items: mockItems })
            );

            const success = await deleteRecipeItem('1');

            expect(success).toBe(true);
            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });

        it('returns false for non-existent item', async () => {
            const success = await deleteRecipeItem('nonexistent');
            expect(success).toBe(false);
        });
    });

    describe('toggleRecipeItemCompletion', () => {
        it('toggles completion status', async () => {
            const mockItems = [
                { id: '1', type: 'ingredient', text: 'Test', completed: false, createdAt: '', updatedAt: '' },
            ];
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify({ items: mockItems })
            );

            const updated = await toggleRecipeItemCompletion('1');

            expect(updated?.completed).toBe(true);
        });
    });

    describe('clearAllRecipeItems', () => {
        it('removes storage key', async () => {
            await clearAllRecipeItems();
            expect(AsyncStorage.removeItem).toHaveBeenCalled();
        });
    });
});
