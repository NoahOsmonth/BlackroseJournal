import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { IntentionChatHeader } from '../components/intentions/IntentionChatHeader';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

jest.mock('../hooks/settings/useActiveModelContext', () => ({
    useActiveModelContext: () => ({
        context: {
            model: 'tencent/hy3:free',
            contextWindow: 262_000,
            source: 'api',
            providerSource: 'custom',
        },
        error: null,
        isLoading: false,
        refresh: jest.fn(),
    }),
}));

function classNameFor(node: ReactTestInstance): string {
    const className = node.props.className;
    return typeof className === 'string' ? className : '';
}

describe('IntentionChatHeader', () => {
    it('matches the reference Rosebud selector treatment and model control', () => {
        const onOpenModelPicker = jest.fn();
        const { getByLabelText, getByTestId, getByText } = render(
            <IntentionChatHeader
                personaName="Rosebud"
                onOpenPersona={jest.fn()}
                onOpenDrafts={jest.fn()}
                onClose={jest.fn()}
                onOpenModelPicker={onOpenModelPicker}
            />
        );

        expect(getByText('Rosebud')).toBeTruthy();
        expect(getByText(/262k/i)).toBeTruthy();
        expect(getByText('Free')).toBeTruthy();
        expect(getByLabelText('Choose persona')).toBeTruthy();
        expect(classNameFor(getByLabelText('Choose persona'))).toContain(
            'bg-gray-100 dark:bg-card-dark'
        );
        expect(classNameFor(getByTestId('intention-chat-persona-badge'))).toContain(
            'bg-persona-rose'
        );

        fireEvent.press(getByLabelText(/Model:/i));
        expect(onOpenModelPicker).toHaveBeenCalledTimes(1);
    });
});
