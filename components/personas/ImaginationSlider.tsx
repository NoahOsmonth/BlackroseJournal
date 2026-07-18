import React from 'react';

import { RangeSlider } from '@/components/ui/RangeSlider';

interface ImaginationSliderProps {
    value: number;
    onChange: (value: number) => void;
}

export function ImaginationSlider({ value, onChange }: ImaginationSliderProps) {
    return (
        <RangeSlider
            value={value}
            min={0}
            max={100}
            step={1}
            onSliding={onChange}
            onChange={onChange}
            accessibilityLabel="Imagination"
            trackClassName="bg-gray-200 dark:bg-divider-dark"
            fillClassName="bg-accent-yellow"
            thumbClassName="border-2 border-surface-light bg-accent-yellow dark:border-secondary-dark"
        />
    );
}
