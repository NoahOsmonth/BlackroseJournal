import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    GestureResponderEvent,
    LayoutChangeEvent,
    Modal,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

import {
    QUICK_PICK_COLORS,
    getColorThemeSlotPartner,
    isColorThemeLightSlot,
    normalizeHexColor,
    type ColorThemeSlot,
} from '@/constants/theme';
import {
    derivePartnerHex,
    hexToHsl,
    hslToHex,
    softenNeutralPartner,
} from '@/services/theme/colorDerivation';

interface ColorPickerModalProps {
    /**
     * The slot the user is editing (e.g. 'accentLight'). The picker uses this
     * to decide which mode (light/dark) the source value belongs to, and to
     * label the modal so the user knows what they're changing.
     */
    readonly slot: ColorThemeSlot | null;
    /** The slot's current hex value. */
    readonly value: string;
    /** The partner slot's current hex value (used to seed the "sync" preview). */
    readonly partnerValue: string;
    /** Called when the user confirms a new color. */
    readonly onConfirm: (next: {
        readonly slot: ColorThemeSlot;
        readonly value: string;
        readonly partnerValue: string;
        readonly syncPartner: boolean;
    }) => void;
    readonly onClose: () => void;
}

const HUE_RAMP_COLORS = [
    '#FF0000', '#FF9F00', '#FFFF00', '#00FF00',
    '#00FFFF', '#0000FF', '#8B00FF', '#FF00FF', '#FF0000',
];

const TONE_RAMP_COLORS = [
    '#000000', '#404040', '#808080', '#BFBFBF',
    '#FFFFFF',
];

/**
 * Build a tone ramp (saturation × lightness) that starts and ends at the
 * given hue. Used to render the horizontal "tone" gradient inside the picker.
 */
function buildToneRamp(hue: number): readonly string[] {
    const samples: string[] = [];
    for (let i = 0; i <= 6; i += 1) {
        const lightness = Math.round(8 + (i / 6) * 84);
        samples.push(hslToHex({ h: hue, s: 90, l: lightness }));
    }
    return samples;
}

/**
 * Horizontal slider built on the responder system. We avoid pulling in a
 * third-party slider library because the rest of the app uses platform
 * primitives and the project deliberately keeps deps minimal.
 *
 * The outer View both claims the touch responder and measures the width, so
 * `locationX` is always relative to the element the ratio is computed
 * against. The track segments are `pointerEvents="none"` — if they could be
 * touch targets, `locationX` would arrive relative to the tapped segment and
 * the thumb would jump to the wrong color.
 */
function ColorSlider({
    ariaLabel,
    trackColors,
    thumbColor = '#FFFFFF',
    valueRatio,
    onChange,
}: {
    readonly ariaLabel: string;
    readonly trackColors: readonly string[];
    readonly thumbColor?: string;
    readonly valueRatio: number;
    readonly onChange: (ratio: number) => void;
}) {
    const [width, setWidth] = useState(0);
    const handleLayout = (event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
    };
    const handleTouch = (event: GestureResponderEvent) => {
        if (width <= 0) {
            return;
        }
        const raw = event.nativeEvent.locationX / width;
        onChange(Math.max(0, Math.min(1, raw)));
    };
    const thumbLeft = Math.max(0, Math.min(width, valueRatio * width)) - 9;

    return (
        <View
            accessibilityLabel={ariaLabel}
            accessibilityRole="adjustable"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(valueRatio * 100) }}
            onLayout={handleLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleTouch}
            onResponderMove={handleTouch}
            className="h-10 justify-center"
        >
            <View
                pointerEvents="none"
                className="h-3 w-full rounded-full overflow-hidden flex-row"
            >
                {trackColors.map((color, index) => (
                    <View
                        key={`${color}-${index}`}
                        className="flex-1"
                        style={{ backgroundColor: color }}
                    />
                ))}
            </View>
            <View
                pointerEvents="none"
                className="absolute h-5 w-5 rounded-full border-2 border-white"
                style={{
                    left: thumbLeft,
                    backgroundColor: thumbColor,
                    shadowColor: '#000000',
                    shadowOpacity: 0.25,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 3,
                }}
            />
        </View>
    );
}

const SLOT_LABELS: Record<ColorThemeSlot, string> = {
    accentLight: 'Accent · Light',
    accentDark: 'Accent · Dark',
    appTextLight: 'App font · Light',
    appTextDark: 'App font · Dark',
    secondaryTextLight: 'Muted font · Light',
    secondaryTextDark: 'Muted font · Dark',
    chatUserTextLight: 'Chat — you · Light',
    chatUserTextDark: 'Chat — you · Dark',
    chatAiTextLight: 'Chat — Rosebud · Light',
    chatAiTextDark: 'Chat — Rosebud · Dark',
};

export function ColorPickerModal({
    slot,
    value,
    partnerValue,
    onConfirm,
    onClose,
}: ColorPickerModalProps) {
    const isOpen = slot !== null;
    const editingLight = slot ? isColorThemeLightSlot(slot) : true;
    const partnerSlot = slot ? getColorThemeSlotPartner(slot) : null;
    const [draftHex, setDraftHex] = useState(value);
    const [syncPartner, setSyncPartner] = useState(true);
    const [manualPartnerHex, setManualPartnerHex] = useState(partnerValue);

    // Re-seed the draft when the modal is opened for a new slot.
    useEffect(() => {
        if (slot) {
            setDraftHex(value);
            setManualPartnerHex(partnerValue);
            setSyncPartner(true);
        }
    }, [slot, value, partnerValue]);

    const normalizedDraft = normalizeHexColor(draftHex);
    const liveHsl = useMemo(() => (normalizedDraft ? hexToHsl(normalizedDraft) : null), [normalizedDraft]);
    const liveToneRamp = useMemo(
        () => (liveHsl ? buildToneRamp(liveHsl.h) : TONE_RAMP_COLORS),
        [liveHsl]
    );
    const derivedPartner = useMemo(() => {
        if (!normalizedDraft) {
            return partnerValue;
        }
        const raw = derivePartnerHex(normalizedDraft, editingLight);
        if (!raw) {
            return partnerValue;
        }
        return softenNeutralPartner(normalizedDraft, raw);
    }, [normalizedDraft, editingLight, partnerValue]);

    const previewPartner = syncPartner ? derivedPartner : manualPartnerHex;
    const previewSourceIsValid = normalizedDraft !== null;
    const canConfirm = previewSourceIsValid;

    const handleHueChange = (ratio: number) => {
        if (!liveHsl) {
            return;
        }
        const nextHue = Math.round(ratio * 360);
        const nextHex = hslToHex({ h: nextHue, s: liveHsl.s, l: liveHsl.l });
        setDraftHex(nextHex);
    };

    const handleToneChange = (ratio: number) => {
        if (!liveHsl) {
            return;
        }
        const nextLightness = Math.round(8 + ratio * 84);
        const nextHex = hslToHex({ h: liveHsl.h, s: liveHsl.s, l: nextLightness });
        setDraftHex(nextHex);
    };

    const handleQuickPick = (hex: string) => {
        setDraftHex(hex);
    };

    const handleConfirm = () => {
        if (!slot || !previewSourceIsValid || !partnerSlot) {
            return;
        }
        onConfirm({
            slot,
            value: normalizedDraft,
            partnerValue: previewPartner,
            syncPartner,
        });
    };

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-end">
                <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Dismiss color picker" />
                <View
                    className="bg-surface-light dark:bg-surface-dark rounded-t-3xl pt-3 pb-8"
                    style={{ maxHeight: '92%' }}
                >
                    <View className="items-center mb-3">
                        <View className="w-10 h-1 bg-divider-light dark:bg-divider-dark rounded-full" />
                    </View>

                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                    >
                        <Text className="text-[17px] font-semibold text-text-light dark:text-text-dark text-center mb-1">
                            {slot ? SLOT_LABELS[slot] : 'Color'}
                        </Text>
                        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark text-center mb-5">
                            Pick a color — the {editingLight ? 'dark' : 'light'} partner auto-updates.
                        </Text>

                        {/* Big swatch + partner preview — no overlapping, two distinct cards */}
                        <View className="flex-row gap-3 mb-5">
                            <View className="flex-1 gap-2">
                                <Text className="text-[11px] font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark text-center">
                                    {editingLight ? 'Light' : 'Dark'} · you
                                </Text>
                                <View
                                    className="h-24 rounded-2xl border border-divider-light dark:border-divider-dark"
                                    style={{ backgroundColor: previewSourceIsValid ? normalizedDraft : '#000000' }}
                                />
                                <Text className="text-xs font-mono text-center text-text-secondary-light dark:text-text-secondary-dark">
                                    {previewSourceIsValid ? normalizedDraft : draftHex}
                                </Text>
                            </View>
                            <View className="flex-1 gap-2">
                                <Text className="text-[11px] font-bold uppercase text-text-secondary-light dark:text-text-secondary-dark text-center">
                                    {editingLight ? 'Dark' : 'Light'} · auto
                                </Text>
                                <View
                                    className="h-24 rounded-2xl border border-divider-light dark:border-divider-dark"
                                    style={{ backgroundColor: previewPartner }}
                                />
                                <Text className="text-xs font-mono text-center text-text-secondary-light dark:text-text-secondary-dark">
                                    {previewPartner}
                                </Text>
                            </View>
                        </View>

                        {/* Sliders */}
                        <View className="gap-5 mb-5">
                            <View className="gap-2">
                                <View className="flex-row justify-between">
                                    <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase">
                                        Hue
                                    </Text>
                                    <Text className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark">
                                        {liveHsl ? `${Math.round(liveHsl.h)}°` : '—'}
                                    </Text>
                                </View>
                                <ColorSlider
                                    ariaLabel="Hue"
                                    trackColors={HUE_RAMP_COLORS}
                                    thumbColor={liveHsl ? hslToHex({ h: liveHsl.h, s: 90, l: 50 }) : '#FFFFFF'}
                                    valueRatio={(liveHsl?.h ?? 0) / 360}
                                    onChange={handleHueChange}
                                />
                            </View>
                            <View className="gap-2">
                                <View className="flex-row justify-between">
                                    <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase">
                                        Tone
                                    </Text>
                                    <Text className="text-xs font-mono text-text-secondary-light dark:text-text-secondary-dark">
                                        {liveHsl ? `${liveHsl.l}%` : '—'}
                                    </Text>
                                </View>
                                <ColorSlider
                                    ariaLabel="Tone"
                                    trackColors={liveToneRamp}
                                    thumbColor={previewSourceIsValid ? normalizedDraft : '#FFFFFF'}
                                    valueRatio={((liveHsl?.l ?? 50) - 8) / 84}
                                    onChange={handleToneChange}
                                />
                            </View>
                        </View>

                        {/* Hex input */}
                        <View className="mb-5">
                            <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase mb-2">
                                Hex
                            </Text>
                            <TextInput
                                value={draftHex}
                                onChangeText={setDraftHex}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={7}
                                accessibilityLabel="Hex value"
                                placeholder="#000000"
                                className={[
                                    'rounded-xl border px-3 py-3 text-base font-mono font-semibold',
                                    'text-text-light dark:text-text-dark',
                                    previewSourceIsValid || draftHex.trim().length === 0
                                        ? 'border-divider-light dark:border-divider-dark'
                                        : 'border-red-500 dark:border-red-400',
                                ].join(' ')}
                            />
                        </View>

                        {/* Quick pick grid */}
                        <View className="mb-5">
                            <Text className="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase mb-2">
                                Quick colors
                            </Text>
                            <View className="flex-row flex-wrap gap-2">
                                {QUICK_PICK_COLORS.map((color) => {
                                    const isActive = normalizeHexColor(color) === normalizedDraft;
                                    return (
                                        <Pressable
                                            key={color}
                                            onPress={() => handleQuickPick(color)}
                                            accessibilityLabel={`Pick ${color}`}
                                            className={[
                                                'h-10 w-10 rounded-full border-2 items-center justify-center',
                                                isActive
                                                    ? 'border-primary'
                                                    : 'border-divider-light dark:border-divider-dark',
                                            ].join(' ')}
                                            style={{ backgroundColor: color }}
                                        >
                                            {isActive ? (
                                                <MaterialIcons
                                                    name="check"
                                                    size={18}
                                                    color={normalizeHexColor(color) === '#FFFFFF'
                                                        ? '#000000'
                                                        : '#FFFFFF'}
                                                />
                                            ) : null}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Sync partner toggle */}
                        <View
                            className="flex-row items-center justify-between rounded-xl border border-divider-light dark:border-divider-dark px-3 py-3 mb-5"
                        >
                            <View className="flex-1 pr-3">
                                <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                                    Sync {editingLight ? 'dark' : 'light'} partner
                                </Text>
                                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
                                    {syncPartner
                                        ? `We'll auto-derive ${editingLight ? 'dark' : 'light'} from this color.`
                                        : `Keep the current ${editingLight ? 'dark' : 'light'} value as-is.`}
                                </Text>
                            </View>
                            <Switch
                                value={syncPartner}
                                onValueChange={setSyncPartner}
                                accessibilityLabel="Sync partner color"
                            />
                        </View>
                    </ScrollView>

                    {/* Action row — fixed at the bottom of the sheet, no overlap */}
                    <View className="flex-row gap-3 px-5 pt-2">
                        <Pressable
                            onPress={onClose}
                            accessibilityLabel="Cancel color change"
                            className="flex-1 items-center justify-center py-3 rounded-xl bg-background-light dark:bg-background-dark"
                        >
                            <Text className="text-base font-semibold text-text-light dark:text-text-dark">
                                Cancel
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={handleConfirm}
                            disabled={!canConfirm}
                            accessibilityLabel="Apply color"
                            className={[
                                'flex-1 items-center justify-center py-3 rounded-xl',
                                canConfirm
                                    ? 'bg-primary dark:bg-primary-dark'
                                    : 'bg-primary/40 dark:bg-primary-dark/40',
                            ].join(' ')}
                        >
                            <Text
                                className={[
                                    'text-base font-semibold',
                                    canConfirm
                                        ? 'text-white'
                                        : 'text-white/80',
                                ].join(' ')}
                            >
                                Use color
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
