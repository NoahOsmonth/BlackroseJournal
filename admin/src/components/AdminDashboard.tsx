import React, { useState } from 'react';
import { useAdminConsole } from '../hooks/useAdminConsole';
import type { AdminControlPlaneClient } from '../services/adminApi';
import { AuditPanel } from './AuditPanel';
import { CatalogPanel } from './CatalogPanel';
import { ConflictBanner } from './ConflictBanner';
import { ProviderSidebar } from './ProviderSidebar';
import { ProviderWorkspace } from './ProviderWorkspace';
import { RuntimePanel } from './RuntimePanel';

type AdminView = 'providers' | 'catalog' | 'runtime' | 'audit';

interface AdminDashboardProps {
  client: AdminControlPlaneClient;
  accountEmail?: string;
  onSignOut: () => Promise<void>;
}

export function AdminDashboard({ client, accountEmail, onSignOut }: AdminDashboardProps) {
  const console = useAdminConsole(client);
  const { state } = console;
  const [view, setView] = useState<AdminView>('providers');
  const [creating, setCreating] = useState(false);

  const reload = async () => {
    await console.loadDashboard();
    if (state.selectedProvider) await console.selectProvider(state.selectedProvider.id);
  };

  return (
    <div className="admin-layout">
      <header className="topbar">
        <div><strong>Blackrose Admin</strong><span className="environment-badge">AI control plane</span></div>
        <nav className="view-tabs" aria-label="Administration views">
          {(['providers', 'catalog', 'runtime', 'audit'] as const).map((item) => (
            <button key={item} type="button" aria-current={view === item ? 'page' : undefined}
              className={view === item ? 'active' : ''} onClick={() => setView(item)}>
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
      {state.conflict ? <ConflictBanner {...state.conflict} onReload={() => void reload()} /> : null}
      {state.error ? <div className="notice notice-error" role="alert">{state.error}</div> : null}
      {state.loading ? <div className="loading-state" role="status">Loading control plane…</div> : (
        <div className="workspace">
          <ProviderSidebar providers={state.providers} selectedId={state.selectedProvider?.id}
            onSelect={(id) => { setCreating(false); setView('providers'); void console.selectProvider(id); }}
            onCreate={() => { setCreating(true); setView('providers'); }} />
          <main className="main-content">
            {view === 'providers' ? (
              <ProviderWorkspace creating={creating} provider={state.selectedProvider}
                inventory={state.inventory} health={state.health} runtime={state.runtime}
                busyAction={state.busyAction} onCreate={async (input) => {
                  const saved = await console.createProvider(input);
                  if (saved) setCreating(false);
                  return saved;
                }} onUpdate={console.updateProvider} onCancelCreate={() => setCreating(false)}
                onArchiveProvider={console.archiveProvider} onCredential={console.replaceCredential}
                onDiscover={console.discover} onPublish={console.publish}
                onArchiveModel={console.archiveInventoryModel} onAssignFlash={console.assignFlash} />
            ) : null}
            {view === 'catalog' ? <CatalogPanel catalog={state.catalog}
              onArchive={console.archiveCatalogModel} /> : null}
            {view === 'runtime' ? <RuntimePanel runtime={state.runtime}
              busy={state.busyAction === 'runtime-save'} onSave={console.updateRuntime} /> : null}
            {view === 'audit' ? <AuditPanel events={state.audit} /> : null}
          </main>
        </div>
      )}
    </div>
  );
}
