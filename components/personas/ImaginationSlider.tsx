import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';

interface ImaginationSliderProps {
    value: number;
    onChange: (value: number) => void;
}

export function ImaginationSlider({ value, onChange }: ImaginationSliderProps) {
    const [trackWidth, setTrackWidth] = useState(0);
    const clampValue = useCallback((next: number) => {
        const clamped = Math.max(0, Math.min(100, Math.round(next)));
        onChange(clamped);
    }, [onChange]);

    const handleLayout = (event: LayoutChangeEvent) => {
        setTrackWidth(event.nativeEvent.layout.width);
    };

    const handleMove = (locationX: number) => {
        if (!trackWidth) return;
        const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
        clampValue(ratio * 100);
    };

    const knobOffset = trackWidth ? (trackWidth * value) / 100 : 0;

    return (
        <View
            className="relative h-6 w-full justify-center"
            onLayout={handleLayout}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(event) => handleMove(event.nativeEvent.locationX)}
            onResponderMove={(event) => handleMove(event.nativeEvent.locationX)}
        >
            <View className="h-[4px] bg-gray-200 dark:bg-divider-dark rounded-full overflow-hidden">
                <View
                    className="h-full bg-accent-yellow rounded-full"
                    style={{ width: `${value}%` }}
                />
            </View>
            <View
                className="absolute top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-accent-yellow border-2 border-surface-light dark:border-secondary-dark"
                style={{ left: Math.max(0, knobOffset - 11) }}
            />
        </View>
    );
}
