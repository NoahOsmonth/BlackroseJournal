import { BottomNav, FAB } from '@/components/journal';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeSettings, ThemePreference } from '@/hooks/useThemeSettings';
import { clearAllEntries, getAllEntriesForExport } from '@/services/journalStorage';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
    const router = useRouter();
    const { theme, setTheme } = useThemeSettings();

    const handleNewEntry = () => {
        router.push('/chat');
    };

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings') => {
        if (tab !== 'settings') {
            router.push(`/(tabs)/${tab}`);
        }
    };

    const handleExportData = async () => {
        try {
            const data = await getAllEntriesForExport();
            await Share.share({
                message: data,
                title: 'Journal Export'
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to export data');
            console.error(error);
        }
    };

    const handleClearData = () => {
        Alert.alert(
            "Clear All Data",
            "Are you sure you want to delete all journal entries? This action cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await clearAllEntries();
                            Alert.alert("Success", "All journal entries have been deleted.");
                        } catch (error) {
                            Alert.alert("Error", "Failed to clear data.");
                            console.error(error);
                        }
                    }
                }
            ]
        );
    };

    const ThemeOption = ({ label, value }: { label: string, value: ThemePreference }) => {
        const isActive = theme === value;
        return (
            <TouchableOpacity 
                onPress={() => setTheme(value)}
                className={`flex-1 items-center justify-center py-3 rounded-xl border ${
                    isActive
                    ? 'bg-primary border-transparent' 
                    : 'bg-transparent border-divider-light dark:border-divider-dark'
                }`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Select ${label} theme`}
            >
                <Text className={`font-semibold ${
                    isActive
                    ? 'text-white' 
                    : 'text-text-light dark:text-text-dark'
                }`}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full relative">
                <ScrollView className="flex-1 px-4 pt-6 pb-24">
                    <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark mb-8">
                        Settings
                    </Text>

                    {/* Appearance Section */}
                    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mb-6">
                        <Text className="text-sm font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wider mb-4">
                            Appearance
                        </Text>
                        <View className="flex-row gap-3">
                            <ThemeOption label="Light" value="light" />
                            <ThemeOption label="Dark" value="dark" />
                            <ThemeOption label="System" value="system" />
                        </View>
                    </View>

                    {/* Data Management Section */}
                    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mb-6">
                        <Text className="text-sm font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wider mb-4">
                            Data Management
                        </Text>
                        
                        <TouchableOpacity 
                            onPress={handleExportData}
                            className="flex-row items-center justify-between py-3 border-b border-divider-light dark:border-divider-dark mb-2"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                    <Ionicons name="share-outline" size={20} className="text-blue-600 dark:text-blue-400" color="#2563EB" />
                                </View>
                                <Text className="text-text-light dark:text-text-dark font-medium text-base">
                                    Export Data
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} className="text-subtext-light dark:text-subtext-dark" color="#9CA3AF" />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleClearData}
                            className="flex-row items-center justify-between py-3 mt-2"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                                    <Ionicons name="trash-outline" size={20} className="text-red-600 dark:text-red-400" color="#DC2626" />
                                </View>
                                <Text className="text-red-600 dark:text-red-400 font-medium text-base">
                                    Clear Data
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} className="text-subtext-light dark:text-subtext-dark" color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <FAB onPress={handleNewEntry} />
                
                <View className="absolute bottom-0 left-0 right-0">
                    <BottomNav activeTab="settings" onTabPress={handleTabPress} />
                </View>
            </View>
        </SafeAreaView>
    );
}
