/**
 * MyIntentionsSection — intentions as text rows separated by hairlines.
 *
 * The old grid of emoji tiles is gone, and so is the "+ Add" chip in the
 * section label: the concept lists intentions as plain prose rows with one
 * quiet add row at the end.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Intention } from '@/services/intentions/intentionsStorage.types';
import { SectionLabel } from '@/components/ui/SectionLabel';

interface MyIntentionsSectionProps {
    intentions: Intention[];
    onAdd: () => void;
    onSelect: (intention: Intention) => void;
}

export function MyIntentionsSection({
    intentions,
    onAdd,
    onSelect,
}: MyIntentionsSectionProps) {
    const cards = intentions.slice(0, 3);

    return (
        <View className="gap-2">
            <SectionLabel>Intentions</SectionLabel>

            {cards.length > 0 ? (
                <View>
                    {cards.map((intention, index) => (
                        <View key={intention.id}>
                            <Pressable
                                onPress={() => onSelect(intention)}
                                className="py-4"
                                accessibilityLabel={`Open intention ${intention.title}`}
                                accessibilityRole="button"
                            >
                                <Text
                                    className="text-[16px] text-text-light dark:text-text-dark"
                                    numberOfLines={2}
                                >
                                    {intention.title}
                                </Text>
                            </Pressable>
                            {index < cards.length - 1 ? (
                                <View className="h-px bg-hairline-light dark:bg-hairline-dark" />
                            ) : null}
                        </View>
                    ))}

                    <View className="h-px bg-hairline-light dark:bg-hairline-dark" />
                    <Pressable
                        onPress={onAdd}
                        accessibilityLabel="Add intention"
                        accessibilityRole="button"
                        className="py-4"
                    >
                        <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                            Add intention
                        </Text>
                    </Pressable>
                </View>
            ) : (
                <Pressable
                    onPress={onAdd}
                    accessibilityLabel="Add intention"
                    accessibilityRole="button"
                    className="py-4"
                >
                    <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                        Set an intention
                    </Text>
                </Pressable>
            )}
        </View>
    );
}
