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

const OPACITY_TIMING = { duration: 250, reduceMotion: ReduceMotion.System };

export function getSpatialFrame(progress: number) {
    const hiddenProgress = 1 - progress;

    return {
        opacity: progress,
        translateY: hiddenProgress * 35,
        scale: progress + hiddenProgress * 0.94,
        rotateX: hiddenProgress * -6,
    };
}

export function SpatialView({
    visible = true,
    children,
    style,
    className = '',
    testID,
}: SpatialViewProps) {
    const initialFrame = getSpatialFrame(visible ? 1 : 0);
    const opacityVal = useSharedValue(initialFrame.opacity);
    const translateYVal = useSharedValue(initialFrame.translateY);
    const scaleVal = useSharedValue(initialFrame.scale);
    const rotateXVal = useSharedValue(initialFrame.rotateX);

    useEffect(() => {
        const frame = getSpatialFrame(visible ? 1 : 0);

        opacityVal.value = withTiming(frame.opacity, OPACITY_TIMING);
        translateYVal.value = withSpring(frame.translateY, TRANSITION_SPRING);
        scaleVal.value = withSpring(frame.scale, TRANSITION_SPRING);
        rotateXVal.value = withSpring(frame.rotateX, TRANSITION_SPRING);
    }, [visible, opacityVal, translateYVal, scaleVal, rotateXVal]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacityVal.value,
            transform: [
                { perspective: 1000 },
                { translateY: translateYVal.value },
                { scale: scaleVal.value },
                { rotateX: `${rotateXVal.value}deg` },
            ] as ViewStyle['transform'],
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
