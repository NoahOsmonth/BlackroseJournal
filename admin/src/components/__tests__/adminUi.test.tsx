import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConflictBanner } from '../ConflictBanner';
import { LoginPage } from '../LoginPage';
import { OmnirouteDisconnectConfirm, OmnirouteProvidersPanel } from '../OmnirouteProvidersPanel';
import { OmnirouteModelsPanel } from '../OmnirouteModelsPanel';

describe('admin UI accessibility and credential safety', () => {
  it('renders an accessible login form', () => {
    const html = renderToStaticMarkup(
      <LoginPage busy={false} error={null} onSubmit={async () => undefined} />,
    );

    expect(html).toContain('<main');
    expect(html).toContain('for="admin-email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('Sign in');
  });

  it('announces stale revisions and provides an explicit reload action', () => {
    const html = renderToStaticMarkup(
      <ConflictBanner
        message="This provider changed in another admin session."
        currentRevision={7}
        onReload={() => undefined}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('revision 7');
    expect(html).toContain('Reload current state');
  });

  it('offers disconnect-only provider actions with a typed confirmation phrase', () => {
    const html = renderToStaticMarkup(
      <OmnirouteProvidersPanel
        providers={[{ id: 'p1', name: 'openrouter', status: 'connected' }]}
        busyAction={null}
        error={null}
        onTest={async () => true}
        onDisconnect={async () => true}
      />,
    );

    expect(html).toContain('status-pill');
    expect(html).toContain('Test');
    expect(html).toContain('Disconnect');
    // Disconnect-only CRUD: no delete affordance is rendered.
    expect(html).not.toMatch(/>Delete</);
  });

  it('requires the exact confirmation before disconnecting a provider', () => {
    const html = renderToStaticMarkup(
      <OmnirouteDisconnectConfirm
        providerName="openrouter"
        busy={false}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(html).toContain('DELETE PROVIDER openrouter');
    expect(html).toContain('type="text"');
    // Confirm stays disabled until the phrase is typed (empty value → disabled).
    expect(html).toContain('disabled');
    expect(html).not.toContain('>Delete<');
  });

  it('publishes only catalog entries not already published', () => {
    const html = renderToStaticMarkup(
      <OmnirouteModelsPanel
        models={[
          { modelId: 'free/a:free', label: 'Free A' },
          { modelId: 'free/b:free', label: 'Free B' },
        ]}
        published={[{ modelId: 'free/a:free', label: 'Free A' }]}
        busyAction={null}
        error={null}
        onUpdatePublished={async () => true}
      />,
    );

    // The publish select only lists unpublished catalog entries.
    expect(html).toContain('Free B');
    expect(html).not.toContain('value="free/a:free"');
    expect(html).toContain('Unpublish');
  });
});
