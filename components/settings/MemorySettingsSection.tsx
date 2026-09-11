import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import { SettingsSection } from './SettingsSection';

interface MemorySettingsSectionProps {
    readonly atoms: LocalMemoryAtom[];
    readonly isBusy: boolean;
    readonly onOpenMemoryHub: () => void;
    readonly embedded?: boolean;
}

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

function findProfilePreview(atoms: readonly LocalMemoryAtom[]): string {
    const profile = atoms.find((atom) => atom.layer === 'profile');
    return profile?.content ?? 'Blackrose has not saved an about-me memory yet.';
}

function countLayer(atoms: readonly LocalMemoryAtom[], layer: LocalMemoryAtom['layer']): number {
    return atoms.filter((atom) => atom.layer === layer).length;
}

/** One metric cell, numeral in the serif — mirrors the Threads foot strip. */
function MemoryMetric({ label, value, isFirst }: {
    readonly label: string;
    readonly value: number;
    readonly isFirst: boolean;
}) {
    return (
        <View
            className={`flex-1 items-center ${isFirst ? '' : `border-l ${HAIRLINE}`}`}
        >
            <Text
                className="text-[26px] leading-8 text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                {value}
            </Text>
            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                {label}
            </Text>
        </View>
    );
}

export function MemorySettingsSection({
    atoms,
    isBusy,
    onOpenMemoryHub,
    embedded = false,
}: MemorySettingsSectionProps) {
    const isDark = useColorScheme() === 'dark';
    const chevronColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <SettingsSection title="Memory" embedded={embedded}>
            <View className={`flex-row items-center rounded-card border py-4 ${HAIRLINE}`}>
                <MemoryMetric label="Total" value={atoms.length} isFirst />
                <MemoryMetric label="About you" value={countLayer(atoms, 'profile')} isFirst={false} />
                <MemoryMetric label="Notes" value={countLayer(atoms, 'note')} isFirst={false} />
            </View>

            <View className="mt-5">
                <Text className="text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                    About you
                </Text>
                <Text className="mt-2 text-[16px] leading-7 text-text-light dark:text-text-dark">
                    {findProfilePreview(atoms)}
                </Text>
            </View>

            <Pressable
                onPress={onOpenMemoryHub}
                disabled={isBusy}
                className={`mt-5 min-h-12 flex-row items-center justify-between rounded-control border px-4 ${HAIRLINE} ${
                    isBusy ? 'opacity-50' : ''
                }`}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy }}
                accessibilityLabel="Open Memory hub"
            >
                <Text className="text-[15px] text-text-light dark:text-text-dark">
                    Open memory hub
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={chevronColor} />
            </Pressable>
        </SettingsSection>
    );
}
