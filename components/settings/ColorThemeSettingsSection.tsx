import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
    COLOR_THEME_PRESETS,
    getColorThemeSlotPartner,
    normalizeHexColor,
    type ColorTheme,
    type ColorThemePresetId,
    type ColorThemeSlot,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { derivePartnerHex, softenNeutralPartner } from '@/services/theme/colorDerivation';
import { ColorPickerModal } from './ColorPickerModal';
import { SettingsSection } from './SettingsSection';

interface ColorThemeSettingsSectionProps {
    readonly colorTheme: ColorTheme;
    readonly onPresetChange: (presetId: ColorThemePresetId) => void;
    readonly onPickerConfirm: (edit: {
        readonly slot: ColorThemeSlot;
        readonly value: string;
        readonly partnerSlot: ColorThemeSlot;
        readonly partnerValue: string;
        readonly syncPartner: boolean;
    }) => Promise<boolean>;
    readonly onReset: () => void;
}

interface ColorFieldPair {
    readonly label: string;
    readonly lightSlot: ColorThemeSlot;
    readonly darkSlot: ColorThemeSlot;
}

const COLOR_ROWS: readonly ColorFieldPair[] = [
    { label: 'Accent', lightSlot: 'accentLight', darkSlot: 'accentDark' },
    { label: 'App font', lightSlot: 'appTextLight', darkSlot: 'appTextDark' },
    { label: 'Muted font', lightSlot: 'secondaryTextLight', darkSlot: 'secondaryTextDark' },
    { label: 'Chat — you', lightSlot: 'chatUserTextLight', darkSlot: 'chatUserTextDark' },
    { label: 'Chat — Rosebud', lightSlot: 'chatAiTextLight', darkSlot: 'chatAiTextDark' },
    { label: 'Background', lightSlot: 'appBackgroundLight', darkSlot: 'appBackgroundDark' },
];

/**
 * Heuristic: a partner slot is "in sync" with its source if applying the
 * auto-derive rule to the source reproduces the current partner value.
 * Used purely to render a subtle "auto" badge in the main settings view —
 * no state is persisted; it always recomputes from the live colors.
 */
function isPartnerInSync(sourceHex: string, partnerHex: string, sourceIsLight: boolean): boolean {
    const normalizedSource = normalizeHexColor(sourceHex);
    const normalizedPartner = normalizeHexColor(partnerHex);
    if (!normalizedSource || !normalizedPartner) {
        return false;
    }
    const derived = derivePartnerHex(normalizedSource, sourceIsLight);
    if (!derived) {
        return false;
    }
    const softened = softenNeutralPartner(normalizedSource, derived);
    return softened === normalizedPartner;
}

export function ColorThemeSettingsSection({
    colorTheme,
    onPresetChange,
    onPickerConfirm,
    onReset,
}: ColorThemeSettingsSectionProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const textColor = isDark ? colorTheme.colors.appTextDark : colorTheme.colors.appTextLight;
    const secondaryColor = isDark
        ? colorTheme.colors.secondaryTextDark
        : colorTheme.colors.secondaryTextLight;

    // The picker is single-instance: we open it for one slot at a time.
    const [pickerSlot, setPickerSlot] = useState<ColorThemeSlot | null>(null);

    const openPicker = useCallback((slot: ColorThemeSlot) => {
        setPickerSlot(slot);
    }, []);
    const closePicker = useCallback(() => {
        setPickerSlot(null);
    }, []);

    const pickerSourceValue = pickerSlot ? colorTheme.colors[pickerSlot] : '';
    const pickerPartnerSlot = pickerSlot ? getColorThemeSlotPartner(pickerSlot) : null;
    const pickerPartnerValue = pickerPartnerSlot ? colorTheme.colors[pickerPartnerSlot] : '';

    const renderSwatchPair = (row: ColorFieldPair) => {
        const lightHex = colorTheme.colors[row.lightSlot];
        const darkHex = colorTheme.colors[row.darkSlot];
        const lightInSync = isPartnerInSync(lightHex, darkHex, true);
        const darkInSync = isPartnerInSync(darkHex, lightHex, false);

        const renderSwatch = (slot: ColorThemeSlot, label: 'Light' | 'Dark', inSync: boolean) => {
            const hex = colorTheme.colors[slot];
            return (
                <Pressable
                    key={slot}
                    onPress={() => openPicker(slot)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${row.label} ${label} color`}
                    className="flex-1 gap-1.5"
                >
                    <Text
                        className="text-[10px] font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark text-center"
                        style={{ color: secondaryColor }}
                    >
                        {label}
                    </Text>
                    <View className="relative">
                        <View
                            className="h-16 w-full rounded-xl border border-divider-light dark:border-divider-dark"
                            style={{ backgroundColor: hex }}
                        />
                        {inSync ? (
                            <View
                                pointerEvents="none"
                                className="absolute top-1.5 right-1.5 flex-row items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5"
                            >
                                <MaterialIcons name="auto-awesome" size={9} color="#FFFFFF" />
                                <Text className="text-[8px] font-bold text-white uppercase tracking-wider">
                                    auto
                                </Text>
                            </View>
                        ) : null}
                        <View
                            pointerEvents="none"
                            className="absolute bottom-1.5 right-1.5 flex-row items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5"
                        >
                            <MaterialIcons name="edit" size={10} color="#FFFFFF" />
                        </View>
                    </View>
                    <Text
                        className="text-[11px] font-mono font-semibold text-center text-text-secondary-light dark:text-text-secondary-dark"
                        numberOfLines={1}
                        style={{ color: secondaryColor }}
                    >
                        {hex}
                    </Text>
                </Pressable>
            );
        };

        return (
            <View key={row.label} className="gap-2">
                <Text
                    className="text-sm font-bold text-text-light dark:text-text-dark"
                    style={{ color: textColor }}
                >
                    {row.label}
                </Text>
                <View className="flex-row gap-3">
                    {renderSwatch(row.lightSlot, 'Light', lightInSync)}
                    {renderSwatch(row.darkSlot, 'Dark', darkInSync)}
                </View>
            </View>
        );
    };

    return (
        <SettingsSection title="Color Studio">
            {/* Palette grid: 2 columns × 4 rows. Tighter wrap so 8 presets fit
                without scrolling horizontally. */}
            <View className="flex-row flex-wrap gap-2">
                {COLOR_THEME_PRESETS.map((preset) => {
                    const isActive = colorTheme.presetId === preset.presetId;
                    return (
                        <Pressable
                            key={preset.presetId}
                            onPress={() => onPresetChange(preset.presetId)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isActive }}
                            accessibilityLabel={`Select ${preset.name} colors`}
                            className={[
                                'min-w-[48%] flex-1 rounded-xl border p-2.5 gap-2',
                                isActive
                                    ? 'border-primary bg-primary/10 dark:border-primary-dark dark:bg-primary-dark/10'
                                    : 'border-divider-light dark:border-divider-dark',
                            ].join(' ')}
                        >
                            <View className="flex-row gap-1">
                                <View
                                    className="h-4 flex-1 rounded-full"
                                    style={{ backgroundColor: preset.colors.accentLight }}
                                />
                                <View
                                    className="h-4 flex-1 rounded-full"
                                    style={{ backgroundColor: preset.colors.appTextLight }}
                                />
                                <View
                                    className="h-4 flex-1 rounded-full"
                                    style={{ backgroundColor: preset.colors.chatUserTextLight }}
                                />
                                <View
                                    className="h-4 flex-1 rounded-full"
                                    style={{ backgroundColor: preset.colors.chatAiTextLight }}
                                />
                            </View>
                            <Text
                                className="text-xs font-bold text-text-light dark:text-text-dark text-center"
                                style={{ color: textColor }}
                            >
                                {preset.name}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {/* Journal preview card — kept compact and self-contained */}
            <View
                className="mt-4 rounded-xl border border-divider-light dark:border-divider-dark p-3 gap-2 bg-background-light dark:bg-background-dark"
            >
                <View className="flex-row items-center justify-between">
                    <Text
                        className="text-sm font-bold text-text-light dark:text-text-dark"
                        style={{ color: textColor }}
                    >
                        Journal preview
                    </Text>
                    <Pressable
                        onPress={onReset}
                        accessibilityRole="button"
                        accessibilityLabel="Reset color theme"
                        className="h-8 w-8 items-center justify-center rounded-full bg-surface-light dark:bg-surface-dark"
                    >
                        <MaterialIcons name="refresh" size={16} color={secondaryColor} />
                    </Pressable>
                </View>
                <Text
                    className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark"
                    style={{ color: secondaryColor }}
                >
                    A calmer entry with the colors you chose.
                </Text>
                <View className="gap-1">
                    <Text
                        className="text-[13px] font-bold"
                        style={{ color: isDark ? colorTheme.colors.chatUserTextDark : colorTheme.colors.chatUserTextLight }}
                    >
                        I want the chat to feel like mine.
                    </Text>
                    <Text
                        className="text-[13px] font-semibold"
                        style={{ color: isDark ? colorTheme.colors.chatAiTextDark : colorTheme.colors.chatAiTextLight }}
                    >
                        Rosebud can match that tone.
                    </Text>
                </View>
            </View>

            {/* Swatch rows — each row is a labeled group with two large tappable
                swatches. Tapping opens the picker modal which auto-derives the
                partner variant. The "auto" badge indicates the partner is the
                auto-derived value. */}
            <View className="mt-4 gap-4">
                {COLOR_ROWS.map(renderSwatchPair)}
            </View>

            <ColorPickerModal
                slot={pickerSlot}
                value={pickerSourceValue}
                partnerValue={pickerPartnerValue}
                onConfirm={async (next) => {
                    if (!pickerPartnerSlot) {
                        return;
                    }
                    await onPickerConfirm({
                        slot: next.slot,
                        value: next.value,
                        partnerSlot: pickerPartnerSlot,
                        partnerValue: next.partnerValue,
                        syncPartner: next.syncPartner,
                    });
                    closePicker();
                }}
                onClose={closePicker}
            />
        </SettingsSection>
    );
}
