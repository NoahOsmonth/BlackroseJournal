import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface PersonalizeButtonProps {
    onPress: () => void;
}

export function PersonalizeButton({ onPress }: PersonalizeButtonProps) {
    return (
        <View className="flex items-center pt-2 pb-6">
            <Pressable
                onPress={onPress}
                className="flex-row items-center gap-2 px-5 py-2.5 rounded-full"
                accessibilityLabel="Personalize"
            >
                <MaterialIcons name="settings" size={18} color="#9CA3AF" />
                <Text className="text-xs font-semibold tracking-wider uppercase text-text-secondary-light dark:text-text-secondary-dark">
                    Personalize
                </Text>
            </Pressable>
        </View>
    );
}
