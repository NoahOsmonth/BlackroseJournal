import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Persona } from '@/services/personas/personasStorage.types';
import { getPersonaAvatarSource } from '@/constants/personas';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { RoseMark } from '@/components/ui/RoseMark';

const defaultAvatar = require('@/assets/personas/persona-default.png');
const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

interface PersonaCardProps {
    persona: Persona;
    isActive: boolean;
    onSelect: (persona: Persona) => void;
    onOpenSettings: (persona: Persona) => void;
}

/**
 * One voice in the chooser carousel (concept `black-rose-persona.png`):
 * a bordered card, the rose mark in a hairline medallion, serif name, quiet
 * tagline, and a single outline control that reads `Active` (checked) or
 * `Set active`.
 */
export function PersonaCard({ persona, isActive, onSelect, onOpenSettings }: PersonaCardProps) {
    const isDark = useColorScheme() === 'dark';
    const markColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const mutedColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const avatarSource = getPersonaAvatarSource(persona.avatarKey) ?? defaultAvatar;
    const usesDefaultMark = !persona.avatarKey || persona.avatarKey === 'persona-default';

    return (
        <View
            testID="persona-card"
            className="relative flex h-[360px] w-[82vw] max-w-[340px] shrink-0 snap-center flex-col items-center rounded-card border border-hairline-light bg-surface-light p-6 dark:border-hairline-dark dark:bg-surface-dark"
        >
            <Pressable
                onPress={() => onOpenSettings(persona)}
                className="absolute right-3 top-3 h-11 w-11 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Open persona settings"
            >
                <MaterialIcons name="more-vert" size={22} color={mutedColor} />
            </Pressable>

            <View
                testID="persona-avatar-shell"
                className="mb-6 mt-8 h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full border border-hairline-light dark:border-hairline-dark"
            >
                {usesDefaultMark ? (
                    <RoseMark size={50} color={markColor} strokeWidth={1.2} />
                ) : (
                    <Image source={avatarSource} style={{ width: 88, height: 88 }} />
                )}
            </View>

            <Text className="mb-1 text-[22px] text-text-light dark:text-text-dark" style={SERIF}>
                {persona.name}
            </Text>
            <Text className="mb-auto text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                {persona.tagline}
            </Text>

            <Pressable
                onPress={() => onSelect(persona)}
                accessibilityRole="button"
                accessibilityLabel={isActive ? 'Active persona' : 'Activate persona'}
                accessibilityState={{ selected: isActive }}
                className={`min-h-12 w-full flex-row items-center justify-center gap-2 rounded-control border ${
                    isActive
                        ? 'border-bone-light dark:border-bone-dark'
                        : 'border-hairline-light dark:border-hairline-dark'
                }`}
            >
                <Text className="text-[17px] text-text-light dark:text-text-dark" style={SERIF}>
                    {isActive ? '✓ Active' : 'Set active'}
                </Text>
            </Pressable>
        </View>
    );
}
