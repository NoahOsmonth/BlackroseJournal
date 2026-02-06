import Constants from 'expo-constants';

export interface SupabaseConfig {
    url: string;
    anonKey: string;
}

type ExtraConfig = {
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
};

function getExtraConfig(): ExtraConfig {
    const extra = {
        ...(Constants.manifest?.extra ?? {}),
        ...(Constants.expoGoConfig?.extra ?? {}),
        ...(Constants.expoConfig?.extra ?? {}),
    };

    return extra as ExtraConfig;
}

function readProcessEnv(key: string): string | undefined {
    if (typeof process === 'undefined' || !process.env) {
        return undefined;
    }

    return process.env[key];
}

export function getSupabaseConfig(): SupabaseConfig | null {
    const extra = getExtraConfig();
    const expoPublicUrl = typeof process !== 'undefined'
        ? process.env.EXPO_PUBLIC_SUPABASE_URL
        : undefined;
    const expoPublicAnonKey = typeof process !== 'undefined'
        ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
        : undefined;

    const url =
        extra.SUPABASE_URL ||
        extra.EXPO_PUBLIC_SUPABASE_URL ||
        extra.supabaseUrl ||
        expoPublicUrl ||
        readProcessEnv('SUPABASE_URL') ||
        readProcessEnv('EXPO_PUBLIC_SUPABASE_URL');

    const anonKey =
        extra.SUPABASE_ANON_KEY ||
        extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        extra.supabaseAnonKey ||
        expoPublicAnonKey ||
        readProcessEnv('SUPABASE_ANON_KEY') ||
        readProcessEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

    if (!url || !anonKey) {
        return null;
    }

    // Validate URL is actually a valid HTTP(S) URL, not a placeholder
    try {
        const parsed = new URL(url);
        if (!parsed.protocol.startsWith('http')) {
            return null;
        }
    } catch {
        // URL is invalid (e.g., "YOUR_SUPABASE_URL" placeholder)
        return null;
    }

    return { url, anonKey };
}
