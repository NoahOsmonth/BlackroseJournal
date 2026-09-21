/**
 * Write-action menu for the dock's pencil.
 *
 * History: this was a literal radial *fan* (four pills placed on a 100px arc
 * around a 0-height container). On a phone the pills were 48–59px wide, so
 * every label wrapped to two or three lines, the items overlapped each other,
 * the dock and the journal cards behind them, and the dimmed scrim was clipped
 * to the pencil's own 44px box (see the 2026-09-19 UX fix in PROGRESS.md).
 *
 * The fix keeps the interaction (long-press the pencil → alternative write
 * actions rise out of the anchor) but replaces the geometry with a real layout:
 * a right-aligned stack of equal-width rows that grows upward out of the
 * pencil, measured against the dock so it can never cover the tabs.
 *
 * Rendered through a `Modal` so the scrim covers the whole screen and the stack
 * is positioned against the screen bottom rather than the pencil's tiny slot.
 */

import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { useThemeSettings } from '@/hooks/theme/useThemeSettings';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

type RadialIcon = keyof typeof MaterialIcons.glyphMap;

interface RadialOption {
    label: string;
    hint: string;
    icon: RadialIcon;
    route: string;
    params?: Record<string, string>;
}

interface RadialMenuProps {
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (route: string, params?: Record<string, string>) => void;
    /**
     * Distance from the bottom of the screen to the bottom edge of the stack —
     * i.e. the dock height plus a breath of air. Measured by `BottomNav`; the
     * fallback keeps the stack clear of the dock if a layout pass is pending.
     */
    anchorOffset?: number;
}

interface RadialMenuItemProps {
    delay: number;
    iconColor: string;
    isVisible: boolean;
    onNavigate: RadialMenuProps['onNavigate'];
    option: RadialOption;
}

/** Ordered by likelihood; the first row sits closest to the reading eye-line. */
const RADIAL_OPTIONS: RadialOption[] = [
    {
        label: 'New entry',
        hint: 'Open a blank journal entry',
        icon: 'edit',
        route: '/chat',
        params: { mode: 'new' },
    },
    {
        label: 'New check-in',
        hint: 'Start a morning or evening check-in',
        icon: 'menu-book',
        route: '/intentions/select',
    },
    {
        label: 'Ask Rosebud',
        hint: 'Ask a question about your journal',
        icon: 'lightbulb',
        route: '/ask-rosebud',
    },
    {
        label: 'Memory',
        hint: 'See how your memories connect',
        icon: 'show-chart',
        route: '/memory-graph',
    },
];

const ITEM_SPRING = {
    damping: 20,
    stiffness: 260,
    mass: 0.7,
    reduceMotion: ReduceMotion.System,
};
const EXIT_TIMING = { duration: 150, reduceMotion: ReduceMotion.System };
const ENTER_TIMING = { duration: 180, reduceMotion: ReduceMotion.System };
const STAGGER_MS = 45;
/** How long the exit animation runs before the modal unmounts. */
const EXIT_MS = 180;
/** Equal-width rows so the stack reads as one menu, not four ragged pills. */
const ROW_WIDTH = 196;
const ROW_HEIGHT = 48;
/** Used until `BottomNav` has measured the dock on the first layout pass. */
const FALLBACK_ANCHOR_OFFSET = 76;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function RadialMenuItem({
    delay,
    iconColor,
    isVisible,
    onNavigate,
    option,
}: RadialMenuItemProps) {
    // One value drives the entrance: it slides up out of the anchor, fades in
    // and settles. A second tracks the press so a tap feels like the dock tabs.
    const progress = useSharedValue(0);
    const pressScale = useSharedValue(1);

    useEffect(() => {
        if (isVisible) {
            progress.value = withDelay(delay, withSpring(1, ITEM_SPRING));
            return;
        }

        progress.value = withTiming(0, EXIT_TIMING);
    }, [delay, isVisible, progress]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: progress.value,
        transform: [
            { translateY: (1 - progress.value) * 18 },
            { scale: (0.92 + progress.value * 0.08) * pressScale.value },
        ] as const,
    }));

    return (
        <AnimatedPressable
            onPress={() => onNavigate(option.route, option.params)}
            onPressIn={() => {
                pressScale.value = withSpring(0.97, ITEM_SPRING);
            }}
            onPressOut={() => {
                pressScale.value = withSpring(1, ITEM_SPRING);
            }}
            style={[animatedStyle, styles.rowPressable]}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityHint={option.hint}
            hitSlop={4}
        >
            {/* Visual row lives on a plain View: AnimatedPressable drops
                className (same trap the dock tabs hit), which shipped the
                stack as borderless, transparent, wrapping text. */}
            <View
                className="flex-1 flex-row items-center gap-3 rounded-control border border-hairline-light bg-surface-light px-4 dark:border-hairline-dark dark:bg-surface-dark"
                style={styles.rowSurface}
            >
                <MaterialIcons name={option.icon} size={19} color={iconColor} />
                <Text
                    className="text-[15px] leading-[20px] text-text-light dark:text-text-dark"
                    numberOfLines={1}
                    // Menu labels never wrap or truncate: the row is sized for
                    // the longest label.
                    allowFontScaling={false}
                >
                    {option.label}
                </Text>
            </View>
        </AnimatedPressable>
    );
}

export function RadialMenu({ isVisible, onClose, onNavigate, anchorOffset }: RadialMenuProps) {
    // Kept mounted for one exit animation after the parent says "hidden", so the
    // rows collapse instead of vanishing.
    const [mounted, setMounted] = useState(isVisible);
    const backdropOpacity = useSharedValue(0);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    // Touch detail: lifting the finger that opened the menu is retargeted by the
    // browser into a `click` on the scrim, which used to shut the menu the
    // instant the finger moved off the pencil. Dismissal therefore requires a
    // press that *started on the scrim*; a press that began on the pencil (or a
    // synthetic click with no pointerdown) leaves the menu alone. A flag, not a
    // timestamp — same-millisecond presses must not read as "before opening".
    const scrimPressStarted = useRef(false);

    const isDark = useColorScheme() === 'dark';
    const { colorTheme } = useThemeSettings();
    const iconColor = isDark ? colorTheme.colors.accentDark : colorTheme.colors.accentLight;

    useEffect(() => {
        if (isVisible) {
            scrimPressStarted.current = false;
            setMounted(true);
            backdropOpacity.value = withTiming(1, ENTER_TIMING);
            return;
        }

        backdropOpacity.value = withTiming(0, EXIT_TIMING);
        if (!mounted) return;

        const timeout = setTimeout(() => {
            setMounted(false);
            // Re-arms the parent's tap handling once the collapse has played.
            onCloseRef.current();
        }, EXIT_MS);
        return () => clearTimeout(timeout);
    }, [backdropOpacity, isVisible, mounted]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const bottom = anchorOffset ?? FALLBACK_ANCHOR_OFFSET;

    return (
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View
                style={StyleSheet.absoluteFill}
                pointerEvents={isVisible ? 'auto' : 'none'}
                // Scrim included on purpose: everything outside the menu is what
                // assistive tech should ignore while it is open.
                accessibilityViewIsModal
            >
                {/* Scrim: dims the whole app (not just the dock) and dismisses. */}
                <Animated.View
                    style={[
                        StyleSheet.absoluteFill,
                        // Dark mode needs a heavier scrim: 45% black barely reads
                        // over a near-black app, so the timeline stayed legible
                        // and competed with the menu.
                        { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.66)' : 'rgba(0, 0, 0, 0.4)' },
                        backdropStyle,
                    ]}
                />
                <Pressable
                    onPointerDown={() => {
                        scrimPressStarted.current = true;
                    }}
                    onPress={() => {
                        if (!scrimPressStarted.current) return;
                        scrimPressStarted.current = false;
                        onClose();
                    }}
                    style={StyleSheet.absoluteFill}
                    accessibilityLabel="Close write actions"
                    accessibilityRole="button"
                />
                <View
                    style={[styles.anchor, { bottom }]}
                    pointerEvents="box-none"
                    testID="write-actions-anchor"
                >
                    {RADIAL_OPTIONS.map((option, index) => (
                        <RadialMenuItem
                            key={option.label}
                            delay={index * STAGGER_MS}
                            iconColor={iconColor}
                            isVisible={isVisible}
                            onNavigate={onNavigate}
                            option={option}
                        />
                    ))}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    anchor: {
        position: 'absolute',
        right: 16,
        alignItems: 'flex-end',
        gap: 8,
    },
    rowPressable: {
        width: ROW_WIDTH,
        height: ROW_HEIGHT,
    },
    rowSurface: {
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.28)',
    },
});
