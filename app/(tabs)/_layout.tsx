/**
 * Tabs Layout
 * Main tab navigator - we hide the default tabs since we use custom BottomNav
 */

import { Tabs } from 'expo-router';

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: 'none' },
            }}
        >
            <Tabs.Screen name="today" />
            <Tabs.Screen name="explore" />
            <Tabs.Screen name="entries" />
            <Tabs.Screen name="settings" />
        </Tabs>
    );
}
