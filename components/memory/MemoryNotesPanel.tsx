import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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
    'min-h-[72px] rounded-xl border border-divider-light dark:border-divider-dark',
    'bg-background-light dark:bg-background-dark px-3 py-3',
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
    const iconColor = isDark ? '#F9FAFB' : '#111827';
    const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
    const canSave = noteText.trim().length > 0 && !isBusy;
    const canUseSuggestion = generatedNote.trim().length > 0 && !isBusy;
    const sourceText = sourceThemes.length > 0 ? sourceThemes.join(' · ') : null;

    return (
        <View className="gap-3 rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark p-4">
            <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                Pin a note for Rosebud
            </Text>

            <TextInput
                value={noteText}
                onChangeText={onNoteTextChange}
                placeholder="Something you want remembered…"
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
                    'flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 dark:bg-primary-dark',
                    canSave ? '' : 'opacity-50',
                ].join(' ')}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                accessibilityLabel="Save memory note"
            >
                <MaterialIcons name="note-add" size={18} color={isDark ? '#111827' : '#FFFFFF'} />
                <Text className="font-semibold text-white dark:text-gray-900">
                    Save note
                </Text>
            </Pressable>

            {generatedNote || sourceText ? (
                <View className="gap-2 border-t border-divider-light dark:border-divider-dark pt-3">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                            Rosebud&apos;s suggestion
                        </Text>
                        <Pressable
                            onPress={onRefreshGeneratedNote}
                            disabled={isBusy}
                            className={isBusy ? 'opacity-50' : ''}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isBusy }}
                            accessibilityLabel="Refresh generated memory note"
                            hitSlop={8}
                        >
                            <MaterialIcons name="refresh" size={16} color={iconColor} />
                        </Pressable>
                    </View>
                    <Text className="text-sm leading-5 text-text-secondary-light dark:text-text-secondary-dark">
                        {generatedNote || "No stable pattern yet — keep journaling."}
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
                            <Text className="text-sm font-semibold text-primary dark:text-primary-dark">
                                Use this suggestion
                            </Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}
