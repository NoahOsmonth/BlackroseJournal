import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: process.env.PW_CHROME_PATH, headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:8081/insights', { waitUntil: 'commit', timeout: 120000 });
await p.waitForTimeout(6500);
const t = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
console.log('CLAIM:', (t.match(/\d of 7 days has? a mood\./) || ['none'])[0]);
console.log('WEEK:', (t.match(/This week · [A-Z][a-z]{2} \d+–\d+/) || ['none'])[0]);
await b.close();
