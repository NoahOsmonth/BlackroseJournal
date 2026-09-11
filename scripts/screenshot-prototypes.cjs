/* Screenshot example-design HTML prototypes at phone size for UI inventory. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'example-design', 'concepts', 'inventory');
fs.mkdirSync(outDir, { recursive: true });

const screens = [
  'example-design/updated/today.html',
  'example-design/updated/today/my-intentions.html',
  'example-design/updated/history.html',
  'example-design/updated/drafts.html',
  'example-design/updated/intentions/selecting-intentions.html',
  'example-design/updated/intentions/open-intentions.html',
  'example-design/updated/intentions/intetions-chat.html',
  'example-design/updated/rosebud-dropdown/rosebud-dropdown.html',
  'example-design/updated/rosebud-dropdown/persona/open-persona.html',
  'example-design/updated/rosebud-dropdown/persona/open-persona-swipe-left.html',
  'example-design/updated/rosebud-dropdown/persona/create-persona/new-persona.html',
  'example-design/updated/rosebud-dropdown/persona/create-persona/advance-settings-persona.html',
  'example-design/insights.html',
  'example-design/journal-history.html',
  'example-design/Prototype/memory-graph.html',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });

  for (const rel of screens) {
    const abs = path.join(root, rel).replace(/\\/g, '/');
    const fileUrl = 'file:///' + abs;
    const slug = rel
      .replace(/^example-design\//, '')
      .replace(/\.html$/, '')
      .replace(/[\/\\]/g, '__');
    const out = path.join(outDir, slug + '.png');
    try {
      await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: out, fullPage: true });
      console.log('OK', slug);
    } catch (err) {
      console.error('FAIL', slug, err.message);
    }
  }

  await browser.close();
  console.log('Done →', outDir);
})();
