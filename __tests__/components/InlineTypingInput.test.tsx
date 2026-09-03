/* eslint-disable import/first */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text, View } = require('react-native');
    const base = mockReanimated();
    return {
        ...base,
        Animated: { ...base.default, View, Text },
        FadeIn: { duration: () => ({}) },
    };
});

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

jest.mock('../../hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({
        colorTheme: {
            colors: {
                chatUserTextDark: '#FFFFFF',
                chatUserTextLight: '#111827',
                secondaryTextDark: '#9CA3AF',
                secondaryTextLight: '#6B7280',
                accentDark: '#38BDF8',
                accentLight: '#0EA5E9',
            },
        },
    }),
}));

import { InlineTypingInput } from '../../components/InlineTypingInput';

describe('InlineTypingInput', () => {
    it('submits trimmed text and clears the input', () => {
        const onSubmit = jest.fn();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        render(<InlineTypingInput onSubmit={onSubmit} />);

        const input = screen.getByPlaceholderText('Type your thoughts...');
        fireEvent.changeText(input, '  hello journal  ');
        fireEvent(input, 'submitEditing');

        expect(onSubmit).toHaveBeenCalledWith('hello journal');
        expect(input.props.value).toBe('');
        expect(warnSpy).not.toHaveBeenCalled();

        warnSpy.mockRestore();
    });

    it('does not submit empty or whitespace-only input', () => {
        const onSubmit = jest.fn();

        render(<InlineTypingInput onSubmit={onSubmit} />);

        const input = screen.getByPlaceholderText('Type your thoughts...');
        fireEvent.changeText(input, '   ');
        fireEvent(input, 'submitEditing');

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit while disabled', () => {
        const onSubmit = jest.fn();

        render(<InlineTypingInput onSubmit={onSubmit} disabled />);

        const input = screen.getByPlaceholderText('Type your thoughts...');
        fireEvent.changeText(input, 'hello');
        fireEvent(input, 'submitEditing');

        expect(onSubmit).not.toHaveBeenCalled();
    });
});
