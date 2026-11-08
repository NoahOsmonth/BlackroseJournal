import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { navAwareBottomPadding } from '@/constants/spacing';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLetters } from '@/hooks/letters/useLetters';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import { getLocalDateKey } from '@/utils/date';
import { letterDraftIssue } from '@/utils/letters';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' } as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2027-01-01' → '1 Jan 2027'. The one place a raw stored key becomes words. */
function formatDay(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return key;
    return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** The nearest future day a writer would plausibly want: two months out. */
function suggestedUnlockKey(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return getLocalDateKey(d);
}

export default function LettersScreen() {
    const insets = useSafeAreaInsets();
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const { letters, isLoading, error, seal, discard } = useLetters();

    const [isComposing, setIsComposing] = useState(false);
    const [body, setBody] = useState('');
    const [unlockDate, setUnlockDate] = useState(suggestedUnlockKey);
    const [issue, setIssue] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const todayKey = useMemo(() => getLocalDateKey(), []);
    const sealed = letters.filter((l) => !l.isUnlocked);
    const opened = letters.filter((l) => l.isUnlocked);

    const handleSeal = async () => {
        const problem = letterDraftIssue(body, unlockDate, todayKey);
        setIssue(problem ? problem.message : null);
        if (problem) return;
        const ok = await seal(body.trim(), unlockDate);
        if (ok) {
            setBody('');
            setSaved(true);
            setIsComposing(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="w-full max-w-md flex-1 self-center">
                <View className="flex-row items-center justify-between px-6 py-4">
                    <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center" accessibilityRole="button" accessibilityLabel="Back">
                        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                    </Pressable>
                    <Text className="text-[22px] text-text-light dark:text-text-dark" style={SERIF}>Letters</Text>
                    <Pressable
                        onPress={() => { setIsComposing(true); setSaved(false); }}
                        className="h-10 w-10 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Write a letter to your future self"
                        hitSlop={8}
                    >
                        <MaterialIcons name="edit" size={22} color={iconColor} />
                    </Pressable>
                </View>
                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }} showsVerticalScrollIndicator={false}>
                    <View className="gap-8">
                        {saved ? (
                            <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                Sealed. It opens on the day you picked, and not before.
                            </Text>
                        ) : null}
                        {error ? (
                            <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">{error}</Text>
                        ) : null}

                        {isComposing ? (
                            <View className="gap-4 rounded-card border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark p-5">
                                <Text className="text-[11px] uppercase tracking-[1.6px] text-text-secondary-light dark:text-text-secondary-dark">New letter</Text>
                                <TextInput
                                    value={body}
                                    onChangeText={setBody}
                                    multiline
                                    placeholder="Write to the you that will read this later…"
                                    placeholderTextColor={isDark ? '#8A8580' : '#6B6560'}
                                    className="min-h-[120px] text-[15px] text-text-light dark:text-text-dark"
                                    style={{ textAlignVertical: 'top' }}
                                    accessibilityLabel="Your letter"
                                />
                                <TextInput
                                    value={unlockDate}
                                    onChangeText={setUnlockDate}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor={isDark ? '#8A8580' : '#6B6560'}
                                    className="rounded-control border border-hairline-light dark:border-hairline-dark px-3 py-2 text-[15px] text-text-light dark:text-text-dark"
                                    accessibilityLabel="Day this letter opens"
                                />
                                <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                                    Opens on {formatDay(unlockDate)}
                                </Text>
                                {issue ? (
                                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">{issue}</Text>
                                ) : null}
                                <View className="flex-row gap-4">
                                    <Pressable onPress={() => void handleSeal()} accessibilityRole="button" accessibilityLabel="Seal this letter">
                                        <Text className="text-[15px] text-text-light dark:text-text-dark">Seal it</Text>
                                    </Pressable>
                                    <Pressable onPress={() => { setIsComposing(false); setIssue(null); }} accessibilityRole="button" accessibilityLabel="Cancel this letter">
                                        <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">Not now</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : null}

                        {isLoading ? (
                            <LoadingStatus label="Opening your letters…" />
                        ) : (
                            <>
                                <SealedList letters={sealed} onDiscard={discard} />
                                <OpenedList letters={opened} />
                            </>
                        )}
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

function SealedList({ letters, onDiscard }: { letters: ReturnType<typeof useLetters>['letters']; onDiscard: (id: string) => Promise<void> }) {
    if (letters.length === 0) {
        return (
            <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                No sealed letters yet. Write one and pick the day it should open.
            </Text>
        );
    }
    return (
        <View className="gap-3">
            <Text className="text-[11px] uppercase tracking-[1.6px] text-text-secondary-light dark:text-text-secondary-dark">Waiting</Text>
            {letters.map((letter) => (
                <View key={letter.id} className="gap-2 rounded-card border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark p-5">
                    <Text className="text-[15px] text-text-light dark:text-text-dark" style={SERIF}>Sealed letter</Text>
                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                        Opens {letter.unlockLabel} · written {formatDay(letter.writtenDate)}
                    </Text>
                    <Pressable onPress={() => void onDiscard(letter.id)} accessibilityRole="button" accessibilityLabel={`Delete the letter that opens ${letter.unlockLabel}`}>
                        <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">Delete</Text>
                    </Pressable>
                </View>
            ))}
        </View>
    );
}

function OpenedList({ letters }: { letters: ReturnType<typeof useLetters>['letters'] }) {
    if (letters.length === 0) return null;
    return (
        <View className="gap-3">
            <Text className="text-[11px] uppercase tracking-[1.6px] text-text-secondary-light dark:text-text-secondary-dark">Opened</Text>
            {letters.map((letter) => (
                <View key={letter.id} className="gap-2 rounded-card border border-hairline-light dark:border-hairline-dark bg-surface-light dark:bg-surface-dark p-5">
                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">Written {formatDay(letter.writtenDate)}</Text>
                    <Text className="text-[15px] leading-[24px] text-text-light dark:text-text-dark">{letter.body ?? ''}</Text>
                </View>
            ))}
        </View>
    );
}
