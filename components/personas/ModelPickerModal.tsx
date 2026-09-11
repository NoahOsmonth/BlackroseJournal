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

/** Sheet of models as serif hairline rows; the active one is marked in words. */
export function ModelPickerModal({
    visible,
    options,
    selectedId,
    onSelect,
    onClose,
}: ModelPickerModalProps) {
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
                        Choose model
                    </Text>
                    <View>
                        {options.map((option) => {
                            const isActive = option.id === selectedId;
                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() => onSelect(option.id)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Select ${option.label}`}
                                    accessibilityState={{ selected: isActive }}
                                    className="min-h-14 flex-row items-center justify-between border-t border-hairline-light px-1 py-3 dark:border-hairline-dark"
                                >
                                    <Text className="text-[19px] text-text-light dark:text-text-dark">
                                        {option.label}
                                    </Text>
                                    {isActive ? (
                                        <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                                            Active
                                        </Text>
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </View>
                    <Pressable
                        onPress={onClose}
                        className="mt-6 min-h-11 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Close model picker"
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
