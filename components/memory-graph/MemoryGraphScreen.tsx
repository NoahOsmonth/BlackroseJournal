import React, { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BottomNav } from '@/components/journal';
import { EmptyState } from '@/components/ui/EmptyState';
import { TintColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMemoryGraph } from '@/hooks/memory/useMemoryGraph';
import { useMemorySourcePreview } from '@/hooks/memory/useMemorySourcePreview';
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
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const graph = useMemoryGraph({ initialLayer, initialQuery });
    const source = useMemorySourcePreview(graph.selectedAtom);
    // Match constellation engine page backgrounds (light sky / deep night)
    const stageBackground = isDark ? '#06080F' : '#EEF1F8';

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'explore') goToTab(tab);
    };

    const handleOpenSource = useCallback(() => {
        const preview = source.preview;
        if (!preview) return;
        if (preview.kind === 'journal_entry') {
            router.push({ pathname: '/entry-detail', params: { id: preview.id } });
            return;
        }
        router.push({ pathname: '/checkin-detail', params: { id: preview.id } });
    }, [router, source.preview]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="w-full max-w-2xl self-center">
                <MemoryGraphHeader
                    query={graph.searchQuery}
                    onQueryChange={graph.setSearchQuery}
                    onBack={onBack}
                />
                <MemoryGraphFilters activeLayers={graph.activeLayers} onToggle={graph.toggleLayer} />
            </View>

            <View
                testID="memory-graph-stage"
                className={`${showBottomNav ? 'mb-32' : 'mb-0'} flex-1`}
                style={{ backgroundColor: stageBackground }}
            >
                <MemoryGraphWebView
                    atoms={graph.atoms}
                    connections={graph.connections}
                    colorScheme={isDark ? 'dark' : 'light'}
                    onSelectNode={graph.setSelectedNodeId}
                />

                {graph.isLoading ? (
                    <View className="absolute inset-0 items-center justify-center">
                        <ActivityIndicator color={isDark ? TintColors.dark : TintColors.light} />
                    </View>
                ) : null}

                {!graph.isLoading && graph.atoms.length === 0 ? (
                    <View className="absolute inset-0 items-center justify-center px-8">
                        <EmptyState
                            icon="hub"
                            title="Your constellation is empty"
                            message="Finish journal entries and intention check-ins, and Rosebud will light up moments, themes, and patterns."
                        />
                    </View>
                ) : null}
            </View>

            {graph.selectedAtom ? (
                <MemoryGraphSheet
                    atom={graph.selectedAtom}
                    localInsight={graph.localInsight}
                    isGlanceLoading={graph.isGlanceLoading}
                    remoteInsight={graph.remoteInsight}
                    isDeepening={graph.isSynthesizing}
                    sourcePreview={source.preview}
                    isSourceLoading={source.isLoading}
                    sourceMissing={source.missing}
                    relatedAtoms={graph.relatedAtoms}
                    onClose={graph.closeSelectedAtom}
                    onDeepen={graph.deepenSelectedAtom}
                    onOpenSource={handleOpenSource}
                    onSelectRelated={graph.setSelectedNodeId}
                />
            ) : null}

            {showBottomNav ? (
                <BottomNav
                    activeTab="explore"
                    onTabPress={handleTabPress}
                    onFabPress={() => router.push('/chat')}
                />
            ) : null}
        </SafeAreaView>
    );
}
