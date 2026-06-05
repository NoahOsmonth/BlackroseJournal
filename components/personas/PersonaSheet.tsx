import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Persona } from '@/services/personas/personasStorage.types';
import { PersonaCard } from './PersonaCard';
import { NewPersonaCard } from './NewPersonaCard';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface PersonaSheetProps {
    visible: boolean;
    personas: Persona[];
    activePersona?: Persona | null;
    activePersonaId?: string;
    onClose: () => void;
    onSelectPersona: (persona: Persona) => void;
    onCreatePersona: () => void;
    onOpenSettings: (persona: Persona) => void;
}

export function PersonaSheet({
    visible,
    personas,
    activePersona,
    activePersonaId,
    onClose,
    onSelectPersona,
    onCreatePersona,
    onOpenSettings,
}: PersonaSheetProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const gridIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.icon;
    const overlayPositionClass = Platform.OS === 'web' ? 'fixed' : 'absolute';
    const modalAnimationType = Platform.OS === 'web' ? 'none' : 'slide';
    const settingsTarget = activePersona ?? personas[0];
    const canOpenSettings = Boolean(settingsTarget);

    const handleOpenSettings = () => {
        if (settingsTarget) {
            onOpenSettings(settingsTarget);
        }
    };

    return (
        <Modal visible={visible} animationType={modalAnimationType} transparent>
            <View
                testID="persona-sheet-overlay"
                className={`${overlayPositionClass} inset-0 flex-1 bg-black/60 dark:bg-black/80 justify-end`}
            >
                <Pressable className="flex-1" onPress={onClose} />
                <View
                    testID="persona-sheet-panel"
                    className="bg-surface-light dark:bg-surface-dark rounded-t-3xl border-t border-gray-200 dark:border-gray-800 pb-5"
                >
                    <View className="items-center pt-3 pb-1">
                        <View
                            testID="persona-sheet-handle"
                            className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"
                        />
                    </View>
                    <View className="flex-row items-center justify-between px-6 py-3">
                        <View className="w-6" />
                        <Text className="text-lg font-semibold text-text-light dark:text-white">
                            Choose persona
                        </Text>
                        <Pressable
                            onPress={handleOpenSettings}
                            disabled={!canOpenSettings}
                            accessibilityLabel="Manage personas"
                            className={canOpenSettings ? '' : 'opacity-40'}
                        >
                            <MaterialIcons name="grid-view" size={20} color={gridIconColor} />
                        </Pressable>
                    </View>
                    <ScrollView
                        testID="persona-sheet-cards"
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingLeft: 24,
                            paddingRight: 16,
                            paddingTop: 16,
                            paddingBottom: 40,
                            gap: 16,
                        }}
                        snapToAlignment="center"
                        decelerationRate="fast"
                    >
                        {personas.map((persona) => (
                            <PersonaCard
                                key={persona.id}
                                persona={persona}
                                isActive={persona.id === activePersonaId}
                                onSelect={onSelectPersona}
                                onOpenSettings={onOpenSettings}
                            />
                        ))}
                        <NewPersonaCard onCreate={onCreatePersona} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
