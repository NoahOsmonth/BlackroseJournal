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
    it('renders the Blackrose sitting header with a quiet model control', () => {
        const onOpenModelPicker = jest.fn();
        const { getByLabelText, getByTestId, getByText } = render(
            <IntentionChatHeader
                personaName="Blackrose"
                onOpenPersona={jest.fn()}
                onOpenDrafts={jest.fn()}
                onClose={jest.fn()}
                onOpenModelPicker={onOpenModelPicker}
            />
        );

        expect(getByText('Blackrose')).toBeTruthy();
        expect(getByText(/262k/i)).toBeTruthy();
        expect(getByText('Free')).toBeTruthy();
        expect(getByLabelText('Choose persona')).toBeTruthy();
        // Persona chrome is a text line with a rose mark, not a filled pill.
        expect(classNameFor(getByLabelText('Choose persona'))).toContain('flex-1');
        expect(getByTestId('intention-chat-persona-badge')).toBeTruthy();
        expect(getByText('Drafts')).toBeTruthy();

        fireEvent.press(getByLabelText(/Model:/i));
        expect(onOpenModelPicker).toHaveBeenCalledTimes(1);
    });

    it('keeps the model control on Blackrose hairlines instead of a gray capsule', () => {
        const { getByLabelText } = render(
            <IntentionChatHeader
                personaName="Blackrose"
                onOpenPersona={jest.fn()}
                onOpenDrafts={jest.fn()}
                onClose={jest.fn()}
                onOpenModelPicker={jest.fn()}
            />
        );

        const model = classNameFor(getByLabelText(/Model:/i));
        expect(model).toContain('border-hairline-light');
        expect(model).toContain('dark:border-hairline-dark');
        expect(model).not.toContain('bg-gray-100');
    });
});
