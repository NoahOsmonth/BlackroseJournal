import React, { useEffect, useState, type FormEvent } from 'react';
import type { RuntimeSettings, UpdateRuntimeSettingsRequest } from '../services/adminTypes';

interface RuntimePanelProps {
  runtime: RuntimeSettings | null;
  busy: boolean;
  onSave: (input: UpdateRuntimeSettingsRequest) => Promise<void>;
}

export function RuntimePanel({ runtime, busy, onSave }: RuntimePanelProps) {
  const [maxInputBytes, setMaxInputBytes] = useState(262144);
  const [maxOutputTokens, setMaxOutputTokens] = useState(4096);
  const [requestTimeoutMs, setRequestTimeoutMs] = useState(120000);

  useEffect(() => {
    if (!runtime) return;
    setMaxInputBytes(runtime.maxInputBytes);
    setMaxOutputTokens(runtime.maxOutputTokens);
    setRequestTimeoutMs(runtime.requestTimeoutMs);
  }, [runtime]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!runtime?.activeFlashRouteId) return;
    void onSave({
      expectedRevision: runtime.revision,
      flashRouteId: runtime.activeFlashRouteId,
      maxInputBytes,
      maxOutputTokens,
      requestTimeoutMs,
    });
  };

  return (
    <section className="panel" aria-labelledby="runtime-title">
      <div className="section-heading">
        <div><p className="eyebrow">Hidden extraction route</p><h2 id="runtime-title">Runtime ceilings</h2></div>
        <span className="status-pill">Revision {runtime?.revision ?? '—'}</span>
      </div>
      <p className="muted">Active flash route: <code>{runtime?.activeFlashRouteId ?? 'Not assigned'}</code></p>
      <form className="form-grid" onSubmit={submit}>
        <label>Maximum input bytes<input type="number" min="1" value={maxInputBytes}
          onChange={(event) => setMaxInputBytes(Number(event.currentTarget.value))} /></label>
        <label>Maximum output tokens<input type="number" min="1" value={maxOutputTokens}
          onChange={(event) => setMaxOutputTokens(Number(event.currentTarget.value))} /></label>
        <label>Request timeout (ms)<input type="number" min="1" value={requestTimeoutMs}
          onChange={(event) => setRequestTimeoutMs(Number(event.currentTarget.value))} /></label>
        <button className="button button-primary" type="submit"
          disabled={busy || !runtime?.activeFlashRouteId}>Save ceilings</button>
      </form>
    </section>
  );
}
