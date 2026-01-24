import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

interface ModelOption {
    id: string;
    label: string;
}

interface ModelPickerModalProps {
    visible: boolean;
    options: ModelOption[];
    selectedId?: string;
    onSelect: (id: string) => void;
    onClose: () => void;
}

export function ModelPickerModal({
    visible,
    options,
    selectedId,
    onSelect,
    onClose,
}: ModelPickerModalProps) {
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/60 justify-end">
                <Pressable className="flex-1" onPress={onClose} />
                <View className="bg-surface-light dark:bg-surface-dark rounded-t-3xl px-6 pt-4 pb-8">
                    <View className="items-center mb-4">
                        <View className="w-10 h-1 bg-divider-light dark:bg-divider-dark rounded-full" />
                    </View>
                    <Text className="text-[17px] font-semibold text-text-light dark:text-white mb-4 text-center">
                        Choose model
                    </Text>
                    <View className="space-y-2">
                        {options.map((option) => {
                            const isActive = option.id === selectedId;
                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() => onSelect(option.id)}
                                    className={`px-4 py-3 rounded-xl border ${isActive
                                        ? 'border-primary'
                                        : 'border-divider-light dark:border-divider-dark'
                                        }`}
                                    accessibilityLabel={`Select ${option.label}`}
                                >
                                    <Text className="text-base text-text-light dark:text-white">
                                        {option.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Pressable
                        onPress={onClose}
                        className="mt-6 py-3 items-center"
                        accessibilityLabel="Close model picker"
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
