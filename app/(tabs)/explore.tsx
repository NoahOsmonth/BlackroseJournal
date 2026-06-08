import { BottomNav } from '@/components/journal';
import {
    MemoryGraphFilters,
    MemoryGraphHeader,
    MemoryGraphSheet,
    MemoryGraphWebView,
} from '@/components/memory-graph';
import { TintColors } from '@/constants/theme';
import { useMemoryGraph } from '@/hooks/memory/useMemoryGraph';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreScreen() {
    const router = useRouter();
    const { goToTab } = useTabNavigation();
    const {
        atoms,
        connections,
        activeLayers,
        toggleLayer,
        selectedAtom,
        setSelectedNodeId,
        closeSelectedAtom,
        searchQuery,
        setSearchQuery,
        isLoading,
        isSynthesizing,
        insight,
        synthesizeSelectedAtom,
    } = useMemoryGraph();

    const handleNewEntry = () => {
        router.push('/chat');
    };

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'explore') {
            goToTab(tab);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <MemoryGraphHeader query={searchQuery} onQueryChange={setSearchQuery} />
                <MemoryGraphFilters activeLayers={activeLayers} onToggle={toggleLayer} />

                <View className="flex-1 bg-background-dark">
                    <MemoryGraphWebView
                        atoms={atoms}
                        connections={connections}
                        onSelectNode={setSelectedNodeId}
                    />

                    {isLoading && (
                        <View className="absolute inset-0 items-center justify-center">
                            <ActivityIndicator color={TintColors.light} />
                        </View>
                    )}

                    {!isLoading && atoms.length === 0 && (
                        <View className="absolute inset-0 items-center justify-center px-8">
                            <Text className="text-center text-sm font-medium text-text-dark dark:text-text-dark">
                                No memory nodes yet.
                            </Text>
                        </View>
                    )}
                </View>

                {selectedAtom && (
                    <MemoryGraphSheet
                        atom={selectedAtom}
                        insight={insight}
                        isLoading={isSynthesizing}
                        onClose={closeSelectedAtom}
                        onSynthesize={synthesizeSelectedAtom}
                    />
                )}

                <BottomNav
                    activeTab="explore"
                    onTabPress={handleTabPress}
                    onFabPress={handleNewEntry}
                />
            </View>
        </SafeAreaView>
    );
}
