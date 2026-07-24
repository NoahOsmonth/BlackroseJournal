import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { SkeletonText } from '../../components/ui/SkeletonText';
import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

describe('SkeletonText', () => {
    it('renders the requested number of labeled lines', () => {
        render(<SkeletonText lines={3} accessibilityLabel="Loading paragraph" />);

        expect(screen.getByLabelText('Loading paragraph')).toBeTruthy();
        expect(screen.getByLabelText('Loading paragraph line 1')).toBeTruthy();
        expect(screen.getByLabelText('Loading paragraph line 2')).toBeTruthy();
        expect(screen.getByLabelText('Loading paragraph line 3')).toBeTruthy();
    });

    it('uses a shorter final line by default and accepts wrapper classes', () => {
        render(<SkeletonText lines={2} className="gap-4" />);

        expect(screen.getByLabelText('Loading line 2').props.className).toContain('w-2/3');
        expect(screen.getByLabelText('Loading').props.className).toContain('gap-4');
    });
});
