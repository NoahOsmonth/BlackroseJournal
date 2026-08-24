import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountStorageAdapter } from './accountScopedStorage';

const ACCOUNT_REGISTRY_KEY = '@blackrose_account_registry';
const ACCOUNT_REGISTRY_SCHEMA_VERSION = 1;

export interface RememberedAccount {
    id: string;
    email: string | null;
    lastAuthenticatedAt: number;
}

interface AccountRegistryEnvelope {
    schemaVersion: 1;
    rememberedAccountId: string | null;
    accounts: Record<string, RememberedAccount>;
}

let storageAdapter: AccountStorageAdapter = AsyncStorage;
let mutationQueue: Promise<void> = Promise.resolve();

function emptyRegistry(): AccountRegistryEnvelope {
    return {
        schemaVersion: ACCOUNT_REGISTRY_SCHEMA_VERSION,
        rememberedAccountId: null,
        accounts: {},
    };
}

function isRememberedAccount(value: unknown): value is RememberedAccount {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<RememberedAccount>;
    return typeof candidate.id === 'string'
        && (typeof candidate.email === 'string' || candidate.email === null)
        && typeof candidate.lastAuthenticatedAt === 'number';
}

function parseRegistry(raw: string | null): AccountRegistryEnvelope {
    if (!raw) return emptyRegistry();
    try {
        const parsed = JSON.parse(raw) as Partial<AccountRegistryEnvelope>;
        if (parsed.schemaVersion !== ACCOUNT_REGISTRY_SCHEMA_VERSION
            || !parsed.accounts
            || typeof parsed.accounts !== 'object') {
            return emptyRegistry();
        }

        const accounts = Object.fromEntries(
            Object.entries(parsed.accounts).filter((entry): entry is [string, RememberedAccount] => (
                isRememberedAccount(entry[1]) && entry[0] === entry[1].id
            ))
        );
        const rememberedAccountId = typeof parsed.rememberedAccountId === 'string'
            && accounts[parsed.rememberedAccountId]
            ? parsed.rememberedAccountId
            : null;
        return { schemaVersion: 1, rememberedAccountId, accounts };
    } catch {
        return emptyRegistry();
    }
}

async function loadRegistry(): Promise<AccountRegistryEnvelope> {
    return parseRegistry(await storageAdapter.getItem(ACCOUNT_REGISTRY_KEY));
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

export function setAccountRegistryStorageAdapter(adapter: AccountStorageAdapter): void {
    storageAdapter = adapter;
}

export function resetAccountRegistryStorageAdapter(): void {
    storageAdapter = AsyncStorage;
}

export async function loadRememberedAccount(): Promise<RememberedAccount | null> {
    const registry = await loadRegistry();
    return registry.rememberedAccountId
        ? registry.accounts[registry.rememberedAccountId] ?? null
        : null;
}

export async function listKnownAccounts(): Promise<RememberedAccount[]> {
    const registry = await loadRegistry();
    return Object.values(registry.accounts).sort((a, b) => a.id.localeCompare(b.id));
}

export function rememberAuthenticatedAccount(input: {
    id: string;
    email?: string | null;
}): Promise<void> {
    return enqueueMutation(async () => {
        const registry = await loadRegistry();
        const account: RememberedAccount = {
            id: input.id,
            email: input.email ?? null,
            lastAuthenticatedAt: Date.now(),
        };
        registry.accounts[input.id] = account;
        registry.rememberedAccountId = input.id;
        await storageAdapter.setItem(ACCOUNT_REGISTRY_KEY, JSON.stringify(registry));
    });
}

export function clearRememberedAccount(): Promise<void> {
    return enqueueMutation(async () => {
        const registry = await loadRegistry();
        registry.rememberedAccountId = null;
        await storageAdapter.setItem(ACCOUNT_REGISTRY_KEY, JSON.stringify(registry));
    });
}
