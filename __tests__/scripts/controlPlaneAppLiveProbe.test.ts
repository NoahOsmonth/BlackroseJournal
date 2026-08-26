/* eslint-disable @typescript-eslint/no-require-imports */

const {
  assertObservedAppRoute,
  assertAppRecallEvidence,
  buildAppProbeConfig,
} = require('../../scripts/control-plane/app-live-probe.js') as {
  assertObservedAppRoute: (
    requests: readonly { url: string }[],
    expectedUrl: string,
    forbiddenUrl: string,
  ) => void;
  assertAppRecallEvidence: (evidence: {
    recallRequests: readonly { body: unknown }[];
    managedChatRequests: readonly { body: unknown }[];
    assistantReply: string;
  }, expectedMarker: string, forbiddenMarker: string) => void;
  buildAppProbeConfig: (env: NodeJS.ProcessEnv) => Record<string, unknown>;
};

const validEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  CONTROL_PLANE_APP_LIVE: '1',
  CONTROL_PLANE_LIVE: '1',
  CONTROL_PLANE_ALLOW_CLEAR_TEST_USERS: '1',
  CONTROL_PLANE_GATEWAY_URL: 'http://127.0.0.1:8787',
  CONTROL_PLANE_ADMIN_URL: 'http://127.0.0.1:8081',
  CONTROL_PLANE_APP_URL: 'http://127.0.0.1:19006',
  CONTROL_PLANE_SUPABASE_URL: 'http://127.0.0.1:54321',
  CONTROL_PLANE_SUPABASE_ANON_KEY: 'anon-value',
  CONTROL_PLANE_ADMIN_EMAIL: 'admin+blackrose-e2e@example.test',
  CONTROL_PLANE_ADMIN_PASSWORD: 'admin-password',
  CONTROL_PLANE_USER_A_EMAIL: 'a+blackrose-e2e@example.test',
  CONTROL_PLANE_USER_A_PASSWORD: 'a-password',
  CONTROL_PLANE_USER_B_EMAIL: 'b+blackrose-e2e@example.test',
  CONTROL_PLANE_USER_B_PASSWORD: 'b-password',
  CONTROL_PLANE_PROVIDER_BASE_URL: 'https://provider.example/v1',
  CONTROL_PLANE_PROVIDER_API_KEY: 'provider-secret',
  CONTROL_PLANE_PROVIDER_MODEL_ID: 'model-a',
});

describe('control-plane app live probe safety', () => {
  it('requires an explicit app probe opt-in and app URL', () => {
    const env = validEnv();
    delete env.CONTROL_PLANE_APP_LIVE;
    expect(() => buildAppProbeConfig(env)).toThrow(/CONTROL_PLANE_APP_LIVE=1/);

    delete env.CONTROL_PLANE_APP_LIVE;
    env.CONTROL_PLANE_APP_LIVE = '1';
    delete env.CONTROL_PLANE_APP_URL;
    expect(() => buildAppProbeConfig(env)).toThrow(/CONTROL_PLANE_APP_URL/);
  });

  it('rejects an app URL that is not absolute HTTP(S)', () => {
    const env = validEnv();
    env.CONTROL_PLANE_APP_URL = 'file:///tmp/app';
    expect(() => buildAppProbeConfig(env)).toThrow(/CONTROL_PLANE_APP_URL/);
  });

  it('proves the app used only the requested route', () => {
    expect(() => assertObservedAppRoute(
      [{ url: 'http://127.0.0.1:8787/v1/ai/chat/completions' }],
      'http://127.0.0.1:8787/v1/ai/chat/completions',
      'https://openrouter.ai/api/v1/chat/completions',
    )).not.toThrow();

    expect(() => assertObservedAppRoute(
      [{ url: 'https://openrouter.ai/api/v1/chat/completions' }],
      'http://127.0.0.1:8787/v1/ai/chat/completions',
      'https://openrouter.ai/api/v1/chat/completions',
    )).toThrow(/expected app route/);
  });

  it('requires the app recall request and context in the app chat request', () => {
    expect(() => assertAppRecallEvidence({
      recallRequests: [{ body: { query: 'private marker', limit: 6 } }],
      managedChatRequests: [{ body: {
        messages: [{ role: 'system', content: '## Relevant long-term context\nmarker-a' }],
      } }],
      assistantReply: 'marker-a',
    }, 'marker-a', 'marker-b')).not.toThrow();

    expect(() => assertAppRecallEvidence({
      recallRequests: [],
      managedChatRequests: [],
      assistantReply: 'marker-a',
    }, 'marker-a', 'marker-b')).toThrow(/app Hindsight recall request/);

    expect(() => assertAppRecallEvidence({
      recallRequests: [{ body: { query: 'private marker', bank: 'forbidden' } }],
      managedChatRequests: [{ body: {
        messages: [{ role: 'system', content: '## Relevant long-term context\nmarker-a' }],
      } }],
      assistantReply: 'marker-a',
    }, 'marker-a', 'marker-b')).toThrow(/bank/);
  });
});
