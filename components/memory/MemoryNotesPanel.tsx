import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface MemoryNotesPanelProps {
    noteText: string;
    generatedNote: string;
    sourceThemes: readonly string[];
    isBusy: boolean;
    onNoteTextChange: (value: string) => void;
    onSaveNote: () => void;
    onSaveGeneratedNote: () => void;
    onRefreshGeneratedNote: () => void;
}

const INPUT_CLASS = [
    'min-h-[72px] rounded-control border border-hairline-light dark:border-hairline-dark',
    'bg-surface-light dark:bg-surface-dark px-4 py-3',
    'text-text-light dark:text-text-dark',
].join(' ');

export function MemoryNotesPanel({
    noteText,
    generatedNote,
    sourceThemes,
    isBusy,
    onNoteTextChange,
    onSaveNote,
    onSaveGeneratedNote,
    onRefreshGeneratedNote,
}: MemoryNotesPanelProps) {
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark ? '#8A8580' : '#6B6560';
    const canSave = noteText.trim().length > 0 && !isBusy;
    const canUseSuggestion = generatedNote.trim().length > 0 && !isBusy;
    const sourceText = sourceThemes.length > 0 ? sourceThemes.join(' · ') : null;

    return (
        <View className="gap-3">
            <TextInput
                value={noteText}
                onChangeText={onNoteTextChange}
                placeholder="Add a private note…"
                placeholderTextColor={placeholderColor}
                multiline
                textAlignVertical="top"
                className={INPUT_CLASS}
                accessibilityLabel="Memory note"
            />

            <View className="flex-row items-center justify-between">
                <Pressable
                    onPress={onSaveNote}
                    disabled={!canSave}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSave }}
                    accessibilityLabel="Save memory note"
                    hitSlop={6}
                    style={({ pressed }) => [{ opacity: !canSave ? 0.4 : pressed ? 0.7 : 1 }]}
                >
                    <Text className="text-sm text-text-light underline dark:text-text-dark">
                        Save note
                    </Text>
                </Pressable>

                {generatedNote || sourceText ? (
                    <Pressable
                        onPress={onRefreshGeneratedNote}
                        disabled={isBusy}
                        className={isBusy ? 'opacity-40' : ''}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isBusy }}
                        accessibilityLabel="Refresh generated memory note"
                        hitSlop={8}
                    >
                        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                            Refresh
                        </Text>
                    </Pressable>
                ) : null}
            </View>

            {generatedNote || sourceText ? (
                <View className="gap-2 border-t border-hairline-light pt-4 dark:border-hairline-dark">
                    <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                        Blackrose noticed
                    </Text>
                    <Text className="text-sm leading-6 text-text-secondary-light dark:text-text-secondary-dark">
                        {generatedNote || 'No stable pattern yet — keep journaling.'}
                    </Text>
                    {sourceText ? (
                        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                            {sourceText}
                        </Text>
                    ) : null}
                    {canUseSuggestion ? (
                        <Pressable
                            onPress={onSaveGeneratedNote}
                            accessibilityRole="button"
                            accessibilityLabel="Save generated memory note"
                            hitSlop={4}
                        >
                            <Text className="text-sm text-text-light underline dark:text-text-dark">
                                Keep this as a note
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
