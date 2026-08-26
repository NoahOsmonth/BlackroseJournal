import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OmnirouteKeysPanel } from '../OmnirouteKeysPanel';
import { OmnirouteUsagePanel } from '../OmnirouteUsagePanel';

const key = {
  userId: 'u1',
  omnirouteKeyId: 'k1',
  maskedKey: 'sk-1••••7890',
  allowedModels: ['a:free'],
  revokedAt: null,
};

describe('omniroute keys/usage panels (Task 7) — accessibility and credential safety', () => {
  it('renders the masked key and never a full secret', () => {
    const html = renderToStaticMarkup(
      <OmnirouteKeysPanel
        keys={[key]} busyAction={null} error={null}
        onLookup={async () => true} onRevoke={async () => true}
        onUpdateAllowedModels={async () => true}
      />,
    );
    expect(html).toContain('sk-1••••7890');
    expect(html).toContain('aria-label="Per-user model keys"');
    expect(html).not.toContain('secret-full-value');
  });

  it('renders an accessible allowed-models editor prefilled from the key', () => {
    const html = renderToStaticMarkup(
      <OmnirouteKeysPanel
        keys={[key]} busyAction={null} error={null}
        onLookup={async () => true} onRevoke={async () => true}
        onUpdateAllowedModels={async () => true}
      />,
    );
    expect(html).toContain('Allowed models');
    expect(html).toContain('a:free');
  });

  it('shows an error notice when provided', () => {
    const html = renderToStaticMarkup(
      <OmnirouteKeysPanel
        keys={[]} busyAction={null} error="No active key found for nobody."
        onLookup={async () => true} onRevoke={async () => true}
        onUpdateAllowedModels={async () => true}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('No active key found for nobody.');
  });

  it('lists usage rows with token counts', () => {
    const html = renderToStaticMarkup(
      <OmnirouteUsagePanel
        usage={[{ keyName: 'brj-u1', requests: 5, totalTokens: 120 }]}
        embeddings={{ embeddingModel: null }}
        busyAction={null} error={null}
        onSetEmbeddingsModel={async () => true}
      />,
    );
    expect(html).toContain('brj-u1');
    expect(html).toContain('120 tokens');
  });

  it('renders an empty state without usage', () => {
    const html = renderToStaticMarkup(
      <OmnirouteUsagePanel
        usage={[]}
        embeddings={{ embeddingModel: 'e:free' }}
        busyAction={null} error={null}
        onSetEmbeddingsModel={async () => true}
      />,
    );
    expect(html).toContain('No usage recorded yet.');
  });

  it('prefills the embedding model input from settings', () => {
    const html = renderToStaticMarkup(
      <OmnirouteUsagePanel
        usage={[]}
        embeddings={{ embeddingModel: 'e:free' }}
        busyAction={null} error={null}
        onSetEmbeddingsModel={async () => true}
      />,
    );
    expect(html).toContain('value="e:free"');
  });
});
