/**
 * DailyJournalingCard Component
 * Card with daily check-in prompt and "Check in now" CTA
 * Matches today.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface DailyJournalingCardProps {
    promptTitle: string;
    promptDescription: string;
    onCheckIn: () => void;
}

export function DailyJournalingCard({
    promptTitle,
    promptDescription,
    onCheckIn,
}: DailyJournalingCardProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const primaryColor = useThemeColor({}, 'primary');

    return (
        <View className="space-y-3">
            <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide ml-1">
                Daily Journaling
            </Text>

            <View
                className={`bg-surface-light dark:bg-surface-dark rounded-xl p-5 ${isDark ? 'border border-border-dark' : ''
                    }`}
                style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0 : 0.03,
                    shadowRadius: 5,
                    elevation: isDark ? 0 : 2,
                }}
            >
                <View className="flex-row justify-between items-start mb-4">
                    <View className="space-y-3" style={{ maxWidth: '70%' }}>
                        <View
                            className={`self-start px-3 py-1 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'
                                }`}
                        >
                            <Text
                                className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-600'
                                    }`}
                            >
                                Daily check-in
                            </Text>
                        </View>

                        <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark leading-tight">
                            {promptTitle}
                        </Text>

                        <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">
                            {promptDescription}
                        </Text>
                    </View>

                    {/* Decorative icons */}
                    <View className="w-16 h-16 relative flex-shrink-0">
                        <MaterialIcons
                            name="bedtime"
                            size={64}
                            color="#BFDBFE"
                            style={{ position: 'absolute', top: -10, right: -10 }}
                        />
                        <MaterialIcons
                            name="star"
                            size={16}
                            color="#FCD34D"
                            style={{ position: 'absolute', top: 0, right: 0 }}
                        />
                        <MaterialIcons
                            name="star"
                            size={12}
                            color="#FCD34D"
                            style={{ position: 'absolute', bottom: 8, left: 0 }}
                        />
                    </View>
                </View>

                <Pressable
                    onPress={onCheckIn}
                    accessibilityLabel="Check in now"
                    accessibilityRole="button"
                    className="w-full bg-primary py-3 px-4 rounded-xl flex-row items-center justify-center active:bg-primary-dark"
                    style={{
                        shadowColor: primaryColor,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 6,
                    }}
                >
                    <MaterialIcons name="edit" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text className="text-white font-bold">Check in now</Text>
                </Pressable>
            </View>
        </View>
    );
}
