import React from 'react';
import type { AdminAuthService } from './services/adminAuth';
import type { AdminControlPlaneClient } from './services/adminApi';
import type { OmnirouteAdminClient } from './services/omnirouteAdminApi';
import { useAdminSession } from './hooks/useAdminSession';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginPage } from './components/LoginPage';

interface AppProps {
  auth: AdminAuthService;
  client: AdminControlPlaneClient;
  omniroute?: OmnirouteAdminClient | null;
}

export function App({ auth, client, omniroute = null }: AppProps) {
  const session = useAdminSession(auth);
  if (session.loading && !session.session) {
    return <main className="loading-state" role="status">Restoring admin session…</main>;
  }
  if (!session.session) {
    return <LoginPage busy={session.loading} error={session.error} onSubmit={session.signIn} />;
  }
  return <AdminDashboard client={client} omniroute={omniroute}
    accountEmail={session.session.user.email} onSignOut={session.signOut} />;
}
