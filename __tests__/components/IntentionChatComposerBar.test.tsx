/* eslint-disable import/first */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

import { IntentionChatComposerBar } from '../../components/intentions/IntentionChatComposerBar';

describe('IntentionChatComposerBar', () => {
    it('keeps the disclaimer the freeform surface does not have', () => {
        render(
            <IntentionChatComposerBar
                isMuted={false}
                onToggleMuted={jest.fn()}
                onGoDeeper={jest.fn()}
                onFinishEntry={jest.fn()}
            />
        );

        expect(screen.getByText('Blackrose can make mistakes.')).toBeTruthy();
    });

    it('describes the speaker by what the press does', () => {
        const onToggleMuted = jest.fn();
        const { rerender } = render(
            <IntentionChatComposerBar
                isMuted={false}
                onToggleMuted={onToggleMuted}
                onGoDeeper={jest.fn()}
            />
        );

        // Reading is on, so the press turns it off.
        fireEvent.press(screen.getByLabelText('Stop reading replies aloud'));
        expect(onToggleMuted).toHaveBeenCalledTimes(1);

        rerender(
            <IntentionChatComposerBar
                isMuted
                onToggleMuted={onToggleMuted}
                onGoDeeper={jest.fn()}
            />
        );
        expect(screen.getByLabelText('Read replies aloud')).toBeTruthy();
    });

    it('has no writing slip of its own — that lives inline in the transcript', () => {
        render(
            <IntentionChatComposerBar
                isMuted={false}
                onToggleMuted={jest.fn()}
                onGoDeeper={jest.fn()}
            />
        );

        expect(screen.queryByPlaceholderText("Write what's true…")).toBeNull();
    });

    it('carries the photo attach control', () => {
        render(
            <IntentionChatComposerBar
                isMuted={false}
                onToggleMuted={jest.fn()}
                onGoDeeper={jest.fn()}
                onPickImage={jest.fn()}
            />
        );

        expect(screen.getByLabelText('Attach a photo')).toBeTruthy();
    });
});
