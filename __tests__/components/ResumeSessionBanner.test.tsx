import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ResumeSessionBanner } from '../../components/journal/ResumeSessionBanner';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: ({ name }: { name: string }) => {
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

describe('ResumeSessionBanner', () => {
    it('exposes separate resume and dismiss actions', () => {
        const onResume = jest.fn();
        const onDismiss = jest.fn();

        render(
            <ResumeSessionBanner
                title="Last conversation"
                onResume={onResume}
                onDismiss={onDismiss}
            />
        );

        fireEvent.press(screen.getByLabelText('Dismiss resume banner'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(onResume).not.toHaveBeenCalled();

        fireEvent.press(screen.getByLabelText('Resume your last conversation'));
        expect(onResume).toHaveBeenCalledTimes(1);
    });
});
