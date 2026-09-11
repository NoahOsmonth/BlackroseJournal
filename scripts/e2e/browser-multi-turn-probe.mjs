/**
 * Browser E2E: multi-turn freeform chat against running Expo web.
 * Run: node scripts/e2e/browser-multi-turn-probe.mjs
 * Requires Expo web on http://localhost:8081 and RUN_E2E_BROWSER=1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8081';
const OUT_DIR = path.join(process.cwd(), 'output', 'playwright');
const LOG_PATH = path.join(OUT_DIR, `browser-multi-turn-${Date.now()}.log`);
const SCREENSHOT_DIR = path.join(OUT_DIR, 'shots');

const TURNS = [
  {
    label: 'turn-1-yesterday',
    text: 'What did I talk about yesterday?',
    timeoutMs: 180_000,
  },
  {
    label: 'turn-2-exact-words',
    text: 'What were my exact words about my boss?',
    timeoutMs: 180_000,
  },
  {
    label: 'turn-3-long-term-recall',
    text: 'Do you remember when I first started journaling? What was one of the earliest memories you can find?',
    timeoutMs: 180_000,
  },
  {
    label: 'turn-4-first-chat',
    text: "What's my very first chat with you? The oldest conversation we ever had.",
    timeoutMs: 240_000,
  },
];

function log(...parts) {
  const line = parts.join(' ');
  console.log(line);
  fs.appendFileSync(LOG_PATH, `${line}\n`, 'utf8');
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForReady(page, deadlineMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < deadlineMs) {
    const title = await page.title().catch(() => '');
    const body = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    if (body && body.length > 20) {
      log(`page ready title="${title}" bodyChars=${body.length}`);
      return body;
    }
    await wait(2000);
  }
  throw new Error('App did not become ready within deadline');
}

async function findChatEntry(page) {
  // Prefer explicit chat links/buttons; fall back to common FAB labels.
  const candidates = [
    page.getByRole('button', { name: /chat|rosebud|talk|write|journal/i }).first(),
    page.getByText(/chat|rosebud/i).first(),
    page.getByRole('link', { name: /chat|rosebud/i }).first(),
  ];
  for (const c of candidates) {
    try {
      if (await c.isVisible({ timeout: 1500 })) {
        return c;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function messageCount(page) {
  // Chat bubbles render as Text nodes; count assistant-looking paragraphs conservatively.
  return page.locator('[data-testid="chat-message"]').count().catch(() => -1);
}

async function submitMessage(page, text) {
  const input = page.locator('input[placeholder*="Type your thoughts"], textarea[placeholder*="Type your thoughts"]').first();
  if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) {
    throw new Error('Chat input not found (placeholder "Type your thoughts...")');
  }
  await input.click();
  await input.fill('');
  await input.type(text, { delay: 20 });
  await input.press('Enter');
  log(`submitted: ${text}`);
}

async function waitForAssistantSettle(page, timeoutMs) {
  const started = Date.now();
  let lastLen = -1;
  let stableSince = Date.now();
  const typing = page.getByText(/AI is thinking/i);
  const input = page.locator('input[placeholder*="Type your thoughts"], textarea[placeholder*="Type your thoughts"]').first();

  while (Date.now() - started < timeoutMs) {
    const thinking = await typing.isVisible({ timeout: 300 }).catch(() => false);
    const body = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const len = body.length;
    if (len !== lastLen) {
      lastLen = len;
      stableSince = Date.now();
    }
    const inputBack = await input.isVisible({ timeout: 300 }).catch(() => false);
    const idleFor = Date.now() - stableSince;
    if (!thinking && inputBack && idleFor > 4000 && len > 50) {
      return { elapsedMs: Date.now() - started, body };
    }
    await wait(1500);
  }
  const body = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  return { elapsedMs: Date.now() - started, body, timedOut: true };
}

function extractNewReply(previousBody, currentBody) {
  // Best-effort: take the tail of current body after previous body length overlap.
  if (!previousBody) return currentBody.slice(-4000);
  if (currentBody.startsWith(previousBody)) {
    return currentBody.slice(previousBody.length).trim().slice(-4000);
  }
  return currentBody.slice(-4000);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  log('=== browser multi-turn tool-calling probe ===');
  log(`base=${BASE} node=${process.version}`);

  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
    channel: 'chrome',
  });
  const context = await browser.newContext({
    viewport: { width: 420, height: 900 },
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    const t = msg.text();
    if (/error|warn|429|504|Hindsight|recall|tool/i.test(t)) {
      log(`[console:${msg.type()}] ${t.slice(0, 500)}`);
    }
  });
  page.on('pageerror', (err) => log(`[pageerror] ${String(err).slice(0, 500)}`));

  const EMAIL = process.env.E2E_EMAIL;
  const PASSWORD = process.env.E2E_PASSWORD;
  if (!EMAIL || !PASSWORD) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD for signed-in browser probe');
  }

  try {
    log(`goto ${BASE}`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await wait(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00-landing.png'), fullPage: true });
    const readyBody = await waitForReady(page);
    log(`landing body preview:\n${readyBody.slice(0, 800)}`);

    // Sign in if the auth gate is showing.
    if (/Welcome back|Sign in to sync/i.test(readyBody)) {
      log('auth gate detected; signing in');
      const emailSel = 'input[placeholder*="email" i], input[type="email"]';
      const passSel = 'input[type="password"], input[secureTextEntry], input[placeholder*="password" i]';
      await page.locator(emailSel).first().fill(EMAIL);
      await page.locator(passSel).first().fill(PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).first().click();
      await wait(8000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '00b-after-signin.png'), fullPage: true });
      const after = await page.locator('body').innerText().catch(() => '');
      log(`after sign-in preview:\n${after.slice(0, 600)}`);
      if (/Welcome back|Sign in to sync/i.test(after)) {
        throw new Error('Sign-in did not leave the login screen');
      }
    }

    // After login the app lands on settings — go to chat.
    {
      let chatBody = await page.locator('body').innerText().catch(() => '');
      if (!/Type your thoughts/i.test(chatBody)) {
        log('navigating to /chat after auth');
        await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await wait(8000);
        chatBody = await page.locator('body').innerText().catch(() => '');
      }
      if (!/Type your thoughts/i.test(chatBody)) {
        const entry = await findChatEntry(page);
        if (entry) {
          log('clicking chat entry control');
          await entry.click();
          await wait(8000);
        } else {
          for (const route of ['/', '/(tabs)', '/(tabs)/entries', '/(tabs)/today']) {
            log(`try route ${route}`);
            await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
            await wait(4000);
            const b = await page.locator('body').innerText().catch(() => '');
            if (/Type your thoughts|chat|rosebud|new entry|write/i.test(b)) {
              log(`route ${route} looks promising`);
              await page.screenshot({ path: path.join(SCREENSHOT_DIR, `route${route.replace(/\W+/g, '_')}.png`), fullPage: true });
              break;
            }
          }
        }
      }
    }

    // Navigate to chat route directly if needed.
    const onChat = /Type your thoughts/i.test(readyBody);
    if (!onChat) {
      log('not on chat yet; trying /chat');
      await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await wait(8000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-chat-route.png'), fullPage: true });
      const chatBody = await page.locator('body').innerText().catch(() => '');
      if (!/Type your thoughts/i.test(chatBody)) {
        const entry = await findChatEntry(page);
        if (entry) {
          log('clicking chat entry control');
          await entry.click();
          await wait(8000);
        } else {
          // try home tabs
          for (const route of ['/', '/(tabs)', '/(tabs)/entries', '/(tabs)/today']) {
            log(`try route ${route}`);
            await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
            await wait(4000);
            const b = await page.locator('body').innerText().catch(() => '');
            if (/Type your thoughts|chat|rosebud|new entry|write/i.test(b)) {
              log(`route ${route} looks promising`);
              await page.screenshot({ path: path.join(SCREENSHOT_DIR, `route${route.replace(/\W+/g, '_')}.png`), fullPage: true });
              break;
            }
          }
        }
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-before-turns.png'), fullPage: true });
    let previousBody = await page.locator('body').innerText().catch(() => '');
    log(`pre-turn body length=${previousBody.length}`);
    log(`pre-turn preview:\n${previousBody.slice(0, 1200)}`);

    const hasInput = await page
      .locator('input[placeholder*="Type your thoughts"], textarea[placeholder*="Type your thoughts"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!hasInput) {
      log('PROBLEM: chat input never became visible');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FAIL-no-input.png'), fullPage: true });
      throw new Error('Chat input not visible on /chat');
    }

    for (let i = 0; i < TURNS.length; i += 1) {
      const turn = TURNS[i];
      log(`\n----- ${turn.label} -----`);
      await submitMessage(page, turn.text);
      // Snapshot thinking state
      await wait(3000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${i + 1}-thinking.png`), fullPage: true });

      const settle = await waitForAssistantSettle(page, turn.timeoutMs);
      const reply = extractNewReply(previousBody, settle.body);
      previousBody = settle.body;

      const errLike = /error|failed|rate limit|504|429|Something went wrong/i.test(reply);
      const narrationLeak = /tool_call|recall_memory|get_day\(|list_recent_days/i.test(reply);
      const verbatimBoss = /The rework\. My boss keeps changing the requirements and I take it out on everyone\./.test(reply);
      const teapot = /teapot|enamel/i.test(reply);
      const honestFirst =
        /not on the device|don'?t have|cannot find|can'?t find|no record|doesn'?t show|oldest|only goes|limited/i.test(reply);

      log(`elapsedMs=${settle.elapsedMs} timedOut=${!!settle.timedOut}`);
      log(`flags errLike=${errLike} narrationLeak=${narrationLeak} verbatimBoss=${verbatimBoss} teapot=${teapot} honestFirst=${honestFirst}`);
      log(`REPLY(${turn.label}):\n${reply}\n-----END-----`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${i + 1}-${turn.label}.png`), fullPage: true });

      if (settle.timedOut) {
        log(`WARN: ${turn.label} settle timed out`);
      }
      // between-turn cooldown
      if (i < TURNS.length - 1) await wait(20_000);
    }

    log('\n=== DONE ===');
    log(`log=${LOG_PATH}`);
  } catch (err) {
    log(`FATAL: ${String(err && err.stack ? err.stack : err)}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FAIL.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main();
