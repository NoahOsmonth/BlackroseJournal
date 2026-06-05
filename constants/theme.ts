/**
 * Theme and Typography Configuration
 * 
 * ## Typography Decision (Task 010)
 * - Use Plus Jakarta Sans across the app for the updated UI system.
 * - Keep Playfair Display available for occasional serif emphasis.
 * 
 * ## Color Token Strategy
 * - All components use theme tokens defined in tailwind.config.js
 * - Primary color: #FF9F0A (orange) - used for accents, CTAs, active states
 * - Light mode: iOS-style gray background with dark text
 * - Dark mode: true black background with light text
 * 
 * See tailwind.config.js for the full token palette used by NativeWind.
 */

import { Platform } from 'react-native';

/**
 * Semantic color constants - use these instead of hardcoded hex values.
 * All hardcoded colors should reference these constants.
 */
export const TintColors = {
  light: '#FF9F0A',
  dark: '#FFB340',
} as const;

export const PersonaColors = {
  rose: '#E91E63',
  tealBase: '#2DD4BF',
  tealDark: '#14B8A6',
  tealLight: '#5EEAD4',
  tealShadow: '#0F766E',
} as const;

export const ChatColors = {
  accentLight: '#3B82F6',
  accentDark: '#38BDF8',
  activeDark: '#60A5FA',
} as const;

export const Colors = {
  light: {
    text: '#111827',
    background: '#F2F2F7',
    surface: '#FFFFFF',
    tint: TintColors.light,
    icon: '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: TintColors.light,
    primary: TintColors.light,
    primaryDark: '#FF8C00',
  },
  dark: {
    text: '#F9FAFB',
    background: '#000000',
    surface: '#1C1C1E',
    tint: TintColors.dark,
    icon: '#98989D',
    tabIconDefault: '#98989D',
    tabIconSelected: TintColors.dark,
    primary: TintColors.dark,
    primaryDark: '#FF8C00',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'PlusJakartaSansRegular',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'PlayfairDisplayRegular',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'PlusJakartaSansRegular',
    serif: 'PlayfairDisplayRegular',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "'Playfair Display', Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
