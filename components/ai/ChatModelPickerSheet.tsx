import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingBar } from '@/components/ui/LoadingBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChatModelOption } from '@/features/chat/modelPicker.types';
import { FreeOnlyPill } from './FreeModelBadge';
import { ModelPickerRow } from './ModelPickerRow';

export type ChatModelPickerSheetProps = {
    readonly visible: boolean;
    readonly mode?: 'managed' | 'byok';
    readonly models: readonly ChatModelOption[];
    readonly recentModels?: readonly ChatModelOption[];
    readonly selectedId: string | null;
    readonly freeOnly: boolean;
    readonly hostLabel: string;
    readonly hasApiKey: boolean;
    readonly isLoading?: boolean;
    readonly isFetching?: boolean;
    readonly error?: string | null;
    readonly onSelect: (modelId: string) => void;
    readonly onRefresh?: () => void;
    readonly onClose: () => void;
    readonly onOpenSettings?: () => void;
};

type ListItem =
    | { type: 'note' }
    | { type: 'section'; title: string }
    | { type: 'model'; model: ChatModelOption };

function ModelRowSkeleton({ index }: { index: number }) {
    return (
        <View className="gap-2 rounded-2xl border border-divider-light bg-background-light p-4 dark:border-divider-dark dark:bg-background-dark">
            <Skeleton className="h-4 w-32" accessibilityLabel={`Loading model name ${index}`} />
            <Skeleton className="h-3 w-48" accessibilityLabel={`Loading model description ${index}`} />
        </View>
    );
}

export function ChatModelPickerSheet({
    visible,
    mode = 'byok',
    models,
    recentModels = [],
    selectedId,
    freeOnly,
    hostLabel,
    hasApiKey,
    isLoading = false,
    isFetching = false,
    error = null,
    onSelect,
    onRefresh,
    onClose,
    onOpenSettings,
}: ChatModelPickerSheetProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
    const iconColor = isDark ? '#F9FAFB' : '#111827';
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return [...models];
        return models.filter((model) => (
            `${model.id} ${model.name ?? ''}`.toLowerCase().includes(needle)
        ));
    }, [models, query]);

    const listData = useMemo((): ListItem[] => {
        const items: ListItem[] = [{ type: 'note' }];
        const recentIds = new Set(recentModels.map((m) => m.id));
        const showRecent = !query.trim() && recentModels.length > 0;
        if (showRecent) {
            items.push({ type: 'section', title: 'Recent' });
            for (const model of recentModels) {
                items.push({ type: 'model', model });
            }
        }
        items.push({
            type: 'section',
            title: mode === 'managed' ? 'Managed models' : freeOnly ? 'All free models' : 'All models',
        });
        for (const model of filtered) {
            if (showRecent && recentIds.has(model.id)) continue;
            items.push({ type: 'model', model });
        }
        return items;
    }, [filtered, freeOnly, mode, query, recentModels]);

    const selectedManagedModelMissing = mode === 'managed'
        && Boolean(selectedId)
        && !models.some((model) => model.id === selectedId);

    const maxHeight = Math.round(height * 0.72);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/60 dark:bg-black/80 justify-end">
                <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss model picker" />
                <View
                    style={{ maxHeight }}
                    className="bg-surface-light dark:bg-surface-dark rounded-t-3xl border-t border-divider-light dark:border-divider-dark"
                >
                    <View className="px-4 pt-4 gap-3">
                        <View className="items-center">
                            <View className="w-10 h-1 rounded-full bg-divider-light dark:bg-divider-dark" />
                        </View>
                        <Text className="text-lg font-semibold text-text-light dark:text-text-dark text-center">
                            Choose model
                        </Text>
                        <View className="flex-row items-center justify-center gap-2">
                            <Text
                                numberOfLines={1}
                                className="text-xs text-subtext-light dark:text-subtext-dark"
                            >
                                {hostLabel}
                            </Text>
                            {mode === 'managed' ? null : freeOnly ? <FreeOnlyPill /> : (
                                <Text className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                                    Includes paid
                                </Text>
                            )}
                        </View>

                        <View className="flex-row items-center gap-2">
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder={freeOnly ? 'Search free models' : 'Search models'}
                                placeholderTextColor={placeholderColor}
                                autoCapitalize="none"
                                autoCorrect={false}
                                className="flex-1 rounded-xl border border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark px-3 py-3 text-text-light dark:text-text-dark"
                                accessibilityLabel="Search models"
                            />
                            {onRefresh ? (
                                <Pressable
                                    onPress={onRefresh}
                                    disabled={isFetching || !hasApiKey}
                                    accessibilityLabel="Refresh models"
                                    className={`w-12 h-12 items-center justify-center rounded-xl border border-divider-light dark:border-divider-dark ${
                                        isFetching || !hasApiKey ? 'opacity-50' : ''
                                    }`}
                                >
                                    {isFetching ? (
                                        <LoadingBar size="sm" accessibilityLabel="Refreshing models" />
                                    ) : (
                                        <Ionicons name="refresh" size={20} color={iconColor} />
                                    )}
                                </Pressable>
                            ) : null}
                        </View>

                        {error ? (
                            <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
                        ) : null}
                        {selectedManagedModelMissing ? (
                            <Text className="text-sm text-amber-700 dark:text-amber-300 text-center">
                                Your selected managed model is no longer available. Choose another model to continue.
                            </Text>
                        ) : null}
                    </View>

                    {mode === 'byok' && !hasApiKey ? (
                        <View className="px-4 py-8 items-center gap-3">
                            <Ionicons name="key-outline" size={28} color={iconColor} />
                            <Text className="text-base font-semibold text-text-light dark:text-text-dark text-center">
                                Add an API key
                            </Text>
                            <Text className="text-sm text-subtext-light dark:text-subtext-dark text-center">
                                Set your OpenRouter (or custom) key in Settings to load free models.
                            </Text>
                            {onOpenSettings ? (
                                <Pressable
                                    onPress={onOpenSettings}
                                    className="mt-2 rounded-xl bg-primary px-4 py-3"
                                    accessibilityRole="button"
                                >
                                    <Text className="font-bold text-white">
                                        Open AI settings
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : isLoading && models.length === 0 ? (
                        <View className="gap-3 px-4 py-8" accessibilityLabel="Loading models">
                            {[1, 2, 3, 4].map((index) => (
                                <ModelRowSkeleton key={index} index={index} />
                            ))}
                        </View>
                    ) : models.length === 0 ? (
                        <View className="px-4 py-8 items-center gap-3">
                            <Ionicons name="cloud-download-outline" size={28} color={iconColor} />
                            <Text className="text-base font-semibold text-text-light dark:text-text-dark text-center">
                                No models loaded
                            </Text>
                            <Text className="text-sm text-subtext-light dark:text-subtext-dark text-center">
                                {freeOnly
                                    ? 'Fetch free models to choose one. Only ids with :free are shown.'
                                    : 'Fetch models from your provider to choose one.'}
                            </Text>
                            {onRefresh ? (
                                <Pressable
                                    onPress={onRefresh}
                                    disabled={isFetching}
                                    accessibilityRole="button"
                                    accessibilityLabel="Fetch free models"
                                    className="mt-2 rounded-xl bg-primary px-4 py-3"
                                >
                                    <Text className="font-bold text-white">
                                        {isFetching ? 'Fetching…' : 'Fetch free models'}
                                    </Text>
                                </Pressable>
                            ) : null}
                            {onOpenSettings ? (
                                <Pressable onPress={onOpenSettings}>
                                    <Text className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                        Open AI settings
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>
                    ) : filtered.length === 0 ? (
                        <View className="px-4 py-8 items-center gap-2">
                            <Text className="text-sm text-subtext-light dark:text-subtext-dark text-center">
                                {`No models match “${query.trim()}”.`}
                            </Text>
                            <Pressable onPress={() => setQuery('')}>
                                <Text className="text-sm font-medium text-primary dark:text-primary">
                                    Clear search
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <FlatList
                            data={listData}
                            keyExtractor={(item, index) => {
                                if (item.type === 'model') return item.model.id;
                                if (item.type === 'section') return `section-${item.title}`;
                                return `row-${index}`;
                            }}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{
                                paddingHorizontal: 16,
                                paddingTop: 12,
                                paddingBottom: Math.max(insets.bottom, 16) + 8,
                                gap: 8,
                            }}
                            renderItem={({ item }) => {
                                if (item.type === 'note') {
                                    return (
                                        <Text className="text-xs text-subtext-light dark:text-subtext-dark mb-1">
                                            Applies to the next reply in this chat.
                                        </Text>
                                    );
                                }
                                if (item.type === 'section') {
                                    return (
                                        <Text className="text-xs font-medium uppercase tracking-wide text-subtext-light dark:text-subtext-dark mt-1 mb-1">
                                            {item.title}
                                        </Text>
                                    );
                                }
                                return (
                                    <ModelPickerRow
                                        model={item.model}
                                        selected={item.model.id === selectedId}
                                        onPress={() => onSelect(item.model.id)}
                                    />
                                );
                            }}
                        />
                    )}

                    <Pressable
                        onPress={onClose}
                        className="py-3 items-center border-t border-divider-light dark:border-divider-dark"
                        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
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
