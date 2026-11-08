import { chromium } from 'playwright';
import { launchOptions } from './chromium.mjs';
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1248, height: 871 } });
await page.addInitScript(() => {
  window.__samples = [];
  const orig = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) {
    if (/rosebud_local_memory$/.test(k) && window.__samples.length < 2) {
      window.__samples.push({ k, stack: (new Error()).stack || '' });
    }
    return orig.call(this, k);
  };
});
await page.goto('http://localhost:8081/today', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
const data = await page.evaluate(() => window.__samples);
for (const s of data) {
  console.log('KEY ' + s.k.slice(-30));
  console.log(s.stack.split('\n').slice(1, 30).join('\n'));
}
await browser.close();
