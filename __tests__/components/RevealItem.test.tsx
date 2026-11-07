import { render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';

import { RevealItem } from '@/components/ui/RevealItem';
import { createScrollY } from '../mocks/revealScrollY';

describe('RevealItem', () => {
    it('reveals its words without announcing a loading state', () => {
        // On web every RevealItem wrapper became a box that a screen reader read
        // out as "Loading", so Explore announced eighteen loaders while it was
        // already fully drawn. A fade box is decoration, not a placeholder.
        const screen = render(
            <RevealItem scrollY={createScrollY()}>
                <Text>Recurring theme: calm mornings</Text>
            </RevealItem>
        );

        expect(screen.getByText('Recurring theme: calm mornings')).toBeTruthy();
        expect(screen.queryByLabelText(/loading/i)).toBeNull();
    });

    it('ignores whatever name the box around it was given', () => {
        const screen = render(
            <View aria-label="Loading">
                <RevealItem scrollY={createScrollY()}>
                    <Text>Morning note</Text>
                </RevealItem>
            </View>
        );

        expect(screen.getByText('Morning note')).toBeTruthy();
    });
});
