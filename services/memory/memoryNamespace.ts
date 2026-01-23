import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageAdapter } from '@/services/journal/journalStorage.types';

const STORAGE_KEY = '@memory_namespace';
const LEGACY_STORAGE_KEY = '@supermemory_container_tag';

let storageAdapter: StorageAdapter = AsyncStorage;
let cachedNamespace: string | null = null;

function generateNamespace(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 10);
    return `user_${timestamp}_${random}`;
}

export function setMemoryNamespaceAdapter(adapter: StorageAdapter): void {
    storageAdapter = adapter;
    cachedNamespace = null;
}

export function resetMemoryNamespaceAdapter(): void {
    storageAdapter = AsyncStorage;
    cachedNamespace = null;
}

export async function getOrCreateMemoryNamespace(): Promise<string> {
    if (cachedNamespace) {
        return cachedNamespace;
    }

    const stored = await storageAdapter.getItem(STORAGE_KEY);
    if (stored) {
        cachedNamespace = stored;
        return stored;
    }

    const legacy = await storageAdapter.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
        await storageAdapter.setItem(STORAGE_KEY, legacy);
        cachedNamespace = legacy;
        return legacy;
    }

    const generated = generateNamespace();
    await storageAdapter.setItem(STORAGE_KEY, generated);
    cachedNamespace = generated;
    return generated;
}
