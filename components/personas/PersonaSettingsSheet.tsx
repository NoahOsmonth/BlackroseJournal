import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Persona } from '@/services/personas/personasStorage.types';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

interface PersonaSettingsSheetProps {
    visible: boolean;
    persona: Persona | null;
    onClose: () => void;
    onEdit: (persona: Persona) => void;
    onAdvanced: (persona: Persona) => void;
    onDelete: (persona: Persona) => void;
}

export function PersonaSettingsSheet({
    visible,
    persona,
    onClose,
    onEdit,
    onAdvanced,
    onDelete,
}: PersonaSettingsSheetProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const iconSecondaryColor = isDark ? '#9CA3AF' : '#6B7280';
    const iconDangerColor = isDark ? '#F87171' : '#EF4444';

    if (!persona) {
        return null;
    }

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close persona settings" />
                <View className="bg-surface-light dark:bg-surface-dark rounded-t-3xl px-6 pt-4 pb-8">
                    <View className="items-center mb-4">
                        <View className="w-10 h-1 bg-divider-light dark:bg-divider-dark rounded-full" />
                    </View>
                    <View className="items-center mb-5">
                        <Text className="text-[26px] leading-[34px] text-text-light dark:text-text-dark" style={SERIF}>
                            Persona settings
                        </Text>
                        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                            {persona.name}
                        </Text>
                    </View>
                    <View className="gap-2">
                        <Pressable
                            onPress={() => onEdit(persona)}
                            className="min-h-14 flex-row items-center gap-3 rounded-control border border-hairline-light px-4 py-3.5 dark:border-hairline-dark"
                            accessibilityLabel="Edit persona"
                        >
                            <MaterialIcons
                                name="edit"
                                size={20}
                                color={iconSecondaryColor}
                            />
                            <Text className="text-base text-text-light dark:text-text-dark">Edit persona</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onAdvanced(persona)}
                            className="min-h-14 flex-row items-center gap-3 rounded-control border border-hairline-light px-4 py-3.5 dark:border-hairline-dark"
                            accessibilityLabel="Advanced settings"
                        >
                            <MaterialIcons
                                name="auto-awesome"
                                size={20}
                                color={iconSecondaryColor}
                            />
                            <Text className="text-base text-text-light dark:text-text-dark">Advanced settings</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onDelete(persona)}
                            className="min-h-14 flex-row items-center gap-3 rounded-control border border-hairline-light px-4 py-3.5 dark:border-hairline-dark"
                            accessibilityLabel="Delete persona"
                        >
                            <MaterialIcons name="delete-outline" size={20} color={iconDangerColor} />
                            <Text className="text-base text-red-500 dark:text-red-400">Delete persona</Text>
                        </Pressable>
                    </View>
                    <Pressable
                        onPress={onClose}
                        className="mt-6 py-3 items-center"
                        accessibilityLabel="Close persona settings"
                    >
                        <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                            Close
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}
