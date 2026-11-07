/* eslint-disable import/first */

import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Pressable } from 'react-native';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

jest.mock('../../hooks/use-theme-color', () => ({
    useThemeColor: () => '#111827',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

import { FooterActions } from '../../components/FooterActions';

describe('FooterActions', () => {
    it('keeps Finish Entry visibly labeled while it saves', () => {
        render(
            <FooterActions
                onGoDeeper={jest.fn()}
                onFinishEntry={jest.fn()}
                canFinish
                isSaving
                savingLabel="Creating your insights"
            />
        );

        expect(screen.getByLabelText('Finishing entry')).toBeTruthy();
        expect(screen.getByText('Finishing')).toBeTruthy();
        expect(screen.getByLabelText('Creating your insights')).toBeTruthy();
        expect(screen.getByLabelText('Finishing entry animation')).toBeTruthy();
    });

    /**
     * Finish must carry its own accessibilityState, just like Go deeper.
     * The derived host state is not enough: assistive tech needs the explicit
     * prop on the composite Pressable so a disabled Finish reads as disabled.
     */
    it('exposes an explicit accessibilityState.disabled when Finish is disabled', () => {
        const view = render(
            <FooterActions
                onGoDeeper={jest.fn()}
                onFinishEntry={jest.fn()}
                canGoDeeper
                canFinish={false}
            />
        );

        // RN's Pressable is memo-wrapped; query its inner component so this
        // inspects the prop the source passes, not the host View's derived state.
        const pressableType = (Pressable as unknown as { type: React.ComponentType<unknown> }).type;
        const pressables = view.UNSAFE_getAllByType(pressableType);
        const finish = pressables.find(
            (node) => node.props.accessibilityLabel === 'Finish entry',
        );

        expect(finish).toBeTruthy();
        expect(finish?.props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: true }),
        );
    });
});
