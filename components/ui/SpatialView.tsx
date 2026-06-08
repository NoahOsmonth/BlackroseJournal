import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    ReduceMotion,
} from 'react-native-reanimated';

interface SpatialViewProps {
    visible?: boolean;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    className?: string;
    physicsPreset?: 'mechanical' | 'fluid' | 'magnetic';
    testID?: string;
}

const TRANSITION_SPRING = {
    stiffness: 240,
    damping: 22,
    mass: 1.0,
    reduceMotion: ReduceMotion.System,
};

export function SpatialView({
    visible = true,
    children,
    style,
    className = '',
    testID,
}: SpatialViewProps) {
    const activeVal = useSharedValue(visible ? 1 : 0);

    useEffect(() => {
        activeVal.value = visible ? 1 : 0;
    }, [visible, activeVal]);

    const animatedStyle = useAnimatedStyle(() => {
        const tVal = activeVal.value;

        // Apply smooth spring physics to translation, scale, and tilt
        const translateY = withSpring((1 - tVal) * 35, TRANSITION_SPRING);
        const scale = withSpring(tVal + (1 - tVal) * 0.94, TRANSITION_SPRING);
        const rotateXVal = withSpring((1 - tVal) * -6, TRANSITION_SPRING);
        
        // Use smooth linear/bezier timing for opacity to prevent spring flickers in visibility
        const opacity = withTiming(tVal, { duration: 250, reduceMotion: ReduceMotion.System });

        return {
            opacity,
            transform: [
                { perspective: 1000 },
                { translateY },
                { scale },
                { rotateX: `${rotateXVal}deg` },
            ] as any,
        };
    });

    return (
        <Animated.View
            testID={testID}
            style={[styles.container, animatedStyle, style]}
            className={className}
        >
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        backfaceVisibility: 'hidden',
    },
});
