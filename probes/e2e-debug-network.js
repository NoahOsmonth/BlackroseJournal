/* Debug: capture network + console on chat send. */
const { chromium } = require('playwright');
const EMAIL = 'qa-e2e@brj.test';
const PASS = 'qa-e2e-pass-123';

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', m => { const t = m.text(); if (!/Download the React DevTools|expo-iap|warning/i.test(t)) console.log('[console]', m.type(), t.slice(0, 300)); });
  page.on('request', r => { if (!/localhost:8081|supabase/.test(r.url())) console.log('[req]', r.method(), r.url().slice(0, 150)); });
  page.on('response', r => { if (/openrouter|nano|gpt|localhost:8888/.test(r.url())) console.log('[res]', r.status(), r.url().slice(0, 150)); });
  page.on('requestfailed', r => console.log('[reqfail]', r.url().slice(0, 150), r.failure()?.errorText));

  await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('div[role="button"]:has-text("Sign in"), button:has-text("Sign in")');
  await page.waitForTimeout(6000);
  await page.goto('http://localhost:8081/chat', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(8000);
  const input = await page.$('textarea, [contenteditable="true"]');
  await input.click().catch(() => {});
  await input.type('hello there, quick test message', { delay: 5 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(20000);
  const txt = await page.evaluate(() => document.body.innerText);
  console.log('[body-tail]', txt.slice(-400));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
