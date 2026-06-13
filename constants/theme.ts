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
  userTextLight: '#7C2D12',
  userTextDark: '#FDBA74',
} as const;

export type ColorThemePresetId =
  | 'rosebud'
  | 'ocean'
  | 'forest'
  | 'plum'
  | 'sunset'
  | 'lavender'
  | 'mint'
  | 'mocha'
  | 'custom';

export type ColorThemeSlot =
  | 'accentLight'
  | 'accentDark'
  | 'appTextLight'
  | 'appTextDark'
  | 'secondaryTextLight'
  | 'secondaryTextDark'
  | 'chatUserTextLight'
  | 'chatUserTextDark'
  | 'chatAiTextLight'
  | 'chatAiTextDark'
  | 'appBackgroundLight'
  | 'appBackgroundDark';

export type ColorThemeColors = Record<ColorThemeSlot, string>;

export interface ColorTheme {
  readonly presetId: ColorThemePresetId;
  readonly colors: ColorThemeColors;
}

export interface ColorThemePreset extends ColorTheme {
  readonly presetId: Exclude<ColorThemePresetId, 'custom'>;
  readonly name: string;
}

export const AppBackgroundColors = {
  light: '#F2F2F7',
  dark: '#0A0A0A',
} as const;

export const DEFAULT_COLOR_THEME_COLORS: ColorThemeColors = {
  accentLight: '#FF9F0A',
  accentDark: '#FFB340',
  appTextLight: '#111827',
  appTextDark: '#F9FAFB',
  secondaryTextLight: '#6B7280',
  secondaryTextDark: '#9CA3AF',
  chatUserTextLight: '#7C2D12',
  chatUserTextDark: '#FDBA74',
  chatAiTextLight: '#3B82F6',
  chatAiTextDark: '#38BDF8',
  appBackgroundLight: AppBackgroundColors.light,
  appBackgroundDark: AppBackgroundColors.dark,
} as const;

export const COLOR_THEME_PRESETS: readonly ColorThemePreset[] = [
  {
    presetId: 'rosebud',
    name: 'Rosebud',
    colors: DEFAULT_COLOR_THEME_COLORS,
  },
  {
    presetId: 'ocean',
    name: 'Ocean',
    colors: {
      accentLight: '#0EA5E9',
      accentDark: '#67E8F9',
      appTextLight: '#0F172A',
      appTextDark: '#ECFEFF',
      secondaryTextLight: '#475569',
      secondaryTextDark: '#94A3B8',
      chatUserTextLight: '#155E75',
      chatUserTextDark: '#A5F3FC',
      chatAiTextLight: '#2563EB',
      chatAiTextDark: '#7DD3FC',
      appBackgroundLight: AppBackgroundColors.light,
      appBackgroundDark: AppBackgroundColors.dark,
    },
  },
  {
    presetId: 'forest',
    name: 'Forest',
    colors: {
      accentLight: '#16A34A',
      accentDark: '#86EFAC',
      appTextLight: '#172412',
      appTextDark: '#F0FDF4',
      secondaryTextLight: '#4B6350',
      secondaryTextDark: '#A7F3D0',
      chatUserTextLight: '#854D0E',
      chatUserTextDark: '#FDE68A',
      chatAiTextLight: '#047857',
      chatAiTextDark: '#6EE7B7',
      appBackgroundLight: AppBackgroundColors.light,
      appBackgroundDark: AppBackgroundColors.dark,
    },
  },
  {
    presetId: 'plum',
    name: 'Plum',
    colors: {
      accentLight: '#DB2777',
      accentDark: '#F9A8D4',
      appTextLight: '#251421',
      appTextDark: '#FFF1F2',
      secondaryTextLight: '#6B4E63',
      secondaryTextDark: '#F0ABFC',
      chatUserTextLight: '#7C2D12',
      chatUserTextDark: '#FDBA74',
      chatAiTextLight: '#7C3AED',
      chatAiTextDark: '#C4B5FD',
      appBackgroundLight: AppBackgroundColors.light,
      appBackgroundDark: AppBackgroundColors.dark,
    },
  },
  {
    presetId: 'sunset',
    name: 'Sunset',
    colors: {
      accentLight: '#F97316',
      accentDark: '#FDBA74',
      appTextLight: '#3F1D0B',
      appTextDark: '#FFF7ED',
      secondaryTextLight: '#7C4A2A',
      secondaryTextDark: '#FED7AA',
      chatUserTextLight: '#9A3412',
      chatUserTextDark: '#FFEDD5',
      chatAiTextLight: '#DC2626',
      chatAiTextDark: '#FCA5A5',
      appBackgroundLight: AppBackgroundColors.light,
      appBackgroundDark: AppBackgroundColors.dark,
    },
  },
  {
    presetId: 'lavender',
    name: 'Lavender',
    colors: {
      accentLight: '#7C3AED',
      accentDark: '#C4B5FD',
      appTextLight: '#1E1B4B',
      appTextDark: '#F5F3FF',
      secondaryTextLight: '#5B5586',
      secondaryTextDark: '#C7D2FE',
      chatUserTextLight: '#4338CA',
      chatUserTextDark: '#C7D2FE',
      chatAiTextLight: '#9333EA',
      chatAiTextDark: '#E9D5FF',
      appBackgroundLight: AppBackgroundColors.light,
      appBackgroundDark: AppBackgroundColors.dark,
    },
  },
  {
    presetId: 'mint',
    name: 'Mint',
    colors: {
      accentLight: '#0D9488',
      accentDark: '#5EEAD4',
      appTextLight: '#042F2E',
      appTextDark: '#F0FDFA',
      secondaryTextLight: '#3F6F6A',
      secondaryTextDark: '#A7F3D0',
      chatUserTextLight: '#115E59',
      chatUserTextDark: '#CCFBF1',
      chatAiTextLight: '#0891B2',
      chatAiTextDark: '#A5F3FC',
      appBackgroundLight: AppBackgroundColors.light,
      appBackgroundDark: AppBackgroundColors.dark,
    },
  },
  {
    presetId: 'mocha',
    name: 'Mocha',
    colors: {
      accentLight: '#92400E',
      accentDark: '#FBBF24',
      appTextLight: '#1C1917',
      appTextDark: '#FAFAF9',
      secondaryTextLight: '#57534E',
      secondaryTextDark: '#D6D3D1',
      chatUserTextLight: '#78350F',
      chatUserTextDark: '#FEF3C7',
      chatAiTextLight: '#A16207',
      chatAiTextDark: '#FDE68A',
      appBackgroundLight: AppBackgroundColors.light,
      appBackgroundDark: AppBackgroundColors.dark,
    },
  },
] as const;

export const DEFAULT_COLOR_THEME: ColorTheme = {
  presetId: 'rosebud',
  colors: DEFAULT_COLOR_THEME_COLORS,
} as const;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return isHexColor(withHash) ? withHash.toUpperCase() : null;
}

export function colorThemeFromPreset(presetId: ColorThemePresetId): ColorTheme {
  const preset = COLOR_THEME_PRESETS.find((item) => item.presetId === presetId);
  return {
    presetId: preset?.presetId ?? DEFAULT_COLOR_THEME.presetId,
    colors: { ...(preset?.colors ?? DEFAULT_COLOR_THEME.colors) },
  };
}

export function updateColorThemeSlot(
  themeValue: ColorTheme,
  slot: ColorThemeSlot,
  value: string
): ColorTheme | null {
  const normalized = normalizeHexColor(value);
  if (!normalized) {
    return null;
  }

  return {
    presetId: 'custom',
    colors: {
      ...themeValue.colors,
      [slot]: normalized,
    },
  };
}

export function getColorThemeSlotPartner(slot: ColorThemeSlot): ColorThemeSlot {
  if (slot.endsWith('Light')) {
    return slot.replace(/Light$/, 'Dark') as ColorThemeSlot;
  }
  if (slot.endsWith('Dark')) {
    return slot.replace(/Dark$/, 'Light') as ColorThemeSlot;
  }
  return slot;
}

export function isColorThemeLightSlot(slot: ColorThemeSlot): boolean {
  return slot.endsWith('Light');
}

/**
 * Curated quick-pick palette for the Color Studio picker.
 *
 * These are the "tap once, get a good color" presets that show up at the
 * top of the picker. Grouped by mood so the row reads like a vocabulary
 * the user can scan, not a random CSS color chart. Hex values are picked
 * to be mid-tones so the auto-derived partner has room to move in both
 * directions (light or dark) without ending up invisible.
 */
export const QUICK_PICK_COLORS: readonly string[] = [
  '#FF9F0A', // honey
  '#F97316', // tangerine
  '#DC2626', // crimson
  '#DB2777', // magenta
  '#9333EA', // amethyst
  '#7C3AED', // iris
  '#4F46E5', // indigo
  '#2563EB', // sapphire
  '#0EA5E9', // sky
  '#0D9488', // teal
  '#16A34A', // emerald
  '#65A30D', // lime
  '#CA8A04', // mustard
  '#92400E', // cinnamon
  '#475569', // slate
  '#111827', // graphite
];

function hexToRgbTriplet(hex: string): string {
  const normalized = normalizeHexColor(hex) ?? '#000000';
  const value = normalized.slice(1);
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function colorThemeToNativeWindVars(themeValue: ColorTheme): Record<string, string> {
  const colors = themeValue.colors;

  return {
    '--color-primary': hexToRgbTriplet(colors.accentLight),
    '--color-primary-dark': hexToRgbTriplet(colors.accentDark),
    '--color-text-light': hexToRgbTriplet(colors.appTextLight),
    '--color-text-dark': hexToRgbTriplet(colors.appTextDark),
    '--color-text-main-light': hexToRgbTriplet(colors.appTextLight),
    '--color-text-main-dark': hexToRgbTriplet(colors.appTextDark),
    '--color-text-primary-light': hexToRgbTriplet(colors.appTextLight),
    '--color-text-primary-dark': hexToRgbTriplet(colors.appTextDark),
    '--color-text-secondary-light': hexToRgbTriplet(colors.secondaryTextLight),
    '--color-text-secondary-dark': hexToRgbTriplet(colors.secondaryTextDark),
    '--color-subtext-light': hexToRgbTriplet(colors.secondaryTextLight),
    '--color-subtext-dark': hexToRgbTriplet(colors.secondaryTextDark),
    '--color-user-text': hexToRgbTriplet(colors.chatUserTextLight),
    '--color-user-text-dark': hexToRgbTriplet(colors.chatUserTextDark),
    '--color-accent-blue': hexToRgbTriplet(colors.chatAiTextLight),
    '--color-ai-text': hexToRgbTriplet(colors.chatAiTextDark),
    '--color-background-light': hexToRgbTriplet(colors.appBackgroundLight),
    '--color-background-dark': hexToRgbTriplet(colors.appBackgroundDark),
  };
}

export const TodayIconColors = {
  morningSkyLight: '#E0F2FE',
  morningHillLight: '#BBF7D0',
  morningSmileLight: '#7C2D12',
  eveningSkyLight: '#EEF2FF',
  eveningMoonLight: '#F59E0B',
  eveningMoonDark: '#FDE68A',
  eveningWaterLight: '#99F6E4',
  eveningWaterLineLight: '#0F766E',
  eveningStarLight: '#818CF8',
  eveningWaterLineDark: '#5EEAD4',
  morningHillDark: '#14532D',
} as const;

export const MemoryLayerColors = {
  episodic: '#A370F7',
  semantic: '#38BDF8',
  profile: '#FB7185',
  procedural: '#34D399',
  note: '#FBBF24',
  working: '#F472B6',
} as const;

export const Colors = {
  light: {
    text: '#111827',
    background: AppBackgroundColors.light,
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
    background: AppBackgroundColors.dark,
    surface: '#1C1C1E',
    tint: TintColors.dark,
    icon: '#98989D',
    tabIconDefault: '#98989D',
    tabIconSelected: TintColors.dark,
    primary: TintColors.dark,
    primaryDark: '#FF8C00',
  },
};

export const theme = {
  colors: {
    background: Colors.dark.background,
    surface: Colors.dark.surface,
    text: Colors.dark.text,
    primary: Colors.light.primary,
    memoryLayers: MemoryLayerColors,
  },
} as const;

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
