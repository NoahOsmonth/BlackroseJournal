import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminAuthService } from '../services/adminAuth';

export function useAdminSession(auth: AdminAuthService) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void auth.getSnapshot()
      .then(({ session: current }) => { if (active) setSession(current); })
      .catch(() => { if (active) setError('Unable to restore the admin session.'); })
      .finally(() => { if (active) setLoading(false); });
    const unsubscribe = auth.subscribe(({ session: current }) => {
      setSession(current);
      setLoading(false);
    });
    return () => { active = false; unsubscribe(); };
  }, [auth]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      await auth.signIn(email, password);
    } catch {
      setError('Sign-in failed. Check your credentials and try again.');
      setLoading(false);
    }
  }, [auth]);

  const signOut = useCallback(async () => {
    setError(null);
    await auth.signOut().catch(() => setError('Sign-out failed. Please try again.'));
  }, [auth]);

  return { session, loading, error, signIn, signOut };
}
