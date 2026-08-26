import React, { useEffect, useState, type FormEvent } from 'react';
import type {
  AdminProvider,
  CreateProviderRequest,
  UpdateProviderRequest,
} from '../services/adminTypes';

interface ProviderFormProps {
  provider: AdminProvider | null;
  busy: boolean;
  onCreate: (input: CreateProviderRequest) => Promise<boolean | void>;
  onUpdate: (id: string, input: UpdateProviderRequest) => Promise<void>;
  onCancelCreate: () => void;
}

const protocols = [
  'openai-chat-completions',
  'openai-responses',
  'anthropic-messages',
  'gemini-generate-content',
] as const;

export function ProviderForm({ provider, busy, onCreate, onUpdate, onCancelCreate }: ProviderFormProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [protocol, setProtocol] = useState<(typeof protocols)[number]>(protocols[0]);
  const [state, setState] = useState<'active' | 'disabled'>('active');
  const [modelsPath, setModelsPath] = useState('/models');
  const [credential, setCredential] = useState('');

  useEffect(() => {
    setName(provider?.name ?? '');
    setBaseUrl(provider?.baseUrl ?? '');
    setProtocol(provider?.protocol ?? protocols[0]);
    setState(provider?.state === 'disabled' ? 'disabled' : 'active');
    setModelsPath(provider?.discoveryConfig?.modelsPath ?? '/models');
    setCredential('');
  }, [provider]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (provider) {
      void onUpdate(provider.id, {
        expectedRevision: provider.revision,
        name,
        baseUrl,
        state,
        discoveryConfig: { modelsPath },
      });
      return;
    }
    void onCreate({
      name,
      baseUrl,
      protocol,
      discoveryConfig: { modelsPath },
      displayMetadata: { label: name },
      credential: { secret: credential },
    }).then((saved) => { if (saved !== false) setCredential(''); });
  };

  return (
    <section className="panel" aria-labelledby="provider-editor-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{provider ? `Revision ${provider.revision}` : 'New integration'}</p>
          <h2 id="provider-editor-title">{provider ? 'Provider settings' : 'Add provider'}</h2>
        </div>
        {!provider ? (
          <button className="button button-quiet" type="button" onClick={onCancelCreate}>Cancel</button>
        ) : null}
      </div>
      <form className="form-grid provider-form" onSubmit={submit}>
        <div>
          <label htmlFor="provider-name">Name</label>
          <input id="provider-name" required value={name}
            onChange={(event) => setName(event.currentTarget.value)} />
        </div>
        <div>
          <label htmlFor="provider-base-url">Provider base URL</label>
          <input id="provider-base-url" type="url" required value={baseUrl}
            placeholder="https://api.example.com/v1"
            onChange={(event) => setBaseUrl(event.currentTarget.value)} />
        </div>
        <div>
          <label htmlFor="provider-protocol">Protocol</label>
          <select id="provider-protocol" disabled={Boolean(provider)} value={protocol}
            onChange={(event) => setProtocol(event.currentTarget.value as typeof protocol)}>
            {protocols.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="provider-models-path">Discovery models path</label>
          <input id="provider-models-path" required value={modelsPath}
            onChange={(event) => setModelsPath(event.currentTarget.value)} />
        </div>
        {provider ? (
          <div>
            <label htmlFor="provider-state">State</label>
            <select id="provider-state" value={state}
              onChange={(event) => setState(event.currentTarget.value as typeof state)}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="provider-create-secret">API key</label>
            <input id="provider-create-secret" type="password" autoComplete="new-password"
              required value={credential}
              onChange={(event) => setCredential(event.currentTarget.value)} />
          </div>
        )}
        <button className="button button-primary" disabled={busy} type="submit">
          {provider ? 'Save provider' : 'Create provider'}
        </button>
      </form>
    </section>
  );
}
