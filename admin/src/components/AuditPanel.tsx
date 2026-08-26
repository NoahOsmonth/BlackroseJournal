import React from 'react';
import type { AuditEvent } from '../services/adminTypes';

export function AuditPanel({ events }: { events: AuditEvent[] }) {
  return (
    <section className="panel" aria-labelledby="audit-title">
      <div className="section-heading">
        <div><p className="eyebrow">Safe metadata only</p><h2 id="audit-title">Audit trail</h2></div>
        <span className="status-pill">Latest {events.length}</span>
      </div>
      <ol className="audit-list">
        {events.map((event) => (
          <li key={event.id}>
            <div><strong>{event.action}</strong><p>{event.resourceType}{event.resourceId ? ` · ${event.resourceId}` : ''}</p></div>
            <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
          </li>
        ))}
      </ol>
      {events.length === 0 ? <p className="empty-state">No administrative changes recorded.</p> : null}
    </section>
  );
}
