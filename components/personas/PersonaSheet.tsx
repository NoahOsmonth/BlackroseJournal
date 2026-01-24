import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Persona } from '@/services/personas/personasStorage.types';
import { PersonaCard } from './PersonaCard';
import { NewPersonaCard } from './NewPersonaCard';

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
    const settingsTarget = activePersona ?? personas[0];
    const canOpenSettings = Boolean(settingsTarget);

    const handleOpenSettings = () => {
        if (settingsTarget) {
            onOpenSettings(settingsTarget);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <Pressable className="flex-1" onPress={onClose} />
                <View className="bg-black rounded-t-[40px] border-t border-white/5 pb-10">
                    <View className="items-center pt-3">
                        <View className="w-8 h-1 bg-gray-600 rounded-full" />
                    </View>
                    <View className="flex-row items-center justify-between px-6 py-4">
                        <View className="w-6" />
                        <Text className="text-[17px] font-semibold text-white">Choose persona</Text>
                        <Pressable
                            onPress={handleOpenSettings}
                            disabled={!canOpenSettings}
                            accessibilityLabel="Manage personas"
                            className={canOpenSettings ? '' : 'opacity-40'}
                        >
                            <MaterialIcons name="grid-view" size={20} color="#9CA3AF" />
                        </Pressable>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 20, gap: 16 }}
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
