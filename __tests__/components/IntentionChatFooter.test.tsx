import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { IntentionChatFooter } from '../../components/intentions/IntentionChatFooter';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

describe('IntentionChatFooter', () => {
    it('renders the volume toggle and the shared action buttons', () => {
        render(
            <IntentionChatFooter
                isMuted={false}
                onToggleMuted={jest.fn()}
                onGoDeeper={jest.fn()}
                onFinishEntry={jest.fn()}
                canGoDeeper
                canFinish
            />
        );

        expect(screen.getByLabelText('Toggle volume')).toBeTruthy();
        expect(screen.getByText('Go deeper')).toBeTruthy();
        expect(screen.getByText('Finish entry')).toBeTruthy();
    });

    it('fires onGoDeeper and onFinishEntry from the action buttons', () => {
        const onGoDeeper = jest.fn();
        const onFinishEntry = jest.fn();

        render(
            <IntentionChatFooter
                isMuted={false}
                onToggleMuted={jest.fn()}
                onGoDeeper={onGoDeeper}
                onFinishEntry={onFinishEntry}
                canGoDeeper
                canFinish
            />
        );

        fireEvent.press(screen.getByText('Go deeper'));
        fireEvent.press(screen.getByText('Finish entry'));

        expect(onGoDeeper).toHaveBeenCalledTimes(1);
        expect(onFinishEntry).toHaveBeenCalledTimes(1);
    });

    it('toggles the muted icon name when isMuted flips', () => {
        const { rerender } = render(
            <IntentionChatFooter
                isMuted={false}
                onToggleMuted={jest.fn()}
                onGoDeeper={jest.fn()}
                onFinishEntry={jest.fn()}
            />
        );
        expect(screen.getByText('volume-up')).toBeTruthy();

        rerender(
            <IntentionChatFooter
                isMuted
                onToggleMuted={jest.fn()}
                onGoDeeper={jest.fn()}
                onFinishEntry={jest.fn()}
            />
        );
        expect(screen.getByText('volume-off')).toBeTruthy();
    });
});
