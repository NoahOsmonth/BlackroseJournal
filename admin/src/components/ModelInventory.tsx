import React, { useState, type FormEvent } from 'react';
import type {
  FlashRouteInput,
  ModelCapabilities,
  ProviderModelRecord,
  PublishCatalogModelRequest,
  RuntimeSettings,
} from '../services/adminTypes';

interface ModelInventoryProps {
  models: ProviderModelRecord[];
  runtime: RuntimeSettings | null;
  busyAction: string | null;
  onDiscover: () => Promise<void>;
  onPublish: (
    model: ProviderModelRecord,
    input: Omit<PublishCatalogModelRequest, 'providerModelId' | 'expectedRevision' | 'purpose'>,
  ) => Promise<void>;
  onArchive: (model: ProviderModelRecord) => Promise<void>;
  onAssignFlash: (model: ProviderModelRecord, input: FlashRouteInput) => Promise<void>;
}

function booleanCapability(model: ProviderModelRecord, key: keyof ModelCapabilities): boolean {
  return model.capabilities[key] === true;
}

function InventoryRow({ model, runtime, busyAction, onPublish, onArchive, onAssignFlash }:
  Omit<ModelInventoryProps, 'models' | 'onDiscover'> & { model: ProviderModelRecord }) {
  const [label, setLabel] = useState(model.label);
  const [publicModelId, setPublicModelId] = useState(model.upstreamModelId);
  const [contextWindow, setContextWindow] = useState(model.contextWindow ?? 32768);
  const [sortOrder, setSortOrder] = useState(100);

  const publish = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onPublish(model, {
      label,
      publicModelId,
      contextWindow,
      sortOrder,
      capabilities: {
        streaming: booleanCapability(model, 'streaming'),
        tools: booleanCapability(model, 'tools'),
        vision: booleanCapability(model, 'vision'),
        jsonObject: booleanCapability(model, 'jsonObject'),
        jsonSchema: booleanCapability(model, 'jsonSchema'),
      },
    });
  };

  const assignFlash = () => {
    const ceilings = runtime ?? {
      maxInputBytes: 262144, maxOutputTokens: 4096, requestTimeoutMs: 120000,
    };
    void onAssignFlash(model, {
      expectedModelRevision: model.revision,
      maxInputBytes: ceilings.maxInputBytes,
      maxOutputTokens: ceilings.maxOutputTokens,
      requestTimeoutMs: ceilings.requestTimeoutMs,
    });
  };

  return (
    <li className="inventory-card">
      <div className="section-heading compact">
        <div>
          <h3>{model.label}</h3>
          <code>{model.upstreamModelId}</code>
        </div>
        <span className={`status-pill state-${model.state}`}>{model.state}</span>
      </div>
      <form className="inline-publish-form" onSubmit={publish}>
        <label>Public label<input value={label}
          onChange={(event) => setLabel(event.currentTarget.value)} /></label>
        <label>Public model id<input value={publicModelId}
          onChange={(event) => setPublicModelId(event.currentTarget.value)} /></label>
        <label>Context window<input type="number" min="1" value={contextWindow}
          onChange={(event) => setContextWindow(Number(event.currentTarget.value))} /></label>
        <label>Sort order<input type="number" min="0" value={sortOrder}
          onChange={(event) => setSortOrder(Number(event.currentTarget.value))} /></label>
        <div className="button-row">
          <button className="button button-primary" type="submit"
            disabled={busyAction === `publish-${model.id}` || model.state === 'archived'}>
            Publish for chat
          </button>
          <button className="button button-secondary" type="button" onClick={assignFlash}
            disabled={busyAction === `flash-${model.id}` || model.state === 'archived'}>
            Assign flash
          </button>
          <button className="button button-danger" type="button"
            disabled={model.state === 'archived'} onClick={() => void onArchive(model)}>
            Archive inventory
          </button>
        </div>
      </form>
    </li>
  );
}

export function ModelInventory(props: ModelInventoryProps) {
  return (
    <section className="panel" aria-labelledby="inventory-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Fetch, inspect, select</p>
          <h2 id="inventory-title">Discovery inventory</h2>
        </div>
        <button className="button button-secondary" type="button"
          disabled={props.busyAction === 'discover'} onClick={() => void props.onDiscover()}>
          {props.busyAction === 'discover' ? 'Discovering…' : 'Discover models'}
        </button>
      </div>
      {props.models.length === 0 ? (
        <p className="empty-state">Run discovery to inspect upstream models.</p>
      ) : (
        <ul className="inventory-list">
          {props.models.map((model) => <InventoryRow key={model.id} {...props} model={model} />)}
        </ul>
      )}
    </section>
  );
}
