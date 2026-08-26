import type { Session, SupabaseClient } from '@supabase/supabase-js';

export interface AdminAuthSnapshot {
  session: Session | null;
}

export interface AdminAuthService {
  getSnapshot(): Promise<AdminAuthSnapshot>;
  subscribe(listener: (snapshot: AdminAuthSnapshot) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
}

export function createAdminAuthService(client: SupabaseClient): AdminAuthService {
  return {
    async getSnapshot() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return { session: data.session };
    },
    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener({ session }));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    async getAccessToken() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session?.access_token ?? null;
    },
  };
}
