import React, { useState } from 'react';
import {
    Pressable,
    Text,
    View,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
    scrollTo,
    useAnimatedRef,
    useFrameCallback,
    useReducedMotion,
    useSharedValue,
} from 'react-native-reanimated';

import { titleCaseTheme } from './memoryDisplay';

/** Pixels per second the strip drifts. Slow enough to read, fast enough to notice. */
const DRIFT_SPEED = 16;
/**
 * Ceiling on a single frame's delta. A backgrounded app (or a stalled JS thread)
 * reports one huge `timeSincePreviousFrame`, and without the clamp the strip
 * teleports an arbitrary distance on the first frame after the app returns. The
 * prototype clamps at 0.05s for the same reason.
 */
const MAX_FRAME_DELTA_MS = 50;
/** A re-measure smaller than this is sub-pixel noise, not a real width change. */
const WIDTH_EPSILON = 0.5;
/** Floor for the run count: one run to show, one to wrap into. */
const MIN_RUNS = 2;

interface ThemeDriftStripProps {
    themes: readonly string[];
    onThemePress: (theme: string) => void;
}

/**
 * The `·` between words. Decorative punctuation, so it opts out of being its
 * own screen-reader stop; the prototype's `aria-hidden` maps here to
 * `accessibilityElementsHidden`, but that also removes the node from RNTL's
 * default query filter — and the separators are what make one run's width equal
 * the wrap distance, so they have to stay observable to the test that pins them.
 */
function ThemeSeparator() {
    return (
        <Text
            accessible={false}
            className="text-[13px] text-text-secondary-light opacity-60 dark:text-text-secondary-dark"
        >
            ·
        </Text>
    );
}

/**
 * Themes that drift slowly past the reader. The page's only looping motion.
 *
 * A CSS transform and native scroll cannot both own the offset, so the prototype
 * drove `scrollLeft` directly; here a frame callback drives `scrollTo` on an
 * `Animated.ScrollView`. Native scroll still owns the position while a finger is
 * down, and the offset is re-adopted from `contentOffset.x` when momentum ends —
 * so flick and momentum behave natively instead of being reimplemented.
 *
 * The wrap is seamless because the content is periodic: normalising the offset
 * modulo one run's width lands on identical pixels, so the correction is
 * invisible.
 *
 * **Only the first run is interactive.** Duplicated runs exist to make the offset
 * periodic; buttons inside them would put focusable content inside an
 * accessibility-hidden subtree and make tabbing walk the same words over and
 * over.
 */
export function ThemeDriftStrip({ themes, onThemePress }: ThemeDriftStripProps) {
    const reduceMotion = useReducedMotion();
    const scrollRef = useAnimatedRef<Animated.ScrollView>();
    const offset = useSharedValue(0);
    const paused = useSharedValue(false);
    /** The frame callback and the drag handlers both need the width off the JS thread. */
    const runWidthValue = useSharedValue(0);

    const [runWidth, setRunWidth] = useState(0);
    const [viewportWidth, setViewportWidth] = useState(0);

    /**
     * Computed, not hard-coded. The drift can only reach its own wrap point if
     * the content is at least one run wider than the viewport, i.e.
     * `(N - 1) * runWidth >= viewport`. With a short theme list on a wide frame
     * two runs are not enough: the strip would jam against the content end and
     * the wrap would never happen. `+1` because the first run is already there;
     * the ceiling leaves a margin for sub-pixel rounding.
     */
    const runCount =
        runWidth > 0 && viewportWidth > 0
            ? Math.max(MIN_RUNS, Math.ceil((runWidth + viewportWidth) / runWidth) + 1)
            : MIN_RUNS;

    /** Fold an offset into `[0, runWidth)`. Invisible: the content repeats. */
    const adopt = (x: number) => {
        const width = runWidthValue.value;
        if (width <= 0) {
            offset.value = x;
            return;
        }
        const wrapped = x % width;
        offset.value = wrapped < 0 ? wrapped + width : wrapped;
    };

    useFrameCallback((frame) => {
        'worklet';
        if (paused.value || reduceMotion || runWidthValue.value <= 0) return;
        const elapsed = Math.min(frame.timeSincePreviousFrame ?? 0, MAX_FRAME_DELTA_MS);
        const next = offset.value + (DRIFT_SPEED * elapsed) / 1000;
        const wrapped = next % runWidthValue.value;
        offset.value = wrapped < 0 ? wrapped + runWidthValue.value : wrapped;
        scrollTo(scrollRef, offset.value, 0, false);
    }, true);

    const handleRunLayout = (event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout.width;
        // `onLayout` can fire more than once, and a run measured in fallback
        // font metrics would give a wrap distance that jumps at the seam. Only
        // adopt a width that actually changed, then re-fold the live offset so
        // the correction still lands on identical pixels.
        if (Math.abs(next - runWidth) <= WIDTH_EPSILON) return;
        setRunWidth(next);
        runWidthValue.value = next;
        adopt(offset.value);
    };

    const handleViewportLayout = (event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout.width;
        setViewportWidth((previous) =>
            Math.abs(next - previous) <= WIDTH_EPSILON ? previous : next,
        );
    };

    const handleScrollBeginDrag = () => {
        paused.value = true;
    };

    /**
     * A flick fires `onScrollEndDrag` and *then* momentum. Un-pausing on the
     * drag end would start driving `scrollTo` while native momentum is still
     * moving the content — the offset fighting native scroll. Re-pausing here
     * (and only resuming on momentum end) leaves the strip parked for a moment
     * on a zero-velocity release, which is the safer of the two failures.
     */
    const handleMomentumScrollBegin = () => {
        paused.value = true;
    };

    const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        adopt(event.nativeEvent.contentOffset.x);
    };

    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        adopt(event.nativeEvent.contentOffset.x);
        paused.value = false;
    };

    if (themes.length === 0) return null;

    return (
        <View
            testID="theme-drift-strip"
            // Deliberately NOT `accessible`: an accessible container groups every
            // descendant into one element, which would swallow the theme buttons
            // and leave the whole strip as a single focusable blob. The role and
            // label describe the group without collapsing it.
            accessibilityRole="adjustable"
            accessibilityLabel="Themes you return to"
        >
            <Animated.ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onLayout={handleViewportLayout}
                onScrollBeginDrag={handleScrollBeginDrag}
                onMomentumScrollBegin={handleMomentumScrollBegin}
                onScrollEndDrag={handleScrollEndDrag}
                onMomentumScrollEnd={handleMomentumScrollEnd}
            >
                {Array.from({ length: runCount }, (_, run) => (
                    <View
                        key={run}
                        className="flex-row items-baseline gap-5 pr-5"
                        onLayout={run === 0 ? handleRunLayout : undefined}
                        accessibilityElementsHidden={run > 0}
                        importantForAccessibility={run > 0 ? 'no-hide-descendants' : 'auto'}
                    >
                        {themes.map((theme) =>
                            run === 0 ? (
                                <React.Fragment key={theme}>
                                    <Pressable
                                        onPress={() => onThemePress(theme)}
                                        accessibilityRole="button"
                                        // The label carries the raw tag the filter
                                        // uses, never the display-cased word.
                                        accessibilityLabel={`Filter memory by ${theme}`}
                                        hitSlop={6}
                                    >
                                        <Text
                                            className="text-base italic text-text-light dark:text-text-dark"
                                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                        >
                                            {titleCaseTheme(theme)}
                                        </Text>
                                    </Pressable>
                                    <ThemeSeparator />
                                </React.Fragment>
                            ) : (
                                <React.Fragment key={theme}>
                                    <Text
                                        className="text-base italic text-text-light dark:text-text-dark"
                                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                    >
                                        {titleCaseTheme(theme)}
                                    </Text>
                                    <ThemeSeparator />
                                </React.Fragment>
                            ),
                        )}
                    </View>
                ))}
            </Animated.ScrollView>
        </View>
    );
}
