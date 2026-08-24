#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const RESOURCE_PREFIX = 'blackrose-e2e-';
const REQUIRED_ENV = [
  'CONTROL_PLANE_GATEWAY_URL',
  'CONTROL_PLANE_ADMIN_URL',
  'CONTROL_PLANE_SUPABASE_URL',
  'CONTROL_PLANE_SUPABASE_ANON_KEY',
  'CONTROL_PLANE_ADMIN_EMAIL',
  'CONTROL_PLANE_ADMIN_PASSWORD',
  'CONTROL_PLANE_USER_A_EMAIL',
  'CONTROL_PLANE_USER_A_PASSWORD',
  'CONTROL_PLANE_USER_B_EMAIL',
  'CONTROL_PLANE_USER_B_PASSWORD',
  'CONTROL_PLANE_PROVIDER_BASE_URL',
  'CONTROL_PLANE_PROVIDER_API_KEY',
  'CONTROL_PLANE_PROVIDER_MODEL_ID',
];

function requiredUrl(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  return value.replace(/\/+$/, '');
}

function runIdentifier(now = new Date(), random = Math.random) {
  const timestamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${timestamp}-${Math.floor(random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function buildProbeConfig(env) {
  if (env.CONTROL_PLANE_LIVE !== '1') {
    throw new Error('Live probe disabled. Set CONTROL_PLANE_LIVE=1 to opt in.');
  }
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing live probe environment: ${missing.join(', ')}`);
  }
  if (env.CONTROL_PLANE_ALLOW_CLEAR_TEST_USERS !== '1') {
    throw new Error(
      'Set CONTROL_PLANE_ALLOW_CLEAR_TEST_USERS=1 only for two dedicated disposable test accounts.',
    );
  }
  if (env.CONTROL_PLANE_USER_A_EMAIL === env.CONTROL_PLANE_USER_B_EMAIL) {
    throw new Error('The two memory-isolation users must be different accounts.');
  }
  const runId = env.CONTROL_PLANE_RUN_ID || runIdentifier();
  if (!/^[a-zA-Z0-9-]{6,80}$/.test(runId)) {
    throw new Error('CONTROL_PLANE_RUN_ID must contain only letters, digits, and hyphens.');
  }
  return {
    runId,
    gatewayUrl: requiredUrl(env.CONTROL_PLANE_GATEWAY_URL, 'CONTROL_PLANE_GATEWAY_URL'),
    adminUrl: requiredUrl(env.CONTROL_PLANE_ADMIN_URL, 'CONTROL_PLANE_ADMIN_URL'),
    supabaseUrl: requiredUrl(env.CONTROL_PLANE_SUPABASE_URL, 'CONTROL_PLANE_SUPABASE_URL'),
    supabaseAnonKey: env.CONTROL_PLANE_SUPABASE_ANON_KEY,
    admin: { email: env.CONTROL_PLANE_ADMIN_EMAIL, password: env.CONTROL_PLANE_ADMIN_PASSWORD },
    userA: { email: env.CONTROL_PLANE_USER_A_EMAIL, password: env.CONTROL_PLANE_USER_A_PASSWORD },
    userB: { email: env.CONTROL_PLANE_USER_B_EMAIL, password: env.CONTROL_PLANE_USER_B_PASSWORD },
    provider: {
      baseUrl: requiredUrl(env.CONTROL_PLANE_PROVIDER_BASE_URL, 'CONTROL_PLANE_PROVIDER_BASE_URL'),
      apiKey: env.CONTROL_PLANE_PROVIDER_API_KEY,
      modelId: env.CONTROL_PLANE_PROVIDER_MODEL_ID,
    },
    artifactDir: env.CONTROL_PLANE_ARTIFACT_DIR || path.join(process.cwd(), 'probes', 'artifacts'),
  };
}

function isOwnedResource(value, runId) {
  return value.startsWith(`${RESOURCE_PREFIX}${runId}-`);
}

function collectNormalizedText(body) {
  if (!body || !Array.isArray(body.events)) throw new Error('Managed inference returned no events.');
  const error = body.events.find((event) => event && event.type === 'error');
  if (error) {
    throw new Error(`${error.error?.code || 'inference_error'}: ${error.error?.message || 'failed'}`);
  }
  const completion = body.events.find((event) => event && event.type === 'completion');
  if (completion && ['error', 'cancelled'].includes(completion.reason)) {
    throw new Error(`Managed inference terminated with ${completion.reason}.`);
  }
  const text = body.events
    .filter((event) => event && event.type === 'text_delta' && typeof event.text === 'string')
    .map((event) => event.text)
    .join('');
  if (!text.trim()) throw new Error('Managed inference returned empty text.');
  return text;
}

function assertMarkerReply(reply, expected, forbidden) {
  if (!reply.includes(expected)) {
    throw new Error(`Routing proof did not contain expected marker ${expected}.`);
  }
  if (forbidden && reply.includes(forbidden)) {
    throw new Error(`Routing proof contained forbidden marker ${forbidden}.`);
  }
}

function redactEvidence(value, secrets) {
  const usable = secrets.filter((secret) => typeof secret === 'string' && secret.length > 0);
  const redactString = (text) => usable.reduce(
    (safe, secret) => safe.split(secret).join('[REDACTED]'), text,
  );
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactEvidence(item, usable));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactEvidence(item, usable)]),
    );
  }
  return value;
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const safeMessage = typeof body === 'string'
      ? body.slice(0, 300)
      : body?.error?.message || body?.message || response.statusText;
    throw new Error(`${options.label || 'request'} failed (${response.status}): ${safeMessage}`);
  }
  return body;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function signIn(config, credentials) {
  const body = await jsonRequest(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    label: `Supabase sign-in for ${credentials.email}`,
  });
  if (!body?.access_token) throw new Error(`Supabase returned no access token for ${credentials.email}.`);
  return body.access_token;
}

async function gateway(config, token, route, method = 'GET', body) {
  return jsonRequest(`${config.gatewayUrl}${route}`, {
    method,
    headers: authHeaders(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    label: `${method} ${route}`,
  });
}

async function startCatalogRevisionObserver(config, accessToken) {
  const client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  client.realtime.setAuth(accessToken);
  const revisions = [];
  const channel = client.channel(`control-plane-live-${config.runId}`).on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'ai_catalog_revision' },
    (payload) => {
      const revision = payload?.new?.revision;
      if (Number.isInteger(revision)) revisions.push(revision);
    },
  );
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Authenticated Realtime subscription timed out.')), 15_000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        clearTimeout(timer);
        reject(new Error(`Authenticated Realtime subscription failed: ${status}.`));
      }
    });
  });
  return {
    revisions,
    stop: async () => {
      await client.removeChannel(channel);
    },
  };
}

async function waitForRevision(observer, revision, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (observer.revisions.includes(revision)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Expected authenticated catalog revision ${revision}; received ${observer.revisions.join(', ') || 'none'}.`,
  );
}

async function performAdminRequest(page, routeFragment, action, timeoutMs = 120_000) {
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => (
      candidate.url().includes(routeFragment) && candidate.request().method() !== 'OPTIONS'
    ), { timeout: timeoutMs }),
    action(),
  ]);
  if (!response.ok()) {
    throw new Error(`Admin request ${routeFragment} failed with ${response.status()}.`);
  }
}

async function runAdminBrowser(config) {
  const providerName = `${RESOURCE_PREFIX}${config.runId}-provider`;
  const publicModelId = `${RESOURCE_PREFIX}${config.runId}-model`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(config.adminUrl, { waitUntil: 'networkidle', timeout: 120_000 });
    await page.getByLabel('Email address').fill(config.admin.email);
    await page.getByLabel('Password').fill(config.admin.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Add provider', exact: true }).waitFor({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Add provider', exact: true }).click();
    await page.getByLabel('Name').fill(providerName);
    await page.getByLabel('Provider base URL').fill(config.provider.baseUrl);
    await page.getByLabel('API key').fill(config.provider.apiKey);
    await performAdminRequest(page, '/v1/admin/providers', () => (
      page.getByRole('button', { name: 'Create provider', exact: true }).click()
    ));
    await page.getByText(providerName, { exact: true }).waitFor({ timeout: 30_000 });

    await performAdminRequest(page, '/discover', () => (
      page.getByRole('button', { name: 'Discover models', exact: true }).click()
    ));
    const row = page.locator('li.inventory-card').filter({
      has: page.getByText(config.provider.modelId, { exact: true }),
    }).first();
    await row.waitFor({ timeout: 120_000 });
    await row.getByLabel('Public label').fill(`${RESOURCE_PREFIX}${config.runId}`);
    await row.getByLabel('Public model id').fill(publicModelId);
    const publishButton = row.getByRole('button', { name: 'Publish for chat', exact: true });
    await performAdminRequest(page, '/publish?', () => publishButton.click());
    const flashButton = row.getByRole('button', { name: 'Assign flash', exact: true });
    await performAdminRequest(page, '/routes/flash', () => flashButton.click());

    await page.getByRole('button', { name: 'Catalog', exact: true }).click();
    const catalogRow = page.locator('tr').filter({ hasText: publicModelId });
    await catalogRow.waitFor({ timeout: 30_000 });
    return { browser, page, providerName, publicModelId, catalogRow };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function setPreference(config, token, modelId) {
  const current = await gateway(config, token, '/v1/ai/preferences/model');
  return gateway(config, token, '/v1/ai/preferences/model', 'PUT', {
    modelId,
    expectedRevision: current.revision,
  });
}

async function managedCompletion(config, token, purpose, prompt, systemInstruction) {
  const body = await gateway(config, token, '/v1/ai/chat/completions', 'POST', {
    purpose,
    messages: [{ role: 'user', content: prompt }],
    ...(systemInstruction ? { systemInstruction } : {}),
    temperature: 0,
    maxOutputTokens: 80,
    stream: false,
  });
  return collectNormalizedText(body);
}

async function directCompletion(config) {
  const endpoint = `${config.provider.baseUrl}/chat/completions`;
  const body = await jsonRequest(endpoint, {
    method: 'POST',
    headers: authHeaders(config.provider.apiKey),
    body: JSON.stringify({
      model: config.provider.modelId,
      messages: [{ role: 'user', content: `Reply briefly with BYOK-${config.runId}.` }],
      temperature: 0,
      max_tokens: 80,
      stream: false,
    }),
    label: 'direct BYOK provider request',
  });
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Direct BYOK response was empty.');
  return { endpointHost: new URL(endpoint).host, text };
}

async function clearMemory(config, token) {
  await gateway(config, token, '/v1/memory', 'DELETE');
}

async function retain(config, token, documentId, content) {
  return gateway(config, token, '/v1/memory/retain', 'POST', {
    documentId,
    content,
    createdAt: new Date().toISOString(),
    metadata: { source: 'journal', sourceId: documentId, completed: true },
  });
}

async function recallUntil(config, token, query, expected, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let body;
  while (Date.now() < deadline) {
    body = await gateway(config, token, '/v1/memory/recall', 'POST', { query, limit: 10 });
    if (body?.results?.some((item) => item.content?.includes(expected))) return body;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Memory recall did not return owned marker ${expected}. Last body: ${JSON.stringify(body)}`);
}

async function proveMemoryIsolation(config, tokenA, tokenB) {
  const markerA = `${RESOURCE_PREFIX}${config.runId}-user-a-orchid`;
  const markerB = `${RESOURCE_PREFIX}${config.runId}-user-b-cobalt`;
  const common = `${RESOURCE_PREFIX}${config.runId}-memory-isolation`;
  await Promise.all([clearMemory(config, tokenA), clearMemory(config, tokenB)]);
  await retain(config, tokenA, `${common}-a`, `${common}. Private marker: ${markerA}.`);
  await retain(config, tokenB, `${common}-b`, `${common}. Private marker: ${markerB}.`);
  const [recallA, recallB] = await Promise.all([
    recallUntil(config, tokenA, common, markerA),
    recallUntil(config, tokenB, common, markerB),
  ]);
  const textA = JSON.stringify(recallA);
  const textB = JSON.stringify(recallB);
  if (textA.includes(markerB) || textB.includes(markerA)) {
    throw new Error('Cross-user Hindsight memory leakage detected.');
  }
  return { markerA, markerB, recallA, recallB };
}

async function proveMemoryConditionedChat(config, tokenA, tokenB, memory) {
  const contextA = `## Relevant long-term context\n${JSON.stringify(memory.recallA.results)}`;
  const contextB = `## Relevant long-term context\n${JSON.stringify(memory.recallB.results)}`;
  const [replyA, replyB] = await Promise.all([
    managedCompletion(
      config,
      tokenA,
      'chat',
      'According to the relevant long-term context, reply with exactly my private marker.',
      contextA,
    ),
    managedCompletion(
      config,
      tokenB,
      'chat',
      'According to the relevant long-term context, reply with exactly my private marker.',
      contextB,
    ),
  ]);
  assertMarkerReply(replyA, memory.markerA, memory.markerB);
  assertMarkerReply(replyB, memory.markerB, memory.markerA);
  return { userA: replyA, userB: replyB };
}

async function withdrawCatalogViaAdmin(config, adminRun) {
  if (!isOwnedResource(adminRun.publicModelId, config.runId)
    || !isOwnedResource(adminRun.providerName, config.runId)) {
    throw new Error('Refusing to clean a resource not owned by this probe run.');
  }
  await performAdminRequest(adminRun.page, '/v1/admin/catalog/', () => (
    adminRun.catalogRow.getByRole('button', { name: 'Archive', exact: true }).click()
  ));
  await Promise.race([
    adminRun.catalogRow.waitFor({ state: 'hidden', timeout: 30_000 }),
    adminRun.catalogRow.getByText('archived', { exact: true }).waitFor({ timeout: 30_000 }),
  ]);
}

async function archiveOwnedProvider(config, token, providerName) {
  if (!isOwnedResource(providerName, config.runId)) {
    throw new Error('Refusing to archive a provider not owned by this probe run.');
  }
  const listed = await gateway(config, token, '/v1/admin/providers');
  const provider = listed.providers?.find((item) => item.name === providerName);
  if (!provider) throw new Error('Owned provider was not found for cleanup.');
  await gateway(config, token, `/v1/admin/providers/${provider.id}/archive`, 'POST', {
    expectedRevision: provider.revision,
  });
}

async function cleanupOwnedAdminApi(config, token, providerName, publicModelId) {
  if (!isOwnedResource(publicModelId, config.runId)
    || !isOwnedResource(providerName, config.runId)) return;
  const catalog = await gateway(config, token, '/v1/ai/catalog').catch(() => ({ models: [] }));
  const catalogModel = catalog.models?.find((item) => item.publicModelId === publicModelId);
  if (catalogModel) {
    await gateway(config, token, `/v1/admin/catalog/${catalogModel.id}/archive`, 'POST', {
      expectedRevision: catalogModel.revision,
    }).catch(() => undefined);
  }
  const listed = await gateway(config, token, '/v1/admin/providers').catch(() => ({ providers: [] }));
  const provider = listed.providers?.find((item) => item.name === providerName);
  if (provider && provider.state !== 'archived') {
    await gateway(config, token, `/v1/admin/providers/${provider.id}/archive`, 'POST', {
      expectedRevision: provider.revision,
    }).catch(() => undefined);
  }
}

async function runLiveProbe(config) {
  const secrets = [
    config.supabaseAnonKey, config.admin.password, config.userA.password,
    config.userB.password, config.provider.apiKey,
  ];
  const [adminToken, tokenA, tokenB] = await Promise.all([
    signIn(config, config.admin), signIn(config, config.userA), signIn(config, config.userB),
  ]);
  secrets.push(adminToken, tokenA, tokenB);
  let adminRun;
  let realtimeObserver;
  let memoryCleared = false;
  let adminCleaned = false;
  let resourcesMayExist = false;
  const providerName = `${RESOURCE_PREFIX}${config.runId}-provider`;
  const publicModelId = `${RESOURCE_PREFIX}${config.runId}-model`;
  try {
    realtimeObserver = await startCatalogRevisionObserver(config, tokenA);
    const initialCatalog = await gateway(config, tokenA, '/v1/ai/catalog');
    const initialProviders = await gateway(config, adminToken, '/v1/admin/providers');
    if (initialProviders.providers?.some((item) => item.name === providerName)
      || initialCatalog.models?.some((item) => item.publicModelId === publicModelId)) {
      throw new Error(`Run id ${config.runId} is not unique in this control plane.`);
    }
    resourcesMayExist = true;
    adminRun = await runAdminBrowser(config);
    const catalog = await gateway(config, tokenA, '/v1/ai/catalog');
    if (catalog.revision !== initialCatalog.revision + 1) {
      throw new Error(
        'Publishing did not produce one attributable catalog revision; retry without concurrent mutations.',
      );
    }
    await waitForRevision(realtimeObserver, catalog.revision);
    const model = catalog.models?.find((item) => item.publicModelId === adminRun.publicModelId);
    if (!model) throw new Error('Published model did not appear in the authenticated catalog.');
    await Promise.all([
      setPreference(config, tokenA, model.id),
      setPreference(config, tokenB, model.id),
    ]);
    const managedChat = await managedCompletion(
      config, tokenA, 'chat', `Reply briefly with MANAGED-${config.runId}.`,
    );
    assertMarkerReply(managedChat, `MANAGED-${config.runId}`);
    const managedFlash = await managedCompletion(
      config, tokenA, 'flash', `Reply briefly with FLASH-${config.runId}.`,
    );
    assertMarkerReply(managedFlash, `FLASH-${config.runId}`);
    const byokDirect = await directCompletion(config);
    assertMarkerReply(byokDirect.text, `BYOK-${config.runId}`);
    const memory = await proveMemoryIsolation(config, tokenA, tokenB);
    const memoryConditionedChat = await proveMemoryConditionedChat(
      config, tokenA, tokenB, memory,
    );
    await withdrawCatalogViaAdmin(config, adminRun);
    const withdrawnCatalog = await gateway(config, tokenA, '/v1/ai/catalog');
    if (withdrawnCatalog.models?.some((item) => item.publicModelId === publicModelId)) {
      throw new Error('Withdrawing the owned model left it in the authenticated catalog.');
    }
    if (withdrawnCatalog.revision !== catalog.revision + 1) {
      throw new Error(
        'Withdrawal did not produce one attributable catalog revision; retry without concurrent mutations.',
      );
    }
    await waitForRevision(realtimeObserver, withdrawnCatalog.revision);
    await archiveOwnedProvider(config, adminToken, adminRun.providerName);
    adminCleaned = true;
    const evidence = redactEvidence({
      runId: config.runId,
      generatedAt: new Date().toISOString(),
      routes: {
        managedGatewayHost: new URL(config.gatewayUrl).host,
        byokDirectProviderHost: byokDirect.endpointHost,
      },
      admin: { providerName: adminRun.providerName, publicModelId: adminRun.publicModelId },
      verbatimAssistantReplies: { managedChat, managedFlash, byokDirect: byokDirect.text },
      verbatimMemoryRecall: { userA: memory.recallA, userB: memory.recallB },
      verbatimMemoryConditionedManagedRepliesUsingHarnessInjectedRecall: memoryConditionedChat,
      isolationMarkers: { userA: memory.markerA, userB: memory.markerB },
      authenticatedCatalogRevisionEvents: realtimeObserver.revisions,
    }, secrets);
    fs.mkdirSync(config.artifactDir, { recursive: true });
    const artifact = path.join(config.artifactDir, `control-plane-${config.runId}.json`);
    fs.writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    console.log(`Verbatim evidence written to ${artifact}`);
    console.log(JSON.stringify(evidence.verbatimAssistantReplies, null, 2));
    await Promise.all([clearMemory(config, tokenA), clearMemory(config, tokenB)]);
    memoryCleared = true;
    await adminRun.browser.close();
    return evidence;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redactEvidence(message, secrets));
  } finally {
    if (!memoryCleared) {
      await Promise.allSettled([clearMemory(config, tokenA), clearMemory(config, tokenB)]);
    }
    if (resourcesMayExist && !adminCleaned) {
      await cleanupOwnedAdminApi(config, adminToken, providerName, publicModelId);
    }
    if (realtimeObserver) await realtimeObserver.stop().catch(() => undefined);
    if (adminRun) await adminRun.browser.close().catch(() => undefined);
  }
}

async function main() {
  if (process.env.CONTROL_PLANE_LIVE !== '1') {
    console.log('SKIP live control-plane probe: set CONTROL_PLANE_LIVE=1 and the documented credentials.');
    return;
  }
  const config = buildProbeConfig(process.env);
  await runLiveProbe(config);
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = redactEvidence(message, [
      process.env.CONTROL_PLANE_SUPABASE_ANON_KEY,
      process.env.CONTROL_PLANE_ADMIN_PASSWORD,
      process.env.CONTROL_PLANE_USER_A_PASSWORD,
      process.env.CONTROL_PLANE_USER_B_PASSWORD,
      process.env.CONTROL_PLANE_PROVIDER_API_KEY,
    ]);
    console.error(`LIVE PROBE FAILED: ${safeMessage}`);
    process.exitCode = 1;
  });
}

module.exports = {
  assertMarkerReply,
  buildProbeConfig,
  collectNormalizedText,
  isOwnedResource,
  redactEvidence,
  runLiveProbe,
};
