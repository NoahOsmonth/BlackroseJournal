import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminAuthService } from '../adminAuth';

describe('createAdminAuthService', () => {
  it('uses the persisted Supabase session for login and gateway authorization', async () => {
    const session = { access_token: 'session-token' };
    const signInWithPassword = jest.fn(async () => ({ error: null }));
    const unsubscribe = jest.fn();
    const client = {
      auth: {
        getSession: jest.fn(async () => ({ data: { session }, error: null })),
        signInWithPassword,
        signOut: jest.fn(async () => ({ error: null })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe } } })),
      },
    } as unknown as SupabaseClient;
    const auth = createAdminAuthService(client);

    await auth.signIn('admin@example.com', 'correct-password');
    const token = await auth.getAccessToken();
    const stop = auth.subscribe(() => undefined);
    stop();

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.com', password: 'correct-password',
    });
    expect(token).toBe('session-token');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('does not hide Supabase authentication failures', async () => {
    const authError = new Error('invalid credentials');
    const client = {
      auth: {
        signInWithPassword: jest.fn(async () => ({ error: authError })),
      },
    } as unknown as SupabaseClient;

    await expect(createAdminAuthService(client).signIn('x@example.com', 'wrong'))
      .rejects.toBe(authError);
  });
});
