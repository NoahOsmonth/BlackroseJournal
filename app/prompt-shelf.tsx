import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useSavedStarters } from '@/hooks/prompts/useSavedStarters';
import { useWrittenStarters } from '@/hooks/prompts/useWrittenStarters';
import {
    PROMPT_PACKS,
    packProgress,
    promptsInPack,
    savedPrompts,
    writtenIdsInPack,
    type PromptPack,
} from '@/utils/promptPacks';
import type { GuidedPrompt } from '@/utils/guidedPrompts';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';
const CARD = 'rounded-card border border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark';

interface StarterRowProps {
    readonly prompt: GuidedPrompt;
    readonly saved: boolean;
    readonly written: boolean;
    readonly onPick: (opening: string, starterId: string) => void;
    readonly onToggle: (id: string) => void;
    readonly iconColor: string;
}

/** One starter: tap to write, tap the star to keep it for later. */
function StarterRow({ prompt, saved, written, onPick, onToggle, iconColor }: StarterRowProps) {
    return (
        <View className={'flex-row items-center border-b border-hairline-light dark:border-hairline-dark ' + (saved ? '' : 'last:border-b-0')}>
            <Pressable
                onPress={() => onPick(prompt.opening, prompt.id)}
                accessibilityRole="button"
                accessibilityLabel={'Start with: ' + prompt.opening}
                testID={'prompt-starter-' + prompt.id}
                className="min-h-11 flex-1 justify-center px-1 py-2"
            >
                <Text className="text-[15px] text-text-light dark:text-text-dark" numberOfLines={1}>
                    {prompt.label}
                </Text>
                <Text className={'mt-1 text-[13px] ' + SECONDARY} numberOfLines={1}>
                    {prompt.opening}
                </Text>
                {written ? (
                    <Text className={'mt-1 text-[11px] ' + SECONDARY} testID={'starter-written-' + prompt.id}>
                        Written
                    </Text>
                ) : null}
            </Pressable>
            <Pressable
                onPress={() => onToggle(prompt.id)}
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Remove from saved starters' : 'Save this starter'}
                testID={'saved-starter-' + prompt.id}
                className="min-h-11 min-w-11 items-center justify-center"
            >
                <MaterialIcons
                    name={saved ? 'star' : 'star-border'}
                    size={22}
                    color={iconColor}
                />
            </Pressable>
        </View>
    );
}

/**
 * A quiet bar: how many starters in this pack became finished entries.
 * RN-Web has no 'progressbar' role mapping for a plain View, so the
 * plain-language accessibilityLabel is the web reader's value; native keeps
 * the full accessibilityValue object.
 */
function PackProgressBar({ pack, done, total }: { readonly pack: PromptPack; readonly done: number; readonly total: number }) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
        <View className="mt-3">
            <View
                testID={'pack-progress-' + pack.id}
                accessibilityRole="progressbar"
                accessibilityLabel={done + ' of ' + total + ' written'}
                accessibilityValue={{ min: 0, max: total, now: done, text: done + ' of ' + total + ' written' }}
                className="h-[6px] w-full overflow-hidden rounded-full bg-hairline-light dark:bg-hairline-dark"
            >
                <View
                    testID={'pack-progress-fill-' + pack.id}
                    className="h-full rounded-full bg-accent-green dark:bg-accent-green-dark"
                    style={{ width: `${pct}%` as `${number}%` }}
                />
            </View>
            <Text className={'mt-2 text-[12px] ' + SECONDARY} testID={'pack-progress-text-' + pack.id}>
                {done} of {total} written
            </Text>
        </View>
    );
}

interface PackCardProps extends Omit<StarterRowProps, 'prompt' | 'saved' | 'written'> {
    readonly pack: PromptPack;
    readonly isSaved: (id: string) => boolean;
    readonly writtenIds: readonly string[];
}

function PackCard({ pack, isSaved, writtenIds, ...row }: PackCardProps) {
    const progress = packProgress(pack, writtenIds);
    const written = writtenIdsInPack(pack, writtenIds);
    return (
        <View className={'mt-5 px-4 py-4 ' + CARD} testID={'pack-card-' + pack.id}>
            <Text className="text-[20px] text-text-light dark:text-text-dark" style={SERIF}>
                {pack.title}
            </Text>
            <Text className={'mt-1 text-[13px] ' + SECONDARY}>
                {pack.description}
            </Text>
            <PackProgressBar pack={pack} done={progress.done} total={progress.total} />
            <View className="mt-2">
                {promptsInPack(pack).map((prompt) => (
                    <StarterRow
                        key={prompt.id}
                        prompt={prompt}
                        saved={isSaved(prompt.id)}
                        written={written.has(prompt.id)}
                        onPick={row.onPick}
                        onToggle={row.onToggle}
                        iconColor={row.iconColor}
                    />
                ))}
            </View>
        </View>
    );
}

/**
 * The prompt shelf (Kaneo #83): every starter grouped into themed packs,
 * with a quick-access row of favorites at the top. Nothing is written until
 * a starter is opened in chat and sent. Data is local only.
 */
export default function PromptShelfScreen() {
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const back = useNavBack('/(tabs)/today');
    const { savedIds, toggle, has } = useSavedStarters();
    const { writtenIds } = useWrittenStarters();
    const writtenSet = React.useMemo(() => new Set(writtenIds), [writtenIds]);

    const onPick = (opening: string, starterId: string) => {
        router.push({ pathname: '/chat', params: { seed: opening, starterId } });
    };

    const favorites = savedPrompts(savedIds);

    return (
        <ScreenContainer edges="top">
            <View className="mx-auto w-full max-w-md flex-1 px-5 pt-4">
                <View className="flex-row items-center justify-between">
                    <Pressable
                        onPress={back}
                        className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={ink} />
                    </Pressable>
                    <Text className="text-[26px] leading-[1.2] text-text-light dark:text-text-dark" style={SERIF}>
                        Starting points
                    </Text>
                    <View className="min-w-11" />
                </View>
                <ScrollView className="mt-2" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    <Text className={'mt-4 text-[14px] leading-[1.5] ' + SECONDARY}>
                        A little help when the page is blank. Pick one to start writing, or save it for later.
                    </Text>

                    {favorites.length > 0 ? (
                        <View className={'mt-5 px-4 py-4 ' + CARD} testID="saved-starters-section">
                            <Text className="text-[20px] text-text-light dark:text-text-dark" style={SERIF}>
                                Saved starters
                            </Text>
                            <Text className={'mt-1 text-[13px] ' + SECONDARY}>
                                The ones you kept close.
                            </Text>
                            <View className="mt-2">
                                {favorites.map((prompt) => (
                                    <StarterRow
                                        key={prompt.id}
                                        prompt={prompt}
                                        saved={true}
                                        written={writtenSet.has(prompt.id)}
                                        onPick={onPick}
                                        onToggle={toggle}
                                        iconColor={iconColor}
                                    />
                                ))}
                            </View>
                        </View>
                    ) : (
                        <Text className={'mt-5 text-[13px] ' + SECONDARY} testID="no-saved-starters">
                            No saved starters yet. Tap a star to keep one here.
                        </Text>
                    )}

                    {PROMPT_PACKS.map((pack) => (
                        <PackCard
                            key={pack.id}
                            pack={pack}
                            isSaved={has}
                            writtenIds={writtenIds}
                            onPick={onPick}
                            onToggle={toggle}
                            iconColor={iconColor}
                        />
                    ))}
                </ScrollView>
            </View>
        </ScreenContainer>
    );
}
