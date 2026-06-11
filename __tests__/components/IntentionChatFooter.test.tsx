import React from 'react';
import { render, screen } from '@testing-library/react-native';

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
    it('keeps implemented controls and hides dead voice/image affordances', () => {
        render(
            <IntentionChatFooter
                isMuted={false}
                onToggleMuted={jest.fn()}
                onFinish={jest.fn()}
                onSuggest={jest.fn()}
            />
        );

        expect(screen.queryByLabelText('Voice input')).toBeNull();
        expect(screen.queryByLabelText('Add image')).toBeNull();
        expect(screen.getByLabelText('Toggle volume')).toBeTruthy();
        expect(screen.getByText('Finish entry')).toBeTruthy();
        expect(screen.getByText('Suggest')).toBeTruthy();
    });
});
