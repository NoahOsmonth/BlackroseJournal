import { useEffect, useState } from 'react';
import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { getSupabaseConfig } from '@/services/supabase/supabaseConfig';
import { isMissingTableMessage } from '@/services/supabase/supabaseErrors';

type SchemaStatus = 'ok' | 'missing-config' | 'missing-table' | 'auth-error' | 'unknown';

const REQUIRED_TABLES = ['user_settings', 'journal_entries'];

function shouldSkipCheck(): boolean {
    if (typeof __DEV__ !== 'undefined') {
        return !__DEV__;
    }

    return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test';
}

export function useSupabaseSchemaStatus() {
    const [status, setStatus] = useState<SchemaStatus>('ok');
    const [warning, setWarning] = useState<string | null>(null);

    useEffect(() => {
        if (shouldSkipCheck()) {
            return;
        }

        let isActive = true;

        const runCheck = async () => {
            const config = getSupabaseConfig();
            if (!config) {
                if (!isActive) return;
                setStatus('missing-config');
                setWarning('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
                return;
            }

            const client = await ensureSupabaseSession();
            if (!client) {
                if (!isActive) return;
                setStatus('auth-error');
                setWarning('Supabase session could not be established. Check anonymous auth settings.');
                return;
            }

            for (const table of REQUIRED_TABLES) {
                const { error } = await client.from(table).select('*').limit(1);
                if (error) {
                    if (!isActive) return;
                    if (isMissingTableMessage(error.message)) {
                        setStatus('missing-table');
                        setWarning(`Supabase table missing: ${table}. Apply the schema migration.`);
                        return;
                    }
                    setStatus('unknown');
                    setWarning(`Supabase error: ${error.message}`);
                    return;
                }
            }

            if (!isActive) return;
            setStatus('ok');
            setWarning(null);
        };

        runCheck();

        return () => {
            isActive = false;
        };
    }, []);

    return { status, warning };
}
