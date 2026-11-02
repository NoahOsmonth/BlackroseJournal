/**
 * Crash log store.
 *
 * The only owner of `@blackrose_crash_logs`. A crash can happen at any point in
 * the app's life, so every write here is best-effort: a failure to persist a
 * crash log must never turn one crash into two.
 */

import { Platform } from 'react-native';

import { APP_VERSION } from '@/constants/appInfo';
import {
    AccountStorageAdapter,
    getStorageForAccount,
} from '@/services/account/accountScopedStorage';
import {
    AccountOperationContext,
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';

export const CRASH_LOG_STORAGE_KEY = '@blackrose_crash_logs';
export const CRASH_LOG_SCHEMA_VERSION = 1;

/** Oldest records fall off the end; the store never grows past this. */
export const MAX_CRASH_LOG_RECORDS = 20;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_STACK_LENGTH = 8000;

export interface CrashLogRecord {
    readonly id: string;
    readonly message: string;
    readonly stack?: string;
    /** Where the crash was caught: `globalHandler`, `window.error`, `boundary`. */
    readonly component: string;
    readonly isFatal: boolean;
    readonly createdAt: number;
    readonly appVersion: string;
    readonly platform: string;
}

export interface CrashLogState {
    /** Newest first. */
    readonly records: readonly CrashLogRecord[];
    /** Timestamp the user last opened the crash log screen; `0` when never. */
    readonly lastSeenAt: number;
}

export interface RecordCrashInput {
    readonly error: unknown;
    /** Defaults to `true`: an uncaught crash and a caught render error both count. */
    readonly isFatal?: boolean;
    readonly component?: string;
    readonly platform?: string;
}

interface CrashLogEnvelope {
    schemaVersion: number;
    updatedAt: number;
    lastSeenAt: number;
    records: CrashLogRecord[];
}

const EMPTY_STATE: CrashLogState = { records: [], lastSeenAt: 0 };

let mutationQueue: Promise<void> = Promise.resolve();

registerAccountTeardown(() => {
    mutationQueue = Promise.resolve();
});

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

function trim(value: string, maxLength: number): string {
    return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

/** Turn whatever a handler was given into a message and an optional stack. */
export function describeCrash(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
        const message = error.message?.trim() || error.name || 'Unknown error';
        return {
            message: trim(message, MAX_MESSAGE_LENGTH),
            stack: error.stack ? trim(error.stack, MAX_STACK_LENGTH) : undefined,
        };
    }

    if (typeof error === 'string' && error.trim().length > 0) {
        return { message: trim(error.trim(), MAX_MESSAGE_LENGTH) };
    }

    if (error && typeof error === 'object') {
        const candidate = error as { message?: unknown; stack?: unknown };
        const message = typeof candidate.message === 'string' && candidate.message.trim().length > 0
            ? candidate.message.trim()
            : 'Non-error object thrown';
        return {
            message: trim(message, MAX_MESSAGE_LENGTH),
            stack: typeof candidate.stack === 'string'
                ? trim(candidate.stack, MAX_STACK_LENGTH)
                : undefined,
        };
    }

    return { message: `Non-error value thrown: ${String(error)}`.slice(0, MAX_MESSAGE_LENGTH) };
}

function buildRecord(input: RecordCrashInput, now: number): CrashLogRecord {
    const { message, stack } = describeCrash(input.error);
    return {
        id: `crash_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        message,
        stack,
        component: input.component ?? 'unknown',
        isFatal: input.isFatal ?? true,
        createdAt: now,
        appVersion: APP_VERSION,
        platform: input.platform ?? Platform.OS,
    };
}

function isCrashLogRecord(value: unknown): value is CrashLogRecord {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<Record<keyof CrashLogRecord, unknown>>;
    return typeof candidate.id === 'string'
        && typeof candidate.message === 'string'
        && typeof candidate.createdAt === 'number'
        && typeof candidate.component === 'string'
        && typeof candidate.isFatal === 'boolean';
}

/**
 * Accepts the current envelope or a bare array, so records written by an older
 * build survive a shape change.
 */
function parseState(json: string | null): CrashLogState {
    if (!json) return EMPTY_STATE;
    try {
        const parsed = JSON.parse(json) as unknown;
        const rawRecords = Array.isArray(parsed)
            ? parsed
            : (parsed && typeof parsed === 'object'
                ? (parsed as { records?: unknown }).records
                : undefined);
        const lastSeenAt = !Array.isArray(parsed) && parsed && typeof parsed === 'object'
            && typeof (parsed as { lastSeenAt?: unknown }).lastSeenAt === 'number'
            ? (parsed as { lastSeenAt: number }).lastSeenAt
            : 0;
        if (!Array.isArray(rawRecords)) return { records: [], lastSeenAt };
        const records = rawRecords.filter(isCrashLogRecord).sort((a, b) => b.createdAt - a.createdAt);
        return { records, lastSeenAt };
    } catch {
        return EMPTY_STATE;
    }
}

function buildEnvelope(
    records: readonly CrashLogRecord[],
    lastSeenAt: number,
    now: number,
): CrashLogEnvelope {
    return {
        schemaVersion: CRASH_LOG_SCHEMA_VERSION,
        updatedAt: now,
        lastSeenAt,
        records: records.slice(0, MAX_CRASH_LOG_RECORDS),
    };
}

async function loadState(
    storage: AccountStorageAdapter,
    context: AccountOperationContext,
): Promise<CrashLogState> {
    const json = await storage.getItem(CRASH_LOG_STORAGE_KEY);
    assertAccountOperationActive(context);
    return parseState(json);
}

async function saveState(
    storage: AccountStorageAdapter,
    state: CrashLogState,
    context: AccountOperationContext,
): Promise<void> {
    assertAccountOperationActive(context);
    await storage.setItem(
        CRASH_LOG_STORAGE_KEY,
        JSON.stringify(buildEnvelope(state.records, state.lastSeenAt, Date.now())),
    );
    assertAccountOperationActive(context);
}

/**
 * Persist one crash. Resolves `null` instead of throwing when the store is
 * unreachable (no account yet, lease aborted, storage full): a crash reporter
 * that crashes is worse than a crash that was not reported.
 */
export async function recordCrashLog(input: RecordCrashInput): Promise<CrashLogRecord | null> {
    const record = buildRecord(input, Date.now());

    try {
        return await runAccountBoundOperation('crash-log-record', (context) =>
            enqueueMutation(async () => {
                const storage = getStorageForAccount(context.accountId);
                const state = await loadState(storage, context);
                await saveState(
                    storage,
                    { records: [record, ...state.records], lastSeenAt: state.lastSeenAt },
                    context,
                );
                return record;
            })
        );
    } catch (error) {
        console.warn('[crash] Could not persist the crash log:', error);
        return null;
    }
}

export function loadCrashLogState(): Promise<CrashLogState> {
    return runAccountBoundOperation('crash-log-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        const state = await loadState(storage, context);
        assertAccountOperationActive(context);
        return state;
    });
}

/** Records written after this call are the only ones the banner will flag. */
export function markCrashLogsSeen(): Promise<void> {
    return runAccountBoundOperation('crash-log-seen', (context) =>
        enqueueMutation(async () => {
            const storage = getStorageForAccount(context.accountId);
            const state = await loadState(storage, context);
            if (state.records.length === 0) return;
            await saveState(storage, { records: state.records, lastSeenAt: Date.now() }, context);
        })
    );
}

export function clearCrashLogs(): Promise<void> {
    return runAccountBoundOperation('crash-log-clear', (context) =>
        enqueueMutation(async () => {
            const storage = getStorageForAccount(context.accountId);
            assertAccountOperationActive(context);
            await storage.removeItem(CRASH_LOG_STORAGE_KEY);
            assertAccountOperationActive(context);
        })
    );
}
