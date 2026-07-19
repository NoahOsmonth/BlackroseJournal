import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { Skeleton } from '../../components/ui/Skeleton';

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: {
            View,
            createAnimatedComponent: (C: unknown) => C,
        },
        useSharedValue: (v: number) => ({ value: v }),
        useAnimatedStyle: (factory: () => object) => factory(),
        withTiming: () => 0,
        withRepeat: (v: unknown) => v,
        withDelay: (d: unknown, v: unknown) => v,
        Easing: { inOut: (v: unknown) => v, ease: 0 },
    };
});

describe('Skeleton', () => {
    it('renders a progressbar with a default label', () => {
        render(<Skeleton />);
        const node = screen.getByLabelText('Loading');
        expect(node).toBeTruthy();
        expect(node.props.accessibilityRole).toBe('progressbar');
    });

    it('forwards className for sizing and shape', () => {
        render(<Skeleton className="h-4 w-48 rounded-lg" accessibilityLabel="Loading card" />);
        const node = screen.getByLabelText('Loading card');
        expect(node.props.className).toContain('h-4 w-48 rounded-lg');
    });

    it('uses overflow-hidden to clip the shimmer sweep', () => {
        render(<Skeleton accessibilityLabel="Loading block" />);
        const node = screen.getByLabelText('Loading block');
        expect(String(node.props.className)).toContain('overflow-hidden');
    });
});
