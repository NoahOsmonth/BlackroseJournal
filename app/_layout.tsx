import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { AppErrorBoundary } from '@/components/system/AppErrorBoundary';
import { SupabaseStatusBanner } from '@/components/system/SupabaseStatusBanner';
import { installRawTextGuard } from '@/utils/dev/rawTextGuard';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { PlayfairDisplay_400Regular, PlayfairDisplay_700Bold, useFonts } from '@expo-google-fonts/playfair-display';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useEffect } from 'react';
installRawTextGuard();

export default function RootLayout() {
  useThemeSettings();
  const colorScheme = useColorScheme();
  const [, fontsError] = useFonts({
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

  useEffect(() => {
    if (fontsError) {
      console.warn('Font loading error:', fontsError);
    }
  }, [fontsError]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppErrorBoundary>
        <SupabaseStatusBanner />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
          <Stack.Screen name="intentions/select" options={{ headerShown: false }} />
          <Stack.Screen name="intentions/chat" options={{ headerShown: false }} />
          <Stack.Screen name="intentions/detail" options={{ headerShown: false }} />
          <Stack.Screen name="intentions/edit" options={{ headerShown: false }} />
          <Stack.Screen name="persona/new" options={{ headerShown: false }} />
          <Stack.Screen name="persona/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="persona/advanced" options={{ headerShown: false }} />
          <Stack.Screen name="drafts" options={{ headerShown: false }} />
          <Stack.Screen name="saved-insights" options={{ headerShown: false }} />
          <Stack.Screen name="goals" options={{ headerShown: false }} />
          <Stack.Screen name="entry-detail" options={{ headerShown: false }} />
          <Stack.Screen name="checkin-detail" options={{ headerShown: false }} />
          <Stack.Screen name="entry-reflection" options={{ headerShown: false }} />
          <Stack.Screen name="suggestions" options={{ headerShown: false }} />
          <Stack.Screen name="streak-view" options={{ headerShown: false }} />
          <Stack.Screen
            name="streak-haiku"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </AppErrorBoundary>
    </ThemeProvider>
  );
}
