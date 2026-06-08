import React, { useEffect } from 'react';
import { StyleProp, ViewStyle, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withDelay,
    withSpring,
    ReduceMotion,
} from 'react-native-reanimated';

export type StaggerType = 'diagonal' | 'center-out' | 'linear';

interface StaggerEntranceItemProps {
    index: number;
    columns?: number;
    totalItems?: number;
    staggerType?: StaggerType;
    children: React.ReactNode;
    baseDelayMs?: number;
    delayFactorMs?: number;
    style?: StyleProp<ViewStyle>;
    className?: string;
}

const STAGGER_SPRING = {
    stiffness: 200,
    damping: 18,
    mass: 0.9,
    reduceMotion: ReduceMotion.System,
};

// Calculate stagger delay based on spatial position
export function calculateDelay(
    index: number,
    columns: number,
    totalItems: number,
    staggerType: StaggerType,
    baseDelayMs: number,
    delayFactorMs: number
): number {
    const row = Math.floor(index / columns);
    const col = index % columns;

    if (staggerType === 'diagonal') {
        return baseDelayMs + (row + col) * delayFactorMs;
    }

    if (staggerType === 'center-out') {
        const totalRows = Math.ceil(totalItems / columns);
        const centerRow = (totalRows - 1) / 2;
        const centerCol = (columns - 1) / 2;
        const dist = Math.hypot(row - centerRow, col - centerCol);
        return baseDelayMs + dist * delayFactorMs;
    }

    // Default 'linear'
    return baseDelayMs + index * delayFactorMs;
}

export function StaggerEntranceItem({
    index,
    columns = 1,
    totalItems = 1,
    staggerType = 'diagonal',
    children,
    baseDelayMs = 40,
    delayFactorMs = 50,
    style,
    className = '',
}: StaggerEntranceItemProps) {
    const opacityVal = useSharedValue(0);
    const scaleVal = useSharedValue(0.85);
    const translateYVal = useSharedValue(25);

    const delay = calculateDelay(
        index,
        columns,
        totalItems,
        staggerType,
        baseDelayMs,
        delayFactorMs
    );

    useEffect(() => {
        opacityVal.value = withDelay(delay, withSpring(1, STAGGER_SPRING));
        scaleVal.value = withDelay(delay, withSpring(1, STAGGER_SPRING));
        translateYVal.value = withDelay(delay, withSpring(0, STAGGER_SPRING));
    }, [delay, opacityVal, scaleVal, translateYVal]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacityVal.value,
            transform: [
                { scale: scaleVal.value },
                { translateY: translateYVal.value },
            ] as any,
        };
    });

    const itemWidth = columns === 2 ? '48%' : '100%';

    return (
        <Animated.View
            style={[{ width: itemWidth }, styles.item, animatedStyle, style]}
            className={className}
        >
            {children}
        </Animated.View>
    );
}

interface StaggerEntranceProps {
    children: React.ReactNode;
    columns?: number;
    staggerType?: StaggerType;
    baseDelayMs?: number;
    delayFactorMs?: number;
    style?: StyleProp<ViewStyle>;
    className?: string;
}

export function StaggerEntrance({
    children,
    columns = 1,
    staggerType = 'diagonal',
    baseDelayMs = 40,
    delayFactorMs = 50,
    style,
    className = '',
}: StaggerEntranceProps) {
    const childrenArray = React.Children.toArray(children);
    const totalItems = childrenArray.length;

    return (
        <Animated.View
            style={[styles.container, style]}
            className={className}
        >
            {childrenArray.map((child, idx) => (
                <StaggerEntranceItem
                    key={idx}
                    index={idx}
                    columns={columns}
                    totalItems={totalItems}
                    staggerType={staggerType}
                    baseDelayMs={baseDelayMs}
                    delayFactorMs={delayFactorMs}
                >
                    {child}
                </StaggerEntranceItem>
            ))}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    item: {
        backfaceVisibility: 'hidden',
    },
});
