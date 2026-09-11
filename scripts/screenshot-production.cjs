/* Capture production Expo web screens using path routes (not hash). */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'example-design', 'concepts', 'inventory', 'production');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const base = (process.env.EXPO_WEB_URL || 'http://localhost:8081').replace(/\/$/, '');

const routes = [
  ['today', '/'],
  ['entries', '/entries'],
  ['insights', '/insights'],
  ['explore-memory', '/explore'],
  ['settings', '/settings'],
  ['chat', '/chat'],
  ['drafts', '/drafts'],
  ['goals', '/goals'],
  ['memory-graph', '/memory-graph'],
  ['ask-rosebud', '/ask-rosebud'],
  ['saved-insights', '/saved-insights'],
  ['rewards', '/rewards'],
  ['streak-view', '/streak-view'],
  ['streak-haiku', '/streak-haiku'],
  ['suggestions', '/suggestions'],
  ['happiness-recipe', '/happiness-recipe'],
  ['entry-reflection', '/entry-reflection'],
  ['checkin-detail', '/checkin-detail'],
  ['intention-select', '/intentions/select'],
  ['intention-detail', '/intentions/detail'],
  ['intention-chat', '/intentions/chat'],
  ['intention-edit', '/intentions/edit'],
  ['persona-new', '/persona/new'],
  ['persona-advanced', '/persona/advanced'],
  ['persona-generate', '/persona/generate'],
  ['login', '/login'],
  ['signup', '/signup'],
  ['forgot-password', '/forgot-password'],
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    await page.goto(base + '/', { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(5000);
    console.log('warmed', page.url(), 'title=', await page.title());
  } catch (err) {
    console.error('FAIL warm', err.message);
    await browser.close();
    process.exit(1);
  }

  for (const [slug, route] of routes) {
    const url = base + route;
    const out = path.join(outDir, slug + '.png');
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: out, fullPage: true });
      const size = fs.statSync(out).size;
      console.log('OK', slug, 'bytes=', size, 'url=', page.url());
    } catch (err) {
      console.error('FAIL', slug, err.message);
    }
  }

  await browser.close();
  console.log('Done →', outDir);
})();
