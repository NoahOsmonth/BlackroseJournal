import { chromium } from 'playwright';
import { launchOptions } from './chromium.mjs';
const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({ viewport: { width: 1248, height: 871 } });
await page.addInitScript(() => {
  window.__t = [];
  const orig = Storage.prototype.getItem;
  Storage.prototype.getItem = function (k) {
    if (/:goals$/.test(k)) window.__t.push(Math.round(performance.now()));
    return orig.call(this, k);
  };
});
await page.goto('http://localhost:8081/today', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(7000);
const t = await page.evaluate(() => window.__t);
console.log('GOALS READS', t.length, 'FIRST', t[0], 'LAST', t[t.length-1], 'SPAN', t[t.length-1]-t[0]);
console.log('TIMES', t.slice(0, 32).join(','));
await browser.close();
