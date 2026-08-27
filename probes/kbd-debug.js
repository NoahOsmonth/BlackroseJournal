const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const logs = [];
  page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 200)));
  page.on('pageerror', e => logs.push('PAGEERROR: ' + String(e).slice(0, 300)));
  await page.goto('http://localhost:8081/chat', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(10000);
  console.log(logs.slice(0, 25).join('\n'));
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('BODY:', JSON.stringify(bodyText));
  await browser.close();
})();
