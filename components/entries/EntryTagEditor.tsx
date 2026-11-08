/**
 * A small, quiet editor for the labels a writer chose for one entry.
 * Pure rendering + hook calls; storage lives in services/journal/entryTags.ts.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { type UseEntryTagsReturn } from '@/hooks/journal/useEntryTags';
import { formatTagLabel, normalizeTag } from '@/utils/entryTags';
import { BLACKROSE_PALETTE } from '@/constants/theme';

interface EntryTagEditorProps {
    readonly entryId: string;
    readonly tags: UseEntryTagsReturn;
}

export function EntryTagEditor({ entryId, tags }: EntryTagEditorProps) {
    const [draft, setDraft] = useState('');
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const placeholder = isDark
        ? BLACKROSE_PALETTE.dark.text2
        : BLACKROSE_PALETTE.light.text2;
    const labels = tags.tagsFor(entryId);
    const canAdd = normalizeTag(draft).length > 0;

    const add = () => {
        if (!canAdd) return;
        void tags.addTag(entryId, draft);
        setDraft('');
    };

    return (
        <View className="gap-3 py-4" testID="entry-tag-editor">
            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                Your labels
            </Text>
            {labels.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                    {labels.map((label) => (
                        <Pressable
                            key={label}
                            onPress={() => { void tags.removeTag(entryId, label); }}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove label ${formatTagLabel(label)}`}
                            testID={`entry-tag-${label}`}
                            className="min-h-11 flex-row items-center gap-2 rounded-full border border-hairline-light bg-surface-light px-4 dark:border-hairline-dark dark:bg-surface-dark"
                        >
                            <Text className="text-[14px] text-text-light dark:text-text-dark">
                                {formatTagLabel(label)}
                            </Text>
                            <MaterialIcons name="close" size={15} color={ink} />
                        </Pressable>
                    ))}
                </View>
            ) : (
                <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                    Add a word to find this entry later.
                </Text>
            )}
            <View className="flex-row items-center gap-2">
                <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    onSubmitEditing={add}
                    returnKeyType="done"
                    placeholder="A word for this entry"
                    placeholderTextColor={placeholder}
                    accessibilityLabel="A word for this entry"
                    testID="entry-tag-input"
                    className="min-h-11 flex-1 rounded-control border border-hairline-light px-4 text-[14px] text-text-light dark:border-hairline-dark dark:text-text-dark"
                />
                <Pressable
                    onPress={add}
                    accessibilityRole="button"
                    accessibilityLabel="Add this label"
                    accessibilityState={{ disabled: !canAdd }}
                    testID="entry-tag-add"
                    className="min-h-11 justify-center rounded-control border border-accent-green px-4 dark:border-accent-green-dark"
                >
                    <Text className="text-[14px] text-text-light dark:text-text-dark">Add</Text>
                </Pressable>
            </View>
        </View>
    );
}
