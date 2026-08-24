import {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    type AnimatedStyle,
    type SharedValue,
} from 'react-native-reanimated';

/**
 * Scroll-driven reveal hook.
 *
 * Tracks the raw contentOffset of an `Animated.ScrollView` on the UI thread.
 * Each item measures its own `y` position (in scroll-content space, stable
 * regardless of scroll) via `useScrollRevealItem`, then the returned animated
 * style fades the item from opacity 0→1 + translateY 20→0 as it approaches the
 * viewport bottom.
 *
 * Usage (screen):
 *   const { scrollY, onScroll } = useScrollReveal();
 *   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} …>
 *     <RevealItem scrollY={scrollY} …/>
 *
 * All work is on the UI thread (no JS round-trips). `useReducedMotion` makes
 * every item instantly visible.
 */

export interface ScrollRevealApi {
    scrollY: SharedValue<number>;
    onScroll: AnimatedComponent;
}

type AnimatedComponent = ReturnType<typeof useAnimatedScrollHandler<{}>>;

export function useScrollReveal(): ScrollRevealApi {
    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler<{}>((event) => {
        scrollY.value = event.contentOffset.y;
    });

    return { scrollY, onScroll };
}

/** Vertical distance (px) above the viewport bottom where the reveal completes. */
const REVEAL_WINDOW = 180;

/**
 * Builds the reveal animated style for an item whose top sits at `itemY` in
 * content space. Returns opacity + translateY driven by scrollY.
 */
export function useScrollRevealItem(
    scrollY: SharedValue<number>,
    itemY: SharedValue<number>,
    viewportHeight: number
): { style: AnimatedStyle } {
    const reduceMotion = useReducedMotion();

    const revealStyle = useAnimatedStyle(() => {
        if (reduceMotion) {
            return { opacity: 1, transform: [{ translateY: 0 }] as never };
        }
        // Distance travelled from viewport bottom to the item's top.
        const travelled = scrollY.value + viewportHeight - itemY.value;
        const progress = Math.min(Math.max(travelled / REVEAL_WINDOW, 0), 1);
        return {
            opacity: progress,
            transform: [{ translateY: (1 - progress) * 28 }] as never,
        };
    });

    return { style: revealStyle };
}