import React, { useEffect, useState } from 'react';
import type { AdminControlPlaneClient } from '../services/adminApi';
import type { OmnirouteAdminClient } from '../services/omnirouteAdminApi';
import { useAdminConsole } from '../hooks/useAdminConsole';
import { useOmnirouteAdmin } from '../hooks/useOmnirouteAdmin';
import { AuditPanel } from './AuditPanel';
import { ConflictBanner } from './ConflictBanner';
import { OmnirouteModelsPanel } from './OmnirouteModelsPanel';
import { OmnirouteProvidersPanel } from './OmnirouteProvidersPanel';
import { RuntimePanel } from './RuntimePanel';

type AdminView = 'providers' | 'models' | 'runtime' | 'audit';

interface AdminDashboardProps {
  client: AdminControlPlaneClient;
  omniroute: OmnirouteAdminClient | null;
  accountEmail?: string;
  onSignOut: () => Promise<void>;
}

/**
 * Task 6: the providers and models tabs are OmniRoute-backed panels mounted
 * only when the backend reports ADMIN_OMNIROUTE=on via its status proxy.
 * The legacy provider CRUD workspace was superseded and removed.
 */
export function AdminDashboard({ client, omniroute, accountEmail, onSignOut }: AdminDashboardProps) {
  const adminConsole = useAdminConsole(client);
  const { state } = adminConsole;
  const [view, setView] = useState<AdminView>('providers');
  const [omnirouteEnabled, setOmnirouteEnabled] = useState(false);

  useEffect(() => {
    if (!omniroute) return;
    let cancelled = false;
    omniroute.getStatus()
      .then((status) => {
        if (!cancelled) setOmnirouteEnabled(status.enabled);
      })
      .catch(() => {
        // Soft-fail: without the status probe the legacy tabs stay visible.
        if (!cancelled) setOmnirouteEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [omniroute]);

  const omni = useOmnirouteAdmin(omnirouteEnabled ? omniroute : null, omnirouteEnabled);

  const reload = async () => {
    await adminConsole.loadDashboard();
    await omni.refresh();
  };

  const effectiveView: AdminView | null = !omnirouteEnabled && view !== 'audit'
    ? 'runtime'
    : view;

  const views = omnirouteEnabled
    ? (['providers', 'models', 'runtime', 'audit'] as const)
    : (['runtime', 'audit'] as const);

  return (
    <div className="admin-layout">
      <header className="topbar">
        <div><strong>Blackrose Admin</strong><span className="environment-badge">AI control plane</span></div>
        <nav className="view-tabs" aria-label="Administration views">
          {views.map((item) => (
            <button key={item} type="button" aria-current={view === item ? 'page' : undefined}
              className={view === item ? 'active' : ''}
              onClick={() => setView(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        <div className="account-menu"><span>{accountEmail}</span>
          <button className="button button-quiet" type="button" onClick={() => void onSignOut()}>
            Sign out
          </button>
        </div>
      </header>
      {state.conflict
        ? <ConflictBanner {...state.conflict} onReload={() => void reload()} />
        : null}
      {state.error ? <div className="notice notice-error" role="alert">{state.error}</div> : null}
      {state.loading ? (
        <div className="loading-state" role="status">Loading control plane…</div>
      ) : (
        <main className="main-content">
          {effectiveView === 'providers' && omnirouteEnabled ? (
            <OmnirouteProvidersPanel
              providers={omni.state.providers}
              busyAction={omni.state.busyAction}
              error={omni.state.error}
              onTest={omni.testProvider}
              onDisconnect={omni.disconnectProvider}
            />
          ) : null}
          {effectiveView === 'models' && omnirouteEnabled ? (
            <OmnirouteModelsPanel
              models={omni.state.models}
              published={omni.state.published}
              busyAction={omni.state.busyAction}
              error={omni.state.error}
              onUpdatePublished={omni.updatePublishedModels}
            />
          ) : null}
          {effectiveView === 'runtime' ? (
            <RuntimePanel runtime={state.runtime}
              busy={state.busyAction === 'runtime-save'} onSave={adminConsole.updateRuntime} />
          ) : null}
          {effectiveView === 'audit' ? <AuditPanel events={state.audit} /> : null}
        </main>
      )}
    </div>
  );
}
