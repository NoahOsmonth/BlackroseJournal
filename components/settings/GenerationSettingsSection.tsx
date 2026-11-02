import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { UseGenerationSettingsReturn } from '@/hooks/settings/useGenerationSettings';
import {
    GENERATION_PRESETS,
    type GenerationSettings,
} from '@/services/ai/generationSettings';
import {
    formatContextSource,
    formatMemoryWindow,
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
                <Text className="text-[16px] text-text-light dark:text-text-dark">
                    {label}
                </Text>
                {/* Tabular readout — instrument dial, not a floating hero number */}
                <Text
                    className="text-[16px] tabular-nums tracking-wide text-text-light dark:text-text-dark"
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
        ? `${formatModelName(modelContext.model)} · ${formatMemoryWindow(modelContext.contextWindow)}`
        : contextError ?? (isLoading ? 'Checking how much the AI can remember...' : 'Memory size unknown');

    return (
        <View className="mb-5 rounded-control border border-hairline-light p-3.5 dark:border-hairline-dark">
            <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                    <Text className="text-[16px] text-text-light dark:text-text-dark">
                        How much the AI remembers
                    </Text>
                    <Text className={`mt-1 text-xs ${SECONDARY_TEXT}`}>
                        {label}
                    </Text>
                </View>
                <Pressable
                    onPress={refreshContext}
                    className="rounded-full bg-background-light px-3 py-2 dark:bg-background-dark"
                    accessibilityRole="button"
                    accessibilityLabel="Check memory size again"
                >
                    <Text className="text-[15px] text-text-light dark:text-text-dark">
                        Refresh
                    </Text>
                </Pressable>
            </View>
            {modelContext ? (
                <Text className="mt-2 self-start text-[12px] text-text-secondary-light dark:text-text-secondary-dark">
                    {formatContextSource(modelContext.source)}
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
        <SettingsSection title="Writing style" embedded={embedded}>
            <ContextReadout props={props} />
            <Text className={`mb-3 text-xs ${SECONDARY_TEXT}`}>
                {"These defaults apply to journal chats. A persona's imagination can override them."}
            </Text>
            <SliderRow
                label="Creativity"
                description="Lower is steadier; higher is more varied."
                value={settings.temperature}
                min={0}
                max={2}
                step={0.1}
                formatDisplay={(v) => v.toFixed(1)}
                onChange={(temperature) => apply({ temperature })}
            />
            <SliderRow
                label="Variety"
                description="How wide a range of words the AI chooses from."
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
                        className="rounded-full border border-hairline-light px-3.5 py-2 dark:border-hairline-dark"
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${preset.label} writing style`}
                    >
                        <Text className="text-[15px] text-text-light dark:text-text-dark">
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
                accessibilityLabel="Reset writing style settings"
            >
                <Text className="text-center text-[15px] text-text-light dark:text-text-dark">
                    Reset to defaults
                </Text>
            </Pressable>
        </SettingsSection>
    );
}
