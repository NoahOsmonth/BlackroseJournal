import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

import { LoadingBar } from '../../components/ui/LoadingBar';
import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

describe('LoadingBar', () => {
    it('renders three moving segments by default', () => {
        render(<LoadingBar />);
        const segments = screen.UNSAFE_queryAllByType(View).filter((node: object) => {
            const className = (node as { props?: { className?: string } }).props?.className ?? '';
            return String(className).includes('rounded-full');
        });
        expect(segments.length).toBe(3);
    });

    it('honors a custom segment count', () => {
        render(<LoadingBar segmentCount={5} accessibilityLabel="Saving check-in" />);
        expect(screen.getByLabelText('Saving check-in')).toBeTruthy();
        const segments = screen.UNSAFE_queryAllByType(View).filter((node: object) => {
            const className = (node as { props?: { className?: string } }).props?.className ?? '';
            return String(className).includes('rounded-full');
        });
        expect(segments.length).toBe(5);
    });

    it('exposes a progressbar accessibility role', () => {
        render(<LoadingBar accessibilityLabel="Finishing entry" />);
        const node = screen.getByLabelText('Finishing entry');
        expect(node.props.accessibilityRole).toBe('progressbar');
    });
});
