/* eslint-disable @typescript-eslint/no-require-imports */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const {
  assertMarkerReply,
  buildProbeConfig,
  collectNormalizedText,
  isOwnedResource,
  redactEvidence,
} = require('../../scripts/control-plane/live-probe.js') as {
  assertMarkerReply: (reply: string, expected: string, forbidden?: string) => void;
  buildProbeConfig: (env: NodeJS.ProcessEnv) => Record<string, unknown>;
  collectNormalizedText: (body: unknown) => string;
  isOwnedResource: (value: string, runId: string) => boolean;
  redactEvidence: (value: unknown, secrets: string[]) => unknown;
};

const completeEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  CONTROL_PLANE_LIVE: '1',
  CONTROL_PLANE_ALLOW_CLEAR_TEST_USERS: '1',
  CONTROL_PLANE_GATEWAY_URL: 'http://127.0.0.1:8787',
  CONTROL_PLANE_ADMIN_URL: 'http://127.0.0.1:8081',
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

describe('control-plane live probe safety', () => {
  it('fails fast unless the live opt-in is explicit', () => {
    const env = completeEnv();
    delete env.CONTROL_PLANE_LIVE;
    expect(() => buildProbeConfig(env)).toThrow(/CONTROL_PLANE_LIVE=1/);
  });

  it('lists every missing live dependency in one actionable error', () => {
    expect(() => buildProbeConfig({ NODE_ENV: 'test', CONTROL_PLANE_LIVE: '1' })).toThrow(
      /CONTROL_PLANE_GATEWAY_URL.*CONTROL_PLANE_ADMIN_URL.*CONTROL_PLANE_SUPABASE_URL/s,
    );
  });

  it('refuses destructive memory clearing without dedicated test-user approval', () => {
    const env = completeEnv();
    delete env.CONTROL_PLANE_ALLOW_CLEAR_TEST_USERS;
    expect(() => buildProbeConfig(env)).toThrow(/ALLOW_CLEAR_TEST_USERS=1/);
  });

  it('recognizes only resources owned by the current unique run', () => {
    expect(isOwnedResource('blackrose-e2e-run-123-provider', 'run-123')).toBe(true);
    expect(isOwnedResource('blackrose-e2e-run-12-provider', 'run-123')).toBe(false);
    expect(isOwnedResource('production-provider', 'run-123')).toBe(false);
  });

  it('collects verbatim text from normalized non-stream events', () => {
    expect(collectNormalizedText({
      events: [
        { type: 'text_delta', text: 'first ' },
        { type: 'usage', inputTokens: 2, outputTokens: 2, totalTokens: 4 },
        { type: 'text_delta', text: 'reply' },
        { type: 'completion', reason: 'stop' },
      ],
    })).toBe('first reply');
  });

  it('rejects normalized inference errors instead of accepting partial text', () => {
    expect(() => collectNormalizedText({
      events: [
        { type: 'text_delta', text: 'partial' },
        { type: 'error', error: { code: 'upstream_error', message: 'failed' } },
        { type: 'completion', reason: 'error' },
      ],
    })).toThrow(/upstream_error.*failed/);
  });

  it('requires each routing proof to echo its unique marker', () => {
    expect(() => assertMarkerReply('generic reply', 'MANAGED-run-123')).toThrow(
      /MANAGED-run-123/,
    );
    expect(() => assertMarkerReply(
      'blackrose-e2e-run-123-user-a-orchid and blackrose-e2e-run-123-user-b-cobalt',
      'blackrose-e2e-run-123-user-a-orchid',
      'blackrose-e2e-run-123-user-b-cobalt',
    )).toThrow(/forbidden/);
    expect(() => assertMarkerReply('reply MANAGED-run-123', 'MANAGED-run-123')).not.toThrow();
  });

  it('redacts credentials recursively before writing evidence', () => {
    expect(redactEvidence({
      authorization: 'Bearer access-token',
      nested: { text: 'provider-secret appeared' },
    }, ['access-token', 'provider-secret'])).toEqual({
      authorization: 'Bearer [REDACTED]',
      nested: { text: '[REDACTED] appeared' },
    });
  });

  it('skips without network access when the explicit live gate is absent', () => {
    const result = spawnSync(process.execPath, ['scripts/control-plane/live-probe.js'], {
      cwd: process.cwd(),
      env: { NODE_ENV: 'test' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('SKIP live control-plane probe');
  });

  it('never sends a client-selected Hindsight bank', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'scripts/control-plane/live-probe.js'),
      'utf8',
    );
    expect(source).not.toMatch(/["']bank["']\s*:/);
    expect(source).not.toMatch(/[?&]bank=/);
  });
});
