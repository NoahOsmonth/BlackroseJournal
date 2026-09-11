// Send one user message and wait for reply.
const text = process.argv?.[2] || process.env.PW_TEXT;
const q = text || 'What did I talk about yesterday? Check your tools if needed.';
console.log('SEND', q);
const input = state.page.locator('textarea[placeholder*="Type your thoughts"], input[placeholder*="Type your thoughts"]').first();
await input.waitFor({ state: 'visible', timeout: 20000 });
await input.click();
await input.fill('');
await input.type(q, { delay: 15 });
await state.page.keyboard.press('Enter');
const started = Date.now();
const before = await state.page.locator('body').innerText();
let sawThinking = false;
let lastLen = before.length;
let stableSince = Date.now();
while (Date.now() - started < 180000) {
  const body = await state.page.locator('body').innerText();
  const thinking = /AI is thinking|AI typing/i.test(body);
  if (thinking) sawThinking = true;
  if (body.length !== lastLen) {
    lastLen = body.length;
    stableSince = Date.now();
  }
  const inputBack = await input.isVisible({ timeout: 300 }).catch(() => false);
  const idle = Date.now() - stableSince;
  if (!thinking && inputBack && idle > 12000 && (sawThinking || Date.now() - started > 25000) && body.length > before.length) {
    const reply = body.startsWith(before) ? body.slice(before.length) : body.slice(-4000);
    console.log('ELAPSED', Date.now() - started, 'sawThinking', sawThinking);
    console.log('REPLY_START');
    console.log(reply.trim());
    console.log('REPLY_END');
    if (state.toolLog) {
      console.log('TOOLLOG_START');
      console.log(state.toolLog.join('\n'));
      console.log('TOOLLOG_END');
      state.toolLog = [];
    }
    break;
  }
  await new Promise((r) => setTimeout(r, 2500));
}
console.log('DONE_SEND');
