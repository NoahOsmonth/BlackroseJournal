import React from 'react';
import { render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { IntentionChatHeader } from '../components/intentions/IntentionChatHeader';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

function classNameFor(node: ReactTestInstance): string {
    const className = node.props.className;
    return typeof className === 'string' ? className : '';
}

describe('IntentionChatHeader', () => {
    it('matches the reference Rosebud selector treatment', () => {
        const { getByLabelText, getByTestId, getByText } = render(
            <IntentionChatHeader
                personaName="Rosebud"
                onOpenPersona={jest.fn()}
                onOpenDrafts={jest.fn()}
                onClose={jest.fn()}
            />
        );

        expect(getByText('Rosebud')).toBeTruthy();
        expect(getByLabelText('Choose persona')).toBeTruthy();
        expect(classNameFor(getByLabelText('Choose persona'))).toContain(
            'bg-gray-100 dark:bg-card-dark'
        );
        expect(classNameFor(getByTestId('intention-chat-persona-badge'))).toContain(
            'bg-persona-rose'
        );
    });
});
