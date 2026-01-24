import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import IntentionEditScreen from '../../app/intentions/edit';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: mockBack,
        push: jest.fn(),
    }),
    useLocalSearchParams: () => ({ id: 'intention-1' }),
}));

const mockSave = jest.fn(() => Promise.resolve(null));
const mockSetValues = jest.fn();

jest.mock('@/hooks/intentions/useIntentionEditor', () => ({
    useIntentionEditor: () => ({
        intention: {
            id: 'intention-1',
            title: 'Focus',
            description: 'Focus description',
            area: 'wellbeing',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        values: { title: 'Focus', description: 'Focus description' },
        isLoading: false,
        error: null,
        setValues: mockSetValues,
        save: mockSave,
    }),
}));

jest.mock('@/constants/intentions', () => ({
    getIntentionAreaConfig: () => ({ label: 'Wellbeing' }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('IntentionEditScreen', () => {
    it('renders and saves', async () => {
        render(<IntentionEditScreen />);

        expect(screen.getByText('Edit intention')).toBeTruthy();

        fireEvent.press(screen.getByText('Save'));

        expect(mockSave).toHaveBeenCalled();
    });
});
