// Real UI turn with live sampling: catches the ephemeral agent status line.
const question = process.argv?.[2] || 'What have I written about work lately? Look it up in my entries rather than guessing.';
const page = state.page;
console.log('SEND:', question);

const input = page.locator('textarea[placeholder*="Type your thoughts"], input[placeholder*="Type your thoughts"]').first();
await input.waitFor({ state: 'visible', timeout: 20000 });
await input.click();
await input.fill('');
await input.type(question, { delay: 12 });
await page.keyboard.press('Enter');

const started = Date.now();
const samples = [];
let lastSig = '';
let idleSince = Date.now();
let lastLen = 0;

while (Date.now() - started < 300000) {
  const body = await page.locator('body').innerText();
  const busy = /AI is thinking|AI typing|Thinking/i.test(body);
  const sig = body.length + '|' + busy;
  if (body.length !== lastLen) { lastLen = body.length; idleSince = Date.now(); }
  if (sig !== lastSig) {
    lastSig = sig;
    const snap = await snapshot({ page });
    const lines = snap.split('\n').filter((l) => l.trim()).slice(-60).join('\n');
    samples.push({ t: Date.now() - started, busy, snap: lines });
    console.log('--- SAMPLE t=' + (Date.now() - started) + 'ms busy=' + busy + ' ---');
    console.log(lines);
  }
  const inputBack = await input.isVisible({ timeout: 300 }).catch(() => false);
  if (!busy && inputBack && Date.now() - idleSince > 12000 && body.length > 0 && Date.now() - started > 20000) {
    console.log('=== SETTLED after ' + (Date.now() - started) + 'ms, ' + samples.length + ' samples ===');
    break;
  }
  await new Promise((r) => setTimeout(r, 1500));
}

state.statusSamples = samples;
const body = await page.locator('body').innerText();
console.log('FINAL_BODY_START');
console.log(body);
console.log('FINAL_BODY_END');
