import React from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Persona } from '@/services/personas/personasStorage.types';
import { PersonaCard } from './PersonaCard';
import { NewPersonaCard } from './NewPersonaCard';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RoseMark } from '@/components/ui/RoseMark';

interface PersonaSheetProps {
    visible: boolean;
    personas: Persona[];
    activePersona?: Persona | null;
    activePersonaId?: string;
    onClose: () => void;
    onSelectPersona: (persona: Persona) => void;
    onCreatePersona: () => void;
    onGeneratePersona?: () => void;
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
    onGeneratePersona,
    onOpenSettings,
}: PersonaSheetProps) {
    const isDark = useColorScheme() === 'dark';
    const accentColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
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
                    className="rounded-t-sheet border-t border-hairline-light bg-surface-light pb-5 dark:border-hairline-dark dark:bg-surface-dark"
                >
                    <View className="items-center pb-1 pt-3">
                        <View
                            testID="persona-sheet-handle"
                            className="h-1 w-10 rounded-full bg-hairline-light dark:bg-hairline-dark"
                        />
                    </View>
                    <View className="flex-row items-center justify-between px-6 py-3">
                        <View className="w-11" />
                        <View className="items-center gap-2">
                            <RoseMark size={30} color={accentColor} strokeWidth={1.2} />
                            <Text
                                className="text-[22px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                Choose voice
                            </Text>
                        </View>
                        <Pressable
                            onPress={handleOpenSettings}
                            disabled={!canOpenSettings}
                            accessibilityLabel="Manage personas"
                            className={`h-11 w-11 items-center justify-center ${canOpenSettings ? '' : 'opacity-40'}`}
                        >
                            <MaterialIcons name="grid-view" size={20} color={accentColor} />
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
                        <NewPersonaCard onCreate={onCreatePersona} onGenerate={onGeneratePersona} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
