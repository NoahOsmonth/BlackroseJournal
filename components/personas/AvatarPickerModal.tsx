import React from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';

import { PERSONA_AVATARS, PersonaAvatarKey } from '@/constants/personas';

interface AvatarPickerModalProps {
    visible: boolean;
    selectedId?: PersonaAvatarKey;
    onClose: () => void;
    onSelect: (avatarId: PersonaAvatarKey) => void;
}

/** Sheet of avatar options; the active one takes a bone hairline, not orange. */
export function AvatarPickerModal({
    visible,
    selectedId,
    onClose,
    onSelect,
}: AvatarPickerModalProps) {
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 justify-end bg-black/60">
                <Pressable className="flex-1" onPress={onClose} />
                <View className="rounded-t-sheet border-t border-hairline-light bg-surface-light px-6 pb-8 pt-4 dark:border-hairline-dark dark:bg-surface-dark">
                    <View className="items-center pb-4">
                        <View className="h-1 w-10 rounded-full bg-hairline-light dark:bg-hairline-dark" />
                    </View>
                    <Text
                        className="mb-4 text-center text-[22px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Choose avatar
                    </Text>
                    <View className="flex-row flex-wrap justify-center gap-4">
                        {PERSONA_AVATARS.map((avatar) => {
                            const isActive = avatar.id === selectedId;
                            return (
                                <Pressable
                                    key={avatar.id}
                                    onPress={() => onSelect(avatar.id)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Select ${avatar.label} avatar`}
                                    accessibilityState={{ selected: isActive }}
                                    className={`items-center rounded-card border p-3 ${
                                        isActive
                                            ? 'border-bone-light dark:border-bone-dark'
                                            : 'border-hairline-light dark:border-hairline-dark'
                                    }`}
                                >
                                    <Image
                                        source={avatar.source}
                                        style={{ width: 72, height: 72, borderRadius: 36 }}
                                    />
                                    <Text className="mt-2 text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                        {avatar.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Pressable
                        onPress={onClose}
                        className="mt-6 min-h-11 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Close avatar picker"
                    >
                        <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                            Close
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}
