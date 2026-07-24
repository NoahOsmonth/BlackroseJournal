import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

import { Skeleton } from '../../components/ui/Skeleton';


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
