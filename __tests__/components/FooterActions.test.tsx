/* eslint-disable import/first */

import { render, screen } from '@testing-library/react-native';
import React from 'react';

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
});
