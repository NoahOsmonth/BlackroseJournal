import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

type LoadingBarSize = 'sm' | 'md' | 'lg';

interface LoadingBarProps {
    /** Number of moving segments. Defaults to 3 (Discord/Facebook style). */
    segmentCount?: number;
    /** Segment scale. Defaults to 'md'. */
    size?: LoadingBarSize;
    /** Accessible label for screen readers. */
    accessibilityLabel?: string;
    /** Extra className for the track container. */
    className?: string;
}

const SIZE_MAP: Record<LoadingBarSize, { segment: string; track: string }> = {
    sm: { segment: 'h-1.5 w-7', track: 'h-1.5' },
    md: { segment: 'h-2 w-9', track: 'h-2' },
    lg: { segment: 'h-2.5 w-11', track: 'h-2.5' },
};

const SEGMENT_STAGGER_MS = 180;
const SEGMENT_RISE_MS = 420;
const CYCLE_MS = SEGMENT_RISE_MS * 2 + SEGMENT_STAGGER_MS * 2;

function LoadingSegment({
    index,
    segmentClassName,
    delayMs,
}: {
    index: number;
    segmentClassName: string;
    delayMs: number;
}) {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withDelay(
            delayMs,
            withRepeat(
                withTiming(1, {
                    duration: CYCLE_MS,
                    easing: Easing.inOut(Easing.ease),
                }),
                -1,
                false
            )
        );
        return () => {
            progress.value = 0;
        };
    }, [progress, delayMs]);

    const animatedStyle = useAnimatedStyle(() => {
        // progress 0 -> 0.5 bright, 0.5 -> 1 dim; smooth wave loop
        const phase = (progress.value * 2) % 1;
        const opacity = 0.25 + 0.75 * Math.sin(phase * Math.PI);
        const scaleY = 0.7 + 0.3 * Math.sin(phase * Math.PI);
        return {
            opacity,
            transform: [{ scaleY }],
        };
    });

    return (
        <Animated.View
            style={animatedStyle}
            className={`rounded-full bg-gray-400 dark:bg-gray-500 ${segmentClassName}`}
        />
    );
}

export function LoadingBar({
    segmentCount = 3,
    size = 'md',
    accessibilityLabel = 'Loading',
    className = '',
}: LoadingBarProps) {
    const { segment, track } = SIZE_MAP[size];
    const segments = Array.from({ length: segmentCount }, (_, i) => i);

    return (
        <View
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="progressbar"
            className={`flex-row items-center gap-2 ${track} ${className}`}
        >
            {segments.map((index) => (
                <LoadingSegment
                    key={index}
                    index={index}
                    segmentClassName={segment}
                    delayMs={index * SEGMENT_STAGGER_MS}
                />
            ))}
        </View>
    );
}
