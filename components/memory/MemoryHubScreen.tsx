import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { BottomNav } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { RevealItem } from '@/components/ui/RevealItem';
import { useScrollReveal } from '@/components/ui/useScrollReveal';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { BLACKROSE_PALETTE } from '@/constants/theme';
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
    memoryAtomRoute,
    topMemoryThemes,
    type MemoryLayerFilter,
} from './memoryDisplay';

/** How many atom rows to show before requiring “Show more”. */
export const MEMORY_ATOMS_PAGE_SIZE = 8;

export function MemoryHubScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { scrollY, onScroll } = useScrollReveal();
    const { goToTab } = useTabNavigation();
    const memory = useLocalMemories();
    const isDark = useColorScheme() === 'dark';
    const [activeLayer, setActiveLayer] = useState<MemoryLayerFilter>('all');
    const [query, setQuery] = useState('');
    const [noteText, setNoteText] = useState('');
    const [visibleCount, setVisibleCount] = useState(MEMORY_ATOMS_PAGE_SIZE);
    const [menuOpen, setMenuOpen] = useState(false);

    const inkMuted = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
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
            <Animated.ScrollView
                className="flex-1 pt-6"
                contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingBottom: navAwareBottomPadding(insets.bottom),
                }}
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
            >
                <RevealItem scrollY={scrollY}>
                    <View className="mb-6 flex-row items-start justify-between gap-4 border-b border-hairline-light pb-5 dark:border-hairline-dark">
                        <View className="flex-1">
                            <Text
                                className="text-[34px] leading-10 text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                Memory
                            </Text>
                            <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                What Blackrose holds for you
                            </Text>
                        </View>
                        <View className="items-end">
                            <Pressable
                                onPress={() => setMenuOpen((open) => !open)}
                                accessibilityRole="button"
                                accessibilityLabel="Memory options"
                                hitSlop={8}
                                className="h-9 w-9 items-center justify-center"
                            >
                                <MaterialIcons name="more-horiz" size={22} color={inkMuted} />
                            </Pressable>
                            {menuOpen ? (
                                <Pressable
                                    onPress={clearAll}
                                    disabled={memory.isLoading || memory.atoms.length === 0}
                                    className={[
                                        'mt-1 rounded-control border border-hairline-light px-3 py-2 dark:border-hairline-dark',
                                        'bg-surface-light dark:bg-surface-dark',
                                        memory.isLoading || memory.atoms.length === 0 ? 'opacity-50' : '',
                                    ].join(' ')}
                                    accessibilityRole="button"
                                    accessibilityLabel="Clear local memory"
                                >
                                    <Text className="text-xs text-danger-light dark:text-danger-dark">
                                        Clear all
                                    </Text>
                                </Pressable>
                            ) : null}
                        </View>
                    </View>
                </RevealItem>

                {memory.isLoading && memory.atoms.length === 0 ? (
                    <MemoryHubSkeleton />
                ) : memory.atoms.length === 0 ? (
                    <MemoryEmpty onWritePress={() => router.push('/chat')} />
                ) : (
                    <View className="gap-7">
                        <RevealItem scrollY={scrollY}>
                            <MemoryPortrait
                                atoms={memory.atoms}
                                onThemePress={(tag) => setQuery(tag)}
                            />
                        </RevealItem>

                        <RevealItem scrollY={scrollY}>
                            <View className="gap-4">
                                <LayerFilters
                                    activeLayer={activeLayer}
                                    atoms={memory.atoms}
                                    onLayerPress={setActiveLayer}
                                />

                                <View className="flex-row items-center gap-2 rounded-control border border-hairline-light px-4 dark:border-hairline-dark">
                                    <MaterialIcons name="search" size={18} color={inkMuted} />
                                    <TextInput
                                        value={query}
                                        onChangeText={setQuery}
                                        placeholder="Search memories"
                                        placeholderTextColor={inkMuted}
                                        className="flex-1 py-3 text-sm text-text-light dark:text-text-dark"
                                        accessibilityLabel="Search local memory"
                                    />
                                </View>

                                {filteredAtoms.length > 0 ? (
                                    <View className="gap-3">
                                        {visibleAtoms.map((atom, index) => (
                                            <StaggerEntranceItem
                                                key={atom.id}
                                                index={index}
                                                columns={1}
                                                totalItems={Math.min(visibleAtoms.length, 8)}
                                                staggerType="linear"
                                                baseDelayMs={20}
                                                delayFactorMs={40}
                                                className="w-full"
                                            >
                                                <MemoryAtomCard
                                                    atom={atom}
                                                    onDelete={deleteAtom}
                                                    onTagPress={(tag) => setQuery(tag)}
                                                    onOpen={handleOpenAtom}
                                                />
                                            </StaggerEntranceItem>
                                        ))}
                                        {remaining > 0 ? (
                                            <Pressable
                                                onPress={() => setVisibleCount((count) => count + MEMORY_ATOMS_PAGE_SIZE)}
                                                className="h-12 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark"
                                                accessibilityRole="button"
                                                accessibilityLabel={`Show ${remaining} more memories`}
                                                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                                            >
                                                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
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

                                <Pressable
                                    onPress={handleOpenGraph}
                                    accessibilityRole="button"
                                    accessibilityLabel="Explore memory graph"
                                    hitSlop={6}
                                    style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                                >
                                    <Text
                                        className="text-[17px] text-text-light underline dark:text-text-dark"
                                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                    >
                                        Open graph
                                    </Text>
                                </Pressable>
                            </View>
                        </RevealItem>

                        <RevealItem scrollY={scrollY}>
                            <View className="gap-4">
                                <Text
                                    className="text-[19px] text-text-light dark:text-text-dark"
                                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                >
                                    Notes
                                </Text>
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
                            </View>
                        </RevealItem>
                    </View>
                )}
            </Animated.ScrollView>

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

/** Concept labels: All · Episodic · Semantic · Profile — four equal segments
 *  that always fit the gutter, so nothing clips mid-word. */
const HUB_LAYER_ORDER: MemoryLayerFilter[] = ['all', 'episodic', 'semantic', 'profile'];

const HUB_LAYER_LABELS: Record<MemoryLayerFilter, string> = {
    all: 'All',
    episodic: 'Episodic',
    semantic: 'Semantic',
    profile: 'Profile',
    working: 'Working',
    procedural: 'Procedural',
    note: 'Notes',
};

function LayerFilters({ activeLayer, atoms, onLayerPress }: LayerFiltersProps) {
    const present = new Set(atoms.map((atom) => atom.layer));
    // Always keep the concept's four slots; drop a layer only when it has no
    // atoms at all so the control never shows an empty bucket.
    const options = HUB_LAYER_ORDER.filter(
        (layer) => layer === 'all' || layer === 'profile' || present.has(layer)
    );

    return (
        <View className="h-11 flex-row items-stretch overflow-hidden rounded-control border border-hairline-light dark:border-hairline-dark">
            {options.map((layer, index) => {
                const active = activeLayer === layer;
                const label = HUB_LAYER_LABELS[layer];
                return (
                    <Pressable
                        key={layer}
                        onPress={() => onLayerPress(layer)}
                        className={[
                            'flex-1 items-center justify-center px-2',
                            index > 0 ? 'border-l border-hairline-light dark:border-hairline-dark' : '',
                            active ? 'bg-surface-2-light dark:bg-surface-2-dark' : '',
                        ].join(' ')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Show ${label} memories`}
                    >
                        <Text
                            numberOfLines={1}
                            className={[
                                'text-[14px]',
                                active
                                    ? 'text-text-light dark:text-text-dark'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark',
                            ].join(' ')}
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        >
                            {label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Please try again.';
}
