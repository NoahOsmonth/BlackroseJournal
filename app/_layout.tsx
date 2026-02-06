import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

// Import reanimated FIRST
import 'react-native-reanimated';

// Import NativeWind CSS
import '../global.css';

import { AppErrorBoundary } from '@/components/system/AppErrorBoundary';
import { SupabaseStatusBanner } from '@/components/system/SupabaseStatusBanner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';

// Font imports
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold, useFonts } from '@expo-google-fonts/playfair-display';
import {
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

// Prevent splash from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => { });

export default function RootLayout() {
    useThemeSettings();
    const colorScheme = useColorScheme();
    const [appReady, setAppReady] = useState(false);

    const [fontsLoaded, fontsError] = useFonts({
        PlusJakartaSansRegular: PlusJakartaSans_400Regular,
        PlusJakartaSansMedium: PlusJakartaSans_500Medium,
        PlusJakartaSansSemiBold: PlusJakartaSans_600SemiBold,
        PlusJakartaSansBold: PlusJakartaSans_700Bold,
        PlayfairDisplayRegular: PlayfairDisplay_400Regular,
        PlayfairDisplayBold: PlayfairDisplay_700Bold,
        LatoRegular: Lato_400Regular,
        LatoBold: Lato_700Bold,
        Inter: Inter_400Regular,
        InterMedium: Inter_500Medium,
        InterSemiBold: Inter_600SemiBold,
        InterBold: Inter_700Bold,
    });

    // Hide splash and mark ready when fonts load or after timeout
    useEffect(() => {
        const markReady = async () => {
            try {
                await SplashScreen.hideAsync();
            } catch (e) {
                // Ignore errors
            }
            setAppReady(true);
        };

        if (fontsLoaded || fontsError) {
            markReady();
        }

        // Fallback timeout to prevent infinite loading
        const timeout = setTimeout(markReady, 3000);
        return () => clearTimeout(timeout);
    }, [fontsLoaded, fontsError]);

    // Show loading screen while fonts load
    if (!appReady) {
        const bgColor = colorScheme === 'dark' ? '#0f0f23' : '#ffffff';
        const textColor = colorScheme === 'dark' ? '#ffffff' : '#1a1a2e';
        return (
            <View style={{ flex: 1, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={textColor} />
                <Text style={{ color: textColor, fontSize: 16, marginTop: 16 }}>Loading...</Text>
            </View>
        );
    }

    return (
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AppErrorBoundary>
                <SupabaseStatusBanner />
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="chat" />
                    <Stack.Screen name="drafts" />
                    <Stack.Screen name="saved-insights" />
                    <Stack.Screen name="goals" />
                    <Stack.Screen name="entry-detail" />
                    <Stack.Screen name="checkin-detail" />
                    <Stack.Screen name="entry-reflection" />
                    <Stack.Screen name="suggestions" />
                    <Stack.Screen name="streak-view" />
                    <Stack.Screen name="streak-haiku" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="ask-rosebud" />
                    <Stack.Screen name="happiness-recipe" />
                    <Stack.Screen name="rewards" />
                    <Stack.Screen name="index" />
                    <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                </Stack>
                <StatusBar style="auto" />
            </AppErrorBoundary>
        </ThemeProvider>
    );
}
