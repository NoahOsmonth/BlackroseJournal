import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  COLOR_THEME_PRESETS,
  DEFAULT_COLOR_THEME,
  type ColorTheme,
  type ColorThemeColors,
  type ColorThemePresetId,
  type ColorThemeSlot,
  normalizeHexColor,
} from '@/constants/theme';

export const COLOR_THEME_STORAGE_KEY = '@blackrose_color_theme';

const SCHEMA_VERSION = 1;
const COLOR_THEME_SLOTS: readonly ColorThemeSlot[] = [
  'accentLight',
  'accentDark',
  'appTextLight',
  'appTextDark',
  'secondaryTextLight',
  'secondaryTextDark',
  'chatUserTextLight',
  'chatUserTextDark',
  'chatAiTextLight',
  'chatAiTextDark',
  'appBackgroundLight',
  'appBackgroundDark',
];

interface ColorThemeEnvelope {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly updatedAt: number;
  readonly theme: ColorTheme;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPresetId(value: unknown): value is ColorThemePresetId {
  return value === 'custom' || COLOR_THEME_PRESETS.some((preset) => preset.presetId === value);
}

function sanitizeColors(value: unknown): ColorThemeColors {
  const source = isObject(value) ? value : {};
  const colors: Partial<ColorThemeColors> = {};

  COLOR_THEME_SLOTS.forEach((slot) => {
    const normalized = typeof source[slot] === 'string'
      ? normalizeHexColor(source[slot])
      : null;
    colors[slot] = normalized ?? DEFAULT_COLOR_THEME.colors[slot];
  });

  return colors as ColorThemeColors;
}

function sanitizeTheme(value: unknown): ColorTheme {
  if (!isObject(value)) {
    return DEFAULT_COLOR_THEME;
  }

  return {
    presetId: isPresetId(value.presetId) ? value.presetId : 'custom',
    colors: sanitizeColors(value.colors),
  };
}

function parseStoredTheme(json: string): ColorTheme {
  const parsed: unknown = JSON.parse(json);

  if (isObject(parsed) && parsed.schemaVersion === SCHEMA_VERSION) {
    return sanitizeTheme(parsed.theme);
  }

  return sanitizeTheme(parsed);
}

export async function loadStoredColorTheme(): Promise<ColorTheme> {
  const json = await AsyncStorage.getItem(COLOR_THEME_STORAGE_KEY);
  if (!json) {
    return DEFAULT_COLOR_THEME;
  }

  try {
    return parseStoredTheme(json);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return DEFAULT_COLOR_THEME;
    }
    throw error;
  }
}

export async function saveStoredColorTheme(theme: ColorTheme): Promise<void> {
  const envelope: ColorThemeEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
    theme: sanitizeTheme(theme),
  };

  await AsyncStorage.setItem(COLOR_THEME_STORAGE_KEY, JSON.stringify(envelope));
}
