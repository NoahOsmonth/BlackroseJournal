import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BottomNav } from '@/components/journal';
import { EmptyState } from '@/components/ui/EmptyState';
import { TintColors } from '@/constants/theme';
import { useMemoryGraph } from '@/hooks/memory/useMemoryGraph';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import type { MemoryLayer } from '@/services/memory/memoryGraph.types';
import { MemoryGraphFilters } from './MemoryGraphFilters';
import { MemoryGraphHeader } from './MemoryGraphHeader';
import { MemoryGraphSheet } from './MemoryGraphSheet';
import { MemoryGraphWebView } from './MemoryGraphWebView';

interface MemoryGraphScreenProps {
    showBottomNav?: boolean;
    initialLayer?: MemoryLayer;
    initialQuery?: string;
    onBack?: () => void;
}

export function MemoryGraphScreen({
    showBottomNav = false,
    initialLayer,
    initialQuery,
    onBack,
}: MemoryGraphScreenProps) {
    const router = useRouter();
    const { goToTab } = useTabNavigation();
    const graph = useMemoryGraph({ initialLayer, initialQuery });

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'explore') goToTab(tab);
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <MemoryGraphHeader
                    query={graph.searchQuery}
                    onQueryChange={graph.setSearchQuery}
                    onBack={onBack}
                />
                <MemoryGraphFilters activeLayers={graph.activeLayers} onToggle={graph.toggleLayer} />

                <View testID="memory-graph-stage" className="mb-32 flex-1 bg-background-dark">
                    <MemoryGraphWebView
                        atoms={graph.atoms}
                        connections={graph.connections}
                        onSelectNode={graph.setSelectedNodeId}
                    />

                    {graph.isLoading ? (
                        <View className="absolute inset-0 items-center justify-center">
                            <ActivityIndicator color={TintColors.light} />
                        </View>
                    ) : null}

                    {!graph.isLoading && graph.atoms.length === 0 ? (
                        <View className="absolute inset-0 items-center justify-center px-8">
                            <EmptyState
                                icon="hub"
                                title="Your memory graph starts here"
                                message="Finish journal entries and Rosebud will connect themes, moments, and profile notes."
                            />
                        </View>
                    ) : null}
                </View>

                {graph.selectedAtom ? (
                    <MemoryGraphSheet
                        atom={graph.selectedAtom}
                        insight={graph.insight}
                        isLoading={graph.isSynthesizing}
                        onClose={graph.closeSelectedAtom}
                        onSynthesize={graph.synthesizeSelectedAtom}
                    />
                ) : null}

                {showBottomNav ? (
                    <BottomNav
                        activeTab="explore"
                        onTabPress={handleTabPress}
                        onFabPress={() => router.push('/chat')}
                    />
                ) : null}
            </View>
        </SafeAreaView>
    );
}
