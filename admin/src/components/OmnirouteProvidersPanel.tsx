import React, { useState } from 'react';
import type { OmnirouteProvider } from '../services/omnirouteAdminApi';

interface OmnirouteProvidersPanelProps {
  providers: OmnirouteProvider[];
  busyAction: string | null;
  error: string | null;
  onTest: (id: string) => Promise<boolean>;
  onDisconnect: (providerName: string) => Promise<boolean>;
}

function statusClass(status: string): string {
  const value = status.toLowerCase();
  if (['connected', 'active', 'healthy', 'ok', 'valid'].includes(value)) return 'status-healthy';
  if (['error', 'failed', 'unavailable', 'invalid'].includes(value)) return 'status-unavailable';
  if (value === 'unknown') return '';
  return 'status-warning';
}

export function omnirouteDisconnectPhrase(providerName: string): string {
  return `DELETE PROVIDER ${providerName}`;
}

interface OmnirouteDisconnectConfirmProps {
  providerName: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Typed confirmation gate for disconnect — exported so tests render it directly. */
export function OmnirouteDisconnectConfirm({
  providerName,
  busy,
  onConfirm,
  onCancel,
}: OmnirouteDisconnectConfirmProps) {
  const [confirmation, setConfirmation] = useState('');
  const phrase = omnirouteDisconnectPhrase(providerName);
  return (
    <form
      className="form-stack"
      aria-label={`Confirm disconnecting ${providerName}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmation === phrase && !busy) onConfirm();
      }}
    >
      <p className="notice notice-warning">
        Disconnecting removes {providerName}&rsquo;s models from the published
        allowlist. Type <code>{phrase}</code> to confirm. The provider itself is
        never deleted.
      </p>
      <label>
        Confirmation phrase
        <input
          type="text"
          value={confirmation}
          autoComplete="off"
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={phrase}
        />
      </label>
      <div className="button-row">
        <button type="submit" className="button button-danger"
          disabled={confirmation !== phrase || busy}>
          {busy ? 'Disconnecting…' : 'Confirm disconnect'}
        </button>
        <button type="button" className="button button-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Task 6 providers panel. Disconnect-only CRUD: there is deliberately no
 * delete button — disconnecting removes the provider's models from the
 * published allowlist and requires typing the confirmation phrase.
 */
export function OmnirouteProvidersPanel({
  providers,
  busyAction,
  error,
  onTest,
  onDisconnect,
}: OmnirouteProvidersPanelProps) {
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState<OmnirouteProvider | null>(null);

  const runTest = async (provider: OmnirouteProvider) => {
    const valid = await onTest(provider.id);
    setTestResults((previous) => ({ ...previous, [provider.id]: valid }));
  };

  const cancelDisconnect = () => setConfirming(null);

  const beginDisconnect = (provider: OmnirouteProvider) => {
    setConfirming(provider);
  };

  const confirmDisconnect = async () => {
    if (!confirming) return;
    const done = await onDisconnect(confirming.name);
    if (done) cancelDisconnect();
  };

  return (
    <section className="panel" aria-label="OmniRoute providers">
      <div className="section-heading">
        <h2>OmniRoute providers</h2>
        <span className="muted">Managed through the Blackrose backend proxy</span>
      </div>
      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
      {providers.length === 0 ? (
        <p className="empty-state">No OmniRoute providers are connected yet.</p>
      ) : (
        <ul className="inventory-list">
          {providers.map((provider) => (
            <li key={provider.id} className="inventory-card">
              <div className="provider-summary">
                <div>
                  <strong>{provider.name}</strong>
                  <p className="muted">{provider.id}</p>
                </div>
                <div className="summary-actions">
                  <span className={`status-pill ${statusClass(provider.status)}`}>
                    {provider.status}
                  </span>
                  {provider.id in testResults ? (
                    <span
                      className={`status-pill ${testResults[provider.id]
                        ? 'status-healthy'
                        : 'status-unavailable'}`}
                    >
                      {testResults[provider.id] ? 'Test passed' : 'Test failed'}
                    </span>
                  ) : null}
                  <button type="button" className="button button-secondary"
                    disabled={busyAction !== null}
                    onClick={() => void runTest(provider)}>
                    {busyAction === `test-${provider.id}` ? 'Testing…' : 'Test'}
                  </button>
                  <button type="button" className="button button-danger"
                    disabled={busyAction !== null}
                    onClick={() => beginDisconnect(provider)}>
                    Disconnect
                  </button>
                </div>
              </div>
              {confirming?.id === provider.id ? (
                <OmnirouteDisconnectConfirm
                  providerName={provider.name}
                  busy={busyAction === `disconnect-${provider.name}`}
                  onConfirm={() => void confirmDisconnect()}
                  onCancel={cancelDisconnect}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
