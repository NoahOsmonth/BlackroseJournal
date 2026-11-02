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

const hy3 = {
    id: 'tencent/hy3:free',
    name: 'Hy3 free',
    contextWindow: 262000,
    contextWindowSource: 'api' as const,
};

const gpt4 = {
    id: 'openai/gpt-4',
    name: 'GPT-4',
    contextWindow: 8192,
    contextWindowSource: 'api' as const,
};

describe('ChatModelPickerSheet', () => {
    it('lists the endpoint catalogue and selects a model', () => {
        const onSelect = jest.fn();
        render(
            <ChatModelPickerSheet
                visible
                models={[hy3, gpt4]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey
                onSelect={onSelect}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByText('Choose AI')).toBeTruthy();
        expect(screen.getByText('api.example.com')).toBeTruthy();
        expect(screen.getByText('All AI')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Select Hy3 free'));
        expect(onSelect).toHaveBeenCalledWith('tencent/hy3:free');
    });

    it('marks the list as narrowed when the profile has filter patterns', () => {
        render(
            <ChatModelPickerSheet
                visible
                models={[hy3]}
                selectedId={null}
                hostLabel="api.example.com"
                filterPatterns={[':free']}
                hasApiKey
                onSelect={jest.fn()}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByLabelText('Filtered by :free')).toBeTruthy();
        expect(screen.getByText(':free')).toBeTruthy();
    });

    it('shows no filter pill when the profile has no patterns', () => {
        render(
            <ChatModelPickerSheet
                visible
                models={[hy3, gpt4]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey
                onSelect={jest.fn()}
                onClose={jest.fn()}
            />
        );

        expect(screen.queryByText(':free')).toBeNull();
    });

    it('splits recents out of the full catalogue', () => {
        render(
            <ChatModelPickerSheet
                visible
                models={[hy3, gpt4]}
                recentModels={[hy3]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey
                onSelect={jest.fn()}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByText('Recent')).toBeTruthy();
        expect(screen.getByText('All AI')).toBeTruthy();
        // The recent model is not repeated in the full list.
        expect(screen.getAllByLabelText('Select Hy3 free')).toHaveLength(1);
    });

    it('shows the empty state with a fetch CTA when no models are cached', () => {
        const onRefresh = jest.fn();
        render(
            <ChatModelPickerSheet
                visible
                models={[]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey
                onSelect={jest.fn()}
                onRefresh={onRefresh}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByText('No AI options yet')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Find AI options'));
        expect(onRefresh).toHaveBeenCalled();
    });

    it('shows skeletons while the first fetch is in flight', () => {
        render(
            <ChatModelPickerSheet
                visible
                models={[]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey
                isLoading
                onSelect={jest.fn()}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByLabelText('Loading AI options')).toBeTruthy();
        expect(screen.queryByText('No AI options yet')).toBeNull();
    });

    it('prompts for an API key instead of listing an unreachable endpoint', () => {
        render(
            <ChatModelPickerSheet
                visible
                models={[]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey={false}
                onSelect={jest.fn()}
                onClose={jest.fn()}
                onOpenSettings={jest.fn()}
            />
        );

        expect(screen.getByText('Add your access key')).toBeTruthy();
        expect(screen.getByText('Add your service address and access key in Settings to see the AI options.')).toBeTruthy();
        expect(screen.getByText('Open AI settings')).toBeTruthy();
        expect(screen.queryByText('No AI options yet')).toBeNull();
    });

    it('surfaces a fetch error above the list', () => {
        render(
            <ChatModelPickerSheet
                visible
                models={[]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey
                error="No AI options matched your filter words. Change them in Settings."
                onSelect={jest.fn()}
                onClose={jest.fn()}
            />
        );

        expect(screen.getByText('No AI options matched your filter words. Change them in Settings.')).toBeTruthy();
    });

    it('filters by search and offers a way back out', () => {
        render(
            <ChatModelPickerSheet
                visible
                models={[hy3, gpt4]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey
                onSelect={jest.fn()}
                onClose={jest.fn()}
            />
        );

        fireEvent.changeText(screen.getByLabelText('Search AI'), 'gpt');
        expect(screen.getByLabelText('Select GPT-4')).toBeTruthy();
        expect(screen.queryByLabelText('Select Hy3 free')).toBeNull();

        fireEvent.changeText(screen.getByLabelText('Search AI'), 'nothing-matches');
        expect(screen.getByText(/No AI options match/)).toBeTruthy();
        fireEvent.press(screen.getByText('Clear search'));
        expect(screen.getByLabelText('Select GPT-4')).toBeTruthy();
    });

    it('closes from the footer and the scrim', () => {
        const onClose = jest.fn();
        render(
            <ChatModelPickerSheet
                visible
                models={[hy3]}
                selectedId={null}
                hostLabel="api.example.com"
                hasApiKey
                onSelect={jest.fn()}
                onClose={onClose}
            />
        );

        fireEvent.press(screen.getByLabelText('Close AI picker'));
        fireEvent.press(screen.getByLabelText('Dismiss AI picker'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
