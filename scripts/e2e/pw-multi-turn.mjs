// Multi-turn freeform chat via Playwriter against Expo web.
const fs = await importModule('node:fs');
const path = await importModule('node:path');

const BASE = 'http://localhost:8081';
const OUT = path.join(process.cwd(), 'output', 'playwright');
const LOG = path.join(OUT, `pw-multi-turn-${Date.now()}.log`);
const SHOTS = path.join(OUT, 'pw-shots');
fs.mkdirSync(SHOTS, { recursive: true });

function log(...parts) {
  const line = parts.join(' ');
  console.log(line);
  fs.appendFileSync(LOG, `${line}\n`, 'utf8');
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function closeOverlays() {
  // Close FAB menu / persona sheet / any blocking overlay before typing.
  for (let i = 0; i < 3; i += 1) {
    const closeMenu = state.page.getByText(/Close menu/i).first();
    try {
      if (await closeMenu.isVisible({ timeout: 400 })) {
        log('closing FAB menu overlay');
        await closeMenu.click({ timeout: 2000 });
        await wait(500);
        continue;
      }
    } catch { /* continue */ }
    break;
  }
}

async function typeAndSend(text) {
  await closeOverlays();
  const input = state.page.locator('textarea[placeholder*="Type your thoughts"], input[placeholder*="Type your thoughts"]').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  // Click a nearby non-interactive area first if needed, then fill.
  await input.click({ timeout: 5000, force: false }).catch(async (e) => {
    log(`input click blocked (${String(e).split('\n')[0]}); retrying after Esc`);
    await state.page.keyboard.press('Escape');
    await wait(400);
    await closeOverlays();
    await input.click({ timeout: 5000 });
  });
  await input.fill('');
  await input.type(text, { delay: 15 });
  // Prefer Enter; if input uses multi-line, also try Go deeper.
  await state.page.keyboard.press('Enter');
  log(`sent: ${text}`);
}

async function waitForReply(previousText, timeoutMs) {
  const started = Date.now();
  let lastLen = previousText.length;
  let stableSince = Date.now();
  while (Date.now() - started < timeoutMs) {
    const body = await state.page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const thinking = /AI is thinking/i.test(body);
    if (body.length !== lastLen) {
      lastLen = body.length;
      stableSince = Date.now();
    }
    const idle = Date.now() - stableSince;
    if (!thinking && idle > 5000 && body.length > previousText.length) {
      return { body, elapsedMs: Date.now() - started, timedOut: false };
    }
    await wait(2000);
  }
  const body = await state.page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  return { body, elapsedMs: Date.now() - started, timedOut: true };
}

function extractNew(previous, current) {
  if (current.startsWith(previous)) return current.slice(previous.length).trim().slice(-5000);
  return current.slice(-5000);
}

// ---- main ----
log('=== playwriter multi-turn chat probe ===');
if (!state.page || state.page.isClosed()) {
  state.page = context.pages().find((p) => p.url().includes('localhost:8081')) ?? context.pages().find((p) => p.url() === 'about:blank') ?? (await context.newPage());
}

await state.page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' });
await wait(6000);
console.log('URL:', state.page.url());
console.log(await getLatestLogs({ page: state.page, sinceLastCall: true }));
let snap = await snapshot({ page: state.page, showDiffSinceLastCall: false });
console.log(snap);

// Auth gate?
const body0 = await state.page.locator('body').innerText().catch(() => '');
if (/Welcome back|Sign in to sync/i.test(body0)) {
  log('auth gate; please ensure signed in');
  throw new Error('Still on login screen');
}

if (!/Type your thoughts/i.test(body0)) {
  log('not on chat; navigating via Write new entry path');
  await state.page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await wait(4000);
  await state.page.getByRole('button', { name: /Write new entry/i }).first().click({ timeout: 8000 });
  await wait(2000);
  // FAB menu may open — pick New Entry
  try {
    await state.page.getByText(/^New Entry$/i).first().click({ timeout: 3000 });
    await wait(4000);
  } catch { /* already on chat or different UI */ }
  await state.page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await wait(5000);
}

await closeOverlays();
const pre = await state.page.locator('body').innerText().catch(() => '');
log(`pre-turn length=${pre.length}`);
log(`pre-turn preview:\n${pre.slice(0, 1000)}`);
await state.page.screenshot({ path: path.join(SHOTS, '00-chat-ready.png'), scale: 'css' });

const TURNS = [
  { label: 'turn-1-yesterday', text: 'What did I talk about yesterday?', timeoutMs: 180000 },
  { label: 'turn-2-exact-words', text: 'What were my exact words about my boss?', timeoutMs: 180000 },
  { label: 'turn-3-long-term', text: 'Do you remember when I first started journaling? What was one of the earliest memories you can find?', timeoutMs: 180000 },
  { label: 'turn-4-first-chat', text: "What's my very first chat with you? The oldest conversation we ever had.", timeoutMs: 240000 },
];

let previous = pre;
for (let i = 0; i < TURNS.length; i += 1) {
  const turn = TURNS[i];
  log(`\n----- ${turn.label} -----`);
  await typeAndSend(turn.text);
  await wait(3000);
  await state.page.screenshot({ path: path.join(SHOTS, `${i + 1}-thinking.png`), scale: 'css' });
  const settle = await waitForReply(previous, turn.timeoutMs);
  const reply = extractNew(previous, settle.body);
  previous = settle.body;
  const narrationLeak = /tool_call|recall_memory|get_day\(|list_recent_days/i.test(reply);
  const verbatimBoss = /The rework\. My boss keeps changing the requirements and I take it out on everyone\./.test(reply);
  log(`elapsedMs=${settle.elapsedMs} timedOut=${settle.timedOut}`);
  log(`flags narrationLeak=${narrationLeak} verbatimBoss=${verbatimBoss}`);
  log(`REPLY(${turn.label}):\n${reply}\n-----END-----`);
  await state.page.screenshot({ path: path.join(SHOTS, `${i + 1}-${turn.label}.png`), scale: 'css' });
  if (i < TURNS.length - 1) await wait(15000);
}

log(`\nLOG=${LOG}`);
console.log('DONE');
