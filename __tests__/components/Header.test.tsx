/* eslint-disable import/first */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { Header } from '../../components/Header';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('../../components/ui/RoseMark', () => ({
    RoseMark: () => null,
}));

jest.mock('../../hooks/settings/useActiveModelContext', () => ({
    useActiveModelContext: () => ({
        context: {
            model: 'a calm AI',
            contextWindow: 32_000,
            source: 'saved',
            providerSource: 'custom',
        },
        error: null,
        isLoading: false,
        refresh: jest.fn(),
    }),
}));

function sourcePressable(view: ReturnType<typeof render>, label: string) {
    const pressableType = (Pressable as unknown as {
        type: React.ComponentType<unknown>;
    }).type;
    return view.UNSAFE_getAllByType(pressableType).find(
        (node) => node.props.accessibilityLabel === label,
    );
}

describe('Header', () => {
    it('wires the AI choice to the journal chat model picker', () => {
        const onModelPress = jest.fn();
        render(
            <Header
                onClose={jest.fn()}
                title="Evening close"
                personaName="Blackrose"
                onPersonaPress={jest.fn()}
                onModelPress={onModelPress}
                showThinking
                onToggleThinking={jest.fn()}
            />,
        );

        expect(screen.getByLabelText(/AI:/i)).toBeTruthy();
        fireEvent.press(screen.getByLabelText(/AI:/i));
        expect(onModelPress).toHaveBeenCalledTimes(1);
    });

    it('does not open the AI choice while the chat is busy', () => {
        const onModelPress = jest.fn();
        const view = render(
            <Header
                onClose={jest.fn()}
                title="Evening close"
                personaName="Blackrose"
                onPersonaPress={jest.fn()}
                onModelPress={onModelPress}
                modelPickerDisabled
            />,
        );

        const model = view.UNSAFE_getAllByType(
            (Pressable as unknown as { type: React.ComponentType<unknown> }).type,
        ).find((node) => String(node.props.accessibilityLabel ?? '').startsWith('AI:'));
        expect(model?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: true }),
        );
        fireEvent.press(screen.getByLabelText(/AI:/i));
        expect(onModelPress).not.toHaveBeenCalled();
    });

    it('keeps the sitting title visible while the persona action uses a generic label', () => {
        render(
            <Header
                onClose={jest.fn()}
                title="Evening close"
                personaName="Blackrose"
                onPersonaPress={jest.fn()}
                onDraftsPress={jest.fn()}
                showThinking={false}
                onToggleThinking={jest.fn()}
            />,
        );

        expect(screen.getByText('Evening close')).toBeTruthy();
        expect(screen.getByLabelText('Choose persona')).toBeTruthy();
        expect(screen.queryByLabelText(/Persona: Blackrose/)).toBeNull();
    });

    it('exposes explicit disabled and checked states on the header controls', () => {
        const draftsView = render(
            <Header
                onClose={jest.fn()}
                personaName="Blackrose"
                onPersonaPress={jest.fn()}
                onDraftsPress={jest.fn()}
            />,
        );

        expect(sourcePressable(draftsView, 'Close chat')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: false }),
        );
        expect(sourcePressable(draftsView, 'Choose persona')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: false }),
        );
        expect(sourcePressable(draftsView, 'Open drafts')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: false }),
        );

        const thinkingView = render(
            <Header
                onClose={jest.fn()}
                personaName="Blackrose"
                onPersonaPress={jest.fn()}
                showThinking={false}
                onToggleThinking={jest.fn()}
            />,
        );
        expect(sourcePressable(thinkingView, 'Show thinking')?.props.accessibilityState).toEqual(
            expect.objectContaining({ checked: false, disabled: false }),
        );
    });
});
