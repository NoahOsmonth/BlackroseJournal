import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { LoadingBar } from '@/components/ui/LoadingBar';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';

interface FooterActionsProps {
    onGoDeeper: () => void;
    onFinishEntry?: () => void;
    disabled?: boolean;
    canGoDeeper?: boolean;
    canFinish?: boolean;
    isSaving?: boolean;
    savingLabel?: string;
    /** Generation in flight: the primary verb becomes Stop, like Pi/Cursor. */
    isStreaming?: boolean;
    onStop?: () => void;
}

/**
 * The chat footer's verb row, per the reference composer: an outline "Finish
 * entry" beside a filled "Go deeper". The filled verb is the one gesture the
 * sitting is built around, so it carries the only solid fill in the transcript.
 * While a turn streams the same slot becomes Stop — the writer never has to
 * hunt for a cancel control in a second row.
 */
export function FooterActions({
    onGoDeeper,
    onFinishEntry,
    disabled = false,
    canGoDeeper = false,
    canFinish = false,
    isSaving = false,
    savingLabel = 'Saving your entry',
    isStreaming = false,
    onStop,
}: FooterActionsProps) {
    const isDark = useColorScheme() === 'dark';
    const goDeeperDisabled = disabled || !canGoDeeper;
    const finishEntryDisabled = disabled || !canFinish || !onFinishEntry || isSaving;
    const showStop = isStreaming && Boolean(onStop);
    const primaryDisabled = showStop ? false : goDeeperDisabled;
    const stopIconColor = isDark ? BLACKROSE_PALETTE.dark.bg : BLACKROSE_PALETTE.light.bg;

    const outlineClass = 'flex-1 h-11 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark px-2';
    const filledClass = 'flex-1 h-11 flex-row items-center justify-center gap-2 rounded-control px-2 bg-bone-light dark:bg-bone-dark';

    return (
        <View className="gap-3">
            <View className="flex-row gap-3">
                <Pressable
                    className={[outlineClass, finishEntryDisabled && !isSaving ? 'opacity-40' : ''].join(' ')}
                    onPress={onFinishEntry}
                    disabled={finishEntryDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={isSaving ? 'Finishing entry' : 'Finish entry'}
                    style={({ pressed }) => ({
                        opacity: finishEntryDisabled && !isSaving ? 0.4 : pressed ? 0.7 : 1,
                    })}
                >
                    {isSaving ? (
                        <View className="flex-row items-center justify-center gap-2">
                            <LoadingBar size="sm" tone="primary" accessibilityLabel="Finishing entry animation" />
                            <Text
                                className="text-[13px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                numberOfLines={1}
                            >
                                Finishing
                            </Text>
                        </View>
                    ) : (
                        <Text
                            className="text-center text-[13px] text-text-light dark:text-text-dark"
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            numberOfLines={1}
                        >
                            Finish entry
                        </Text>
                    )}
                </Pressable>

                <Pressable
                    className={[filledClass, primaryDisabled ? 'opacity-40' : ''].join(' ')}
                    onPress={showStop ? onStop : onGoDeeper}
                    disabled={primaryDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={showStop ? 'Stop generating' : 'Go deeper'}
                    accessibilityState={{ disabled: primaryDisabled }}
                    style={({ pressed }) => ({ opacity: primaryDisabled ? 0.4 : pressed ? 0.8 : 1 })}
                >
                    {showStop && (
                        <MaterialIcons name="stop" size={15} color={stopIconColor} accessibilityElementsHidden />
                    )}
                    <Text
                        className="text-center text-[13px] font-medium text-on-bone-light dark:text-on-bone-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        numberOfLines={1}
                    >
                        {showStop ? 'Stop' : 'Go deeper'}
                    </Text>
                </Pressable>
            </View>

            {isSaving ? (
                <LoadingStatus
                    label={savingLabel}
                    detail="Keep this open for a moment — your words are safe."
                    compact
                />
            ) : null}
        </View>
    );
}
