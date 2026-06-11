import React from 'react';
import { Text, View } from 'react-native';
import { Intention } from '@/services/intentions/intentionsStorage.types';
import { IntentionCard } from '@/components/intentions/IntentionCard';
import { AddIntentionCard } from '@/components/intentions/AddIntentionCard';

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
    const hasIntentions = cards.length > 0;

    return (
        <View className="gap-3">
            <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark ml-1">
                My intentions
            </Text>
            {hasIntentions ? (
                <View className="flex-row flex-wrap gap-4">
                    {cards.map((intention) => (
                        <View key={intention.id} className="w-[48%]">
                            <IntentionCard
                                intention={intention}
                                onPress={() => onSelect(intention)}
                            />
                        </View>
                    ))}
                    <View className="w-[48%]">
                        <AddIntentionCard onPress={onAdd} />
                    </View>
                </View>
            ) : (
                <AddIntentionCard onPress={onAdd} variant="full" />
            )}
        </View>
    );
}
