import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Persona } from '@/services/personas/personasStorage.types';
import { getPersonaAvatarSource } from '@/constants/personas';

const defaultAvatar = require('@/assets/personas/persona-default.png');

interface PersonaCardProps {
    persona: Persona;
    isActive: boolean;
    onSelect: (persona: Persona) => void;
    onOpenSettings: (persona: Persona) => void;
}

export function PersonaCard({ persona, isActive, onSelect, onOpenSettings }: PersonaCardProps) {
    const avatarSource = getPersonaAvatarSource(persona.avatarKey) ?? defaultAvatar;

    return (
        <View className="snap-center shrink-0 w-[82vw] max-w-[340px] bg-card-dark rounded-3xl p-6 flex flex-col items-center relative border border-white/5 h-[360px]">
            <Pressable
                onPress={() => onOpenSettings(persona)}
                className="absolute top-5 right-5"
                accessibilityLabel="Open persona settings"
            >
                <MaterialIcons name="settings" size={22} color="#6B7280" />
            </Pressable>
            <View className="mt-8 mb-6 w-[88px] h-[88px] rounded-full bg-primary items-center justify-center shadow-lg">
                <Image source={avatarSource} style={{ width: 88, height: 88, borderRadius: 44 }} />
            </View>
            <Text className="text-[20px] font-bold text-white mb-1 tracking-tight">{persona.name}</Text>
            <Text className="text-[15px] text-gray-400 font-medium mb-auto">{persona.tagline}</Text>
            <Pressable
                onPress={() => onSelect(persona)}
                className="w-full py-4 px-6 rounded-2xl border border-white/10 bg-[#252527] flex items-center justify-center"
                accessibilityLabel={isActive ? 'Active persona' : 'Activate persona'}
            >
                {isActive ? (
                    <View className="flex-row items-center gap-2">
                        <View className="bg-[#22C55E] rounded-full p-0.5 items-center justify-center">
                            <MaterialIcons name="check" size={14} color="#000000" />
                        </View>
                        <Text className="text-[15px] font-semibold text-white">Active</Text>
                    </View>
                ) : (
                    <Text className="text-[15px] font-semibold text-white">Set active</Text>
                )}
            </Pressable>
        </View>
    );
}
