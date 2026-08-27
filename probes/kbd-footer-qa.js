/* Visual QA probe: render /chat at mobile + desktop sizes, screenshot, inspect layout. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const [name, vp] of [
    ['mobile-390x844', { width: 390, height: 844 }],
    ['desktop-1280x800', { width: 1280, height: 800 }],
  ]) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto('http://localhost:8081/chat', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `probes/artifacts/kbd-footer-${name}.png`, fullPage: false });
    // Measure footer visibility
    const footer = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('div[role="button"], button')];
      const goDeeper = btns.find(b => (b.textContent || '').includes('Go deeper'));
      const finish = btns.find(b => (b.textContent || '').includes('Finish entry'));
      const vis = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), inViewport: r.top >= 0 && r.bottom <= innerHeight };
      };
      return { goDeeper: vis(goDeeper), finish: vis(finish), vh: innerHeight, vw: innerWidth };
    });
    console.log(name, JSON.stringify(footer));
    await page.close();
  }
  await browser.close();
})();
