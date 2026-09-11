/**
 * Happiness Recipe — one quiet list per kind. Rows are hairline slips with a
 * bone check bead; no emoji prefixes, no tinted add buttons, no brand fills.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HappinessRecipeSkeleton } from '@/components/happiness/HappinessRecipeSkeleton';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHappinessRecipe } from '@/hooks/useHappinessRecipe';
import { RecipeItem, RecipeItemType } from '@/services/happinessRecipeStorage.types';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

const LABELS: Record<RecipeItemType, string> = {
    ingredient: 'ingredient',
    habit: 'habit',
    goal: 'goal',
};

export default function HappinessRecipeScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const {
        items,
        isLoading,
        addItem,
        toggleItem,
        deleteItem,
        updateItem,
    } = useHappinessRecipe();

    const [addingType, setAddingType] = useState<RecipeItemType | null>(null);
    const [newItemText, setNewItemText] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const quietInk = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    const handleAddItem = async () => {
        if (addingType && newItemText.trim()) {
            await addItem(addingType, newItemText);
            setNewItemText('');
            setAddingType(null);
        }
    };

    const handleCancelAdd = () => {
        setNewItemText('');
        setAddingType(null);
    };

    const handleStartEdit = (item: RecipeItem) => {
        setEditingId(item.id);
        setEditText(item.text);
    };

    const handleSaveEdit = async () => {
        if (editingId && editText.trim()) {
            await updateItem(editingId, editText);
        }
        setEditingId(null);
        setEditText('');
    };

    const handleDelete = (item: RecipeItem) => {
        Alert.alert(
            'Delete Item',
            `Delete "${item.text}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteItem(item.id),
                },
            ]
        );
    };

    const renderItem = (item: RecipeItem) => {
        const isEditing = editingId === item.id;

        return (
            <View
                key={item.id}
                className={`mb-2 flex-row items-center gap-3 rounded-card border ${HAIRLINE} bg-surface-light px-4 py-3.5 dark:bg-surface-dark`}
            >
                <Pressable
                    onPress={() => toggleItem(item.id)}
                    accessibilityLabel={`Toggle ${item.text}`}
                    className="min-h-11 min-w-11 items-center justify-center"
                >
                    <MaterialIcons
                        name={item.completed ? 'check-circle' : 'radio-button-unchecked'}
                        size={22}
                        color={item.completed ? ink : quietInk}
                    />
                </Pressable>

                {isEditing ? (
                    <TextInput
                        value={editText}
                        onChangeText={setEditText}
                        onBlur={handleSaveEdit}
                        onSubmitEditing={handleSaveEdit}
                        autoFocus
                        className="min-w-0 flex-1 text-[16px] text-text-light dark:text-text-dark"
                    />
                ) : (
                    <Pressable
                        onLongPress={() => handleStartEdit(item)}
                        className="min-w-0 flex-1"
                    >
                        <Text
                            className={`text-[17px] leading-[25px] ${
                                item.completed
                                    ? 'text-text-secondary-light line-through dark:text-text-secondary-dark'
                                    : 'text-text-light dark:text-text-dark'
                            }`}
                        >
                            {item.text}
                        </Text>
                        {item.completedAt ? (
                            <Text className="mt-1 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                                Completed {new Date(item.completedAt).toLocaleDateString()}
                            </Text>
                        ) : null}
                    </Pressable>
                )}

                <Pressable
                    onPress={() => handleDelete(item)}
                    accessibilityLabel={`Delete ${item.text}`}
                    className="min-h-11 min-w-11 items-center justify-center"
                >
                    <MaterialIcons name="delete-outline" size={20} color={quietInk} />
                </Pressable>
            </View>
        );
    };

    const renderAddInput = () => {
        if (!addingType) return null;

        return (
            <View
                className="mb-4 flex-row items-center gap-3 rounded-card border border-bone-light bg-surface-light px-4 py-3.5 dark:border-bone-dark dark:bg-surface-dark"
            >
                <MaterialIcons name="add" size={20} color={ink} />
                <TextInput
                    value={newItemText}
                    onChangeText={setNewItemText}
                    placeholder={`Add ${LABELS[addingType]}...`}
                    placeholderTextColor={quietInk}
                    autoFocus
                    className="min-w-0 flex-1 text-[16px] text-text-light dark:text-text-dark"
                    onSubmitEditing={handleAddItem}
                />
                <Pressable
                    onPress={handleCancelAdd}
                    className="min-h-11 min-w-11 items-center justify-center"
                    accessibilityLabel="Cancel add"
                >
                    <MaterialIcons name="close" size={20} color={quietInk} />
                </Pressable>
                <Pressable
                    onPress={handleAddItem}
                    className="min-h-11 min-w-11 items-center justify-center"
                    accessibilityLabel="Confirm add"
                >
                    <MaterialIcons name="check" size={20} color={ink} />
                </Pressable>
            </View>
        );
    };

    const completedSorter = useMemo(() => {
        return (a: RecipeItem, b: RecipeItem) => {
            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bTime - aTime;
        };
    }, []);

    const sections = useMemo(() => {
        const byType = (type: RecipeItemType) => {
            const typeItems = items.filter((i) => i.type === type);
            const active = typeItems.filter((i) => !i.completed);
            const completed = typeItems.filter((i) => i.completed).sort(completedSorter);
            return { active, completed };
        };

        return {
            ingredients: byType('ingredient'),
            habits: byType('habit'),
            goals: byType('goal'),
        };
    }, [items, completedSorter]);

    const renderSection = (
        title: string,
        sectionItems: { active: RecipeItem[]; completed: RecipeItem[] },
        emptyText: string
    ) => {
        const hasAny = sectionItems.active.length > 0 || sectionItems.completed.length > 0;

        return (
            <View className="mb-8">
                <Text
                    className="mb-3 text-[22px] leading-[30px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    {title}
                </Text>

                {sectionItems.active.map(renderItem)}
                {sectionItems.completed.map(renderItem)}

                {!hasAny && !isLoading && items.length > 0 && (
                    <View className={`rounded-card border ${HAIRLINE} bg-surface-light p-4 dark:bg-surface-dark`}>
                        <Text className="text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                            {emptyText}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="mx-auto w-full max-w-md flex-1">
                <View className="flex-row items-center justify-between px-5 py-4">
                    <Pressable
                        onPress={() => router.back()}
                        className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={ink} />
                    </Pressable>
                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={SERIF}
                    >
                        Happiness Recipe
                    </Text>
                    <View className="min-h-11 min-w-11" />
                </View>

                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
                    {isLoading ? (
                        <HappinessRecipeSkeleton />
                    ) : (
                        <>
                            {!addingType && (
                                <View className="mb-6 flex-row gap-3">
                                    <Pressable
                                        onPress={() => setAddingType('ingredient')}
                                        className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-control border ${HAIRLINE}`}
                                        accessibilityRole="button"
                                        accessibilityLabel="Add ingredient"
                                    >
                                        <MaterialIcons name="add" size={20} color={ink} />
                                        <Text className="text-[16px] text-text-light dark:text-text-dark">
                                            Add ingredient
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setAddingType('goal')}
                                        className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-control border ${HAIRLINE}`}
                                        accessibilityRole="button"
                                        accessibilityLabel="Add goal"
                                    >
                                        <MaterialIcons name="add" size={20} color={ink} />
                                        <Text className="text-[16px] text-text-light dark:text-text-dark">
                                            Add goal
                                        </Text>
                                    </Pressable>
                                </View>
                            )}

                            {renderAddInput()}

                            {renderSection('Ingredients', sections.ingredients, 'Add ingredients that consistently help you feel better.')}
                            {renderSection('Habits', sections.habits, 'Habits you add from Suggestions will show up here.')}
                            {renderSection('Goals', sections.goals, 'Set goals you want to work toward over time.')}

                            {items.length === 0 && !isLoading && (
                                <View className="items-center py-12">
                                    <MaterialIcons name="favorite-border" size={40} color={quietInk} />
                                    <Text
                                        className="mt-4 text-[21px] leading-[29px] text-text-light dark:text-text-dark"
                                        style={SERIF}
                                    >
                                        No items yet
                                    </Text>
                                    <Text className="mt-2 text-center text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                                        Add ingredients and goals (and habits from suggestions) to build your recipe
                                    </Text>
                                </View>
                            )}

                            <View className="h-6" />
                        </>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
