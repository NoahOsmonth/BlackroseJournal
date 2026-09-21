import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { BLACKROSE_PALETTE, memoryLayerShades } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import { getLocalDateKey } from '@/utils/date';
import {
    formatLedgerDate,
    formatRelativeMemoryTime,
    MEMORY_LAYER_LABELS,
    memoryAtomRoute,
} from './memoryDisplay';

interface MemoryLedgerRowProps {
    atom: LocalMemoryAtom;
    onDelete: (atom: LocalMemoryAtom) => void;
    onThemePress: (tag: string) => void;
    onOpen?: (atom: LocalMemoryAtom) => void;
    /**
     * True when this row opens a new day — i.e. the row above it printed a
     * different date, or there is no row above it. The date column drops the
     * month on a repeat of a day already shown (a printed ledger's continuation
     * convention), so this prop is *exactly* the day-start signal; the day
     * number inks on it.
     */
    showMonth: boolean;
}

/**
 * One memory as a ledger row: a serif date in the margin, then the claim and the
 * evidence as two different lines. The old card put the title and the body in
 * identical type, so a row spent two lines saying one thing.
 *
 * The date is the *write* date and the list head says "Written" for that reason
 * (clock doctrine — an entry's weekday lives in its prose, never in its
 * timestamp).
 */
export function MemoryLedgerRow({
    atom,
    onDelete,
    onThemePress,
    onOpen,
    showMonth,
}: MemoryLedgerRowProps) {
    const isDark = useColorScheme() === 'dark';
    const scheme = isDark ? 'dark' : 'light';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    // Scheme-aware, unlike `MemoryLayerColors` which always resolves the dark
    // family: the dark note shade on paper is 2.6:1, under the 3:1 non-text
    // threshold, so the marker would read as a smudge in light mode.
    const layerColor = memoryLayerShades(atom.layer, scheme).deep;
    const date = formatLedgerDate(atom.createdAt);
    // The date column's two ink states, ported from the prototype
    // (`.entry-date.is-day-start` / `.is-today` in explore.css:699-716). The
    // month-drop above only makes a day boundary *findable*; the ink change is
    // what does the finding, so the two ship together. `showMonth` is already
    // exactly the day-start signal (see the prop doc), so no new prop is added —
    // a new required prop would be a `tsc` error in every test literal that
    // enumerates this component's props.
    const isDayStart = showMonth;
    // Local date, computed here rather than passed: `date.iso` is
    // `getLocalDateKey(createdAt)`, so today is a like-for-like comparison.
    const isToday = date.iso === getLocalDateKey();
    const dateInkClass = isDayStart || isToday
        ? 'text-text-light dark:text-text-dark'
        : 'text-text-secondary-light dark:text-text-secondary-dark';
    const accent = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const tags = atom.tags.slice(0, 3);
    const route = memoryAtomRoute(atom);
    const canOpen = Boolean(route && onOpen);

    const handlePress = () => {
        if (!canOpen || !onOpen) return;
        if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onOpen(atom);
    };

    return (
        <Pressable
            onPress={canOpen ? handlePress : undefined}
            disabled={!canOpen}
            testID="memory-ledger-row"
            // `Pressable` is an accessibility element by default, which would
            // group the delete and tag buttons into the row and make them
            // unreachable to a screen reader. Opting out keeps them focusable;
            // the title pressable below carries the row's own open action.
            accessible={false}
            className="flex-row gap-4 py-4"
            style={({ pressed }) => [{ opacity: pressed && canOpen ? 0.92 : 1 }]}
        >
            <View className="w-11 items-end">
                <Text className="text-[13px] uppercase tracking-[1px] text-text-secondary-light dark:text-text-secondary-dark">
                    {showMonth ? date.month : ''}
                </Text>
                <Text
                    testID="memory-ledger-row-day"
                    className={`text-[20px] leading-6 ${dateInkClass}`}
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    {date.day}
                </Text>
                {/* Today's marker: a short accent rule under the day number
                    (prototype `.entry-date.is-today::after`). The prototype
                    animates it in; arrival motion is deliberately not ported —
                    see the ledger's accepted deviation. */}
                {isToday ? (
                    <View
                        testID="memory-ledger-row-today-rule"
                        className="mt-[5px] h-0.5 w-5 rounded-[2px]"
                        style={{ backgroundColor: accent }}
                    />
                ) : null}
            </View>

            <View className="min-w-0 flex-1 gap-2">
                <View className="flex-row items-start justify-between gap-3">
                    <Pressable
                        onPress={canOpen ? handlePress : undefined}
                        disabled={!canOpen}
                        accessibilityRole={canOpen ? 'button' : undefined}
                        accessibilityLabel={canOpen ? `Open memory ${atom.title}` : undefined}
                        className="min-w-0 flex-1"
                    >
                        <Text
                            className="text-[18px] leading-6 text-text-light dark:text-text-dark"
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            numberOfLines={2}
                        >
                            {atom.title}
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => onDelete(atom)}
                        className="h-8 w-8 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel={`Delete memory ${atom.title}`}
                        hitSlop={6}
                    >
                        <MaterialIcons name="more-vert" size={18} color={inkColor} />
                    </Pressable>
                </View>

                <Text
                    className="text-sm leading-5 text-text-secondary-light dark:text-text-secondary-dark"
                    numberOfLines={3}
                >
                    {atom.content}
                </Text>

                <View className="flex-row items-center gap-2">
                    <View
                        className="h-1.5 w-1.5 rounded-full"
                        testID="memory-ledger-row-layer-dot"
                        style={{ backgroundColor: layerColor }}
                        accessibilityLabel={`${MEMORY_LAYER_LABELS[atom.layer]} memory marker`}
                    />
                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                        {MEMORY_LAYER_LABELS[atom.layer]}
                    </Text>
                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                        · {formatRelativeMemoryTime(atom.updatedAt || atom.createdAt)}
                    </Text>
                    {atom.accessCount > 0 ? (
                        <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            · {atom.accessCount} {atom.accessCount === 1 ? 'revisit' : 'revisits'}
                        </Text>
                    ) : null}
                </View>

                {tags.length > 0 ? (
                    <View className="flex-row flex-wrap gap-3">
                        {tags.map((tag) => (
                            <Pressable
                                key={tag}
                                onPress={() => onThemePress(tag)}
                                accessibilityRole="button"
                                accessibilityLabel={`Filter memory by ${tag}`}
                                hitSlop={4}
                            >
                                <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                                    {tag}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                ) : null}
            </View>
        </Pressable>
    );
}
