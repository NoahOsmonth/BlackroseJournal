import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

interface TypingIndicatorProps {
    colorClassName?: string;
    sizeClassName?: string;
}

const DOTS = [0, 1, 2];
const DOT_STAGGER_MS = 160;
const DOT_RISE_MS = 320;

function toBackgroundClass(colorClassName: string): string {
    return colorClassName
        .split(/\s+/)
        .map((name) => name.replace(/^text-/, 'bg-').replace(/^dark:text-/, 'dark:bg-'))
        .join(' ');
}

export function TypingIndicator({
    colorClassName = 'text-text-secondary-light dark:text-text-secondary-dark',
    sizeClassName = 'text-base',
}: TypingIndicatorProps) {
    const dotColorClassName = toBackgroundClass(colorClassName);
    const dotSizeClassName = sizeClassName.includes('sm') ? 'h-1.5 w-1.5' : 'h-2 w-2';
    const progress = useRef(DOTS.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        const animations = progress.map((value, index) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(index * DOT_STAGGER_MS),
                    Animated.timing(value, {
                        toValue: 1,
                        duration: DOT_RISE_MS,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(value, {
                        toValue: 0,
                        duration: DOT_RISE_MS,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    // Pause so the wave restarts together instead of drifting.
                    Animated.delay((DOTS.length - 1 - index) * DOT_STAGGER_MS),
                ])
            )
        );
        animations.forEach((animation) => animation.start());

        return () => {
            animations.forEach((animation) => animation.stop());
        };
    }, [progress]);

    return (
        <View
            accessibilityLabel="AI typing indicator"
            accessibilityRole="text"
            className="flex-row items-center gap-1"
        >
            {DOTS.map((dot) => (
                <Animated.View
                    key={dot}
                    style={{
                        opacity: progress[dot].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.25, 1],
                        }),
                        transform: [
                            {
                                translateY: progress[dot].interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -3],
                                }),
                            },
                        ],
                    }}
                >
                    <View className={`${dotColorClassName} ${dotSizeClassName} rounded-full`} />
                </Animated.View>
            ))}
        </View>
    );
}
