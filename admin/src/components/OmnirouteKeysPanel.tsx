import React, { useState } from 'react';
import type { OmnirouteUserKeyView } from '../services/omnirouteAdminApi';

interface OmnirouteKeysPanelProps {
  keys: OmnirouteUserKeyView[];
  busyAction: string | null;
  error: string | null;
  onLookup: (userId: string) => Promise<boolean>;
  onRevoke: (userId: string) => Promise<boolean>;
  onUpdateAllowedModels: (userId: string, allowedModels: string[]) => Promise<boolean>;
}

/**
 * Task 7 keys panel. Masked views only — the full key is shown exactly once
 * at creation time by OmniRoute and is unretrievable afterwards. Revocation
 * is permanent; re-issue goes through the normal ensureUserKey flow.
 */
export function OmnirouteKeysPanel({
  keys,
  busyAction,
  error,
  onLookup,
  onRevoke,
  onUpdateAllowedModels,
}: OmnirouteKeysPanelProps) {
  const [lookupId, setLookupId] = useState('');
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null);
  const [editingModels, setEditingModels] = useState<Record<string, string>>({});

  const lookup = async () => {
    if (!lookupId.trim()) return;
    const done = await onLookup(lookupId.trim());
    if (done) setLookupId('');
  };

  return (
    <section className="panel" aria-label="Per-user model keys">
      <div className="section-heading">
        <h2>Per-user model keys</h2>
        <span className="muted">Masked views only &mdash; full keys are never retrievable</span>
      </div>
      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
      <form className="form-stack" aria-label="Look up a user key" onSubmit={(event) => {
        event.preventDefault();
        void lookup();
      }}>
        <label>
          User ID
          <input
            type="text"
            value={lookupId}
            autoComplete="off"
            onChange={(event) => setLookupId(event.target.value)}
            placeholder="brj-<userId>"
          />
        </label>
        <div className="button-row">
          <button type="submit" className="button button-secondary" disabled={!lookupId.trim() || busyAction !== null}>
            {busyAction === 'lookup' ? 'Looking up…' : 'Look up key'}
          </button>
        </div>
      </form>
      {keys.length === 0 ? (
        <p className="empty-state">No per-user keys loaded yet.</p>
      ) : (
        <ul className="inventory-list">
          {keys.map((key) => {
            const draft = editingModels[key.userId] ?? key.allowedModels.join(', ');
            return (
              <li key={key.userId} className="inventory-card">
                <div className="provider-summary">
                  <div>
                    <strong>{key.maskedKey}</strong>
                    <p className="muted">{key.userId}</p>
                  </div>
                  <div className="summary-actions">
                    <button type="button" className="button button-danger"
                      disabled={busyAction !== null}
                      onClick={() => setConfirmingRevoke(key.userId)}>
                      Revoke
                    </button>
                  </div>
                </div>
                {confirmingRevoke === key.userId ? (
                  <div className="notice notice-warning" role="alert">
                    Revoking permanently disables this key. The next chat request
                    re-issues a new one automatically.
                    <div className="button-row">
                      <button type="button" className="button button-danger"
                        disabled={busyAction !== null}
                        onClick={() => {
                          void onRevoke(key.userId).then((done) => {
                            if (done) setConfirmingRevoke(null);
                          });
                        }}>
                        {busyAction === `revoke-${key.userId}` ? 'Revoking…' : 'Confirm revoke'}
                      </button>
                      <button type="button" className="button button-quiet" onClick={() => setConfirmingRevoke(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <form className="form-stack" aria-label={`Edit allowed models for ${key.userId}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void onUpdateAllowedModels(
                        key.userId,
                        draft.split(',').map((m) => m.trim()).filter(Boolean),
                      );
                    }}>
                    <label>
                      Allowed models (comma-separated, free models only)
                      <input
                        type="text"
                        value={draft}
                        autoComplete="off"
                        onChange={(event) =>
                          setEditingModels((previous) => ({ ...previous, [key.userId]: event.target.value }))}
                      />
                    </label>
                    <div className="button-row">
                      <button type="submit" className="button button-secondary" disabled={busyAction !== null}>
                        {busyAction === `models-${key.userId}` ? 'Saving…' : 'Save models'}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
