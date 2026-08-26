import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConflictBanner } from '../ConflictBanner';
import { CredentialForm } from '../CredentialForm';
import { LoginPage } from '../LoginPage';

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

  it('shows only masked credential metadata and leaves replacement plaintext blank', () => {
    const html = renderToStaticMarkup(
      <CredentialForm
        credentialMetadata={{
          label: 'production',
          lastFour: '7890',
          keyVersion: 2,
          updatedAt: '2026-08-24T00:00:00.000Z',
        }}
        busy={false}
        onSubmit={async () => undefined}
      />,
    );

    expect(html).toContain('•••• 7890');
    expect(html).toContain('value=""');
    expect(html).not.toContain('sk-super-secret');
    expect(html).toContain('autoComplete="new-password"');
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
});
