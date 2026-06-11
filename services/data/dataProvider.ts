export type DataProvider = 'local' | 'remote';

const REMOTE_PROVIDER = 'remote';
const LOCAL_PROVIDER = 'local';
const REMOTE_PROVIDER_ALIAS = 'supabase';
const ENABLED_FLAGS = new Set(['1', 'true', 'yes', 'on', 'enabled']);

function readProcessEnv(key: string): string | undefined {
    if (typeof process === 'undefined' || !process.env) {
        return undefined;
    }

    return process.env[key];
}

function normalize(value: string | undefined): string | undefined {
    const trimmed = value?.trim().toLowerCase();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function resolveProviderFlag(): DataProvider | null {
    const provider = normalize(
        readProcessEnv('EXPO_PUBLIC_DATA_PROVIDER') ?? readProcessEnv('DATA_PROVIDER')
    );

    if (provider === LOCAL_PROVIDER) {
        return 'local';
    }

    if (provider === REMOTE_PROVIDER || provider === REMOTE_PROVIDER_ALIAS) {
        return 'remote';
    }

    return provider ? 'local' : null;
}

function isRemoteEnabledFlag(): boolean {
    const flag = normalize(
        readProcessEnv('EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC') ??
            readProcessEnv('ENABLE_REMOTE_DATA_SYNC')
    );
    return flag ? ENABLED_FLAGS.has(flag) : false;
}

export function getActiveDataProvider(): DataProvider {
    return resolveProviderFlag() ?? (isRemoteEnabledFlag() ? 'remote' : 'local');
}

export function isRemoteDataSyncEnabled(): boolean {
    return getActiveDataProvider() === 'remote';
}
