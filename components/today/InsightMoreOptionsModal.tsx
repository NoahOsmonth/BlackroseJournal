/**
 * Insight More Options Modal
 * Dismissible bottom-sheet modal for the Today tab insight card.
 */

import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface InsightMoreOptionsModalProps {
    visible: boolean;
    onClose: () => void;
    onShare: () => void;
    onCopy: () => void;
    onHide: () => void;
    onShowSavedInsights: () => void;
}

export function InsightMoreOptionsModal({
    visible,
    onClose,
    onShare,
    onCopy,
    onHide,
    onShowSavedInsights,
}: InsightMoreOptionsModalProps) {
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
            testID="insight-more-options-modal"
        >
            <View className="flex-1 bg-black/40 justify-end">
                <Pressable
                    className="absolute inset-0"
                    onPress={onClose}
                    accessibilityLabel="Close more options"
                    testID="insight-more-options-backdrop"
                />
                <View
                    className="bg-surface-light dark:bg-surface-dark rounded-t-3xl p-6"
                    style={{ paddingBottom: insets.bottom + 24 }}
                    onTouchEnd={(e) => e.stopPropagation()}
                >
                    <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-4">
                        More options
                    </Text>
                    <View className="gap-1">
                        <Pressable
                            onPress={() => {
                                onShare();
                                onClose();
                            }}
                            className="py-3"
                            accessibilityLabel="Share"
                            accessibilityRole="button"
                        >
                            <Text className="text-base text-text-light dark:text-text-dark">Share</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                onCopy();
                                onClose();
                            }}
                            className="py-3"
                            accessibilityLabel="Copy"
                            accessibilityRole="button"
                        >
                            <Text className="text-base text-text-light dark:text-text-dark">Copy</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                onHide();
                                onClose();
                            }}
                            className="py-3"
                            accessibilityLabel="Hide for today"
                            accessibilityRole="button"
                        >
                            <Text className="text-base text-text-light dark:text-text-dark">Hide for today</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => {
                                onShowSavedInsights();
                                onClose();
                            }}
                            className="py-3"
                            accessibilityLabel="Saved insights"
                            accessibilityRole="button"
                        >
                            <Text className="text-base text-text-light dark:text-text-dark">Saved insights</Text>
                        </Pressable>
                        <Pressable
                            onPress={onClose}
                            className="py-3"
                            accessibilityLabel="Cancel"
                            accessibilityRole="button"
                        >
                            <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark">Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
