import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { StaggerEntrance, calculateDelay } from '../../components/ui/StaggerEntrance';

describe('calculateDelay', () => {
    it('calculates linear delay correctly', () => {
        const delay = calculateDelay(3, 1, 10, 'linear', 50, 40);
        // base + index * factor = 50 + 3 * 40 = 170
        expect(delay).toBe(170);
    });

    it('calculates diagonal delay correctly for single column', () => {
        const delay = calculateDelay(2, 1, 5, 'diagonal', 50, 30);
        // index 2 is row 2, col 0. row+col = 2.
        // base + (row + col) * factor = 50 + 2 * 30 = 110
        expect(delay).toBe(110);
    });

    it('calculates diagonal delay correctly for grid layout', () => {
        const delay = calculateDelay(5, 3, 9, 'diagonal', 100, 20);
        // index 5 in 3-column grid is row 1, col 2. row+col = 3.
        // base + (row + col) * factor = 100 + 3 * 20 = 160
        expect(delay).toBe(160);
    });

    it('calculates center-out delay correctly', () => {
        const delay = calculateDelay(4, 3, 9, 'center-out', 100, 20);
        // 9 items, 3 cols -> 3 rows. Center row is 1, center col is 1 (index 4).
        // Distance is hypot(0, 0) = 0.
        // base + 0 * factor = 100
        expect(delay).toBe(100);
    });
});

describe('StaggerEntrance', () => {
    it('renders all mapped child elements correctly', () => {
        const { getByText } = render(
            <StaggerEntrance columns={2} staggerType="diagonal">
                <Text>Item A</Text>
                <Text>Item B</Text>
                <Text>Item C</Text>
            </StaggerEntrance>
        );

        expect(getByText('Item A')).toBeTruthy();
        expect(getByText('Item B')).toBeTruthy();
        expect(getByText('Item C')).toBeTruthy();
    });
});
