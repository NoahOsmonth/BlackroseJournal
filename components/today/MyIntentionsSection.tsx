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

/** Half-width cell with horizontal padding so 50%+50% never overflows with gap. */
function GridCell({ children }: { children: React.ReactNode }) {
    return (
        <View style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
            {children}
        </View>
    );
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
                <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                    {cards.map((intention) => (
                        <GridCell key={intention.id}>
                            <IntentionCard
                                intention={intention}
                                onPress={() => onSelect(intention)}
                            />
                        </GridCell>
                    ))}
                    <GridCell>
                        <AddIntentionCard onPress={onAdd} />
                    </GridCell>
                </View>
            ) : (
                <AddIntentionCard onPress={onAdd} variant="full" />
            )}
        </View>
    );
}
