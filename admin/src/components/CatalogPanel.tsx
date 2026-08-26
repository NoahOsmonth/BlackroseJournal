import React from 'react';
import type { CatalogResponse } from '../services/adminTypes';

interface CatalogPanelProps {
  catalog: CatalogResponse;
  onArchive: (id: string, revision: number) => Promise<void>;
}

export function CatalogPanel({ catalog, onArchive }: CatalogPanelProps) {
  return (
    <section className="panel" aria-labelledby="catalog-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Realtime revision {catalog.revision}</p>
          <h2 id="catalog-title">Managed chat catalog</h2>
        </div>
        <span className="status-pill">{catalog.models.length} published</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Model</th><th>Availability</th><th>Context</th><th>Order</th><th>Action</th></tr></thead>
          <tbody>
            {catalog.models.map((model) => (
              <tr key={model.id}>
                <td><strong>{model.label}</strong><br /><code>{model.publicModelId}</code></td>
                <td><span className={`status-pill status-${model.availability}`}>
                  {model.availability}
                </span></td>
                <td>{model.contextWindow.toLocaleString()}</td>
                <td>{model.sortOrder}</td>
                <td><button className="button button-danger" type="button"
                  onClick={() => void onArchive(model.id, model.revision)}>Archive</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {catalog.models.length === 0 ? <p className="empty-state">No managed models are published.</p> : null}
    </section>
  );
}
