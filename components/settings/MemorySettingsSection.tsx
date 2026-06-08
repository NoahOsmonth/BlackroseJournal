import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import { SettingsSection } from './SettingsSection';

interface MemorySettingsSectionProps {
    readonly atoms: LocalMemoryAtom[];
    readonly noteText: string;
    readonly generatedNote: string;
    readonly isBusy: boolean;
    readonly onNoteTextChange: (value: string) => void;
    readonly onSaveNote: () => void;
    readonly onSaveGeneratedNote: () => void;
    readonly onRefreshGeneratedNote: () => void;
    readonly onClearMemory: () => void;
}

const SECONDARY_TEXT_CLASS = 'text-subtext-light dark:text-subtext-dark';
const INPUT_CLASS = [
    'min-h-[78px] rounded-xl border border-divider-light dark:border-divider-dark',
    'bg-background-light dark:bg-background-dark px-3 py-3',
    'text-text-light dark:text-text-dark',
].join(' ');

function findProfilePreview(atoms: readonly LocalMemoryAtom[]): string {
    const profile = atoms.find((atom) => atom.layer === 'profile');
    return profile?.content ?? 'No about-user memory yet.';
}

function countLayer(atoms: readonly LocalMemoryAtom[], layer: LocalMemoryAtom['layer']): number {
    return atoms.filter((atom) => atom.layer === layer).length;
}

function MemoryMetric({ label, value }: { readonly label: string; readonly value: number }) {
    return (
        <View className="flex-1">
            <Text className="text-lg font-bold text-text-light dark:text-text-dark">
                {value}
            </Text>
            <Text className={`text-xs ${SECONDARY_TEXT_CLASS}`}>
                {label}
            </Text>
        </View>
    );
}

export function MemorySettingsSection({
    atoms,
    noteText,
    generatedNote,
    isBusy,
    onNoteTextChange,
    onSaveNote,
    onSaveGeneratedNote,
    onRefreshGeneratedNote,
    onClearMemory,
}: MemorySettingsSectionProps) {
    const isDark = useColorScheme() === 'dark';
    const primaryIconColor = isDark ? '#111827' : '#111827';
    const neutralIconColor = isDark ? '#F9FAFB' : '#111827';
    const dangerColor = isDark ? '#F87171' : '#DC2626';
    const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
    const canSave = noteText.trim().length > 0 && !isBusy;
    const canSaveGenerated = generatedNote.trim().length > 0 && !isBusy;

    return (
        <SettingsSection title="Memory">
            <View className="flex-row mb-4">
                <MemoryMetric label="Total" value={atoms.length} />
                <MemoryMetric label="About user" value={countLayer(atoms, 'profile')} />
                <MemoryMetric label="Notes" value={countLayer(atoms, 'note')} />
            </View>

            <View className="mb-4">
                <Text className={`text-xs font-bold uppercase mb-2 ${SECONDARY_TEXT_CLASS}`}>
                    About user
                </Text>
                <Text className="text-sm text-text-light dark:text-text-dark leading-relaxed">
                    {findProfilePreview(atoms)}
                </Text>
            </View>

            <View className="mb-4 rounded-xl border border-divider-light dark:border-divider-dark p-3">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className={`text-xs font-bold uppercase ${SECONDARY_TEXT_CLASS}`}>
                        Generated note
                    </Text>
                    <TouchableOpacity
                        onPress={onRefreshGeneratedNote}
                        disabled={isBusy}
                        className={isBusy ? 'opacity-50' : ''}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isBusy }}
                        accessibilityLabel="Refresh generated memory note"
                    >
                        <Ionicons name="refresh-outline" size={18} color={neutralIconColor} />
                    </TouchableOpacity>
                </View>
                <Text className="text-sm text-text-light dark:text-text-dark leading-relaxed">
                    {generatedNote || 'No stable local memory pattern yet.'}
                </Text>
                <TouchableOpacity
                    onPress={onSaveGeneratedNote}
                    disabled={!canSaveGenerated}
                    className={[
                        'flex-row items-center justify-center gap-2 mt-3 px-4 py-3 rounded-xl',
                        'bg-background-light dark:bg-secondary-dark',
                        canSaveGenerated ? '' : 'opacity-50'
                    ].join(' ')}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSaveGenerated }}
                >
                    <Ionicons name="sparkles-outline" size={18} color={neutralIconColor} />
                    <Text className="font-bold text-text-light dark:text-text-dark">
                        Save generated note
                    </Text>
                </TouchableOpacity>
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

            <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                    onPress={onSaveNote}
                    disabled={!canSave}
                    className={`flex-row items-center gap-2 px-4 py-3 rounded-xl bg-primary ${
                        canSave ? '' : 'opacity-50'
                    }`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSave }}
                >
                    <Ionicons name="save-outline" size={18} color={primaryIconColor} />
                    <Text className="font-bold text-text-light dark:text-text-light">
                        Save note
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onClearMemory}
                    disabled={isBusy || atoms.length === 0}
                    className="flex-row items-center gap-2 px-4 py-3 rounded-xl"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isBusy || atoms.length === 0 }}
                >
                    <Ionicons name="trash-outline" size={18} color={dangerColor} />
                    <Text className="font-bold text-red-600 dark:text-red-400">
                        Clear
                    </Text>
                </TouchableOpacity>
            </View>
        </SettingsSection>
    );
}
