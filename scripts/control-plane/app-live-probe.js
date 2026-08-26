#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const liveProbe = require('./live-probe.js');

const APP_LIVE_ENV = 'CONTROL_PLANE_APP_LIVE';
const APP_URL_ENV = 'CONTROL_PLANE_APP_URL';
const RECALL_CONTEXT_HEADER = '## Relevant long-term context';

function requiredAppUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${APP_URL_ENV} must be an absolute HTTP(S) URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${APP_URL_ENV} must be an absolute HTTP(S) URL.`);
  }
  return value.replace(/\/+$/, '');
}

function buildAppProbeConfig(env) {
  if (env[APP_LIVE_ENV] !== '1') {
    throw new Error(`Live app probe disabled. Set ${APP_LIVE_ENV}=1 to opt in.`);
  }
  if (!env[APP_URL_ENV]) {
    throw new Error(`Missing live app probe environment: ${APP_URL_ENV}`);
  }
  return {
    ...liveProbe.buildProbeConfig(env),
    appUrl: requiredAppUrl(env[APP_URL_ENV]),
  };
}

function parseRequestBody(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function routeMatches(url, expectedUrl) {
  const actual = new URL(url);
  const expected = new URL(expectedUrl);
  return actual.origin === expected.origin && actual.pathname === expected.pathname;
}

function hasKey(value, key) {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([candidate, nested]) => (
    candidate === key || hasKey(nested, key)
  ));
}

function bodyContains(value, needle) {
  return JSON.stringify(value).includes(needle);
}

function assertObservedAppRoute(requests, expectedUrl, forbiddenUrl) {
  if (!requests.some((request) => routeMatches(request.url, expectedUrl))) {
    throw new Error(`The app did not use the expected app route ${expectedUrl}.`);
  }
  if (requests.some((request) => routeMatches(request.url, forbiddenUrl))) {
    throw new Error(`The app used the forbidden route ${forbiddenUrl}.`);
  }
}

function assertAppRecallEvidence(evidence, expectedMarker, forbiddenMarker) {
  if (evidence.recallRequests.length === 0) {
    throw new Error('No app Hindsight recall request was observed for the recall turn.');
  }
  if (evidence.recallRequests.some((request) => hasKey(request.body, 'bank'))) {
    throw new Error('The app Hindsight recall request contained a client-selected bank.');
  }
  if (evidence.managedChatRequests.some((request) => bodyContains(request.body, forbiddenMarker))) {
    throw new Error(`The app managed chat request contained forbidden marker ${forbiddenMarker}.`);
  }
  const contextRequest = evidence.managedChatRequests.find((request) => (
    bodyContains(request.body, RECALL_CONTEXT_HEADER)
    && bodyContains(request.body, expectedMarker)
  ));
  if (!contextRequest) {
    throw new Error('The app managed chat request did not contain the recalled context block.');
  }
  if (!evidence.assistantReply.includes(expectedMarker)) {
    throw new Error(`The app recall reply did not contain expected marker ${expectedMarker}.`);
  }
  if (evidence.assistantReply.includes(forbiddenMarker)) {
    throw new Error(`The app recall reply contained forbidden marker ${forbiddenMarker}.`);
  }
}

function createNetworkObserver(page, config) {
  const record = {
    managedChatRequests: [],
    byokChatRequests: [],
    recallRequests: [],
    recallResponses: [],
  };
  const responseTasks = new Set();
  const gatewayChatUrl = `${config.gatewayUrl}/v1/ai/chat/completions`;
  const providerChatUrl = `${config.provider.baseUrl}/chat/completions`;
  const recallUrl = `${config.gatewayUrl}/v1/memory/recall`;

  const onRequest = (request) => {
    if (request.method() !== 'POST') return;
    const observed = { url: request.url(), body: parseRequestBody(request.postData()) };
    if (routeMatches(observed.url, gatewayChatUrl)) record.managedChatRequests.push(observed);
    if (routeMatches(observed.url, providerChatUrl)) record.byokChatRequests.push(observed);
    if (routeMatches(observed.url, recallUrl)) record.recallRequests.push(observed);
  };
  const onResponse = (response) => {
    if (!routeMatches(response.url(), recallUrl)) return;
    const task = response.json()
      .then((body) => record.recallResponses.push({ url: response.url(), body }))
      .catch(() => undefined)
      .finally(() => responseTasks.delete(task));
    responseTasks.add(task);
  };

  page.on('request', onRequest);
  page.on('response', onResponse);

  return {
    record,
    reset() {
      record.managedChatRequests.length = 0;
      record.byokChatRequests.length = 0;
      record.recallRequests.length = 0;
      record.recallResponses.length = 0;
    },
    async flush() {
      await Promise.allSettled([...responseTasks]);
    },
    stop() {
      page.off('request', onRequest);
      page.off('response', onResponse);
    },
    gatewayChatUrl,
    providerChatUrl,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MARKER_RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

// Free-tier models intermittently answer recall questions in their own words
// instead of echoing the marker verbatim. Retry with fresh prompts; the
// assertion itself is never weakened.
async function retryMarkerReply(label, complete, assertReply) {
  let lastError;
  const attempts = MARKER_RETRY_DELAYS_MS.length + 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const reply = await complete();
      assertReply(reply);
      return reply;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.log(`[probe] ${label} attempt ${attempt}/${attempts} failed (${String(error && error.message ? error.message : error).slice(0, 120)}); retrying.`);
        await delay(MARKER_RETRY_DELAYS_MS[attempt - 1]);
      }
    }
  }
  throw lastError;
}

async function waitForVerbatimReply(page, marker, timeoutMs = 120_000) {
  const locator = page.getByText(marker, { exact: false });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const texts = await locator.allInnerTexts().catch(() => []);
    const candidates = texts.filter((text) => text.includes(marker));
    if (candidates.length >= 2) return candidates[candidates.length - 1].trim();
    await delay(250);
  }
  const bodyText = await page.locator('body').innerText().catch(() => '(body unavailable)');
  const tail = bodyText.split('\n').filter(Boolean).slice(-40).join(' | ');
  console.log(`[app-dump] timeout waiting for ${marker}. Body tail: ${tail.slice(0, 2000)}`);
  throw new Error(`The app did not render a verbatim assistant reply containing ${marker}.`);
}

async function waitForSettledChat(page, timeoutMs = 120_000) {
  const input = page.getByPlaceholder('Type your thoughts...', { exact: true });
  await input.waitFor({ state: 'visible', timeout: timeoutMs });
  await delay(400);
}

async function sendPrompt(page, prompt) {
  const input = page.getByPlaceholder('Type your thoughts...', { exact: true });
  await input.fill(prompt);
  // react-native-web binds keydown to the textarea itself (handler reads e.target,
  // not document.activeElement) — dispatching on the node avoids focus races where
  // an async effect steals focus between fill() and press().
  const dispatchEnter = () => page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('textarea'))
      .find((node) => node.getAttribute('placeholder') === 'Type your thoughts...');
    if (!el) return 'no-textarea';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    return 'dispatched';
  }).catch(() => '(eval failed)');
  let status = await dispatchEnter();
  let cleared = await input.inputValue().then((v) => v.trim().length === 0).catch(() => true);
  if (!cleared && status !== 'dispatched') {
    console.log(`[send] enter not delivered (${status}); retrying`);
    await page.waitForTimeout(500);
    status = await dispatchEnter();
    cleared = await input.inputValue().then((v) => v.trim().length === 0).catch(() => true);
  }
  console.log(`[send] len=${prompt.length} ${status} cleared=${cleared}`);
}

async function openSettings(page, config) {
  await page.goto(`${config.appUrl}/settings`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByText('Settings', { exact: true }).waitFor({ timeout: 60_000 });
}

async function openAccordion(page, title) {
  const button = page.getByRole('button', { name: new RegExp(`^${title}(,|$)`) });
  await button.waitFor({ timeout: 30_000 });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

async function signInApp(page, config, credentials) {
  await page.goto(`${config.appUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('Settings', { exact: true }).waitFor({ timeout: 90_000 });
}

async function signOutApp(page, config) {
  await openSettings(page, config);
  await openAccordion(page, 'Account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).waitFor({ timeout: 90_000 });
}

async function openChat(page, config) {
  await page.goto(`${config.appUrl}/chat`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByPlaceholder('Type your thoughts...', { exact: true }).waitFor({ timeout: 90_000 });
}

async function assertManagedPicker(page) {
  const modelButton = page.getByRole('button', { name: /^Model:/ }).first();
  await modelButton.waitFor({ timeout: 60_000 });
  await modelButton.click();
  await page.getByText('Managed models', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByText('Blackrose managed', { exact: true }).waitFor({ timeout: 60_000 });
  await page.getByLabel('Close model picker', { exact: true }).click();
}

async function configureByok(page, config) {
  const steps = [
    ['openSettings', () => openSettings(page, config)],
    ['accordion AI Model', () => openAccordion(page, 'AI Model')],
    ['enable custom AI provider', async () => {
      const toggle = page.getByRole('switch', { name: 'Enable custom AI provider', exact: true });
      if (await toggle.getAttribute('aria-checked') !== 'true') await toggle.click();
    }],
    ['fill Custom AI API key', () => page.getByLabel('Custom AI API key', { exact: true }).fill(config.provider.apiKey)],
    ['accordion Advanced AI provider settings', () => openAccordion(page, 'Advanced AI provider settings')],
    ['fill Custom AI base URL', () => page.getByLabel('Custom AI base URL', { exact: true }).fill(config.provider.baseUrl)],
    ['click Fetch models', () => page.getByRole('button', { name: /Fetch models/ }).click()],
    ['wait models loaded.', () => page.getByText(/models loaded\./, { exact: false }).waitFor({ timeout: 120_000 })],
    ['click Save', () => page.getByRole('button', { name: /Save/ }).click()],
    ['wait AI model saved and enabled.', () => page.getByText('AI model saved and enabled.', { exact: true }).waitFor({ timeout: 60_000 })],
  ];
  for (const [label, fn] of steps) {
    try {
      await fn();
      console.log(`[byok] ok: ${label}`);
    } catch (error) {
      console.log(`[byok] FAIL at: ${label} (${String(error && error.message ? error.message : error).slice(0, 140)})`);
      await page.screenshot({ path: '/tmp/t11-byok-fail.png', fullPage: true }).catch(() => {});
      throw error;
    }
  }
}

async function disableByok(page, config) {
  await openSettings(page, config);
  await openAccordion(page, 'AI Model');
  const toggle = page.getByRole('switch', { name: 'Enable custom AI provider', exact: true });
  if (await toggle.getAttribute('aria-checked') === 'true') {
    await toggle.click();
    await page.waitForTimeout(500);
  }
}

async function finishEntryWithMarker(page, config, marker) {
  await openChat(page, config);
  await sendPrompt(page, `My private memory marker is ${marker}. Keep this fact for a later question.`);
  await waitForSettledChat(page);
  const finish = page.getByRole('button', { name: 'Finish entry', exact: true });
  await finish.waitFor({ timeout: 30_000 });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !(await finish.isEnabled())) await delay(250);
  if (!(await finish.isEnabled())) throw new Error('Finish entry stayed disabled after the memory turn.');
  await finish.click();
  await page.waitForURL(/entry-reflection/, { timeout: 120_000 });
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
    const message = typeof body === 'string' ? body.slice(0, 300) : body?.error?.message || response.statusText;
    throw new Error(`${options.label || 'request'} failed (${response.status}): ${message}`);
  }
  return body;
}

async function signIn(config, credentials) {
  const body = await jsonRequest(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    label: `Supabase app-probe sign-in for ${credentials.email}`,
  });
  if (!body?.access_token) throw new Error(`Supabase returned no app-probe token for ${credentials.email}.`);
  return body.access_token;
}

async function clearMemory(config, token) {
  await jsonRequest(`${config.gatewayUrl}/v1/memory`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    label: 'clear disposable app-probe memory',
  });
}

async function waitForRawRetain(config, token, query, marker, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastBody = null;
  while (Date.now() < deadline) {
    lastBody = await jsonRequest(`${config.gatewayUrl}/v1/memory/recall`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 6 }),
      label: 'raw retain readiness check',
    });
    if (lastBody?.results?.some((item) => item?.content?.includes(marker))) return;
    await delay(1000);
  }
  throw new Error(`App retain readiness did not surface ${marker}: ${JSON.stringify(lastBody)}`);
}

function assertNoMarkerInRecords(records, marker, label) {
  if (records.some((record) => bodyContains(record.body, marker))) {
    throw new Error(`${label} contained forbidden marker ${marker}.`);
  }
}

async function runAppProbe(config, tokens) {
  const secrets = [
    config.supabaseAnonKey,
    config.admin.password,
    config.userA.password,
    config.userB.password,
    config.provider.apiKey,
    tokens?.tokenA,
    tokens?.tokenB,
  ];
  const authTokens = tokens || await Promise.all([
    signIn(config, config.userA),
    signIn(config, config.userB),
  ]).then(([tokenA, tokenB]) => ({ tokenA, tokenB }));
  secrets.push(authTokens.tokenA, authTokens.tokenB);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('dialog', (dialog) => dialog.accept());
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      console.log(`[app-console:${message.type()}] ${message.text().slice(0, 400)}`);
    }
  });
  page.on('pageerror', (error) => console.log(`[app-pageerror] ${error.message}`));
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`[app-nav] ${frame.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/v1/')) {
      console.log(`[app-net] FAILED ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`);
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (!url.includes('/v1/') || url.startsWith(config.supabaseUrl)) return;
    if (response.request().method() === 'OPTIONS') return;
    console.log(`[app-net] <- ${response.status()} ${url}`);
  });
  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes('/v1/ai/chat/completions')) return;
    const body = (request.postData() ?? '').replace(/\s+/g, ' ').slice(0, 400);
    console.log(`[app-net] -> ${request.method()} ${url} BODY ${body}`);
  });
  const observer = createNetworkObserver(page, config);
  const markerA = `blackrose-e2e-${config.runId}-app-user-a-orchid`;
  const markerB = `blackrose-e2e-${config.runId}-app-user-b-cobalt`;
  const noMemoryMarker = `blackrose-e2e-${config.runId}-no-memory`;

  try {
    await Promise.all([clearMemory(config, authTokens.tokenA), clearMemory(config, authTokens.tokenB)]);

    await signInApp(page, config, config.userA);
    await openChat(page, config);
    await assertManagedPicker(page);

    observer.reset();
    await sendPrompt(page, `Reply with exactly MANAGED-${config.runId} and no other text.`);
    const managedReply = await waitForVerbatimReply(page, `MANAGED-${config.runId}`);
    await observer.flush();
    assertObservedAppRoute(
      observer.record.managedChatRequests,
      observer.gatewayChatUrl,
      observer.providerChatUrl,
    );

    await configureByok(page, config);
    await openChat(page, config);
    const byokButton = page.getByRole('button', { name: /^Model:/ }).first();
    await byokButton.waitFor({ timeout: 60_000 });
    await byokButton.click();
    await page.getByText(new URL(config.provider.baseUrl).hostname, { exact: false }).waitFor({ timeout: 60_000 });
    await page.getByLabel('Close model picker', { exact: true }).click();

    observer.reset();
    await sendPrompt(page, `Reply with exactly BYOK-${config.runId} and no other text.`);
    const byokReply = await waitForVerbatimReply(page, `BYOK-${config.runId}`);
    await observer.flush();
    assertObservedAppRoute(
      observer.record.byokChatRequests,
      observer.providerChatUrl,
      observer.gatewayChatUrl,
    );

    await disableByok(page, config);
    await finishEntryWithMarker(page, config, markerA);
    await waitForRawRetain(config, authTokens.tokenA, markerA, markerA);

    observer.reset();
    await openChat(page, config);
    const recallReplyA = await retryMarkerReply(
      `app memory recall A (${markerA})`,
      async () => {
        await waitForSettledChat(page);
        await sendPrompt(page, 'What private memory marker did I ask you to remember? Reply with only that marker. Do not guess.');
        return waitForVerbatimReply(page, markerA);
      },
      (reply) => {
        if (!reply.includes(markerA)) throw new Error(`assistant reply did not contain ${markerA}`);
      },
    );
    await observer.flush();
    assertAppRecallEvidence({
      recallRequests: observer.record.recallRequests,
      managedChatRequests: observer.record.managedChatRequests,
      assistantReply: recallReplyA,
    }, markerA, markerB);
    const userARecallRequestCount = observer.record.recallRequests.length;
    const userAChatRequestsWithRecallContext = observer.record.managedChatRequests.filter((request) => (
      bodyContains(request.body, RECALL_CONTEXT_HEADER)
    )).length;
    assertObservedAppRoute(
      observer.record.managedChatRequests,
      observer.gatewayChatUrl,
      observer.providerChatUrl,
    );

    await signOutApp(page, config);
    await signInApp(page, config, config.userB);
    observer.reset();
    await openChat(page, config);
    await sendPrompt(page, `If no private memory is available, reply exactly ${noMemoryMarker}; do not guess.`);
    await waitForSettledChat(page);
    await observer.flush();
    assertNoMarkerInRecords(observer.record.recallResponses, markerA, 'User B recall response');
    assertNoMarkerInRecords(observer.record.managedChatRequests, markerA, 'User B managed request');
    const userBVisibleText = await page.locator('body').innerText();
    if (userBVisibleText.includes(markerA)) {
      throw new Error(`User B app surface contained User A marker ${markerA}.`);
    }

    await finishEntryWithMarker(page, config, markerB);
    await waitForRawRetain(config, authTokens.tokenB, markerB, markerB);
    observer.reset();
    await openChat(page, config);
    const recallReplyB = await retryMarkerReply(
      `app memory recall B (${markerB})`,
      async () => {
        await waitForSettledChat(page);
        await sendPrompt(page, 'What private memory marker did I ask you to remember? Reply with only that marker. Do not guess.');
        return waitForVerbatimReply(page, markerB);
      },
      (reply) => {
        if (!reply.includes(markerB)) throw new Error(`assistant reply did not contain ${markerB}`);
      },
    );
    await observer.flush();
    assertAppRecallEvidence({
      recallRequests: observer.record.recallRequests,
      managedChatRequests: observer.record.managedChatRequests,
      assistantReply: recallReplyB,
    }, markerB, markerA);
    assertObservedAppRoute(
      observer.record.managedChatRequests,
      observer.gatewayChatUrl,
      observer.providerChatUrl,
    );

    await openSettings(page, config);
    const blockedSupabaseRequests = [];
    await page.route(`${config.supabaseUrl}/**`, async (route) => {
      blockedSupabaseRequests.push(route.request().url());
      await route.abort();
    });
    let offlineAccountText;
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.getByText('Settings', { exact: true }).waitFor({ timeout: 90_000 });
      await openAccordion(page, 'Account');
      offlineAccountText = await page.getByText(config.userB.email, { exact: false }).innerText();
    } finally {
      await page.unroute(`${config.supabaseUrl}/**`);
    }
    if (!offlineAccountText.includes(config.userB.email)) {
      throw new Error('Offline app reopen did not preserve the previously authenticated account.');
    }

    const evidence = liveProbe.redactEvidence({
      runId: config.runId,
      generatedAt: new Date().toISOString(),
      appUrl: new URL(config.appUrl).origin,
      verbatimAssistantReplies: {
        managed: managedReply,
        byok: byokReply,
        userARecall: recallReplyA,
        userBRecall: recallReplyB,
      },
      appRouteProof: {
        managedGateway: observer.gatewayChatUrl,
        byokProvider: observer.providerChatUrl,
        managedWasNotProvider: true,
        byokWasNotGateway: true,
      },
      recallHookProof: {
        userARecallRequests: userARecallRequestCount,
        userAChatRequestsWithRecallContext,
        userBMarkerAbsentFromUserBSurfaceBeforeRetain: true,
      },
      accountSwitchProof: {
        switchedFrom: config.userA.email,
        switchedTo: config.userB.email,
        userAMarker: markerA,
        userBMarker: markerB,
      },
      offlineReopenProof: {
        account: config.userB.email,
        blockedSupabaseRequestCount: blockedSupabaseRequests.length,
      },
      rawRetainReadinessIsNotAppRecallEvidence: true,
    }, secrets);
    fs.mkdirSync(config.artifactDir, { recursive: true });
    const artifact = path.join(config.artifactDir, `control-plane-app-${config.runId}.json`);
    fs.writeFileSync(artifact, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    console.log(`Verbatim app evidence written to ${artifact}`);
    console.log(JSON.stringify(evidence.verbatimAssistantReplies, null, 2));
    return evidence;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(liveProbe.redactEvidence(message, secrets));
  } finally {
    await Promise.allSettled([clearMemory(config, authTokens.tokenA), clearMemory(config, authTokens.tokenB)]);
    observer.stop();
    await browser.close();
  }
}

if (require.main === module) {
  if (process.env[APP_LIVE_ENV] !== '1') {
    console.log(`SKIP live app probe: set ${APP_LIVE_ENV}=1 and run the documented control-plane probe.`);
  } else {
    const config = buildAppProbeConfig(process.env);
    runAppProbe(config).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`LIVE APP PROBE FAILED: ${message}`);
      process.exitCode = 1;
    });
  }
}

module.exports = {
  assertAppRecallEvidence,
  assertObservedAppRoute,
  buildAppProbeConfig,
  runAppProbe,
};
