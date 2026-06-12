import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Persona } from '@/services/personas/personasStorage.types';
import { getPersonaAvatarSource } from '@/constants/personas';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

const defaultAvatar = require('@/assets/personas/persona-default.png');

interface PersonaCardProps {
    persona: Persona;
    isActive: boolean;
    onSelect: (persona: Persona) => void;
    onOpenSettings: (persona: Persona) => void;
}

export function PersonaCard({ persona, isActive, onSelect, onOpenSettings }: PersonaCardProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const settingsIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;
    const checkIconColor = isDark ? Colors.dark.background : Colors.light.text;
    const flowerIconColor = isDark ? Colors.dark.text : Colors.light.surface;
    const avatarSource = getPersonaAvatarSource(persona.avatarKey) ?? defaultAvatar;
    const usesRosebudAvatar = persona.avatarKey === 'persona-default';
    const avatarColorClass = usesRosebudAvatar ? 'bg-persona-rose' : 'bg-primary';
    const avatarClassName = [
        'mt-8 mb-6 w-[88px] h-[88px] rounded-full',
        avatarColorClass,
        'items-center justify-center shadow-lg',
    ].join(' ');

    return (
        <View
            testID="persona-card"
            className="snap-center shrink-0 w-[82vw] max-w-[340px] bg-surface-light dark:bg-card-dark rounded-3xl p-6 flex flex-col items-center relative border border-gray-200 dark:border-white/5 h-[360px]"
        >
            <Pressable
                onPress={() => onOpenSettings(persona)}
                className="absolute top-5 right-5"
                accessibilityLabel="Open persona settings"
            >
                <MaterialIcons name="settings" size={22} color={settingsIconColor} />
            </Pressable>
            <View
                testID="persona-avatar-shell"
                className={avatarClassName}
            >
                {usesRosebudAvatar ? (
                    <MaterialIcons name="spa" size={44} color={flowerIconColor} />
                ) : (
                    <Image source={avatarSource} style={{ width: 88, height: 88, borderRadius: 44 }} />
                )}
            </View>
            <Text className="text-[20px] font-bold text-text-light dark:text-text-dark mb-1 tracking-tight">
                {persona.name}
            </Text>
            <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark font-medium mb-auto">
                {persona.tagline}
            </Text>
            <Pressable
                onPress={() => onSelect(persona)}
                className="w-full py-4 px-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-zinc-800 flex items-center justify-center"
                accessibilityLabel={isActive ? 'Active persona' : 'Activate persona'}
            >
                {isActive ? (
                    <View className="flex-row items-center gap-2">
                        <View className="bg-green-500 rounded-full p-0.5 items-center justify-center">
                            <MaterialIcons name="check" size={14} color={checkIconColor} />
                        </View>
                        <Text className="text-[15px] font-semibold text-text-light dark:text-text-dark">
                            Active
                        </Text>
                    </View>
                ) : (
                    <Text className="text-[15px] font-semibold text-text-light dark:text-text-dark">
                        Set active
                    </Text>
                )}
            </Pressable>
        </View>
    );
}
