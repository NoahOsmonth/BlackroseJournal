/* Sign in via the real UI, then render /chat at mobile + desktop and measure footer. */
const { chromium } = require('playwright');

const EMAIL = process.env.QA_EMAIL;
const PASS = process.env.QA_PASS;

async function measure(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('div[role="button"], button')];
    const find = (t) => els.find(b => (b.textContent || '').includes(t));
    const vis = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left),
        w: Math.round(r.width), h: Math.round(r.height),
        onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        display: style.display, visibility: style.visibility };
    };
    const input = document.querySelector('textarea, [contenteditable="true"], input[type="text"]:not([type="email"])');
    return { goDeeper: vis(find('Go deeper')), finishEntry: vis(find('Finish entry')),
      typingInputPresent: !!input, vw: innerWidth, vh: innerHeight };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const [name, vp] of [
    ['mobile-390x844', { width: 390, height: 844 }],
    ['desktop-1280x800', { width: 1280, height: 800 }],
  ]) {
    const page = await browser.newPage({ viewport: vp });
    page.on('pageerror', e => console.log(name, 'PAGEERROR:', String(e).slice(0, 200)));
    await page.goto('http://localhost:8081/login', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.click('div[role="button"]:has-text("Sign in"), button:has-text("Sign in")');
    await page.waitForTimeout(8000);
    await page.goto('http://localhost:8081/chat', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(10000);
    const m = await measure(page);
    console.log(name, JSON.stringify(m));
    await page.screenshot({ path: `probes/artifacts/kbd-footer-${name}.png` });

    // Simulate focused typing input (web keyboard equivalent) — footer must remain reachable
    const input = await page.$('textarea, [contenteditable="true"]');
    if (input) {
      await input.click().catch(() => {});
      await input.type('testing keyboard overlap').catch(() => {});
      await page.waitForTimeout(1500);
      const m2 = await measure(page);
      console.log(name + '-typing', JSON.stringify(m2));
      await page.screenshot({ path: `probes/artifacts/kbd-footer-${name}-typing.png` });
    }
    await page.close();
  }
  await browser.close();
})();
