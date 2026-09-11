/**
 * Settings → Identity: confirmed fields + pendingCandidate Confirm/Dismiss.
 * Only overwrite path for confirmed identity is confirmIdentityPendingField.
 */

import React, { useCallback } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import type { IdentityScalarField } from '@/services/memory/identityProfile.types';
import type {
    IdentityCollectionRow,
    IdentityScalarRow,
} from '@/services/memory/identityProfileView';
import { SettingsSection } from './SettingsSection';

const SECONDARY = 'text-text-secondary-light dark:text-text-secondary-dark';
const BODY = 'text-text-light dark:text-text-dark';
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';
const ACTION = `min-h-11 flex-1 items-center justify-center rounded-control border ${HAIRLINE}`;

export interface IdentitySettingsSectionProps {
    readonly scalarRows: readonly IdentityScalarRow[];
    readonly pendingRows: readonly IdentityScalarRow[];
    readonly collectionRows: readonly IdentityCollectionRow[];
    readonly isBusy?: boolean;
    readonly onConfirmPending: (field: IdentityScalarField) => void | Promise<unknown>;
    readonly onDismissPending: (field: IdentityScalarField) => void | Promise<unknown>;
    readonly embedded?: boolean;
}

function webConfirm(message: string): boolean | null {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        return window.confirm(message);
    }
    return null;
}

function ConfirmedFieldRow({ row }: { readonly row: IdentityScalarRow }) {
    return (
        <View
            className={`border-b py-3.5 ${HAIRLINE}`}
            testID={`identity-confirmed-${row.key}`}
        >
            <Text className={`text-[12px] uppercase tracking-[1.5px] ${SECONDARY}`}>
                {row.label}
            </Text>
            <Text className={`mt-1 text-[16px] ${BODY}`}>
                {row.field.value}
            </Text>
        </View>
    );
}

function CollectionRow({ row }: { readonly row: IdentityCollectionRow }) {
    return (
        <View
            className={`border-b py-3.5 ${HAIRLINE}`}
            testID={`identity-collection-${row.id}`}
        >
            <Text className={`text-[12px] uppercase tracking-[1.5px] ${SECONDARY}`}>
                {row.label}
            </Text>
            <Text className={`mt-1 text-[16px] ${BODY}`}>
                {row.value}
            </Text>
        </View>
    );
}

function PendingCandidateCard({
    row,
    disabled,
    onConfirm,
    onDismiss,
}: {
    readonly row: IdentityScalarRow;
    readonly disabled: boolean;
    readonly onConfirm: () => void;
    readonly onDismiss: () => void;
}) {
    const proposed = row.field.pendingCandidate ?? '';
    return (
        <View
            className="mb-4 rounded-card border border-bone-light px-4 py-4 dark:border-bone-dark"
            testID={`identity-pending-${row.key}`}
            accessibilityLabel={`Pending change for ${row.label}`}
        >
            <Text className="text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                Pending · {row.label}
            </Text>
            <View className="mt-2 gap-1">
                <Text className={`text-sm ${SECONDARY}`}>
                    Current confirmed
                </Text>
                <Text className={`text-base font-medium ${BODY}`}>
                    {row.field.value}
                </Text>
            </View>
            <View className="mt-2 gap-1">
                <Text className={`text-sm ${SECONDARY}`}>
                    Proposed
                </Text>
                <Text
                    className={`text-[16px] ${BODY}`}
                    testID={`identity-proposed-${row.key}`}
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    {proposed}
                </Text>
            </View>
            <View className="mt-3 flex-row gap-3">
                <Pressable
                    onPress={onConfirm}
                    disabled={disabled}
                    className={`${ACTION} ${disabled ? 'opacity-50' : ''}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Confirm ${row.label} change to ${proposed}`}
                    testID={`identity-confirm-${row.key}`}
                >
                    <Text className={`text-[15px] ${BODY}`}>Confirm</Text>
                </Pressable>
                <Pressable
                    onPress={onDismiss}
                    disabled={disabled}
                    className={`${ACTION} ${disabled ? 'opacity-50' : ''}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Dismiss proposed ${row.label} change`}
                    testID={`identity-dismiss-${row.key}`}
                >
                    <Text className={`text-[15px] ${BODY}`}>Dismiss</Text>
                </Pressable>
            </View>
        </View>
    );
}

export function IdentitySettingsSection({
    scalarRows,
    pendingRows,
    collectionRows,
    isBusy = false,
    onConfirmPending,
    onDismissPending,
    embedded = false,
}: IdentitySettingsSectionProps) {
    const confirmedOnly = scalarRows.filter((row) => !row.hasPending);
    const empty = scalarRows.length === 0
        && collectionRows.length === 0
        && pendingRows.length === 0;

    const requestConfirm = useCallback((row: IdentityScalarRow) => {
        const proposed = row.field.pendingCandidate ?? '';
        const message = `Replace confirmed ${row.label.toLowerCase()} "${row.field.value}" with "${proposed}"? This is the only way a confirmed identity value is overwritten.`;
        const web = webConfirm(message);
        if (web === true) {
            void onConfirmPending(row.key);
            return;
        }
        if (web === false) return;
        Alert.alert('Confirm identity change', message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                style: 'destructive',
                onPress: () => {
                    void onConfirmPending(row.key);
                },
            },
        ]);
    }, [onConfirmPending]);

    const requestDismiss = useCallback((row: IdentityScalarRow) => {
        const proposed = row.field.pendingCandidate ?? '';
        const message = `Dismiss proposed ${row.label.toLowerCase()} "${proposed}"? Confirmed value stays "${row.field.value}".`;
        const web = webConfirm(message);
        if (web === true) {
            void onDismissPending(row.key);
            return;
        }
        if (web === false) return;
        Alert.alert('Dismiss proposed change', message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Dismiss',
                style: 'destructive',
                onPress: () => {
                    void onDismissPending(row.key);
                },
            },
        ]);
    }, [onDismissPending]);

    return (
        <SettingsSection title="Identity" embedded={embedded}>
            {empty ? (
                <View testID="identity-empty-state" accessibilityLabel="No identity on device yet">
                    <Text className={`text-sm leading-relaxed ${SECONDARY}`}>
                        No identity facts on this device yet. When you introduce yourself
                        in a journal entry, confirmed details appear here. Contradictions
                        wait for your Confirm or Dismiss.
                    </Text>
                </View>
            ) : null}

            {pendingRows.length > 0 ? (
                <View className="mb-4" testID="identity-pending-list">
                    <Text className={`mb-2 text-[12px] uppercase tracking-[1.5px] ${SECONDARY}`}>
                        Needs your decision
                    </Text>
                    {pendingRows.map((row) => (
                        <PendingCandidateCard
                            key={row.key}
                            row={row}
                            disabled={isBusy}
                            onConfirm={() => requestConfirm(row)}
                            onDismiss={() => requestDismiss(row)}
                        />
                    ))}
                </View>
            ) : (
                <View testID="identity-no-pending" className="mb-3">
                    <Text className={`text-sm ${SECONDARY}`}>
                        No pending changes.
                    </Text>
                </View>
            )}

            {confirmedOnly.length > 0 || collectionRows.length > 0 ? (
                <View testID="identity-confirmed-list">
                    <Text className={`mb-2 text-[12px] uppercase tracking-[1.5px] ${SECONDARY}`}>
                        Confirmed on this device
                    </Text>
                    {confirmedOnly.map((row) => (
                        <ConfirmedFieldRow key={row.key} row={row} />
                    ))}
                    {/* Pending fields still show confirmed value inside the pending card only. */}
                    {scalarRows
                        .filter((row) => row.hasPending)
                        .map((row) => (
                            <View key={`confirmed-shadow-${row.key}`} className="mb-2 opacity-70">
                                <Text className={`text-xs ${SECONDARY}`}>
                                    {row.label} (active while pending): {row.field.value}
                                </Text>
                            </View>
                        ))}
                    {collectionRows.map((row) => (
                        <CollectionRow key={row.id} row={row} />
                    ))}
                </View>
            ) : null}
        </SettingsSection>
    );
}
