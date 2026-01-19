/**
 * Happiness Recipe Screen
 * Full screen for managing ingredients and goals
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHappinessRecipe } from '@/hooks/useHappinessRecipe';
import { RecipeItem, RecipeItemType } from '@/services/happinessRecipeStorage.types';
import { MaterialIcons } from '@expo/vector-icons';
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

export default function HappinessRecipeScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
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
        const typePrefix = item.type === 'goal' ? '🎯 ' : item.type === 'habit' ? '🌿 ' : '';

        return (
            <View
                key={item.id}
                className={`flex-row items-center p-4 mb-2 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'
                    }`}
            >
                <Pressable
                    onPress={() => toggleItem(item.id)}
                    accessibilityLabel={`Toggle ${item.text}`}
                    className="mr-3"
                >
                    <MaterialIcons
                        name={item.completed ? 'check-circle' : 'radio-button-unchecked'}
                        size={24}
                        color={item.completed ? '#E91E63' : isDark ? '#666' : '#999'}
                    />
                </Pressable>

                {isEditing ? (
                    <TextInput
                        value={editText}
                        onChangeText={setEditText}
                        onBlur={handleSaveEdit}
                        onSubmitEditing={handleSaveEdit}
                        autoFocus
                        className={`flex-1 text-base ${isDark ? 'text-white' : 'text-black'
                            }`}
                    />
                ) : (
                    <Pressable
                        onLongPress={() => handleStartEdit(item)}
                        className="flex-1"
                    >
                        <Text
                            className={`text-base ${item.completed
                                ? 'line-through text-text-secondary-light dark:text-text-secondary-dark'
                                : 'text-text-main-light dark:text-text-main-dark'
                                }`}
                        >
                            {typePrefix}{item.text}
                        </Text>
                        {item.completedAt && (
                            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                Completed {new Date(item.completedAt).toLocaleDateString()}
                            </Text>
                        )}
                    </Pressable>
                )}

                <Pressable
                    onPress={() => handleDelete(item)}
                    accessibilityLabel={`Delete ${item.text}`}
                    className="ml-2 p-2"
                >
                    <MaterialIcons
                        name="delete-outline"
                        size={20}
                        color={isDark ? '#666' : '#999'}
                    />
                </Pressable>
            </View>
        );
    };

    const renderAddInput = () => {
        if (!addingType) return null;

        const addIcon = addingType === 'goal' ? 'flag' : addingType === 'habit' ? 'spa' : 'favorite';

        return (
            <View
                className={`flex-row items-center p-4 mb-4 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'
                    }`}
            >
                <MaterialIcons
                    name={addIcon}
                    size={20}
                    color="#E91E63"
                    style={{ marginRight: 12 }}
                />
                <TextInput
                    value={newItemText}
                    onChangeText={setNewItemText}
                    placeholder={`Add ${addingType}...`}
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    autoFocus
                    className={`flex-1 text-base ${isDark ? 'text-white' : 'text-black'}`}
                    onSubmitEditing={handleAddItem}
                />
                <Pressable onPress={handleCancelAdd} className="p-2 mr-1">
                    <MaterialIcons name="close" size={20} color={isDark ? '#666' : '#999'} />
                </Pressable>
                <Pressable onPress={handleAddItem} className="p-2">
                    <MaterialIcons name="check" size={20} color="#E91E63" />
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
                <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-3 ml-1">
                    {title}
                </Text>

                {sectionItems.active.map(renderItem)}
                {sectionItems.completed.map(renderItem)}

                {!hasAny && !isLoading && items.length > 0 && (
                    <View className="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
                        <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            {emptyText}
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable onPress={() => router.back()} className="p-2 -ml-2">
                        <MaterialIcons
                            name="arrow-back"
                            size={24}
                            color={isDark ? '#E5E5E7' : '#1C1C1E'}
                        />
                    </Pressable>
                    <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                        Happiness Recipe
                    </Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                    {/* Add buttons */}
                    {!addingType && (
                        <View className="flex-row gap-3 mb-6">
                            <Pressable
                                onPress={() => setAddingType('ingredient')}
                                className="flex-1 flex-row items-center justify-center py-3 rounded-xl bg-primary/10"
                            >
                                <MaterialIcons name="add" size={20} color="#E91E63" />
                                <Text className="text-primary font-bold ml-2">
                                    Add ingredient
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setAddingType('goal')}
                                className="flex-1 flex-row items-center justify-center py-3 rounded-xl bg-primary/10"
                            >
                                <MaterialIcons name="add" size={20} color="#E91E63" />
                                <Text className="text-primary font-bold ml-2">
                                    Add goal
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    {renderAddInput()}

                    {renderSection('Ingredients', sections.ingredients, 'Add ingredients that consistently help you feel better.')}
                    {renderSection('Habits', sections.habits, 'Habits you add from Suggestions will show up here.')}
                    {renderSection('Goals', sections.goals, 'Set goals you want to work toward over time.')}

                    {/* Global empty state */}
                    {items.length === 0 && !isLoading && (
                        <View className="items-center py-12">
                            <MaterialIcons
                                name="favorite-border"
                                size={48}
                                color={isDark ? '#666' : '#999'}
                            />
                            <Text className="text-lg text-text-secondary-light dark:text-text-secondary-dark mt-4">
                                No items yet
                            </Text>
                            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                                Add ingredients and goals (and habits from suggestions) to build your recipe
                            </Text>
                        </View>
                    )}

                    <View className="h-6" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
