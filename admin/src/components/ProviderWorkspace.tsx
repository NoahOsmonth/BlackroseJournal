import React from 'react';
import type {
  AdminProvider,
  CreateProviderRequest,
  FlashRouteInput,
  ProviderCredentialInput,
  ProviderHealth,
  ProviderModelRecord,
  PublishCatalogModelRequest,
  RuntimeSettings,
  UpdateProviderRequest,
} from '../services/adminTypes';
import { CredentialForm } from './CredentialForm';
import { ModelInventory } from './ModelInventory';
import { ProviderForm } from './ProviderForm';

interface ProviderWorkspaceProps {
  creating: boolean;
  provider: AdminProvider | null;
  inventory: ProviderModelRecord[];
  health: ProviderHealth | null;
  runtime: RuntimeSettings | null;
  busyAction: string | null;
  onCreate: (input: CreateProviderRequest) => Promise<boolean | void>;
  onUpdate: (id: string, input: UpdateProviderRequest) => Promise<void>;
  onCancelCreate: () => void;
  onArchiveProvider: () => Promise<void>;
  onCredential: (credential: ProviderCredentialInput) => Promise<boolean | void>;
  onDiscover: () => Promise<void>;
  onPublish: (model: ProviderModelRecord, input: Omit<PublishCatalogModelRequest,
    'providerModelId' | 'expectedRevision' | 'purpose'>) => Promise<void>;
  onArchiveModel: (model: ProviderModelRecord) => Promise<void>;
  onAssignFlash: (model: ProviderModelRecord, input: FlashRouteInput) => Promise<void>;
}

export function ProviderWorkspace(props: ProviderWorkspaceProps) {
  if (props.creating) {
    return <ProviderForm provider={null} busy={Boolean(props.busyAction)}
      onCreate={props.onCreate} onUpdate={props.onUpdate} onCancelCreate={props.onCancelCreate} />;
  }
  if (!props.provider) {
    return <section className="panel welcome-panel"><p className="eyebrow">Provider operations</p>
      <h2>Select a provider</h2><p className="muted">Inspect health, discover inventory, and assign models without releasing the app.</p></section>;
  }
  const health = props.health;
  return (
    <div className="content-stack">
      <section className="provider-summary panel">
        <div><p className="eyebrow">Provider health</p><h2>{props.provider.name}</h2>
          <p className="muted">{props.provider.baseUrl}</p></div>
        <div className="summary-actions">
          <span className={`status-pill status-${health?.status ?? 'unknown'}`}>
            {health?.status ?? 'Checking health'}{health?.modelCount !== undefined ? ` · ${health.modelCount} models` : ''}
          </span>
          <button className="button button-danger" type="button"
            disabled={props.provider.state === 'archived'}
            onClick={() => void props.onArchiveProvider()}>Archive provider</button>
        </div>
      </section>
      <ProviderForm provider={props.provider} busy={props.busyAction === 'provider-save'}
        onCreate={props.onCreate} onUpdate={props.onUpdate} onCancelCreate={props.onCancelCreate} />
      <CredentialForm credentialMetadata={props.provider.credentialMetadata}
        busy={props.busyAction === 'credential-save'} onSubmit={props.onCredential} />
      <ModelInventory models={props.inventory} runtime={props.runtime}
        busyAction={props.busyAction} onDiscover={props.onDiscover} onPublish={props.onPublish}
        onArchive={props.onArchiveModel} onAssignFlash={props.onAssignFlash} />
    </div>
  );
}
