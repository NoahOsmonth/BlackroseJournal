/**
 * Happiness Recipe Screen
 * Full screen for managing ingredients and goals
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHappinessRecipe } from '@/hooks/useHappinessRecipe';
import { RecipeItem, RecipeItemType } from '@/services/happinessRecipeStorage.types';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
        activeItems,
        completedItems,
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
                            {item.type === 'goal' ? '🎯 ' : ''}{item.text}
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

        return (
            <View
                className={`flex-row items-center p-4 mb-4 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'
                    }`}
            >
                <MaterialIcons
                    name={addingType === 'goal' ? 'flag' : 'favorite'}
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

                    {/* Active items */}
                    {activeItems.length > 0 && (
                        <View className="mb-6">
                            <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-3">
                                Active ({activeItems.length})
                            </Text>
                            {activeItems.map(renderItem)}
                        </View>
                    )}

                    {/* Completed items */}
                    {completedItems.length > 0 && (
                        <View className="mb-6">
                            <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-3">
                                Completed ({completedItems.length})
                            </Text>
                            {completedItems.map(renderItem)}
                        </View>
                    )}

                    {/* Empty state */}
                    {activeItems.length === 0 && completedItems.length === 0 && (
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
                                Add ingredients and goals to build your happiness recipe
                            </Text>
                        </View>
                    )}

                    <View className="h-6" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
