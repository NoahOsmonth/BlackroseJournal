import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/journal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Colors } from '@/constants/theme';
import { navAwareBottomPadding } from '@/constants/spacing';
import { useLocalMemories } from '@/hooks/memory/useLocalMemories';
import { useTabNavigation, type TabRoute } from '@/hooks/navigation/useTabNavigation';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import { MemoryAtomCard } from './MemoryAtomCard';
import { MemoryHubSummary } from './MemoryHubSummary';
import { MemoryNotesPanel } from './MemoryNotesPanel';
import {
    filterMemoryAtoms,
    MEMORY_LAYER_LABELS,
    MEMORY_LAYER_ORDER,
    topMemoryThemes,
    type MemoryLayerFilter,
} from './memoryDisplay';

const INPUT_CLASS = [
    'rounded-lg border border-divider-light dark:border-divider-dark',
    'bg-surface-light dark:bg-surface-dark px-3 py-3',
    'text-text-light dark:text-text-dark',
].join(' ');

export function MemoryHubScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { goToTab } = useTabNavigation();
    const memory = useLocalMemories();
    const isDark = useColorScheme() === 'dark';
    const [activeLayer, setActiveLayer] = useState<MemoryLayerFilter>('all');
    const [query, setQuery] = useState('');
    const [noteText, setNoteText] = useState('');

    const iconColor = isDark ? Colors.dark.text : Colors.light.text;
    const dangerColor = isDark ? '#F87171' : '#DC2626';
    const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
    const sourceThemes = useMemo(() => topMemoryThemes(memory.atoms, 4), [memory.atoms]);
    const filteredAtoms = useMemo(
        () => filterMemoryAtoms(memory.atoms, activeLayer, query),
        [activeLayer, memory.atoms, query]
    );

    const handleTabPress = (tab: TabRoute) => {
        if (tab !== 'explore') {
            goToTab(tab);
        }
    };

    const handleOpenGraph = () => {
        const params: Record<string, string> = {};
        if (activeLayer !== 'all') params.layer = activeLayer;
        if (query.trim()) params.q = query.trim();

        router.push(Object.keys(params).length > 0
            ? { pathname: '/memory-graph', params }
            : '/memory-graph');
    };

    const saveNote = async () => {
        try {
            await memory.addNote(noteText);
            setNoteText('');
        } catch (error) {
            Alert.alert('Memory note failed', errorMessage(error));
        }
    };

    const saveGeneratedNote = async () => {
        try {
            await memory.addGeneratedNote();
        } catch (error) {
            Alert.alert('Memory note failed', errorMessage(error));
        }
    };

    const deleteAtom = (atom: LocalMemoryAtom) => {
        Alert.alert(
            'Delete memory',
            `Delete "${atom.title}" from local memory?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await memory.removeAtom(atom.id);
                        } catch (error) {
                            Alert.alert('Delete failed', errorMessage(error));
                        }
                    },
                },
            ]
        );
    };

    const clearAll = () => {
        Alert.alert(
            'Clear local memory',
            'Delete all local AI memories from this device?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await memory.clearAll();
                        } catch (error) {
                            Alert.alert('Clear failed', errorMessage(error));
                        }
                    },
                },
            ]
        );
    };

    return (
        <ScreenContainer edges="top" className="relative">
            <ScrollView
                className="flex-1 px-5 pt-6"
                contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                showsVerticalScrollIndicator={false}
            >
                <View className="mb-6 flex-row items-start justify-between gap-4">
                    <View className="flex-1">
                        <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark">
                            Memory
                        </Text>
                        <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            About me, notes, and journal context.
                        </Text>
                    </View>
                    <Pressable
                        onPress={clearAll}
                        disabled={memory.isLoading || memory.atoms.length === 0}
                        className={memory.isLoading || memory.atoms.length === 0 ? 'opacity-50' : ''}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: memory.isLoading || memory.atoms.length === 0 }}
                        accessibilityLabel="Clear local memory"
                    >
                        <MaterialIcons name="delete-sweep" size={24} color={dangerColor} />
                    </Pressable>
                </View>

                {memory.isLoading ? (
                    <View className="py-12">
                        <ActivityIndicator color={iconColor} />
                    </View>
                ) : memory.atoms.length === 0 ? (
                    <EmptyState
                        title="Your memory grows as you journal"
                        message="Rosebud builds private context from completed entries and saved notes."
                        icon="hub"
                        actionLabel="Write your first entry"
                        onActionPress={() => router.push('/chat')}
                    />
                ) : (
                    <View className="gap-6">
                        <MemoryHubSummary
                            atoms={memory.atoms}
                            onOpenGraph={handleOpenGraph}
                            onThemePress={(tag) => setQuery(tag)}
                        />

                        <MemoryNotesPanel
                            noteText={noteText}
                            generatedNote={memory.generatedNote}
                            sourceThemes={sourceThemes}
                            isBusy={memory.isLoading}
                            onNoteTextChange={setNoteText}
                            onSaveNote={saveNote}
                            onSaveGeneratedNote={saveGeneratedNote}
                            onRefreshGeneratedNote={memory.refreshGeneratedNote}
                        />

                        <View className="gap-3">
                            <Text className="text-xs font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark">
                                Memory atoms
                            </Text>
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Search local memory"
                                placeholderTextColor={placeholderColor}
                                className={INPUT_CLASS}
                                accessibilityLabel="Search local memory"
                            />
                            <LayerFilters
                                activeLayer={activeLayer}
                                atoms={memory.atoms}
                                onLayerPress={setActiveLayer}
                            />

                            {filteredAtoms.length > 0 ? (
                                filteredAtoms.map((atom) => (
                                    <MemoryAtomCard
                                        key={atom.id}
                                        atom={atom}
                                        onDelete={deleteAtom}
                                        onTagPress={(tag) => setQuery(tag)}
                                    />
                                ))
                            ) : (
                                <EmptyState
                                    title="No matching memories"
                                    message="Adjust the search or layer filter."
                                    icon="search"
                                />
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            <BottomNav
                activeTab="explore"
                onTabPress={handleTabPress}
                onFabPress={() => router.push('/chat')}
            />
        </ScreenContainer>
    );
}

interface LayerFiltersProps {
    activeLayer: MemoryLayerFilter;
    atoms: readonly LocalMemoryAtom[];
    onLayerPress: (layer: MemoryLayerFilter) => void;
}

function LayerFilters({ activeLayer, atoms, onLayerPress }: LayerFiltersProps) {
    const layers = MEMORY_LAYER_ORDER.filter((layer) => (
        atoms.some((atom) => atom.layer === layer)
    ));
    const options: MemoryLayerFilter[] = ['all', ...layers];

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2 py-1">
                {options.map((layer) => {
                    const active = activeLayer === layer;
                    const label = layer === 'all' ? 'All' : MEMORY_LAYER_LABELS[layer];
                    return (
                        <Pressable
                            key={layer}
                            onPress={() => onLayerPress(layer)}
                            className={[
                                'h-9 justify-center rounded-full border px-4',
                                active
                                    ? 'border-primary bg-primary'
                                    : 'border-divider-light bg-surface-light dark:border-divider-dark dark:bg-surface-dark',
                            ].join(' ')}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`Show ${label} memories`}
                        >
                            <Text className={[
                                'text-xs font-bold',
                                active
                                    ? 'text-text-light dark:text-text-light'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark',
                            ].join(' ')}
                            >
                                {label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </ScrollView>
    );
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Please try again.';
}
