import 'dotenv/config';
import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: config.name ?? 'JournalApp',
    slug: config.slug ?? 'journal-app',
    extra: {
        ...config.extra,
        NANO_GPT_API_KEY: process.env.NANO_GPT_API_KEY,
        NANO_GPT_API_BASE_URL: process.env.NANO_GPT_API_BASE_URL,
        NANO_GPT_MODEL: process.env.NANO_GPT_MODEL,
        AGENT_BASE_URL: process.env.AGENT_BASE_URL || process.env.EXPO_PUBLIC_AGENT_BASE_URL,
        AGENT_API_KEY: process.env.AGENT_API_KEY || process.env.EXPO_PUBLIC_AGENT_API_KEY,
        SUPERMEMORY_API_KEY:
            process.env.SUPERMEMORY_API_KEY || process.env.EXPO_PUBLIC_SUPERMEMORY_API_KEY,
        SUPERMEMORY_BASE_URL:
            process.env.SUPERMEMORY_BASE_URL || process.env.EXPO_PUBLIC_SUPERMEMORY_BASE_URL,
        SUPABASE_URL: process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL,
        SUPABASE_ANON_KEY:
            process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
});
