import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { navAwareBottomPadding } from '@/constants/spacing';
import { useLocalMemories } from '@/hooks/memory/useLocalMemories';
import { useTabNavigation, type TabRoute } from '@/hooks/navigation/useTabNavigation';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import { MemoryAtomCard } from './MemoryAtomCard';
import { MemoryEmpty } from './MemoryEmpty';
import { MemoryHubSkeleton } from './MemoryHubSkeleton';
import { MemoryNotesPanel } from './MemoryNotesPanel';
import { MemoryPortrait } from './MemoryPortrait';
import {
    filterMemoryAtoms,
    MEMORY_LAYER_LABELS,
    MEMORY_LAYER_ORDER,
    memoryAtomRoute,
    topMemoryThemes,
    type MemoryLayerFilter,
} from './memoryDisplay';

/** How many atom rows to show before requiring “Show more”. */
export const MEMORY_ATOMS_PAGE_SIZE = 8;

const INPUT_CLASS = [
    'rounded-xl border border-divider-light dark:border-divider-dark',
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
    const [notesOpen, setNotesOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(MEMORY_ATOMS_PAGE_SIZE);
    const [menuOpen, setMenuOpen] = useState(false);

    const iconMuted = isDark ? '#9CA3AF' : '#6B7280';
    const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
    const sourceThemes = useMemo(() => topMemoryThemes(memory.atoms, 4), [memory.atoms]);
    const filteredAtoms = useMemo(
        () => filterMemoryAtoms(memory.atoms, activeLayer, query),
        [activeLayer, memory.atoms, query]
    );

    useEffect(() => {
        setVisibleCount(MEMORY_ATOMS_PAGE_SIZE);
    }, [activeLayer, query]);

    const visibleAtoms = filteredAtoms.slice(0, visibleCount);
    const remaining = Math.max(0, filteredAtoms.length - visibleAtoms.length);

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

    const handleOpenAtom = (atom: LocalMemoryAtom) => {
        const route = memoryAtomRoute(atom);
        if (!route) return;
        router.push(route);
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
        setMenuOpen(false);
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
                className="flex-1 px-4 pt-6"
                contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                showsVerticalScrollIndicator={false}
            >
                <View className="mb-6 flex-row items-start justify-between gap-4">
                    <View className="flex-1">
                        <Text
                            className="text-3xl font-bold text-text-light dark:text-text-dark"
                            style={{ fontFamily: 'PlayfairDisplayBold' }}
                        >
                            Memory
                        </Text>
                        <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            What Rosebud holds for you
                        </Text>
                    </View>
                    <View className="items-end">
                        <Pressable
                            onPress={() => setMenuOpen((open) => !open)}
                            accessibilityRole="button"
                            accessibilityLabel="Memory options"
                            hitSlop={8}
                            className="h-9 w-9 items-center justify-center rounded-full"
                        >
                            <MaterialIcons name="more-horiz" size={22} color={iconMuted} />
                        </Pressable>
                        {menuOpen ? (
                            <Pressable
                                onPress={clearAll}
                                disabled={memory.isLoading || memory.atoms.length === 0}
                                className={[
                                    'mt-1 rounded-xl border border-divider-light dark:border-divider-dark',
                                    'bg-surface-light dark:bg-surface-dark px-3 py-2',
                                    memory.isLoading || memory.atoms.length === 0 ? 'opacity-50' : '',
                                ].join(' ')}
                                accessibilityRole="button"
                                accessibilityLabel="Clear local memory"
                            >
                                <Text className="text-xs font-semibold text-red-600 dark:text-red-400">
                                    Clear all
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>

                {memory.isLoading && memory.atoms.length === 0 ? (
                    <MemoryHubSkeleton />
                ) : memory.atoms.length === 0 ? (
                    <MemoryEmpty onWritePress={() => router.push('/chat')} />
                ) : (
                    <View className="gap-7">
                        <MemoryPortrait
                            atoms={memory.atoms}
                            onOpenGraph={handleOpenGraph}
                            onThemePress={(tag) => setQuery(tag)}
                        />

                        <View className="gap-3">
                            <Pressable
                                onPress={() => setNotesOpen((open) => !open)}
                                className="flex-row items-center justify-between px-0.5"
                                accessibilityRole="button"
                                accessibilityState={{ expanded: notesOpen }}
                                accessibilityLabel="Notes"
                            >
                                <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                                    Notes
                                </Text>
                                <MaterialIcons
                                    name={notesOpen ? 'expand-less' : 'expand-more'}
                                    size={22}
                                    color={iconMuted}
                                />
                            </Pressable>
                            {notesOpen ? (
                                <MemoryNotesPanel
                                    noteText={noteText}
                                    generatedNote={memory.generatedNote}
                                    sourceThemes={sourceThemes}
                                    isBusy={false}
                                    onNoteTextChange={setNoteText}
                                    onSaveNote={saveNote}
                                    onSaveGeneratedNote={saveGeneratedNote}
                                    onRefreshGeneratedNote={memory.refreshGeneratedNote}
                                />
                            ) : null}
                        </View>

                        <View className="gap-3">
                            <View className="flex-row items-center justify-between px-0.5">
                                <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                                    Memories
                                </Text>
                                <Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                    {filteredAtoms.length}
                                </Text>
                            </View>
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Search memories"
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
                                <View className="overflow-hidden rounded-2xl border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark">
                                    {visibleAtoms.map((atom, index) => (
                                        <MemoryAtomCard
                                            key={atom.id}
                                            atom={atom}
                                            isLast={index === visibleAtoms.length - 1 && remaining === 0}
                                            onDelete={deleteAtom}
                                            onTagPress={(tag) => setQuery(tag)}
                                            onOpen={handleOpenAtom}
                                        />
                                    ))}
                                    {remaining > 0 ? (
                                        <Pressable
                                            onPress={() => setVisibleCount((count) => count + MEMORY_ATOMS_PAGE_SIZE)}
                                            className="h-12 items-center justify-center border-t border-divider-light dark:border-divider-dark"
                                            accessibilityRole="button"
                                            accessibilityLabel={`Show ${remaining} more memories`}
                                        >
                                            <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                                                Show more · {remaining} left
                                            </Text>
                                        </Pressable>
                                    ) : null}
                                </View>
                            ) : (
                                <Text className="px-1 py-6 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                    No matching memories. Adjust search or layer filter.
                                </Text>
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
                                    ? 'border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark'
                                    : 'border-divider-light bg-surface-light dark:border-divider-dark dark:bg-surface-dark',
                            ].join(' ')}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`Show ${label} memories`}
                        >
                            <Text className={[
                                'text-xs font-bold',
                                active
                                    ? 'text-white dark:text-gray-900'
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
