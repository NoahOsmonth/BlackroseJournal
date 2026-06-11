import React from 'react';
import { render, screen } from '@testing-library/react-native';

import IntentionEditScreen from '../../app/intentions/edit';

const mockParams = jest.fn();

jest.mock('expo-router', () => ({
    Redirect: ({ href }: { href: { pathname: string; params?: Record<string, string> } }) => {
        const { Text } = jest.requireActual('react-native');
        return <Text>{`${href.pathname}:${href.params?.mode ?? 'none'}`}</Text>;
    },
    useLocalSearchParams: () => mockParams(),
    useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

jest.mock('../../hooks/intentions/useIntentionEditor', () => ({
    useIntentionEditor: () => ({
        intention: {
            id: 'intent_1',
            title: 'Walk daily',
            description: 'Move every morning',
            area: 'wellbeing',
        },
        values: { title: 'Walk daily', description: 'Move every morning' },
        isLoading: false,
        error: null,
        setValues: jest.fn(),
        save: jest.fn(),
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => {
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
}));

describe('Intention refine routing', () => {
    beforeEach(() => {
        mockParams.mockReturnValue({ id: 'intent_1' });
    });

    it('defaults intention edit links into conversational refine', () => {
        render(<IntentionEditScreen />);

        expect(screen.getByText('/intentions/chat:refine')).toBeTruthy();
    });

    it('keeps the direct edit form only for advanced mode', () => {
        mockParams.mockReturnValue({ id: 'intent_1', advanced: '1' });

        render(<IntentionEditScreen />);

        expect(screen.getByText('Edit intention')).toBeTruthy();
    });
});
