#!/usr/bin/env node
// Usage: OMNIROUTE_MANAGE_KEY=... [OMNIROUTE_BASE_URL=...] node scripts/control-plane/omniroute-live-probe.js
// Verifies LIVE OmniRoute contract against the running gateway. FREE MODELS ONLY.
// Loopback-only target expected in local dev (e.g. http://127.0.0.1:20128).
'use strict';

const BASE = process.env['OMNIROUTE_BASE_URL'] || 'http://100.107.7.52:20128';
const KEY = process.env['OMNIROUTE_MANAGE_KEY'];
if (!KEY) {
  console.error('OMNIROUTE_MANAGE_KEY required');
  process.exit(1);
}
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function j(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: H });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
  return body;
}

(async () => {
  const providers = await j('/api/providers');
  console.log('providers OK:', Array.isArray(providers) ? providers.length : typeof providers);

  await j('/api/models');
  console.log('models catalog OK');

  // FREE-model chat completion through the gateway
  const chat = await j('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: process.env.PROBE_FREE_MODEL || 'ds-web/deepseek-v4-flash',
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 10,
    }),
  });
  console.log('chat OK:', chat?.choices?.[0]?.message?.content?.slice(0, 20));

  // temp key lifecycle
  const created = await j('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'brj-probe-temp' }) });
  console.log('temp key created:', Boolean(created?.key));
  await j(`/api/keys/${created.id}`, { method: 'DELETE' });
  console.log('temp key revoked — ALL PROBES PASS');
})().catch((e) => {
  console.error('PROBE FAIL:', e.message);
  process.exit(1);
});
