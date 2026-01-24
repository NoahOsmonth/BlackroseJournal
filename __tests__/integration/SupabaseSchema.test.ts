import { createClient } from '@supabase/supabase-js';

const shouldRun = process.env.RUN_INTEGRATION_TESTS === '1';

if (!shouldRun) {
    describe('Supabase schema', () => {
        it.skip('integration tests disabled', () => {});
    });
} else {
    describe('Supabase schema', () => {
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

        if (!url || !anonKey) {
            throw new Error('Missing Supabase env vars for integration tests.');
        }

        const client = createClient(url, anonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        });

        beforeAll(async () => {
            const { error } = await client.auth.signInAnonymously();
            if (error) {
                throw new Error(`Supabase anonymous auth failed: ${error.message}`);
            }
        });

        it.each(['user_settings', 'journal_entries'])('has table %s', async (table) => {
            const { error } = await client
                .from(table)
                .select('*')
                .limit(1);

            expect(error).toBeNull();
        });
    });
}
