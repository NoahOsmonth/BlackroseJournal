import { logSupabaseError, resetSupabaseErrorCache } from '@/services/supabase/supabaseErrors';

describe('logSupabaseError', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    afterEach(() => {
        warnSpy.mockClear();
        resetSupabaseErrorCache();
    });

    afterAll(() => {
        warnSpy.mockRestore();
    });

    it('logs missing table warnings once per table/context', () => {
        const message = "Could not find the table 'public.user_settings' in the schema cache";

        logSupabaseError('Failed to load remote user settings', 'user_settings', message);
        logSupabaseError('Failed to load remote user settings', 'user_settings', message);

        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('logs non-missing table errors each time', () => {
        logSupabaseError('Failed to push goals', 'goals', 'Something else happened');
        logSupabaseError('Failed to push goals', 'goals', 'Something else happened');

        expect(warnSpy).toHaveBeenCalledTimes(2);
    });
});
