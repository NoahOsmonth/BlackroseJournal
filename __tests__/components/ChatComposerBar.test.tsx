/* eslint-disable import/first */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

import { ChatComposerBar } from '../../components/chat/ChatComposerBar';

const photo = { uri: 'file:///tmp/photo.jpg', mimeType: 'image/jpeg' };

describe('ChatComposerBar', () => {
    it('offers a photo button and a speaker, and never a microphone', () => {
        const { getByLabelText, queryByLabelText } = render(
            <ChatComposerBar
                onGoDeeper={jest.fn()}
                onPickImage={jest.fn()}
                voice={{ enabled: true, label: 'Read replies aloud', onPress: jest.fn() }}
            />
        );

        expect(getByLabelText('Attach a photo')).toBeTruthy();
        expect(getByLabelText('Read replies aloud')).toBeTruthy();
        expect(queryByLabelText(/microphone|record|voice input/i)).toBeNull();
    });

    it('presses the photo button and the speaker', () => {
        const onPickImage = jest.fn();
        const onVoice = jest.fn();
        render(
            <ChatComposerBar
                onGoDeeper={jest.fn()}
                onPickImage={onPickImage}
                voice={{ enabled: false, label: 'Stop reading replies aloud', onPress: onVoice }}
            />
        );

        fireEvent.press(screen.getByLabelText('Attach a photo'));
        fireEvent.press(screen.getByLabelText('Stop reading replies aloud'));

        expect(onPickImage).toHaveBeenCalledTimes(1);
        expect(onVoice).toHaveBeenCalledTimes(1);
    });

    it('shows the attached photo as a removable chip', () => {
        const onRemoveImage = jest.fn();
        render(
            <ChatComposerBar
                onGoDeeper={jest.fn()}
                onPickImage={jest.fn()}
                pendingImage={photo}
                onRemoveImage={onRemoveImage}
            />
        );

        expect(screen.getByLabelText('Attached photo preview')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Remove attached photo'));
        expect(onRemoveImage).toHaveBeenCalledTimes(1);
    });

    it('omits the photo control when the surface cannot attach one', () => {
        render(<ChatComposerBar onGoDeeper={jest.fn()} />);

        expect(screen.queryByLabelText('Attach a photo')).toBeNull();
    });

    it('passes the verbs through to the footer actions', () => {
        render(
            <ChatComposerBar
                onGoDeeper={jest.fn()}
                onFinishEntry={jest.fn()}
                canGoDeeper
                canFinish
            />
        );

        expect(screen.getByText('Go deeper')).toBeTruthy();
        expect(screen.getByText('Finish entry')).toBeTruthy();
    });

    it('renders extra content above the verbs', () => {
        const { Text } = jest.requireActual('react-native');
        render(
            <ChatComposerBar onGoDeeper={jest.fn()}>
                <Text>Blackrose can make mistakes.</Text>
            </ChatComposerBar>
        );

        expect(screen.getByText('Blackrose can make mistakes.')).toBeTruthy();
    });

    function sourcePressable(view: ReturnType<typeof render>, label: string) {
        const pressableType = (Pressable as unknown as {
            type: React.ComponentType<unknown>;
        }).type;
        return view.UNSAFE_getAllByType(pressableType).find(
            (node) => node.props.accessibilityLabel === label,
        );
    }

    it('exposes disabled photo and speaker controls while the composer is busy', () => {
        const onPickImage = jest.fn();
        const onVoice = jest.fn();
        const view = render(
            <ChatComposerBar
                onGoDeeper={jest.fn()}
                disabled
                onPickImage={onPickImage}
                voice={{ enabled: true, label: 'Read the last reply aloud', onPress: onVoice }}
            />,
        );

        expect(sourcePressable(view, 'Attach a photo')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: true }),
        );
        expect(sourcePressable(view, 'Read the last reply aloud')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: true }),
        );
        fireEvent.press(screen.getByLabelText('Attach a photo'));
        fireEvent.press(screen.getByLabelText('Read the last reply aloud'));
        expect(onPickImage).not.toHaveBeenCalled();
        expect(onVoice).not.toHaveBeenCalled();
    });

    it('exposes enabled photo and speaker controls when the composer is available', () => {
        const view = render(
            <ChatComposerBar
                onGoDeeper={jest.fn()}
                onPickImage={jest.fn()}
                voice={{ enabled: false, label: 'Read the last reply aloud', onPress: jest.fn() }}
            />,
        );

        expect(sourcePressable(view, 'Attach a photo')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: false }),
        );
        expect(sourcePressable(view, 'Read the last reply aloud')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: false }),
        );
    });

    it('marks the speaker unavailable when there is nothing to read', () => {
        const onVoice = jest.fn();
        const view = render(
            <ChatComposerBar
                onGoDeeper={jest.fn()}
                voice={{
                    enabled: false,
                    available: false,
                    label: 'Read the last reply aloud',
                    onPress: onVoice,
                }}
            />,
        );

        expect(sourcePressable(view, 'Read the last reply aloud')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: true }),
        );
        fireEvent.press(screen.getByLabelText('Read the last reply aloud'));
        expect(onVoice).not.toHaveBeenCalled();
    });

    it('marks the photo control busy while an image is being picked', () => {
        const view = render(
            <ChatComposerBar
                onGoDeeper={jest.fn()}
                onPickImage={jest.fn()}
                isPickingImage
                voice={{ enabled: false, label: 'Read the last reply aloud', onPress: jest.fn() }}
            />,
        );

        expect(sourcePressable(view, 'Attach a photo')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: true }),
        );
        expect(sourcePressable(view, 'Read the last reply aloud')?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: false }),
        );
    });
});
