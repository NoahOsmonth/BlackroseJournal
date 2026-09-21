import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

import { InsightActionDock } from './InsightActionDock';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface EntryInsightsCardProps {
    question: string;
    onRefresh: () => void;
    onBookmark: () => void;
    onShare: () => void;
    onCopy: () => void;
    onHide: () => void;
    onShowSavedInsights: () => void;
    onPress?: () => void;
    /** Lets the screen keep the open dock clear of the floating BottomNav. */
    onDockOpenChange?: (open: boolean) => void;
}

/**
 * Icon-row boxes are literal px so the 44pt touch floor holds on native too —
 * rem-based sizes shrink there (NativeWind `inlineRem` is 14 on device, which
 * makes `h-11` 38.5pt and `h-12` 42pt).
 */
const ICON_BUTTON = 'h-[44px] w-[44px] items-center justify-center rounded-control active:opacity-70';

/**
 * The day's question, set as the one serif moment on an otherwise quiet surface.
 * Actions are outline-free glyphs in the muted ink so they never compete with
 * the sentence.
 *
 * The overflow actions live in an `InsightActionDock` that unfolds below the
 * rule, in place: the card is its own popover, so there is nothing to tap
 * "outside" of and no Cancel row to hunt for.
 */
export function EntryInsightsCard({
    question,
    onRefresh,
    onBookmark,
    onShare,
    onCopy,
    onHide,
    onShowSavedInsights,
    onPress,
    onDockOpenChange,
}: EntryInsightsCardProps) {
    const isDark = useColorScheme() === 'dark';
    const reduceMotion = useReducedMotion();
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    const [dockOpen, setDockOpen] = useState(false);

    const setDock = useCallback(
        (open: boolean) => {
            setDockOpen(open);
            onDockOpenChange?.(open);
        },
        [onDockOpenChange]
    );

    /* Every action closes the dock: the press that chose something is also the
       press that dismisses, so there is no second gesture to discover. */
    const runAction = useCallback(
        (action: () => void) => {
            setDock(false);
            action();
        },
        [setDock]
    );

    const closeDock = useCallback(() => setDock(false), [setDock]);

    /* With the dock open the card body is a close target, not a link — that is
       the "tap anywhere that is not an action" rule, minus the parts of Today
       this card does not own. */
    const handleQuestionPress = useCallback(() => {
        if (dockOpen) {
            setDock(false);
            return;
        }
        onPress?.();
    }, [dockOpen, onPress, setDock]);

    return (
        <View className="gap-3">
            <Text className="text-center text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                Based on your entries
            </Text>
            <View className="overflow-hidden rounded-card border border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark">
                <View className="px-5 pb-0 pt-5">
                    <Pressable
                        onPress={handleQuestionPress}
                        disabled={!onPress && !dockOpen}
                        accessibilityRole="button"
                        accessibilityLabel="Open insight conversation"
                        className="active:opacity-80"
                    >
                        <Text
                            className="text-center text-[19px] leading-8 text-text-light dark:text-text-dark"
                            numberOfLines={6}
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        >
                            {question}
                        </Text>
                    </Pressable>
                </View>

                <View className="mx-5 mt-5 h-px bg-hairline-light dark:bg-hairline-dark" />

                <View className="flex-row items-center justify-center gap-4 px-5 py-3">
                    <Pressable
                        onPress={() => runAction(onRefresh)}
                        accessibilityRole="button"
                        accessibilityLabel="Refresh insight"
                        className={ICON_BUTTON}
                    >
                        <MaterialIcons name="sync" size={20} color={iconColor} />
                    </Pressable>
                    <Pressable
                        onPress={() => runAction(onBookmark)}
                        accessibilityRole="button"
                        accessibilityLabel="Save insight"
                        className={ICON_BUTTON}
                    >
                        <MaterialIcons name="bookmark-border" size={20} color={iconColor} />
                    </Pressable>
                    <Pressable
                        onPress={() => setDock(!dockOpen)}
                        accessibilityRole="button"
                        accessibilityLabel="More options"
                        accessibilityState={{ expanded: dockOpen }}
                        className={
                            dockOpen
                                ? `${ICON_BUTTON} bg-surface-2-light dark:bg-surface-2-dark`
                                : ICON_BUTTON
                        }
                    >
                        <MaterialIcons name="more-horiz" size={20} color={iconColor} />
                    </Pressable>
                </View>

                {dockOpen ? (
                    <Animated.View
                        entering={reduceMotion ? undefined : FadeInDown.duration(180)}
                        exiting={reduceMotion ? undefined : FadeOutUp.duration(140)}
                    >
                        <InsightActionDock
                            onShare={() => runAction(onShare)}
                            onCopy={() => runAction(onCopy)}
                            onShowSavedInsights={() => runAction(onShowSavedInsights)}
                            onHide={() => runAction(onHide)}
                            onDismiss={closeDock}
                        />
                    </Animated.View>
                ) : null}
            </View>
        </View>
    );
}
