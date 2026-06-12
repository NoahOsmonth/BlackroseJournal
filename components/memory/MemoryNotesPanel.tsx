import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
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
    'min-h-[84px] rounded-lg border border-divider-light dark:border-divider-dark',
    'bg-surface-light dark:bg-surface-dark px-3 py-3',
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
    const iconColor = isDark ? Colors.dark.text : Colors.light.text;
    const primaryIconColor = Colors.light.text;
    const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
    const canSave = noteText.trim().length > 0 && !isBusy;
    const canSaveGenerated = generatedNote.trim().length > 0 && !isBusy;
    const sourceText = sourceThemes.length > 0
        ? `Source themes: ${sourceThemes.join(', ')}`
        : 'Source themes appear after more completed journal entries.';

    return (
        <View className="gap-4">
            <Text className="text-xs font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">
                Notes
            </Text>

            <View className="rounded-lg border border-divider-light bg-surface-light p-4 dark:border-divider-dark dark:bg-surface-dark">
                <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                        <MaterialIcons name="auto-awesome" size={18} color={iconColor} />
                        <Text className="text-xs font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">
                            Generated note
                        </Text>
                    </View>
                    <Pressable
                        onPress={onRefreshGeneratedNote}
                        disabled={isBusy}
                        className={isBusy ? 'opacity-50' : ''}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isBusy }}
                        accessibilityLabel="Refresh generated memory note"
                    >
                        <MaterialIcons name="refresh" size={20} color={iconColor} />
                    </Pressable>
                </View>

                <Text className="text-sm leading-5 text-text-light dark:text-text-dark">
                    {generatedNote || "Rosebud hasn't noticed a stable pattern yet — keep journaling and I'll learn more about you."}
                </Text>
                <Text className="mt-2 text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {sourceText}
                </Text>

                <Pressable
                    onPress={onSaveGeneratedNote}
                    disabled={!canSaveGenerated}
                    className={[
                        'mt-4 flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3',
                        canSaveGenerated ? '' : 'opacity-50',
                    ].join(' ')}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSaveGenerated }}
                    accessibilityLabel="Save generated memory note"
                >
                    <MaterialIcons name="save" size={18} color={primaryIconColor} />
                    <Text className="font-bold text-text-light dark:text-text-light">
                        Save generated note
                    </Text>
                </Pressable>
            </View>

            <TextInput
                value={noteText}
                onChangeText={onNoteTextChange}
                placeholder="Add a memory note"
                placeholderTextColor={placeholderColor}
                multiline
                textAlignVertical="top"
                className={INPUT_CLASS}
                accessibilityLabel="Memory note"
            />

            <Pressable
                onPress={onSaveNote}
                disabled={!canSave}
                className={[
                    'flex-row items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3',
                    canSave ? '' : 'opacity-50',
                ].join(' ')}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                accessibilityLabel="Save memory note"
            >
                <MaterialIcons name="note-add" size={18} color={primaryIconColor} />
                <Text className="font-bold text-text-light dark:text-text-light">
                    Save note
                </Text>
            </Pressable>
        </View>
    );
}
