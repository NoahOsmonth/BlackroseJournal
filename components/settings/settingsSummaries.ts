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
    const selected = settings.models.find((model) => model.id === settings.selectedModelId);
    const name = selected?.name ?? settings.selectedModelId;
    if (!name) {
        if (!settings.apiKey.trim()) return 'Key needed';
        return 'Choose model';
    }
    const leaf = name.includes('/') ? (name.split('/').pop() ?? name) : name;
    const short = leaf.length > 22 ? `${leaf.slice(0, 19)}…` : leaf;
    return settings.freeOnly ? `Free · ${short}` : short;
}

export function memorySummary(atomCount: number): string {
    if (atomCount === 0) {
        return 'No memories yet';
    }
    return `${atomCount} memor${atomCount === 1 ? 'y' : 'ies'}`;
}

/** Re-export view helper so Settings can summarize without importing services. */
export { identitySettingsSummary } from '@/services/memory/identityProfileView';

export function accountSummary(email: string | null): string {
    if (!email) {
        return 'Signed out';
    }
    if (email.length <= 28) {
        return email;
    }
    const [local, domain] = email.split('@');
    if (!domain) {
        return `${email.slice(0, 25)}…`;
    }
    const shortLocal = local.length > 10 ? `${local.slice(0, 8)}…` : local;
    return `${shortLocal}@${domain}`;
}

export function aboutSummary(): string {
    return `v${APP_VERSION}`;
}

export function dataManagementSummary(hasBackup: boolean): string {
    return hasBackup ? 'Backup · Export' : 'Export · Backup';
}
