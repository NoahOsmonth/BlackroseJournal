import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
    /** Tailwind size/shape classes forwarded to the block (e.g. 'h-4 w-48 rounded-md'). */
    className?: string;
    /** Shimmer sweep duration in ms. Defaults to 1200. */
    durationMs?: number;
    /** Accessible label for screen readers. */
    accessibilityLabel?: string;
}

/**
 * Shimmer-animated placeholder block. A lighter band sweeps repeatedly across a
 * gray base, giving smooth visual continuity during async loads (no frozen look).
 */
export function Skeleton({
    className = 'rounded-md',
    durationMs = 1200,
    accessibilityLabel = 'Loading',
}: SkeletonProps) {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, {
                duration: durationMs,
                easing: Easing.inOut(Easing.ease),
            }),
            -1,
            false
        );
        return () => {
            progress.value = 0;
        };
    }, [progress, durationMs]);

    const shimmerStyle = useAnimatedStyle(() => {
        const translateX = -160 + progress.value * 320;
        return { transform: [{ translateX }] };
    });

    return (
        <View
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="progressbar"
            className={`overflow-hidden bg-divider-light/80 dark:bg-divider-dark/80 ${className}`}
        >
            <Animated.View
                style={shimmerStyle}
                className="absolute inset-y-0 -left-1/2 w-1/2 bg-white/60 dark:bg-white/10"
            />
        </View>
    );
}
