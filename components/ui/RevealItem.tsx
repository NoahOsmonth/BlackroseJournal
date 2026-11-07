import React from 'react';
import {
    Dimensions,
    LayoutChangeEvent,
    StyleProp,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import Animated, { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useScrollRevealItem } from './useScrollReveal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RevealItemProps {
    /** Shared offset from `useScrollReveal().scrollY` on the parent scroll view. */
    scrollY: SharedValue<number>;
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    className?: string;
}

/**
 * Wrap any child of an `Animated.ScrollView` (paired with `useScrollReveal`) to
 * fade it in + translate it up as it scrolls into view. All work happens on the
 * UI thread. Items naturally reveal in stagger as each enters the viewport.
 */
export function RevealItem({
    scrollY,
    children,
    style,
    className = '',
}: RevealItemProps) {
    const itemY = useSharedValue(0);

    const handleLayout = (e: LayoutChangeEvent) => {
        // layout.y is in scroll-content space, so it is stable regardless of
        // how far the container has scrolled.
        itemY.value = e.nativeEvent.layout.y;
    };

    const { style: revealStyle } = useScrollRevealItem(scrollY, itemY, SCREEN_HEIGHT);

    return (
        <Animated.View
            onLayout={handleLayout}
            style={[styles.wrapper, revealStyle, style]}
            className={className}
            // The reveal box is decoration. React Native Web derives a box's
            // name from its file name, so a screen reader announced it as
            // "Loading" and Explore read eighteen loaders while the page was
            // already drawn (DEF-031). Name it as what it is; do NOT mark it
            // aria-hidden — that would hide the words inside it too.
            accessibilityLabel=""
            accessible={false}
        >
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        backfaceVisibility: 'hidden',
    },
});