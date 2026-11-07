import { Pressable, Text, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EntryTaskSuggestions } from '@/hooks/tasks/useEntryTaskSuggestions';
import { BLACKROSE_PALETTE } from '@/constants/theme';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' } as const;

interface TaskSuggestionsProps {
    state: EntryTaskSuggestions;
}

/**
 * The tasks an entry seems to ask for, offered as taps.
 *
 * A proposal, never a write: the writer taps what they mean to do and skips the
 * rest. When the AI finds nothing, or is switched off, the whole block stays
 * out of the way rather than showing an empty box.
 */
export function TaskSuggestions({ state }: TaskSuggestionsProps) {
    const isDark = useColorScheme() === 'dark';
    const mutedColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const accentColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;

    const hasSomething = state.suggestions.length > 0 || state.kept.length > 0;
    if (!hasSomething && !state.isLoading) return null;

    return (
        <View
            className="mt-6 rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark"
            accessibilityLabel="Tasks this entry suggests"
        >
            <Text
                className="text-[19px] text-text-light dark:text-text-dark"
                style={SERIF}
            >
                Anything to do from this?
            </Text>

            {state.isLoading && (
                <Text className="mt-2 text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                    Looking for tasks in what you wrote…
                </Text>
            )}

            {state.suggestions.map((title) => (
                <Pressable
                    key={title}
                    onPress={() => void state.keep(title)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add task: ${title}`}
                    className="mt-3 min-h-11 flex-row items-center justify-between gap-3 rounded-control border border-bone-light px-4 py-3 active:opacity-70 dark:border-bone-dark"
                >
                    <Text className="flex-1 text-[15px] text-text-light dark:text-text-dark">
                        {title}
                    </Text>
                    <Text className="text-[14px]" style={{ color: accentColor }}>
                        Add
                    </Text>
                </Pressable>
            ))}

            {state.kept.length > 0 && (
                <Text
                    className="mt-3 text-[13px] text-text-secondary-light dark:text-text-secondary-dark"
                    accessibilityLabel={`Added ${state.kept.length} task${state.kept.length === 1 ? '' : 's'}`}
                >
                    {state.kept.length === 1
                        ? `Added “${state.kept[0]}” to your goals.`
                        : `Added ${state.kept.length} tasks to your goals.`}
                </Text>
            )}

            {state.error && (
                <Text className="mt-3 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                    {state.error}
                </Text>
            )}

            {state.suggestions.length > 0 && (
                <Pressable
                    onPress={state.dismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Hide task suggestions"
                    className="mt-2 min-h-11 justify-center self-end active:opacity-70"
                >
                    <Text className="text-[14px]" style={{ color: mutedColor }}>
                        Not now
                    </Text>
                </Pressable>
            )}
        </View>
    );
}
