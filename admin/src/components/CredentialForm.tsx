import React, { useState, type FormEvent } from 'react';
import type { ProviderCredentialInput } from '../services/adminTypes';

interface CredentialMetadata {
  label?: string;
  lastFour?: string;
  keyVersion: number;
  updatedAt: string;
}

interface CredentialFormProps {
  credentialMetadata?: CredentialMetadata;
  busy: boolean;
  onSubmit: (credential: ProviderCredentialInput) => Promise<boolean | void>;
}

export function CredentialForm({ credentialMetadata, busy, onSubmit }: CredentialFormProps) {
  const [secret, setSecret] = useState('');
  const [label, setLabel] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const replacement = { secret, ...(label.trim() ? { label: label.trim() } : {}) };
    void onSubmit(replacement).then((saved) => {
      if (saved === false) return;
      setSecret(''); setLabel('');
    });
  };

  return (
    <section className="panel" aria-labelledby="credential-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gateway-owned secret</p>
          <h2 id="credential-title">Provider credential</h2>
        </div>
        {credentialMetadata ? (
          <span className="status-pill">
            •••• {credentialMetadata.lastFour ?? 'saved'}
          </span>
        ) : <span className="status-pill status-warning">Not configured</span>}
      </div>
      <p className="muted">
        Saved credentials cannot be read back. Enter a new value only when replacing it.
      </p>
      <form className="form-grid" onSubmit={submit}>
        <div>
          <label htmlFor="credential-label">Credential label</label>
          <input
            id="credential-label"
            value={label}
            placeholder={credentialMetadata?.label ?? 'Production'}
            onChange={(event) => setLabel(event.currentTarget.value)}
          />
        </div>
        <div>
          <label htmlFor="credential-secret">Replacement API key</label>
          <input
            id="credential-secret"
            type="password"
            autoComplete="new-password"
            value={secret}
            required
            onChange={(event) => setSecret(event.currentTarget.value)}
          />
        </div>
        <button className="button button-secondary" disabled={busy || !secret} type="submit">
          Replace credential
        </button>
      </form>
    </section>
  );
}
