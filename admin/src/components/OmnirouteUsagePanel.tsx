import React, { useState } from 'react';
import type { OmnirouteEmbeddingsSettings, OmnirouteUsageRow } from '../services/omnirouteAdminApi';

interface OmnirouteUsagePanelProps {
  usage: OmnirouteUsageRow[];
  embeddings: OmnirouteEmbeddingsSettings | null;
  busyAction: string | null;
  error: string | null;
  onSetEmbeddingsModel: (model: string | null) => Promise<boolean>;
}

/**
 * Task 7 usage + embeddings settings panel. Read-only analytics table plus
 * the embedding-model toggle (free models only; null disables embeddings).
 */
export function OmnirouteUsagePanel({
  usage,
  embeddings,
  busyAction,
  error,
  onSetEmbeddingsModel,
}: OmnirouteUsagePanelProps) {
  const [embeddingDraft, setEmbeddingDraft] = useState(embeddings?.embeddingModel ?? '');

  const saveEmbeddings = async () => {
    const done = await onSetEmbeddingsModel(embeddingDraft.trim() || null);
    if (!done) setEmbeddingDraft(embeddings?.embeddingModel ?? '');
  };

  return (
    <section className="panel" aria-label="Usage and embeddings settings">
      <div className="section-heading">
        <h2>Usage &amp; embeddings</h2>
        <span className="muted">Per-key usage via OmniRoute analytics</span>
      </div>
      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
      {usage.length === 0 ? (
        <p className="empty-state">No usage recorded yet.</p>
      ) : (
        <ul className="inventory-list">
          {usage.map((row) => (
            <li key={row.keyName} className="inventory-card provider-summary">
              <div>
                <strong>{row.keyName}</strong>
                <p className="muted">{row.requests} requests &middot; {row.totalTokens} tokens</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="form-stack" aria-label="Embeddings model setting" onSubmit={(event) => {
        event.preventDefault();
        void saveEmbeddings();
      }}>
        <label>
          Embedding model (blank = disabled)
          <input
            type="text"
            value={embeddingDraft}
            autoComplete="off"
            onChange={(event) => setEmbeddingDraft(event.target.value)}
            placeholder="e.g. gemini-embedding-001:free"
          />
        </label>
        <div className="button-row">
          <button type="submit" className="button button-secondary"
            disabled={busyAction === 'embeddings'}>
            {busyAction === 'embeddings' ? 'Saving…' : 'Save embeddings setting'}
          </button>
        </div>
      </form>
    </section>
  );
}
