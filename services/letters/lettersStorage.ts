/**
 * Letters to your future self — storage (Kaneo #11).
 *
 * Owns exactly one key, `@blackrose_letters`, behind the account-scoped adapter.
 * Every mutation runs through one queue so two writes cannot drop each other
 * (AGENTS.md rule 4), and every parse tolerates corruption. Stored shape:
 * `{ schemaVersion: 1, letters: LetterRecord[] }`.
 */

import {
    AccountStorageAdapter,
    getStorageForAccount,
} from '@/services/account/accountScopedStorage';
import {
    runAccountBoundOperation,
    requireActiveAccountId,
} from '@/services/account/accountRuntime';
import { getLocalDateKey } from '@/utils/date';
import type { LetterRecord } from '@/utils/letters';

const LETTERS_KEY = '@blackrose_letters';
const SCHEMA_VERSION = 1;

let mutationQueue: Promise<void> = Promise.resolve();

interface LettersEnvelope {
    readonly schemaVersion: number;
    readonly letters: LetterRecord[];
}

function storage(): AccountStorageAdapter {
    return getStorageForAccount(requireActiveAccountId());
}

function isRecord(value: unknown): value is LetterRecord {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.id === 'string'
        && typeof v.body === 'string'
        && typeof v.unlockDate === 'string'
        && typeof v.writtenDate === 'string'
        && typeof v.createdAt === 'number';
}

/** Any bad row is dropped rather than taking the whole list down with it. */
async function readLetters(adapter: AccountStorageAdapter): Promise<LetterRecord[]> {
    const raw = await adapter.getItem(LETTERS_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return [];
        const letters = (parsed as Partial<LettersEnvelope>).letters;
        if (!Array.isArray(letters)) return [];
        return letters.filter(isRecord);
    } catch {
        return [];
    }
}

async function writeLetters(adapter: AccountStorageAdapter, letters: LetterRecord[]): Promise<void> {
    const envelope: LettersEnvelope = { schemaVersion: SCHEMA_VERSION, letters };
    await adapter.setItem(LETTERS_KEY, JSON.stringify(envelope));
}

function enqueue(operation: () => Promise<void>): Promise<void> {
    const run = mutationQueue.then(operation, operation);
    // Keep the chain alive even when one write fails.
    mutationQueue = run.then(() => undefined, () => undefined);
    return run;
}

export async function listLetters(): Promise<LetterRecord[]> {
    return runAccountBoundOperation('letters-read', async () => readLetters(storage()));
}

export interface CreateLetterInput {
    readonly body: string;
    readonly unlockDate: string;
}

export async function createLetter(input: CreateLetterInput): Promise<LetterRecord> {
    const letter: LetterRecord = {
        id: `letter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        body: input.body,
        unlockDate: input.unlockDate,
        writtenDate: getLocalDateKey(),
        createdAt: Date.now(),
    };
    await runAccountBoundOperation('letters-write', async () => {
        const adapter = storage();
        await enqueue(async () => {
            const letters = await readLetters(adapter);
            await writeLetters(adapter, [...letters, letter]);
        });
    });
    return letter;
}

export async function deleteLetter(id: string): Promise<void> {
    await runAccountBoundOperation('letters-write', async () => {
        const adapter = storage();
        await enqueue(async () => {
            const letters = await readLetters(adapter);
            await writeLetters(adapter, letters.filter((letter) => letter.id !== id));
        });
    });
}

/** Used by Clear History; must stay paired with it in the settings flow. */
export async function clearLetters(): Promise<void> {
    await runAccountBoundOperation('letters-write', async () => {
        const adapter = storage();
        await enqueue(async () => adapter.removeItem(LETTERS_KEY));
    });
}
