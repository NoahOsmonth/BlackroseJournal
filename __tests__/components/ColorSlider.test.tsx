import React from 'react';
import { render } from '@testing-library/react-native';

import { ColorSlider } from '@/components/ui/ColorSlider';

describe('ColorSlider', () => {
    it('renders as an adjustable control with hue accessibility label', () => {
        const { getByLabelText } = render(
            <ColorSlider
                ariaLabel="Hue"
                trackColors={['#FF0000', '#00FF00', '#0000FF']}
                valueRatio={0.25}
                onChange={jest.fn()}
            />
        );

        const slider = getByLabelText('Hue');
        expect(slider.props.accessibilityRole).toBe('adjustable');
        expect(slider.props.accessibilityValue).toEqual(
            expect.objectContaining({ min: 0, max: 100, now: 25 })
        );
    });

    it('reflects tone ratio in accessibility value', () => {
        const { getByLabelText } = render(
            <ColorSlider
                ariaLabel="Tone"
                trackColors={['#000000', '#FFFFFF']}
                valueRatio={0.5}
                onChange={jest.fn()}
            />
        );

        expect(getByLabelText('Tone').props.accessibilityValue).toEqual(
            expect.objectContaining({ now: 50 })
        );
    });
});
