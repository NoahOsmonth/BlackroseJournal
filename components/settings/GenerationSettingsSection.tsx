import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';

import type { UseGenerationSettingsReturn } from '@/hooks/settings/useGenerationSettings';
import {
    GENERATION_PRESETS,
    GenerationSettings,
} from '@/services/ai/generationSettings';
import {
    formatContextWindow,
    formatModelName,
} from '@/services/ai/modelContext';
import { SettingsSection } from './SettingsSection';

interface SliderRowProps {
    label: string;
    description: string;
    value: number;
    min: number;
    max: number;
    step: number;
    displayValue: string;
    onChange: (value: number) => void;
}

type GenerationSettingsSectionProps = UseGenerationSettingsReturn;

const SECONDARY_TEXT = 'text-text-secondary-light dark:text-text-secondary-dark';

function roundToStep(value: number, step: number): number {
    return Math.round(value / step) * step;
}

function SliderRow({
    label,
    description,
    value,
    min,
    max,
    step,
    displayValue,
    onChange,
}: SliderRowProps) {
    const [width, setWidth] = useState(0);
    const percent = ((value - min) / (max - min)) * 100;
    const handleLayout = (event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
    };
    const handleMove = useCallback((locationX: number) => {
        if (!width) return;
        const ratio = Math.min(Math.max(locationX / width, 0), 1);
        onChange(roundToStep(min + ratio * (max - min), step));
    }, [max, min, onChange, step, width]);

    return (
        <View className="mb-5">
            <View className="flex-row items-center justify-between mb-1">
                <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                    {label}
                </Text>
                <Text className={`text-sm font-semibold ${SECONDARY_TEXT}`}>
                    {displayValue}
                </Text>
            </View>
            <Text className={`text-xs mb-3 ${SECONDARY_TEXT}`}>
                {description}
            </Text>
            <View
                className="relative h-7 justify-center"
                onLayout={handleLayout}
                onStartShouldSetResponder={() => true}
                onResponderGrant={(event) => handleMove(event.nativeEvent.locationX)}
                onResponderMove={(event) => handleMove(event.nativeEvent.locationX)}
                accessibilityRole="adjustable"
                accessibilityLabel={label}
            >
                <View className="h-[5px] rounded-full bg-divider-light dark:bg-divider-dark">
                    <View
                        className="h-[5px] rounded-full bg-primary"
                        style={{ width: `${percent}%` }}
                    />
                </View>
                <View
                    className="absolute top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full border-2 border-surface-light bg-primary dark:border-surface-dark"
                    style={{ left: `${percent}%`, marginLeft: -11 }}
                />
            </View>
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
    const { settings, update, reset, isLoading } = props;
    const apply = (partial: Partial<GenerationSettings>) => {
        void update(partial);
    };

    return (
        <SettingsSection title="Generation">
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
                displayValue={settings.temperature.toFixed(1)}
                onChange={(temperature) => apply({ temperature })}
            />
            <SliderRow
                label="Top-P"
                description="Narrows or widens the model's token sampling pool."
                value={settings.topP}
                min={0}
                max={1}
                step={0.05}
                displayValue={settings.topP.toFixed(2)}
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
