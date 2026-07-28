import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

type LoadingBarSize = 'sm' | 'md' | 'lg';
type LoadingBarTone = 'muted' | 'primary';

interface LoadingBarProps {
    /** Number of moving segments. Defaults to 3 (Discord/Facebook style). */
    segmentCount?: number;
    /** Segment scale. Defaults to 'md'. */
    size?: LoadingBarSize;
    /** Accessible label for screen readers. */
    accessibilityLabel?: string;
    /** Extra className for the track container. */
    className?: string;
    /** Muted for ambient placeholders; primary for an active user action. */
    tone?: LoadingBarTone;
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
    segmentClassName,
    delayMs,
    tone,
}: {
    segmentClassName: string;
    delayMs: number;
    tone: LoadingBarTone;
}) {
    const progress = useSharedValue(0);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (reduceMotion) {
            progress.value = 0.5;
            return;
        }

        progress.value = withDelay(
            delayMs,
            withRepeat(
                withSequence(
                    withTiming(1, {
                        duration: CYCLE_MS / 2,
                        easing: Easing.inOut(Easing.ease),
                    }),
                    withTiming(0, {
                        duration: CYCLE_MS / 2,
                        easing: Easing.inOut(Easing.ease),
                    }),
                ),
                -1,
                false
            )
        );
        return () => {
            progress.value = 0;
        };
    }, [progress, delayMs, reduceMotion]);

    const animatedStyle = useAnimatedStyle(() => {
        const intensity = Math.sin(progress.value * Math.PI);
        const opacity = 0.25 + 0.75 * intensity;
        const scaleY = 0.7 + 0.3 * intensity;
        return {
            opacity,
            transform: [{ scaleY }],
        };
    });

    return (
        <Animated.View
            style={animatedStyle}
            className={`rounded-full ${tone === 'primary' ? 'bg-primary dark:bg-primary-dark' : 'bg-text-secondary-light/60 dark:bg-text-secondary-dark/60'} ${segmentClassName}`}
        />
    );
}

export function LoadingBar({
    segmentCount = 3,
    size = 'md',
    accessibilityLabel = 'Loading',
    className = '',
    tone = 'muted',
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
                    segmentClassName={segment}
                    delayMs={index * SEGMENT_STAGGER_MS}
                    tone={tone}
                />
            ))}
        </View>
    );
}
