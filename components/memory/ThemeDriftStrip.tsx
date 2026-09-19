import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
    runOnJS,
    scrollTo,
    useAnimatedRef,
    useAnimatedScrollHandler,
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
/**
 * How long the drift stays held after the reader last touched the strip. The
 * prototype resumes on this idle timer, never on momentum events, and that is
 * not a style choice: iOS sends `onMomentumScrollEnd` only from a decelerating
 * scroll (`RCTScrollView.m` — `scrollViewDidEndDecelerating` /
 * `scrollViewDidEndScrollingAnimation`), so a drag released at rest never
 * reports a momentum end and a momentum-gated drift would stay parked until the
 * next fling.
 */
const IDLE_RESUME_MS = 2600;
/** Closer than this and the difference is our own sub-pixel rounding, not a reader. */
const DIVERGENCE_EPSILON = 1;

/** Fold an offset into `[0, width)`. Invisible: the content repeats. */
function foldOffset(value: number, width: number): number {
    'worklet';
    if (width <= 0) return value;
    const wrapped = value % width;
    return wrapped < 0 ? wrapped + width : wrapped;
}

interface ThemeDriftStripProps {
    themes: readonly string[];
    onThemePress: (theme: string) => void;
}

/**
 * The `·` between words. Decorative punctuation, so it is hidden from assistive
 * tech — which takes both props, because they cover different platforms:
 * `aria-hidden` reaches react-native-web and RNTL but is never mapped by React
 * Native's `Text`, so iOS needs the platform prop as well.
 */
function ThemeSeparator() {
    return (
        <Text
            aria-hidden
            // Without this, VoiceOver on iOS reads the dot between every theme
            // word: `Text` keeps `accessible` true there unless it is set false.
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
 * `Animated.ScrollView`. The strip only moves itself while nobody is touching
 * it: every interaction holds the drift for `IDLE_RESUME_MS`, and if the
 * scroller ends up somewhere the callback did not put it, the callback adopts
 * that position and holds instead of dragging the reader back. That second rule
 * is what makes a wheel or trackpad scroll work on web, where react-native-web
 * drops the drag/momentum handlers, so the hold can only come from the
 * divergence check and not from `onScrollBeginDrag`.
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
    /** Where the scroller actually is, straight off `onScroll`. */
    const livePosition = useSharedValue(0);
    /** The offset the frame callback last drove, so our own frames never read as a reader's. */
    const lastDriven = useSharedValue(0);

    const [runWidth, setRunWidth] = useState(0);
    const [viewportWidth, setViewportWidth] = useState(0);

    const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    /**
     * Take the reader's position as ours and stop drifting for a moment. Called
     * on every interaction, and re-armed rather than stacked: a long drag must
     * not leave an earlier timer to fire mid-gesture.
     */
    const holdDrift = useCallback(() => {
        paused.value = true;
        if (resumeTimer.current !== null) clearTimeout(resumeTimer.current);
        resumeTimer.current = setTimeout(() => {
            resumeTimer.current = null;
            const width = runWidthValue.value;
            const live = foldOffset(livePosition.value, width);
            // Only adopt a position the scroller really moved to. If `onScroll`
            // ever lagged, adopting blindly would jump the strip by a whole run.
            if (width > 0 && Math.abs(live - lastDriven.value) > DIVERGENCE_EPSILON) {
                offset.value = live;
                lastDriven.value = live;
            }
            paused.value = false;
        }, IDLE_RESUME_MS);
    }, [lastDriven, livePosition, offset, paused, runWidthValue]);

    useEffect(
        () => () => {
            if (resumeTimer.current !== null) clearTimeout(resumeTimer.current);
        },
        [],
    );

    useFrameCallback((frame) => {
        'worklet';
        if (reduceMotion || runWidthValue.value <= 0) return;

        const width = runWidthValue.value;
        const live = foldOffset(livePosition.value, width);
        // Compared folded, not raw: what we drive is always a folded offset, and
        // `onScroll` reaches us a frame or so late, so a raw comparison would
        // read our own wrap — a jump of a whole run — as a reader's scroll.
        if (Math.abs(live - lastDriven.value) > DIVERGENCE_EPSILON) {
            // Someone else moved it — a native drag, a trackpad flick, a wheel.
            // Follow them instead of fighting, and hold the drift.
            offset.value = live;
            lastDriven.value = live;
            if (!paused.value) runOnJS(holdDrift)();
            return;
        }

        if (paused.value) return;

        const elapsed = Math.min(frame.timeSincePreviousFrame ?? 0, MAX_FRAME_DELTA_MS);
        const next = foldOffset(offset.value + (DRIFT_SPEED * elapsed) / 1000, width);
        offset.value = next;
        lastDriven.value = next;
        scrollTo(scrollRef, next, 0, false);
    }, true);

    const handleScroll = useAnimatedScrollHandler(
        {
            onScroll: (event) => {
                'worklet';
                livePosition.value = event.contentOffset.x;
            },
        },
        [livePosition],
    );

    const handleRunLayout = (event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout.width;
        // `onLayout` can fire more than once, and a run measured in fallback
        // font metrics would give a wrap distance that jumps at the seam. Only
        // adopt a width that actually changed, then re-fold the offsets so the
        // correction still lands on identical pixels — and so a re-measure
        // cannot read as a foreign scroll on the next frame.
        if (Math.abs(next - runWidth) <= WIDTH_EPSILON) return;
        setRunWidth(next);
        runWidthValue.value = next;
        offset.value = foldOffset(offset.value, next);
        lastDriven.value = foldOffset(lastDriven.value, next);
    };

    const handleViewportLayout = (event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout.width;
        setViewportWidth((previous) =>
            Math.abs(next - previous) <= WIDTH_EPSILON ? previous : next,
        );
    };

    if (themes.length === 0) return null;

    return (
        <View
            testID="theme-drift-strip"
            // Deliberately NOT `accessible`: an accessible container groups every
            // descendant into one element, which would swallow the theme buttons
            // and leave the whole strip as a single focusable blob. The role,
            // label and tab stop describe the group without collapsing it.
            accessibilityRole="adjustable"
            accessibilityLabel="Themes you return to"
            tabIndex={0}
        >
            <Animated.ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleScroll}
                onLayout={handleViewportLayout}
                onScrollBeginDrag={holdDrift}
                onMomentumScrollBegin={holdDrift}
                onScrollEndDrag={holdDrift}
                onMomentumScrollEnd={holdDrift}
            >
                {Array.from({ length: runCount }, (_, run) => (
                    <View
                        key={run}
                        className="flex-row items-baseline gap-2 pr-2"
                        onLayout={run === 0 ? handleRunLayout : undefined}
                        // One prop, correct on all three platforms: React Native
                        // maps it to accessibilityElementsHidden (and, when
                        // true, `importantForAccessibility`) and react-native-web
                        // maps it to the DOM attribute.
                        aria-hidden={run > 0}
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
