/* Full E2E memory-pipeline probe: sign in → send message → verify stream → finish entry →
   verify journal entry + atoms + day digest + session digest + identity in localStorage. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EMAIL = 'qa-e2e@brj.test';
const PASS = 'qa-e2e-pass-123';
const OUT = 'probes/artifacts/e2e-memory-pipeline.json';
const results = { steps: [], errors: [] };
const step = (name, data) => { results.steps.push({ name, ...data }); console.log(name, JSON.stringify(data).slice(0, 400)); };

// Read device-direct provider creds from .env (never hardcode/commit).
function readEnvFile() {
  const text = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8');
  return Object.fromEntries(text.split(/\r?\n/).map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
}
const ENV = readEnvFile();
const OPENROUTER = {
  baseUrl: (ENV.EXPO_PUBLIC_NANO_GPT_API_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
  model: ENV.EXPO_PUBLIC_NANO_GPT_MODEL || 'dots-studio/dots-3-note-preview:free',
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => results.errors.push('PAGEERROR: ' + String(e).slice(0, 300)));

  // 1. Sign in via real UI
  await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('div[role="button"]:has-text("Sign in"), button:has-text("Sign in")');
  await page.waitForTimeout(8000);
  step('signin', { url: page.url() });

  // Enable BYOK (device-direct) so chat avoids the unconfigured managed backend.
  // Transport mode = loadCustomAiProviderSettings().enabled ? 'byok' : 'managed'.
  // Device-direct reads the inlined EXPO_PUBLIC_NANO_GPT_* env, so enabled:true
  // + a valid free selection suffices; apiKey/baseUrl come from the build env.
  const byok = await page.evaluate(({ baseUrl, model }) => {
    const PREFIX = '@blackrose_account:v1:';
    let uid = null;
    const acctKey = Object.keys(localStorage).find(k => k.startsWith(PREFIX));
    if (acctKey) uid = acctKey.slice(PREFIX.length).split(':')[0];
    if (!uid) {
      // Fallback: parse the Supabase session token for user.id.
      const tokKey = Object.keys(localStorage).find(k => k.includes('-auth-token'));
      try { if (tokKey) uid = (JSON.parse(localStorage.getItem(tokKey)).user || {}).id || null; } catch {}
    }
    if (!uid) return { injected: false, reason: 'could not determine active account uid' };
    const scopedKey = `${PREFIX}${encodeURIComponent(uid)}:@blackrose_custom_ai_provider`;
    localStorage.setItem(scopedKey, JSON.stringify({
      enabled: true, baseUrl, apiKey: '', selectedModelId: model, models: [],
      freeOnly: true, recentModelIds: [], fallbackContextWindow: 128000, updatedAt: Date.now(),
    }));
    return { injected: true, scopedKey, uid };
  }, { baseUrl: OPENROUTER.baseUrl, model: OPENROUTER.model });
  step('byok-inject', byok);
  if (!byok.injected) { console.log(JSON.stringify(results)); await browser.close(); process.exit(1); }

  // Clear journal/history storage for clean recall probe (per AGENTS.md E2E rule)
  await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k =>
      k.includes('journal') || k.includes('memory') || k.includes('digest') || k.includes('identity') || k.includes('session'));
    keys.forEach(k => localStorage.removeItem(k));
    return keys;
  }).then(keys => step('cleared-storage', { keys }));

  // 2. Go to chat, send a message
  await page.goto('http://localhost:8081/chat', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(10000);
  const input = await page.$('textarea, [contenteditable="true"]');
  step('chat-loaded', { hasInput: !!input, url: page.url() });
  if (!input) { await page.screenshot({ path: 'probes/artifacts/e2e-chat-fail.png' }); console.log(JSON.stringify(results)); await browser.close(); process.exit(1); }

  const msg = 'Hey! My name is Tay and today was rough — I had an argument with my brother about family money and it kept looping in my head all afternoon. I want to remember this day.';
  await input.click().catch(() => {});
  await input.type(msg, { delay: 5 }).catch(() => {});
  await page.waitForTimeout(800);
  // send via Enter
  await page.keyboard.press('Enter');
  await page.waitForTimeout(12000); // let stream complete (free model can be slow)
  const bodyText = await page.evaluate(() => document.body.innerText);
  step('assistant-reply', { snippet: bodyText.slice(-800) });
  await page.screenshot({ path: 'probes/artifacts/e2e-chat-reply.png', fullPage: true });

  // 3. Finish entry
  const els = await page.$$('div[role="button"], button');
  let finishBtn = null;
  for (const el of els) { const t = (await el.textContent().catch(() => '')) || ''; if (t.includes('Finish entry')) { finishBtn = el; break; } }
  step('finish-button', { found: !!finishBtn });
  if (finishBtn) {
    await finishBtn.click().catch(e => results.errors.push('finish click: ' + String(e).slice(0, 200)));
    await page.waitForTimeout(15000); // allow side effects (atoms, digests, hindsight retain)
  }
  await page.screenshot({ path: 'probes/artifacts/e2e-after-finish.png', fullPage: true });

  // 4. Read back storage
  const storage = await page.evaluate(() => {
    const out = {};
    for (const k of Object.keys(localStorage)) {
      if (k.length > 120) { out[k] = (localStorage.getItem(k) || '').slice(0, 1500); }
    }
    return out;
  });
  const pick = {};
  for (const [k, v] of Object.entries(storage)) {
    if (k.includes('@journal_entries')) pick.journalEntries = v;
    if (k.includes('@rosebud_local_memory')) pick.localMemory = v;
    if (k.includes('@blackrose_day_digests')) pick.dayDigests = v;
    if (k.includes('session_digest_index')) pick.sessionDigestIndex = v;
    if (k.includes('@rosebud_identity_profile')) pick.identity = v;
    if (k.includes('@intentions')) pick.intentions = v;
  }
  step('storage-after-finish', {
    keys: Object.keys(storage).length,
    journalEntriesLen: (pick.journalEntries || '').length,
    localMemoryLen: (pick.localMemory || '').length,
    dayDigestsLen: (pick.dayDigests || '').length,
    sessionDigestIndexLen: (pick.sessionDigestIndex || '').length,
    identityLen: (pick.identity || '').length,
    identitySnippet: (pick.identity || '').slice(0, 400),
    atomsSnippet: (pick.localMemory || '').slice(0, 500),
  });
  require('fs').writeFileSync(OUT, JSON.stringify({ results, pick }, null, 2));
  console.log('WROTE', OUT);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
