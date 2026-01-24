import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface NewPersonaCardProps {
    onCreate: () => void;
}

const newAvatar = require('@/assets/personas/persona-new.png');

export function NewPersonaCard({ onCreate }: NewPersonaCardProps) {
    return (
        <View className="snap-center shrink-0 w-[82vw] max-w-[340px] bg-transparent rounded-3xl p-6 flex flex-col items-center relative border-2 border-dashed border-gray-700 h-[360px] opacity-60">
            <View className="flex-1 items-center justify-center space-y-5">
                <View className="w-24 h-24 rounded-full items-center justify-center bg-gray-900 overflow-hidden">
                    <Image source={newAvatar} style={{ width: 96, height: 96 }} />
                    <View className="absolute inset-0 items-center justify-center">
                        <MaterialIcons name="add" size={36} color="#FFFFFF" />
                    </View>
                </View>
                <View className="items-center">
                    <Text className="text-xl font-bold text-white">New persona</Text>
                    <Text className="text-gray-400 font-medium">Build your dream team</Text>
                </View>
            </View>
            <Pressable
                onPress={onCreate}
                className="w-full bg-white text-black py-4 rounded-2xl items-center"
                accessibilityLabel="Create persona"
            >
                <Text className="font-semibold">Create</Text>
            </Pressable>
        </View>
    );
}
