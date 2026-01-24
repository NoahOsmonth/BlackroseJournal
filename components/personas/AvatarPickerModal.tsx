import React from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';

import { PERSONA_AVATARS, PersonaAvatarKey } from '@/constants/personas';

interface AvatarPickerModalProps {
    visible: boolean;
    selectedId?: PersonaAvatarKey;
    onClose: () => void;
    onSelect: (avatarId: PersonaAvatarKey) => void;
}

export function AvatarPickerModal({
    visible,
    selectedId,
    onClose,
    onSelect,
}: AvatarPickerModalProps) {
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <Pressable className="flex-1" onPress={onClose} />
                <View className="bg-surface-light dark:bg-surface-dark rounded-t-3xl px-6 pt-4 pb-8">
                    <View className="items-center mb-4">
                        <View className="w-10 h-1 bg-divider-light dark:bg-divider-dark rounded-full" />
                    </View>
                    <Text className="text-[17px] font-semibold text-text-light dark:text-white mb-4 text-center">
                        Choose avatar
                    </Text>
                    <View className="flex-row flex-wrap gap-4 justify-center">
                        {PERSONA_AVATARS.map((avatar) => {
                            const isActive = avatar.id === selectedId;
                            return (
                                <Pressable
                                    key={avatar.id}
                                    onPress={() => onSelect(avatar.id)}
                                    className={`items-center p-3 rounded-2xl border ${isActive
                                        ? 'border-primary'
                                        : 'border-divider-light dark:border-divider-dark'
                                        }`}
                                    accessibilityLabel={`Select ${avatar.label} avatar`}
                                >
                                    <Image
                                        source={avatar.source}
                                        style={{ width: 72, height: 72, borderRadius: 36 }}
                                    />
                                    <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-2">
                                        {avatar.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Pressable
                        onPress={onClose}
                        className="mt-6 py-3 items-center"
                        accessibilityLabel="Close avatar picker"
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
