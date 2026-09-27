import { APP_VERSION } from '@/constants/appInfo';
import {
    COLOR_THEME_PRESETS,
    type ColorTheme,
} from '@/constants/theme';
import type {
    EmojiStylePreference,
    ThemePreference,
} from '@/hooks/useThemeSettings';
import {
    GENERATION_PRESETS,
    type GenerationSettings,
} from '@/services/ai/generationSettings';
import { getActiveProfile } from '@/services/ai/customModels';
import type { CustomAiProviderSettings } from '@/services/ai/customModels';

const THEME_LABELS: Record<ThemePreference, string> = {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
};

const EMOJI_LABELS: Record<EmojiStylePreference, string> = {
    native: 'Native',
    flat: 'Flat',
    '3d': '3D',
};

export function appearanceSummary(
    theme: ThemePreference,
    emojiStyle: EmojiStylePreference,
): string {
    return `${THEME_LABELS[theme]} · ${EMOJI_LABELS[emojiStyle]}`;
}

export function colorThemeSummary(colorTheme: ColorTheme): string {
    if (colorTheme.presetId === 'custom') {
        return 'Custom';
    }
    const preset = COLOR_THEME_PRESETS.find((item) => item.presetId === colorTheme.presetId);
    return preset?.name ?? 'Custom';
}

export function generationSummary(settings: GenerationSettings): string {
    const matched = GENERATION_PRESETS.find(
        (preset) =>
            preset.temperature === settings.temperature
            && preset.topP === settings.topP,
    );
    return matched?.label ?? 'Custom';
}

export function customAiSummary(settings: CustomAiProviderSettings): string {
    if (!settings.enabled) {
        return 'Off';
    }
    const profile = getActiveProfile(settings);
    if (!profile) {
        return 'Off';
    }
    const selected = profile.models.find((model) => model.id === profile.selectedModelId);
    const name = selected?.name ?? profile.selectedModelId;
    if (!name) {
        if (!profile.apiKey.trim()) return 'Key needed';
        return 'Choose model';
    }
    const leaf = name.includes('/') ? (name.split('/').pop() ?? name) : name;
    const short = leaf.length > 22 ? `${leaf.slice(0, 19)}…` : leaf;
    // With more than one saved provider, name the active one so the summary is
    // unambiguous without opening Settings.
    return settings.profiles.length > 1 ? `${profile.label} · ${short}` : short;
}

export function memorySummary(atomCount: number): string {
    if (atomCount === 0) {
        return 'No memories yet';
    }
    return `${atomCount} memor${atomCount === 1 ? 'y' : 'ies'}`;
}

/** Re-export view helper so Settings can summarize without importing services. */
export { identitySettingsSummary } from '@/services/memory/identityProfileView';

/** Local-only build: there is no account state to summarize. */
export function accountSummary(): string {
    return 'On this device';
}

export function aboutSummary(): string {
    return `v${APP_VERSION}`;
}

export function dataManagementSummary(hasBackup: boolean): string {
    return hasBackup ? 'Backup · Export' : 'Export · Backup';
}
