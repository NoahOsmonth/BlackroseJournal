import React, { useState } from 'react';
import type {
  OmnirouteModel,
  OmniroutePublishedModel,
} from '../services/omnirouteAdminApi';

interface OmnirouteModelsPanelProps {
  models: OmnirouteModel[];
  published: OmniroutePublishedModel[];
  busyAction: string | null;
  error: string | null;
  onUpdatePublished: (
    upserts: OmniroutePublishedModel[],
    removes: string[],
  ) => Promise<boolean>;
}

/**
 * Task 6 models panel. Free models only — the backend rejects anything
 * without a `:free` suffix, and this form only offers catalog models.
 */
export function OmnirouteModelsPanel({
  models,
  published,
  busyAction,
  error,
  onUpdatePublished,
}: OmnirouteModelsPanelProps) {
  const [selectedModelId, setSelectedModelId] = useState('');
  const [label, setLabel] = useState('');
  const [removals, setRemovals] = useState<Record<string, boolean>>({});

  const publishedIds = new Set(published.map((model) => model.modelId));
  const unpublished = models.filter((model) => !publishedIds.has(model.modelId));
  const markedRemovals = published.filter((model) => removals[model.modelId]).map(
    (model) => model.modelId,
  );

  const publish = async () => {
    if (!selectedModelId) return;
    const done = await onUpdatePublished(
      [{ modelId: selectedModelId, label: label.trim() || selectedModelId }],
      [],
    );
    if (done) {
      setSelectedModelId('');
      setLabel('');
    }
  };

  const applyRemovals = async () => {
    if (markedRemovals.length === 0) return;
    const done = await onUpdatePublished([], markedRemovals);
    if (done) setRemovals({});
  };

  return (
    <section className="panel" aria-label="OmniRoute models">
      <div className="section-heading">
        <h2>Published models</h2>
        <span className="muted">Free models only</span>
      </div>
      {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
      <form
        className="form-grid"
        aria-label="Publish a free model"
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
      >
        <label>
          Catalog model
          <select
            value={selectedModelId}
            onChange={(event) => setSelectedModelId(event.target.value)}
          >
            <option value="">Choose a free model…</option>
            {unpublished.map((model) => (
              <option key={model.modelId} value={model.modelId}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Label
          <input
            type="text"
            value={label}
            autoComplete="off"
            placeholder={selectedModelId || 'Shown to journal users'}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <div className="button-row">
          <button type="submit" className="button button-primary"
            disabled={!selectedModelId || busyAction !== null}>
            Publish model
          </button>
        </div>
      </form>
      {published.length === 0 ? (
        <p className="empty-state">No models are published yet.</p>
      ) : (
        <>
          <ul className="inventory-list">
            {published.map((model) => (
              <li key={model.modelId} className="inventory-card">
                <div className="provider-summary">
                  <div>
                    <strong>{model.label}</strong>
                    <p className="muted">{model.modelId}</p>
                  </div>
                  <label className="state-dot">
                    <input
                      type="checkbox"
                      checked={removals[model.modelId] === true}
                      disabled={busyAction !== null}
                      onChange={(event) => setRemovals((previous) => ({
                        ...previous,
                        [model.modelId]: event.target.checked,
                      }))}
                    />
                    {' '}Unpublish
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button type="button" className="button button-danger"
              disabled={markedRemovals.length === 0 || busyAction !== null}
              onClick={() => void applyRemovals()}>
              {busyAction === 'published-models'
                ? 'Saving…'
                : `Unpublish selected (${markedRemovals.length})`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
