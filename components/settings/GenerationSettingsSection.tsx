import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { UseGenerationSettingsReturn } from '@/hooks/settings/useGenerationSettings';
import {
    GENERATION_PRESETS,
    type GenerationSettings,
} from '@/services/ai/generationSettings';
import {
    formatContextWindow,
    formatModelName,
} from '@/services/ai/modelContext';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { SettingsSection } from './SettingsSection';

interface SliderRowProps {
    label: string;
    description: string;
    value: number;
    min: number;
    max: number;
    step: number;
    formatDisplay: (value: number) => string;
    onChange: (value: number) => void;
}

type GenerationSettingsSectionProps = UseGenerationSettingsReturn & {
    readonly embedded?: boolean;
};

const SECONDARY_TEXT = 'text-text-secondary-light dark:text-text-secondary-dark';

function SliderRow({
    label,
    description,
    value,
    min,
    max,
    step,
    formatDisplay,
    onChange,
}: SliderRowProps) {
    const [liveValue, setLiveValue] = useState(value);

    useEffect(() => {
        setLiveValue(value);
    }, [value]);

    return (
        <View className="mb-5">
            <View className="mb-1 flex-row items-baseline justify-between gap-3">
                <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                    {label}
                </Text>
                {/* Tabular readout — instrument dial, not a floating hero number */}
                <Text
                    className="text-sm font-semibold tabular-nums tracking-wide text-text-light dark:text-text-dark"
                    style={{ fontVariant: ['tabular-nums'] }}
                >
                    {formatDisplay(liveValue)}
                </Text>
            </View>
            <Text className={`mb-3 text-xs ${SECONDARY_TEXT}`}>
                {description}
            </Text>
            <RangeSlider
                value={value}
                min={min}
                max={max}
                step={step}
                onSliding={setLiveValue}
                onChange={onChange}
                accessibilityLabel={label}
            />
        </View>
    );
}

function ContextReadout({ props }: { props: GenerationSettingsSectionProps }) {
    const { modelContext, contextError, isLoading, refreshContext } = props;
    const label = modelContext
        ? `${formatModelName(modelContext.model)} · ${formatContextWindow(modelContext.contextWindow)} ctx`
        : contextError ?? (isLoading ? 'Detecting model context...' : 'Context unavailable');

    return (
        <View className="mb-5 rounded-xl border border-divider-light dark:border-divider-dark p-3">
            <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                    <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                        Detected context window
                    </Text>
                    <Text className={`mt-1 text-xs ${SECONDARY_TEXT}`}>
                        {label}
                    </Text>
                </View>
                <Pressable
                    onPress={refreshContext}
                    className="rounded-full bg-background-light px-3 py-2 dark:bg-background-dark"
                    accessibilityRole="button"
                    accessibilityLabel="Refresh model context"
                >
                    <Text className="text-xs font-semibold text-text-light dark:text-text-dark">
                        Refresh
                    </Text>
                </Pressable>
            </View>
            {modelContext ? (
                <Text className="mt-2 self-start rounded-full bg-background-light px-2 py-1 text-[11px] font-semibold text-text-secondary-light dark:bg-background-dark dark:text-text-secondary-dark">
                    {modelContext.source}
                </Text>
            ) : null}
        </View>
    );
}

export function GenerationSettingsSection(props: GenerationSettingsSectionProps) {
    const { settings, update, reset, isLoading, embedded = false } = props;
    const apply = (partial: Partial<GenerationSettings>) => {
        void update(partial);
    };

    return (
        <SettingsSection title="Generation" embedded={embedded}>
            <ContextReadout props={props} />
            <Text className={`mb-3 text-xs ${SECONDARY_TEXT}`}>
                Defaults apply to journal chats. Active persona imagination can override temperature.
            </Text>
            <SliderRow
                label="Temperature"
                description="Lower is steadier; higher is more varied."
                value={settings.temperature}
                min={0}
                max={2}
                step={0.1}
                formatDisplay={(v) => v.toFixed(1)}
                onChange={(temperature) => apply({ temperature })}
            />
            <SliderRow
                label="Top-P"
                description="Narrows or widens the model's token sampling pool."
                value={settings.topP}
                min={0}
                max={1}
                step={0.05}
                formatDisplay={(v) => v.toFixed(2)}
                onChange={(topP) => apply({ topP })}
            />
            <View className="mb-5 flex-row flex-wrap gap-2">
                {GENERATION_PRESETS.map((preset) => (
                    <Pressable
                        key={preset.id}
                        onPress={() => apply({
                            temperature: preset.temperature,
                            topP: preset.topP,
                        })}
                        className="rounded-full border border-divider-light px-3 py-2 dark:border-divider-dark"
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${preset.label} generation preset`}
                    >
                        <Text className="text-xs font-semibold text-text-light dark:text-text-dark">
                            {preset.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
            <Pressable
                onPress={() => void reset()}
                disabled={isLoading}
                className={`rounded-xl bg-background-light px-4 py-3 dark:bg-background-dark ${
                    isLoading ? 'opacity-60' : ''
                }`}
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading }}
                accessibilityLabel="Reset generation settings"
            >
                <Text className="text-center text-sm font-semibold text-text-light dark:text-text-dark">
                    Reset to defaults
                </Text>
            </Pressable>
        </SettingsSection>
    );
}
