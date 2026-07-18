import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChatModelPickerSheet } from '../../components/ai/ChatModelPickerSheet';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

const freeModel = {
    id: 'tencent/hy3:free',
    name: 'Hy3 free',
    contextWindow: 262000,
    contextWindowSource: 'api' as const,
};

describe('ChatModelPickerSheet', () => {
    it('lists free models and selects one', () => {
        const onSelect = jest.fn();
        render(
            <ChatModelPickerSheet
                visible
                models={[freeModel]}
                selectedId={null}
                freeOnly
                hostLabel="openrouter.ai"
                hasApiKey
                onSelect={onSelect}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByText('Choose model')).toBeTruthy();
        expect(screen.getByText('Free only')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Select Hy3 free'));
        expect(onSelect).toHaveBeenCalledWith('tencent/hy3:free');
    });

    it('shows empty state with fetch CTA when no models', () => {
        const onRefresh = jest.fn();
        render(
            <ChatModelPickerSheet
                visible
                models={[]}
                selectedId={null}
                freeOnly
                hostLabel="openrouter.ai"
                hasApiKey
                onSelect={jest.fn()}
                onRefresh={onRefresh}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByText(/No models loaded/i)).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Fetch free models'));
        expect(onRefresh).toHaveBeenCalled();
    });

    it('prompts for API key when missing', () => {
        render(
            <ChatModelPickerSheet
                visible
                models={[]}
                selectedId={null}
                freeOnly
                hostLabel="openrouter.ai"
                hasApiKey={false}
                onSelect={jest.fn()}
                onClose={jest.fn()}
                onOpenSettings={jest.fn()}
            />
        );

        expect(screen.getByText(/Add an API key/i)).toBeTruthy();
        expect(screen.getByText(/Open AI settings/i)).toBeTruthy();
    });
});
