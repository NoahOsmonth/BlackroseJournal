import React, { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

import { useSkeletonProgress } from './SkeletonProvider';

interface SkeletonProps {
    /** Tailwind size/shape classes forwarded to the block (e.g. 'h-4 w-48 rounded-md'). */
    className?: string;
    /** Shimmer sweep duration in ms; only applies when no SkeletonProvider is mounted. */
    durationMs?: number;
    /** Accessible label for screen readers. */
    accessibilityLabel?: string;
}

/**
 * Shimmer-animated placeholder block. A lighter band sweeps repeatedly across a
 * gray base, giving smooth visual continuity during async loads (no frozen look).
 */
function SkeletonComponent({
    className = 'rounded-md',
    durationMs = 1200,
    accessibilityLabel = 'Loading',
}: SkeletonProps) {
    const sharedProgress = useSkeletonProgress();
    const localProgress = useSharedValue(0);
    const reduceMotion = useReducedMotion();
    const progress = sharedProgress ?? localProgress;

    useEffect(() => {
        if (sharedProgress || reduceMotion) {
            return;
        }

        localProgress.value = withRepeat(
            withTiming(1, {
                duration: durationMs,
                easing: Easing.inOut(Easing.ease),
            }),
            -1,
            false
        );
        return () => {
            localProgress.value = 0;
        };
    }, [durationMs, localProgress, reduceMotion, sharedProgress]);

    const shimmerStyle = useAnimatedStyle(() => {
        const translateX = -160 + progress.value * 320;
        return { transform: [{ translateX }] };
    });

    const baseClassName = `overflow-hidden bg-divider-light/80 dark:bg-divider-dark/80 ${className}`;

    if (reduceMotion) {
        return (
            <View
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="progressbar"
                className={baseClassName}
            />
        );
    }

    return (
        <View
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="progressbar"
            className={baseClassName}
        >
            <Animated.View
                style={shimmerStyle}
                className="absolute inset-y-0 -left-1/2 w-1/2 bg-white/60 dark:bg-white/10"
            />
        </View>
    );
}

export const Skeleton = memo(
    SkeletonComponent,
    (previous, next) => previous.className === next.className
        && previous.durationMs === next.durationMs
        && previous.accessibilityLabel === next.accessibilityLabel
);
