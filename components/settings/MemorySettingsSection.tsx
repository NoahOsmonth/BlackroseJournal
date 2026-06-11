import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import type { LocalMemoryAtom } from '@/services/memory/localMemory.types';
import { SettingsSection } from './SettingsSection';

interface MemorySettingsSectionProps {
    readonly atoms: LocalMemoryAtom[];
    readonly isBusy: boolean;
    readonly onOpenMemoryHub: () => void;
}

const SECONDARY_TEXT_CLASS = 'text-subtext-light dark:text-subtext-dark';

function findProfilePreview(atoms: readonly LocalMemoryAtom[]): string {
    const profile = atoms.find((atom) => atom.layer === 'profile');
    return profile?.content ?? 'Rosebud has not saved about-me memory yet.';
}

function countLayer(atoms: readonly LocalMemoryAtom[], layer: LocalMemoryAtom['layer']): number {
    return atoms.filter((atom) => atom.layer === layer).length;
}

function MemoryMetric({ label, value }: { readonly label: string; readonly value: number }) {
    return (
        <View className="flex-1">
            <Text className="text-lg font-bold text-text-light dark:text-text-dark">
                {value}
            </Text>
            <Text className={`text-xs ${SECONDARY_TEXT_CLASS}`}>
                {label}
            </Text>
        </View>
    );
}

export function MemorySettingsSection({
    atoms,
    isBusy,
    onOpenMemoryHub,
}: MemorySettingsSectionProps) {
    const buttonIconColor = Colors.light.text;

    return (
        <SettingsSection title="Memory">
            <View className="mb-4 flex-row">
                <MemoryMetric label="Total" value={atoms.length} />
                <MemoryMetric label="About user" value={countLayer(atoms, 'profile')} />
                <MemoryMetric label="Notes" value={countLayer(atoms, 'note')} />
            </View>

            <View className="mb-4">
                <Text className={`mb-2 text-xs font-bold uppercase ${SECONDARY_TEXT_CLASS}`}>
                    About user
                </Text>
                <Text className="text-sm leading-relaxed text-text-light dark:text-text-dark">
                    {findProfilePreview(atoms)}
                </Text>
            </View>

            <TouchableOpacity
                onPress={onOpenMemoryHub}
                disabled={isBusy}
                className={[
                    'flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3',
                    isBusy ? 'opacity-50' : '',
                ].join(' ')}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy }}
                accessibilityLabel="Open Memory hub"
            >
                <Ionicons name="sparkles-outline" size={18} color={buttonIconColor} />
                <Text className="font-bold text-text-light dark:text-text-light">
                    Open Memory
                </Text>
                <Ionicons name="chevron-forward" size={18} color={buttonIconColor} />
            </TouchableOpacity>
        </SettingsSection>
    );
}
