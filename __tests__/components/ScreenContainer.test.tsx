import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ScreenContainer } from '@/components/ui/ScreenContainer';

// Mock SafeAreaView so we can observe the `edges` prop the container chooses.
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children, edges }: { children: React.ReactNode; edges?: string[] }) => {
        const { View } = jest.requireActual('react-native');
        return <View accessibilityLabel={`edges:${(edges ?? []).join(',')}`}>{children}</View>;
    },
}));

describe('ScreenContainer', () => {
    it('renders its children', () => {
        const { getByText } = render(
            <ScreenContainer>
                <Text>hello</Text>
            </ScreenContainer>
        );
        expect(getByText('hello')).toBeTruthy();
    });

    it('defaults to all edges (top + bottom safe area)', () => {
        const { getByLabelText } = render(
            <ScreenContainer>
                <Text>x</Text>
            </ScreenContainer>
        );
        expect(getByLabelText('edges:top,bottom')).toBeTruthy();
    });

    it('uses top-only edges when a floating bottom nav handles the bottom inset', () => {
        const { getByLabelText } = render(
            <ScreenContainer edges="top">
                <Text>x</Text>
            </ScreenContainer>
        );
        expect(getByLabelText('edges:top')).toBeTruthy();
    });

    it('adds the standard horizontal gutter when padded', () => {
        const { toJSON } = render(
            <ScreenContainer padded>
                <Text>x</Text>
            </ScreenContainer>
        );
        expect(JSON.stringify(toJSON())).toContain('px-5');
    });
});
