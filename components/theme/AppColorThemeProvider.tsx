import React, { useMemo } from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';

import { colorThemeToNativeWindVars } from '@/constants/theme';
import { useThemeSettings } from '@/hooks/useThemeSettings';

interface AppColorThemeProviderProps {
    readonly children: React.ReactNode;
}

export function AppColorThemeProvider({ children }: AppColorThemeProviderProps) {
    const { colorTheme } = useThemeSettings();

    // Defensive: vars() returns a style object that nativewind's runtime reads
    // at view mount time to register CSS custom properties. If anything in the
    // conversion throws on Android (e.g. the cssInterop runtime isn't fully
    // initialized at first render), fall back to a plain wrapper so the app
    // still renders the children with no color customization.
    const variableStyle = useMemo(() => {
        try {
            return vars(colorThemeToNativeWindVars(colorTheme));
        } catch (error) {
            if (__DEV__) {
                console.warn(
                    '[AppColorThemeProvider] vars() threw, falling back to plain View:',
                    error,
                );
            }
            return {};
        }
    }, [colorTheme]);

    return (
        <View testID="app-color-theme-provider" className="flex-1" style={variableStyle}>
            {children}
        </View>
    );
}
