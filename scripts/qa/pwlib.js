// Shared helpers for QA playwriter scripts (cat this before your script body).
const ACC = '16cdd861-7cb2-4ce3-92b8-2a6d1f93a26f';
const PRE = '@blackrose_account:v1:' + ACC + ':';

/**
 * Click an exact-text element reliably.
 *
 * The tab bar is `position: fixed` at the bottom, so a row scrolled just into
 * view has its centre covered by the bar and the click lands on the nav
 * (observed: "Create local backup" navigated to Archive). Centre the element
 * first, then click with force so actionability checks do not scroll it back
 * under the bar.
 */
async function tapText(text, opts) {
  const p = globalThis.page || state.page;
  const locator = p.getByText(text, { exact: true }).first();
  await locator.waitFor({ state: 'attached', timeout: 15000 });
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout((opts && opts.wait) || 400);
  await locator.click({ force: true });
  await p.waitForTimeout((opts && opts.after) || 1200);
  return true;
}

/**
 * Storage snapshot for the QA account.
 *
 * Named `storageSnapshot`, NOT `snapshot`: playwriter's own headless runtime
 * exposes a built-in `snapshot(options)` and it wins the name, which made every
 * storage probe die with "Cannot destructure property 'page' of 'options'".
 */
async function storageSnapshot() {
  const p = globalThis.page || state.page;
  return p.evaluate((pre) => {
    const len = (k) => (localStorage.getItem(pre + k) || '').length;
    const count = (k) => {
      try {
        const v = JSON.parse(localStorage.getItem(pre + k) || '{}');
        return Array.isArray(v) ? v.length : Object.keys(v).length;
      } catch { return -1; }
    };
    let atoms = 0;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(pre + 'rosebud_local_memory_shard:')) {
        try {
          const env = JSON.parse(localStorage.getItem(k) || '{}');
          atoms += Object.keys(env.atoms || {}).length;
        } catch {}
      }
    }
    return {
      entries: count('journal_entries'),
      checkins: count('intention_checkins'),
      goals: count('goals'),
      atoms,
      identityBytes: len('rosebud_identity_profile'),
      digestBytes: len('blackrose_day_digests'),
      sessionDigestIndex: len('rosebud_session_digest_index'),
      chatSessions: len('blackrose_chat_sessions'),
      manifestBytes: len('blackrose_memory_manifest'),
      url: location.pathname,
    };
  }, PRE);
}

/** True when an exact-text leaf node is in the DOM. */
async function hasText(text) {
  const p = globalThis.page || state.page;
  return p.evaluate((t) => Array.from(document.querySelectorAll('div,span'))
    .some(e => (e.textContent || '').trim() === t && e.children.length === 0), text);
}

/** Make sure a child row is rendered, toggling its accordion header when needed. */
async function ensureVisible(childText, toggleText) {
  if (await hasText(childText)) return true;
  await tapText(toggleText);
  return hasText(childText);
}

/** Centre an element, then click it with force (survives fixed-nav overlap and off-viewport modals). */
async function scrollClick(locator, waitMs) {
  const p = globalThis.page || state.page;
  await locator.waitFor({ state: 'attached', timeout: 15000 });
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  await locator.click({ force: true });
  await p.waitForTimeout(waitMs === undefined ? 600 : waitMs);
}

const QA_EMAIL = 'sigmundsarino@gmail.com';
const QA_PASSWORD = 'qa-restore-123';

/** Collect every browser dialog (confirm/alert) and auto-accept it. */
function captureDialogs(p) {
  const dialogs = [];
  p.on('dialog', async (d) => {
    dialogs.push(d.type() + ':' + d.message().slice(0, 90));
    await d.accept();
  });
  return dialogs;
}

/**
 * Sign in through the QA stub when the app is sitting on an auth screen.
 *
 * Indicator-based, not URL-based: the app redirects between /login,
 * /forgot-password and /signup on its own, so a URL check both misfires and
 * misses. A freshly created headless session has an EMPTY localStorage, so
 * every script must call this before touching app state.
 */
async function signInIfNeeded() {
  const p = globalThis.page || state.page;
  await p.goto('http://localhost:8081/settings', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(5000);

  const hasPasswordField = () => p.evaluate(() => !!document.querySelector('input[type="password"]'));
  if (!(await hasPasswordField())) {
    return 'signed-in';
  }

  await p.locator('input[type="email"]').first().fill(QA_EMAIL);
  await p.locator('input[type="password"]').first().fill(QA_PASSWORD);
  await p.getByText('Sign in', { exact: true }).first().click({ force: true });

  for (let i = 0; i < 25; i += 1) {
    await p.waitForTimeout(1000);
    if (!(await hasPasswordField())) {
      await p.waitForTimeout(1500);
      return 'signed-in:' + p.url();
    }
  }
  return 'sign-in-timeout:' + p.url();
}

/** Poll an async predicate until it returns true (or the deadline passes). */
async function waitFor(fn, timeoutMs, label) {
  const deadline = Date.now() + (timeoutMs || 20000);
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await (globalThis.page || state.page).waitForTimeout(700);
  }
  return last === undefined ? null : last;
}

/**
 * Seed demo data (Settings > Data Management) when the account store is empty.
 * Idempotent enough for QA: the seed replaces its own previous rows only.
 */
async function seedDemoDataIfEmpty(force) {
  const p = globalThis.page || state.page;
  const before = await storageSnapshot();
  if (!force && (before.entries > 0 || before.checkins > 0 || before.goals > 0)) {
    return 'not-empty:' + JSON.stringify(before);
  }
  await p.goto('http://localhost:8081/settings', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4000);
  await expandSection('Data Management');
  const seed = p.getByText('Seed demo data', { exact: true }).first();
  await seed.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  await seed.click({ force: true });

  const filled = await waitFor(async () => {
    const snap = await storageSnapshot();
    return snap.entries > 0 && snap.checkins > 0 && snap.goals > 0 ? snap : null;
  }, 60000);
  return JSON.stringify(filled);
}

/** Open (never toggle closed) a settings accordion section by its header text. */
async function expandSection(headerText) {
  const p = globalThis.page || state.page;
  const header = p.getByText(headerText, { exact: true }).first();
  await header.waitFor({ state: 'attached', timeout: 15000 });
  await header.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  await header.click({ force: true });
  await p.waitForTimeout(1200);
  return true;
}
